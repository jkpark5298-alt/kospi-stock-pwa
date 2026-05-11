import { NextRequest, NextResponse } from "next/server";
import { inflateRawSync } from "zlib";

export const runtime = "nodejs";

type DartCorpInfo = {
  corpCode: string;
  corpName: string;
  stockCode: string;
};

type DartDisclosureItem = {
  rcept_no: string;
  rcept_dt: string;
  corp_code: string;
  corp_name: string;
  report_nm: string;
  corp_cls?: string;
  flr_nm?: string;
  rm?: string;
};

let corpCodeMapPromise: Promise<Map<string, DartCorpInfo>> | null = null;

export async function GET(request: NextRequest) {
  const apiKey = process.env.DART_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        code: "DART_API_KEY_MISSING",
        message: "DART_API_KEY가 설정되어 있지 않습니다.",
        disclosures: [],
      },
      { status: 200 },
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const inputCorpCode = searchParams.get("corpCode");
  const stockCode = normalizeStockCode(symbol);
  const days = clampNumber(Number(searchParams.get("days") || 90), 7, 90);
  const pageCount = clampNumber(Number(searchParams.get("pageCount") || 10), 5, 20);

  try {
    let corpCode = inputCorpCode?.trim() || "";
    let corpInfo: DartCorpInfo | null = null;

    if (!corpCode) {
      if (!stockCode) {
        return NextResponse.json({
          ok: false,
          code: "STOCK_CODE_REQUIRED",
          message: "DART 공시 조회에는 6자리 종목코드 또는 corpCode가 필요합니다.",
          disclosures: [],
        });
      }

      const corpMap = await getCorpCodeMap(apiKey);
      corpInfo = corpMap.get(stockCode) || null;
      corpCode = corpInfo?.corpCode || "";
    }

    if (!corpCode) {
      return NextResponse.json({
        ok: false,
        code: "CORP_CODE_NOT_FOUND",
        message: "DART corp_code를 찾지 못했습니다.",
        stockCode,
        disclosures: [],
      });
    }

    const endDe = getKstDateString(0);
    const bgnDe = getKstDateString(-days);

    const params = new URLSearchParams({
      crtfc_key: apiKey,
      corp_code: corpCode,
      bgn_de: bgnDe,
      end_de: endDe,
      last_reprt_at: "N",
      page_no: "1",
      page_count: String(pageCount),
    });

    const response = await fetch(
      `https://opendart.fss.or.kr/api/list.json?${params.toString()}`,
      { next: { revalidate: 60 * 30 } },
    );

    const payload = await response.json();

    if (payload.status !== "000" && payload.status !== "013") {
      return NextResponse.json({
        ok: false,
        code: payload.status,
        message: payload.message || "DART 공시 조회 중 오류가 발생했습니다.",
        stockCode,
        corpCode,
        corpName: corpInfo?.corpName,
        disclosures: [],
      });
    }

    const disclosures = ((payload.list || []) as DartDisclosureItem[]).map(
      (item) => ({
        receiptNo: item.rcept_no,
        date: item.rcept_dt,
        corpCode: item.corp_code,
        corpName: item.corp_name,
        reportName: item.report_nm,
        corpClass: item.corp_cls,
        filerName: item.flr_nm,
        note: item.rm,
        viewerUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
      }),
    );

    return NextResponse.json({
      ok: true,
      code: payload.status,
      message:
        payload.status === "013"
          ? "조회된 공시가 없습니다."
          : "최근 공시를 조회했습니다.",
      source: "DART",
      stockCode,
      corpCode,
      corpName: corpInfo?.corpName || disclosures[0]?.corpName || null,
      period: { bgnDe, endDe, days },
      disclosures,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DART_DISCLOSURE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "DART 공시 조회 중 알 수 없는 오류가 발생했습니다.",
        disclosures: [],
      },
      { status: 200 },
    );
  }
}

function normalizeStockCode(value?: string | null) {
  if (!value) return null;

  const match = value.match(/\d{6}/);

  return match ? match[0] : null;
}

async function getCorpCodeMap(apiKey: string) {
  if (!corpCodeMapPromise) {
    corpCodeMapPromise = fetchCorpCodeMap(apiKey);
  }

  return corpCodeMapPromise;
}

async function fetchCorpCodeMap(apiKey: string) {
  const response = await fetch(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`,
    { next: { revalidate: 60 * 60 * 24 } },
  );

  if (!response.ok) {
    throw new Error(`DART corpCode.xml 조회 실패: ${response.status}`);
  }

  const zipBuffer = Buffer.from(await response.arrayBuffer());
  const xml = extractFirstFileFromZip(zipBuffer).toString("utf-8");
  const map = new Map<string, DartCorpInfo>();
  const listRegex = /<list>([\s\S]*?)<\/list>/g;

  let match: RegExpExecArray | null;

  while ((match = listRegex.exec(xml))) {
    const block = match[1];
    const corpCode = getXmlValue(block, "corp_code");
    const corpName = getXmlValue(block, "corp_name");
    const stockCode = getXmlValue(block, "stock_code");

    if (corpCode && corpName && stockCode && /^\d{6}$/.test(stockCode)) {
      map.set(stockCode, { corpCode, corpName, stockCode });
    }
  }

  return map;
}

function getXmlValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));

  return match?.[1]?.trim() || "";
}

function extractFirstFileFromZip(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (buffer.readUInt32LE(centralDirectoryOffset) !== 0x02014b50) {
    throw new Error("DART corpCode ZIP 중앙 디렉터리를 읽지 못했습니다.");
  }

  const compressionMethod = buffer.readUInt16LE(centralDirectoryOffset + 10);
  const compressedSize = buffer.readUInt32LE(centralDirectoryOffset + 20);
  const localHeaderOffset = buffer.readUInt32LE(centralDirectoryOffset + 42);

  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error("DART corpCode ZIP 로컬 헤더를 읽지 못했습니다.");
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) {
    return compressed;
  }

  if (compressionMethod === 8) {
    return inflateRawSync(compressed);
  }

  throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${compressionMethod}`);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      return index;
    }
  }

  throw new Error("DART corpCode ZIP 종료 레코드를 찾지 못했습니다.");
}

function getKstDateString(offsetDays: number) {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);

  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;

  return Math.min(Math.max(Math.trunc(value), min), max);
}

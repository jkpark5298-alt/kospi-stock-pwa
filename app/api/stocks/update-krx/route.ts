import { NextResponse } from "next/server";
import {
  makeYahooSymbol,
  upsertKrxStocks,
  type KrxStock,
} from "../../../../lib/krxStocks";

export const runtime = "nodejs";

type DataGoKrItem = Record<string, unknown>;

const KRX_LISTED_INFO_URL =
  "https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo";

function getServiceKey() {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;

  if (!serviceKey) {
    throw new Error("DATA_GO_KR_SERVICE_KEY is not set.");
  }

  return serviceKey;
}

function normalizeItems(value: unknown): DataGoKrItem[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as DataGoKrItem[];
  return [value as DataGoKrItem];
}

function getText(item: DataGoKrItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];

    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeCode(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(6, "0").slice(-6);
}

function normalizeMarket(value: string) {
  const market = value.trim().toUpperCase();

  if (
    market.includes("KOSPI") ||
    market.includes("유가") ||
    market.includes("거래소")
  ) {
    return "KOSPI";
  }

  if (market.includes("KOSDAQ") || market.includes("코스닥")) {
    return "KOSDAQ";
  }

  if (market.includes("KONEX") || market.includes("코넥스")) {
    return "KONEX";
  }

  return market;
}

function mapItemToStock(item: DataGoKrItem): KrxStock | null {
  const code = normalizeCode(
    getText(item, ["srtnCd", "shortCode", "short_code", "단축코드"]),
  );

  const name = getText(item, ["itmsNm", "itemName", "item_name", "종목명"]);

  const market = normalizeMarket(
    getText(item, ["mrktCtg", "marketCategory", "market", "시장구분"]),
  );

  if (!/^\d{6}$/.test(code)) return null;
  if (!name) return null;
  if (!["KOSPI", "KOSDAQ"].includes(market)) return null;

  return {
    code,
    name,
    market,
    symbol: makeYahooSymbol(code, market),
    isActive: true,
  };
}

async function fetchKrxPage({
  pageNo,
  numOfRows,
  basDt,
}: {
  pageNo: number;
  numOfRows: number;
  basDt?: string;
}) {
  const serviceKey = getServiceKey();
  const params = new URLSearchParams();

  params.set("serviceKey", serviceKey);
  params.set("pageNo", String(pageNo));
  params.set("numOfRows", String(numOfRows));
  params.set("resultType", "json");

  if (basDt) {
    params.set("basDt", basDt);
  }

  const response = await fetch(`${KRX_LISTED_INFO_URL}?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Data.go.kr request failed: ${response.status} ${text.slice(0, 500)}`,
    );
  }

  let json: any;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Data.go.kr response is not JSON: ${text.slice(0, 500)}`);
  }

  const header = json?.response?.header;
  const body = json?.response?.body;
  const resultCode = header?.resultCode;
  const resultMsg = header?.resultMsg;

  if (resultCode && resultCode !== "00") {
    throw new Error(`Data.go.kr API error: ${resultCode} ${resultMsg || ""}`);
  }

  const totalCount = Number(body?.totalCount || 0);
  const items = normalizeItems(body?.items?.item);

  return {
    totalCount,
    items,
    debug: {
      basDt,
      resultCode,
      resultMsg,
      bodyKeys: body ? Object.keys(body) : [],
      firstItem: items[0] || null,
      firstItemKeys: items[0] ? Object.keys(items[0]) : [],
    },
  };
}

function getLatestBasDt(items: DataGoKrItem[]) {
  const dates = items
    .map((item) => getText(item, ["basDt", "기준일자"]))
    .filter((value) => /^\d{8}$/.test(value))
    .sort((a, b) => b.localeCompare(a));

  return dates[0] || "";
}

async function runUpdate() {
  const probe = await fetchKrxPage({
    pageNo: 1,
    numOfRows: 50,
  });

  const latestBasDt = getLatestBasDt(probe.items);

  if (!latestBasDt) {
    return {
      ok: false,
      error: "Could not detect latest basDt from Data.go.kr response.",
      probe,
    };
  }

  const numOfRows = 3000;
  const first = await fetchKrxPage({
    pageNo: 1,
    numOfRows,
    basDt: latestBasDt,
  });

  const totalPages = Math.max(1, Math.ceil(first.totalCount / numOfRows));
  const allItems = [...first.items];

  for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
    const page = await fetchKrxPage({
      pageNo,
      numOfRows,
      basDt: latestBasDt,
    });

    allItems.push(...page.items);
  }

  const stocks = allItems
    .map(mapItemToStock)
    .filter((stock): stock is KrxStock => !!stock);

  const uniqueStocks = Array.from(
    new Map(stocks.map((stock) => [stock.code, stock])).values(),
  );

  const savedCount = await upsertKrxStocks(uniqueStocks);

  return {
    ok: true,
    mode: "latest-basDt",
    latestBasDt,
    totalCount: first.totalCount,
    fetchedCount: allItems.length,
    parsedCount: stocks.length,
    savedCount,
    sampleRaw: allItems.slice(0, 3),
    sampleParsed: uniqueStocks.slice(0, 5),
    debug: first.debug,
  };
}

export async function GET() {
  try {
    const result = await runUpdate();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update KRX stock list.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const result = await runUpdate();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update KRX stock list.",
      },
      { status: 500 },
    );
  }
}
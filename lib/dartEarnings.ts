export type DartEarningsSource = "dart";

export type DartEarningsStatus =
  | "ready"
  | "missing-api-key"
  | "missing-corp-code"
  | "not-found"
  | "request-failed"
  | "parse-failed";

export type DartEarningsResult = {
  available: boolean;
  status: DartEarningsStatus;
  source: DartEarningsSource;
  updatedAt: string;
  stockCode: string;
  corpCode: string | null;
  message: string;

  lastYearNetIncome: number | null;
  expectedNetIncome: number | null;

  lastYearOperatingProfit: number | null;
  expectedOperatingProfit: number | null;

  lastYearEps: number | null;
  expectedEps: number | null;
};

type DartFinancialRow = {
  account_nm?: string;
  thstrm_amount?: string;
  frmtrm_amount?: string;
  thstrm_nm?: string;
  frmtrm_nm?: string;
};

type DartFinancialResponse = {
  status?: string;
  message?: string;
  list?: DartFinancialRow[];
};

type DartEarningsOptions = {
  stockCode: string;
  corpCode?: string | null;
  year?: number;
};

/**
 * DART 확정 실적 자동 연결 준비 함수입니다.
 *
 * 현재 함수는 corpCode가 준비된 경우 DART 단일회사 전체 재무제표 API를 조회합니다.
 * corpCode 매핑은 다음 단계에서 KRX 종목코드 → DART corp_code 매핑 파일로 연결합니다.
 *
 * 주의:
 * - DART는 예상 실적이 아니라 확정 실적 중심입니다.
 * - 그래서 expected* 필드에는 최근 확정 실적을 넣고,
 *   lastYear* 필드에는 전기 확정 실적을 넣어 성장률 계산에 사용할 수 있게 합니다.
 */
export async function fetchDartEarningsGrowth({
  stockCode,
  corpCode,
  year,
}: DartEarningsOptions): Promise<DartEarningsResult> {
  const normalizedStockCode = normalizeStockCode(stockCode);
  const apiKey = process.env.DART_API_KEY || process.env.OPENDART_API_KEY || "";
  const targetYear = year ?? new Date().getFullYear() - 1;

  if (!apiKey) {
    return makeDartResult({
      stockCode: normalizedStockCode,
      corpCode: corpCode || null,
      available: false,
      status: "missing-api-key",
      message:
        "DART_API_KEY 또는 OPENDART_API_KEY 환경변수가 없어 DART 실적 데이터를 조회하지 않았습니다.",
    });
  }

  if (!corpCode) {
    return makeDartResult({
      stockCode: normalizedStockCode,
      corpCode: null,
      available: false,
      status: "missing-corp-code",
      message:
        "DART corp_code 매핑이 없어 DART 실적 데이터를 조회하지 않았습니다. 다음 단계에서 종목코드-corp_code 매핑을 연결합니다.",
    });
  }

  const url = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json");
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bsns_year", String(targetYear));
  url.searchParams.set("reprt_code", "11011");
  url.searchParams.set("fs_div", "CFS");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return makeDartResult({
        stockCode: normalizedStockCode,
        corpCode,
        available: false,
        status: "request-failed",
        message: `DART API 요청 실패: HTTP ${response.status}`,
      });
    }

    const json = (await response.json()) as DartFinancialResponse;

    if (json.status && json.status !== "000") {
      return makeDartResult({
        stockCode: normalizedStockCode,
        corpCode,
        available: false,
        status: "not-found",
        message: json.message || "DART 재무제표 데이터가 없습니다.",
      });
    }

    const rows = Array.isArray(json.list) ? json.list : [];
    const netIncome = findFinancialRow(rows, ["당기순이익", "분기순이익"]);
    const operatingProfit = findFinancialRow(rows, ["영업이익"]);
    const eps = findFinancialRow(rows, ["기본주당이익", "희석주당이익"]);

    const lastYearNetIncome = parseDartAmount(netIncome?.frmtrm_amount);
    const expectedNetIncome = parseDartAmount(netIncome?.thstrm_amount);

    const lastYearOperatingProfit = parseDartAmount(operatingProfit?.frmtrm_amount);
    const expectedOperatingProfit = parseDartAmount(operatingProfit?.thstrm_amount);

    const lastYearEps = parseDartAmount(eps?.frmtrm_amount);
    const expectedEps = parseDartAmount(eps?.thstrm_amount);

    const hasAnyData = [
      lastYearNetIncome,
      expectedNetIncome,
      lastYearOperatingProfit,
      expectedOperatingProfit,
      lastYearEps,
      expectedEps,
    ].some((value) => value != null);

    if (!hasAnyData) {
      return makeDartResult({
        stockCode: normalizedStockCode,
        corpCode,
        available: false,
        status: "parse-failed",
        message: "DART 응답은 받았지만 순이익·영업이익·EPS 항목을 찾지 못했습니다.",
      });
    }

    return {
      available: true,
      status: "ready",
      source: "dart",
      updatedAt: new Date().toISOString(),
      stockCode: normalizedStockCode,
      corpCode,
      message: "DART 확정 실적 데이터를 조회했습니다.",

      lastYearNetIncome,
      expectedNetIncome,

      lastYearOperatingProfit,
      expectedOperatingProfit,

      lastYearEps,
      expectedEps,
    };
  } catch (error) {
    return makeDartResult({
      stockCode: normalizedStockCode,
      corpCode,
      available: false,
      status: "request-failed",
      message:
        error instanceof Error
          ? `DART API 요청 중 오류: ${error.message}`
          : "DART API 요청 중 알 수 없는 오류가 발생했습니다.",
    });
  }
}

function findFinancialRow(rows: DartFinancialRow[], accountNames: string[]) {
  return rows.find((row) => {
    const name = row.account_nm || "";

    return accountNames.some((keyword) => name.includes(keyword));
  });
}

function parseDartAmount(value?: string | null) {
  if (value == null) return null;

  const normalized = value.replace(/,/g, "").trim();

  if (!normalized || normalized === "-") return null;

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStockCode(value: string) {
  return value.replace(/\.(KS|KQ)$/i, "").trim().toUpperCase();
}

function makeDartResult({
  stockCode,
  corpCode,
  available,
  status,
  message,
}: {
  stockCode: string;
  corpCode: string | null;
  available: boolean;
  status: DartEarningsStatus;
  message: string;
}): DartEarningsResult {
  return {
    available,
    status,
    source: "dart",
    updatedAt: new Date().toISOString(),
    stockCode,
    corpCode,
    message,

    lastYearNetIncome: null,
    expectedNetIncome: null,

    lastYearOperatingProfit: null,
    expectedOperatingProfit: null,

    lastYearEps: null,
    expectedEps: null,
  };
}

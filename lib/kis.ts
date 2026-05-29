type KisTokenResponse = {
  access_token?: string;
  access_token_token_expired?: string;
  token_type?: string;
  expires_in?: number;
  error_code?: string;
  error_description?: string;
  msg_cd?: string;
  msg1?: string;
};

type KisCurrentPriceOutput = {
  stck_prpr?: string;
  prdy_vrss?: string;
  prdy_ctrt?: string;
  acml_vol?: string;
  acml_tr_pbmn?: string;
  hts_kor_isnm?: string;
  stck_shrn_iscd?: string;
  rprs_mrkt_kor_name?: string;

  hts_avls?: string;
  avls?: string;
  lstn_stcn?: string;
  stck_sdpr?: string;
  per?: string;
  pbr?: string;
  eps?: string;
  bps?: string;
  w52_hgpr?: string;
  w52_lwpr?: string;
  frgn_hldn_qty?: string;
  frgn_ntby_qty?: string;
  frgn_hldn_rt?: string;
  hts_frgn_ehrt?: string;
  dvyd?: string;
  dvd_yld?: string;

  [key: string]: string | number | null | undefined;
};

type KisApiResponse<T> = {
  rt_cd?: string;
  msg_cd?: string;
  msg1?: string;
  output?: T;
  output1?: T;
  output2?: unknown;
};

type KisCurrentPrice = {
  code: string;
  name: string;
  marketName: string;
  currentPrice: number | null;
  changePrice: number | null;
  changeRate: number | null;
  accumulatedVolume: number | null;
  accumulatedTradingValue: number | null;
  raw: KisCurrentPriceOutput;
};

export type KisStockFundamentals = {
  marketCap: number | null;
  per: number | null;
  pbr: number | null;
  eps: number | null;
  bps: number | null;
  dividendYield: number | null;
  foreignOwnershipRate: number | null;
  sharesOutstanding: number | null;
  high52w: number | null;
  low52w: number | null;
  raw: KisCurrentPriceOutput;
};

type KisTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type KisEnv = {
  appKey: string;
  appSecret: string;
  baseUrl: string;
  custType: string;
};

type KisInvestorRawRow = Record<string, string | number | null | undefined>;

export type KisInvestorRow = {
  date: string;
  individualNetBuy: number | null;
  foreignNetBuy: number | null;
  institutionNetBuy: number | null;
  programNetBuy: number | null;
  raw: KisInvestorRawRow;
};

export type KisInvestorSummary = {
  code: string;
  rows: KisInvestorRow[];
  recent5: {
    individualNetBuy: number;
    foreignNetBuy: number;
    institutionNetBuy: number;
    smartMoneyNetBuy: number;
  };
  recent20: {
    individualNetBuy: number;
    foreignNetBuy: number;
    institutionNetBuy: number;
    smartMoneyNetBuy: number;
  };
  foreignPositiveStreak5: boolean;
  institutionPositiveStreak5: boolean;
  smartMoneyPositiveStreak5: boolean;
};

let tokenCache: KisTokenCache | null = null;

const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

export function getKisEnv(): KisEnv {
  const appKey = process.env.KIS_APP_KEY?.trim();
  const appSecret = process.env.KIS_APP_SECRET?.trim();
  const baseUrl =
    process.env.KIS_BASE_URL?.trim() ||
    "https://openapi.koreainvestment.com:9443";
  const custType = process.env.KIS_CUSTTYPE?.trim() || "P";

  const missing = [
    !appKey ? "KIS_APP_KEY" : "",
    !appSecret ? "KIS_APP_SECRET" : "",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`한투 API 환경변수가 없습니다: ${missing.join(", ")}`);
  }

  return {
    appKey: appKey as string,
    appSecret: appSecret as string,
    baseUrl,
    custType,
  };
}

export function normalizeDomesticStockCode(input: string) {
  const value = input.trim().toUpperCase();

  if (!value) return "";

  if (value === "^KS11") return "0001";

  return value
    .replace(".KS", "")
    .replace(".KQ", "")
    .replace(/[^0-9]/g, "")
    .slice(0, 6);
}

export async function getKisAccessToken() {
  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt > now + TOKEN_EXPIRY_BUFFER_MS) {
    return {
      accessToken: tokenCache.accessToken,
      fromCache: true,
      expiresAt: tokenCache.expiresAt,
    };
  }

  const env = getKisEnv();

  const res = await fetch(`${env.baseUrl}/oauth2/tokenP`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: env.appKey,
      appsecret: env.appSecret,
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as KisTokenResponse;

  if (!res.ok || !json.access_token) {
    throw new Error(
      `한투 토큰 발급 실패: ${
        json.error_description || json.msg1 || json.error_code || res.status
      }`
    );
  }

  const expiresInSeconds = Number(json.expires_in ?? 86400);
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  tokenCache = {
    accessToken: json.access_token,
    expiresAt,
  };

  return {
    accessToken: json.access_token,
    fromCache: false,
    expiresAt,
  };
}

export async function kisFetchJson<T>({
  path,
  trId,
  params,
  trCont,
}: {
  path: string;
  trId: string;
  params?: Record<string, string | number | null | undefined>;
  trCont?: string;
}) {
  const env = getKisEnv();
  const token = await getKisAccessToken();

  const url = new URL(`${env.baseUrl}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json; charset=utf-8",
    authorization: `Bearer ${token.accessToken}`,
    appkey: env.appKey,
    appsecret: env.appSecret,
    tr_id: trId,
    custtype: env.custType,
  };

  if (trCont) {
    headers.tr_cont = trCont;
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const json = (await res.json()) as KisApiResponse<T>;

  if (!res.ok || json.rt_cd === "1") {
    throw new Error(`한투 API 호출 실패: ${json.msg1 || json.msg_cd || res.status}`);
  }

  return {
    json,
    token,
  };
}

export async function getKisCurrentPrice(
  inputSymbol: string
): Promise<KisCurrentPrice> {
  const code = normalizeDomesticStockCode(inputSymbol);

  if (!code) {
    throw new Error("종목코드가 비어 있습니다.");
  }

  const { json } = await kisFetchJson<KisCurrentPriceOutput>({
    path: "/uapi/domestic-stock/v1/quotations/inquire-price",
    trId: "FHKST01010100",
    params: {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: code,
    },
  });

  const output = json.output;

  if (!output) {
    throw new Error("한투 현재가 응답에 output이 없습니다.");
  }

  return {
    code,
    name: output.hts_kor_isnm || "",
    marketName: output.rprs_mrkt_kor_name || "",
    currentPrice: toNumberOrNull(output.stck_prpr),
    changePrice: toNumberOrNull(output.prdy_vrss),
    changeRate: toNumberOrNull(output.prdy_ctrt),
    accumulatedVolume: toNumberOrNull(output.acml_vol),
    accumulatedTradingValue: toNumberOrNull(output.acml_tr_pbmn),
    raw: output,
  };
}

export async function getKisStockFundamentals(
  inputSymbol: string
): Promise<KisStockFundamentals> {
  const code = normalizeDomesticStockCode(inputSymbol);

  if (!code) {
    throw new Error("종목코드가 비어 있습니다.");
  }

  const { json } = await kisFetchJson<KisCurrentPriceOutput>({
    path: "/uapi/domestic-stock/v1/quotations/inquire-price",
    trId: "FHKST01010100",
    params: {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: code,
    },
  });

  const output = json.output;

  if (!output) {
    throw new Error("한투 현재가 응답에 output이 없습니다.");
  }

  const rawMarketCap = pickNumber(output, [
    "hts_avls",
    "avls",
    "mrkt_tot_amt",
    "market_cap",
  ]);

  const sharesOutstanding = pickNumber(output, [
    "lstn_stcn",
    "shares_outstanding",
  ]);

  const currentPrice = pickNumber(output, ["stck_prpr"]);

  const calculatedMarketCap =
    rawMarketCap != null
      ? normalizeMarketCap(rawMarketCap)
      : sharesOutstanding != null && currentPrice != null
        ? sharesOutstanding * currentPrice
        : null;

  return {
    marketCap: calculatedMarketCap,
    per: pickNumber(output, ["per", "PER"]),
    pbr: pickNumber(output, ["pbr", "PBR"]),
    eps: pickNumber(output, ["eps", "EPS"]),
    bps: pickNumber(output, ["bps", "BPS"]),
    dividendYield: pickNumber(output, ["dvyd", "dvd_yld", "dividend_yield"]),
    foreignOwnershipRate: pickNumber(output, [
      "frgn_hldn_rt",
      "hts_frgn_ehrt",
      "foreign_hold_rate",
      "frgn_ownr_rate",
    ]),
    sharesOutstanding,
    high52w: pickNumber(output, ["w52_hgpr", "high_52w", "w52_hgst_prpr"]),
    low52w: pickNumber(output, ["w52_lwpr", "low_52w", "w52_lwst_prpr"]),
    raw: output,
  };
}

export async function getKisInvestorSummary(
  inputSymbol: string
): Promise<KisInvestorSummary> {
  const code = normalizeDomesticStockCode(inputSymbol);

  if (!code) {
    throw new Error("종목코드가 비어 있습니다.");
  }

  const { json } = await kisFetchJson<KisInvestorRawRow[] | KisInvestorRawRow>({
    path: "/uapi/domestic-stock/v1/quotations/inquire-investor",
    trId: "FHKST01010900",
    params: {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: code,
    },
  });

  const rawOutput = json.output;
  const rawRows = Array.isArray(rawOutput)
    ? rawOutput
    : rawOutput
      ? [rawOutput]
      : [];

  const rows = rawRows
    .map((row) => normalizeInvestorRow(row))
    .filter((row) => row.date || hasAnyInvestorValue(row))
    .sort((a, b) => a.date.localeCompare(b.date));

  const recent5Rows = rows.slice(-5);

  return {
    code,
    rows,
    recent5: summarizeInvestorRows(recent5Rows),
    recent20: summarizeInvestorRows(rows.slice(-20)),
    foreignPositiveStreak5: isPositiveStreak(recent5Rows, "foreignNetBuy"),
    institutionPositiveStreak5: isPositiveStreak(recent5Rows, "institutionNetBuy"),
    smartMoneyPositiveStreak5:
      recent5Rows.length >= 5 &&
      recent5Rows.every((row) => {
        const foreign = row.foreignNetBuy ?? 0;
        const institution = row.institutionNetBuy ?? 0;
        return foreign + institution > 0;
      }),
  };
}

function normalizeInvestorRow(row: KisInvestorRawRow): KisInvestorRow {
  return {
    date: normalizeKisDate(
      pickString(row, ["stck_bsop_date", "bsop_date", "trad_dt", "date"])
    ),
    individualNetBuy: pickNumber(row, [
      "prsn_ntby_qty",
      "individual_ntby_qty",
      "prsn_ntby_tr_pbmn",
      "antc_cnpr",
    ]),
    foreignNetBuy: pickNumber(row, [
      "frgn_ntby_qty",
      "frgn_ntby_tr_pbmn",
      "foreign_ntby_qty",
      "frgn_seln_qty",
    ]),
    institutionNetBuy: pickNumber(row, [
      "orgn_ntby_qty",
      "orgn_ntby_tr_pbmn",
      "institution_ntby_qty",
      "inst_ntby_qty",
    ]),
    programNetBuy: pickNumber(row, [
      "pgtr_ntby_qty",
      "program_ntby_qty",
      "pgtr_ntby_tr_pbmn",
    ]),
    raw: row,
  };
}

function summarizeInvestorRows(rows: KisInvestorRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.individualNetBuy += row.individualNetBuy ?? 0;
      acc.foreignNetBuy += row.foreignNetBuy ?? 0;
      acc.institutionNetBuy += row.institutionNetBuy ?? 0;
      acc.smartMoneyNetBuy +=
        (row.foreignNetBuy ?? 0) + (row.institutionNetBuy ?? 0);
      return acc;
    },
    {
      individualNetBuy: 0,
      foreignNetBuy: 0,
      institutionNetBuy: 0,
      smartMoneyNetBuy: 0,
    }
  );
}

function isPositiveStreak(
  rows: KisInvestorRow[],
  key: "foreignNetBuy" | "institutionNetBuy"
) {
  return rows.length >= 5 && rows.every((row) => (row[key] ?? 0) > 0);
}

function hasAnyInvestorValue(row: KisInvestorRow) {
  return [
    row.individualNetBuy,
    row.foreignNetBuy,
    row.institutionNetBuy,
    row.programNetBuy,
  ].some((value) => value != null);
}

function pickString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value != null && value !== "") return String(value);
  }

  return "";
}

function pickNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      value !== null &&
      value !== undefined
    ) {
      continue;
    }

    if (typeof value !== "string" && typeof value !== "number") {
      continue;
    }

    const parsed = toNumberOrNull(value);
    if (parsed != null) return parsed;
  }

  return null;
}

function normalizeKisDate(value: string) {
  const raw = value.replace(/[^0-9]/g, "");

  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }

  return value;
}

function normalizeMarketCap(value: number) {
  /**
   * KIS hts_avls는 억원 단위로 내려오는 경우가 많습니다.
   * 예: 13,592,598억 원 = 1,359.2598조 원
   */
  if (value > 0 && value < 1_0000_0000) {
    return value * 100_000_000;
  }

  return value;
}

function toNumberOrNull(value?: string | number | null) {
  if (value == null || value === "") return null;

  const normalized = String(value).replace(/,/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}
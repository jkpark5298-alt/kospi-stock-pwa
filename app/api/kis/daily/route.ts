// app/api/kis/daily/route.ts

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type KisTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type KisDailyRawRow = {
  stck_bsop_date?: string;
  stck_oprc?: string;
  stck_hgpr?: string;
  stck_lwpr?: string;
  stck_clpr?: string;
  acml_vol?: string;
  acml_tr_pbmn?: string;
};

type KisDailyRawResponse = {
  rt_cd?: string;
  msg_cd?: string;
  msg1?: string;
  output1?: unknown;
  output2?: KisDailyRawRow[];
};

type DailyPriceRow = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} 환경변수가 없습니다.`);
  }

  return value;
}

function normalizeKoreanSymbol(symbol: string) {
  return symbol.replace(".KS", "").replace(".KQ", "").trim();
}

function getDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}${mm}${dd}`;
}

function formatKisDate(value?: string) {
  if (!value || value.length !== 8) return "";

  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function toNumber(value?: string) {
  if (value == null || value === "") return null;

  const parsed = Number(String(value).replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function mapDailyRow(row: KisDailyRawRow): DailyPriceRow {
  return {
    date: formatKisDate(row.stck_bsop_date),
    open: toNumber(row.stck_oprc),
    high: toNumber(row.stck_hgpr),
    low: toNumber(row.stck_lwpr),
    close: toNumber(row.stck_clpr),
    volume: toNumber(row.acml_vol),
  };
}

async function getKisAccessToken() {
  const appKey = getRequiredEnv("KIS_APP_KEY");
  const appSecret = getRequiredEnv("KIS_APP_SECRET");
  const baseUrl =
    process.env.KIS_BASE_URL || "https://openapi.koreainvestment.com:9443";

  const response = await fetch(`${baseUrl}/oauth2/tokenP`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret,
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as KisTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `KIS access token 발급 실패: ${response.status} ${JSON.stringify(payload)}`,
    );
  }

  return payload.access_token;
}

export async function GET(request: NextRequest) {
  try {
    const appKey = getRequiredEnv("KIS_APP_KEY");
    const appSecret = getRequiredEnv("KIS_APP_SECRET");
    const baseUrl =
      process.env.KIS_BASE_URL || "https://openapi.koreainvestment.com:9443";

    const { searchParams } = new URL(request.url);

    const inputSymbol = searchParams.get("symbol") || "005930.KS";
    const symbol = normalizeKoreanSymbol(inputSymbol);
    const endDate = searchParams.get("end") || getDateString(0);
    const startDate = searchParams.get("start") || getDateString(-180);

    const accessToken = await getKisAccessToken();

    const url = new URL(
      `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
    );

    url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
    url.searchParams.set("FID_INPUT_ISCD", symbol);
    url.searchParams.set("FID_INPUT_DATE_1", startDate);
    url.searchParams.set("FID_INPUT_DATE_2", endDate);
    url.searchParams.set("FID_PERIOD_DIV_CODE", "D");
    url.searchParams.set("FID_ORG_ADJ_PRC", "1");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${accessToken}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: "FHKST03010100",
        custtype: "P",
      },
      cache: "no-store",
    });

    const raw = (await response.json()) as KisDailyRawResponse;

    const rows = Array.isArray(raw.output2)
      ? raw.output2
          .map(mapDailyRow)
          .filter((row) => row.date && row.close != null)
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];

    return NextResponse.json({
      ok: response.ok && raw.rt_cd !== "1",
      status: response.status,
      symbol: inputSymbol,
      normalizedCode: symbol,
      startDate,
      endDate,
      count: rows.length,
      rows,
      sourceFields: {
        date: "stck_bsop_date",
        open: "stck_oprc",
        high: "stck_hgpr",
        low: "stck_lwpr",
        close: "stck_clpr",
        volume: "acml_vol",
      },
      rawStatus: {
        rt_cd: raw.rt_cd,
        msg_cd: raw.msg_cd,
        msg1: raw.msg1,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
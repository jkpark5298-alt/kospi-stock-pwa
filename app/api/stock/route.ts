import { NextRequest, NextResponse } from "next/server";
import {
  bollingerBands,
  makeFearGreedScore,
  makeSignal,
  macd,
  obv,
  rsi,
  simpleForecast,
  sma,
} from "@/lib/indicators";
import {
  getKisInvestorSummary,
  getKisStockFundamentals,
} from "@/lib/kis";
import { calculateQuantModel } from "@/lib/quant";
import {
  getFundamentalsCache,
  getFundamentalsCacheFromSupabase,
  setFundamentalsCache,
  setFundamentalsCacheToSupabase,
} from "@/lib/fundamentalsCache";
import {
  calculateEarningsGrowthData,
  parseManualEarningsGrowthFromSearchParams,
  parseEarningsGrowthModeFromSearchParams,
} from "@/lib/earningsGrowth";
import { calculateCompositeScore } from "@/lib/score";
import { fetchDartEarningsGrowth } from "@/lib/dartEarnings";
import { resolveDartCorpCode } from "@/lib/dartCorpCode";
import {
  fallbackResolveStockSymbol,
  resolveKrxStockSymbol,
  type KrxStock,
} from "@/lib/krxStocks";

export const runtime = "nodejs";

type CacheEntry = {
  data: any;
  expiresAt: number;
};

type StockMeta = {
  name: string;
  exchange: string;
  currency: string;
};

type ChartDataRow = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  sma20: number | null;
  sma60: number | null;
  rsi14: number | null;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  volume: number;
  obv: number | null;
};

type FundamentalsData = {
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
};

type EarningsGrowthData = {
  available: boolean;
  source: "none" | "manual" | "kis" | "dart" | "consensus";
  updatedAt: string | null;
  warning?: string;

  lastYearNetIncome: number | null;
  expectedNetIncome: number | null;
  netIncomeGrowthRate: number | null;

  lastYearOperatingProfit: number | null;
  expectedOperatingProfit: number | null;
  operatingProfitGrowthRate: number | null;

  lastYearEps: number | null;
  expectedEps: number | null;
  epsGrowthRate: number | null;

  turnaround: boolean | null;
  deficitReduction: boolean | null;

  score: number | null;
  label: string;
  reasons: string[];
};

type SupplyData = {
  available: boolean;
  warning?: string;
  code?: string;
  rowCount?: number;
  recent5?: {
    individualNetBuy: number;
    foreignNetBuy: number;
    institutionNetBuy: number;
    smartMoneyNetBuy: number;
  };
  recent20?: {
    individualNetBuy: number;
    foreignNetBuy: number;
    institutionNetBuy: number;
    smartMoneyNetBuy: number;
  };
  foreignPositiveStreak5?: boolean;
  institutionPositiveStreak5?: boolean;
  smartMoneyPositiveStreak5?: boolean;
  latestRows?: Array<{
    date: string;
    individualNetBuy: number | null;
    foreignNetBuy: number | null;
    institutionNetBuy: number | null;
    programNetBuy: number | null;
  }>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const stockCache = new Map<string, CacheEntry>();

type KisDailyRowForStockApi = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

async function getKisDailyRowsForStockApi(
  request: NextRequest,
  symbol: string,
): Promise<Map<string, KisDailyRowForStockApi>> {
  try {
    const url = new URL("/api/kis/daily", request.nextUrl.origin);
    url.searchParams.set("symbol", symbol);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return new Map();
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      rows?: KisDailyRowForStockApi[];
    };

    if (!Array.isArray(payload.rows)) {
      return new Map();
    }

    return new Map(
      payload.rows
        .filter((row) => row.date)
        .map((row) => [row.date, row]),
    );
  } catch {
    return new Map();
  }
}

const KNOWN_KOREAN_STOCK_NAMES: Record<string, string> = {
  "005930.KS": "삼성전자",
  "000660.KS": "SK하이닉스",
  "035420.KS": "NAVER",
  "035720.KS": "카카오",
  "051910.KS": "LG화학",
  "005380.KS": "현대차",
  "000270.KS": "기아",
  "068270.KS": "셀트리온",
  "105560.KS": "KB금융",
  "055550.KS": "신한지주",
  "^KS11": "코스피 지수",
};

const EMPTY_FUNDAMENTALS: FundamentalsData = {
  marketCap: null,
  per: null,
  pbr: null,
  eps: null,
  bps: null,
  dividendYield: null,
  foreignOwnershipRate: null,
  sharesOutstanding: null,
  high52w: null,
  low52w: null,
};

const FUNDAMENTALS_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

const fundamentalsCache = new Map<
  string,
  {
    data: FundamentalsData;
    updatedAt: string;
    expiresAt: number;
  }
>();



function makeEarningsGrowthCacheKey(searchParams: URLSearchParams) {
  const manualKeys = [
    "earningsGrowthMode",
    "lastYearNetIncome",
    "expectedNetIncome",
    "lastYearOperatingProfit",
    "expectedOperatingProfit",
    "lastYearEps",
    "expectedEps",
    "turnaround",
    "deficitReduction",
  ];

  return manualKeys
    .map((key) => `${key}=${searchParams.get(key) || ""}`)
    .join("|");
}


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSymbol = (searchParams.get("symbol") || "005930.KS").trim();

  const resolvedStock = await resolveKrxStockSymbol(rawSymbol);
  const symbol = resolvedStock?.symbol || fallbackResolveStockSymbol(rawSymbol);

  const range = (searchParams.get("range") || "6mo").trim();
  const earningsGrowthCacheKey = makeEarningsGrowthCacheKey(searchParams);
  const cacheKey = `${symbol}:${range}:${earningsGrowthCacheKey}`;

  const cached = stockCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      withCacheMeta(cached.data, {
        cached: true,
        cacheSource: "memory",
      }),
    );
  }

  try {
    const period1 = Math.floor(getPeriodStart(range).getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);

    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?period1=${period1}&period2=${period2}&interval=1d`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      cache: "no-store",
    });

    const text = await res.text();

    if (res.status === 429 || text.includes("Too Many Requests")) {
      if (cached) {
        return NextResponse.json(
          withCacheMeta(cached.data, {
            cached: true,
            cacheSource: "stale-memory",
            warning:
              "외부 주가 서버가 요청을 제한하여 최근 저장 데이터로 표시 중입니다.",
          }),
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "외부 주가 서버가 현재 요청을 제한하고 있습니다.",
          detail: "Too Many Requests",
          blocked: true,
          status: 429,
          symbol,
          rawSymbol,
          meta: {
            cached: false,
            cacheSource: null,
            warning: "외부 주가 서버가 현재 요청을 제한하고 있습니다.",
            updatedAt: new Date().toISOString(),
            range,
          },
        },
        { status: 429 },
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "외부 주가 서버 호출에 실패했습니다.",
          detail: text.slice(0, 500),
          status: res.status,
          symbol,
          rawSymbol,
          meta: {
            cached: false,
            cacheSource: null,
            warning: "외부 주가 서버 호출에 실패했습니다.",
            updatedAt: new Date().toISOString(),
            range,
          },
        },
        { status: 500 },
      );
    }

    let json: any;

    try {
      json = JSON.parse(text);
    } catch {
      if (cached) {
        return NextResponse.json(
          withCacheMeta(cached.data, {
            cached: true,
            cacheSource: "stale-memory",
            warning: "외부 응답이 비정상이라 최근 저장 데이터로 표시 중입니다.",
          }),
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "외부 주가 서버 응답이 JSON 형식이 아닙니다.",
          detail: text.slice(0, 500),
          symbol,
          rawSymbol,
          meta: {
            cached: false,
            cacheSource: null,
            warning: "외부 주가 서버 응답이 JSON 형식이 아닙니다.",
            updatedAt: new Date().toISOString(),
            range,
          },
        },
        { status: 500 },
      );
    }

    const result = json?.chart?.result?.[0];
    const errorInfo = json?.chart?.error;
    const chartMeta = result?.meta || {};

    if (errorInfo) {
      return NextResponse.json(
        {
          ok: false,
          error: "주가 데이터를 가져오지 못했습니다.",
          detail: errorInfo?.description || errorInfo?.code || "unknown error",
          symbol,
          rawSymbol,
          meta: {
            cached: false,
            cacheSource: null,
            warning: "주가 데이터를 가져오지 못했습니다.",
            updatedAt: new Date().toISOString(),
            range,
          },
        },
        { status: 500 },
      );
    }

    const timestamps: number[] = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const adjclose = result?.indicators?.adjclose?.[0]?.adjclose || [];
    const opensRaw: Array<number | null> = quote?.open || [];
    const highsRaw: Array<number | null> = quote?.high || [];
    const lowsRaw: Array<number | null> = quote?.low || [];
    const closesRaw: Array<number | null> = quote?.close || [];
    const volumesRaw: Array<number | null> = quote?.volume || [];

    const chartRows = timestamps
      .map((ts, i) => {
        const close = closesRaw[i] ?? adjclose[i] ?? null;

        return {
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          open: opensRaw[i] != null ? Number(opensRaw[i]) : null,
          high: highsRaw[i] != null ? Number(highsRaw[i]) : null,
          low: lowsRaw[i] != null ? Number(lowsRaw[i]) : null,
          close: close != null ? Number(close) : null,
          volume: volumesRaw[i] != null ? Number(volumesRaw[i]) : 0,
        };
      })
      .filter((row) => row.close != null)
      .sort((a, b) => a.date.localeCompare(b.date)) as Array<{
      date: string;
      open: number | null;
      high: number | null;
      low: number | null;
      close: number;
      volume: number;
    }>;

    if (!chartRows.length) {
      if (cached) {
        return NextResponse.json(
          withCacheMeta(cached.data, {
            cached: true,
            cacheSource: "stale-memory",
            warning: "새 데이터를 받지 못해 최근 저장 데이터로 표시 중입니다.",
          }),
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "해당 종목 데이터를 찾지 못했습니다.",
          symbol,
          rawSymbol,
          meta: {
            cached: false,
            cacheSource: null,
            warning: "해당 종목 데이터를 찾지 못했습니다.",
            updatedAt: new Date().toISOString(),
            range,
          },
        },
        { status: 404 },
      );
    }

    const dates = chartRows.map((row) => row.date);
    const closes = chartRows.map((row) => row.close);
    const volumes = chartRows.map((row) => row.volume);

    const sma20 = sma(closes, 20);
    const sma60 = sma(closes, 60);
    const rsi14 = rsi(closes, 14);
    const macdData = macd(closes);
    const bollinger = bollingerBands(closes, 20, 2);
    const obvData = obv(closes, volumes);
    const forecast = simpleForecast(closes, 5);

    const kisDailyByDate = await getKisDailyRowsForStockApi(req, symbol);

    const chartData: ChartDataRow[] = dates.map((date, i) => {
      const kisDaily = kisDailyByDate.get(date);

      return {
        date,
        open: kisDaily?.open ?? chartRows[i]?.open ?? null,
        high: kisDaily?.high ?? chartRows[i]?.high ?? null,
        low: kisDaily?.low ?? chartRows[i]?.low ?? null,
        close: closes[i] ?? null,
        sma20: sma20[i] ?? null,
        sma60: sma60[i] ?? null,
        rsi14: rsi14[i] ?? null,
        macd: macdData.macdLine[i] ?? null,
        signal: macdData.signalLine[i] ?? null,
        histogram: macdData.histogram[i] ?? null,
        bbUpper: bollinger.upper[i] ?? null,
        bbMiddle: bollinger.middle[i] ?? null,
        bbLower: bollinger.lower[i] ?? null,
        volume: volumes[i] ?? 0,
        obv: obvData[i] ?? null,
      };
    });

    const currentPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2] ?? currentPrice;

    const changePrice = Number((currentPrice - prevPrice).toFixed(2));
    const change =
      prevPrice !== 0
        ? Number(((changePrice / prevPrice) * 100).toFixed(2))
        : 0;

    const latestSma20 = sma20[sma20.length - 1] ?? null;
    const latestSma60 = sma60[sma60.length - 1] ?? null;
    const latestRsi14 = rsi14[rsi14.length - 1] ?? null;
    const latestMacd = macdData.macdLine[macdData.macdLine.length - 1] ?? null;
    const latestMacdSignal =
      macdData.signalLine[macdData.signalLine.length - 1] ?? null;
    const latestObv = obvData[obvData.length - 1] ?? null;
    const previousObv = obvData[obvData.length - 2] ?? null;

    const fearGreed = makeFearGreedScore({
      current: currentPrice,
      sma20: latestSma20,
      sma60: latestSma60,
      rsi: latestRsi14,
      macd: latestMacd,
      macdSignal: latestMacdSignal,
      change,
      obvNow: latestObv,
      obvPrev: previousObv,
    });

    const signalSummary =
      latestSma20 != null &&
      latestSma60 != null &&
      latestRsi14 != null &&
      latestMacd != null &&
      latestMacdSignal != null
        ? makeSignal({
            current: currentPrice,
            sma20: latestSma20,
            sma60: latestSma60,
            rsi: latestRsi14,
            macd: latestMacd,
            macdSignal: latestMacdSignal,
          })
        : "신호 분석 데이터가 아직 충분하지 않습니다.";

    const stockMeta = await getStockMeta(symbol, chartMeta, resolvedStock);
    const supply = await getSupplyData(symbol);
    const fundamentals = await getFundamentalsData(symbol);
    const manualEarningsGrowth = parseManualEarningsGrowthFromSearchParams(searchParams);
    const earningsGrowthMode = parseEarningsGrowthModeFromSearchParams(searchParams);
    const earningsGrowth = await getEarningsGrowthData(
      symbol,
      fundamentals,
      manualEarningsGrowth,
      earningsGrowthMode,
      stockMeta,
    );

    const score = calculateCompositeScore({
      rows: chartData,
      supply,
      fundamentals,
      earningsGrowth,
    });

    const latestTechnical = chartData[chartData.length - 1] ?? null;
    const targetRange = score?.targetPrice?.technicalTargetRange ?? null;
    const targetBasis = score?.targetPrice?.targetBasis ?? null;
    const normalizedCode = normalizeStockCode(symbol);

    const quant = calculateQuantModel({
      rows: chartData,
      supply,
      fundamentals,
      targetRange,
      earningsGrowth,
    });

    const targetProgress =
      targetRange && targetRange.baseTarget > 0
        ? Number(
            ((targetRange.currentPrice / targetRange.baseTarget) * 100).toFixed(
              1,
            ),
          )
        : null;

    const upsidePrice = targetRange
      ? Number((targetRange.baseTarget - targetRange.currentPrice).toFixed(2))
      : null;

    const responseData = {
      ok: true,

      symbol,
      rawSymbol,
      name: stockMeta.name,
      exchange: stockMeta.exchange,
      currency: stockMeta.currency,
      currentPrice,
      prevPrice,
      changePrice,
      change,
      signalSummary,
      chartData,
      forecast,
      fearGreed,
      fundamentals,
      earningsGrowth,
      supply,
      score,
      quant,
      cached: false,

      stock: {
        symbol,
        rawSymbol,
        code: normalizedCode,
        name: stockMeta.name,
        exchange: stockMeta.exchange,
        currency: stockMeta.currency,
        market: stockMeta.exchange,
        sector: null,
        industry: null,
      },

      price: {
        currentPrice,
        prevPrice,
        changePrice,
        changeRate: change,
        signalSummary,
      },

      technical: {
        chartData,
        latest: latestTechnical,
        fearGreed,
      },

      targetPrice: {
        range: targetRange
          ? {
              currentPrice: targetRange.currentPrice,
              conservativeTarget: targetRange.conservativeTarget,
              baseTarget: targetRange.baseTarget,
              aggressiveTarget: targetRange.aggressiveTarget,
              riskLine: targetRange.riskLine,
              targetProgress,
              upsidePrice,
              conservativeUpsidePercent:
                targetRange.conservativeUpsidePercent,
              baseUpsidePercent: targetRange.baseUpsidePercent,
              aggressiveUpsidePercent: targetRange.aggressiveUpsidePercent,
              riskDownsidePercent: targetRange.riskDownsidePercent,
            }
          : null,
        basis: targetBasis,
        consensusTarget: null,
      },

      meta: {
        cached: false,
        cacheSource: null,
        warning: null,
        updatedAt: new Date().toISOString(),
        range,
        source:
          "Yahoo Finance chart + KIS daily OHLCV + KIS investor summary + KIS/Supabase fundamentals + earnings growth placeholder + quant model",
      },
    };

    const valuationRangeForText =
      responseData?.score?.targetPrice?.valuationTargetRange ?? null;

    if (valuationRangeForText) {
      const k = (...codes: number[]) => String.fromCharCode(...codes);
      const perText =
        typeof valuationRangeForText.perAdjustment === "number"
          ? valuationRangeForText.perAdjustment.toFixed(2)
          : "";
      const pbrText =
        typeof valuationRangeForText.pbrAdjustment === "number"
          ? valuationRangeForText.pbrAdjustment.toFixed(2)
          : "";

      (responseData.meta as any).valuationTextFix = "v12k-inline-charcode";

      if (valuationRangeForText.valuationTarget != null) {
        valuationRangeForText.method =
          "EPS/PER + BPS/PBR " + k(48372, 51221, 32, 54217, 44512);

        valuationRangeForText.reasons = [
          "EPS " +
            String.fromCharCode(215) +
            " " +
            k(54788, 51116) +
            " PER " +
            String.fromCharCode(215) +
            " PER " +
            k(48372, 51221, 44228, 49688) +
            " " +
            perText +
            k(47484, 32, 48152, 50689, 54664, 49845, 45768, 45796, 46),
          "BPS " +
            String.fromCharCode(215) +
            " " +
            k(54788, 51116) +
            " PBR " +
            String.fromCharCode(215) +
            " PBR " +
            k(48372, 51221, 44228, 49688) +
            " " +
            pbrText +
            k(47484, 32, 48152, 50689, 54664, 49845, 45768, 45796, 46),
          k(
            48184, 47448, 50640, 51060, 49496, 32,
            52628, 51221, 32,
            51452, 44032, 44032, 32,
            54788, 51116, 44032, 32,
            45824, 48708, 32,
            44284, 46020, 54616, 44172, 32,
            48268, 50612, 51648, 51648, 32,
            50506, 46020, 47197, 32,
            50504, 51221, 54868, 54664, 49845, 45768, 45796, 46,
          ),
        ];
      }
    }

    stockCache.set(cacheKey, {
      data: responseData,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("stock api error:", error);

    if (cached) {
      return NextResponse.json(
        withCacheMeta(cached.data, {
          cached: true,
          cacheSource: "stale-memory",
          warning: "일시 오류로 최근 저장 데이터로 표시 중입니다.",
        }),
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "주가 데이터를 불러오지 못했습니다.",
        detail: error?.message || String(error),
        symbol,
        rawSymbol,
        meta: {
          cached: false,
          cacheSource: null,
          warning: "주가 데이터를 불러오지 못했습니다.",
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 500 },
    );
  }
}

async function getSupplyData(symbol: string): Promise<SupplyData> {
  try {
    const supply = await getKisInvestorSummary(symbol);

    return {
      available: true,
      code: supply.code,
      rowCount: supply.rows.length,
      recent5: supply.recent5,
      recent20: supply.recent20,
      foreignPositiveStreak5: supply.foreignPositiveStreak5,
      institutionPositiveStreak5: supply.institutionPositiveStreak5,
      smartMoneyPositiveStreak5: supply.smartMoneyPositiveStreak5,
      latestRows: supply.rows.slice(-10).reverse().map((row) => ({
        date: row.date,
        individualNetBuy: row.individualNetBuy,
        foreignNetBuy: row.foreignNetBuy,
        institutionNetBuy: row.institutionNetBuy,
        programNetBuy: row.programNetBuy,
      })),
    };
  } catch (error) {
    return {
      available: false,
      warning:
        error instanceof Error
          ? `한투 수급 데이터를 불러오지 못했습니다: ${error.message}`
          : "한투 수급 데이터를 불러오지 못했습니다.",
    };
  }
}

async function getFundamentalsData(symbol: string): Promise<FundamentalsData> {
  const cached = getFundamentalsCache(symbol);

  try {
    const fundamentals = await getKisStockFundamentals(symbol);

    const data: FundamentalsData = {
      marketCap: fundamentals.marketCap,
      per: fundamentals.per,
      pbr: fundamentals.pbr,
      eps: fundamentals.eps,
      bps: fundamentals.bps,
      dividendYield: fundamentals.dividendYield,
      foreignOwnershipRate: fundamentals.foreignOwnershipRate,
      sharesOutstanding: fundamentals.sharesOutstanding,
      high52w: fundamentals.high52w,
      low52w: fundamentals.low52w,
    };

    setFundamentalsCache(symbol, data);
    await setFundamentalsCacheToSupabase(symbol, data);

    return data;
  } catch (error) {
    console.warn("KIS fundamentals unavailable:", error);

    if (cached?.data) {
      return cached.data;
    }

    const supabaseCached = await getFundamentalsCacheFromSupabase(symbol);

    if (supabaseCached?.data) {
      return supabaseCached.data;
    }

    return EMPTY_FUNDAMENTALS;
  }
}

async function getEarningsGrowthData(
  symbol: string,
  _fundamentals?: FundamentalsData,
  manualInput?: Parameters<typeof calculateEarningsGrowthData>[0]["manual"],
  mode: Parameters<typeof calculateEarningsGrowthData>[0]["mode"] = "auto",
  stockMeta?: StockMeta,
): Promise<EarningsGrowthData> {
  /**
   * 자동 실적 데이터 1차 연결:
   * - ETF/ETN/지수형 상품은 일반 기업 실적 성장 분석에서 제외합니다.
   * - DART_API_KEY 또는 OPENDART_API_KEY가 있고 corp_code 매핑이 있는 종목은
   *   DART 확정 실적을 자동 데이터로 사용합니다.
   * - DART 데이터가 없거나 실패하면 기존 수동 입력 구조를 그대로 유지합니다.
   */
  const excluded = isEarningsGrowthExcluded(symbol, stockMeta);

  if (excluded) {
    return calculateEarningsGrowthData({
      automatic: null,
      manual: manualInput,
      mode,
      excluded: true,
      excludedReason:
        "ETF/ETN/지수형 상품은 일반 기업처럼 순이익·영업이익·EPS 성장률을 비교하기 어려워 실적 성장 분석에서 제외했습니다.",
    });
  }

  const dartCorp = resolveDartCorpCode(symbol);
  const dartEarnings = await fetchDartEarningsGrowth({
    stockCode: dartCorp.stockCode,
    corpCode: dartCorp.corpCode,
  });

  const automaticInput = dartEarnings.available
    ? {
        source: "dart" as const,
        updatedAt: dartEarnings.updatedAt,
        lastYearNetIncome: dartEarnings.lastYearNetIncome,
        expectedNetIncome: dartEarnings.expectedNetIncome,
        lastYearOperatingProfit: dartEarnings.lastYearOperatingProfit,
        expectedOperatingProfit: dartEarnings.expectedOperatingProfit,
        lastYearEps: dartEarnings.lastYearEps,
        expectedEps: dartEarnings.expectedEps,
      }
    : null;

  return calculateEarningsGrowthData({
    automatic: automaticInput,
    manual: manualInput,
    mode,
  });
}

function isEarningsGrowthExcluded(symbol: string, stockMeta?: StockMeta) {
  const upperSymbol = symbol.trim().toUpperCase();
  const name = (stockMeta?.name || "").toUpperCase();

  if (upperSymbol.startsWith("^")) return true;

  const keywords = [
    "ETF",
    "ETN",
    "KODEX",
    "TIGER",
    "ACE",
    "SOL",
    "KBSTAR",
    "ARIRANG",
    "KOSEF",
    "HANARO",
    "TIMEFOLIO",
    "레버리지",
    "인버스",
    "선물",
    "채권",
  ];

  return keywords.some((keyword) => name.includes(keyword));
}

async function getStockMeta(
  symbol: string,
  chartMeta: any,
  resolvedStock?: KrxStock | null,
): Promise<StockMeta> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const fallbackName =
    resolvedStock?.name ||
    KNOWN_KOREAN_STOCK_NAMES[normalizedSymbol] ||
    chartMeta?.shortName ||
    chartMeta?.longName ||
    chartMeta?.instrumentType ||
    "종목명 정보 없음";

  const fallbackExchange =
    resolvedStock?.market ||
    normalizeExchange(
      chartMeta?.exchangeName ||
        chartMeta?.fullExchangeName ||
        chartMeta?.exchangeTimezoneName,
    ) ||
    guessExchange(normalizedSymbol);

  const fallbackCurrency = chartMeta?.currency || "KRW";

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      symbol,
    )}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        name: fallbackName,
        exchange: fallbackExchange,
        currency: fallbackCurrency,
      };
    }

    const json = await res.json();
    const quote = json?.quoteResponse?.result?.[0] || {};

    return {
      name:
        resolvedStock?.name ||
        KNOWN_KOREAN_STOCK_NAMES[normalizedSymbol] ||
        quote?.shortName ||
        quote?.longName ||
        quote?.displayName ||
        fallbackName,
      exchange:
        resolvedStock?.market ||
        normalizeExchange(
          quote?.fullExchangeName || quote?.exchange || quote?.market,
        ) ||
        fallbackExchange,
      currency: quote?.currency || fallbackCurrency,
    };
  } catch {
    return {
      name: fallbackName,
      exchange: fallbackExchange,
      currency: fallbackCurrency,
    };
  }
}

function withCacheMeta(
  data: any,
  options: {
    cached: boolean;
    cacheSource: string;
    warning?: string;
  },
) {
  normalizeValuationTargetTextSafe(data);

  return {
    ...data,
    cached: options.cached,
    cacheSource: options.cacheSource,
    warning: options.warning ?? data?.warning,
    meta: {
      ...(data?.meta || {}),
      cached: options.cached,
      cacheSource: options.cacheSource,
      warning: options.warning ?? data?.meta?.warning ?? null,
      updatedAt: data?.meta?.updatedAt || new Date().toISOString(),
    },
  };
}

function normalizeExchange(value?: string) {
  if (!value) return "";

  const upper = String(value).toUpperCase();

  if (
    upper.includes("KSC") ||
    upper.includes("KOSPI") ||
    upper.includes("SEOUL")
  ) {
    return "KOSPI";
  }

  if (upper.includes("KOE") || upper.includes("KOSDAQ")) {
    return "KOSDAQ";
  }

  return String(value);
}

function guessExchange(symbol: string) {
  if (symbol.endsWith(".KS")) return "KOSPI";
  if (symbol.endsWith(".KQ")) return "KOSDAQ";
  if (symbol === "^KS11") return "KOSPI";
  return "";
}

function normalizeStockCode(symbol: string) {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.endsWith(".KS") || normalized.endsWith(".KQ")) {
    return normalized.slice(0, -3);
  }

  return normalized;
}

function getPeriodStart(range: string) {
  const now = new Date();
  const d = new Date(now);

  switch (range) {
    case "1mo":
      d.setMonth(now.getMonth() - 1);
      break;
    case "3mo":
      d.setMonth(now.getMonth() - 3);
      break;
    case "6mo":
      d.setMonth(now.getMonth() - 6);
      break;
    case "1y":
      d.setFullYear(now.getFullYear() - 1);
      break;
    default:
      d.setMonth(now.getMonth() - 6);
      break;
  }

  return d;
}


function repairMojibakeText(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const looksBroken = /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(value);

  if (!looksBroken) return value;

  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function repairValuationTargetText(data: any) {
  const valuationRange = data?.score?.targetPrice?.valuationTargetRange;

  if (!valuationRange) return data;

  if (typeof valuationRange.method === "string") {
    valuationRange.method = repairMojibakeText(valuationRange.method) as string;
  }

  if (Array.isArray(valuationRange.reasons)) {
    valuationRange.reasons = valuationRange.reasons.map((reason: unknown) =>
      repairMojibakeText(reason),
    );
  }

  return data;
}


function normalizeValuationTargetText(data: any) {
  const valuationRange = data?.score?.targetPrice?.valuationTargetRange;

  if (!valuationRange) return data;

  const perAdjustment =
    typeof valuationRange.perAdjustment === "number"
      ? valuationRange.perAdjustment.toFixed(2)
      : null;

  const pbrAdjustment =
    typeof valuationRange.pbrAdjustment === "number"
      ? valuationRange.pbrAdjustment.toFixed(2)
      : null;

  if (valuationRange.valuationTarget != null) {
    valuationRange.method = "EPS/PER + BPS/PBR 보정 평균";

    const reasons: string[] = [];

    if (valuationRange.epsTarget != null) {
      reasons.push(
        perAdjustment
          ? `EPS × 현재 PER × PER 보정계수 ${perAdjustment}를 반영했습니다.`
          : "EPS와 PER을 바탕으로 EPS 기준 추정 주가를 계산했습니다.",
      );
    } else {
      reasons.push("EPS 또는 PER 데이터가 부족해 EPS 기준 추정 주가는 제외했습니다.");
    }

    if (valuationRange.bpsTarget != null) {
      reasons.push(
        pbrAdjustment
          ? `BPS × 현재 PBR × PBR 보정계수 ${pbrAdjustment}를 반영했습니다.`
          : "BPS와 PBR을 바탕으로 BPS 기준 추정 주가를 계산했습니다.",
      );
    } else {
      reasons.push("BPS 또는 PBR 데이터가 부족해 BPS 기준 추정 주가는 제외했습니다.");
    }

    reasons.push("밸류에이션 추정 주가가 현재가 대비 과도하게 벌어지지 않도록 안정화했습니다.");

    valuationRange.reasons = reasons;
    return data;
  }

  valuationRange.method = "밸류에이션 추정 주가 계산 대기";
  valuationRange.reasons = [
    "EPS 또는 PER 데이터가 부족해 EPS 기준 추정 주가는 제외했습니다.",
    "BPS 또는 PBR 데이터가 부족해 BPS 기준 추정 주가는 제외했습니다.",
  ];

  return data;
}


function normalizeValuationTargetTextSafe(data: any) {
  const valuationRange = data?.score?.targetPrice?.valuationTargetRange;

  if (!valuationRange) return data;

  const k = (...codes: number[]) => String.fromCharCode(...codes);

  const methodText =
    "EPS/PER + BPS/PBR " +
    k(48372, 51221, 32, 54217, 44512);

  const waitingText = k(
    48184, 47448, 50640, 51060, 49496, 32,
    52628, 51221, 32,
    51452, 44032, 32,
    44228, 49328, 32,
    45824, 44592,
  );

  const epsMissing =
    "EPS " +
    k(46608, 45716) +
    " PER " +
    k(
      45936, 51060, 53552, 44032, 32,
      48512, 51313, 54644, 32,
    ) +
    "EPS " +
    k(
      44592, 51456, 32,
      52628, 51221, 32,
      51452, 44032, 45716, 32,
      51228, 50808, 54664, 49845, 45768, 45796, 46,
    );

  const bpsMissing =
    "BPS " +
    k(46608, 45716) +
    " PBR " +
    k(
      45936, 51060, 53552, 44032, 32,
      48512, 51313, 54644, 32,
    ) +
    "BPS " +
    k(
      44592, 51456, 32,
      52628, 51221, 32,
      51452, 44032, 45716, 32,
      51228, 50808, 54664, 49845, 45768, 45796, 46,
    );

  const stabilizeText = k(
    48184, 47448, 50640, 51060, 49496, 32,
    52628, 51221, 32,
    51452, 44032, 44032, 32,
    54788, 51116, 44032, 32,
    45824, 48708, 32,
    44284, 46020, 54616, 44172, 32,
    48268, 50612, 51648, 51648, 32,
    50506, 46020, 47197, 32,
    50504, 51221, 54868, 54664, 49845, 45768, 45796, 46,
  );

  const perAdjustment =
    typeof valuationRange.perAdjustment === "number"
      ? valuationRange.perAdjustment.toFixed(2)
      : null;

  const pbrAdjustment =
    typeof valuationRange.pbrAdjustment === "number"
      ? valuationRange.pbrAdjustment.toFixed(2)
      : null;

  if (valuationRange.valuationTarget != null) {
    valuationRange.method = methodText;

    const reasons: string[] = [];

    if (valuationRange.epsTarget != null) {
      reasons.push(
        perAdjustment
          ? "EPS " +
              String.fromCharCode(215) +
              " " +
              k(54788, 51116) +
              " PER " +
              String.fromCharCode(215) +
              " PER " +
              k(48372, 51221, 44228, 49688) +
              " " +
              perAdjustment +
              k(47484, 32, 48152, 50689, 54664, 49845, 45768, 45796, 46)
          : "EPS" +
              k(50752) +
              " PER" +
              k(51012, 32, 48148, 53461, 51004, 47196) +
              " EPS " +
              k(44592, 51456, 32, 52628, 51221, 32, 51452, 44032, 47484, 32, 44228, 49328, 54664, 49845, 45768, 45796, 46),
      );
    } else {
      reasons.push(epsMissing);
    }

    if (valuationRange.bpsTarget != null) {
      reasons.push(
        pbrAdjustment
          ? "BPS " +
              String.fromCharCode(215) +
              " " +
              k(54788, 51116) +
              " PBR " +
              String.fromCharCode(215) +
              " PBR " +
              k(48372, 51221, 44228, 49688) +
              " " +
              pbrAdjustment +
              k(47484, 32, 48152, 50689, 54664, 49845, 45768, 45796, 46)
          : "BPS" +
              k(50752) +
              " PBR" +
              k(51012, 32, 48148, 53461, 51004, 47196) +
              " BPS " +
              k(44592, 51456, 32, 52628, 51221, 32, 51452, 44032, 47484, 32, 44228, 49328, 54664, 49845, 45768, 45796, 46),
      );
    } else {
      reasons.push(bpsMissing);
    }

    reasons.push(stabilizeText);

    valuationRange.reasons = reasons;
    return data;
  }

  valuationRange.method = waitingText;
  valuationRange.reasons = [epsMissing, bpsMissing];

  return data;
}

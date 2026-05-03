import { NextRequest, NextResponse } from "next/server";
import { bollingerBands, makeFearGreedScore, makeSignal, macd, obv, rsi, simpleForecast, sma } from "@/lib/indicators";

export const runtime = "nodejs";

type CacheEntry = {
  data: any;
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5분
const stockCache = new Map<string, CacheEntry>();

type StockMeta = {
  name: string;
  exchange: string;
  currency: string;
};

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "005930.KS").trim();
  const range = (searchParams.get("range") || "6mo").trim();
  const cacheKey = `${symbol}:${range}`;

  const cached = stockCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
      cacheSource: "memory",
    });
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
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      cache: "no-store",
    });

    const text = await res.text();

    if (res.status === 429 || text.includes("Too Many Requests")) {
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          cacheSource: "stale-memory",
          warning: "외부 주가 서버가 요청을 제한하여 최근 저장 데이터로 표시 중입니다.",
        });
      }

      return NextResponse.json(
        {
          error: "외부 주가 서버가 현재 요청을 제한하고 있습니다.",
          detail: "Too Many Requests",
          blocked: true,
          status: 429,
          symbol,
        },
        { status: 429 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "외부 주가 서버 호출에 실패했습니다.",
          detail: text.slice(0, 500),
          status: res.status,
          symbol,
        },
        { status: 500 }
      );
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          cacheSource: "stale-memory",
          warning: "외부 응답이 비정상이라 최근 저장 데이터로 표시 중입니다.",
        });
      }

      return NextResponse.json(
        {
          error: "외부 주가 서버 응답이 JSON 형식이 아닙니다.",
          detail: text.slice(0, 500),
          symbol,
        },
        { status: 500 }
      );
    }

    const result = json?.chart?.result?.[0];
    const errorInfo = json?.chart?.error;
    const chartMeta = result?.meta || {};

    if (errorInfo) {
      return NextResponse.json(
        {
          error: "주가 데이터를 가져오지 못했습니다.",
          detail: errorInfo?.description || errorInfo?.code || "unknown error",
          symbol,
        },
        { status: 500 }
      );
    }

    const timestamps: number[] = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const adjclose = result?.indicators?.adjclose?.[0]?.adjclose || [];
    const closesRaw: Array<number | null> = quote?.close || [];
    const volumesRaw: Array<number | null> = quote?.volume || [];

    const chartRows = timestamps
      .map((ts, i) => {
        const close = closesRaw[i] ?? adjclose[i] ?? null;
        return {
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          close: close != null ? Number(close) : null,
          volume: volumesRaw[i] != null ? Number(volumesRaw[i]) : 0,
        };
      })
      .filter((row) => row.close != null) as Array<{ date: string; close: number; volume: number }>;

    if (!chartRows.length) {
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          cacheSource: "stale-memory",
          warning: "새 데이터를 받지 못해 최근 저장 데이터로 표시 중입니다.",
        });
      }

      return NextResponse.json(
        {
          error: "해당 종목 데이터를 찾지 못했습니다.",
          symbol,
        },
        { status: 404 }
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

    const chartData = dates.map((date, i) => ({
      date,
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
    }));

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

    const stockMeta = await getStockMeta(symbol, chartMeta);

    const responseData = {
      symbol,
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
      cached: false,
    };

    stockCache.set(cacheKey, {
      data: responseData,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("stock api error:", error);

    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheSource: "stale-memory",
        warning: "일시 오류로 최근 저장 데이터로 표시 중입니다.",
      });
    }

    return NextResponse.json(
      {
        error: "주가 데이터를 불러오지 못했습니다.",
        detail: error?.message || String(error),
        symbol,
      },
      { status: 500 }
    );
  }
}

async function getStockMeta(symbol: string, chartMeta: any): Promise<StockMeta> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const fallbackName =
    KNOWN_KOREAN_STOCK_NAMES[normalizedSymbol] ||
    chartMeta?.shortName ||
    chartMeta?.longName ||
    chartMeta?.instrumentType ||
    "종목명 정보 없음";

  const fallbackExchange =
    normalizeExchange(chartMeta?.exchangeName || chartMeta?.fullExchangeName || chartMeta?.exchangeTimezoneName) ||
    guessExchange(normalizedSymbol);

  const fallbackCurrency = chartMeta?.currency || "KRW";

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Accept": "application/json,text/plain,*/*",
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
        KNOWN_KOREAN_STOCK_NAMES[normalizedSymbol] ||
        quote?.shortName ||
        quote?.longName ||
        quote?.displayName ||
        fallbackName,
      exchange:
        normalizeExchange(quote?.fullExchangeName || quote?.exchange || quote?.market) ||
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

function normalizeExchange(value?: string) {
  if (!value) return "";

  const upper = String(value).toUpperCase();

  if (upper.includes("KSC") || upper.includes("KOSPI") || upper.includes("SEOUL")) {
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
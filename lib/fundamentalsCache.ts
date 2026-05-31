import { supabaseFetch } from "./supabaseAdmin";

export type SharedFundamentalsData = {
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

type CacheEntry = {
  data: SharedFundamentalsData;
  updatedAt: string;
  expiresAt: number;
  source: "KIS" | "memory-cache";
};

const FUNDAMENTALS_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

const globalForFundamentals = globalThis as typeof globalThis & {
  __kospiFundamentalsCache?: Map<string, CacheEntry>;
};

const fundamentalsCache =
  globalForFundamentals.__kospiFundamentalsCache ??
  new Map<string, CacheEntry>();

globalForFundamentals.__kospiFundamentalsCache = fundamentalsCache;

export function normalizeFundamentalsCacheKey(symbol: string) {
  return symbol
    .replace(/\.KS$/i, "")
    .replace(/\.KQ$/i, "")
    .replace(/[^0-9]/g, "")
    .padStart(6, "0");
}

export function hasUsableFundamentals(data?: SharedFundamentalsData | null) {
  if (!data) return false;

  return Object.values(data).some(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
}

export function setFundamentalsCache(
  symbol: string,
  data: SharedFundamentalsData,
) {
  if (!hasUsableFundamentals(data)) return null;

  const key = normalizeFundamentalsCacheKey(symbol);
  const entry: CacheEntry = {
    data,
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + FUNDAMENTALS_CACHE_TTL_MS,
    source: "KIS",
  };

  fundamentalsCache.set(key, entry);
  return entry;
}

export function getFundamentalsCache(symbol: string) {
  const key = normalizeFundamentalsCacheKey(symbol);
  const cached = fundamentalsCache.get(key);

  if (!cached) return null;

  return {
    ...cached,
    expired: cached.expiresAt <= Date.now(),
  };
}


type SupabaseFundamentalsRow = {
  symbol: string;
  market_cap: number | null;
  per: number | null;
  pbr: number | null;
  eps: number | null;
  bps: number | null;
  dividend_yield: number | null;
  foreign_ownership_rate: number | null;
  shares_outstanding: number | null;
  high_52w: number | null;
  low_52w: number | null;
  source?: string | null;
  updated_at?: string | null;
};

function toSupabaseFundamentalsRow(symbol: string, data: SharedFundamentalsData) {
  return {
    symbol: normalizeFundamentalsCacheKey(symbol),
    market_cap: data.marketCap,
    per: data.per,
    pbr: data.pbr,
    eps: data.eps,
    bps: data.bps,
    dividend_yield: data.dividendYield,
    foreign_ownership_rate: data.foreignOwnershipRate,
    shares_outstanding: data.sharesOutstanding,
    high_52w: data.high52w,
    low_52w: data.low52w,
    source: "KIS",
    updated_at: new Date().toISOString(),
  };
}

function fromSupabaseFundamentalsRow(row: SupabaseFundamentalsRow): SharedFundamentalsData {
  return {
    marketCap: row.market_cap ?? null,
    per: row.per ?? null,
    pbr: row.pbr ?? null,
    eps: row.eps ?? null,
    bps: row.bps ?? null,
    dividendYield: row.dividend_yield ?? null,
    foreignOwnershipRate: row.foreign_ownership_rate ?? null,
    sharesOutstanding: row.shares_outstanding ?? null,
    high52w: row.high_52w ?? null,
    low52w: row.low_52w ?? null,
  };
}

export async function setFundamentalsCacheToSupabase(
  symbol: string,
  data: SharedFundamentalsData,
) {
  if (!hasUsableFundamentals(data)) return null;

  try {
    const row = toSupabaseFundamentalsRow(symbol, data);

    const response = await supabaseFetch(
      "/stock_fundamentals_cache?on_conflict=symbol&select=symbol,updated_at",
      {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(row),
      },
    );

    const rows = (await response.json()) as Array<{
      symbol: string;
      updated_at?: string | null;
    }>;

    return rows[0] ?? null;
  } catch (error) {
    console.warn("Supabase fundamentals cache save failed:", error);
    return null;
  }
}

export async function getFundamentalsCacheFromSupabase(symbol: string) {
  const key = normalizeFundamentalsCacheKey(symbol);

  try {
    const response = await supabaseFetch(
      `/stock_fundamentals_cache?select=symbol,market_cap,per,pbr,eps,bps,dividend_yield,foreign_ownership_rate,shares_outstanding,high_52w,low_52w,source,updated_at&symbol=eq.${encodeURIComponent(
        key,
      )}&limit=1`,
    );

    const rows = (await response.json()) as SupabaseFundamentalsRow[];
    const row = rows[0];

    if (!row) return null;

    const data = fromSupabaseFundamentalsRow(row);

    if (!hasUsableFundamentals(data)) return null;

    setFundamentalsCache(symbol, data);

    return {
      data,
      updatedAt: row.updated_at ?? null,
      source: row.source || "supabase-cache",
    };
  } catch (error) {
    console.warn("Supabase fundamentals cache read failed:", error);
    return null;
  }
}

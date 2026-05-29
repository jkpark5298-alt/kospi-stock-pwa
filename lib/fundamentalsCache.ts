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

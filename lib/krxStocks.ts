export type KrxStock = {
  code: string;
  name: string;
  market: "KOSPI" | "KOSDAQ" | "KONEX" | string;
  symbol: string;
  isActive?: boolean;
  updatedAt?: string;
};

type KrxStockRow = {
  code: string;
  name: string;
  market: string;
  symbol: string;
  is_active?: boolean;
  updated_at?: string;
};

function normalizeSupabaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/$/, "")
    .replace(/\/rest\/v1$/, "");
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }

  return {
    url: normalizeSupabaseUrl(url),
    serviceRoleKey,
  };
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const { url, serviceRoleKey } = getSupabaseConfig();

  const response = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase 요청 실패: ${response.status} ${text}`);
  }

  return response;
}

function mapRow(row: KrxStockRow): KrxStock {
  return {
    code: row.code,
    name: row.name,
    market: row.market,
    symbol: row.symbol,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

function normalizeInput(value: string) {
  return value.trim();
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function normalizeCode(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeMarket(value: string) {
  const upper = value.trim().toUpperCase();

  if (upper.includes("KOSPI") || upper.includes("유가")) return "KOSPI";
  if (upper.includes("KOSDAQ") || upper.includes("코스닥")) return "KOSDAQ";
  if (upper.includes("KONEX") || upper.includes("코넥스")) return "KONEX";

  return upper;
}

export function makeYahooSymbol(code: string, market: string) {
  const normalizedMarket = normalizeMarket(market);

  if (normalizedMarket === "KOSDAQ") return `${code}.KQ`;
  if (normalizedMarket === "KOSPI") return `${code}.KS`;

  return `${code}.KS`;
}

export function isYahooKoreaSymbol(value: string) {
  return /^\d{6}\.(KS|KQ)$/i.test(value.trim());
}

export function fallbackResolveStockSymbol(input: string) {
  const raw = normalizeInput(input);

  if (!raw) return "005930.KS";

  const upper = raw.toUpperCase();

  if (isYahooKoreaSymbol(upper)) return upper;

  if (/^\d{6}$/.test(raw)) return `${raw}.KS`;

  return upper;
}

export async function upsertKrxStocks(stocks: KrxStock[]) {
  if (!stocks.length) return 0;

  const rows = stocks.map((stock) => ({
    code: stock.code,
    name: stock.name,
    market: normalizeMarket(stock.market),
    symbol: stock.symbol,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  const chunkSize = 500;
  let savedCount = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    await supabaseFetch("/krx_stocks?on_conflict=code", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(chunk),
    });

    savedCount += chunk.length;
  }

  return savedCount;
}

export async function findKrxStock(query: string) {
  const raw = normalizeInput(query);

  if (!raw) return null;

  const upper = raw.toUpperCase();

  if (isYahooKoreaSymbol(upper)) {
    const code = upper.slice(0, 6);
    return findKrxStockByCode(code);
  }

  const code = normalizeCode(raw);

  if (/^\d{6}$/.test(code)) {
    return findKrxStockByCode(code);
  }

  return findKrxStockByName(raw);
}

export async function findKrxStockByCode(code: string) {
  const normalizedCode = normalizeCode(code);

  if (!/^\d{6}$/.test(normalizedCode)) return null;

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("code", `eq.${normalizedCode}`);
  params.set("is_active", "eq.true");
  params.set("limit", "1");

  const response = await supabaseFetch(`/krx_stocks?${params.toString()}`);
  const rows = (await response.json()) as KrxStockRow[];

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findKrxStockByName(name: string) {
  const normalizedName = normalizeName(name);

  if (!normalizedName) return null;

  const exactParams = new URLSearchParams();
  exactParams.set("select", "*");
  exactParams.set("name", `eq.${name.trim()}`);
  exactParams.set("is_active", "eq.true");
  exactParams.set("limit", "1");

  const exactResponse = await supabaseFetch(
    `/krx_stocks?${exactParams.toString()}`,
  );
  const exactRows = (await exactResponse.json()) as KrxStockRow[];

  if (exactRows[0]) return mapRow(exactRows[0]);

  const partialParams = new URLSearchParams();
  partialParams.set("select", "*");
  partialParams.set("name", `ilike.*${name.trim()}*`);
  partialParams.set("is_active", "eq.true");
  partialParams.set("order", "market.asc,name.asc");
  partialParams.set("limit", "10");

  const partialResponse = await supabaseFetch(
    `/krx_stocks?${partialParams.toString()}`,
  );
  const partialRows = (await partialResponse.json()) as KrxStockRow[];

  const normalizedMatch = partialRows.find(
    (row) => normalizeName(row.name) === normalizedName,
  );

  return normalizedMatch
    ? mapRow(normalizedMatch)
    : partialRows[0]
      ? mapRow(partialRows[0])
      : null;
}

export async function resolveKrxStockSymbol(query: string) {
  const stock = await findKrxStock(query);

  if (stock) {
    return stock;
  }

  return null;
}

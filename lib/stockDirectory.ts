export type StockDirectoryItem = {
  name: string;
  symbol: string;
  code: string;
  market: "KOSPI" | "KOSDAQ";
  aliases?: string[];
};

export const STOCK_DIRECTORY: StockDirectoryItem[] = [
  {
    name: "삼성전자",
    symbol: "005930.KS",
    code: "005930",
    market: "KOSPI",
    aliases: ["삼전", "samsung electronics", "samsung"],
  },
  {
    name: "노바렉스",
    symbol: "194700.KQ",
    code: "194700",
    market: "KOSDAQ",
    aliases: ["novarex"],
  },
];

function normalizeInput(value: string) {
  return value.trim();
}

function normalizeKoreanName(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function normalizeCode(value: string) {
  return value.replace(/\D/g, "");
}

function findStockByName(input: string) {
  const normalized = normalizeKoreanName(input);

  if (!normalized) return null;

  return (
    STOCK_DIRECTORY.find((item) => {
      const names = [item.name, ...(item.aliases || [])];

      return names.some((name) => normalizeKoreanName(name) === normalized);
    }) || null
  );
}

function findStockByCode(input: string) {
  const code = normalizeCode(input);

  if (!/^\d{6}$/.test(code)) return null;

  return STOCK_DIRECTORY.find((item) => item.code === code) || null;
}

export function resolveStockSymbol(input: string) {
  const raw = normalizeInput(input);

  if (!raw) return "005930.KS";

  const upper = raw.toUpperCase();

  if (/^\d{6}\.(KS|KQ)$/.test(upper)) {
    return upper;
  }

  const byName = findStockByName(raw);

  if (byName) {
    return byName.symbol;
  }

  const byCode = findStockByCode(raw);

  if (byCode) {
    return byCode.symbol;
  }

  if (/^\d{6}$/.test(raw)) {
    return `${raw}.KS`;
  }

  return upper;
}
import type {
  PredictionHorizon,
  PredictionRecord,
  PredictionResult,
} from "../types/prediction";

type PredictionRecordRow = {
  id: string;
  sync_code: string;
  symbol: string;
  name: string | null;
  predicted_at: string;
  current_price: number | string | null;
  score_total: number | string | null;
  quant_total: number | string | null;
  results: Record<string, unknown>;
  created_at?: string;
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

function normalizeSyncCode(value: string) {
  return value.trim();
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function toNumberOrNull(value: unknown) {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePredictionResult(value: unknown): PredictionResult {
  const source = (value || {}) as Partial<PredictionResult>;

  return {
    expectedPrice: toNumberOrNull(source.expectedPrice),
    actualPrice: toNumberOrNull(source.actualPrice),
    targetDate: typeof source.targetDate === "string" ? source.targetDate : "",
    errorRate: toNumberOrNull(source.errorRate),
    directionHit:
      typeof source.directionHit === "boolean" ? source.directionHit : null,
  };
}

function normalizeResults(value: unknown): Record<PredictionHorizon, PredictionResult> {
  const source = (value || {}) as Record<string, unknown>;

  return {
    "5d": normalizePredictionResult(source["5d"]),
    "20d": normalizePredictionResult(source["20d"]),
    "60d": normalizePredictionResult(source["60d"]),
  };
}

function mapRowToRecord(row: PredictionRecordRow): PredictionRecord {
  return {
    id: row.id,
    syncCode: row.sync_code,
    symbol: row.symbol,
    name: row.name || "",
    predictedAt: row.predicted_at,
    currentPrice: toNumberOrNull(row.current_price),
    scoreTotal: toNumberOrNull(row.score_total),
    quantTotal: toNumberOrNull(row.quant_total),
    results: normalizeResults(row.results),
  };
}

export async function getPredictionRecords(
  syncCode: string,
  symbol?: string | null,
): Promise<PredictionRecord[]> {
  const normalizedSyncCode = normalizeSyncCode(syncCode);

  if (!normalizedSyncCode) {
    return [];
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("sync_code", `eq.${normalizedSyncCode}`);
  params.set("order", "predicted_at.desc");
  params.set("limit", "100");

  if (symbol) {
    params.set("symbol", `eq.${normalizeSymbol(symbol)}`);
  }

  const response = await supabaseFetch(`/prediction_records?${params.toString()}`);
  const rows = (await response.json()) as PredictionRecordRow[];

  return rows.map(mapRowToRecord);
}

export async function createPredictionRecord(record: PredictionRecord) {
  const body = {
    sync_code: record.syncCode,
    symbol: normalizeSymbol(record.symbol),
    name: record.name,
    predicted_at: record.predictedAt,
    current_price: record.currentPrice,
    score_total: record.scoreTotal,
    quant_total: record.quantTotal,
    results: record.results,
  };

  const response = await supabaseFetch("/prediction_records?select=*", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  const rows = (await response.json()) as PredictionRecordRow[];
  const inserted = rows[0];

  if (!inserted) {
    throw new Error("예측 기록 저장 결과가 비어 있습니다.");
  }

  return mapRowToRecord(inserted);
}

export async function deletePredictionRecords(
  syncCode: string,
  symbol?: string | null,
) {
  const normalizedSyncCode = normalizeSyncCode(syncCode);

  if (!normalizedSyncCode) {
    return;
  }

  const params = new URLSearchParams();
  params.set("sync_code", `eq.${normalizedSyncCode}`);

  if (symbol) {
    params.set("symbol", `eq.${normalizeSymbol(symbol)}`);
  }

  await supabaseFetch(`/prediction_records?${params.toString()}`, {
    method: "DELETE",
  });
}

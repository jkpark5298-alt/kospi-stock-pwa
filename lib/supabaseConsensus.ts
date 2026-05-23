const SUPABASE_REST_PATH = "/rest/v1";
const CONSENSUS_TABLE = "consensus_targets";

export type ConsensusTargetInput = {
  symbol: string;
  name?: string | null;
  baseDate: string;
  averageTarget?: number | null;
  highTarget?: number | null;
  lowTarget?: number | null;
  opinion?: string | null;
  brokerCount?: number | null;
  reportCount?: number | null;
  source?: string | null;
  memo?: string | null;
  uploadedFileName?: string | null;
};

export type ConsensusTarget = ConsensusTargetInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type ConsensusTargetRow = {
  id: string;
  symbol: string;
  name: string | null;
  base_date: string;
  average_target: number | string | null;
  high_target: number | string | null;
  low_target: number | string | null;
  opinion: string | null;
  broker_count: number | string | null;
  report_count: number | string | null;
  source: string | null;
  memo: string | null;
  uploaded_file_name: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeSupabaseUrl(value: string) {
  return value.trim().replace(/\/$/, "").replace(/\/rest\/v1$/, "");
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return {
    url: normalizeSupabaseUrl(url),
    serviceRoleKey,
  };
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const { url, serviceRoleKey } = getSupabaseConfig();

  const response = await fetch(`${url}${SUPABASE_REST_PATH}${path}`, {
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
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  return response;
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function normalizeDate(value: string) {
  return value.trim().slice(0, 10);
}

function toNumberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const numeric = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function toIntegerOrNull(value: unknown) {
  const numeric = toNumberOrNull(value);
  return numeric == null ? null : Math.trunc(numeric);
}

function toTextOrNull(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function mapRowToTarget(row: ConsensusTargetRow): ConsensusTarget {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    baseDate: row.base_date,
    averageTarget: toNumberOrNull(row.average_target),
    highTarget: toNumberOrNull(row.high_target),
    lowTarget: toNumberOrNull(row.low_target),
    opinion: row.opinion,
    brokerCount: toIntegerOrNull(row.broker_count),
    reportCount: toIntegerOrNull(row.report_count),
    source: row.source,
    memo: row.memo,
    uploadedFileName: row.uploaded_file_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInputToRow(input: ConsensusTargetInput) {
  const symbol = normalizeSymbol(input.symbol);
  const baseDate = normalizeDate(input.baseDate);

  if (!symbol) {
    throw new Error("symbol is required.");
  }

  if (!baseDate) {
    throw new Error("baseDate is required.");
  }

  return {
    symbol,
    name: toTextOrNull(input.name),
    base_date: baseDate,
    average_target: toNumberOrNull(input.averageTarget),
    high_target: toNumberOrNull(input.highTarget),
    low_target: toNumberOrNull(input.lowTarget),
    opinion: toTextOrNull(input.opinion),
    broker_count: toIntegerOrNull(input.brokerCount),
    report_count: toIntegerOrNull(input.reportCount),
    source: toTextOrNull(input.source),
    memo: toTextOrNull(input.memo),
    uploaded_file_name: toTextOrNull(input.uploadedFileName),
    updated_at: new Date().toISOString(),
  };
}

export async function getLatestConsensusTarget(symbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("symbol", `eq.${normalizedSymbol}`);
  params.set("order", "base_date.desc,updated_at.desc");
  params.set("limit", "1");

  const response = await supabaseFetch(`/${CONSENSUS_TABLE}?${params.toString()}`);
  const rows = (await response.json()) as ConsensusTargetRow[];

  return rows[0] ? mapRowToTarget(rows[0]) : null;
}

export async function listConsensusTargets(symbol?: string | null) {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "symbol.asc,base_date.desc");
  params.set("limit", "500");

  if (symbol) {
    params.set("symbol", `eq.${normalizeSymbol(symbol)}`);
  }

  const response = await supabaseFetch(`/${CONSENSUS_TABLE}?${params.toString()}`);
  const rows = (await response.json()) as ConsensusTargetRow[];

  return rows.map(mapRowToTarget);
}

export async function upsertConsensusTargets(inputs: ConsensusTargetInput[]) {
  const rows = inputs.map(mapInputToRow);

  if (rows.length === 0) {
    return [];
  }

  const response = await supabaseFetch(
    `/${CONSENSUS_TABLE}?on_conflict=symbol,base_date&select=*`,
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(rows),
    },
  );

  const savedRows = (await response.json()) as ConsensusTargetRow[];
  return savedRows.map(mapRowToTarget);
}




const SUPABASE_REST_PATH = "/rest/v1";

export type ConsensusTarget = {
  symbol: string;
  name: string | null;
  baseDate: string;
  averageTarget: number | null;
  highTarget: number | null;
  lowTarget: number | null;
  opinion: string | null;
  brokerCount: number | null;
  reportCount: number | null;
  source: string | null;
  memo: string | null;
  uploadedFileName?: string | null;
  updatedAt?: string | null;
};

export type ConsensusTargetInput = Omit<ConsensusTarget, "updatedAt">;

type ConsensusTargetRow = {
  id?: string;
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
  uploaded_file_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

function normalizeSupabaseUrl(value: string) {
  return value.trim().replace(/\/$/, "").replace(/\/rest\/v1$/, "");
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
    throw new Error(`Supabase 요청 실패: ${response.status} ${text}`);
  }

  return response;
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function toNumberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toIntegerOrNull(value: unknown) {
  const numeric = toNumberOrNull(value);
  return numeric == null ? null : Math.trunc(numeric);
}

function mapRowToConsensus(row: ConsensusTargetRow): ConsensusTarget {
  return {
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
    uploadedFileName: row.uploaded_file_name ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null,
  };
}

function mapConsensusToRow(input: ConsensusTargetInput): ConsensusTargetRow {
  return {
    symbol: normalizeSymbol(input.symbol),
    name: input.name || null,
    base_date: input.baseDate,
    average_target: input.averageTarget,
    high_target: input.highTarget,
    low_target: input.lowTarget,
    opinion: input.opinion || null,
    broker_count: input.brokerCount,
    report_count: input.reportCount,
    source: input.source || null,
    memo: input.memo || null,
    uploaded_file_name: input.uploadedFileName || null,
  };
}

export async function getLatestConsensusTarget(symbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) return null;

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("symbol", `eq.${normalizedSymbol}`);
  params.set("order", "base_date.desc,updated_at.desc");
  params.set("limit", "1");

  const response = await supabaseFetch(`/consensus_targets?${params.toString()}`);
  const rows = (await response.json()) as ConsensusTargetRow[];

  return rows[0] ? mapRowToConsensus(rows[0]) : null;
}

export async function upsertConsensusTargets(inputs: ConsensusTargetInput[]) {
  const rows = inputs.map(mapConsensusToRow).filter((row) => row.symbol && row.base_date);

  if (rows.length === 0) return [];

  const response = await supabaseFetch(
    "/consensus_targets?on_conflict=symbol,base_date&select=*",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(rows),
    },
  );

  const savedRows = (await response.json()) as ConsensusTargetRow[];
  return savedRows.map(mapRowToConsensus);
}

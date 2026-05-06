const SUPABASE_REST_PATH = "/rest/v1";

export const KIS_DAILY_LIMIT = 100;

type KisUsageRow = {
  id?: string;
  sync_code: string;
  usage_date: string;
  used_count: number;
  created_at?: string;
  updated_at?: string;
};

export type KisUsageResult = {
  syncCode: string;
  usageDate: string;
  usedCount: number;
  remaining: number;
  limit: number;
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

function getTodayInKorea() {
  const koreaTime = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return koreaTime.toISOString().slice(0, 10);
}

function clampUsedCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(KIS_DAILY_LIMIT, Math.max(0, Math.floor(value)));
}

function calculateRemaining(usedCount: number) {
  return Math.min(KIS_DAILY_LIMIT, Math.max(0, KIS_DAILY_LIMIT - usedCount));
}

function buildResult(
  syncCode: string,
  usageDate: string,
  usedCount: number,
): KisUsageResult {
  const safeUsedCount = clampUsedCount(usedCount);

  return {
    syncCode,
    usageDate,
    usedCount: safeUsedCount,
    remaining: calculateRemaining(safeUsedCount),
    limit: KIS_DAILY_LIMIT,
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

function buildUsageFilter(syncCode: string, usageDate: string) {
  return `sync_code=eq.${encodeURIComponent(
    syncCode,
  )}&usage_date=eq.${encodeURIComponent(usageDate)}`;
}

export async function getKisUsage(syncCode: string) {
  const usageDate = getTodayInKorea();
  const filter = buildUsageFilter(syncCode, usageDate);

  const response = await supabaseFetch(
    `/kis_usage?select=sync_code,usage_date,used_count&${filter}&limit=1`,
  );

  const rows = (await response.json()) as KisUsageRow[];
  const row = rows[0];

  if (!row) {
    return buildResult(syncCode, usageDate, 0);
  }

  return buildResult(syncCode, usageDate, Number(row.used_count || 0));
}

export async function incrementKisUsage(syncCode: string, incrementBy: number) {
  const usageDate = getTodayInKorea();
  const current = await getKisUsage(syncCode);
  const nextUsedCount = clampUsedCount(current.usedCount + incrementBy);
  const filter = buildUsageFilter(syncCode, usageDate);

  const patchResponse = await supabaseFetch(
    `/kis_usage?${filter}&select=sync_code,usage_date,used_count`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        used_count: nextUsedCount,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  const patchedRows = (await patchResponse.json()) as KisUsageRow[];

  if (patchedRows.length > 0) {
    return buildResult(syncCode, usageDate, Number(patchedRows[0].used_count));
  }

  const postResponse = await supabaseFetch(
    "/kis_usage?select=sync_code,usage_date,used_count",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        sync_code: syncCode,
        usage_date: usageDate,
        used_count: nextUsedCount,
      }),
    },
  );

  const insertedRows = (await postResponse.json()) as KisUsageRow[];
  const inserted = insertedRows[0];

  return buildResult(syncCode, usageDate, Number(inserted?.used_count || 0));
}
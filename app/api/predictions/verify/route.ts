import { NextResponse } from "next/server";
import {
  getPredictionRecords,
  updatePredictionRecordResults,
} from "../../../../lib/supabasePredictions";
import {
  PREDICTION_HORIZONS,
  type PredictionHorizon,
  type PredictionRecord,
  type PredictionResult,
} from "../../../../types/prediction";

function normalizeSyncCode(value: unknown) {
  return String(value || "").trim();
}

function validateSyncCode(syncCode: string) {
  if (!syncCode) return "동기화 코드가 필요합니다.";
  if (syncCode.length < 4) return "동기화 코드는 4자 이상으로 입력해 주세요.";
  if (syncCode.length > 64) return "동기화 코드는 64자 이하로 입력해 주세요.";
  return "";
}

function isDue(targetDate?: string) {
  if (!targetDate) return false;
  const targetTime = new Date(targetDate).getTime();
  if (Number.isNaN(targetTime)) return false;
  return targetTime <= Date.now();
}

function roundNumber(value: number, digits = 2) {
  const unit = 10 ** digits;
  return Math.round(value * unit) / unit;
}

function calculateErrorRate(expectedPrice: number, actualPrice: number) {
  if (!expectedPrice) return null;
  return roundNumber((Math.abs(actualPrice - expectedPrice) / expectedPrice) * 100, 2);
}

function calculateDirectionHit(
  currentPrice: number | null,
  expectedPrice: number,
  actualPrice: number,
) {
  if (currentPrice == null || !Number.isFinite(currentPrice)) return null;

  const expectedDirection = expectedPrice >= currentPrice;
  const actualDirection = actualPrice >= currentPrice;

  return expectedDirection === actualDirection;
}

function mergeResult(
  record: PredictionRecord,
  horizon: PredictionHorizon,
  actualPrice: number,
) {
  const current = record.results[horizon];
  const expectedPrice = current.expectedPrice;

  if (expectedPrice == null) return current;

  return {
    ...current,
    actualPrice,
    errorRate: calculateErrorRate(expectedPrice, actualPrice),
    directionHit: calculateDirectionHit(
      record.currentPrice,
      expectedPrice,
      actualPrice,
    ),
  };
}

async function fetchActualClose(symbol: string, targetDate: string) {
  const target = new Date(targetDate);

  if (Number.isNaN(target.getTime())) return null;

  const from = new Date(target);
  from.setDate(from.getDate() - 4);

  const to = new Date(target);
  to.setDate(to.getDate() + 8);

  const period1 = Math.floor(from.getTime() / 1000);
  const period2 = Math.floor(to.getTime() / 1000);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp || [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || [];

  const rows = timestamps
    .map((timestamp, index) => {
      const close = closes[index];

      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close: close == null ? null : Number(close),
      };
    })
    .filter((row) => row.close != null)
    .sort((a, b) => a.date.localeCompare(b.date)) as Array<{
    date: string;
    close: number;
  }>;

  const targetDay = target.toISOString().slice(0, 10);
  const matched = rows.find((row) => row.date >= targetDay) || rows.at(-1);

  return matched?.close == null ? null : Math.round(matched.close);
}

async function verifyRecord(record: PredictionRecord) {
  let changed = false;
  const nextResults = { ...record.results } as Record<
    PredictionHorizon,
    PredictionResult
  >;

  for (const horizon of PREDICTION_HORIZONS) {
    const current = nextResults[horizon.key];

    if (!current || current.actualPrice != null) continue;
    if (current.expectedPrice == null) continue;
    if (!isDue(current.targetDate)) continue;

    const actualPrice = await fetchActualClose(record.symbol, current.targetDate);

    if (actualPrice == null) continue;

    nextResults[horizon.key] = mergeResult(record, horizon.key, actualPrice);
    changed = true;
  }

  if (!changed) return null;

  return updatePredictionRecordResults(record.id, nextResults);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      syncCode?: unknown;
    };

    const syncCode = normalizeSyncCode(body.syncCode);
    const validationError = validateSyncCode(syncCode);

    if (validationError) {
      return NextResponse.json(
        {
          ok: false,
          error: validationError,
          updatedRecords: [],
          verifiedCount: 0,
        },
        { status: 400 },
      );
    }

    const records = await getPredictionRecords(syncCode);
    const updatedRecords = [];

    for (const record of records) {
      const updated = await verifyRecord(record);
      if (updated) updatedRecords.push(updated);
    }

    return NextResponse.json({
      ok: true,
      updatedRecords,
      verifiedCount: updatedRecords.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "예측 기록 검증에 실패했습니다.",
        updatedRecords: [],
        verifiedCount: 0,
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  createPredictionRecord,
  deletePredictionRecords,
  getPredictionRecords,
} from "../../../lib/supabasePredictions";
import type { PredictionRecord } from "../../../types/prediction";

function normalizeSyncCode(value: unknown) {
  return String(value || "").trim();
}

function normalizeSymbol(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function validateSyncCode(syncCode: string) {
  if (!syncCode) return "동기화 코드가 필요합니다.";
  if (syncCode.length < 4) return "동기화 코드는 4자 이상으로 입력해 주세요.";
  if (syncCode.length > 64) return "동기화 코드는 64자 이하로 입력해 주세요.";
  return "";
}

function validatePredictionRecord(record: Partial<PredictionRecord>) {
  if (!record.symbol) return "종목코드가 필요합니다.";
  if (!record.predictedAt) return "예측 저장 시간이 필요합니다.";
  if (!record.results) return "예측 결과가 필요합니다.";
  return "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const syncCode = normalizeSyncCode(searchParams.get("syncCode"));
  const symbol = normalizeSymbol(searchParams.get("symbol"));
  const validationError = validateSyncCode(syncCode);

  if (validationError) {
    return NextResponse.json(
      {
        ok: false,
        error: validationError,
        records: [],
      },
      { status: 400 },
    );
  }

  try {
    const records = await getPredictionRecords(syncCode, symbol || null);

    return NextResponse.json({
      ok: true,
      records,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "예측 기록을 불러오지 못했습니다.",
        records: [],
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      syncCode?: unknown;
      record?: Partial<PredictionRecord>;
    };

    const syncCode = normalizeSyncCode(body.syncCode);
    const validationError = validateSyncCode(syncCode);

    if (validationError) {
      return NextResponse.json(
        {
          ok: false,
          error: validationError,
        },
        { status: 400 },
      );
    }

    const record = {
      ...(body.record || {}),
      syncCode,
      symbol: normalizeSymbol(body.record?.symbol),
    } as PredictionRecord;

    const recordError = validatePredictionRecord(record);

    if (recordError) {
      return NextResponse.json(
        {
          ok: false,
          error: recordError,
        },
        { status: 400 },
      );
    }

    const savedRecord = await createPredictionRecord(record);

    return NextResponse.json({
      ok: true,
      record: savedRecord,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "예측 기록을 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      syncCode?: unknown;
      symbol?: unknown;
      scope?: "symbol" | "all";
    };

    const syncCode = normalizeSyncCode(body.syncCode);
    const validationError = validateSyncCode(syncCode);

    if (validationError) {
      return NextResponse.json(
        {
          ok: false,
          error: validationError,
        },
        { status: 400 },
      );
    }

    const symbol = normalizeSymbol(body.symbol);
    const deleteSymbol = body.scope === "symbol" ? symbol : "";

    await deletePredictionRecords(syncCode, deleteSymbol || null);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "예측 기록을 삭제하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

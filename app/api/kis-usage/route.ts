import { NextResponse } from "next/server";
import {
  getKisUsage,
  incrementKisUsage,
  KIS_DAILY_LIMIT,
} from "../../../lib/supabaseAdmin";

function normalizeSyncCode(value: unknown) {
  return String(value || "").trim();
}

function validateSyncCode(syncCode: string) {
  if (!syncCode) {
    return "동기화 코드가 필요합니다.";
  }

  if (syncCode.length < 4) {
    return "동기화 코드는 4자 이상으로 입력해 주세요.";
  }

  if (syncCode.length > 64) {
    return "동기화 코드는 64자 이하로 입력해 주세요.";
  }

  return "";
}

function normalizeIncrementBy(value: unknown) {
  const numeric = Number(value ?? 1);

  if (!Number.isFinite(numeric)) return 1;

  return Math.min(KIS_DAILY_LIMIT, Math.max(0, Math.floor(numeric)));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const syncCode = normalizeSyncCode(searchParams.get("syncCode"));
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

  try {
    const usage = await getKisUsage(syncCode);

    return NextResponse.json({
      ok: true,
      remaining: usage.remaining,
      limit: usage.limit,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "KIS 사용량을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      syncCode?: unknown;
      incrementBy?: unknown;
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

    const incrementBy = normalizeIncrementBy(body.incrementBy);
    const usage =
      incrementBy > 0
        ? await incrementKisUsage(syncCode, incrementBy)
        : await getKisUsage(syncCode);

    return NextResponse.json({
      ok: true,
      remaining: usage.remaining,
      limit: usage.limit,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "KIS 사용량을 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

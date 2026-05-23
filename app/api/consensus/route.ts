import { NextResponse } from "next/server";
import {
  getLatestConsensusTarget,
  upsertConsensusTargets,
  type ConsensusTargetInput,
} from "../../../lib/supabaseConsensus";

export const dynamic = "force-dynamic";

type ConsensusRequestBody = {
  fileName?: string;
  rows?: Array<Partial<ConsensusTargetInput>>;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "";

    if (!symbol.trim()) {
      return NextResponse.json(
        { ok: false, error: "symbol이 필요합니다." },
        { status: 400 },
      );
    }

    const data = await getLatestConsensusTarget(symbol);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConsensusRequestBody;
    const fileName = body.fileName || null;
    const rows = Array.isArray(body.rows) ? body.rows : [];

    const normalizedRows = rows
      .map((row) => normalizeInputRow(row, fileName))
      .filter((row): row is ConsensusTargetInput => Boolean(row));

    if (normalizedRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "저장할 컨센서스 데이터가 없습니다." },
        { status: 400 },
      );
    }

    const savedRows = await upsertConsensusTargets(normalizedRows);

    return NextResponse.json({
      ok: true,
      count: savedRows.length,
      rows: savedRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function normalizeInputRow(
  row: Partial<ConsensusTargetInput>,
  fileName: string | null,
): ConsensusTargetInput | null {
  const symbol = normalizeSymbol(row.symbol);
  const baseDate = normalizeDate(row.baseDate);
  const averageTarget = toNumberOrNull(row.averageTarget);

  if (!symbol || !baseDate || averageTarget == null) return null;

  return {
    symbol,
    name: toTextOrNull(row.name),
    baseDate,
    averageTarget,
    highTarget: toNumberOrNull(row.highTarget),
    lowTarget: toNumberOrNull(row.lowTarget),
    opinion: toTextOrNull(row.opinion),
    brokerCount: toIntegerOrNull(row.brokerCount),
    reportCount: toIntegerOrNull(row.reportCount),
    source: toTextOrNull(row.source),
    memo: toTextOrNull(row.memo),
    uploadedFileName: fileName,
  };
}

function normalizeSymbol(value?: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeDate(value?: unknown) {
  const text = String(value ?? "").trim().replace(/[./]/g, "-");
  const match = text.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);

  if (!match) return "";

  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function toTextOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function toNumberOrNull(value: unknown) {
  if (value == null || value === "") return null;

  const cleaned = String(value).replaceAll(",", "").replace(/[^0-9.-]/g, "").trim();
  const numeric = Number(cleaned);

  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function toIntegerOrNull(value: unknown) {
  const numeric = toNumberOrNull(value);
  return numeric == null ? null : Math.trunc(numeric);
}

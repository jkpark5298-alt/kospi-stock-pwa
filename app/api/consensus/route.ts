import { NextRequest, NextResponse } from "next/server";
import {
  getLatestConsensusTarget,
  listConsensusTargets,
  upsertConsensusTargets,
  type ConsensusTargetInput,
} from "../../../lib/supabaseConsensus";

type ConsensusPostBody = {
  targets?: ConsensusTargetInput[];
  target?: ConsensusTargetInput;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const list = searchParams.get("list") === "1";

    if (list) {
      const records = await listConsensusTargets(symbol);
      return NextResponse.json({ ok: true, records });
    }

    if (!symbol) {
      return NextResponse.json(
        { ok: false, error: "symbol query parameter is required." },
        { status: 400 },
      );
    }

    const record = await getLatestConsensusTarget(symbol);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load consensus target.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConsensusPostBody;
    const targets = Array.isArray(body.targets)
      ? body.targets
      : body.target
        ? [body.target]
        : [];

    if (targets.length === 0) {
      return NextResponse.json(
        { ok: false, error: "targets array is required." },
        { status: 400 },
      );
    }

    const records = await upsertConsensusTargets(targets);

    return NextResponse.json({
      ok: true,
      count: records.length,
      records,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save consensus targets.",
      },
      { status: 500 },
    );
  }
}

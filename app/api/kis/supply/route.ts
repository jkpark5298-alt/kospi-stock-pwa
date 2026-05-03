import { NextRequest, NextResponse } from "next/server";
import { getKisInvestorSummary, normalizeDomesticStockCode } from "@/lib/kis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "005930.KS";
  const normalizedCode = normalizeDomesticStockCode(symbol);

  try {
    const supply = await getKisInvestorSummary(symbol);

    return NextResponse.json({
      ok: true,
      message: "한투 수급 데이터 조회 성공",
      inputSymbol: symbol,
      normalizedCode,
      supply: {
        code: supply.code,
        rowCount: supply.rows.length,
        recent5: supply.recent5,
        recent20: supply.recent20,
        foreignPositiveStreak5: supply.foreignPositiveStreak5,
        institutionPositiveStreak5: supply.institutionPositiveStreak5,
        smartMoneyPositiveStreak5: supply.smartMoneyPositiveStreak5,
        latestRows: supply.rows.slice(-10).reverse(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "한투 수급 데이터 조회 실패",
        inputSymbol: symbol,
        normalizedCode,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
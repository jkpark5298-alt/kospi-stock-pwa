import { NextRequest, NextResponse } from "next/server";
import { getKisAccessToken, getKisCurrentPrice, normalizeDomesticStockCode } from "@/lib/kis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "005930.KS";
  const normalizedCode = normalizeDomesticStockCode(symbol);

  try {
    const token = await getKisAccessToken();
    const currentPrice = await getKisCurrentPrice(symbol);

    return NextResponse.json({
      ok: true,
      message: "한투 API 연결 성공",
      inputSymbol: symbol,
      normalizedCode,
      token: {
        issued: true,
        fromCache: token.fromCache,
        expiresAt: new Date(token.expiresAt).toISOString(),
      },
      currentPrice: {
        code: currentPrice.code,
        name: currentPrice.name,
        marketName: currentPrice.marketName,
        currentPrice: currentPrice.currentPrice,
        changePrice: currentPrice.changePrice,
        changeRate: currentPrice.changeRate,
        accumulatedVolume: currentPrice.accumulatedVolume,
        accumulatedTradingValue: currentPrice.accumulatedTradingValue,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "한투 API 연결 실패",
        inputSymbol: symbol,
        normalizedCode,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
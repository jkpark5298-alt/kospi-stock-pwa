import { NextResponse } from "next/server";
import {
  fallbackResolveStockSymbol,
  findKrxStock,
} from "../../../../lib/krxStocks";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("query") || "").trim();

  if (!query) {
    return NextResponse.json(
      {
        ok: false,
        error: "검색어가 필요합니다.",
      },
      { status: 400 },
    );
  }

  try {
    const stock = await findKrxStock(query);

    if (!stock) {
      return NextResponse.json({
        ok: false,
        query,
        error: "일치하는 KRX 종목을 찾지 못했습니다.",
        fallbackSymbol: fallbackResolveStockSymbol(query),
      });
    }

    return NextResponse.json({
      ok: true,
      query,
      stock,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        query,
        error:
          error instanceof Error
            ? error.message
            : "종목 변환에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}

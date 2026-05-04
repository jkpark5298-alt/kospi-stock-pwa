import { NextRequest, NextResponse } from "next/server";
import { getKisStockFundamentals } from "@/lib/kis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        ok: false,
        error: "This debug API is only available in development.",
      },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "005930.KS";

  try {
    const fundamentals = await getKisStockFundamentals(symbol);

    return NextResponse.json({
      ok: true,
      symbol,
      parsed: {
        marketCap: fundamentals.marketCap,
        per: fundamentals.per,
        pbr: fundamentals.pbr,
        eps: fundamentals.eps,
        bps: fundamentals.bps,
        dividendYield: fundamentals.dividendYield,
        foreignOwnershipRate: fundamentals.foreignOwnershipRate,
        sharesOutstanding: fundamentals.sharesOutstanding,
        high52w: fundamentals.high52w,
        low52w: fundamentals.low52w,
      },
      rawFocus: {
        hts_avls: fundamentals.raw.hts_avls,
        avls: fundamentals.raw.avls,
        mrkt_tot_amt: fundamentals.raw.mrkt_tot_amt,
        market_cap: fundamentals.raw.market_cap,
        lstn_stcn: fundamentals.raw.lstn_stcn,
        shares_outstanding: fundamentals.raw.shares_outstanding,
        stck_prpr: fundamentals.raw.stck_prpr,
        per: fundamentals.raw.per,
        pbr: fundamentals.raw.pbr,
        eps: fundamentals.raw.eps,
        bps: fundamentals.raw.bps,
        w52_hgpr: fundamentals.raw.w52_hgpr,
        w52_lwpr: fundamentals.raw.w52_lwpr,
        frgn_hldn_rt: fundamentals.raw.frgn_hldn_rt,
        dvyd: fundamentals.raw.dvyd,
        dvd_yld: fundamentals.raw.dvd_yld,
      },
      raw: fundamentals.raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        symbol,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
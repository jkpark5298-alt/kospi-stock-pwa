import { NextRequest, NextResponse } from "next/server";
import { getKisStockFundamentals, normalizeDomesticStockCode } from "@/lib/kis";
import { setFundamentalsCache, setFundamentalsCacheToSupabase } from "@/lib/fundamentalsCache";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "005930.KS";
  const normalizedCode = normalizeDomesticStockCode(symbol);

  try {
    const fundamentals = await getKisStockFundamentals(symbol);

    const fundamentalsData = {
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
    };

    const cachedFundamentals = setFundamentalsCache(symbol, fundamentalsData);
    await setFundamentalsCacheToSupabase(symbol, fundamentalsData);

    return NextResponse.json({
      ok: true,
      message: "한투 재무·밸류에이션 데이터 조회 성공",
      source: "KIS",
      inputSymbol: symbol,
      normalizedCode,
      data: fundamentalsData,
      cache: cachedFundamentals
        ? {
            stored: true,
            updatedAt: cachedFundamentals.updatedAt,
          }
        : {
            stored: false,
            updatedAt: null,
          },
      analysisUse: {
        valuation: {
          available:
            fundamentals.per != null ||
            fundamentals.pbr != null ||
            fundamentals.eps != null ||
            fundamentals.bps != null,
          fields: ["PER", "PBR", "EPS", "BPS", "시가총액"],
          usage: "밸류에이션 추정 주가와 추정 주가 신뢰도 보정에 사용",
        },
        risk: {
          available: fundamentals.high52w != null || fundamentals.low52w != null,
          fields: ["52주 고가", "52주 저가"],
          usage: "현재가의 과열·저평가 위치와 위험 기준선 판단에 사용",
        },
        supplyReference: {
          available: fundamentals.foreignOwnershipRate != null,
          fields: ["외국인 보유율"],
          usage: "수급 점수와 함께 외국인 수급 신뢰도 참고값으로 사용",
        },
        incomeReference: {
          available: fundamentals.eps != null,
          fields: ["EPS"],
          usage:
            "예상 EPS가 들어오기 전까지 현재 EPS 기준 밸류에이션 참고값으로 사용",
        },
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
        hts_frgn_ehrt: fundamentals.raw.hts_frgn_ehrt,
        dvyd: fundamentals.raw.dvyd,
        dvd_yld: fundamentals.raw.dvd_yld,
      },
      raw: fundamentals.raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "한투 재무·밸류에이션 데이터 조회 실패",
        inputSymbol: symbol,
        normalizedCode,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

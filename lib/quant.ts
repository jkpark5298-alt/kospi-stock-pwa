export type QuantChartRow = {
  date: string;
  close: number | null;
  sma20?: number | null;
  sma60?: number | null;
  rsi14?: number | null;
  macd?: number | null;
  signal?: number | null;
  histogram?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  volume?: number | null;
  obv?: number | null;
};

export type QuantSupplySummary = {
  individualNetBuy: number;
  foreignNetBuy: number;
  institutionNetBuy: number;
  smartMoneyNetBuy: number;
};

export type QuantSupplyData = {
  available: boolean;
  recent5?: QuantSupplySummary;
  recent20?: QuantSupplySummary;
  foreignPositiveStreak5?: boolean;
  institutionPositiveStreak5?: boolean;
  smartMoneyPositiveStreak5?: boolean;
};

export type QuantFundamentals = {
  marketCap: number | null;
  per: number | null;
  pbr: number | null;
  eps: number | null;
  bps: number | null;
  dividendYield: number | null;
  foreignOwnershipRate: number | null;
  sharesOutstanding: number | null;
  high52w: number | null;
  low52w: number | null;
};

export type QuantEarningsGrowthData = {
  available: boolean;
  excluded?: boolean;
  source?: "none" | "manual" | "kis" | "dart" | "consensus";
  updatedAt?: string | null;
  warning?: string;

  lastYearNetIncome?: number | null;
  expectedNetIncome?: number | null;
  netIncomeGrowthRate?: number | null;

  lastYearOperatingProfit?: number | null;
  expectedOperatingProfit?: number | null;
  operatingProfitGrowthRate?: number | null;

  lastYearEps?: number | null;
  expectedEps?: number | null;
  epsGrowthRate?: number | null;

  turnaround?: boolean | null;
  deficitReduction?: boolean | null;
};

export type QuantTargetPriceRange = {
  currentPrice: number;
  conservativeTarget: number;
  baseTarget: number;
  aggressiveTarget: number;
  riskLine: number;
  conservativeUpsidePercent: number;
  baseUpsidePercent: number;
  aggressiveUpsidePercent: number;
  riskDownsidePercent: number;
};

export type QuantScorePart = {
  score: number;
  maxScore: number;
  label: string;
  reasons: string[];
};

export type QuantModelResult = {
  available: boolean;
  total: number | null;
  grade: string;
  action: string;
  summary: string;

  momentum: QuantScorePart;
  trend: QuantScorePart;
  tradingValue: QuantScorePart;
  valuation: QuantScorePart;
  supply: QuantScorePart;
  volatility: QuantScorePart;
  risk: QuantScorePart;
  target: QuantScorePart;
  earningsGrowth: QuantScorePart;

  flags: {
    nearHigh52w: boolean;
    valuationBurden: boolean;
    targetAlmostReached: boolean;
    supplyPositive: boolean;
    momentumPositive: boolean;
    trendPositive: boolean;
    tradingValuePositive: boolean;
    volatilityHigh: boolean;
    earningsGrowthPositive: boolean;
  };
};

export function calculateQuantModel({
  rows,
  supply,
  fundamentals,
  targetRange,
  earningsGrowth,
}: {
  rows: QuantChartRow[];
  supply?: QuantSupplyData;
  fundamentals?: QuantFundamentals;
  targetRange?: QuantTargetPriceRange | null;
  earningsGrowth?: QuantEarningsGrowthData | null;
}): QuantModelResult {
  const sortedRows = sortRowsByDate(rows);
  const latest = sortedRows.length ? sortedRows[sortedRows.length - 1] : null;
  const previous =
    sortedRows.length >= 2 ? sortedRows[sortedRows.length - 2] : null;

  if (!latest || latest.close == null) {
    return makeUnavailableQuantResult();
  }

  const momentum = calculateMomentumPart(sortedRows, latest);
  const trend = calculateTrendPart(sortedRows, latest);
  const tradingValue = calculateTradingValuePart(sortedRows);
  const valuation = calculateValuationPart(fundamentals);
  const supplyPart = calculateSupplyPart(supply, fundamentals);
  const volatility = calculateVolatilityPart(sortedRows);
  const risk = calculateRiskPart({
    latest,
    previous,
    fundamentals,
    targetRange,
  });
  const target = calculateTargetPart(targetRange);
  const earningsGrowthPart = calculateEarningsGrowthPart(earningsGrowth);

  const total = calculateQuantTotal([
    momentum,
    trend,
    tradingValue,
    valuation,
    supplyPart,
    volatility,
    risk,
    target,
    earningsGrowthPart,
  ]);

  const flags = makeQuantFlags({
    latest,
    fundamentals,
    targetRange,
    momentum,
    trend,
    tradingValue,
    valuation,
    supply: supplyPart,
    volatility,
    earningsGrowth: earningsGrowthPart,
  });

  const grade = getQuantGrade(total);
  const action = getQuantAction(total, flags);
  const summary = makeQuantSummary({
    total,
    grade,
    action,
    flags,
    momentum,
    trend,
    tradingValue,
    valuation,
    supply: supplyPart,
    volatility,
    risk,
    target,
    earningsGrowth: earningsGrowthPart,
  });

  return {
    available: true,
    total,
    grade,
    action,
    summary,
    momentum,
    trend,
    tradingValue,
    valuation,
    supply: supplyPart,
    volatility,
    risk,
    target,
    earningsGrowth: earningsGrowthPart,
    flags,
  };
}

function calculateMomentumPart(
  rows: QuantChartRow[],
  latest: QuantChartRow,
): QuantScorePart {
  let score = 0;
  const reasons: string[] = [];

  if (latest.close != null && latest.sma20 != null) {
    if (latest.close > latest.sma20) {
      score += 4;
      reasons.push("현재가가 SMA20 위에 있어 단기 모멘텀이 긍정적입니다.");
    } else {
      reasons.push("현재가가 SMA20 아래에 있어 단기 모멘텀 확인이 필요합니다.");
    }
  } else {
    reasons.push("SMA20 비교 데이터가 부족합니다.");
  }

  if (latest.macd != null && latest.signal != null) {
    if (latest.macd > latest.signal) {
      score += 4;
      reasons.push("MACD가 Signal 위에 있어 모멘텀이 우세합니다.");
    } else {
      reasons.push("MACD가 Signal 아래에 있어 모멘텀이 약합니다.");
    }
  } else {
    reasons.push("MACD 데이터가 부족합니다.");
  }

  if (latest.histogram != null) {
    if (latest.histogram > 0) {
      score += 2;
      reasons.push("MACD 히스토그램이 양수입니다.");
    } else {
      reasons.push("MACD 히스토그램이 음수입니다.");
    }
  }

  if (latest.rsi14 != null) {
    if (latest.rsi14 >= 45 && latest.rsi14 <= 68) {
      score += 4;
      reasons.push("RSI가 상승 모멘텀 확인에 적절한 구간입니다.");
    } else if (latest.rsi14 > 68 && latest.rsi14 < 75) {
      score += 2;
      reasons.push("RSI가 강하지만 과열에 가까워지고 있습니다.");
    } else if (latest.rsi14 >= 75) {
      score -= 3;
      reasons.push("RSI가 과열권에 있어 단기 추격은 주의가 필요합니다.");
    } else {
      reasons.push("RSI가 약한 구간입니다.");
    }
  } else {
    reasons.push("RSI 데이터가 부족합니다.");
  }

  const recentReturn = calculateReturn(rows, 5);

  if (recentReturn != null) {
    if (recentReturn > 5) {
      score += 4;
      reasons.push("최근 5거래일 수익률이 강합니다.");
    } else if (recentReturn > 0) {
      score += 2;
      reasons.push("최근 5거래일 수익률이 양수입니다.");
    } else if (recentReturn < -5) {
      score -= 2;
      reasons.push("최근 5거래일 수익률이 약합니다.");
    } else {
      reasons.push("최근 5거래일 수익률은 보합권입니다.");
    }
  }

  const finalScore = clampPartScore(score, 18);

  return {
    score: finalScore,
    maxScore: 18,
    label: getPartLabel(finalScore, 18),
    reasons,
  };
}

function calculateTrendPart(
  rows: QuantChartRow[],
  latest: QuantChartRow,
): QuantScorePart {
  let score = 0;
  const reasons: string[] = [];

  if (latest.close != null && latest.sma20 != null) {
    if (latest.close > latest.sma20) {
      score += 3;
      reasons.push("현재가가 20일선 위에서 유지되고 있습니다.");
    } else {
      reasons.push("현재가가 20일선 아래에 있습니다.");
    }
  } else {
    reasons.push("20일선 추세 데이터가 부족합니다.");
  }

  if (latest.sma20 != null && latest.sma60 != null) {
    if (latest.sma20 > latest.sma60) {
      score += 3;
      reasons.push("20일선이 60일선 위에 있어 중기 추세가 양호합니다.");
    } else {
      reasons.push("20일선이 60일선 아래에 있어 중기 추세가 약합니다.");
    }
  } else {
    reasons.push("20일선·60일선 비교 데이터가 부족합니다.");
  }

  const sma20Slope = calculateSmaSlope(rows, "sma20", 5);

  if (sma20Slope != null) {
    if (sma20Slope > 1.5) {
      score += 3;
      reasons.push("최근 20일선 기울기가 상승 방향입니다.");
    } else if (sma20Slope > 0) {
      score += 2;
      reasons.push("최근 20일선이 완만하게 상승 중입니다.");
    } else {
      reasons.push("최근 20일선 기울기가 약하거나 하락 중입니다.");
    }
  }

  if (hasHigherRecentLows(rows)) {
    score += 3;
    reasons.push("최근 저점이 높아지는 구조가 확인됩니다.");
  } else {
    reasons.push("최근 저점 상승 구조는 뚜렷하지 않습니다.");
  }

  const finalScore = clampPartScore(score, 12);

  return {
    score: finalScore,
    maxScore: 12,
    label: getPartLabel(finalScore, 12),
    reasons,
  };
}

function calculateTradingValuePart(rows: QuantChartRow[]): QuantScorePart {
  const reasons: string[] = [];
  const latest = rows[rows.length - 1] ?? null;

  if (!latest || latest.close == null || latest.volume == null) {
    return {
      score: 5,
      maxScore: 12,
      label: "데이터 대기",
      reasons: ["거래대금 계산에 필요한 현재가·거래량 데이터가 부족합니다."],
    };
  }

  let score = 0;
  const avg5 = calculateAverageTradingValue(rows, 5);
  const avg20 = calculateAverageTradingValue(rows, 20);
  const latestTradingValue = latest.close * latest.volume;

  if (avg5 != null && avg20 != null && avg20 > 0) {
    const ratio = avg5 / avg20;

    if (ratio >= 1.8) {
      score += 6;
      reasons.push("최근 5일 평균 거래대금이 20일 평균보다 크게 증가했습니다.");
    } else if (ratio >= 1.3) {
      score += 5;
      reasons.push("최근 5일 평균 거래대금이 20일 평균보다 증가했습니다.");
    } else if (ratio >= 0.9) {
      score += 3;
      reasons.push("최근 거래대금은 20일 평균과 비슷한 수준입니다.");
    } else {
      score += 1;
      reasons.push("최근 거래대금이 20일 평균보다 줄었습니다.");
    }
  } else {
    score += 2;
    reasons.push("거래대금 평균 비교 데이터가 부족합니다.");
  }

  if (avg20 != null) {
    if (avg20 >= 50_000_000_000) {
      score += 4;
      reasons.push("20일 평균 거래대금이 커서 유동성이 양호합니다.");
    } else if (avg20 >= 10_000_000_000) {
      score += 3;
      reasons.push("20일 평균 거래대금이 보통 이상입니다.");
    } else if (avg20 >= 3_000_000_000) {
      score += 2;
      reasons.push("20일 평균 거래대금은 보통 수준입니다.");
    } else {
      reasons.push("20일 평균 거래대금이 작아 유동성 확인이 필요합니다.");
    }
  }

  const previous = rows.length >= 2 ? rows[rows.length - 2] : null;

  if (
    previous?.close != null &&
    previous.volume != null &&
    latest.close > previous.close &&
    latestTradingValue > previous.close * previous.volume
  ) {
    score += 2;
    reasons.push("상승일에 거래대금이 함께 증가했습니다.");
  }

  const finalScore = clampPartScore(score, 12);

  return {
    score: finalScore,
    maxScore: 12,
    label: getPartLabel(finalScore, 12),
    reasons,
  };
}

function calculateValuationPart(
  fundamentals?: QuantFundamentals,
): QuantScorePart {
  let score = 0;
  const reasons: string[] = [];

  const per = fundamentals?.per ?? null;
  const pbr = fundamentals?.pbr ?? null;
  const eps = fundamentals?.eps ?? null;
  const bps = fundamentals?.bps ?? null;

  if (per != null && Number.isFinite(per) && per > 0) {
    if (per <= 10) {
      score += 6;
      reasons.push("PER이 낮아 밸류에이션 부담이 작습니다.");
    } else if (per <= 20) {
      score += 5;
      reasons.push("PER이 보통 수준입니다.");
    } else if (per <= 30) {
      score += 3;
      reasons.push("PER이 다소 높아 밸류에이션 확인이 필요합니다.");
    } else if (per <= 40) {
      score += 1;
      reasons.push("PER이 높은 편이라 밸류에이션 부담이 있습니다.");
    } else {
      reasons.push("PER이 매우 높아 밸류에이션 부담이 큽니다.");
    }
  } else {
    score += 2;
    reasons.push("PER 데이터가 없어 낮은 중립값으로 반영했습니다.");
  }

  if (pbr != null && Number.isFinite(pbr) && pbr > 0) {
    if (pbr <= 1) {
      score += 5;
      reasons.push("PBR이 낮아 자산가치 대비 부담이 작습니다.");
    } else if (pbr <= 2) {
      score += 4;
      reasons.push("PBR이 보통 수준입니다.");
    } else if (pbr <= 3) {
      score += 2;
      reasons.push("PBR이 다소 높습니다.");
    } else if (pbr <= 5) {
      score += 1;
      reasons.push("PBR이 높은 편입니다.");
    } else {
      reasons.push("PBR이 매우 높아 자산가치 대비 부담이 큽니다.");
    }
  } else {
    score += 1;
    reasons.push("PBR 데이터가 없어 낮은 중립값으로 반영했습니다.");
  }

  if (eps != null && eps > 0) {
    score += 2;
    reasons.push("EPS가 양수입니다.");
  } else if (eps != null && eps <= 0) {
    score -= 2;
    reasons.push("EPS가 양수가 아닙니다.");
  } else {
    reasons.push("EPS 데이터가 없습니다.");
  }

  if (bps != null && bps > 0) {
    score += 2;
    reasons.push("BPS가 양수입니다.");
  } else {
    reasons.push("BPS 데이터가 없습니다.");
  }

  const finalScore = clampPartScore(score, 15);

  return {
    score: finalScore,
    maxScore: 15,
    label: getPartLabel(finalScore, 15),
    reasons,
  };
}

function calculateSupplyPart(
  supply?: QuantSupplyData,
  fundamentals?: QuantFundamentals,
): QuantScorePart {
  let score = 0;
  const reasons: string[] = [];

  if (!supply?.available) {
    return {
      score: 6,
      maxScore: 15,
      label: "데이터 대기",
      reasons: ["수급 데이터가 없어 보수적으로 반영했습니다."],
    };
  }

  const recent5Smart = supply.recent5?.smartMoneyNetBuy ?? 0;
  const recent20Smart = supply.recent20?.smartMoneyNetBuy ?? 0;
  const foreign5 = supply.recent5?.foreignNetBuy ?? 0;
  const institution5 = supply.recent5?.institutionNetBuy ?? 0;

  if (recent5Smart > 0) {
    score += 4;
    reasons.push("최근 5일 외국인+기관 합산 수급이 양수입니다.");
  } else if (recent5Smart < 0) {
    reasons.push("최근 5일 외국인+기관 합산 수급이 음수입니다.");
  } else {
    score += 1;
    reasons.push("최근 5일 외국인+기관 합산 수급이 보합입니다.");
  }

  if (recent20Smart > 0) {
    score += 4;
    reasons.push("최근 20일 외국인+기관 합산 수급이 양수입니다.");
  } else if (recent20Smart < 0) {
    reasons.push("최근 20일 외국인+기관 합산 수급이 음수입니다.");
  } else {
    score += 1;
    reasons.push("최근 20일 외국인+기관 합산 수급이 보합입니다.");
  }

  if (foreign5 > 0) {
    score += 2;
    reasons.push("최근 5일 외국인 순매수가 양수입니다.");
  }

  if (institution5 > 0) {
    score += 2;
    reasons.push("최근 5일 기관 순매수가 양수입니다.");
  }

  if (supply.smartMoneyPositiveStreak5) {
    score += 2;
    reasons.push("최근 5일 연속 외국인+기관 합산 순매수가 양수입니다.");
  }

  const foreignOwnershipRate = fundamentals?.foreignOwnershipRate ?? null;

  if (foreignOwnershipRate != null) {
    if (foreignOwnershipRate >= 40) {
      score += 1;
      reasons.push("외국인 보유율이 높은 편입니다.");
    } else if (foreignOwnershipRate >= 20) {
      score += 1;
      reasons.push("외국인 보유율이 보통 이상입니다.");
    } else {
      reasons.push("외국인 보유율은 높지 않습니다.");
    }
  }

  const finalScore = clampPartScore(score, 15);

  return {
    score: finalScore,
    maxScore: 15,
    label: getPartLabel(finalScore, 15),
    reasons,
  };
}

function calculateVolatilityPart(rows: QuantChartRow[]): QuantScorePart {
  const reasons: string[] = [];
  const returns = calculateDailyReturns(rows, 20);

  if (returns.length < 10) {
    return {
      score: 5,
      maxScore: 10,
      label: "데이터 대기",
      reasons: ["변동성 계산에 필요한 최근 데이터가 부족합니다."],
    };
  }

  let score = 0;
  const volatility = calculateStandardDeviation(returns);

  if (volatility <= 1) {
    score += 6;
    reasons.push("최근 변동성이 낮아 안정적이지만 탄력은 제한될 수 있습니다.");
  } else if (volatility <= 3) {
    score += 10;
    reasons.push("최근 변동성이 적정 범위입니다.");
  } else if (volatility <= 5) {
    score += 7;
    reasons.push("최근 변동성이 다소 큰 편입니다.");
  } else if (volatility <= 8) {
    score += 3;
    reasons.push("최근 변동성이 커서 리스크 관리가 필요합니다.");
  } else {
    reasons.push("최근 변동성이 매우 큽니다.");
  }

  const downDays = returns.filter((value) => value < -3).length;

  if (downDays >= 3) {
    score -= 2;
    reasons.push("최근 20일 중 큰 하락일이 여러 번 발생했습니다.");
  }

  const finalScore = clampPartScore(score, 10);

  return {
    score: finalScore,
    maxScore: 10,
    label: getPartLabel(finalScore, 10),
    reasons,
  };
}

function calculateEarningsGrowthPart(
  earningsGrowth?: QuantEarningsGrowthData | null,
): QuantScorePart {
  if (earningsGrowth?.excluded) {
    return {
      score: 0,
      maxScore: 0,
      label: "제외",
      reasons: ["ETF/ETN/지수형 상품은 실적 성장 분석 대상에서 제외했습니다."],
    };
  }

  if (!earningsGrowth?.available) {
    return {
      score: 0,
      maxScore: 0,
      label: "데이터 대기",
      reasons: ["예상 순이익·영업이익·EPS 성장률 데이터가 아직 연결되지 않았습니다."],
    };
  }

  let score = 0;
  const reasons: string[] = [];
  const hasGrowthMetric =
    earningsGrowth.netIncomeGrowthRate != null ||
    earningsGrowth.operatingProfitGrowthRate != null ||
    earningsGrowth.epsGrowthRate != null ||
    earningsGrowth.turnaround != null ||
    earningsGrowth.deficitReduction != null;

  if (!hasGrowthMetric) {
    return {
      score: 0,
      maxScore: 0,
      label: "데이터 대기",
      reasons: ["실적 성장 데이터가 있으나 계산 가능한 성장률 항목이 없습니다."],
    };
  }

  const netIncomeGrowth = earningsGrowth.netIncomeGrowthRate ?? null;

  if (netIncomeGrowth != null) {
    if (netIncomeGrowth >= 50) {
      score += 4;
      reasons.push("예상 순이익 증가율이 50% 이상으로 강합니다.");
    } else if (netIncomeGrowth >= 30) {
      score += 3;
      reasons.push("예상 순이익 증가율이 30% 이상입니다.");
    } else if (netIncomeGrowth >= 10) {
      score += 2;
      reasons.push("예상 순이익 증가율이 10% 이상입니다.");
    } else if (netIncomeGrowth > 0) {
      score += 1;
      reasons.push("예상 순이익이 소폭 증가할 전망입니다.");
    } else {
      reasons.push("예상 순이익 증가율이 양수가 아닙니다.");
    }
  } else {
    reasons.push("예상 순이익 증가율 데이터가 없습니다.");
  }

  const operatingGrowth = earningsGrowth.operatingProfitGrowthRate ?? null;

  if (operatingGrowth != null) {
    if (operatingGrowth >= 30) {
      score += 3;
      reasons.push("예상 영업이익 증가율이 30% 이상입니다.");
    } else if (operatingGrowth >= 10) {
      score += 2;
      reasons.push("예상 영업이익 증가율이 10% 이상입니다.");
    } else if (operatingGrowth > 0) {
      score += 1;
      reasons.push("예상 영업이익이 소폭 증가할 전망입니다.");
    } else {
      reasons.push("예상 영업이익 증가율이 양수가 아닙니다.");
    }
  } else {
    reasons.push("예상 영업이익 증가율 데이터가 없습니다.");
  }

  const epsGrowth = earningsGrowth.epsGrowthRate ?? null;

  if (epsGrowth != null) {
    if (epsGrowth >= 25) {
      score += 2;
      reasons.push("예상 EPS 증가율이 25% 이상입니다.");
    } else if (epsGrowth >= 10) {
      score += 1;
      reasons.push("예상 EPS 증가율이 10% 이상입니다.");
    } else if (epsGrowth > 0) {
      score += 1;
      reasons.push("예상 EPS가 소폭 증가할 전망입니다.");
    } else {
      reasons.push("예상 EPS 증가율이 양수가 아닙니다.");
    }
  } else {
    reasons.push("예상 EPS 증가율 데이터가 없습니다.");
  }

  if (earningsGrowth.turnaround) {
    score += 1;
    reasons.push("흑자 전환 기대가 반영됐습니다.");
  } else if (earningsGrowth.deficitReduction) {
    score += 1;
    reasons.push("적자 축소 기대가 반영됐습니다.");
  }

  const finalScore = clampPartScore(score, 10);

  return {
    score: finalScore,
    maxScore: 10,
    label: getPartLabel(finalScore, 10),
    reasons,
  };
}

function calculateRiskPart({
  latest,
  previous,
  fundamentals,
  targetRange,
}: {
  latest: QuantChartRow;
  previous: QuantChartRow | null;
  fundamentals?: QuantFundamentals;
  targetRange?: QuantTargetPriceRange | null;
}): QuantScorePart {
  let score = 10;
  const reasons: string[] = [];

  const currentPrice = latest.close ?? null;
  const high52w = fundamentals?.high52w ?? null;
  const low52w = fundamentals?.low52w ?? null;

  if (currentPrice != null && high52w != null && high52w > 0) {
    const highRatio = currentPrice / high52w;

    if (highRatio >= 0.98) {
      score -= 4;
      reasons.push("현재가가 52주 고가에 매우 근접해 추격 위험이 있습니다.");
    } else if (highRatio >= 0.9) {
      score -= 2;
      reasons.push("현재가가 52주 고가권에 있습니다.");
    } else {
      reasons.push("현재가가 52주 고가와 충분한 거리가 있습니다.");
    }
  } else {
    reasons.push("52주 고가 비교 데이터가 부족합니다.");
  }

  if (
    currentPrice != null &&
    low52w != null &&
    high52w != null &&
    high52w > low52w
  ) {
    const rangePosition = (currentPrice - low52w) / (high52w - low52w);

    if (rangePosition >= 0.85) {
      score -= 1;
      reasons.push("52주 가격 범위에서 상단권입니다.");
    } else if (rangePosition <= 0.25) {
      score += 1;
      reasons.push("52주 가격 범위에서 하단권입니다.");
    }
  }

  if (targetRange?.riskDownsidePercent != null) {
    if (targetRange.riskDownsidePercent > -3) {
      score -= 2;
      reasons.push("위험 기준선이 현재가와 가까워 손익비가 좋지 않습니다.");
    } else if (targetRange.riskDownsidePercent <= -10) {
      score += 1;
      reasons.push("위험 기준선까지 여유가 있습니다.");
    }
  }

  if (latest.rsi14 != null && latest.rsi14 >= 75) {
    score -= 2;
    reasons.push("RSI 과열로 단기 변동성 위험이 있습니다.");
  }

  if (
    currentPrice != null &&
    previous?.close != null &&
    latest.volume != null &&
    previous.volume != null &&
    currentPrice < previous.close &&
    latest.volume > previous.volume * 1.5
  ) {
    score -= 2;
    reasons.push("하락일에 거래량이 증가해 단기 위험이 있습니다.");
  }

  const finalScore = clampPartScore(score, 10);

  return {
    score: finalScore,
    maxScore: 10,
    label: getPartLabel(finalScore, 10),
    reasons,
  };
}

function calculateTargetPart(
  targetRange?: QuantTargetPriceRange | null,
): QuantScorePart {
  if (!targetRange) {
    return {
      score: 3,
      maxScore: 8,
      label: "데이터 대기",
      reasons: ["목표가 데이터가 없어 보수적으로 반영했습니다."],
    };
  }

  let score = 0;
  const reasons: string[] = [];
  const upside = targetRange.baseUpsidePercent;
  const targetProgress =
    targetRange.baseTarget > 0
      ? (targetRange.currentPrice / targetRange.baseTarget) * 100
      : null;

  if (upside >= 12) {
    score += 8;
    reasons.push("기준 목표가 대비 상승 여력이 큽니다.");
  } else if (upside >= 8) {
    score += 6;
    reasons.push("기준 목표가 대비 상승 여력이 양호합니다.");
  } else if (upside >= 5) {
    score += 4;
    reasons.push("기준 목표가 대비 상승 여력이 보통입니다.");
  } else if (upside >= 2) {
    score += 2;
    reasons.push("기준 목표가 대비 상승 여력이 작습니다.");
  } else if (upside > 0) {
    score += 1;
    reasons.push("기준 목표가 대비 상승 여력이 매우 작습니다.");
  } else {
    reasons.push("현재가가 기준 목표가 이상이어서 목표여력은 낮습니다.");
  }

  if (targetProgress != null && targetProgress >= 97) {
    score -= 1;
    reasons.push("목표 도달률이 높아 추격 주의가 필요합니다.");
  }

  const finalScore = clampPartScore(score, 8);

  return {
    score: finalScore,
    maxScore: 8,
    label: getPartLabel(finalScore, 8),
    reasons,
  };
}

function makeQuantFlags({
  latest,
  fundamentals,
  targetRange,
  momentum,
  trend,
  tradingValue,
  valuation,
  supply,
  volatility,
  earningsGrowth,
}: {
  latest: QuantChartRow;
  fundamentals?: QuantFundamentals;
  targetRange?: QuantTargetPriceRange | null;
  momentum: QuantScorePart;
  trend: QuantScorePart;
  tradingValue: QuantScorePart;
  valuation: QuantScorePart;
  supply: QuantScorePart;
  volatility: QuantScorePart;
  earningsGrowth: QuantScorePart;
}) {
  const currentPrice = latest.close ?? null;
  const high52w = fundamentals?.high52w ?? null;
  const per = fundamentals?.per ?? null;
  const pbr = fundamentals?.pbr ?? null;
  const targetProgress =
    targetRange && targetRange.baseTarget > 0
      ? (targetRange.currentPrice / targetRange.baseTarget) * 100
      : null;

  return {
    nearHigh52w:
      currentPrice != null &&
      high52w != null &&
      high52w > 0 &&
      currentPrice / high52w >= 0.98,
    valuationBurden:
      (per != null && per >= 35) ||
      (pbr != null && pbr >= 3) ||
      valuation.score <= 5,
    targetAlmostReached: targetProgress != null && targetProgress >= 97,
    supplyPositive: supply.score >= 10,
    momentumPositive: momentum.score >= 12,
    trendPositive: trend.score >= 8,
    tradingValuePositive: tradingValue.score >= 8,
    volatilityHigh: volatility.score <= 4,
    earningsGrowthPositive:
      earningsGrowth.maxScore > 0 &&
      earningsGrowth.score / Math.max(earningsGrowth.maxScore, 1) >= 0.65,
  };
}

function makeQuantSummary({
  total,
  grade,
  action,
  flags,
  momentum,
  trend,
  tradingValue,
  valuation,
  supply,
  volatility,
  risk,
  target,
  earningsGrowth,
}: {
  total: number;
  grade: string;
  action: string;
  flags: QuantModelResult["flags"];
  momentum: QuantScorePart;
  trend: QuantScorePart;
  tradingValue: QuantScorePart;
  valuation: QuantScorePart;
  supply: QuantScorePart;
  volatility: QuantScorePart;
  risk: QuantScorePart;
  target: QuantScorePart;
  earningsGrowth: QuantScorePart;
}) {
  const positives: string[] = [];
  const cautions: string[] = [];

  if (flags.momentumPositive) positives.push("모멘텀");
  if (flags.trendPositive) positives.push("추세 지속성");
  if (flags.tradingValuePositive) positives.push("거래대금");
  if (flags.supplyPositive) positives.push("수급");
  if (valuation.score >= 10) positives.push("밸류에이션");
  if (target.score >= 5) positives.push("목표여력");
  if (flags.earningsGrowthPositive) positives.push("실적 성장");

  if (flags.nearHigh52w) cautions.push("52주 고가 근접");
  if (flags.valuationBurden) cautions.push("PER/PBR 부담");
  if (flags.targetAlmostReached) cautions.push("목표가 근접");
  if (flags.volatilityHigh) cautions.push("변동성 확대");
  if (risk.score <= 4) cautions.push("리스크");
  if (target.score <= 2) cautions.push("목표여력 부족");

  if (earningsGrowth.maxScore === 0) {
    cautions.push("실적 성장 데이터 대기");
  }

  if (positives.length > 0 && cautions.length > 0) {
    return `${positives.join(", ")}은 긍정적이나 ${cautions.join(
      ", ",
    )} 요인이 있어 ${action}이 적절합니다.`;
  }

  if (positives.length > 0) {
    return `${positives.join(
      ", ",
    )} 흐름이 긍정적입니다. 퀀트 등급은 ${grade}이며 ${action}이 적절합니다.`;
  }

  if (cautions.length > 0) {
    return `${cautions.join(", ")} 요인이 있어 ${action}이 적절합니다.`;
  }

  return `퀀트 점수는 ${total}점으로 ${grade}입니다. ${action}이 적절합니다.`;
}

function calculateQuantTotal(parts: QuantScorePart[]) {
  const activeParts = parts.filter((part) => part.maxScore > 0);

  if (!activeParts.length) return 0;

  const scoreSum = activeParts.reduce((sum, part) => sum + part.score, 0);
  const maxScoreSum = activeParts.reduce((sum, part) => sum + part.maxScore, 0);

  if (maxScoreSum <= 0) return 0;

  return clampScore((scoreSum / maxScoreSum) * 100);
}

function getQuantGrade(score: number) {
  if (score >= 80) return "강한 긍정";
  if (score >= 65) return "긍정";
  if (score >= 50) return "중립";
  if (score >= 35) return "주의";
  return "위험";
}

function getQuantAction(score: number, flags: QuantModelResult["flags"]) {
  if (
    score >= 75 &&
    !flags.nearHigh52w &&
    !flags.targetAlmostReached &&
    !flags.volatilityHigh
  ) {
    return "관심 확대";
  }

  if (score >= 65) {
    if (
      flags.nearHigh52w ||
      flags.targetAlmostReached ||
      flags.valuationBurden ||
      flags.volatilityHigh
    ) {
      return "추격보다 눌림 확인";
    }

    return "관심 유지";
  }

  if (score >= 50) {
    return "관찰";
  }

  if (score >= 35) {
    return "보수적 관찰";
  }

  return "위험 관리 우선";
}

function getPartLabel(score: number, maxScore: number) {
  const ratio = maxScore > 0 ? score / maxScore : 0;

  if (ratio >= 0.8) return "강함";
  if (ratio >= 0.65) return "긍정";
  if (ratio >= 0.5) return "중립";
  if (ratio >= 0.35) return "약함";
  return "주의";
}

function calculateReturn(rows: QuantChartRow[], period: number) {
  if (rows.length <= period) return null;

  const latest = rows[rows.length - 1]?.close;
  const past = rows[rows.length - 1 - period]?.close;

  if (
    latest == null ||
    past == null ||
    !Number.isFinite(latest) ||
    !Number.isFinite(past) ||
    past <= 0
  ) {
    return null;
  }

  return ((latest - past) / past) * 100;
}

function calculateAverageTradingValue(rows: QuantChartRow[], period: number) {
  const targetRows = rows
    .slice(-period)
    .filter(
      (row) =>
        row.close != null &&
        row.volume != null &&
        Number.isFinite(row.close) &&
        Number.isFinite(row.volume) &&
        row.close > 0 &&
        row.volume >= 0,
    );

  if (!targetRows.length) return null;

  const total = targetRows.reduce((sum, row) => {
    return sum + Number(row.close) * Number(row.volume);
  }, 0);

  return total / targetRows.length;
}

function calculateDailyReturns(rows: QuantChartRow[], period: number) {
  const targetRows = rows.slice(-(period + 1));
  const returns: number[] = [];

  for (let i = 1; i < targetRows.length; i += 1) {
    const previous = targetRows[i - 1]?.close;
    const current = targetRows[i]?.close;

    if (
      previous == null ||
      current == null ||
      !Number.isFinite(previous) ||
      !Number.isFinite(current) ||
      previous <= 0
    ) {
      continue;
    }

    returns.push(((current - previous) / previous) * 100);
  }

  return returns;
}

function calculateStandardDeviation(values: number[]) {
  if (!values.length) return 0;

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length;

  return Math.sqrt(variance);
}

function calculateSmaSlope(
  rows: QuantChartRow[],
  key: "sma20" | "sma60",
  period: number,
) {
  if (rows.length <= period) return null;

  const latest = rows[rows.length - 1]?.[key];
  const past = rows[rows.length - 1 - period]?.[key];

  if (
    latest == null ||
    past == null ||
    !Number.isFinite(latest) ||
    !Number.isFinite(past) ||
    past <= 0
  ) {
    return null;
  }

  return ((latest - past) / past) * 100;
}

function hasHigherRecentLows(rows: QuantChartRow[]) {
  const closes = rows
    .slice(-15)
    .map((row) => row.close)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (closes.length < 10) return false;

  const firstHalfLow = Math.min(...closes.slice(0, Math.floor(closes.length / 2)));
  const secondHalfLow = Math.min(...closes.slice(Math.floor(closes.length / 2)));

  return secondHalfLow > firstHalfLow;
}

function sortRowsByDate(rows: QuantChartRow[]) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;

    return aTime - bTime;
  });
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function clampPartScore(score: number, maxScore: number) {
  return Math.max(0, Math.min(maxScore, Math.round(score)));
}

function makeUnavailableQuantResult(): QuantModelResult {
  const emptyPart = {
    score: 0,
    maxScore: 0,
    label: "데이터 대기",
    reasons: ["계산할 데이터가 부족합니다."],
  };

  return {
    available: false,
    total: null,
    grade: "데이터 대기",
    action: "데이터 확인",
    summary: "퀀트 모델을 계산할 데이터가 부족합니다.",
    momentum: emptyPart,
    trend: emptyPart,
    tradingValue: emptyPart,
    valuation: emptyPart,
    supply: emptyPart,
    volatility: emptyPart,
    risk: emptyPart,
    target: emptyPart,
    earningsGrowth: emptyPart,
    flags: {
      nearHigh52w: false,
      valuationBurden: false,
      targetAlmostReached: false,
      supplyPositive: false,
      momentumPositive: false,
      trendPositive: false,
      tradingValuePositive: false,
      volatilityHigh: false,
      earningsGrowthPositive: false,
    },
  };
}

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
  valuation: QuantScorePart;
  supply: QuantScorePart;
  risk: QuantScorePart;
  target: QuantScorePart;
  flags: {
    nearHigh52w: boolean;
    valuationBurden: boolean;
    targetAlmostReached: boolean;
    supplyPositive: boolean;
    momentumPositive: boolean;
  };
};

export function calculateQuantModel({
  rows,
  supply,
  fundamentals,
  targetRange,
}: {
  rows: QuantChartRow[];
  supply?: QuantSupplyData;
  fundamentals?: QuantFundamentals;
  targetRange?: QuantTargetPriceRange | null;
}): QuantModelResult {
  const sortedRows = sortRowsByDate(rows);
  const latest = sortedRows.length ? sortedRows[sortedRows.length - 1] : null;
  const previous = sortedRows.length >= 2 ? sortedRows[sortedRows.length - 2] : null;

  if (!latest || latest.close == null) {
    return makeUnavailableQuantResult();
  }

  const momentum = calculateMomentumPart(sortedRows, latest);
  const valuation = calculateValuationPart(fundamentals);
  const supplyPart = calculateSupplyPart(supply, fundamentals);
  const risk = calculateRiskPart({
    latest,
    previous,
    fundamentals,
    targetRange,
  });
  const target = calculateTargetPart(targetRange);

  const rawTotal =
    momentum.score +
    valuation.score +
    supplyPart.score +
    risk.score +
    target.score;

  const total = clampScore(rawTotal);
  const flags = makeQuantFlags({
    latest,
    fundamentals,
    targetRange,
    momentum,
    valuation,
    supply: supplyPart,
  });

  const grade = getQuantGrade(total);
  const action = getQuantAction(total, flags);
  const summary = makeQuantSummary({
    total,
    grade,
    action,
    flags,
    momentum,
    valuation,
    supply: supplyPart,
    risk,
    target,
  });

  return {
    available: true,
    total,
    grade,
    action,
    summary,
    momentum,
    valuation,
    supply: supplyPart,
    risk,
    target,
    flags,
  };
}

function calculateMomentumPart(rows: QuantChartRow[], latest: QuantChartRow): QuantScorePart {
  let score = 0;
  const reasons: string[] = [];

  if (latest.close != null && latest.sma20 != null) {
    if (latest.close > latest.sma20) {
      score += 8;
      reasons.push("현재가가 SMA20 위에 있어 단기 모멘텀이 긍정적입니다.");
    } else {
      reasons.push("현재가가 SMA20 아래에 있어 단기 모멘텀 확인이 필요합니다.");
    }
  } else {
    reasons.push("SMA20 비교 데이터가 부족합니다.");
  }

  if (latest.sma20 != null && latest.sma60 != null) {
    if (latest.sma20 > latest.sma60) {
      score += 7;
      reasons.push("SMA20이 SMA60 위에 있어 중기 추세가 긍정적입니다.");
    } else {
      reasons.push("SMA20이 SMA60 아래에 있어 중기 추세가 약합니다.");
    }
  } else {
    reasons.push("SMA20/SMA60 비교 데이터가 부족합니다.");
  }

  if (latest.macd != null && latest.signal != null) {
    if (latest.macd > latest.signal) {
      score += 5;
      reasons.push("MACD가 Signal 위에 있습니다.");
    } else {
      reasons.push("MACD가 Signal 아래에 있습니다.");
    }
  } else {
    reasons.push("MACD 데이터가 부족합니다.");
  }

  if (latest.rsi14 != null) {
    if (latest.rsi14 >= 45 && latest.rsi14 <= 70) {
      score += 5;
      reasons.push("RSI가 모멘텀 확인에 적절한 구간입니다.");
    } else if (latest.rsi14 > 70 && latest.rsi14 < 75) {
      score += 2;
      reasons.push("RSI가 강하지만 과열에 가까워지고 있습니다.");
    } else if (latest.rsi14 >= 75) {
      score -= 5;
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
      score += 2;
      reasons.push("최근 5거래일 수익률이 강합니다.");
    } else if (recentReturn < -5) {
      score -= 2;
      reasons.push("최근 5거래일 수익률이 약합니다.");
    }
  }

  const finalScore = clampPartScore(score, 25);

  return {
    score: finalScore,
    maxScore: 25,
    label: getPartLabel(finalScore, 25),
    reasons,
  };
}

function calculateValuationPart(fundamentals?: QuantFundamentals): QuantScorePart {
  let score = 0;
  const reasons: string[] = [];

  const per = fundamentals?.per ?? null;
  const pbr = fundamentals?.pbr ?? null;
  const eps = fundamentals?.eps ?? null;
  const bps = fundamentals?.bps ?? null;

  if (per != null && Number.isFinite(per) && per > 0) {
    if (per <= 10) {
      score += 10;
      reasons.push("PER이 낮아 밸류에이션 부담이 작습니다.");
    } else if (per <= 20) {
      score += 8;
      reasons.push("PER이 보통 수준입니다.");
    } else if (per <= 30) {
      score += 5;
      reasons.push("PER이 다소 높아 밸류에이션 확인이 필요합니다.");
    } else if (per <= 40) {
      score += 2;
      reasons.push("PER이 높은 편이라 밸류에이션 부담이 있습니다.");
    } else {
      reasons.push("PER이 매우 높아 밸류에이션 부담이 큽니다.");
    }
  } else {
    score += 3;
    reasons.push("PER 데이터가 없어 중립보다 낮게 반영했습니다.");
  }

  if (pbr != null && Number.isFinite(pbr) && pbr > 0) {
    if (pbr <= 1) {
      score += 8;
      reasons.push("PBR이 낮아 자산가치 대비 부담이 작습니다.");
    } else if (pbr <= 2) {
      score += 6;
      reasons.push("PBR이 보통 수준입니다.");
    } else if (pbr <= 3) {
      score += 4;
      reasons.push("PBR이 다소 높습니다.");
    } else if (pbr <= 5) {
      score += 2;
      reasons.push("PBR이 높은 편입니다.");
    } else {
      reasons.push("PBR이 매우 높아 자산가치 대비 부담이 큽니다.");
    }
  } else {
    score += 2;
    reasons.push("PBR 데이터가 없어 중립보다 낮게 반영했습니다.");
  }

  if (eps != null && eps > 0) {
    score += 4;
    reasons.push("EPS가 양수입니다.");
  } else if (eps != null && eps <= 0) {
    score -= 3;
    reasons.push("EPS가 양수가 아닙니다.");
  } else {
    reasons.push("EPS 데이터가 없습니다.");
  }

  if (bps != null && bps > 0) {
    score += 3;
    reasons.push("BPS가 양수입니다.");
  } else {
    reasons.push("BPS 데이터가 없습니다.");
  }

  const finalScore = clampPartScore(score, 25);

  return {
    score: finalScore,
    maxScore: 25,
    label: getPartLabel(finalScore, 25),
    reasons,
  };
}

function calculateSupplyPart(
  supply?: QuantSupplyData,
  fundamentals?: QuantFundamentals
): QuantScorePart {
  let score = 0;
  const reasons: string[] = [];

  if (!supply?.available) {
    return {
      score: 8,
      maxScore: 20,
      label: "데이터 대기",
      reasons: ["수급 데이터가 없어 보수적으로 반영했습니다."],
    };
  }

  const recent5Smart = supply.recent5?.smartMoneyNetBuy ?? 0;
  const recent20Smart = supply.recent20?.smartMoneyNetBuy ?? 0;
  const foreign5 = supply.recent5?.foreignNetBuy ?? 0;
  const institution5 = supply.recent5?.institutionNetBuy ?? 0;

  if (recent5Smart > 0) {
    score += 5;
    reasons.push("최근 5일 외국인+기관 합산 수급이 양수입니다.");
  } else if (recent5Smart < 0) {
    reasons.push("최근 5일 외국인+기관 합산 수급이 음수입니다.");
  } else {
    score += 2;
    reasons.push("최근 5일 외국인+기관 합산 수급이 보합입니다.");
  }

  if (recent20Smart > 0) {
    score += 5;
    reasons.push("최근 20일 외국인+기관 합산 수급이 양수입니다.");
  } else if (recent20Smart < 0) {
    reasons.push("최근 20일 외국인+기관 합산 수급이 음수입니다.");
  } else {
    score += 2;
    reasons.push("최근 20일 외국인+기관 합산 수급이 보합입니다.");
  }

  if (foreign5 > 0) {
    score += 3;
    reasons.push("최근 5일 외국인 순매수가 양수입니다.");
  }

  if (institution5 > 0) {
    score += 3;
    reasons.push("최근 5일 기관 순매수가 양수입니다.");
  }

  if (supply.smartMoneyPositiveStreak5) {
    score += 2;
    reasons.push("최근 5일 연속 외국인+기관 합산 순매수가 양수입니다.");
  }

  const foreignOwnershipRate = fundamentals?.foreignOwnershipRate ?? null;

  if (foreignOwnershipRate != null) {
    if (foreignOwnershipRate >= 40) {
      score += 2;
      reasons.push("외국인 보유율이 높은 편입니다.");
    } else if (foreignOwnershipRate >= 20) {
      score += 1;
      reasons.push("외국인 보유율이 보통 이상입니다.");
    } else {
      reasons.push("외국인 보유율은 높지 않습니다.");
    }
  }

  const finalScore = clampPartScore(score, 20);

  return {
    score: finalScore,
    maxScore: 20,
    label: getPartLabel(finalScore, 20),
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
  let score = 15;
  const reasons: string[] = [];

  const currentPrice = latest.close ?? null;
  const high52w = fundamentals?.high52w ?? null;
  const low52w = fundamentals?.low52w ?? null;

  if (currentPrice != null && high52w != null && high52w > 0) {
    const highRatio = currentPrice / high52w;

    if (highRatio >= 0.98) {
      score -= 6;
      reasons.push("현재가가 52주 고가에 매우 근접해 추격 위험이 있습니다.");
    } else if (highRatio >= 0.9) {
      score -= 3;
      reasons.push("현재가가 52주 고가권에 있습니다.");
    } else {
      reasons.push("현재가가 52주 고가와 충분한 거리가 있습니다.");
    }
  } else {
    reasons.push("52주 고가 비교 데이터가 부족합니다.");
  }

  if (currentPrice != null && low52w != null && high52w != null && high52w > low52w) {
    const rangePosition = (currentPrice - low52w) / (high52w - low52w);

    if (rangePosition >= 0.85) {
      score -= 2;
      reasons.push("52주 가격 범위에서 상단권입니다.");
    } else if (rangePosition <= 0.25) {
      score += 1;
      reasons.push("52주 가격 범위에서 하단권입니다.");
    }
  }

  if (targetRange?.riskDownsidePercent != null) {
    if (targetRange.riskDownsidePercent > -3) {
      score -= 3;
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

  const finalScore = clampPartScore(score, 15);

  return {
    score: finalScore,
    maxScore: 15,
    label: getPartLabel(finalScore, 15),
    reasons,
  };
}

function calculateTargetPart(targetRange?: QuantTargetPriceRange | null): QuantScorePart {
  if (!targetRange) {
    return {
      score: 6,
      maxScore: 15,
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
    score += 15;
    reasons.push("기준 목표가 대비 상승 여력이 큽니다.");
  } else if (upside >= 8) {
    score += 12;
    reasons.push("기준 목표가 대비 상승 여력이 양호합니다.");
  } else if (upside >= 5) {
    score += 9;
    reasons.push("기준 목표가 대비 상승 여력이 보통입니다.");
  } else if (upside >= 2) {
    score += 6;
    reasons.push("기준 목표가 대비 상승 여력이 작습니다.");
  } else if (upside > 0) {
    score += 3;
    reasons.push("기준 목표가 대비 상승 여력이 매우 작습니다.");
  } else {
    reasons.push("현재가가 기준 목표가 이상이어서 목표여력은 낮습니다.");
  }

  if (targetProgress != null && targetProgress >= 97) {
    score -= 2;
    reasons.push("목표 도달률이 높아 추격 주의가 필요합니다.");
  }

  const finalScore = clampPartScore(score, 15);

  return {
    score: finalScore,
    maxScore: 15,
    label: getPartLabel(finalScore, 15),
    reasons,
  };
}

function makeQuantFlags({
  latest,
  fundamentals,
  targetRange,
  momentum,
  valuation,
  supply,
}: {
  latest: QuantChartRow;
  fundamentals?: QuantFundamentals;
  targetRange?: QuantTargetPriceRange | null;
  momentum: QuantScorePart;
  valuation: QuantScorePart;
  supply: QuantScorePart;
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
      valuation.score <= 8,
    targetAlmostReached:
      targetProgress != null && targetProgress >= 97,
    supplyPositive: supply.score >= 14,
    momentumPositive: momentum.score >= 17,
  };
}

function makeQuantSummary({
  total,
  grade,
  action,
  flags,
  momentum,
  valuation,
  supply,
  risk,
  target,
}: {
  total: number;
  grade: string;
  action: string;
  flags: QuantModelResult["flags"];
  momentum: QuantScorePart;
  valuation: QuantScorePart;
  supply: QuantScorePart;
  risk: QuantScorePart;
  target: QuantScorePart;
}) {
  const positives: string[] = [];
  const cautions: string[] = [];

  if (flags.momentumPositive) positives.push("모멘텀");
  if (flags.supplyPositive) positives.push("수급");
  if (valuation.score >= 16) positives.push("밸류에이션");
  if (target.score >= 10) positives.push("목표여력");

  if (flags.nearHigh52w) cautions.push("52주 고가 근접");
  if (flags.valuationBurden) cautions.push("PER/PBR 부담");
  if (flags.targetAlmostReached) cautions.push("목표가 근접");
  if (risk.score <= 7) cautions.push("리스크");
  if (target.score <= 5) cautions.push("목표여력 부족");

  if (positives.length > 0 && cautions.length > 0) {
    return `${positives.join(", ")}은 긍정적이나 ${cautions.join(
      ", "
    )} 요인이 있어 ${action}이 적절합니다.`;
  }

  if (positives.length > 0) {
    return `${positives.join(", ")} 흐름이 긍정적입니다. 퀀트 등급은 ${grade}이며 ${action}이 적절합니다.`;
  }

  if (cautions.length > 0) {
    return `${cautions.join(", ")} 요인이 커서 ${action}이 적절합니다.`;
  }

  return `퀀트 점수는 ${total}점으로 ${grade}입니다. ${action}이 적절합니다.`;
}

function getQuantGrade(score: number) {
  if (score >= 80) return "강한 긍정";
  if (score >= 65) return "긍정";
  if (score >= 50) return "중립";
  if (score >= 35) return "주의";
  return "위험";
}

function getQuantAction(score: number, flags: QuantModelResult["flags"]) {
  if (score >= 75 && !flags.nearHigh52w && !flags.targetAlmostReached) {
    return "관심 확대";
  }

  if (score >= 65) {
    if (flags.nearHigh52w || flags.targetAlmostReached || flags.valuationBurden) {
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
    valuation: emptyPart,
    supply: emptyPart,
    risk: emptyPart,
    target: emptyPart,
    flags: {
      nearHigh52w: false,
      valuationBurden: false,
      targetAlmostReached: false,
      supplyPositive: false,
      momentumPositive: false,
    },
  };
}
export type ScoreChartRow = {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
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

export type ScoreSupplySummary = {
  individualNetBuy: number;
  foreignNetBuy: number;
  institutionNetBuy: number;
  smartMoneyNetBuy: number;
};

export type ScoreSupplyData = {
  available: boolean;
  recent5?: ScoreSupplySummary;
  recent20?: ScoreSupplySummary;
  foreignPositiveStreak5?: boolean;
  institutionPositiveStreak5?: boolean;
  smartMoneyPositiveStreak5?: boolean;
};

export type ScoreFundamentalsData = {
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

export type ScoreQuantData = {
  available: boolean;
  total: number | null;
  grade: string;
  action: string;
  flags?: {
    nearHigh52w?: boolean;
    valuationBurden?: boolean;
    targetAlmostReached?: boolean;
    supplyPositive?: boolean;
    momentumPositive?: boolean;
    trendPositive?: boolean;
    tradingValuePositive?: boolean;
    volatilityHigh?: boolean;
  };
};

export type ScoreEarningsGrowthData = {
  available: boolean;
  excluded?: boolean;
  score: number | null;
  label: string;
  source?: string;
  reasons?: string[];
};

export type TargetMode = "conservative" | "base" | "aggressive";

export type ScoreWeights = {
  technical: number;
  volume: number;
  supply: number;
  targetPrice: number;
  signalAgreement: number;
  earningsGrowth: number;
};

export type ScoreWeightAdjustment = {
  key: keyof ScoreWeights;
  label: string;
  baseWeight: number;
  appliedWeight: number | null;
  adjustmentPercent: number | null;
  status: "applied" | "excluded";
  reason: string;
};

export type ScorePart = {
  available: boolean;
  score: number | null;
  label: string;
  reasons: string[];
};

export type TargetPriceRange = {
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

export type TargetBasisCandidate = {
  label: string;
  value: number;
  weight: number;
};

export type TargetBasis = {
  method: string;
  summary: string;
  candidates: TargetBasisCandidate[];
  adjustments: string[];
};

export type ValuationTargetRange = {
  epsTarget: number | null;
  bpsTarget: number | null;
  valuationTarget: number | null;
  perAdjustment: number | null;
  pbrAdjustment: number | null;
  method: string;
  reasons: string[];
};

export type QuantTargetAdjustment = {
  mode: TargetMode;
  baseAdjustmentPercent: number;
  riskAdjustmentPercent: number;
  positiveAdjustmentPercent: number;
  totalAdjustmentPercent: number;
  reasons: string[];
};

export type TargetModeResult = {
  mode: TargetMode;
  label: string;
  technicalWeight: number;
  valuationWeight: number;
  preAdjustmentTarget: number;
  finalTarget: number;
  upsidePercent: number;
  quantAdjustment: QuantTargetAdjustment;
};

export type TargetPriceScore = ScorePart & {
  technicalTargetRange: TargetPriceRange | null;
  targetBasis: TargetBasis | null;
  supplyAdjustedTarget: number | null;
  consensusTarget: null;
  riskLine: number | null;

  valuationTargetRange: ValuationTargetRange | null;
  finalTargetRange: TargetPriceRange | null;
  selectedTargetMode: TargetMode;
  targetModes: TargetModeResult[];
};

export type CompositeScore = {
  total: number | null;
  grade: string;
  comment: string;
  technical: ScorePart;
  volume: ScorePart;
  supply: ScorePart;
  targetPrice: TargetPriceScore;
  signalAgreement: ScorePart;
  earningsGrowth: ScorePart;
  baseWeights: ScoreWeights;
  appliedWeights: Partial<ScoreWeights>;
  weightAdjustments: ScoreWeightAdjustment[];
  targetPricePlan: {
    status: string;
    nextSteps: string[];
  };
};

type TechnicalTargetResult = {
  range: TargetPriceRange;
  basis: TargetBasis;
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  technical: 0.23,
  volume: 0.14,
  supply: 0.23,
  targetPrice: 0.14,
  signalAgreement: 0.16,
  earningsGrowth: 0.1,
};

export const DEFAULT_TARGET_MODE: TargetMode = "conservative";

export function calculateCompositeScore({
  rows,
  supply,
  fundamentals,
  quant,
  earningsGrowth,
  targetMode = DEFAULT_TARGET_MODE,
  weights = DEFAULT_SCORE_WEIGHTS,
}: {
  rows: ScoreChartRow[];
  supply?: ScoreSupplyData;
  fundamentals?: ScoreFundamentalsData;
  quant?: ScoreQuantData;
  earningsGrowth?: ScoreEarningsGrowthData;
  targetMode?: TargetMode;
  weights?: ScoreWeights;
}): CompositeScore {
  const sortedRows = sortRowsByDate(rows);

  const technical = calculateTechnicalScore(sortedRows);
  const volume = calculateVolumeScore(sortedRows);
  const supplyScore = applyKisSupplyAdjustment(calculateSupplyScore(supply), supply);
  const targetPrice = calculateTargetPriceScore(
    sortedRows,
    technical,
    volume,
    supplyScore,
    fundamentals,
    quant,
    targetMode,
  );

  const signalAgreement = calculateSignalAgreementScore({
    technical,
    volume,
    supply: supplyScore,
    targetPrice,
    quant,
  });

  const earningsGrowthScore = calculateEarningsGrowthScore(earningsGrowth);

  const parts = {
    technical,
    volume,
    supply: supplyScore,
    targetPrice,
    signalAgreement,
    earningsGrowth: earningsGrowthScore,
  };

  const appliedWeights = normalizeAvailableWeights(weights, parts);
  const weightAdjustments = makeScoreWeightAdjustments(weights, appliedWeights, parts);
  const total = calculateWeightedTotal(parts, appliedWeights);
  const grade = getScoreGrade(total);

  const comment = makeScoreComment({
    total,
    technical,
    volume,
    supply: supplyScore,
    targetPrice,
    signalAgreement,
    earningsGrowth: earningsGrowthScore,
  });

  return {
    total,
    grade,
    comment,
    technical,
    volume,
    supply: supplyScore,
    targetPrice,
    signalAgreement,
    earningsGrowth: earningsGrowthScore,
    baseWeights: weights,
    appliedWeights,
    weightAdjustments,
    targetPricePlan: {
      status: targetPrice.available
        ? "기술 추정 주가, 밸류에이션 추정 주가, 퀀트 보정, 신호 일치도를 반영한 최종 추정 주가를 계산했습니다."
        : "추정 주가 자동 산정은 데이터가 충분할 때 표시됩니다.",
      nextSteps: [
        "보수적·기본·공격적 추정 주가 모드 화면 선택 연결",
        "업종 평균 PER/PBR 확보 시 밸류에이션 보정 고도화",
        "예상 순이익·영업이익·EPS 성장률 데이터 연결",
        "컨센서스 추정 주가 데이터 확보 시 반영",
        "분석 기록 저장 후 추정 주가 적중률 평가",
        "시장 상황 지표를 연결해 자동 모드 추천",
      ],
    },
  };
}

export function calculateTechnicalScore(rows: ScoreChartRow[]): ScorePart {
  const sortedRows = sortRowsByDate(rows);
  const latest = getLatestRow(sortedRows);

  if (!latest) {
    return {
      available: false,
      score: null,
      label: "데이터 대기",
      reasons: ["차트 데이터가 없습니다."],
    };
  }

  let score = 0;
  const reasons: string[] = [];

  if (latest.macd != null && latest.signal != null) {
    if (latest.macd > latest.signal) {
      score += 28;
      reasons.push("MACD가 Signal 위에 있어 기술 흐름이 긍정적입니다.");
    } else {
      reasons.push("MACD가 Signal 아래에 있어 기술 흐름 확인이 필요합니다.");
    }
  } else {
    reasons.push("MACD 데이터가 부족합니다.");
  }

  if (latest.rsi14 != null) {
    if (latest.rsi14 >= 30 && latest.rsi14 <= 60) {
      score += 24;
      reasons.push("RSI14가 과열이 아닌 안정 구간입니다.");
    } else if (latest.rsi14 > 60 && latest.rsi14 <= 70) {
      score += 16;
      reasons.push("RSI14가 강한 구간이나 과열 접근 여부를 확인해야 합니다.");
    } else if (latest.rsi14 < 30) {
      score += 10;
      reasons.push("RSI14가 과매도권으로 반등 가능성은 있으나 확인이 필요합니다.");
    } else {
      reasons.push("RSI14가 과열권에 가까워 주의가 필요합니다.");
    }
  } else {
    reasons.push("RSI14 데이터가 부족합니다.");
  }

  if (latest.close != null && latest.sma20 != null) {
    if (latest.close > latest.sma20) {
      score += 18;
      reasons.push("현재가가 SMA20 위에 있습니다.");
    } else {
      reasons.push("현재가가 SMA20 아래에 있습니다.");
    }
  } else {
    reasons.push("SMA20 비교 데이터가 부족합니다.");
  }

  if (latest.close != null && latest.sma60 != null) {
    if (latest.close > latest.sma60) {
      score += 14;
      reasons.push("현재가가 SMA60 위에 있습니다.");
    } else {
      reasons.push("현재가가 SMA60 아래에 있습니다.");
    }
  } else {
    reasons.push("SMA60 비교 데이터가 부족합니다.");
  }

  if (
    latest.close != null &&
    latest.bbUpper != null &&
    latest.bbLower != null &&
    latest.bbUpper > latest.bbLower
  ) {
    const position = (latest.close - latest.bbLower) / (latest.bbUpper - latest.bbLower);

    if (position >= 0.4 && position <= 0.85) {
      score += 10;
      reasons.push("볼린저 밴드 기준 중앙~상단권에 있습니다.");
    } else if (position < 0.4) {
      score += 5;
      reasons.push("볼린저 밴드 기준 하단권입니다.");
    } else {
      reasons.push("볼린저 밴드 상단에 가까워 단기 과열 여부를 확인해야 합니다.");
    }
  } else {
    reasons.push("볼린저 밴드 데이터가 부족합니다.");
  }

  if (isSma20Rising(sortedRows)) {
    score += 6;
    reasons.push("최근 SMA20 기울기가 상승 방향입니다.");
  }

  const finalScore = clampScore(score);

  return {
    available: true,
    score: finalScore,
    label: getPartLabel(finalScore),
    reasons,
  };
}

export function calculateVolumeScore(rows: ScoreChartRow[]): ScorePart {
  const sortedRows = sortRowsByDate(rows);
  const latest = getLatestRow(sortedRows);
  const previous = sortedRows.length >= 2 ? sortedRows[sortedRows.length - 2] : null;

  if (!latest) {
    return {
      available: false,
      score: null,
      label: "데이터 대기",
      reasons: ["차트 데이터가 없습니다."],
    };
  }

  let score = 0;
  const reasons: string[] = [];

  const latestVolume = latest.volume ?? null;
  const avg5 = averageVolume(sortedRows.slice(-5));
  const avg20 = averageVolume(sortedRows.slice(-20));

  if (latestVolume != null && avg5 != null && avg5 > 0) {
    const ratio5 = latestVolume / avg5;

    if (ratio5 >= 1.5) {
      score += 30;
      reasons.push("최근 거래량이 5일 평균 대비 150% 이상입니다.");
    } else if (ratio5 >= 1.1) {
      score += 20;
      reasons.push("최근 거래량이 5일 평균보다 높습니다.");
    } else {
      score += 8;
      reasons.push("최근 거래량이 5일 평균 대비 강하지 않습니다.");
    }
  } else {
    reasons.push("5일 평균 거래량 비교 데이터가 부족합니다.");
  }

  if (latest.obv != null && previous?.obv != null) {
    if (latest.obv > previous.obv) {
      score += 25;
      reasons.push("OBV가 전일 대비 상승했습니다.");
    } else if (latest.obv === previous.obv) {
      score += 10;
      reasons.push("OBV가 보합입니다.");
    } else {
      reasons.push("OBV가 전일 대비 하락했습니다.");
    }
  } else {
    reasons.push("OBV 비교 데이터가 부족합니다.");
  }

  if (latestVolume != null && avg20 != null && avg20 > 0) {
    if (latestVolume > avg20) {
      score += 18;
      reasons.push("최근 거래량이 20일 평균보다 높습니다.");
    } else {
      score += 8;
      reasons.push("최근 거래량이 20일 평균보다 낮습니다.");
    }
  } else {
    reasons.push("20일 평균 거래량 비교 데이터가 부족합니다.");
  }

  const avgTradingValue5 = averageTradingValue(sortedRows, 5);
  const avgTradingValue20 = averageTradingValue(sortedRows, 20);

  if (avgTradingValue5 != null && avgTradingValue20 != null && avgTradingValue20 > 0) {
    const valueRatio = avgTradingValue5 / avgTradingValue20;

    if (valueRatio >= 1.5) {
      score += 18;
      reasons.push("최근 5일 평균 거래대금이 20일 평균보다 크게 증가했습니다.");
    } else if (valueRatio >= 1.1) {
      score += 12;
      reasons.push("최근 5일 평균 거래대금이 20일 평균보다 증가했습니다.");
    } else {
      score += 5;
      reasons.push("최근 거래대금 증가는 제한적입니다.");
    }
  } else {
    reasons.push("거래대금 비교 데이터가 부족합니다.");
  }

  if (
    latest.close != null &&
    previous?.close != null &&
    latest.close < previous.close &&
    latestVolume != null &&
    avg5 != null &&
    avg5 > 0 &&
    latestVolume / avg5 >= 1.5
  ) {
    score -= 15;
    reasons.push("하락일에 거래량이 크게 증가해 위험 보정이 적용되었습니다.");
  }

  const finalScore = clampScore(score);

  return {
    available: true,
    score: finalScore,
    label: getPartLabel(finalScore),
    reasons,
  };
}

export function calculateSupplyScore(supply?: ScoreSupplyData): ScorePart {
  if (!supply?.available) {
    return {
      available: false,
      score: null,
      label: "데이터 대기",
      reasons: ["수급 데이터가 없습니다."],
    };
  }

  let score = 0;
  const reasons: string[] = [];

  const recent5 = supply.recent5;
  const recent20 = supply.recent20;

  if (recent5) {
    if (recent5.smartMoneyNetBuy > 0) {
      score += 30;
      reasons.push("최근 5일 외국인+기관 합산 수급이 양수입니다.");
    } else if (recent5.smartMoneyNetBuy < 0) {
      reasons.push("최근 5일 외국인+기관 합산 수급이 음수입니다.");
    } else {
      score += 10;
      reasons.push("최근 5일 외국인+기관 합산 수급이 보합입니다.");
    }

    if (recent5.foreignNetBuy > 0) {
      score += 15;
      reasons.push("최근 5일 외국인 순매수가 양수입니다.");
    } else {
      reasons.push("최근 5일 외국인 순매수가 양수가 아닙니다.");
    }

    if (recent5.institutionNetBuy > 0) {
      score += 15;
      reasons.push("최근 5일 기관 순매수가 양수입니다.");
    } else {
      reasons.push("최근 5일 기관 순매수가 양수가 아닙니다.");
    }
  } else {
    reasons.push("최근 5일 수급 데이터가 부족합니다.");
  }

  if (recent20) {
    if (recent20.smartMoneyNetBuy > 0) {
      score += 30;
      reasons.push("최근 20일 외국인+기관 합산 수급이 양수입니다.");
    } else if (recent20.smartMoneyNetBuy < 0) {
      reasons.push("최근 20일 외국인+기관 합산 수급이 음수입니다.");
    } else {
      score += 10;
      reasons.push("최근 20일 외국인+기관 합산 수급이 보합입니다.");
    }
  } else {
    reasons.push("최근 20일 수급 데이터가 부족합니다.");
  }

  if (supply.smartMoneyPositiveStreak5) {
    score += 10;
    reasons.push("최근 5일 연속 외국인+기관 합산 순매수가 양수입니다.");
  } else {
    reasons.push("최근 5일 연속 외국인+기관 합산 순매수 조건은 충족하지 못했습니다.");
  }

  const finalScore = clampScore(score);

  return {
    available: true,
    score: finalScore,
    label: getPartLabel(finalScore),
    reasons,
  };
}

export function calculateTargetPriceScore(
  rows: ScoreChartRow[],
  technical: ScorePart,
  volume: ScorePart,
  supply: ScorePart,
  fundamentals?: ScoreFundamentalsData,
  quant?: ScoreQuantData,
  targetMode: TargetMode = DEFAULT_TARGET_MODE,
): TargetPriceScore {
  const sortedRows = sortRowsByDate(rows);
  const technicalResult = calculateTechnicalTargetRange(sortedRows, technical, volume, supply);

  if (!technicalResult) {
    return {
      available: false,
      score: null,
      label: "데이터 대기",
      reasons: [
        "추정 주가 참고 범위를 계산할 차트 데이터가 부족합니다.",
        "현재가, 최근 고점, 볼린저 밴드, 변동성 데이터가 필요합니다.",
      ],
      technicalTargetRange: null,
      targetBasis: null,
      supplyAdjustedTarget: null,
      consensusTarget: null,
      riskLine: null,
      valuationTargetRange: null,
      finalTargetRange: null,
      selectedTargetMode: targetMode,
      targetModes: [],
    };
  }

  const technicalRange = technicalResult.range;
  const technicalBasis = technicalResult.basis;
  const valuationTargetRange = calculateValuationTargetRange(
    technicalRange.currentPrice,
    fundamentals,
  );

  const targetModes = calculateTargetModeResults({
    technicalRange,
    valuationTargetRange,
    quant,
    technical,
    volume,
    supply,
    fundamentals,
  });

  const selectedModeResult =
    targetModes.find((modeResult) => modeResult.mode === targetMode) ??
    targetModes.find((modeResult) => modeResult.mode === DEFAULT_TARGET_MODE) ??
    targetModes[0];

  const finalTargetRange = selectedModeResult
    ? makeFinalTargetRange(technicalRange, selectedModeResult.finalTarget)
    : technicalRange;

  const basis = makeFinalTargetBasis({
    technicalBasis,
    valuationTargetRange,
    selectedModeResult,
    targetModes,
  });

  let score = scoreTargetUpside(finalTargetRange.baseUpsidePercent);
  const reasons: string[] = [];

  reasons.push(`최종 추정 주가 추정 상승 여력은 약 ${finalTargetRange.baseUpsidePercent.toFixed(1)}%입니다.`);
  reasons.push(`현재 추정 주가 모드는 ${getTargetModeLabel(targetMode)}입니다.`);

  const kisFundamentalsAdjustment = calculateKisFundamentalsAdjustment(fundamentals);

  score += kisFundamentalsAdjustment.scoreAdjustment;
  reasons.push(...kisFundamentalsAdjustment.reasons);

  if ((supply.score ?? 0) >= 80) {
    score += 5;
    reasons.push("수급 점수가 강해 추정 주가 신뢰도에 소폭 가산했습니다.");
  } else if (supply.available && (supply.score ?? 0) < 50) {
    score -= 10;
    reasons.push("수급 점수가 낮아 추정 주가 신뢰도에 감점을 적용했습니다.");
  }

  if ((volume.score ?? 0) >= 65) {
    score += 5;
    reasons.push("거래량·거래대금 점수가 긍정적이어서 추정 주가 신뢰도에 소폭 가산했습니다.");
  } else if (volume.available && (volume.score ?? 0) < 50) {
    score -= 10;
    reasons.push("거래량·거래대금 점수가 낮아 추정 주가 신뢰도에 감점을 적용했습니다.");
  }

  if (finalTargetRange.riskDownsidePercent > -3) {
    score -= 5;
    reasons.push("위험 기준선이 현재가와 가까워 변동성 주의 보정을 적용했습니다.");
  }

  if (valuationTargetRange?.valuationTarget != null) {
    reasons.push("EPS/BPS 기반 밸류에이션 추정 주가를 함께 반영했습니다.");
  } else {
    reasons.push("밸류에이션 추정 주가 데이터가 부족해 기술 추정 주가 중심으로 계산했습니다.");
  }

  if (selectedModeResult?.quantAdjustment.totalAdjustmentPercent) {
    reasons.push(
      `퀀트 보정 ${selectedModeResult.quantAdjustment.totalAdjustmentPercent.toFixed(1)}%가 최종 추정 주가에 반영되었습니다.`,
    );
  }

  const finalScore = clampScore(score);

  return {
    available: true,
    score: finalScore,
    label: getPartLabel(finalScore),
    reasons,
    technicalTargetRange: finalTargetRange,
    targetBasis: basis,
    supplyAdjustedTarget: finalTargetRange.aggressiveTarget,
    consensusTarget: null,
    riskLine: finalTargetRange.riskLine,
    valuationTargetRange,
    finalTargetRange,
    selectedTargetMode: targetMode,
    targetModes,
  };
}

function calculateSignalAgreementScore({
  technical,
  volume,
  supply,
  targetPrice,
  quant,
}: {
  technical: ScorePart;
  volume: ScorePart;
  supply: ScorePart;
  targetPrice: ScorePart;
  quant?: ScoreQuantData;
}): ScorePart {
  const reasons: string[] = [];
  const positiveSignals: string[] = [];
  const weakSignals: string[] = [];

  if (technical.available) {
    if ((technical.score ?? 0) >= 65) positiveSignals.push("기술");
    if ((technical.score ?? 0) < 50) weakSignals.push("기술");
  }

  if (volume.available) {
    if ((volume.score ?? 0) >= 65) positiveSignals.push("거래량·거래대금");
    if ((volume.score ?? 0) < 50) weakSignals.push("거래량·거래대금");
  }

  if (supply.available) {
    if ((supply.score ?? 0) >= 65) positiveSignals.push("수급");
    if ((supply.score ?? 0) < 50) weakSignals.push("수급");
  }

  if (targetPrice.available) {
    if ((targetPrice.score ?? 0) >= 65) positiveSignals.push("추정 괴리율");
    if ((targetPrice.score ?? 0) < 50) weakSignals.push("추정 괴리율");
  }

  if (quant?.available && quant.total != null) {
    if (quant.total >= 65) positiveSignals.push("퀀트");
    if (quant.total < 50) weakSignals.push("퀀트");
  }

  const availableCount =
    Number(technical.available) +
    Number(volume.available) +
    Number(supply.available) +
    Number(targetPrice.available) +
    Number(Boolean(quant?.available && quant.total != null));

  if (availableCount === 0) {
    return {
      available: false,
      score: null,
      label: "데이터 대기",
      reasons: ["신호 일치도를 계산할 데이터가 부족합니다."],
    };
  }

  let score = 50;

  score += positiveSignals.length * 10;
  score -= weakSignals.length * 9;

  if (positiveSignals.length >= 4) {
    score += 10;
    reasons.push("대부분의 신호가 같은 방향으로 긍정적입니다.");
  } else if (positiveSignals.length >= 3) {
    score += 5;
    reasons.push("주요 신호가 비교적 같은 방향으로 움직입니다.");
  }

  if (weakSignals.length >= 3) {
    score -= 15;
    reasons.push("여러 신호가 동시에 약해 신뢰도 감점이 필요합니다.");
  } else if (weakSignals.length >= 2) {
    score -= 8;
    reasons.push("일부 핵심 신호가 엇갈립니다.");
  }

  if (quant?.flags?.volatilityHigh) {
    score -= 8;
    reasons.push("퀀트 모델에서 변동성 확대 신호가 감지됐습니다.");
  }

  if (quant?.flags?.nearHigh52w || quant?.flags?.targetAlmostReached) {
    score -= 5;
    reasons.push("52주 고가 근접 또는 추정 주가 근접 신호가 있어 추격 주의가 필요합니다.");
  }

  if (quant?.flags?.tradingValuePositive) {
    score += 5;
    reasons.push("거래대금 흐름이 긍정적입니다.");
  }

  if (quant?.flags?.trendPositive) {
    score += 5;
    reasons.push("추세 지속성 신호가 긍정적입니다.");
  }

  if (quant?.flags?.supplyPositive) {
    score += 5;
    reasons.push("퀀트 모델에서도 수급 흐름이 긍정적입니다.");
  }

  if (positiveSignals.length > 0) {
    reasons.push(`${positiveSignals.join(", ")} 신호가 긍정적입니다.`);
  }

  if (weakSignals.length > 0) {
    reasons.push(`${weakSignals.join(", ")} 신호는 확인이 필요합니다.`);
  }

  const finalScore = clampScore(score);

  return {
    available: true,
    score: finalScore,
    label: getPartLabel(finalScore),
    reasons,
  };
}

export function calculateEarningsGrowthScore(
  earningsGrowth?: ScoreEarningsGrowthData | null,
): ScorePart {
  if (earningsGrowth?.excluded) {
    return {
      available: false,
      score: null,
      label: "제외",
      reasons: ["ETF/ETN/지수형 상품은 실적 성장 점수 가중치에서 제외했습니다."],
    };
  }

  if (!earningsGrowth?.available || earningsGrowth.score == null) {
    return {
      available: false,
      score: null,
      label: "데이터 대기",
      reasons: ["실적 성장 데이터가 없어 종합 신뢰도 가중치에서 제외했습니다."],
    };
  }

  const score = clampScore(earningsGrowth.score);

  return {
    available: true,
    score,
    label: earningsGrowth.label || getPartLabel(score),
    reasons:
      earningsGrowth.reasons && earningsGrowth.reasons.length > 0
        ? earningsGrowth.reasons
        : ["실적 성장 점수를 종합 신뢰도에 보조 반영했습니다."],
  };
}

const SCORE_WEIGHT_LABELS: Record<keyof ScoreWeights, string> = {
  technical: "기술",
  volume: "거래량·거래대금",
  supply: "수급",
  targetPrice: "추정 주가 여력",
  signalAgreement: "신호 일치도",
  earningsGrowth: "실적 성장",
};

function makeScoreWeightAdjustments(
  baseWeights: ScoreWeights,
  appliedWeights: Partial<ScoreWeights>,
  parts: {
    technical: ScorePart;
    volume: ScorePart;
    supply: ScorePart;
    targetPrice: ScorePart;
    signalAgreement: ScorePart;
    earningsGrowth: ScorePart;
  },
): ScoreWeightAdjustment[] {
  return (Object.keys(baseWeights) as Array<keyof ScoreWeights>).map((key) => {
    const part = parts[key];
    const baseWeight = baseWeights[key];
    const appliedWeight = appliedWeights[key] ?? null;
    const adjustmentPercent =
      appliedWeight == null
        ? null
        : Number(((appliedWeight - baseWeight) * 100).toFixed(1));

    return {
      key,
      label: SCORE_WEIGHT_LABELS[key],
      baseWeight,
      appliedWeight,
      adjustmentPercent,
      status: appliedWeight == null ? "excluded" : "applied",
      reason: makeWeightAdjustmentReason({
        key,
        part,
        baseWeight,
        appliedWeight,
        adjustmentPercent,
      }),
    };
  });
}

function makeWeightAdjustmentReason({
  key,
  part,
  baseWeight,
  appliedWeight,
  adjustmentPercent,
}: {
  key: keyof ScoreWeights;
  part: ScorePart;
  baseWeight: number;
  appliedWeight: number | null;
  adjustmentPercent: number | null;
}) {
  if (!part.available || part.score == null || appliedWeight == null) {
    if (key === "earningsGrowth") {
      return "실적 성장 데이터가 없어 해당 비중을 제외하고 나머지 지표에 재분배했습니다.";
    }

    if (key === "supply") {
      return "수급 데이터가 없어 해당 비중을 제외하고 나머지 지표에 재분배했습니다.";
    }

    if (key === "targetPrice") {
      return "추정 주가 산정 데이터가 부족해 해당 비중을 제외하고 계산했습니다.";
    }

    return "데이터가 부족해 해당 지표 비중을 제외했습니다.";
  }

  if (adjustmentPercent == null || Math.abs(adjustmentPercent) < 0.05) {
    return "기본 비중 그대로 반영했습니다.";
  }

  if (adjustmentPercent > 0) {
    return `다른 지표의 데이터 부족 또는 제외로 기본 ${formatWeightPercent(
      baseWeight,
    )}에서 ${formatWeightPercent(appliedWeight)}로 재분배 반영했습니다.`;
  }

  return `전체 사용 가능 지표 재분배 과정에서 기본 ${formatWeightPercent(
    baseWeight,
  )}에서 ${formatWeightPercent(appliedWeight)}로 낮아졌습니다.`;
}

function formatWeightPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function normalizeAvailableWeights(
  weights: ScoreWeights,
  parts: {
    technical: ScorePart;
    volume: ScorePart;
    supply: ScorePart;
    targetPrice: ScorePart;
    signalAgreement: ScorePart;
    earningsGrowth: ScorePart;
  },
): Partial<ScoreWeights> {
  const availableWeightEntries = Object.entries(weights).filter(([key]) => {
    const scoreKey = key as keyof ScoreWeights;
    return parts[scoreKey].available && parts[scoreKey].score != null;
  }) as Array<[keyof ScoreWeights, number]>;

  const totalAvailableWeight = availableWeightEntries.reduce(
    (sum, [, weight]) => sum + weight,
    0,
  );

  if (totalAvailableWeight <= 0) {
    return {};
  }

  return availableWeightEntries.reduce<Partial<ScoreWeights>>((acc, [key, weight]) => {
    acc[key] = weight / totalAvailableWeight;
    return acc;
  }, {});
}

function calculateTechnicalTargetRange(
  rows: ScoreChartRow[],
  technical: ScorePart,
  volume: ScorePart,
  supply: ScorePart,
): TechnicalTargetResult | null {
  const validRows = sortRowsByDate(rows).filter(
    (row) => typeof row.close === "number" && Number.isFinite(row.close),
  );

  if (validRows.length < 20) return null;

  const latest = validRows[validRows.length - 1];
  const currentPrice = latest.close;

  if (currentPrice == null || currentPrice <= 0) return null;

  const recentRows = validRows.slice(-60);
  const recentHighResult = getRecentHighClose(recentRows);

  if (!recentHighResult) return null;

  const closes = recentRows
    .map((row) => row.close)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (closes.length < 10) return null;

  const recentHigh = recentHighResult.value;
  const recentHighDate = recentHighResult.date;
  const recentLow = Math.min(...closes);
  const volatility = averageAbsoluteDailyChangePercent(recentRows);
  const bbUpper = latest.bbUpper ?? null;
  const bbLower = latest.bbLower ?? null;
  const sma20 = latest.sma20 ?? null;
  const sma60 = latest.sma60 ?? null;

  const volatilityUpper = currentPrice * (1 + Math.max(volatility * 1.8, 0.025));
  const volatilityAggressiveUpper = currentPrice * (1 + Math.max(volatility * 2.7, 0.04));

  const upsideCandidates = [recentHigh, bbUpper, volatilityUpper].filter(
    (value): value is number => {
      return typeof value === "number" && Number.isFinite(value) && value > currentPrice;
    },
  );

  const conservativeTarget =
    upsideCandidates.length > 0 ? Math.min(...upsideCandidates) : currentPrice * 1.02;

  const weightedResult = calculateWeightedBaseTarget({
    conservativeTarget,
    recentHigh,
    recentHighDate,
    bbUpper,
    volatilityUpper,
    currentPrice,
    technicalScore: technical.score,
    volumeScore: volume.score,
    supplyScore: supply.score,
  });

  const baseTargetRaw = Math.max(weightedResult.target, conservativeTarget);
  const strengthBonus = calculateTargetStrengthBonus(technical.score, volume.score, supply.score);

  const aggressiveTargetRaw = Math.max(
    baseTargetRaw * (1 + strengthBonus),
    volatilityAggressiveUpper,
    conservativeTarget,
  );

  const downsideCandidates = [recentLow, bbLower, sma20, sma60].filter(
    (value): value is number => {
      return typeof value === "number" && Number.isFinite(value) && value > 0 && value < currentPrice;
    },
  );

  const riskLineRaw =
    downsideCandidates.length > 0 ? Math.max(...downsideCandidates) : currentPrice * 0.95;

  const roundedConservative = roundPrice(conservativeTarget);
  const roundedBase = roundPrice(Math.max(baseTargetRaw, roundedConservative));
  const roundedAggressive = roundPrice(Math.max(aggressiveTargetRaw, roundedBase));
  const roundedRiskLine = roundPrice(Math.min(riskLineRaw, currentPrice * 0.995));

  return {
    range: {
      currentPrice: roundPrice(currentPrice),
      conservativeTarget: roundedConservative,
      baseTarget: roundedBase,
      aggressiveTarget: roundedAggressive,
      riskLine: roundedRiskLine,
      conservativeUpsidePercent: percentChange(roundedConservative, currentPrice),
      baseUpsidePercent: percentChange(roundedBase, currentPrice),
      aggressiveUpsidePercent: percentChange(roundedAggressive, currentPrice),
      riskDownsidePercent: percentChange(roundedRiskLine, currentPrice),
    },
    basis: weightedResult.basis,
  };
}

function calculateWeightedBaseTarget({
  conservativeTarget,
  recentHigh,
  recentHighDate,
  bbUpper,
  volatilityUpper,
  currentPrice,
  technicalScore,
  volumeScore,
  supplyScore,
}: {
  conservativeTarget: number;
  recentHigh: number;
  recentHighDate: string;
  bbUpper: number | null;
  volatilityUpper: number;
  currentPrice: number;
  technicalScore: number | null;
  volumeScore: number | null;
  supplyScore: number | null;
}): {
  target: number;
  basis: TargetBasis;
} {
  const candidates: TargetBasisCandidate[] = [
    {
      label: `최근 60일 종가 고점 (${recentHighDate})`,
      value: roundPrice(recentHigh),
      weight: 0.3,
    },
    {
      label: "보수적 기술 추정 주가",
      value: roundPrice(conservativeTarget),
      weight: 0.25,
    },
    {
      label: "변동성 상단 추정 주가",
      value: roundPrice(volatilityUpper),
      weight: 0.25,
    },
  ];

  if (bbUpper != null && bbUpper > currentPrice) {
    candidates.push({
      label: "볼린저밴드 상단",
      value: roundPrice(bbUpper),
      weight: 0.2,
    });
  } else {
    candidates.push({
      label: "볼린저밴드 대체 추정 주가",
      value: roundPrice(currentPrice * 1.03),
      weight: 0.2,
    });
  }

  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  const weightedTarget =
    candidates.reduce((sum, candidate) => sum + candidate.value * candidate.weight, 0) /
    totalWeight;

  const adjustments: string[] = [
    "기술 추정 주가는 최근 고점, 볼린저밴드, 변동성 상단을 가중 평균해 계산했습니다.",
  ];

  if ((technicalScore ?? 0) >= 70) {
    adjustments.push("기술 점수가 강해 기준 추정 주가 신뢰도를 높게 봅니다.");
  }

  if ((volumeScore ?? 0) >= 65) {
    adjustments.push("거래량·거래대금이 양호해 추정 주가 신뢰도에 긍정적입니다.");
  }

  if ((supplyScore ?? 0) >= 70) {
    adjustments.push("수급이 양호해 추정 주가 신뢰도에 긍정적입니다.");
  }

  return {
    target: roundPrice(weightedTarget),
    basis: {
      method: "기술 추정 주가 가중 평균",
      summary:
        "기술 추정 주가는 최근 고점, 볼린저밴드, 변동성 상단, 보수적 목표가를 가중 평균해 계산했습니다.",
      candidates,
      adjustments,
    },
  };
}

function calculateValuationTargetRange(
  currentPrice: number,
  fundamentals?: ScoreFundamentalsData,
): ValuationTargetRange | null {
  if (!fundamentals || currentPrice <= 0) {
    return null;
  }

  const per = fundamentals.per;
  const pbr = fundamentals.pbr;
  const eps = fundamentals.eps;
  const bps = fundamentals.bps;

  const reasons: string[] = [];
  const perAdjustment = getPerAdjustment(per);
  const pbrAdjustment = getPbrAdjustment(pbr);

  let epsTarget: number | null = null;
  let bpsTarget: number | null = null;

  if (eps != null && eps > 0 && per != null && per > 0 && perAdjustment != null) {
    epsTarget = roundPrice(eps * per * perAdjustment);
    reasons.push(`EPS \\u00d7 \\ud604\\uc7ac PER \\u00d7 PER \\ubcf4\\uc815\\uacc4\\uc218 ${perAdjustment.toFixed(2)}\\ub97c \\ubc18\\uc601\\ud588\\uc2b5\\ub2c8\\ub2e4.`);
  } else {
    reasons.push("\\u0045\\u0050\\u0053 \\ub610\\ub294 \\u0050\\u0045\\u0052 \\ub370\\uc774\\ud130\\uac00 \\ubd80\\uc871\\ud574 \\u0045\\u0050\\u0053 \\uae30\\uc900 \\ucd94\\uc815 \\uc8fc\\uac00\\ub294 \\uc81c\\uc678\\ud588\\uc2b5\\ub2c8\\ub2e4.");
  }

  if (bps != null && bps > 0 && pbr != null && pbr > 0 && pbrAdjustment != null) {
    bpsTarget = roundPrice(bps * pbr * pbrAdjustment);
    reasons.push(`BPS \\u00d7 \\ud604\\uc7ac PBR \\u00d7 PBR \\ubcf4\\uc815\\uacc4\\uc218 ${pbrAdjustment.toFixed(2)}\\ub97c \\ubc18\\uc601\\ud588\\uc2b5\\ub2c8\\ub2e4.`);
  } else {
    reasons.push("\\u0042\\u0050\\u0053 \\ub610\\ub294 \\u0050\\u0042\\u0052 \\ub370\\uc774\\ud130\\uac00 \\ubd80\\uc871\\ud574 \\u0042\\u0050\\u0053 \\uae30\\uc900 \\ucd94\\uc815 \\uc8fc\\uac00\\ub294 \\uc81c\\uc678\\ud588\\uc2b5\\ub2c8\\ub2e4.");
  }

  const targets = [epsTarget, bpsTarget].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
  );

  if (targets.length === 0) {
    return {
      epsTarget,
      bpsTarget,
      valuationTarget: null,
      perAdjustment,
      pbrAdjustment,
      method: "\\ubc38\\ub958\\uc5d0\\uc774\\uc158 \\ucd94\\uc815 \\uc8fc\\uac00 \\uacc4\\uc0b0 \\ub300\\uae30",
      reasons,
    };
  }

  const valuationTarget = roundPrice(
    targets.reduce((sum, value) => sum + value, 0) / targets.length,
  );

  const cappedValuationTarget = clampValuationTarget(valuationTarget, currentPrice);

  if (cappedValuationTarget !== valuationTarget) {
    reasons.push("\\ubc38\\ub958\\uc5d0\\uc774\\uc158 \\ucd94\\uc815 \\uc8fc\\uac00\\uac00 \\ud604\\uc7ac\\uac00 \\ub300\\ube44 \\uacfc\\ub3c4\\ud558\\uac8c \\ubc8c\\uc5b4\\uc9c0\\uc9c0 \\uc54a\\ub3c4\\ub85d \\uc548\\uc815\\ud654\\ud588\\uc2b5\\ub2c8\\ub2e4.");
  }

  return {
    epsTarget,
    bpsTarget,
    valuationTarget: cappedValuationTarget,
    perAdjustment,
    pbrAdjustment,
    method: "EPS/PER + BPS/PBR \\ubcf4\\uc815 \\ud3c9\\uade0",
    reasons,
  };
}

function calculateTargetModeResults({
  technicalRange,
  valuationTargetRange,
  quant,
  technical,
  volume,
  supply,
  fundamentals,
}: {
  technicalRange: TargetPriceRange;
  valuationTargetRange: ValuationTargetRange | null;
  quant?: ScoreQuantData;
  technical: ScorePart;
  volume: ScorePart;
  supply: ScorePart;
  fundamentals?: ScoreFundamentalsData;
}): TargetModeResult[] {
  const modes: Array<{
    mode: TargetMode;
    technicalWeight: number;
    valuationWeight: number;
  }> = [
    {
      mode: "conservative",
      technicalWeight: 0.45,
      valuationWeight: 0.55,
    },
    {
      mode: "base",
      technicalWeight: 0.6,
      valuationWeight: 0.4,
    },
    {
      mode: "aggressive",
      technicalWeight: 0.75,
      valuationWeight: 0.25,
    },
  ];

  return modes.map((modeConfig) => {
    const valuationTarget =
      valuationTargetRange?.valuationTarget != null
        ? valuationTargetRange.valuationTarget
        : technicalRange.baseTarget;

    const preAdjustmentTarget =
      technicalRange.baseTarget * modeConfig.technicalWeight +
      valuationTarget * modeConfig.valuationWeight;

    const quantAdjustment = calculateQuantTargetAdjustment({
      mode: modeConfig.mode,
      quant,
      technical,
      volume,
      supply,
      fundamentals,
      technicalRange,
      valuationTargetRange,
    });

    const finalTargetBeforeStabilize = roundPrice(
      preAdjustmentTarget * (1 + quantAdjustment.totalAdjustmentPercent / 100),
    );

    const finalTarget = stabilizeFinalTarget({
      mode: modeConfig.mode,
      finalTarget: finalTargetBeforeStabilize,
      currentPrice: technicalRange.currentPrice,
      technicalTarget: technicalRange.baseTarget,
      valuationTarget,
      quant,
    });

    return {
      mode: modeConfig.mode,
      label: getTargetModeLabel(modeConfig.mode),
      technicalWeight: modeConfig.technicalWeight,
      valuationWeight: modeConfig.valuationWeight,
      preAdjustmentTarget: roundPrice(preAdjustmentTarget),
      finalTarget,
      upsidePercent: percentChange(finalTarget, technicalRange.currentPrice),
      quantAdjustment,
    };
  });
}

function calculateQuantTargetAdjustment({
  mode,
  quant,
  technical,
  volume,
  supply,
  fundamentals,
  technicalRange,
  valuationTargetRange,
}: {
  mode: TargetMode;
  quant?: ScoreQuantData;
  technical: ScorePart;
  volume: ScorePart;
  supply: ScorePart;
  fundamentals?: ScoreFundamentalsData;
  technicalRange: TargetPriceRange;
  valuationTargetRange: ValuationTargetRange | null;
}): QuantTargetAdjustment {
  const reasons: string[] = [];

  let baseAdjustmentPercent = 0;
  let riskAdjustmentPercent = 0;
  let positiveAdjustmentPercent = 0;

  const quantTotal = quant?.total ?? null;

  if (quantTotal != null) {
    if (quantTotal >= 80) {
      baseAdjustmentPercent += 3;
      reasons.push("퀀트 점수가 80점 이상이라 기본 보정을 +3% 적용했습니다.");
    } else if (quantTotal >= 65) {
      baseAdjustmentPercent += 1;
      reasons.push("퀀트 점수가 65점 이상이라 기본 보정을 +1% 적용했습니다.");
    } else if (quantTotal >= 50) {
      reasons.push("퀀트 점수가 중립권이라 기본 보정은 0%입니다.");
    } else if (quantTotal >= 35) {
      baseAdjustmentPercent -= 3;
      reasons.push("퀀트 점수가 낮아 기본 보정을 -3% 적용했습니다.");
    } else {
      baseAdjustmentPercent -= 6;
      reasons.push("퀀트 점수가 위험권이라 기본 보정을 -6% 적용했습니다.");
    }
  } else {
    reasons.push("퀀트 점수 데이터가 없어 기본 보정은 0%입니다.");
  }

  const flags = quant?.flags ?? {};
  const currentPrice = technicalRange.currentPrice;
  const targetProgress =
    technicalRange.baseTarget > 0 ? (currentPrice / technicalRange.baseTarget) * 100 : null;

  const nearHigh52w =
    flags.nearHigh52w ||
    (fundamentals?.high52w != null &&
      fundamentals.high52w > 0 &&
      currentPrice / fundamentals.high52w >= 0.98);

  const valuationBurden =
    flags.valuationBurden ||
    (fundamentals?.per != null && fundamentals.per >= 35) ||
    (fundamentals?.pbr != null && fundamentals.pbr >= 3);

  const targetAlmostReached =
    flags.targetAlmostReached || (targetProgress != null && targetProgress >= 97);

  if (nearHigh52w) {
    riskAdjustmentPercent -= mode === "conservative" ? 3 : 2;
    reasons.push("52주 고가에 근접해 리스크 보정을 적용했습니다.");
  }

  if (targetAlmostReached) {
    riskAdjustmentPercent -= mode === "conservative" ? 3 : 2;
    reasons.push("기술 추정 주가에 이미 근접해 추정 주가 근접 보정을 적용했습니다.");
  }

  if (valuationBurden) {
    riskAdjustmentPercent -= mode === "conservative" ? 3 : 2;
    reasons.push("PER/PBR 부담으로 밸류에이션 리스크 보정을 적용했습니다.");
  }

  if (flags.volatilityHigh) {
    riskAdjustmentPercent -= mode === "conservative" ? 2 : 1;
    reasons.push("퀀트 변동성 확대 신호로 보수 보정을 적용했습니다.");
  }

  if (valuationTargetRange?.valuationTarget != null && valuationTargetRange.valuationTarget < currentPrice) {
    riskAdjustmentPercent -= mode === "conservative" ? 2 : 1;
    reasons.push("밸류에이션 추정 주가가 현재가보다 낮아 보수 보정을 적용했습니다.");
  }

  if ((supply.score ?? 0) >= 80 || flags.supplyPositive) {
    positiveAdjustmentPercent += mode === "aggressive" ? 2 : 1;
    reasons.push("수급이 긍정적이라 소폭 가산했습니다.");
  }

  if ((technical.score ?? 0) >= 70 || flags.momentumPositive || flags.trendPositive) {
    positiveAdjustmentPercent += mode === "aggressive" ? 2 : 1;
    reasons.push("모멘텀 또는 추세 지속성이 긍정적이라 소폭 가산했습니다.");
  }

  if ((volume.score ?? 0) >= 65 || flags.tradingValuePositive) {
    positiveAdjustmentPercent += mode === "aggressive" ? 1 : 0.5;
    reasons.push("거래량·거래대금 흐름이 긍정적이라 소폭 가산했습니다.");
  }

  if ((volume.score ?? 0) < 50) {
    riskAdjustmentPercent -= 1;
    reasons.push("거래량 점수가 낮아 추가 보수 보정을 적용했습니다.");
  }

  if (mode === "conservative") {
    baseAdjustmentPercent -= 1;
    reasons.push("보수적 모드는 기본적으로 -1% 안정화 보정을 적용합니다.");
  }

  if (mode === "aggressive" && (nearHigh52w || valuationBurden || targetAlmostReached || flags.volatilityHigh)) {
    riskAdjustmentPercent -= 2;
    reasons.push("공격적 모드라도 리스크 플래그가 있어 과도한 상향을 제한했습니다.");
  }

  const rawTotal = baseAdjustmentPercent + riskAdjustmentPercent + positiveAdjustmentPercent;
  const totalAdjustmentPercent = clampAdjustmentPercent(rawTotal, mode);

  if (totalAdjustmentPercent !== rawTotal) {
    reasons.push("보정률이 과도하지 않도록 상·하한을 적용했습니다.");
  }

  return {
    mode,
    baseAdjustmentPercent,
    riskAdjustmentPercent,
    positiveAdjustmentPercent,
    totalAdjustmentPercent,
    reasons,
  };
}

function makeFinalTargetRange(
  technicalRange: TargetPriceRange,
  finalBaseTarget: number,
): TargetPriceRange {
  const currentPrice = technicalRange.currentPrice;
  const roundedBase = roundPrice(finalBaseTarget);
  const conservativeTarget = roundPrice(Math.min(roundedBase, technicalRange.conservativeTarget));
  const aggressiveTarget = roundPrice(Math.max(roundedBase, technicalRange.aggressiveTarget));
  const riskLine = technicalRange.riskLine;

  return {
    currentPrice,
    conservativeTarget,
    baseTarget: roundedBase,
    aggressiveTarget,
    riskLine,
    conservativeUpsidePercent: percentChange(conservativeTarget, currentPrice),
    baseUpsidePercent: percentChange(roundedBase, currentPrice),
    aggressiveUpsidePercent: percentChange(aggressiveTarget, currentPrice),
    riskDownsidePercent: percentChange(riskLine, currentPrice),
  };
}

function makeFinalTargetBasis({
  technicalBasis,
  valuationTargetRange,
  selectedModeResult,
  targetModes,
}: {
  technicalBasis: TargetBasis;
  valuationTargetRange: ValuationTargetRange | null;
  selectedModeResult?: TargetModeResult;
  targetModes: TargetModeResult[];
}): TargetBasis {
  const selected = selectedModeResult;
  const candidates: TargetBasisCandidate[] = [];

  if (selected) {
    candidates.push({
      label: `기술 추정 주가 반영 (${getTargetModeLabel(selected.mode)})`,
      value: roundPrice(selected.preAdjustmentTarget),
      weight: selected.technicalWeight,
    });

    if (valuationTargetRange?.valuationTarget != null) {
      candidates.push({
        label: "밸류에이션 추정 주가",
        value: roundPrice(valuationTargetRange.valuationTarget),
        weight: selected.valuationWeight,
      });
    }

    candidates.push({
      label: "최종 추정 주가",
      value: roundPrice(selected.finalTarget),
      weight: 1,
    });
  } else {
    candidates.push(...technicalBasis.candidates);
  }

  const adjustments = [
    ...technicalBasis.adjustments,
    ...(valuationTargetRange?.reasons ?? []),
    ...(selected?.quantAdjustment.reasons ?? []),
    `선택된 추정 주가 모드는 ${selected ? getTargetModeLabel(selected.mode) : "기술 기준"}입니다.`,
    `제공 가능한 추정 주가 모드는 ${targetModes.map((mode) => getTargetModeLabel(mode.mode)).join(", ")}입니다.`,
  ];

  return {
    method: "기술·밸류에이션·퀀트 보정 목표가",
    summary:
      "최종 추정 주가는 기술 추정 주가와 밸류에이션 추정 주가를 모드별 비중으로 결합한 뒤 퀀트 리스크 보정을 적용해 계산했습니다.",
    candidates,
    adjustments,
  };
}

function calculateWeightedTotal(
  parts: {
    technical: ScorePart;
    volume: ScorePart;
    supply: ScorePart;
    targetPrice: ScorePart;
    signalAgreement: ScorePart;
    earningsGrowth: ScorePart;
  },
  weights: Partial<ScoreWeights>,
) {
  const entries = Object.entries(weights) as Array<[keyof ScoreWeights, number]>;

  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [key, weight]) => {
    const partScore = parts[key].score ?? 0;
    return sum + partScore * weight;
  }, 0);

  return Math.round(total);
}

function makeScoreComment({
  total,
  technical,
  volume,
  supply,
  targetPrice,
  signalAgreement,
  earningsGrowth,
}: {
  total: number | null;
  technical: ScorePart;
  volume: ScorePart;
  supply: ScorePart;
  targetPrice: ScorePart;
  signalAgreement: ScorePart;
  earningsGrowth: ScorePart;
}) {
  if (total == null) {
    return "점수 계산에 필요한 데이터가 부족합니다.";
  }

  const weakParts: string[] = [];
  const strongParts: string[] = [];

  if ((technical.score ?? 0) >= 70) strongParts.push("기술");
  if ((volume.score ?? 0) >= 70) strongParts.push("거래량·거래대금");
  if ((supply.score ?? 0) >= 70) strongParts.push("수급");
  if ((targetPrice.score ?? 0) >= 70) strongParts.push("추정 괴리율");
  if ((signalAgreement.score ?? 0) >= 70) strongParts.push("신호 일치도");
  if ((earningsGrowth.score ?? 0) >= 70) strongParts.push("실적 성장");

  if (technical.available && (technical.score ?? 0) < 50) weakParts.push("기술");
  if (volume.available && (volume.score ?? 0) < 50) weakParts.push("거래량·거래대금");
  if (supply.available && (supply.score ?? 0) < 50) weakParts.push("수급");
  if (targetPrice.available && (targetPrice.score ?? 0) < 50) weakParts.push("추정 괴리율");
  if (signalAgreement.available && (signalAgreement.score ?? 0) < 50) weakParts.push("신호 일치도");
  if (earningsGrowth.available && (earningsGrowth.score ?? 0) < 50) weakParts.push("실적 성장");

  const targetMessage = targetPrice.available
    ? " 추정 주가 참고 범위는 기술·밸류에이션·퀀트 보정 기준입니다."
    : " 추정 주가 데이터는 아직 제외하고 계산했습니다.";

  const agreementMessage = signalAgreement.available
    ? " 신호 일치도는 기술·거래·수급·퀀트 방향이 얼마나 맞는지 반영합니다."
    : " 신호 일치도는 데이터가 충분할 때 반영됩니다.";

  const earningsMessage = earningsGrowth.available
    ? ` 실적 성장 점수는 ${earningsGrowth.score}점(${earningsGrowth.label})으로 종합 신뢰도에 10% 보조 가중치로 반영했습니다.`
    : " 실적 성장 데이터가 없으면 해당 가중치는 제외하고 나머지 항목으로 재분배합니다.";

  if (strongParts.length > 0 && weakParts.length > 0) {
    return `${strongParts.join(", ")}은 긍정적이나 ${weakParts.join(", ")} 확인이 필요합니다.${targetMessage}${agreementMessage}${earningsMessage}`;
  }

  if (strongParts.length > 0) {
    return `${strongParts.join(", ")} 흐름이 상대적으로 긍정적입니다.${targetMessage}${agreementMessage}${earningsMessage}`;
  }

  if (weakParts.length > 0) {
    return `${weakParts.join(", ")} 지표가 약해 보수적 확인이 필요합니다.${targetMessage}${agreementMessage}${earningsMessage}`;
  }

  return `전반적으로 중립 구간입니다.${targetMessage}${agreementMessage}${earningsMessage}`;
}

function applyKisSupplyAdjustment(
  part: ScorePart,
  supply?: ScoreSupplyData,
): ScorePart {
  if (!part.available || part.score == null || !supply?.available) {
    return part;
  }

  let score = part.score;
  const reasons = [...part.reasons];
  const recent5Smart = supply.recent5?.smartMoneyNetBuy ?? null;
  const recent20Smart = supply.recent20?.smartMoneyNetBuy ?? null;

  if (recent5Smart != null && recent20Smart != null) {
    if (recent5Smart > 0 && recent20Smart > 0) {
      score += 3;
      reasons.push("KIS 수급 보조평가: 최근 5일·20일 외국인+기관 수급이 모두 순매수라 수급 점수에 소폭 가산했습니다.");
    } else if (recent5Smart < 0 && recent20Smart < 0) {
      score -= 3;
      reasons.push("KIS 수급 보조평가: 최근 5일·20일 외국인+기관 수급이 모두 순매도라 수급 점수에 소폭 감점했습니다.");
    }
  }

  if (supply.foreignPositiveStreak5 && supply.institutionPositiveStreak5) {
    score += 2;
    reasons.push("KIS 수급 보조평가: 외국인과 기관이 모두 5일 연속 순매수 흐름입니다.");
  } else if (!supply.foreignPositiveStreak5 && !supply.institutionPositiveStreak5) {
    reasons.push("KIS 수급 보조평가: 외국인·기관 5일 연속 순매수 조건은 충족하지 못했습니다.");
  }

  const finalScore = clampScore(score);

  return {
    ...part,
    score: finalScore,
    label: getPartLabel(finalScore),
    reasons,
  };
}

function calculateKisFundamentalsAdjustment(
  fundamentals?: ScoreFundamentalsData,
): {
  scoreAdjustment: number;
  reasons: string[];
} {
  if (!fundamentals) {
    return {
      scoreAdjustment: 0,
      reasons: ["KIS 재무·밸류에이션 데이터가 없어 추정 주가 신뢰도 보조 보정은 적용하지 않았습니다."],
    };
  }

  let scoreAdjustment = 0;
  const reasons: string[] = [];
  const per = fundamentals.per;
  const pbr = fundamentals.pbr;
  const eps = fundamentals.eps;
  const high52w = fundamentals.high52w;
  const low52w = fundamentals.low52w;

  if (eps != null && Number.isFinite(eps)) {
    if (eps > 0) {
      scoreAdjustment += 1;
      reasons.push("KIS 재무 보조평가: EPS가 양수라 이익 기반 추정 주가 신뢰도에 +1점 보정했습니다.");
    } else {
      scoreAdjustment -= 2;
      reasons.push("KIS 재무 보조평가: EPS가 0 이하라 추정 주가 신뢰도에 -2점 보정했습니다.");
    }
  }

  if (per != null && Number.isFinite(per) && per > 0) {
    if (per <= 15) {
      scoreAdjustment += 2;
      reasons.push("KIS 밸류에이션 보조평가: PER이 낮은 편이라 추정 주가 신뢰도에 +2점 보정했습니다.");
    } else if (per >= 35) {
      scoreAdjustment -= 2;
      reasons.push("KIS 밸류에이션 보조평가: PER이 높은 편이라 추정 주가 신뢰도에 -2점 보정했습니다.");
    } else {
      reasons.push("KIS 밸류에이션 보조평가: PER은 중립 구간으로 보정 없이 참고합니다.");
    }
  }

  if (pbr != null && Number.isFinite(pbr) && pbr > 0) {
    if (pbr <= 1.5) {
      scoreAdjustment += 1;
      reasons.push("KIS 밸류에이션 보조평가: PBR이 낮은 편이라 추정 주가 신뢰도에 +1점 보정했습니다.");
    } else if (pbr >= 4) {
      scoreAdjustment -= 2;
      reasons.push("KIS 밸류에이션 보조평가: PBR이 높은 편이라 추정 주가 신뢰도에 -2점 보정했습니다.");
    } else {
      reasons.push("KIS 밸류에이션 보조평가: PBR은 중립 구간으로 보정 없이 참고합니다.");
    }
  }

  if (
    high52w != null &&
    low52w != null &&
    Number.isFinite(high52w) &&
    Number.isFinite(low52w) &&
    high52w > low52w
  ) {
    reasons.push("KIS 가격범위 보조평가: 52주 고가·저가는 위험 보정과 가격 위치 판단에 참고합니다.");
  }

  const limitedAdjustment = Math.max(-5, Math.min(5, scoreAdjustment));

  if (limitedAdjustment !== scoreAdjustment) {
    reasons.push("KIS 보조 보정은 기존 모델을 과도하게 흔들지 않도록 ±5점 범위로 제한했습니다.");
  }

  if (reasons.length === 0) {
    reasons.push("KIS 재무·밸류에이션 데이터는 확인됐지만 보조 보정에 사용할 핵심 항목이 부족합니다.");
  }

  return {
    scoreAdjustment: limitedAdjustment,
    reasons,
  };
}

function getScoreGrade(score: number | null) {
  if (score == null) return "데이터 대기";
  if (score >= 80) return "매우 긍정";
  if (score >= 65) return "긍정";
  if (score >= 50) return "중립";
  if (score >= 35) return "주의";
  return "위험";
}

function getPartLabel(score: number) {
  if (score >= 80) return "강함";
  if (score >= 65) return "긍정";
  if (score >= 50) return "중립";
  if (score >= 35) return "약함";
  return "주의";
}

function getTargetModeLabel(mode: TargetMode) {
  if (mode === "conservative") return "보수적";
  if (mode === "base") return "기본";
  return "공격적";
}

function getPerAdjustment(per?: number | null) {
  if (per == null || !Number.isFinite(per) || per <= 0) return null;
  if (per <= 10) return 1.08;
  if (per <= 20) return 1;
  if (per <= 30) return 0.92;
  if (per <= 40) return 0.84;
  return 0.75;
}

function getPbrAdjustment(pbr?: number | null) {
  if (pbr == null || !Number.isFinite(pbr) || pbr <= 0) return null;
  if (pbr <= 1) return 1.08;
  if (pbr <= 2) return 1;
  if (pbr <= 3) return 0.92;
  if (pbr <= 5) return 0.85;
  return 0.75;
}

function stabilizeFinalTarget({
  mode,
  finalTarget,
  currentPrice,
  technicalTarget,
  valuationTarget,
  quant,
}: {
  mode: TargetMode;
  finalTarget: number;
  currentPrice: number;
  technicalTarget: number;
  valuationTarget: number;
  quant?: ScoreQuantData;
}) {
  let minUpside = 0.015;
  let maxUpside = 0.2;

  if (mode === "base") {
    minUpside = 0.02;
    maxUpside = 0.28;
  }

  if (mode === "aggressive") {
    minUpside = 0.03;
    maxUpside = 0.38;
  }

  if (quant?.flags?.nearHigh52w || quant?.flags?.valuationBurden || quant?.flags?.volatilityHigh) {
    maxUpside *= 0.7;
  }

  const lowerBound = currentPrice * (1 + minUpside);
  const upperBound = currentPrice * (1 + maxUpside);
  const referenceUpper = Math.max(technicalTarget, valuationTarget, currentPrice * 1.02);
  const cappedUpper = Math.min(upperBound, referenceUpper * 1.15);

  return roundPrice(Math.max(lowerBound, Math.min(finalTarget, cappedUpper)));
}

function clampValuationTarget(target: number, currentPrice: number) {
  const lower = currentPrice * 0.8;
  const upper = currentPrice * 1.35;

  return roundPrice(Math.max(lower, Math.min(target, upper)));
}

function clampAdjustmentPercent(value: number, mode: TargetMode) {
  if (mode === "conservative") {
    return Math.max(-12, Math.min(5, value));
  }

  if (mode === "base") {
    return Math.max(-10, Math.min(8, value));
  }

  return Math.max(-8, Math.min(12, value));
}

function calculateTargetStrengthBonus(
  technicalScore: number | null,
  volumeScore: number | null,
  supplyScore: number | null,
) {
  let bonus = 0;

  if ((technicalScore ?? 0) >= 65) bonus += 0.01;
  if ((volumeScore ?? 0) >= 65) bonus += 0.012;
  if ((supplyScore ?? 0) >= 80) bonus += 0.018;

  if ((technicalScore ?? 0) < 50) bonus -= 0.008;
  if ((volumeScore ?? 0) < 50) bonus -= 0.008;
  if ((supplyScore ?? 0) < 50) bonus -= 0.012;

  return Math.max(0, Math.min(0.06, bonus));
}

function scoreTargetUpside(upsidePercent: number) {
  if (upsidePercent >= 12) return 85;
  if (upsidePercent >= 8) return 75;
  if (upsidePercent >= 5) return 65;
  if (upsidePercent >= 2) return 50;
  if (upsidePercent > 0) return 35;
  return 20;
}

function averageVolume(rows: ScoreChartRow[]) {
  const volumes = rows
    .map((row) => row.volume)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (volumes.length === 0) return null;

  return volumes.reduce((sum, value) => sum + value, 0) / volumes.length;
}

function averageTradingValue(rows: ScoreChartRow[], period: number) {
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

function averageAbsoluteDailyChangePercent(rows: ScoreChartRow[]) {
  const sortedRows = sortRowsByDate(rows);
  const changes: number[] = [];

  for (let i = 1; i < sortedRows.length; i += 1) {
    const previous = sortedRows[i - 1].close;
    const current = sortedRows[i].close;

    if (
      previous != null &&
      current != null &&
      Number.isFinite(previous) &&
      Number.isFinite(current) &&
      previous > 0
    ) {
      changes.push(Math.abs((current - previous) / previous));
    }
  }

  if (changes.length === 0) return 0.02;

  return changes.reduce((sum, value) => sum + value, 0) / changes.length;
}

function getRecentHighClose(rows: ScoreChartRow[]) {
  const validRows = rows.filter(
    (row) => row.close != null && typeof row.close === "number" && Number.isFinite(row.close),
  );

  if (validRows.length === 0) return null;

  return validRows.reduce<{ value: number; date: string }>(
    (max, row) => {
      const close = row.close as number;

      if (close > max.value) {
        return {
          value: close,
          date: row.date,
        };
      }

      return max;
    },
    {
      value: validRows[0].close as number,
      date: validRows[0].date,
    },
  );
}

function isSma20Rising(rows: ScoreChartRow[]) {
  if (rows.length < 6) return false;

  const latest = rows[rows.length - 1]?.sma20;
  const past = rows[rows.length - 6]?.sma20;

  if (
    latest == null ||
    past == null ||
    !Number.isFinite(latest) ||
    !Number.isFinite(past) ||
    past <= 0
  ) {
    return false;
  }

  return latest > past;
}

function sortRowsByDate(rows: ScoreChartRow[]) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;

    return aTime - bTime;
  });
}

function getLatestRow(rows: ScoreChartRow[]) {
  if (!rows.length) return null;
  return rows[rows.length - 1];
}

function percentChange(target: number, current: number) {
  if (current <= 0) return 0;
  return ((target - current) / current) * 100;
}

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value >= 1000) return Math.round(value / 10) * 10;
  if (value >= 100) return Math.round(value);
  return Number(value.toFixed(2));
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

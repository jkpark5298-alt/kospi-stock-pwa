export type ScoreChartRow = {
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
  };
};

export type TargetMode = "conservative" | "base" | "aggressive";

export type ScoreWeights = {
  technical: number;
  volume: number;
  supply: number;
  targetPrice: number;
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
  baseWeights: ScoreWeights;
  appliedWeights: Partial<ScoreWeights>;
  targetPricePlan: {
    status: string;
    nextSteps: string[];
  };
};

type WeightedBaseTargetResult = {
  target: number;
  basis: TargetBasis;
};

type RecentHighResult = {
  value: number;
  date: string;
};

type TechnicalTargetResult = {
  range: TargetPriceRange;
  basis: TargetBasis;
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  technical: 0.35,
  volume: 0.2,
  supply: 0.35,
  targetPrice: 0.1,
};

export const DEFAULT_TARGET_MODE: TargetMode = "conservative";

export function calculateCompositeScore({
  rows,
  supply,
  fundamentals,
  quant,
  targetMode = DEFAULT_TARGET_MODE,
  weights = DEFAULT_SCORE_WEIGHTS,
}: {
  rows: ScoreChartRow[];
  supply?: ScoreSupplyData;
  fundamentals?: ScoreFundamentalsData;
  quant?: ScoreQuantData;
  targetMode?: TargetMode;
  weights?: ScoreWeights;
}): CompositeScore {
  const sortedRows = sortRowsByDate(rows);

  const technical = calculateTechnicalScore(sortedRows);
  const volume = calculateVolumeScore(sortedRows);
  const supplyScore = calculateSupplyScore(supply);
  const targetPrice = calculateTargetPriceScore(
    sortedRows,
    technical,
    volume,
    supplyScore,
    fundamentals,
    quant,
    targetMode
  );

  const parts = {
    technical,
    volume,
    supply: supplyScore,
    targetPrice,
  };

  const appliedWeights = normalizeAvailableWeights(weights, parts);
  const total = calculateWeightedTotal(parts, appliedWeights);
  const grade = getScoreGrade(total);

  const comment = makeScoreComment({
    total,
    technical,
    volume,
    supply: supplyScore,
    targetPrice,
  });

  return {
    total,
    grade,
    comment,
    technical,
    volume,
    supply: supplyScore,
    targetPrice,
    baseWeights: weights,
    appliedWeights,
    targetPricePlan: {
      status: targetPrice.available
        ? "기술 목표가, 밸류에이션 목표가, 퀀트 보정을 반영한 최종 기준목표가를 계산했습니다."
        : "목표가 자동 산정은 데이터가 충분할 때 표시됩니다.",
      nextSteps: [
        "보수적·기본·공격적 목표가 모드 화면 선택 연결",
        "업종 평균 PER/PBR 확보 시 밸류에이션 보정 고도화",
        "컨센서스 목표가 데이터 확보 시 반영",
        "분석 기록 저장 후 목표가 적중률 평가",
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
      score += 30;
      reasons.push("MACD가 Signal 위에 있어 기술 흐름이 긍정적입니다.");
    } else {
      reasons.push("MACD가 Signal 아래에 있어 기술 흐름 확인이 필요합니다.");
    }
  } else {
    reasons.push("MACD 데이터가 부족합니다.");
  }

  if (latest.rsi14 != null) {
    if (latest.rsi14 >= 30 && latest.rsi14 <= 60) {
      score += 25;
      reasons.push("RSI14가 과열이 아닌 안정 구간입니다.");
    } else if (latest.rsi14 > 60 && latest.rsi14 <= 70) {
      score += 15;
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
      score += 20;
      reasons.push("현재가가 SMA20 위에 있습니다.");
    } else {
      reasons.push("현재가가 SMA20 아래에 있습니다.");
    }
  } else {
    reasons.push("SMA20 비교 데이터가 부족합니다.");
  }

  if (latest.close != null && latest.sma60 != null) {
    if (latest.close > latest.sma60) {
      score += 15;
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
      score += 35;
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
      score += 30;
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
      score += 20;
      reasons.push("최근 거래량이 20일 평균보다 높습니다.");
    } else {
      score += 8;
      reasons.push("최근 거래량이 20일 평균보다 낮습니다.");
    }
  } else {
    reasons.push("20일 평균 거래량 비교 데이터가 부족합니다.");
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
  targetMode: TargetMode = DEFAULT_TARGET_MODE
): TargetPriceScore {
  const sortedRows = sortRowsByDate(rows);
  const technicalResult = calculateTechnicalTargetRange(sortedRows, technical, volume, supply);

  if (!technicalResult) {
    return {
      available: false,
      score: null,
      label: "데이터 대기",
      reasons: [
        "목표가 참고 범위를 계산할 차트 데이터가 부족합니다.",
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
    fundamentals
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

  reasons.push(`최종 기준목표가 상승 여력은 약 ${finalTargetRange.baseUpsidePercent.toFixed(1)}%입니다.`);
  reasons.push(`현재 목표가 모드는 ${getTargetModeLabel(targetMode)}입니다.`);

  if ((supply.score ?? 0) >= 80) {
    score += 5;
    reasons.push("수급 점수가 강해 목표가 신뢰도에 소폭 가산했습니다.");
  } else if (supply.available && (supply.score ?? 0) < 50) {
    score -= 10;
    reasons.push("수급 점수가 낮아 목표가 신뢰도에 감점을 적용했습니다.");
  }

  if ((volume.score ?? 0) >= 65) {
    score += 5;
    reasons.push("거래량 점수가 긍정적이어서 목표가 신뢰도에 소폭 가산했습니다.");
  } else if (volume.available && (volume.score ?? 0) < 50) {
    score -= 10;
    reasons.push("거래량 점수가 낮아 목표가 신뢰도에 감점을 적용했습니다.");
  }

  if (finalTargetRange.riskDownsidePercent > -3) {
    score -= 5;
    reasons.push("위험 기준선이 현재가와 가까워 변동성 주의 보정을 적용했습니다.");
  }

  if (valuationTargetRange?.valuationTarget != null) {
    reasons.push("EPS/BPS 기반 밸류에이션 목표가를 함께 반영했습니다.");
  } else {
    reasons.push("밸류에이션 목표가 데이터가 부족해 기술 목표가 중심으로 계산했습니다.");
  }

  if (selectedModeResult?.quantAdjustment.totalAdjustmentPercent) {
    reasons.push(
      `퀀트 보정 ${selectedModeResult.quantAdjustment.totalAdjustmentPercent.toFixed(1)}%가 최종 기준목표가에 반영되었습니다.`
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

export function normalizeAvailableWeights(
  weights: ScoreWeights,
  parts: {
    technical: ScorePart;
    volume: ScorePart;
    supply: ScorePart;
    targetPrice: ScorePart;
  }
): Partial<ScoreWeights> {
  const availableWeightEntries = Object.entries(weights).filter(([key]) => {
    const scoreKey = key as keyof ScoreWeights;
    return parts[scoreKey].available && parts[scoreKey].score != null;
  }) as Array<[keyof ScoreWeights, number]>;

  const totalAvailableWeight = availableWeightEntries.reduce(
    (sum, [, weight]) => sum + weight,
    0
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
  supply: ScorePart
): TechnicalTargetResult | null {
  const validRows = sortRowsByDate(rows).filter(
    (row) => typeof row.close === "number" && Number.isFinite(row.close)
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
    }
  );

  const conservativeTarget =
    upsideCandidates.length > 0 ? Math.min(...upsideCandidates) : currentPrice * 1.02;

  const weightedResult =
    calculateWeightedBaseTarget({
      conservativeTarget,
      recentHigh,
      recentHighDate,
      bbUpper,
      volatilityUpper,
      currentPrice,
      technicalScore: technical.score,
      volumeScore: volume.score,
      supplyScore: supply.score,
    }) ?? {
      target: conservativeTarget,
      basis: {
        method: "기술 목표가 가중 평균",
        summary:
          "기술 목표가는 최근 고점, 볼린저밴드, 변동성, 보수적 목표가를 가중 평균해 계산했습니다.",
        candidates: [
          {
            label: "보수적 기술 목표가",
            value: roundPrice(conservativeTarget),
            weight: 1,
          },
        ],
        adjustments: ["계산 후보가 부족해 보수적 기술 목표가를 기준으로 계산했습니다."],
      },
    };

  const baseTargetRaw = Math.max(weightedResult.target, conservativeTarget);
  const strengthBonus = calculateTargetStrengthBonus(technical.score, volume.score, supply.score);

  const aggressiveTargetRaw = Math.max(
    baseTargetRaw * (1 + strengthBonus),
    volatilityAggressiveUpper,
    conservativeTarget
  );

  const downsideCandidates = [recentLow, bbLower, sma20, sma60].filter(
    (value): value is number => {
      return typeof value === "number" && Number.isFinite(value) && value > 0 && value < currentPrice;
    }
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

function calculateValuationTargetRange(
  currentPrice: number,
  fundamentals?: ScoreFundamentalsData
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
    reasons.push(`EPS × 현재 PER × PER 보정계수 ${perAdjustment.toFixed(2)}를 반영했습니다.`);
  } else {
    reasons.push("EPS 또는 PER 데이터가 부족해 EPS 기준 목표가는 제외했습니다.");
  }

  if (bps != null && bps > 0 && pbr != null && pbr > 0 && pbrAdjustment != null) {
    bpsTarget = roundPrice(bps * pbr * pbrAdjustment);
    reasons.push(`BPS × 현재 PBR × PBR 보정계수 ${pbrAdjustment.toFixed(2)}를 반영했습니다.`);
  } else {
    reasons.push("BPS 또는 PBR 데이터가 부족해 BPS 기준 목표가는 제외했습니다.");
  }

  const targets = [epsTarget, bpsTarget].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0
  );

  if (targets.length === 0) {
    return {
      epsTarget,
      bpsTarget,
      valuationTarget: null,
      perAdjustment,
      pbrAdjustment,
      method: "밸류에이션 목표가 계산 대기",
      reasons,
    };
  }

  const valuationTarget = roundPrice(
    targets.reduce((sum, value) => sum + value, 0) / targets.length
  );

  const cappedValuationTarget = clampValuationTarget(valuationTarget, currentPrice);

  if (cappedValuationTarget !== valuationTarget) {
    reasons.push("밸류에이션 목표가가 현재가 대비 과도하게 벌어지지 않도록 안정화했습니다.");
  }

  return {
    epsTarget,
    bpsTarget,
    valuationTarget: cappedValuationTarget,
    perAdjustment,
    pbrAdjustment,
    method: "EPS/PER + BPS/PBR 보정 평균",
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
      preAdjustmentTarget * (1 + quantAdjustment.totalAdjustmentPercent / 100)
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

  const targetAlmostReached = flags.targetAlmostReached || (targetProgress != null && targetProgress >= 97);

  if (nearHigh52w) {
    riskAdjustmentPercent -= mode === "conservative" ? 3 : 2;
    reasons.push("52주 고가에 근접해 리스크 보정을 적용했습니다.");
  }

  if (targetAlmostReached) {
    riskAdjustmentPercent -= mode === "conservative" ? 3 : 2;
    reasons.push("기술 목표가에 이미 근접해 목표가 근접 보정을 적용했습니다.");
  }

  if (valuationBurden) {
    riskAdjustmentPercent -= mode === "conservative" ? 3 : 2;
    reasons.push("PER/PBR 부담으로 밸류에이션 리스크 보정을 적용했습니다.");
  }

  if (valuationTargetRange?.valuationTarget != null && valuationTargetRange.valuationTarget < currentPrice) {
    riskAdjustmentPercent -= mode === "conservative" ? 2 : 1;
    reasons.push("밸류에이션 목표가가 현재가보다 낮아 보수 보정을 적용했습니다.");
  }

  if ((supply.score ?? 0) >= 80 || flags.supplyPositive) {
    positiveAdjustmentPercent += mode === "aggressive" ? 2 : 1;
    reasons.push("수급이 긍정적이라 소폭 가산했습니다.");
  }

  if ((technical.score ?? 0) >= 70 || flags.momentumPositive) {
    positiveAdjustmentPercent += mode === "aggressive" ? 2 : 1;
    reasons.push("모멘텀이 긍정적이라 소폭 가산했습니다.");
  }

  if ((volume.score ?? 0) < 50) {
    riskAdjustmentPercent -= 1;
    reasons.push("거래량 점수가 낮아 추가 보수 보정을 적용했습니다.");
  }

  if (mode === "conservative") {
    baseAdjustmentPercent -= 1;
    reasons.push("보수적 모드는 기본적으로 -1% 안정화 보정을 적용합니다.");
  }

  if (mode === "aggressive" && (nearHigh52w || valuationBurden || targetAlmostReached)) {
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
  finalBaseTarget: number
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
      label: `기술 목표가 반영 (${getTargetModeLabel(selected.mode)})`,
      value: roundPrice(selected.preAdjustmentTarget),
      weight: selected.technicalWeight,
    });

    if (valuationTargetRange?.valuationTarget != null) {
      candidates.push({
        label: "밸류에이션 목표가",
        value: roundPrice(valuationTargetRange.valuationTarget),
        weight: selected.valuationWeight,
      });
    }

    candidates.push({
      label: "최종 기준목표가",
      value: roundPrice(selected.finalTarget),
      weight: 1,
    });
  }

  const adjustments = [
    ...technicalBasis.adjustments,
    ...(valuationTargetRange?.reasons ?? []),
    ...(selected?.quantAdjustment.reasons ?? []),
    ...targetModes.map(
      (mode) =>
        `${mode.label}: 기술 ${formatPercentWeight(mode.technicalWeight)}, 밸류 ${formatPercentWeight(
          mode.valuationWeight
        )}, 최종 ${roundPrice(mode.finalTarget).toLocaleString("ko-KR")}`
    ),
  ];

  return {
    method: "기술 목표가 + 밸류에이션 목표가 + 퀀트 보정",
    summary:
      selected != null
        ? `${getTargetModeLabel(
            selected.mode
          )} 기준으로 기술 목표가와 밸류에이션 목표가를 가중 평균한 뒤 퀀트 리스크 보정을 적용했습니다.`
        : "기술 목표가와 밸류에이션 목표가를 함께 계산했습니다.",
    candidates: candidates.length > 0 ? candidates : technicalBasis.candidates,
    adjustments,
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
}): WeightedBaseTargetResult | null {
  let weights = {
    conservative: 0.3,
    recentHigh: 0.3,
    bollinger: 0.2,
    volatility: 0.2,
  };

  const adjustments: string[] = [];
  const strongSupply = (supplyScore ?? 0) >= 80;
  const strongVolume = (volumeScore ?? 0) >= 65;
  const weakVolume = (volumeScore ?? 0) < 50;
  const weakTechnical = (technicalScore ?? 0) < 50;

  if (strongSupply && strongVolume) {
    weights = {
      conservative: weights.conservative - 0.07,
      recentHigh: weights.recentHigh + 0.05,
      bollinger: weights.bollinger - 0.03,
      volatility: weights.volatility + 0.05,
    };
    adjustments.push("수급·거래량이 좋아 최근 고점과 변동성 비중을 높였습니다.");
  }

  if (weakVolume) {
    weights = {
      conservative: weights.conservative + 0.1,
      recentHigh: weights.recentHigh - 0.05,
      bollinger: weights.bollinger,
      volatility: weights.volatility - 0.05,
    };
    adjustments.push("거래량이 약해 보수적 목표가 비중을 높였습니다.");
  }

  if (weakTechnical) {
    weights = {
      conservative: weights.conservative + 0.1,
      recentHigh: weights.recentHigh - 0.05,
      bollinger: weights.bollinger,
      volatility: weights.volatility - 0.05,
    };
    adjustments.push("기술 흐름이 약해 보수적으로 계산했습니다.");
  }

  if (adjustments.length === 0) {
    adjustments.push("추가 보정 없이 기본 비중을 적용했습니다.");
  }

  const recentHighLabel = recentHighDate
    ? `최근 60일 고점 (${recentHighDate})`
    : "최근 60일 고점";

  const candidates = [
    {
      label: "보수적 기술 목표가",
      value: conservativeTarget,
      weight: weights.conservative,
    },
    {
      label: recentHighLabel,
      value: recentHigh,
      weight: weights.recentHigh,
    },
    {
      label: "볼린저밴드 상단",
      value: bbUpper,
      weight: weights.bollinger,
    },
    {
      label: "변동성 상단",
      value: volatilityUpper,
      weight: weights.volatility,
    },
  ].filter((candidate) => {
    return (
      typeof candidate.value === "number" &&
      Number.isFinite(candidate.value) &&
      candidate.value > 0 &&
      candidate.value >= currentPrice * 0.98 &&
      candidate.weight > 0
    );
  }) as Array<{
    label: string;
    value: number;
    weight: number;
  }>;

  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);

  if (totalWeight <= 0) return null;

  const normalizedCandidates = candidates.map((candidate) => ({
    label: candidate.label,
    value: roundPrice(candidate.value),
    weight: Number((candidate.weight / totalWeight).toFixed(4)),
  }));

  const target = candidates.reduce((sum, candidate) => {
    return sum + candidate.value * (candidate.weight / totalWeight);
  }, 0);

  return {
    target,
    basis: {
      method: "기술 목표가 가중 평균",
      summary:
        "기술 목표가는 최근 고점, 볼린저밴드, 변동성, 보수적 목표가를 가중 평균해 계산했습니다.",
      candidates: normalizedCandidates,
      adjustments,
    },
  };
}

function getRecentHighClose(rows: ScoreChartRow[]): RecentHighResult | null {
  const validRows = sortRowsByDate(rows).filter(
    (row) => typeof row.close === "number" && Number.isFinite(row.close)
  );

  if (validRows.length === 0) return null;

  return validRows.reduce<RecentHighResult>(
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
    }
  );
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

function calculateTargetStrengthBonus(
  technicalScore: number | null,
  volumeScore: number | null,
  supplyScore: number | null
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

function calculateWeightedTotal(
  parts: {
    technical: ScorePart;
    volume: ScorePart;
    supply: ScorePart;
    targetPrice: ScorePart;
  },
  weights: Partial<ScoreWeights>
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
}: {
  total: number | null;
  technical: ScorePart;
  volume: ScorePart;
  supply: ScorePart;
  targetPrice: ScorePart;
}) {
  if (total == null) {
    return "점수 계산에 필요한 데이터가 부족합니다.";
  }

  const weakParts: string[] = [];
  const strongParts: string[] = [];

  if ((technical.score ?? 0) >= 70) strongParts.push("기술");
  if ((volume.score ?? 0) >= 70) strongParts.push("거래량");
  if ((supply.score ?? 0) >= 70) strongParts.push("수급");
  if ((targetPrice.score ?? 0) >= 70) strongParts.push("목표여력");

  if (technical.available && (technical.score ?? 0) < 50) weakParts.push("기술");
  if (volume.available && (volume.score ?? 0) < 50) weakParts.push("거래량");
  if (supply.available && (supply.score ?? 0) < 50) weakParts.push("수급");
  if (targetPrice.available && (targetPrice.score ?? 0) < 50) weakParts.push("목표여력");

  const targetMessage = targetPrice.available
    ? " 목표가 참고 범위는 기술·밸류에이션·퀀트 보정 기준입니다."
    : " 목표가 데이터는 아직 제외하고 계산했습니다.";

  if (strongParts.length > 0 && weakParts.length > 0) {
    return `${strongParts.join(", ")}은 긍정적이나 ${weakParts.join(", ")} 확인이 필요합니다.${targetMessage}`;
  }

  if (strongParts.length > 0) {
    return `${strongParts.join(", ")} 흐름이 상대적으로 긍정적입니다.${targetMessage}`;
  }

  if (weakParts.length > 0) {
    return `${weakParts.join(", ")} 지표가 약해 보수적 확인이 필요합니다.${targetMessage}`;
  }

  return `전반적으로 중립 구간입니다.${targetMessage}`;
}

function getScoreGrade(score: number | null) {
  if (score == null) return "데이터 대기";
  if (score >= 80) return "강한 관심 구간";
  if (score >= 65) return "관심 구간";
  if (score >= 50) return "관망 구간";
  if (score >= 35) return "약세 주의";
  return "위험 구간";
}

function getPartLabel(score: number) {
  if (score >= 80) return "강함";
  if (score >= 65) return "긍정";
  if (score >= 50) return "중립";
  if (score >= 35) return "약함";
  return "주의";
}

function getLatestRow(rows: ScoreChartRow[]) {
  return rows.length ? rows[rows.length - 1] : null;
}

function averageVolume(rows: ScoreChartRow[]) {
  const volumes = rows
    .map((row) => row.volume)
    .filter((volume): volume is number => typeof volume === "number" && Number.isFinite(volume));

  if (volumes.length === 0) return null;

  return volumes.reduce((sum, volume) => sum + volume, 0) / volumes.length;
}

function averageAbsoluteDailyChangePercent(rows: ScoreChartRow[]) {
  const sortedRows = sortRowsByDate(rows);
  const changes: number[] = [];

  for (let i = 1; i < sortedRows.length; i++) {
    const prev = sortedRows[i - 1].close;
    const current = sortedRows[i].close;

    if (
      typeof prev === "number" &&
      typeof current === "number" &&
      Number.isFinite(prev) &&
      Number.isFinite(current) &&
      prev > 0
    ) {
      changes.push(Math.abs((current - prev) / prev));
    }
  }

  if (changes.length === 0) return 0.02;

  const avg = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  return Math.max(0.005, Math.min(0.08, avg));
}

function percentChange(target: number, current: number) {
  if (!Number.isFinite(target) || !Number.isFinite(current) || current <= 0) return 0;
  return Number((((target - current) / current) * 100).toFixed(2));
}

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return 0;

  if (value >= 100000) {
    return Math.round(value / 500) * 500;
  }

  if (value >= 10000) {
    return Math.round(value / 100) * 100;
  }

  if (value >= 1000) {
    return Math.round(value / 10) * 10;
  }

  return Math.round(value);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getPerAdjustment(per?: number | null) {
  if (per == null || !Number.isFinite(per) || per <= 0) return null;
  if (per <= 15) return 1.05;
  if (per <= 25) return 1.0;
  if (per <= 35) return 0.95;
  return 0.9;
}

function getPbrAdjustment(pbr?: number | null) {
  if (pbr == null || !Number.isFinite(pbr) || pbr <= 0) return null;
  if (pbr <= 1) return 1.05;
  if (pbr <= 2) return 1.0;
  if (pbr <= 3) return 0.95;
  return 0.9;
}

function clampValuationTarget(value: number, currentPrice: number) {
  if (!Number.isFinite(value) || value <= 0) return value;

  const lowerLimit = currentPrice * 0.75;
  const upperLimit = currentPrice * 1.25;

  return roundPrice(Math.max(lowerLimit, Math.min(upperLimit, value)));
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
  let minTarget = currentPrice * 0.82;
  let maxTarget = Math.max(technicalTarget, valuationTarget, currentPrice) * 1.08;

  if (mode === "conservative") {
    minTarget = currentPrice * 0.78;
    maxTarget = Math.max(technicalTarget, currentPrice) * 1.02;
  }

  if (mode === "aggressive") {
    maxTarget = Math.max(technicalTarget, valuationTarget, currentPrice) * 1.12;
  }

  if (quant?.flags?.nearHigh52w || quant?.flags?.valuationBurden || quant?.flags?.targetAlmostReached) {
    maxTarget = Math.min(maxTarget, Math.max(technicalTarget, currentPrice) * 1.03);
  }

  return roundPrice(Math.max(minTarget, Math.min(maxTarget, finalTarget)));
}

function clampAdjustmentPercent(value: number, mode: TargetMode) {
  if (mode === "conservative") return Math.max(-12, Math.min(4, value));
  if (mode === "aggressive") return Math.max(-10, Math.min(6, value));
  return Math.max(-10, Math.min(5, value));
}

function getTargetModeLabel(mode: TargetMode) {
  if (mode === "conservative") return "보수적 기준";
  if (mode === "aggressive") return "공격적 기준";
  return "기본 기준";
}

function formatPercentWeight(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
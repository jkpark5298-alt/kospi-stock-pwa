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

export type TargetPriceScore = ScorePart & {
  technicalTargetRange: TargetPriceRange | null;
  targetBasis: TargetBasis | null;
  supplyAdjustedTarget: number | null;
  consensusTarget: null;
  riskLine: number | null;
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

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  technical: 0.35,
  volume: 0.2,
  supply: 0.35,
  targetPrice: 0.1,
};

export function calculateCompositeScore({
  rows,
  supply,
  weights = DEFAULT_SCORE_WEIGHTS,
}: {
  rows: ScoreChartRow[];
  supply?: ScoreSupplyData;
  weights?: ScoreWeights;
}): CompositeScore {
  const sortedRows = sortRowsByDate(rows);

  const technical = calculateTechnicalScore(sortedRows);
  const volume = calculateVolumeScore(sortedRows);
  const supplyScore = calculateSupplyScore(supply);
  const targetPrice = calculateTargetPriceScore(sortedRows, technical, volume, supplyScore);

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
        ? "기술적 목표가 참고 범위를 계산했습니다. 컨센서스 목표가는 아직 연결하지 않았습니다."
        : "목표가 자동 산정은 데이터가 충분할 때 표시됩니다.",
      nextSteps: [
        "기술적 목표가 범위 검증",
        "수급 보정 목표가 고도화",
        "PER/PBR 기반 밸류에이션 목표가 추가",
        "컨센서스 목표가 데이터 확보 시 반영",
        "분석 기록 저장 후 목표가 적중률 평가",
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
  supply: ScorePart
): TargetPriceScore {
  const sortedRows = sortRowsByDate(rows);
  const result = calculateTechnicalTargetRange(sortedRows, technical, volume, supply);

  if (!result) {
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
    };
  }

  const { range, basis } = result;

  let score = scoreTargetUpside(range.baseUpsidePercent);
  const reasons: string[] = [];

  reasons.push(`기준 목표가 상승 여력은 약 ${range.baseUpsidePercent.toFixed(1)}%입니다.`);

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

  if (range.riskDownsidePercent > -3) {
    score -= 5;
    reasons.push("위험 기준선이 현재가와 가까워 변동성 주의 보정을 적용했습니다.");
  }

  const finalScore = clampScore(score);

  return {
    available: true,
    score: finalScore,
    label: getPartLabel(finalScore),
    reasons,
    technicalTargetRange: range,
    targetBasis: basis,
    supplyAdjustedTarget: range.aggressiveTarget,
    consensusTarget: null,
    riskLine: range.riskLine,
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
): { range: TargetPriceRange; basis: TargetBasis } | null {
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

  const upsideCandidates = [
    recentHigh,
    bbUpper,
    volatilityUpper,
  ].filter((value): value is number => {
    return typeof value === "number" && Number.isFinite(value) && value > currentPrice;
  });

  const conservativeTarget =
    upsideCandidates.length > 0
      ? Math.min(...upsideCandidates)
      : currentPrice * 1.02;

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
        method: "가중 평균",
        summary:
          "기준 목표가는 최근 고점, 볼린저밴드, 변동성, 보수적 목표가를 가중 평균해 계산했습니다.",
        candidates: [
          {
            label: "보수적 목표가",
            value: roundPrice(conservativeTarget),
            weight: 1,
          },
        ],
        adjustments: ["계산 후보가 부족해 보수적 목표가를 기준으로 계산했습니다."],
      },
    };

  const baseTargetRaw = Math.max(weightedResult.target, conservativeTarget);
  const strengthBonus = calculateTargetStrengthBonus(technical.score, volume.score, supply.score);

  const aggressiveTargetRaw = Math.max(
    baseTargetRaw * (1 + strengthBonus),
    volatilityAggressiveUpper,
    conservativeTarget
  );

  const downsideCandidates = [
    recentLow,
    bbLower,
    sma20,
    sma60,
  ].filter((value): value is number => {
    return typeof value === "number" && Number.isFinite(value) && value > 0 && value < currentPrice;
  });

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
      label: "보수적 목표가",
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
      method: "가중 평균",
      summary:
        "기준 목표가는 최근 고점, 볼린저밴드, 변동성, 보수적 목표가를 가중 평균해 계산했습니다.",
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

  return validRows.reduce<RecentHighResult>((max, row) => {
    const close = row.close as number;

    if (close > max.value) {
      return {
        value: close,
        date: row.date,
      };
    }

    return max;
  }, {
    value: validRows[0].close as number,
    date: validRows[0].date,
  });
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
    ? " 목표가 참고 범위는 기술적 계산 기준입니다."
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
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

export type TargetPriceScore = ScorePart & {
  technicalTargetRange: null;
  supplyAdjustedTarget: null;
  consensusTarget: null;
  riskLine: null;
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
  const technical = calculateTechnicalScore(rows);
  const volume = calculateVolumeScore(rows);
  const supplyScore = calculateSupplyScore(supply);
  const targetPrice = calculateTargetPriceScore();

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
      status: "목표가 자동 산정은 다음 단계에서 추가 예정입니다.",
      nextSteps: [
        "기술적 목표가 범위 계산",
        "수급 보정 목표가 계산",
        "컨센서스 목표가 데이터 확보 시 반영",
        "위험 기준선 계산",
      ],
    },
  };
}

export function calculateTechnicalScore(rows: ScoreChartRow[]): ScorePart {
  const latest = getLatestRow(rows);

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
  const latest = getLatestRow(rows);
  const previous = rows.length >= 2 ? rows[rows.length - 2] : null;

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
  const avg5 = averageVolume(rows.slice(-5));
  const avg20 = averageVolume(rows.slice(-20));

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

export function calculateTargetPriceScore(): TargetPriceScore {
  return {
    available: false,
    score: null,
    label: "데이터 대기",
    reasons: [
      "목표가 데이터는 아직 연결하지 않았습니다.",
      "다음 단계에서 기술적 목표가 범위와 수급 보정 목표가 구조를 추가할 예정입니다.",
    ],
    technicalTargetRange: null,
    supplyAdjustedTarget: null,
    consensusTarget: null,
    riskLine: null,
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

  if (technical.available && (technical.score ?? 0) < 50) weakParts.push("기술");
  if (volume.available && (volume.score ?? 0) < 50) weakParts.push("거래량");
  if (supply.available && (supply.score ?? 0) < 50) weakParts.push("수급");

  const targetMessage = targetPrice.available
    ? ""
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

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}
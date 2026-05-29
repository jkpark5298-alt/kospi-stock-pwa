import type {
  MarketRegime,
  StrategyInterpretationRule,
  StrategyRegimeRule,
} from "@/types/technicalStrategy";

export const TECHNICAL_STRATEGY_MAX_SCORE = 100;

export const REGIME_RULES: StrategyRegimeRule[] = [
  {
    regime: "uptrend",
    label: "상승 장세",
    description: "가격이 주요 이동평균 위에 있고 MACD·RSI가 우호적인 흐름입니다.",
    minScore: 65,
  },
  {
    regime: "sideways",
    label: "횡보 장세",
    description: "가격이 박스권 또는 이동평균 주변에서 방향성을 탐색하는 흐름입니다.",
    minScore: 45,
  },
  {
    regime: "downtrend",
    label: "하락 장세",
    description: "가격이 주요 이동평균 아래에 있거나 모멘텀이 약한 흐름입니다.",
    minScore: 0,
  },
];

export const REGIME_BONUS_TABLE: Record<MarketRegime, number> = {
  uptrend: 8,
  sideways: 0,
  downtrend: -8,
};

export const INTERPRETATION_TABLE: StrategyInterpretationRule[] = [
  {
    min: 80,
    max: 100,
    action: "매수",
    label: "매수 후보",
    description: "추세와 모멘텀이 강해 매수 후보로 볼 수 있습니다.",
  },
  {
    min: 65,
    max: 79,
    action: "매수",
    label: "분할매수 가능",
    description: "우호적인 조건이 많지만 과열 여부를 함께 확인해야 합니다.",
  },
  {
    min: 50,
    max: 64,
    action: "관망",
    label: "관망 / 보유관리",
    description: "방향성이 확실하지 않아 신규 진입은 신중하게 볼 구간입니다.",
  },
  {
    min: 35,
    max: 49,
    action: "회피",
    label: "신규매수 보류",
    description: "상승 근거보다 불확실성이 커 신규 접근은 보류하는 구간입니다.",
  },
  {
    min: 0,
    max: 34,
    action: "보유관리",
    label: "보유관리 / 청산 검토",
    description: "하락 또는 위험 신호가 강해 보유 비중 관리가 필요한 구간입니다.",
  },
];

export const INDICATOR_SCORE_TABLE = {
  trend: {
    label: "추세선",
    maxScore: 25,
  },
  price: {
    label: "가격 위치",
    maxScore: 20,
  },
  macd: {
    label: "MACD",
    maxScore: 20,
  },
  rsi: {
    label: "RSI",
    maxScore: 20,
  },
  bollinger: {
    label: "볼린저밴드",
    maxScore: 15,
  },
} as const;

export const RISK_PENALTY_TABLE = {
  rsiOverheated: {
    label: "RSI 과열",
    penalty: 8,
  },
  bollingerUpperRisk: {
    label: "볼린저밴드 상단 과열",
    penalty: 6,
  },
  macdWeak: {
    label: "MACD 약화",
    penalty: 6,
  },
  belowSma60: {
    label: "60일선 하회",
    penalty: 10,
  },
} as const;

export const PRICE_RANGE_TABLE: Record<
  MarketRegime,
  {
    regimeAdjustmentPercent: number;
    volatilityMultiplierLower: number;
    volatilityMultiplierUpper: number;
    minBandPercent: number;
    maxUpperCapPercent: number;
  }
> = {
  uptrend: {
    regimeAdjustmentPercent: 2.5,
    volatilityMultiplierLower: 1.2,
    volatilityMultiplierUpper: 2.2,
    minBandPercent: 2.5,
    maxUpperCapPercent: 18,
  },
  sideways: {
    regimeAdjustmentPercent: 0,
    volatilityMultiplierLower: 1.4,
    volatilityMultiplierUpper: 1.6,
    minBandPercent: 2.5,
    maxUpperCapPercent: 12,
  },
  downtrend: {
    regimeAdjustmentPercent: -2.5,
    volatilityMultiplierLower: 1.8,
    volatilityMultiplierUpper: 1.1,
    minBandPercent: 3,
    maxUpperCapPercent: 8,
  },
};

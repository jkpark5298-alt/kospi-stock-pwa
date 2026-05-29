import type { ChartRow } from "./stock";

export type MarketRegime = "uptrend" | "sideways" | "downtrend";

export type StrategyAction = "매수" | "관망" | "회피" | "보유관리";

export type StrategyIndicatorKey =
  | "trend"
  | "price"
  | "macd"
  | "rsi"
  | "bollinger";

export type StrategyScoreRow = {
  key: StrategyIndicatorKey;
  label: string;
  score: number;
  maxScore: number;
  status: "positive" | "neutral" | "negative" | "risk";
  reason: string;
};

export type StrategyRegimeRule = {
  regime: MarketRegime;
  label: string;
  description: string;
  minScore: number;
};

export type StrategyInterpretationRule = {
  min: number;
  max: number;
  action: StrategyAction;
  label: string;
  description: string;
};

export type StrategyRiskPenalty = {
  key: string;
  label: string;
  penalty: number;
  active: boolean;
  reason: string;
};

export type TechnicalStrategyResult = {
  available: boolean;
  regime: MarketRegime;
  regimeLabel: string;
  regimeDescription: string;
  commonScore: number;
  regimeBonus: number;
  riskPenalty: number;
  finalScore: number;
  action: StrategyAction;
  actionLabel: string;
  actionDescription: string;
  rows: StrategyScoreRow[];
  riskPenalties: StrategyRiskPenalty[];
  latest: ChartRow | null;
  summary: string;
};

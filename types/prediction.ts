export type PredictionHorizon = "5d" | "20d" | "60d";

export type PredictionResult = {
  expectedPrice: number | null;
  actualPrice: number | null;
  errorRate: number | null;
  directionHit: boolean | null;
  verifiedAt: string | null;
};

export type PredictionRecord = {
  id: string;
  symbol: string;
  name: string;
  predictedAt: string;
  currentPrice: number;
  conservativeTarget: number | null;
  baseTarget: number | null;
  aggressiveTarget: number | null;
  riskLine: number | null;
  totalScore: number | null;
  quantScore: number | null;
  results: Record<PredictionHorizon, PredictionResult>;
};

export type PredictionStats = {
  total: number;
  verified: number;
  hitRate: number | null;
  avgErrorRate: number | null;
};

export const PREDICTION_HORIZONS: Array<{
  key: PredictionHorizon;
  label: string;
  days: number;
}> = [
  { key: "5d", label: "5일", days: 5 },
  { key: "20d", label: "20일", days: 20 },
  { key: "60d", label: "60일", days: 60 },
];

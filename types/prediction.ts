export type PredictionHorizon = "5d" | "20d" | "60d";

export type PredictionHorizonConfig = {
  key: PredictionHorizon;
  label: string;
  days: number;
};

export const PREDICTION_HORIZONS: PredictionHorizonConfig[] = [
  {
    key: "5d",
    label: "5일",
    days: 5,
  },
  {
    key: "20d",
    label: "20일",
    days: 20,
  },
  {
    key: "60d",
    label: "60일",
    days: 60,
  },
];

export type PredictionResult = {
  expectedPrice: number | null;
  targetDate: string;
  actualPrice: number | null;
  errorRate: number | null;
  directionHit: boolean | null;
};

export type PredictionRecord = {
  id: string;
  syncCode?: string;
  symbol: string;
  name: string;
  predictedAt: string;
  currentPrice: number | null;
  scoreTotal: number | null;
  quantTotal: number | null;
  results: Record<PredictionHorizon, PredictionResult>;
};

export type PredictionStats = {
  total: number;
  verified: number;
  hitRate: number | null;
  avgErrorRate: number | null;
};
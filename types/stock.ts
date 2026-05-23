export type ChartRow = {
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

export type SupplySummary = {
  individualNetBuy: number;
  foreignNetBuy: number;
  institutionNetBuy: number;
  smartMoneyNetBuy: number;
};

export type SupplyData = {
  available: boolean;
  warning?: string;
  code?: string;
  rowCount?: number;
  recent5?: SupplySummary;
  recent20?: SupplySummary;
  foreignPositiveStreak5?: boolean;
  institutionPositiveStreak5?: boolean;
  smartMoneyPositiveStreak5?: boolean;
  latestRows?: Array<{
    date: string;
    individualNetBuy: number | null;
    foreignNetBuy: number | null;
    institutionNetBuy: number | null;
    programNetBuy: number | null;
  }>;
};

export type Fundamentals = {
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

export type EarningsGrowthSource = "none" | "manual" | "kis" | "dart" | "consensus";

export type EarningsGrowthMode = "auto" | "manual";

export type EarningsGrowthInput = {
  source?: EarningsGrowthSource;
  updatedAt?: string | null;

  lastYearNetIncome?: number | null;
  expectedNetIncome?: number | null;

  lastYearOperatingProfit?: number | null;
  expectedOperatingProfit?: number | null;

  lastYearEps?: number | null;
  expectedEps?: number | null;

  turnaround?: boolean | null;
  deficitReduction?: boolean | null;
};

export type ManualEarningsGrowthInput = {
  lastYearNetIncome: string;
  expectedNetIncome: string;
  lastYearOperatingProfit: string;
  expectedOperatingProfit: string;
  lastYearEps: string;
  expectedEps: string;
  turnaround: "" | "true" | "false";
  deficitReduction: "" | "true" | "false";
};

export type ManualEarningsGrowthStorageItem = {
  mode: EarningsGrowthMode;
  input: ManualEarningsGrowthInput;
  savedAt: string;
};

export type EarningsGrowthData = {
  available: boolean;
  excluded?: boolean;
  source: EarningsGrowthSource;
  mode: EarningsGrowthMode;
  appliedSourceLabel: string;
  updatedAt: string | null;
  warning?: string;

  lastYearNetIncome: number | null;
  expectedNetIncome: number | null;
  netIncomeGrowthRate: number | null;

  lastYearOperatingProfit: number | null;
  expectedOperatingProfit: number | null;
  operatingProfitGrowthRate: number | null;

  lastYearEps: number | null;
  expectedEps: number | null;
  epsGrowthRate: number | null;

  turnaround: boolean | null;
  deficitReduction: boolean | null;

  score: number | null;
  label: string;
  reasons: string[];
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

  earningsGrowth?: QuantScorePart;

  flags: {
    nearHigh52w: boolean;
    valuationBurden: boolean;
    targetAlmostReached: boolean;
    supplyPositive: boolean;
    momentumPositive: boolean;
    trendPositive: boolean;
    tradingValuePositive: boolean;
    volatilityHigh: boolean;
    earningsGrowthPositive?: boolean;
  };
};

export type ScorePart = {
  available: boolean;
  score: number | null;
  label: string;
  reasons: string[];
};

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

export type TargetMode = "conservative" | "base" | "aggressive";

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

export type CompositeScore = {
  total: number | null;
  grade: string;
  comment: string;

  technical: ScorePart;
  volume: ScorePart;
  supply: ScorePart;
  targetPrice: ScorePart & {
    technicalTargetRange: TargetPriceRange | null;
    targetBasis: TargetBasis | null;
    supplyAdjustedTarget: number | null;
    consensusTarget: null;
    riskLine: number | null;
    valuationTargetRange?: ValuationTargetRange | null;
    finalTargetRange?: TargetPriceRange | null;
    selectedTargetMode?: TargetMode;
    targetModes?: TargetModeResult[];
  };
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

export type StockResponse = {
  ok?: boolean;
  symbol?: string;
  rawSymbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  currentPrice?: number;
  prevPrice?: number;
  changePrice?: number;
  change?: number;
  signalSummary?: string;
  chartData?: ChartRow[];
  forecast?: number[];
  fearGreed?: {
    score: number;
    label: string;
  };
  fundamentals?: Fundamentals;
  earningsGrowth?: EarningsGrowthData;
  supply?: SupplyData;
  score?: CompositeScore;
  quant?: QuantModelResult;
  cached?: boolean;
  cacheSource?: string;
  warning?: string;
  blocked?: boolean;
  error?: string;
  detail?: string;
  status?: number;
  meta?: {
    cached?: boolean;
    cacheSource?: string | null;
    warning?: string | null;
    updatedAt?: string;
    range?: string;
    source?: string;
  };
};

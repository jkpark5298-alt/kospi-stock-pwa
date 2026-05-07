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

export type EarningsGrowthData = {
  available: boolean;
  source: "none" | "manual" | "kis" | "dart" | "consensus";
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

  /**
   * 아래 항목들은 2026-05 점수 모델 개선 때 추가된 항목입니다.
   * 기존 예측 저장 데이터와 호환되도록 선택값으로 둡니다.
   */
  trend?: QuantScorePart;
  tradingValue?: QuantScorePart;
  valuation: QuantScorePart;
  supply: QuantScorePart;
  volatility?: QuantScorePart;
  risk: QuantScorePart;
  target: QuantScorePart;

  /**
   * 실적 성장 점수는 데이터 소스 연결 전에는 없을 수 있습니다.
   */
  earningsGrowth?: QuantScorePart;

  flags: {
    nearHigh52w: boolean;
    valuationBurden: boolean;
    targetAlmostReached: boolean;
    supplyPositive: boolean;
    momentumPositive: boolean;

    /**
     * 아래 플래그들은 신규 퀀트 항목입니다.
     * 기존 저장 데이터와 호환되도록 선택값으로 둡니다.
     */
    trendPositive?: boolean;
    tradingValuePositive?: boolean;
    volatilityHigh?: boolean;
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

  /**
   * 신호 일치도는 신규 항목입니다.
   * 기존 저장 데이터와 호환되도록 선택값으로 둡니다.
   */
  signalAgreement?: number;

  /**
   * 실적 성장 점수는 다음 단계에서 연결할 항목입니다.
   */
  earningsGrowth?: number;
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

  /**
   * 신호 일치도는 신규 항목입니다.
   * 기존 예측 기록에는 없을 수 있으므로 선택값으로 둡니다.
   */
  signalAgreement?: ScorePart;

  /**
   * 실적 성장 점수는 다음 단계에서 연결할 항목입니다.
   */
  earningsGrowth?: ScorePart;

  baseWeights: ScoreWeights;
  appliedWeights: Partial<ScoreWeights>;
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

  /**
   * 실적 성장 점수 데이터입니다.
   * 아직 자동 수집 전이면 없거나 available=false일 수 있습니다.
   */
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

"use client";

import { useEffect, useState, type ReactNode } from "react";
import ChartAnalysisSections from "../components/chart/ChartAnalysisSections";
import { calculateTechnicalStrategy } from "../lib/technicalStrategy";
import CompositeScoreSection from "../components/analysis/CompositeScoreSection";
import EarningsGrowthSection from "../components/analysis/EarningsGrowthSection";
import TargetPriceSection from "../components/analysis/TargetPriceSection";
import DisclosureSection from "../components/analysis/DisclosureSection";
import FundamentalSnapshotSection from "../components/analysis/FundamentalSnapshotSection";
import ConsensusInputSection from "../components/analysis/ConsensusInputSection";
import TechnicalBasisExplanation from "../components/analysis/TechnicalBasisExplanation";
import ValuationBasisExplanation from "../components/analysis/ValuationBasisExplanation";
import SupplyAnalysisSection from "../components/analysis/SupplyAnalysisSection";
import RiskAnalysisSection from "../components/analysis/RiskAnalysisSection";
import CurrentStockSummaryCard from "../components/stock/CurrentStockSummaryCard";
import SummaryAbcOverviewSection from "../components/stock/SummaryAbcOverviewSection";
import PredictionDashboard from "../components/prediction/PredictionDashboard";
import { useKisUsage } from "../hooks/useKisUsage";
import { usePredictionHistory } from "../hooks/usePredictionHistory";

type ChartRow = {
  date: string;
  
  open?: number | null;
  high?: number | null;
  low?: number | null;close: number | null;
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

type SupplySummary = {
  individualNetBuy: number;
  foreignNetBuy: number;
  institutionNetBuy: number;
  smartMoneyNetBuy: number;
};

type SupplyData = {
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

type Fundamentals = {
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


type KisFundamentalsPayload = {
  ok: boolean;
  message?: string;
  normalizedCode?: string;
  data?: Partial<Fundamentals>;
  error?: string;
};

type ConsensusApiRecord = {
  symbol?: string | null;
  name?: string | null;
  baseDate?: string | null;
  averageTarget?: number | null;
  highTarget?: number | null;
  lowTarget?: number | null;
  opinion?: string | null;
  brokerCount?: number | null;
  reportCount?: number | null;
  source?: string | null;
  memo?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

type ConsensusApiPayload = {
  ok?: boolean;
  record?: ConsensusApiRecord | null;
  error?: string;
};


type EarningsGrowthSource = "none" | "manual" | "kis" | "dart" | "consensus";

type EarningsGrowthMode = "auto" | "manual";

type EarningsGrowthData = {
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

type QuantScorePart = {
  score: number;
  maxScore: number;
  label: string;
  reasons: string[];
};

type QuantModelResult = {
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

type ScorePart = {
  available: boolean;
  score: number | null;
  label: string;
  reasons: string[];
};

type ScoreWeights = {
  technical: number;
  volume: number;
  supply: number;
  targetPrice: number;
  signalAgreement: number;
  earningsGrowth: number;
};

type ScoreWeightAdjustment = {
  key: keyof ScoreWeights;
  label: string;
  baseWeight: number;
  appliedWeight: number | null;
  adjustmentPercent: number | null;
  status: "applied" | "excluded";
  reason: string;
};

type TargetPriceRange = {
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

type TargetBasisCandidate = {
  label: string;
  value: number;
  weight: number;
};

type TargetBasis = {
  method: string;
  summary: string;
  candidates: TargetBasisCandidate[];
  adjustments: string[];
};

type ValuationTargetRange = {
  epsTarget: number | null;
  bpsTarget: number | null;
  valuationTarget: number | null;
  perAdjustment: number | null;
  pbrAdjustment: number | null;
  method: string;
  reasons: string[];
};

type TargetMode = "conservative" | "base" | "aggressive";

type QuantTargetAdjustment = {
  mode: TargetMode;
  baseAdjustmentPercent: number;
  riskAdjustmentPercent: number;
  positiveAdjustmentPercent: number;
  totalAdjustmentPercent: number;
  reasons: string[];
};

type TargetModeResult = {
  mode: TargetMode;
  label: string;
  technicalWeight: number;
  valuationWeight: number;
  preAdjustmentTarget: number;
  finalTarget: number;
  upsidePercent: number;
  quantAdjustment: QuantTargetAdjustment;
};

type CompositeScore = {
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
    consensusTarget: number | null;
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

type StockResponseMeta = {
  cached?: boolean;
  cacheSource?: string | null;
  warning?: string | null;
  updatedAt?: string | null;
  range?: string | null;
  source?: string | null;
};

type StockResponse = {
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
  meta?: StockResponseMeta;
  blocked?: boolean;
  error?: string;
  detail?: string;
  status?: number;
};

type ManualEarningsGrowthInput = {
  lastYearNetIncome: string;
  expectedNetIncome: string;
  lastYearOperatingProfit: string;
  expectedOperatingProfit: string;
  lastYearEps: string;
  expectedEps: string;
  turnaround: "" | "true" | "false";
  deficitReduction: "" | "true" | "false";
};

type ManualEarningsGrowthStorageItem = {
  mode: EarningsGrowthMode;
  input: ManualEarningsGrowthInput;
  savedAt: string;
};

type ManualEarningsGrowthStorage = Record<string, ManualEarningsGrowthStorageItem>;

const EMPTY_MANUAL_EARNINGS_GROWTH: ManualEarningsGrowthInput = {
  lastYearNetIncome: "",
  expectedNetIncome: "",
  lastYearOperatingProfit: "",
  expectedOperatingProfit: "",
  lastYearEps: "",
  expectedEps: "",
  turnaround: "",
  deficitReduction: "",
};

const DEFAULT_SYMBOL = "005930.KS";
const DEFAULT_RANGE = "6mo";
const WATCHLIST_KEY = "kospi-watchlist";
const MANUAL_EARNINGS_STORAGE_KEY = "kospi-manual-earnings-growth";
const FUNDAMENTALS_CACHE_PREFIX = "kospi-kis-fundamentals";

function normalizeManualEarningsKey(value?: string | null) {
  return (value || "").trim().toUpperCase();
}

function getManualEarningsStorage(): ManualEarningsGrowthStorage {
  if (typeof window === "undefined") return {};

  try {
    const saved = window.localStorage.getItem(MANUAL_EARNINGS_STORAGE_KEY);

    if (!saved) return {};

    const parsed = JSON.parse(saved);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as ManualEarningsGrowthStorage;
  } catch {
    return {};
  }
}

function getStoredManualEarnings(
  ...keys: Array<string | null | undefined>
): ManualEarningsGrowthStorageItem | null {
  const storage = getManualEarningsStorage();

  for (const rawKey of keys) {
    const key = normalizeManualEarningsKey(rawKey);

    if (key && storage[key]) {
      return storage[key];
    }
  }

  return null;
}

function saveManualEarnings(
  input: ManualEarningsGrowthInput,
  mode: EarningsGrowthMode,
  ...keys: Array<string | null | undefined>
) {
  if (typeof window === "undefined") return null;

  const storage = getManualEarningsStorage();
  const savedAt = new Date().toISOString();
  let saved = false;

  keys.forEach((rawKey) => {
    const key = normalizeManualEarningsKey(rawKey);

    if (!key) return;

    storage[key] = {
      mode,
      input,
      savedAt,
    };
    saved = true;
  });

  if (!saved) return null;

  window.localStorage.setItem(
    MANUAL_EARNINGS_STORAGE_KEY,
    JSON.stringify(storage),
  );

  return savedAt;
}

function removeManualEarnings(...keys: Array<string | null | undefined>) {
  if (typeof window === "undefined") return;

  const storage = getManualEarningsStorage();
  let removed = false;

  keys.forEach((rawKey) => {
    const key = normalizeManualEarningsKey(rawKey);

    if (!key) return;

    if (storage[key]) {
      delete storage[key];
      removed = true;
    }
  });

  if (removed) {
    window.localStorage.setItem(
      MANUAL_EARNINGS_STORAGE_KEY,
      JSON.stringify(storage),
    );
  }
}

function hasManualEarningsValue(input: ManualEarningsGrowthInput) {
  return Object.values(input).some((value) => value.trim() !== "");
}

export default function HomePage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);
  const [data, setData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uiError, setUiError] = useState("");
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [manualEarningsGrowth, setManualEarningsGrowth] =
    useState<ManualEarningsGrowthInput>(EMPTY_MANUAL_EARNINGS_GROWTH);
  const [earningsGrowthMode, setEarningsGrowthMode] =
    useState<EarningsGrowthMode>("auto");
  const [manualEarningsSavedAt, setManualEarningsSavedAt] = useState<
    string | null
  >(null);
  const {
    kisRemainingCalls,
    kisSyncCode,
    kisSyncInput,
    kisUsageLoading,
    kisUsageError,
    setKisSyncInput,
    saveKisSyncCode,
    recordKisApiUsageFromResponse,
  } = useKisUsage();
  const {
    records: predictionRecords,
    loading: predictionLoading,
    error: predictionError,
    savePrediction,
    verifyPredictions,
    clearCurrentSymbolPredictions,
    clearAllPredictions,
  } = usePredictionHistory(kisSyncCode);

  async function handleSavePrediction() {
    if (!data) return;
    await savePrediction(data);
  }

  async function handleVerifyPredictions() {
    await verifyPredictions();
  }

  async function handleClearCurrentSymbolPredictions() {
    if (!data?.symbol) return;
    await clearCurrentSymbolPredictions(data.symbol);
  }

  async function handleClearAllPredictions() {
    await clearAllPredictions();
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WATCHLIST_KEY);

      if (!saved) {
        setWatchlistLoaded(true);
        return;
      }

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        const normalized = parsed
          .filter((item) => typeof item === "string")
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean);

        setWatchlist(Array.from(new Set(normalized)));
      } else {
        window.localStorage.removeItem(WATCHLIST_KEY);
      }
    } catch {
      window.localStorage.removeItem(WATCHLIST_KEY);
    } finally {
      setWatchlistLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!watchlistLoaded) return;

    try {
      if (watchlist.length > 0) {
        window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
      } else {
        window.localStorage.removeItem(WATCHLIST_KEY);
      }
    } catch {
      // localStorage 접근이 막힌 환경에서는 조용히 무시합니다.
    }
  }, [watchlist, watchlistLoaded]);

  async function fetchStock(
    targetSymbol?: string,
    targetRange?: string,
    targetEarningsGrowthMode?: EarningsGrowthMode,
    targetManualInput?: ManualEarningsGrowthInput,
    skipStoredRefetch = false,
  ) {
    const finalSymbol = (targetSymbol ?? symbol).trim();
    const finalRange = targetRange ?? range;
    const storedManual = getStoredManualEarnings(finalSymbol);
    const effectiveManualInput =
      targetManualInput ??
      storedManual?.input ??
      EMPTY_MANUAL_EARNINGS_GROWTH;
    const finalEarningsGrowthMode =
      targetEarningsGrowthMode ?? storedManual?.mode ?? earningsGrowthMode;

    if (!finalSymbol) {
      setUiError("종목 코드를 입력해 주세요.");
      setData(null);
      return;
    }

    setLoading(true);
    setUiError("");

    try {
      const params = new URLSearchParams({
        symbol: finalSymbol,
        range: finalRange,
      });

      params.set("earningsGrowthMode", finalEarningsGrowthMode);
      appendManualEarningsParams(params, effectiveManualInput);

      const res = await fetch(`/api/stock?${params.toString()}`, {
        cache: "no-store",
      });

      const json: StockResponse = await res.json();

      if (!res.ok) {
        setData(json);
        if (json.blocked) {
          setUiError(
            "현재 주가 서버가 요청을 제한하고 있습니다. 잠시 후 다시 시도해 주세요.",
          );
        } else {
          setUiError(json.error || "주가 데이터를 불러오지 못했습니다.");
        }
        return;
      }

      let enrichedJson = await refreshKisFundamentalsAfterAnalyze(
        json,
        finalSymbol,
      );

      enrichedJson = await refreshConsensusAfterAnalyze(enrichedJson, finalSymbol);

      const restored = getStoredManualEarnings(
        enrichedJson.symbol,
        enrichedJson.rawSymbol,
        enrichedJson.name,
        finalSymbol,
      );

      if (restored) {
        const restoredSavedAt =
          restored.savedAt ||
          saveManualEarnings(
            restored.input,
            restored.mode,
            enrichedJson.symbol,
            enrichedJson.rawSymbol,
            enrichedJson.name,
            finalSymbol,
          ) ||
          new Date().toISOString();

        setManualEarningsGrowth(restored.input);
        setEarningsGrowthMode(restored.mode);
        setManualEarningsSavedAt(restoredSavedAt);

        const currentRequestHadManualInput =
          hasManualEarningsValue(effectiveManualInput);

        if (!currentRequestHadManualInput && !skipStoredRefetch) {
          await fetchStock(
            enrichedJson.symbol || finalSymbol,
            finalRange,
            restored.mode,
            restored.input,
            true,
          );
          return;
        }
      } else {
        setManualEarningsGrowth(EMPTY_MANUAL_EARNINGS_GROWTH);
        setEarningsGrowthMode(targetEarningsGrowthMode ?? "auto");
        setManualEarningsSavedAt(null);
      }

      setData(enrichedJson);
      setLastFetchedAt(new Date().toISOString());

      await recordKisApiUsageFromResponse(enrichedJson);
    } catch (error: unknown) {
      setData(null);
      setUiError(
        error instanceof Error
          ? error.message
          : "주가 데이터를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleAnalyze() {
    fetchStock();
  }

  function handleSaveManualEarningsGrowth() {
    const savedAt = saveManualEarnings(
      manualEarningsGrowth,
      earningsGrowthMode,
      data?.symbol,
      data?.rawSymbol,
      data?.name,
      symbol,
    );

    if (savedAt) {
      setManualEarningsSavedAt(savedAt);
    }
  }

  function handleApplyManualEarningsGrowth() {
    const savedAt = saveManualEarnings(
      manualEarningsGrowth,
      earningsGrowthMode,
      data?.symbol,
      data?.rawSymbol,
      data?.name,
      symbol,
    );

    if (savedAt) {
      setManualEarningsSavedAt(savedAt);
    }

    fetchStock(undefined, undefined, earningsGrowthMode, manualEarningsGrowth);
  }

  function handleClearManualEarningsGrowth() {
    removeManualEarnings(data?.symbol, data?.rawSymbol, data?.name, symbol);
    setManualEarningsGrowth(EMPTY_MANUAL_EARNINGS_GROWTH);
    setManualEarningsSavedAt(null);
    setEarningsGrowthMode("auto");
  }

  function handleEarningsGrowthModeChange(nextMode: EarningsGrowthMode) {
    setEarningsGrowthMode(nextMode);

    if (hasManualEarningsValue(manualEarningsGrowth)) {
      const savedAt = saveManualEarnings(
        manualEarningsGrowth,
        nextMode,
        data?.symbol,
        data?.rawSymbol,
        data?.name,
        symbol,
      );

      if (savedAt) {
        setManualEarningsSavedAt(savedAt);
      }
    }

    if (data?.symbol) {
      fetchStock(data.symbol, range, nextMode, manualEarningsGrowth);
    }
  }

  function handleSaveWatchlist() {
    const trimmed = symbol.trim().toUpperCase();

    if (!trimmed) {
      alert("저장할 종목 코드를 입력해 주세요.");
      return;
    }

    setWatchlist((prev) => {
      if (prev.includes(trimmed)) {
        alert("이미 저장한 관심종목입니다.");
        return prev;
      }

      return [...prev, trimmed];
    });
  }

  function handleDeleteWatchlist(item: string) {
    setWatchlist((prev) => prev.filter((v) => v !== item));
  }

  function handleSelectWatchlist(item: string) {
    setSymbol(item);
    fetchStock(item, range);
  }  const kisUsedCalls = Math.max(0, 100 - kisRemainingCalls);
  const kisUsageTone =
    kisRemainingCalls <= 0 ? "danger" : kisRemainingCalls <= 30 ? "warning" : "normal";



  const chartData = data?.chartData ?? [];

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="hero">
          <div>
            <p className="eyebrow">KOSPI TECHNICAL DASHBOARD</p>
            <h1 className="hero-title">KOSPI Stock PWA</h1>
            <p className="hero-subtitle">
              코스피 국내 주식 분석 + 관심종목 저장 + PWA 설치 지원
            </p>
          </div>
          <div className="hero-badge">모바일 최적화</div>
        </header>

        <section className="top-grid">
          <Card>
            <SectionTitle>종목 분석</SectionTitle>

            <div className="search-form">
              <input
                className="form-control stock-input"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAnalyze();
                }}
                placeholder="예: 삼성전자 / 005930 / 일진전기 / 103590"
              />

              <select
                className="form-control range-select"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="1mo">1개월</option>
                <option value="3mo">3개월</option>
                <option value="6mo">6개월</option>
                <option value="1y">1년</option>
              </select>

              <button
                className="button primary-button"
                onClick={handleAnalyze}
                disabled={loading}
              >
                {loading ? "불러오는 중..." : "분석하기"}
              </button>

              <button
                className="button secondary-button"
                onClick={handleSaveWatchlist}
              >
                관심종목 저장
              </button>
            </div>

                        <div className={`top-kis-usage-card kis-usage-${kisUsageTone}`}>
              <div>
                <span>KIS API 잔여 호출</span>
                <strong>
                  {kisSyncCode
                    ? `${kisRemainingCalls} / 100회 남음`
                    : "동기화 코드 필요"}
                </strong>
                <em>
                  {kisSyncCode
                    ? `오늘 사용 ${kisUsedCalls}회 · 동기화 코드: ${kisSyncCode}`
                    : "예측 대시보드에서 동기화 코드를 저장하면 호출 수를 표시합니다."}
                </em>
              </div>
              {kisUsageLoading ? <small>조회 중...</small> : null}
              {kisUsageError ? <small>{kisUsageError}</small> : null}
            </div>

            <StockIdentity data={data} inputSymbol={symbol} />

            <StatusMessage data={data} uiError={uiError} />
          </Card>

          <Card>
            <SectionTitle>관심종목</SectionTitle>

            <div className="watch-list">
              {watchlist.length === 0 ? (
                <p className="muted-text">저장된 관심종목이 없습니다.</p>
              ) : (
                watchlist.map((item) => (
                  <div key={item} className="watch-item">
                    <button
                      className="watch-symbol"
                      onClick={() => handleSelectWatchlist(item)}
                    >
                      {item}
                    </button>

                    <button
                      className="watch-delete"
                      onClick={() => handleDeleteWatchlist(item)}
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>

            <p className="watch-tip">
              한글 종목명 또는 6자리 종목코드 입력 가능: 삼성전자 / 005930 /
              일진전기 / 103590
            </p>
          </Card>
        </section>

        <SectionGroup
          eyebrow="SUMMARY"
          title="요약"
          description="현재 종목의 핵심 상태를 먼저 확인합니다. 세부 근거는 아래 Detail 영역에서 A/B/C 기준가와 수급·위험으로 나누어 확인합니다."
        >
          <section className="summary-grid summary-grid-four">
            <InfoCard title="현재가">
              <BigValue>{formatNumber(data?.currentPrice)}</BigValue>
            </InfoCard>

            <InfoCard title="전일 대비 %">
              <BigValue tone={getChangeTone(data?.change)}>
                {formatPercent(data?.change)}
              </BigValue>
            </InfoCard>

            <InfoCard title="전일 대비 가격">
              <BigValue tone={getChangeTone(data?.changePrice)}>
                {formatSignedNumber(data?.changePrice)}
              </BigValue>
            </InfoCard>

            <InfoCard title="기술적 분석">
              <div className="signal-text">
                {data?.signalSummary || "데이터 없음"}
              </div>
            </InfoCard>
          </section>

          <section className="score-section">
            <CurrentStockSummaryCard data={data} />
          </section>

          <SummaryAbcOverviewSection data={data} />

        {/* 추정가 세부 분석 확인 */}
        <section className="detail-simple-panel" aria-label="추정가 세부 분석 확인">
          <div className="detail-simple-heading">
            <strong>추정가 세부 분석 확인</strong>
          </div>

          <div className="detail-simple-grid">
            <SectionGroup
                                  eyebrow="DETAIL 1"
                                  title="A. 기술적 분석"
                                  description=""
                                >
                                  <DetailCalculationEvidence kind="technical" data={data} />
                        
                                  <ChartAnalysisSections data={data} rows={chartData} />
                        
                                </SectionGroup>

            <SectionGroup
                                  eyebrow="DETAIL 2"
                                  title="B. 실적 분석"
                                  description=""
                                >
                                  <DetailCalculationEvidence kind="valuation" data={data} />
                        
                                  <ValuationBasisExplanation data={data} />
                        
                                  <FundamentalSnapshotSection
                                    symbol={data?.symbol}
                                    name={data?.name}
                                    valuationTarget={data?.score?.targetPrice?.valuationTargetRange?.valuationTarget}
                                    data={data}
                                    lastFetchedAt={lastFetchedAt}
                                  />
                        
                                  <EarningsGrowthSection
                                    earningsGrowth={data?.earningsGrowth}
                                    earningsGrowthMode={earningsGrowthMode}
                                    manualInput={manualEarningsGrowth}
                                    manualInputSavedAt={manualEarningsSavedAt}
                                    onModeChange={handleEarningsGrowthModeChange}
                                    onManualInputChange={setManualEarningsGrowth}
                                    onSaveManualInput={handleSaveManualEarningsGrowth}
                                    onApplyManualInput={handleApplyManualEarningsGrowth}
                                    onClearManualInput={handleClearManualEarningsGrowth}
                                  />
                                </SectionGroup>

            <SectionGroup
                                  eyebrow="DETAIL 3"
                                  title="C. 컨센서스"
                                  description=""
                                >
                                  <DetailCalculationEvidence kind="consensus" data={data} />
                        
                                  <ConsensusInputSection
                                    symbol={data?.symbol}
                                    name={data?.name}
                                    appTargetPrice={
                                      data?.score?.targetPrice?.finalTargetRange?.baseTarget ??
                                      data?.score?.targetPrice?.technicalTargetRange?.baseTarget
                                    }
                                              currentPrice={data?.currentPrice}
                                    targetPrice={data?.score?.targetPrice}
                                    fundamentals={data?.fundamentals}
                                  />
                                </SectionGroup>

            <SectionGroup
                                  eyebrow="DETAIL 4"
                                  title="D. 수급 보정"
                                  description=""
                                >
                                  <DetailCalculationEvidence kind="positive" data={data} />
                        
                                  <SupplyAnalysisSection data={data} />
                                </SectionGroup>

            <SectionGroup
                                  eyebrow="DETAIL 5"
                                  title="E. 위험 보정"
                                  description=""
                                >
                                  <DetailCalculationEvidence kind="risk" data={data} />
                        
                                  <RiskAnalysisSection data={data} />
                        
                                  <DisclosureSection symbol={data?.symbol} name={data?.name} />
                        
                                  <PredictionDashboard
                                    data={data}
                                    records={predictionRecords}
                                    predictionLoading={predictionLoading}
                                    predictionError={predictionError}
                                    lastFetchedAt={lastFetchedAt}
                                    kisRemainingCalls={kisRemainingCalls}
                                    kisSyncCode={kisSyncCode}
                                    kisSyncInput={kisSyncInput}
                                    kisUsageLoading={kisUsageLoading}
                                    kisUsageError={kisUsageError}
                                    onKisSyncInputChange={setKisSyncInput}
                                    onSaveKisSyncCode={saveKisSyncCode}
                                    onSavePrediction={handleSavePrediction}
                                    onVerifyPredictions={handleVerifyPredictions}
                                    onClearCurrentSymbol={handleClearCurrentSymbolPredictions}
                                    onClearAll={handleClearAllPredictions}
                                  />
                                </SectionGroup>
          </div>
        </section>

<TargetPriceSection score={data?.score} lastFetchedAt={lastFetchedAt} rows={chartData} />

          <CompositeScoreSection score={data?.score} />
        </SectionGroup>

</div>
    </main>
  );
}


async function refreshConsensusAfterAnalyze(
  stock: StockResponse,
  requestedSymbol: string,
): Promise<StockResponse> {
  const targetSymbol = stock.symbol || stock.rawSymbol || requestedSymbol;

  if (!targetSymbol || typeof window === "undefined") {
    return stock;
  }

  try {
    const response = await fetch(
      `/api/consensus?symbol=${encodeURIComponent(targetSymbol)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as ConsensusApiPayload;
    const consensusTarget = toNullableNumber(payload.record?.averageTarget);

    if (!response.ok || !payload.ok || consensusTarget == null || consensusTarget <= 0) {
      return stock;
    }

    return {
      ...stock,
      score: stock.score
        ? {
            ...stock.score,
            targetPrice: {
              ...stock.score.targetPrice,
              consensusTarget,
            },
          }
        : stock.score,
    };
  } catch {
    return stock;
  }
}

async function refreshKisFundamentalsAfterAnalyze(
  stock: StockResponse,
  requestedSymbol: string,
): Promise<StockResponse> {
  const targetSymbol = stock.symbol || stock.rawSymbol || requestedSymbol;

  if (!targetSymbol || typeof window === "undefined") {
    return stock;
  }

  try {
    const response = await fetch(
      `/api/kis/fundamentals?symbol=${encodeURIComponent(targetSymbol)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as KisFundamentalsPayload;

    if (!payload.ok || !payload.data || !hasUsableFundamentals(payload.data)) {
      removeLocalCache(makeLocalCacheKey(FUNDAMENTALS_CACHE_PREFIX, targetSymbol));
      return stock;
    }

    const savedAt = new Date().toISOString();
    const normalized = normalizeFundamentals(payload.data);
    const cachePayload: KisFundamentalsPayload = {
      ...payload,
      data: normalized,
    };

    writeLocalCache(makeLocalCacheKey(FUNDAMENTALS_CACHE_PREFIX, targetSymbol), {
      savedAt,
      data: cachePayload,
    });

    if (stock.symbol && stock.symbol !== targetSymbol) {
      writeLocalCache(makeLocalCacheKey(FUNDAMENTALS_CACHE_PREFIX, stock.symbol), {
        savedAt,
        data: cachePayload,
      });
    }

    return {
      ...stock,
      fundamentals: {
        ...stock.fundamentals,
        ...normalized,
      },
    };
  } catch {
    return stock;
  }
}

function normalizeFundamentals(value: Partial<Fundamentals>): Fundamentals {
  return {
    marketCap: toNullableNumber(value.marketCap),
    per: toNullableNumber(value.per),
    pbr: toNullableNumber(value.pbr),
    eps: toNullableNumber(value.eps),
    bps: toNullableNumber(value.bps),
    dividendYield: toNullableNumber(value.dividendYield),
    foreignOwnershipRate: toNullableNumber(value.foreignOwnershipRate),
    sharesOutstanding: toNullableNumber(value.sharesOutstanding),
    high52w: toNullableNumber(value.high52w),
    low52w: toNullableNumber(value.low52w),
  };
}

function hasUsableFundamentals(value?: Partial<Fundamentals> | null) {
  if (!value) return false;

  return [value.per, value.pbr, value.eps, value.bps].some(
    (item) => typeof item === "number" && Number.isFinite(item) && item > 0,
  );
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function makeLocalCacheKey(prefix: string, symbol?: string | null) {
  return `${prefix}:${(symbol || "").trim().toUpperCase()}`;
}

function writeLocalCache<T>(key: string, value: { savedAt: string; data: T }) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage 저장이 실패해도 분석 결과 표시는 계속 진행합니다.
  }
}

function removeLocalCache(key: string) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // localStorage 삭제 실패는 조용히 무시합니다.
  }
}


function appendManualEarningsParams(
  params: URLSearchParams,
  input: ManualEarningsGrowthInput,
) {
  const entries: Array<[keyof ManualEarningsGrowthInput, string]> = [
    ["lastYearNetIncome", input.lastYearNetIncome],
    ["expectedNetIncome", input.expectedNetIncome],
    ["lastYearOperatingProfit", input.lastYearOperatingProfit],
    ["expectedOperatingProfit", input.expectedOperatingProfit],
    ["lastYearEps", input.lastYearEps],
    ["expectedEps", input.expectedEps],
    ["turnaround", input.turnaround],
    ["deficitReduction", input.deficitReduction],
  ];

  entries.forEach(([key, value]) => {
    const trimmed = value.trim();

    if (trimmed) {
      params.set(key, trimmed);
    }
  });
}

function DataSourceBadge({ data }: { data: StockResponse | null }) {
  if (!data) return null;

  const meta = data.meta ?? {};
  const source = meta.source ?? "";
  const cached = Boolean(data.cached || meta.cached);
  const cacheSource = data.cacheSource ?? meta.cacheSource ?? null;
  const updatedAt = meta.updatedAt ?? null;

  const chartRows = Array.isArray(data.chartData) ? data.chartData : [];
  const latestRow = chartRows.length ? chartRows[chartRows.length - 1] : null;

  const hasOhlc =
    latestRow?.open != null &&
    latestRow?.high != null &&
    latestRow?.low != null &&
    latestRow?.close != null;

  const fundamentals = data.fundamentals as Record<string, unknown> | undefined;
  const hasFundamentals = fundamentals
    ? Object.values(fundamentals).some(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    : false;

  const priceSourceLabel = hasOhlc
    ? source.includes("KIS daily")
      ? "Yahoo 차트 + KIS 일봉 보강"
      : source.includes("Yahoo")
        ? "Yahoo 가격 데이터"
        : "가격 데이터"
    : "가격 데이터 확인 필요";

  const valuationSourceLabel = hasFundamentals
    ? "KIS fundamentals / 캐시 데이터"
    : "데이터 없음";

  const cacheLabel = cached
    ? cacheSource
      ? `캐시 사용: ${cacheSource}`
      : "캐시 사용"
    : "실시간 조회";

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString("ko-KR")
    : "업데이트 시간 확인 중";

  return (
    <section
      aria-label="데이터 출처"
      style={{
        margin: "12px 0 18px",
        padding: "14px 16px",
        borderRadius: 18,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ display: "block", color: "#0f172a", fontSize: 15 }}>
            데이터 출처
          </strong>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            KIS 호출 제한 시 가격 데이터는 Yahoo OHLC로 보완하고, 실적·밸류는 마지막 성공 캐시를 우선 사용합니다.
          </p>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 800,
            color: cached ? "#92400e" : "#166534",
            background: cached ? "#fffbeb" : "#f0fdf4",
            border: cached ? "1px solid #facc15" : "1px solid #bbf7d0",
          }}
        >
          {cacheLabel}
        </span>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <span style={{ display: "block", color: "#64748b", fontSize: 12, fontWeight: 800 }}>
            가격 데이터
          </span>
          <strong style={{ display: "block", marginTop: 4, color: "#0f172a", fontSize: 14 }}>
            {priceSourceLabel}
          </strong>
          <small style={{ color: "#64748b" }}>
            open/high/low/close/volume 기준
          </small>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 14,
            background: hasFundamentals ? "#f0fdf4" : "#f8fafc",
            border: hasFundamentals ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
          }}
        >
          <span style={{ display: "block", color: "#64748b", fontSize: 12, fontWeight: 800 }}>
            실적·밸류
          </span>
          <strong
            style={{
              display: "block",
              marginTop: 4,
              color: hasFundamentals ? "#166534" : "#64748b",
              fontSize: 14,
            }}
          >
            {valuationSourceLabel}
          </strong>
          <small style={{ color: "#64748b" }}>
            PER/PBR/EPS/BPS 기준
          </small>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 14,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <span style={{ display: "block", color: "#64748b", fontSize: 12, fontWeight: 800 }}>
            업데이트
          </span>
          <strong style={{ display: "block", marginTop: 4, color: "#0f172a", fontSize: 14 }}>
            {updatedLabel}
          </strong>
          <small style={{ color: "#64748b" }}>
            분석 API 응답 기준
          </small>
        </div>
      </div>
    </section>
  );
}

function StockIdentity({
  data,
  inputSymbol,
}: {
  data: StockResponse | null;
  inputSymbol: string;
}) {
  const displaySymbol =
    data?.symbol || inputSymbol.trim().toUpperCase() || "종목 코드 없음";
  const displayName = data?.name || "종목명은 분석 후 표시됩니다.";
  const metaItems = [displaySymbol, data?.exchange, data?.currency].filter(
    Boolean,
  );

  return (
    <div className="stock-identity">
      <div className="stock-name">{displayName}</div>
      <div className="stock-meta">{metaItems.join(" · ")}</div>
    </div>
  );
}

function StatusMessage({
  data,
  uiError,
}: {
  data: StockResponse | null;
  uiError: string;
}) {
  if (uiError) return <p className="status-message error-message">{uiError}</p>;
  if (data?.warning)
    return <p className="status-message warning-message">{data.warning}</p>;
  if (data?.cached)
    return (
      <p className="status-message info-message">
        캐시 데이터로 표시 중입니다.
      </p>
    );
  return (
    <p className="status-message muted-text">
      종목명 또는 종목코드를 입력하고 분석하기를 눌러주세요.
    </p>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="info-card">
      <div className="info-label">{title}</div>
      {children}
    </div>
  );
}

function BigValue({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "positive" | "negative" | "neutral";
}) {
  return <div className={`big-value ${tone}`}>{children}</div>;
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

function SectionTitleSmall({ children }: { children: ReactNode }) {
  return <h3 className="section-title small">{children}</h3>;
}

type DetailCalculationKind = "technical" | "valuation" | "consensus" | "positive" | "risk";

function DetailCalculationEvidence({
  kind,
  data,
}: {
  kind: DetailCalculationKind;
  data?: any;
}) {
  const targetPrice = data?.score?.targetPrice;
  const currentPrice = pickDetailNumber(data?.currentPrice, data?.price, data?.close);

  const chartRowsForTechnicalDetail = Array.isArray(data?.chartData) ? data.chartData : [];
  const technicalStrategyForDetail = calculateTechnicalStrategy(chartRowsForTechnicalDetail);
  const technicalStrategyBasePrice = pickDetailNumber(
    technicalStrategyForDetail.priceRange.basePrice,
  );
  const technicalTarget =
    technicalStrategyBasePrice ??
    pickDetailNumber(
      targetPrice?.technicalTargetRange?.baseTarget,
      targetPrice?.technicalTargetRange?.technicalTarget,
      targetPrice?.technicalTarget,
    );

  const valuationTarget = pickDetailNumber(
    targetPrice?.valuationTargetRange?.valuationTarget,
    targetPrice?.valuationTargetRange?.baseTarget,
    targetPrice?.valuationTarget,
  );

  const consensusTarget = pickDetailNumber(
    targetPrice?.consensusTargetRange?.consensusTarget,
    targetPrice?.consensusTargetRange?.averageTarget,
    targetPrice?.consensusTarget,
  );

  const basisAverage =
    pickDetailNumber(targetPrice?.basisAverage, targetPrice?.finalTargetRange?.baseTarget) ??
    calculateWeightedBasis(technicalTarget, valuationTarget, consensusTarget);

  const positivePercent =
    pickDetailNumber(targetPrice?.positiveSignalAdjustmentPercent, targetPrice?.supplyAdjustmentPercent) ?? 1.5;

  const riskPercent = pickDetailNumber(targetPrice?.riskAdjustmentPercent) ?? -5;

  const positiveAmount =
    basisAverage != null ? Math.round(basisAverage * (positivePercent / 100)) : null;
  const riskAmount =
    basisAverage != null ? Math.round(basisAverage * (riskPercent / 100)) : null;

  const detail = buildDetailCalculationEvidence({
    kind,
    currentPrice,
    technicalTarget,
    valuationTarget,
    consensusTarget,
    basisAverage,
    positivePercent,
    positiveAmount,
    riskPercent,
    riskAmount,
  });

  return (
    <div className="target-basis-box" style={{ marginBottom: 18 }}>
      <div className="target-basis-header">
        <span>{detail.label}</span>
        <strong>{detail.value}</strong>
      </div>

      <p className="target-basis-summary">{detail.summary}</p>

      <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
        {detail.items.map((item) => (
          <div className="target-metric-card" key={item.title}>
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <em>{item.description}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildDetailCalculationEvidence({
  kind,
  currentPrice,
  technicalTarget,
  valuationTarget,
  consensusTarget,
  basisAverage,
  positivePercent,
  positiveAmount,
  riskPercent,
  riskAmount,
}: {
  kind: DetailCalculationKind;
  currentPrice: number | null;
  technicalTarget: number | null;
  valuationTarget: number | null;
  consensusTarget: number | null;
  basisAverage: number | null;
  positivePercent: number;
  positiveAmount: number | null;
  riskPercent: number;
  riskAmount: number | null;
}) {
  if (kind === "technical") {
    return {
      label: "DETAIL 1 계산 근거",
      value: formatDetailWon(technicalTarget),
      summary:
        "A. 기본 기술적 추정가는 기술전략의 하단·기준·상단 중 기준값을 대표 기술적 추정가로 사용합니다. 아래 값은 계산 구조를 빠르게 확인하기 위한 요약입니다.",
      items: [
        { title: "현재 표시 기준가", value: formatDetailWon(technicalTarget), description: "기술전략 기준값" },
        { title: "기준 현재가", value: formatDetailWon(currentPrice), description: "분석 조회 시점 현재가" },
        { title: "계산 구조", value: "차트 신호 → 가격 환산", description: "이동평균, RSI, MACD, 볼린저밴드, OBV, 변동성 반영" },
        { title: "확인 위치", value: "차트 기준 결론", description: "아래 기술적 기준 종합 해석과 주가 차트에서 세부 근거 확인" },
      ],
    };
  }

  if (kind === "valuation") {
    return {
      label: "DETAIL 2 계산 근거",
      value: formatDetailWon(valuationTarget),
      summary:
        "B. 실적·밸류 기준가는 EPS 기준가와 BPS 기준가를 중심으로 PER/PBR 부담과 실적 성장률을 함께 반영해 산정합니다.",
      items: [
        { title: "현재 표시 기준가", value: formatDetailWon(valuationTarget), description: "EPS/PER + BPS/PBR 기반" },
        { title: "계산 구조", value: "EPS 기준 + BPS 기준", description: "이익가치와 자산가치를 함께 확인" },
        { title: "보정 요소", value: "PER/PBR 부담", description: "밸류 부담이 높으면 기준가를 보수적으로 해석" },
        { title: "확인 위치", value: "실적·밸류 기준가 분석", description: "아래 EPS, BPS, PER, PBR 근거에서 확인" },
      ],
    };
  }

  if (kind === "consensus") {
    return {
      label: "DETAIL 3 계산 근거",
      value: formatDetailWon(consensusTarget),
      summary:
        "C. 컨센서스 기준가는 증권사 목표가 데이터를 기준으로 평균 목표가, 최고·최저 목표가, 투자의견, 참여 증권사 수를 함께 확인합니다.",
      items: [
        { title: "현재 표시 기준가", value: formatDetailWon(consensusTarget), description: "평균 목표가 중심" },
        { title: "계산 구조", value: "평균 목표가", description: "증권사 리포트 목표가 취합" },
        { title: "신뢰 확인", value: "참여 증권사 수", description: "참여 수가 적으면 참고 수준으로 해석" },
        { title: "확인 위치", value: "컨센서스 입력·저장", description: "아래 평균·최고·최저 목표가와 투자의견에서 확인" },
      ],
    };
  }

  if (kind === "positive") {
    return {
      label: "DETAIL 4 계산식",
      value: formatDetailSignedAmount(positiveAmount),
      summary:
        "긍정 신호 보정은 수급만 보는 값이 아니라 수급, 모멘텀·추세, 거래량·거래대금의 긍정 신호를 합산한 보정입니다.",
      items: [
        { title: "기준가 가중평균", value: formatDetailWon(basisAverage), description: "A/B/C 기준가 가중평균" },
        { title: "보정률", value: formatDetailPercent(positivePercent), description: "긍정 신호 합산 보정률" },
        { title: "계산식", value: makeDetailFormula(basisAverage, positivePercent, positiveAmount), description: "기준가 가중평균 × 보정률" },
        { title: "보정금액", value: formatDetailSignedAmount(positiveAmount), description: "기술적 추정가에 가산" },
      ],
    };
  }

  return {
    label: "DETAIL 5 계산식",
    value: formatDetailSignedAmount(riskAmount),
    summary:
      "위험 보정은 과열, 변동성, 52주 고가 근접, 추정가 도달률, PER/PBR 부담 등을 반영해 기술적 추정가를 보수적으로 조정합니다.",
    items: [
      { title: "기준가 가중평균", value: formatDetailWon(basisAverage), description: "A/B/C 기준가 가중평균" },
      { title: "보정률", value: formatDetailPercent(riskPercent), description: "위험 신호 합산 보정률" },
      { title: "계산식", value: makeDetailFormula(basisAverage, riskPercent, riskAmount), description: "기준가 가중평균 × 보정률" },
      { title: "보정금액", value: formatDetailSignedAmount(riskAmount), description: "기술적 추정가에서 차감" },
    ],
  };
}

function calculateWeightedBasis(
  technicalTarget: number | null,
  valuationTarget: number | null,
  consensusTarget: number | null,
) {
  const hasTechnical = technicalTarget != null;
  const hasValuation = valuationTarget != null;
  const hasConsensus = consensusTarget != null;

  if (!hasTechnical && !hasValuation && !hasConsensus) return null;

  const weights = hasConsensus
    ? { technical: hasTechnical ? 0.4 : 0, valuation: hasValuation ? 0.35 : 0, consensus: 0.25 }
    : { technical: hasTechnical ? 0.6 : 0, valuation: hasValuation ? 0.4 : 0, consensus: 0 };

  const totalWeight = weights.technical + weights.valuation + weights.consensus;

  if (totalWeight <= 0) return null;

  return Math.round(
    ((technicalTarget ?? 0) * weights.technical +
      (valuationTarget ?? 0) * weights.valuation +
      (consensusTarget ?? 0) * weights.consensus) /
      totalWeight,
  );
}

function pickDetailNumber(...values: any[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return null;
}

function formatDetailWon(value: number | null) {
  if (value == null) return "확인 필요";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatDetailSignedAmount(value: number | null) {
  if (value == null) return "확인 필요";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ko-KR")}원`;
}

function formatDetailPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function makeDetailFormula(
  basisAverage: number | null,
  percent: number,
  amount: number | null,
) {
  if (basisAverage == null || amount == null) return "계산값 확인 필요";
  return `${formatDetailWon(basisAverage)} × ${formatDetailPercent(percent)} = ${formatDetailSignedAmount(amount)}`;
}

function getDetailIdFromEyebrow(eyebrow: string) {
  const matched = String(eyebrow ?? "").match(/DETAIL\s*(\d+)/i);

  return matched ? `detail-${matched[1]}` : null;
}

function SectionGroup({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const isDetail = eyebrow.toUpperCase().startsWith("DETAIL");
  const detailId = getDetailIdFromEyebrow(eyebrow);

  if (isDetail) {
    return (
      <details className="section-group detail-accordion" data-detail-id={detailId ?? undefined} data-detail-title={title}>
        <summary className="section-heading detail-accordion-summary">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <span className="detail-accordion-action">세부 보기</span>
        </summary>

        <div className="detail-accordion-content">{children}</div>
      </details>
    );
  }

  return (
    <section className="section-group">
      <div className="section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {children}
    </section>
  );
}

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatSignedNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  const formatted = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return "0";
}

function formatCompactNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedCompactNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const formatted = new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return "0";
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNullablePercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 준비 중";
  return `${value.toFixed(2)}%`;
}

function formatMarketCap(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 준비 중";

  if (value >= 1_0000_0000_0000) {
    return `${(value / 1_0000_0000_0000).toFixed(2)}조`;
  }

  if (value >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(2)}억`;
  }

  return formatNumber(value);
}

function formatRatio(value?: number | null, suffix = "") {
  if (value == null || Number.isNaN(value)) return "데이터 준비 중";
  return `${value.toFixed(2)}${suffix}`;
}

function formatCurrencyValue(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 준비 중";
  return formatNumber(value);
}

function formatShares(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 준비 중";
  return formatCompactNumber(value);
}

function formatDateLabel(date?: string) {
  if (!date) return "-";
  const [, month, day] = date.split("-");
  return `${month}/${day}`;
}

function formatShortPrice(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function getChangeTone(
  value?: number | null,
): "positive" | "negative" | "neutral" {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}




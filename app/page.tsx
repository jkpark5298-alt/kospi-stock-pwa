"use client";

import { useEffect, useState, type ReactNode } from "react";
import ChartAnalysisSections from "../components/chart/ChartAnalysisSections";
import CompositeScoreSection from "../components/analysis/CompositeScoreSection";
import EarningsGrowthSection from "../components/analysis/EarningsGrowthSection";
import TargetPriceSection from "../components/analysis/TargetPriceSection";
import DisclosureSection from "../components/analysis/DisclosureSection";
import KisFundamentalsSection from "../components/analysis/KisFundamentalsSection";
import ConsensusInputSection from "../components/analysis/ConsensusInputSection";
import TechnicalBasisExplanation from "../components/analysis/TechnicalBasisExplanation";
import ValuationBasisExplanation from "../components/analysis/ValuationBasisExplanation";
import CurrentStockSummaryCard from "../components/stock/CurrentStockSummaryCard";
import PredictionDashboard from "../components/prediction/PredictionDashboard";
import { useKisUsage } from "../hooks/useKisUsage";
import { usePredictionHistory } from "../hooks/usePredictionHistory";

type ChartRow = {
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

      const restored = getStoredManualEarnings(
        json.symbol,
        json.rawSymbol,
        json.name,
        finalSymbol,
      );

      if (restored) {
        const restoredSavedAt =
          restored.savedAt ||
          saveManualEarnings(
            restored.input,
            restored.mode,
            json.symbol,
            json.rawSymbol,
            json.name,
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
            json.symbol || finalSymbol,
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

      setData(json);
      setLastFetchedAt(new Date().toISOString());

      await recordKisApiUsageFromResponse(json);
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
  }

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

          <TargetPriceSection score={data?.score} lastFetchedAt={lastFetchedAt} />

          <CompositeScoreSection score={data?.score} />
        </SectionGroup>

        <SectionGroup
          eyebrow="DETAIL 1"
          title="A. 기술적 기준가 내용 및 분석"
          description="현재가, 이동평균, RSI, MACD, 볼린저밴드, 거래량, 변동성, 퀀트 모델 일부를 묶어 기술적 기준가를 확인합니다."
        >
          <TechnicalBasisExplanation data={data} />

          <ChartAnalysisSections data={data} rows={chartData} />

        </SectionGroup>

        <SectionGroup
          eyebrow="DETAIL 2"
          title="B. 실적·밸류 기준가 내용 및 분석"
          description="한투 재무 데이터, EPS, BPS, PER, PBR, 시가총액, 실적성장분석, 영업이익·순이익·EPS 성장률, KIS 재무·밸류 보조평가를 묶어 실적·밸류 기준가를 확인합니다."
        >
          <ValuationBasisExplanation data={data} />

          <KisFundamentalsSection symbol={data?.symbol} name={data?.name} />

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
          title="C. 컨센서스 기준가 내용 및 분석"
          description="네이버증권, FnGuide, 리포트 목표가, 평균·최고·최저 목표가, 투자의견, 참여 증권사 수를 묶어 컨센서스 기준가를 확인합니다."
        >
          <ConsensusInputSection
            symbol={data?.symbol}
            name={data?.name}
            appTargetPrice={data?.score?.targetPrice?.technicalTargetRange?.baseTarget}
          />
        </SectionGroup>

        <SectionGroup
          eyebrow="DETAIL 4"
          title="수급 및 분석"
          description="외국인 순매수, 기관 순매수, 외국인+기관 5일·20일 흐름, 연속 순매수 여부, 외국인 보유율을 수급 관점에서 확인합니다."
        >
          <div className="card">
            <h3 className="section-title small">수급 분석 위치 안내</h3>
            <p className="notice-text">
              현재 수급 데이터는 종합신뢰도 점수와 한투 재무·밸류 데이터 안에 함께 표시됩니다.
              다음 단계에서 수급 전용 컴포넌트로 분리해 이 영역에 배치합니다.
            </p>
          </div>
        </SectionGroup>

        <SectionGroup
          eyebrow="DETAIL 5"
          title="위험 및 검증 분석"
          description="위험 기준선, 단기 과열, 52주 고가 근접, 공시 리스크, 예측 저장·검증 결과를 묶어 확인합니다."
        >
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
    </main>
  );
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
  return (
    <section
      style={{
        display: "grid",
        gap: 16,
        marginTop: 28,
      }}
    >
      <div
        className="card"
        style={{
          padding: 20,
          border: "1px solid #dbe7ff",
          background:
            "linear-gradient(135deg, rgba(239,246,255,0.9), rgba(255,255,255,0.95))",
        }}
      >
        <p
          className="eyebrow"
          style={{
            marginBottom: 6,
          }}
        >
          {eyebrow}
        </p>
        <h2
          className="section-title"
          style={{
            marginBottom: 8,
          }}
        >
          {title}
        </h2>
        <p className="notice-text">{description}</p>
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

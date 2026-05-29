"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockResponse } from "../../types/stock";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
} from "../../utils/format";

type Props = {
  data: StockResponse | null;
};

type DailyTargetSnapshot = {
  date: string;
  symbol: string;
  targetPrice: number;
  basisPrice: number;
  source: "first-query" | "current-query" | "manual";
  savedAt: string;
};

type ConsensusData = {
  averageTargetPrice?: number | null;
  highTargetPrice?: number | null;
  lowTargetPrice?: number | null;
  investmentOpinion?: string;
  analystCount?: number | null;
  savedAt?: string;
};

type FundamentalsData = {
  marketCap?: number | null;
  per?: number | null;
  pbr?: number | null;
  eps?: number | null;
  bps?: number | null;
  dividendYield?: number | null;
  foreignOwnershipRate?: number | null;
  sharesOutstanding?: number | null;
  high52w?: number | null;
  low52w?: number | null;
};

type EstimateWeights = {
  technical: number;
  valuation: number;
  consensus: number;
};

type EstimateResult = {
  basisAverage: number | null;
  estimate: number | null;
  quantAmount: number | null;
  supplyAmount: number | null;
  riskAmount: number | null;
  totalAmount: number | null;
  weights: EstimateWeights;
};

type SummaryRange = {
  currentPrice: number;
  baseTarget: number;
  baseUpsidePercent: number;
  riskLine: number;
  riskDownsidePercent: number;
};

type SummaryTone = "positive" | "negative" | "neutral";

const DAILY_TARGET_STORAGE_PREFIX = "kospi-daily-target";
const CONSENSUS_STORAGE_PREFIX = "kospi-consensus-data";

export default function CurrentStockSummaryCard({ data }: Props) {
  const targetPrice = data?.score?.targetPrice;
  const range = targetPrice?.finalTargetRange ?? targetPrice?.technicalTargetRange ?? null;

  const storageKey = useMemo(
    () => makeConsensusStorageKey(data?.symbol, data?.name),
    [data?.symbol, data?.name],
  );

  const [savedConsensus, setSavedConsensus] = useState<ConsensusData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setSavedConsensus(null);
      return;
    }

    setSavedConsensus(readConsensus(storageKey));
  }, [storageKey]);

  const currentPrice =
    getNumber(data?.currentPrice) ?? getNumber(range?.currentPrice) ?? null;
  const technicalTarget = getTechnicalTarget(targetPrice);
  const valuationTarget =
    getNumber(targetPrice?.valuationTargetRange?.valuationTarget) ??
    calculateValuationTarget(currentPrice, data?.fundamentals as FundamentalsData | null);
  const consensusTarget =
    getNumber(targetPrice?.consensusTarget) ??
    getNumber(savedConsensus?.averageTargetPrice);

  const estimate = calculateEstimate({
    technicalTarget,
    valuationTarget,
    consensusTarget,
    targetPrice,
  });

  const summaryRange = makeSummaryRange({
    currentPrice,
    estimate: estimate.estimate,
    fallbackRange: range,
  });

  const todayKey = useMemo(() => makeTodayKey(), []);
  const dailyTargetKey = useMemo(
    () => makeDailyTargetKey(data?.symbol, todayKey),
    [data?.symbol, todayKey],
  );

  const [dailyTarget, setDailyTarget] = useState<DailyTargetSnapshot | null>(null);
  const [manualTargetInput, setManualTargetInput] = useState("");

  useEffect(() => {
    if (!summaryRange || !data?.symbol || typeof window === "undefined") {
      setDailyTarget(null);
      setManualTargetInput("");
      return;
    }

    const stored = readDailyTargetSnapshot(dailyTargetKey);

    if (stored) {
      setDailyTarget(stored);
      setManualTargetInput(formatManualTargetInput(String(stored.targetPrice)));
      return;
    }

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: summaryRange.baseTarget,
      basisPrice: summaryRange.currentPrice,
      source: "first-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }, [
    dailyTargetKey,
    data?.symbol,
    summaryRange?.baseTarget,
    summaryRange?.currentPrice,
    todayKey,
  ]);

  const targetProgress =
    summaryRange && summaryRange.baseTarget > 0
      ? Number(((summaryRange.currentPrice / summaryRange.baseTarget) * 100).toFixed(1))
      : null;

  const upsidePrice = summaryRange
    ? Number((summaryRange.baseTarget - summaryRange.currentPrice).toFixed(2))
    : null;

  const dailyTargetProgress =
    dailyTarget && summaryRange && dailyTarget.targetPrice > 0
      ? Number(((summaryRange.currentPrice / dailyTarget.targetPrice) * 100).toFixed(1))
      : null;

  const dailyUpsidePrice =
    dailyTarget && summaryRange
      ? Number((dailyTarget.targetPrice - summaryRange.currentPrice).toFixed(2))
      : null;

  const dailyUpsidePercent =
    dailyTarget && summaryRange && summaryRange.currentPrice > 0
      ? Number(
          (
            ((dailyTarget.targetPrice - summaryRange.currentPrice) /
              summaryRange.currentPrice) *
            100
          ).toFixed(2),
        )
      : null;

  const displaySymbol = data?.symbol || "데이터 없음";
  const displayName = data?.name || "종목명 없음";
  const displayMeta = [displaySymbol, data?.exchange, data?.currency]
    .filter(Boolean)
    .join(" · ");
  const quickSummary = makeCurrentSummaryInterpretation(data, summaryRange);

  function handleSaveCurrentAsDailyTarget() {
    if (!summaryRange || !data?.symbol) return;

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: summaryRange.baseTarget,
      basisPrice: summaryRange.currentPrice,
      source: "current-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  function handleSaveManualDailyTarget() {
    if (!summaryRange || !data?.symbol) return;

    const parsed = parseManualTargetInput(manualTargetInput);

    if (parsed == null || parsed <= 0) return;

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: parsed,
      basisPrice: summaryRange.currentPrice,
      source: "manual",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  function handleResetDailyTarget() {
    if (!summaryRange || !data?.symbol || typeof window === "undefined") return;

    window.localStorage.removeItem(dailyTargetKey);

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: summaryRange.baseTarget,
      basisPrice: summaryRange.currentPrice,
      source: "first-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  return (
    <div className="card">
      <h3 className="section-title small">현재 종목 요약</h3>

      <div className="stock-identity">
        <div className="stock-name">{displayName}</div>
        <div className="stock-meta">{displayMeta || "시장 정보 대기"}</div>
      </div>

      <div className="metric-list">
        <MetricRow label="현재가" value={formatNumber(summaryRange?.currentPrice ?? data?.currentPrice)} />
        <MetricRow
          label="당일 대비"
          value={`${formatSignedNumber(data?.changePrice)} / ${formatPercent(
            data?.change,
          )}`}
        />
        <MetricRow
          label="추정가"
          value={`${formatNumber(estimate.estimate)} ${formatDailyTargetSuffix(
            dailyTarget,
          )}`}
        />
        <MetricRow
          label="추정 괴리율"
          value={`${formatSignedNumber(upsidePrice)} / ${formatUpside(
            summaryRange?.baseUpsidePercent,
          )}`}
        />
        <MetricRow
          label="추정가 도달률"
          value={formatTargetProgress(targetProgress)}
        />
<MetricRow
          label="위험 기준선"
          value={`${formatNumber(summaryRange?.riskLine)} / ${formatUpside(
            summaryRange?.riskDownsidePercent,
          )}`}
        />
        <MetricRow
          label="기술적 분석"
          value={data?.signalSummary || "데이터 없음"}
        />
        <MetricRow
          label="종합 점수"
          value={
            data?.score?.total != null
              ? `${data.score.total} / 100 · ${data.score.grade}`
              : "데이터 없음"
          }
        />
        <MetricRow
          label="추정가 신뢰도"
          value={
            data?.score?.targetPrice?.score != null
              ? `${data.score.targetPrice.score} / 100 · ${data.score.targetPrice.label}`
              : "데이터 없음"
          }
        />
      </div>





      <p className="notice-text">
        추정가 산정 방식은 Summary의 별도 영역에서 하나로 확인합니다. 이 요약
        카드는 현재가, 추정가, 도달률, 위험 기준선만 빠르게 보여줍니다.
      </p>
    </div>
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

function calculateEstimate({
  technicalTarget,
  valuationTarget,
  consensusTarget,
  targetPrice,
}: {
  technicalTarget?: number | null;
  valuationTarget?: number | null;
  consensusTarget?: number | null;
  targetPrice?: NonNullable<StockResponse["score"]>["targetPrice"];
}): EstimateResult {
  const hasTechnical = technicalTarget != null && Number.isFinite(technicalTarget);
  const hasValuation = valuationTarget != null && Number.isFinite(valuationTarget);
  const hasConsensus = consensusTarget != null && Number.isFinite(consensusTarget);

  if (!hasTechnical && !hasValuation && !hasConsensus) {
    return {
      basisAverage: null,
      estimate: null,
      quantAmount: null,
      supplyAmount: null,
      riskAmount: null,
      totalAmount: null,
      weights: { technical: 0, valuation: 0, consensus: 0 },
    };
  }

  const rawWeights = hasConsensus
    ? {
        technical: hasTechnical ? 0.4 : 0,
        valuation: hasValuation ? 0.35 : 0,
        consensus: 0.25,
      }
    : {
        technical: hasTechnical ? 0.6 : 0,
        valuation: hasValuation ? 0.4 : 0,
        consensus: 0,
      };

  const totalWeight = rawWeights.technical + rawWeights.valuation + rawWeights.consensus;

  const weights = {
    technical: totalWeight > 0 ? rawWeights.technical / totalWeight : 0,
    valuation: totalWeight > 0 ? rawWeights.valuation / totalWeight : 0,
    consensus: totalWeight > 0 ? rawWeights.consensus / totalWeight : 0,
  };

  const basisAverage = roundPrice(
    (technicalTarget ?? 0) * weights.technical +
      (valuationTarget ?? 0) * weights.valuation +
      (consensusTarget ?? 0) * weights.consensus,
  );

  const selectedMode = String(targetPrice?.selectedTargetMode ?? "");
  const targetModes = Array.isArray(targetPrice?.targetModes) ? targetPrice.targetModes : [];
  const modeResult =
    targetModes.find((mode) => String(mode?.mode ?? "") === selectedMode) ??
    targetModes[0] ??
    null;
  const quantAdjustment = (modeResult?.quantAdjustment ?? {}) as {
    baseAdjustmentPercent?: unknown;
    positiveAdjustmentPercent?: unknown;
    riskAdjustmentPercent?: unknown;
  };
  const quantPercent = getNumber(quantAdjustment.baseAdjustmentPercent) ?? 0;
  const supplyPercent = getNumber(quantAdjustment.positiveAdjustmentPercent) ?? 0;
  const riskPercent = getNumber(quantAdjustment.riskAdjustmentPercent) ?? 0;

  const quantAmount = calculateAdjustmentAmount(basisAverage, quantPercent);
  const supplyAmount = calculateAdjustmentAmount(basisAverage, supplyPercent);
  const riskAmount = calculateAdjustmentAmount(basisAverage, riskPercent);
  const totalAmount =
    quantAmount != null && supplyAmount != null && riskAmount != null
      ? roundPrice(quantAmount + supplyAmount + riskAmount)
      : null;
  const estimate =
    basisAverage != null && totalAmount != null ? roundPrice(basisAverage + totalAmount) : null;

  return {
    basisAverage,
    estimate,
    quantAmount,
    supplyAmount,
    riskAmount,
    totalAmount,
    weights,
  };
}

function makeSummaryRange({
  currentPrice,
  estimate,
  fallbackRange,
}: {
  currentPrice?: number | null;
  estimate?: number | null;
  fallbackRange?: NonNullable<StockResponse["score"]>["targetPrice"]["technicalTargetRange"] | null;
}): SummaryRange | null {
  const baseCurrentPrice = currentPrice ?? fallbackRange?.currentPrice ?? null;

  if (baseCurrentPrice == null || estimate == null || estimate <= 0) return null;

  const fallbackRiskLine = fallbackRange?.riskLine ?? null;
  const riskLine =
    fallbackRiskLine != null && Number.isFinite(fallbackRiskLine)
      ? fallbackRiskLine
      : roundPrice(baseCurrentPrice * 0.9) ?? baseCurrentPrice;

  return {
    currentPrice: baseCurrentPrice,
    baseTarget: estimate,
    baseUpsidePercent: ((estimate - baseCurrentPrice) / baseCurrentPrice) * 100,
    riskLine,
    riskDownsidePercent: ((riskLine - baseCurrentPrice) / baseCurrentPrice) * 100,
  };
}

function getTechnicalTarget(targetPrice?: NonNullable<StockResponse["score"]>["targetPrice"]) {
  const candidates = targetPrice?.targetBasis?.candidates;

  if (Array.isArray(candidates)) {
    const technicalCandidate = candidates.find((candidate) =>
      String(candidate?.label ?? "").includes("기술"),
    );

    const value = getNumber(technicalCandidate?.value);

    if (value != null) return value;
  }

  return getNumber(targetPrice?.technicalTargetRange?.baseTarget);
}

function calculateValuationTarget(
  currentPrice?: number | null,
  fundamentals?: FundamentalsData | null,
) {
  if (!currentPrice || !fundamentals) return null;

  const epsTarget =
    fundamentals.eps != null &&
    fundamentals.eps > 0 &&
    fundamentals.per != null &&
    fundamentals.per > 0
      ? roundPrice(fundamentals.eps * fundamentals.per * getPerAdjustment(fundamentals.per))
      : null;
  const bpsTarget =
    fundamentals.bps != null &&
    fundamentals.bps > 0 &&
    fundamentals.pbr != null &&
    fundamentals.pbr > 0
      ? roundPrice(fundamentals.bps * fundamentals.pbr * getPbrAdjustment(fundamentals.pbr))
      : null;

  const targets = [epsTarget, bpsTarget].filter(
    (value): value is number => value != null && Number.isFinite(value) && value > 0,
  );

  if (!targets.length) return null;

  const average = roundPrice(targets.reduce((sum, value) => sum + value, 0) / targets.length);

  if (average == null) return null;

  return clampValuationTarget(average, currentPrice);
}

function makeCurrentSummaryInterpretation(
  data: StockResponse | null,
  range: SummaryRange | null,
) {
  const latest = getLatestChartRow(data?.chartData);
  const current = data?.currentPrice ?? latest?.close ?? range?.currentPrice ?? null;
  const chart = makeChartSummary(current, latest);
  const prediction = makePredictionSummary(current, range);
  const overall = makeOverallSummary(chart.label, prediction.label);

  return {
    overall: overall.title,
    summary: overall.detail,
    cards: [
      {
        title: "차트",
        icon: chart.icon,
        label: chart.label,
        detail: chart.detail,
        tone: chart.tone,
      },
      {
        title: "추정가",
        icon: prediction.icon,
        label: prediction.label,
        detail: prediction.detail,
        tone: prediction.tone,
      },
      {
        title: "종합",
        icon: overall.icon,
        label: overall.title,
        detail: overall.shortDetail,
        tone: overall.tone,
      },
    ],
  };
}

function getLatestChartRow(chartData?: StockResponse["chartData"]) {
  if (!chartData?.length) return null;

  for (let index = chartData.length - 1; index >= 0; index -= 1) {
    const row = chartData[index];

    if (row?.close != null && Number.isFinite(row.close)) {
      return row;
    }
  }

  return null;
}

function makeChartSummary(
  current: number | null,
  latest: ReturnType<typeof getLatestChartRow>,
) {
  if (!latest || current == null) {
    return {
      icon: "⏳",
      label: "차트 확인 필요",
      detail: "데이터 대기",
      tone: "neutral" as SummaryTone,
    };
  }

  const sma20 = latest.sma20 ?? null;
  const sma60 = latest.sma60 ?? null;
  const bbUpper = latest.bbUpper ?? null;
  const bbLower = latest.bbLower ?? null;
  const rsi14 = latest.rsi14 ?? null;

  const isUpTrend =
    sma20 != null && sma60 != null && current > sma20 && sma20 > sma60;
  const isAboveAvg =
    sma20 != null && sma60 != null && current > sma20 && current > sma60;
  const isWeak =
    sma20 != null && sma60 != null && current < sma20 && current < sma60;

  const bandPosition =
    bbUpper != null && bbLower != null && bbUpper > bbLower
      ? (current - bbLower) / (bbUpper - bbLower)
      : null;

  const isOverheated =
    (bandPosition != null && bandPosition >= 0.85) ||
    (rsi14 != null && rsi14 >= 70);

  if (isUpTrend && isOverheated) {
    return {
      icon: "⚠️",
      label: "단기 과열 주의",
      detail: "상승 추세 강함",
      tone: "negative" as SummaryTone,
    };
  }

  if (isUpTrend || isAboveAvg) {
    return {
      icon: "↗️",
      label: "상승 추세 유지",
      detail: "이동평균 우위",
      tone: "positive" as SummaryTone,
    };
  }

  if (isWeak) {
    return {
      icon: "↘️",
      label: "추세 약세",
      detail: "이동평균 아래",
      tone: "negative" as SummaryTone,
    };
  }

  return {
    icon: "➖",
    label: "방향성 확인",
    detail: "혼조 구간",
    tone: "neutral" as SummaryTone,
  };
}

function makePredictionSummary(current: number | null, range: SummaryRange | null) {
  const baseTarget = range?.baseTarget ?? null;

  if (current == null || baseTarget == null || baseTarget <= 0) {
    return {
      icon: "⏳",
      label: "추정가 확인 필요",
      detail: "추정가 대기",
      tone: "neutral" as SummaryTone,
    };
  }

  const upsideRate = ((baseTarget - current) / current) * 100;
  const progress = (current / baseTarget) * 100;

  if (upsideRate >= 3) {
    return {
      icon: "↗️",
      label: "상승 여력 있음",
      detail: `추정가까지 ${upsideRate.toFixed(1)}%`,
      tone: "positive" as SummaryTone,
    };
  }

  if (progress >= 97 && progress <= 103) {
    return {
      icon: "⚠️",
      label: "추정가 근접",
      detail: `도달률 ${progress.toFixed(1)}%`,
      tone: "neutral" as SummaryTone,
    };
  }

  if (upsideRate < -3) {
    return {
      icon: "↘️",
      label: "추정가 초과",
      detail: `초과 ${Math.abs(upsideRate).toFixed(1)}%`,
      tone: "negative" as SummaryTone,
    };
  }

  return {
    icon: "➖",
    label: "추정 중립",
    detail: `괴리율 ${upsideRate.toFixed(1)}%`,
    tone: "neutral" as SummaryTone,
  };
}

function makeOverallSummary(chartLabel: string, predictionLabel: string) {
  if (chartLabel.includes("과열") && predictionLabel.includes("상승 여력")) {
    return {
      icon: "⚠️",
      title: "상승 여력 있음 · 단기 과열 주의",
      shortDetail: "추격 매수 신중",
      detail:
        "추정가 기준 여력은 남아 있지만 차트는 단기 과열 신호를 함께 보여줍니다. 상승 흐름은 유지하되 추격 매수는 신중히 확인하는 구간입니다.",
      tone: "neutral" as SummaryTone,
    };
  }

  if (chartLabel.includes("과열") && predictionLabel.includes("근접")) {
    return {
      icon: "⚠️",
      title: "추정가 근접 · 단기 과열 주의",
      shortDetail: "변동성 확인",
      detail:
        "현재가가 추정가와 가까우며 차트에 단기 과열 신호가 있습니다. 추가 상승보다 변동성 확대 가능성을 먼저 확인해야 합니다.",
      tone: "negative" as SummaryTone,
    };
  }

  if (chartLabel.includes("상승") && predictionLabel.includes("상승 여력")) {
    return {
      icon: "↗️",
      title: "상승 추세 · 상승 여력",
      shortDetail: "흐름 양호",
      detail:
        "차트 흐름과 추정가 기준이 모두 우호적입니다. 다만 실제 판단은 수급과 위험 기준선을 함께 확인해야 합니다.",
      tone: "positive" as SummaryTone,
    };
  }

  if (chartLabel.includes("약세")) {
    return {
      icon: "↘️",
      title: "추세 약세 확인",
      shortDetail: "반등 확인 필요",
      detail:
        "현재 차트 흐름이 약해 단기 반등 여부와 수급 개선 여부를 함께 확인해야 합니다.",
      tone: "negative" as SummaryTone,
    };
  }

  return {
    icon: "➖",
    title: "방향성 확인 필요",
    shortDetail: "혼조 구간",
    detail:
      "차트와 추정가 기준이 선명하게 한 방향으로 일치하지 않아 추가 확인이 필요한 구간입니다.",
    tone: "neutral" as SummaryTone,
  };
}

function makeTodayKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function makeDailyTargetKey(symbol?: string | null, todayKey = makeTodayKey()) {
  return `${DAILY_TARGET_STORAGE_PREFIX}:${todayKey}:${(symbol || "")
    .trim()
    .toUpperCase()}`;
}

function readDailyTargetSnapshot(key: string): DailyTargetSnapshot | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as DailyTargetSnapshot;

    if (
      !parsed ||
      !Number.isFinite(parsed.targetPrice) ||
      !Number.isFinite(parsed.basisPrice)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeDailyTargetSnapshot(key: string, snapshot: DailyTargetSnapshot) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // localStorage 저장이 실패해도 화면 조회는 계속 진행합니다.
  }
}

function formatDailyTargetSuffix(snapshot?: DailyTargetSnapshot | null) {
  if (!snapshot) return "(당일 기준 추정가 데이터 없음)";

  return `(당일 기준 ${formatNumber(snapshot.targetPrice)})`;
}

function formatDailyTargetSource(snapshot?: DailyTargetSnapshot | null) {
  if (!snapshot) return "당일 기준 추정가 대기";

  if (snapshot.source === "manual") return "직접 입력 기준";
  if (snapshot.source === "current-query") return "현재 조회 추정가 저장 기준";
  return "오늘 첫 조회 기준";
}

function formatManualTargetInput(value: string) {
  const raw = value.replace(/,/g, "").replace(/\s/g, "");

  if (!raw) return "";

  const cleaned = raw.replace(/[^0-9.]/g, "");

  if (!cleaned) return "";

  const dotIndex = cleaned.indexOf(".");
  const integerPart = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned;
  const decimalPart =
    dotIndex >= 0 ? cleaned.slice(dotIndex + 1).replace(/\./g, "") : "";

  const formattedInteger = integerPart
    ? Number(integerPart).toLocaleString("en-US")
    : "0";

  if (dotIndex >= 0) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
}

function parseManualTargetInput(value: string) {
  const parsed = Number(value.replace(/[\s,]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function formatDailyTargetComparison(
  dailyTarget: DailyTargetSnapshot | null,
  summaryRange: SummaryRange | null,
  dailyTargetProgress?: number | null,
) {
  if (!dailyTarget || !summaryRange) return "데이터 없음";

  const gap = summaryRange.currentPrice - dailyTarget.targetPrice;
  const direction =
    gap > 0 ? "추정가보다 높음" : gap < 0 ? "추정가보다 낮음" : "추정가와 동일";
  const absoluteGap = Math.abs(gap);

  return `${formatTargetProgress(dailyTargetProgress)} · 기준 ${formatNumber(
    dailyTarget.targetPrice,
  )} / 현재 ${formatNumber(summaryRange.currentPrice)} / ${formatNumber(
    absoluteGap,
  )}원 ${direction}`;
}

function formatTargetProgress(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(1)}%`;
}

function formatUpside(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "저장 전";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function makeConsensusStorageKey(symbol?: string | null, name?: string | null) {
  const normalizedSymbol = (symbol || "").trim().toUpperCase();

  if (normalizedSymbol) {
    return `${CONSENSUS_STORAGE_PREFIX}:${normalizedSymbol}`;
  }

  const normalizedName = (name || "").trim();

  if (normalizedName) {
    return `${CONSENSUS_STORAGE_PREFIX}:NAME:${normalizedName}`;
  }

  return `${CONSENSUS_STORAGE_PREFIX}:CURRENT`;
}

function readConsensus(key: string): ConsensusData | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as ConsensusData;

    if (!parsed || typeof parsed !== "object") return null;

    return parsed;
  } catch {
    return null;
  }
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function calculateAdjustmentAmount(basisAverage: number | null, percent: number) {
  if (basisAverage == null || !Number.isFinite(basisAverage)) return null;

  return roundPrice((basisAverage * percent) / 100);
}

function getPerAdjustment(per?: number | null) {
  if (per == null || !Number.isFinite(per) || per <= 0) return 1;
  if (per <= 10) return 1.08;
  if (per <= 20) return 1;
  if (per <= 30) return 0.92;
  if (per <= 40) return 0.84;
  return 0.75;
}

function getPbrAdjustment(pbr?: number | null) {
  if (pbr == null || !Number.isFinite(pbr) || pbr <= 0) return 1;
  if (pbr <= 1) return 1.08;
  if (pbr <= 2) return 1;
  if (pbr <= 3) return 0.92;
  if (pbr <= 5) return 0.85;
  return 0.75;
}

function clampValuationTarget(target: number, currentPrice: number) {
  const lower = currentPrice * 0.8;
  const upper = currentPrice * 1.35;

  return roundPrice(Math.max(lower, Math.min(target, upper)));
}

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return null;

  if (value >= 100_000) return Math.round(value / 10) * 10;
  if (value >= 10_000) return Math.round(value / 5) * 5;
  return Math.round(value);
}

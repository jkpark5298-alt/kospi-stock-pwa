"use client";

import { useEffect, useMemo, useState } from "react";

type ConsensusData = {
  averageTargetPrice?: number | null;
  highTargetPrice?: number | null;
  lowTargetPrice?: number | null;
  investmentOpinion?: string;
  analystCount?: number | null;
  savedAt?: string;
};

type Props = {
  data?: any;
};

const CONSENSUS_STORAGE_PREFIX = "kospi-consensus-data";

export default function SummaryAbcOverviewSection({ data }: Props) {
  const symbol = data?.symbol ?? null;
  const name = data?.name ?? null;
  const storageKey = useMemo(() => makeConsensusStorageKey(symbol, name), [symbol, name]);
  const [savedConsensus, setSavedConsensus] = useState<ConsensusData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setSavedConsensus(null);
      return;
    }

    setSavedConsensus(readConsensus(storageKey));
  }, [storageKey]);

  const targetPrice = data?.score?.targetPrice ?? null;
  const range = targetPrice?.technicalTargetRange ?? null;
  const valuationRange = targetPrice?.valuationTargetRange ?? null;

  const technicalTarget = getTechnicalTarget(targetPrice, range);
  const valuationTarget = getNumber(valuationRange?.valuationTarget);
  const consensusTarget =
    getNumber(targetPrice?.consensusTarget) ??
    getNumber(savedConsensus?.averageTargetPrice);

  const abcEstimate = calculateAbcEstimate({
    technicalTarget,
    valuationTarget,
    consensusTarget,
  });

  const currentModelTarget = getNumber(range?.baseTarget) ?? abcEstimate.value;
  const finalTarget =
    getNumber(targetPrice?.adjustedTarget?.finalTarget) ??
    getNumber(targetPrice?.quantAdjustedTarget?.finalTarget) ??
    getNumber(targetPrice?.finalTarget) ??
    currentModelTarget;

  const currentPrice =
    getNumber(data?.currentPrice) ?? getNumber(range?.currentPrice) ?? null;
  const estimatedGap =
    finalTarget != null && currentPrice != null
      ? ((finalTarget - currentPrice) / currentPrice) * 100
      : null;
  const targetProgress =
    finalTarget != null && currentPrice != null && finalTarget > 0
      ? (currentPrice / finalTarget) * 100
      : null;

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>Summary A/B/C 기준가 비교</span>
          <strong>{finalTarget != null ? "추정가 구조 요약" : "데이터 대기"}</strong>
        </div>

        <p className="target-basis-summary">
          A 기술적 기준가, B 실적·밸류 기준가, C 컨센서스 기준가를 한 번에
          비교합니다. Detail 1~3의 근거를 요약해 현재 모델 추정가와 최종 추정
          주가의 관계를 확인하는 영역입니다.
        </p>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <SummaryMetricCard
            title="A. 기술적 기준가"
            value={formatPrice(technicalTarget)}
            subText="차트·가격 흐름 기준"
          />
          <SummaryMetricCard
            title="B. 실적·밸류 기준가"
            value={formatPrice(valuationTarget)}
            subText="EPS·BPS·PER·PBR 기준"
          />
          <SummaryMetricCard
            title="C. 컨센서스 기준가"
            value={formatPrice(consensusTarget)}
            subText={makeConsensusSubText(savedConsensus)}
          />
          <SummaryMetricCard
            title="A/B/C 1차 추정가"
            value={formatPrice(abcEstimate.value)}
            subText={abcEstimate.description}
          />
        </div>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
          <SummaryMetricCard
            title="현재 모델 추정가"
            value={formatPrice(currentModelTarget)}
            subText="현재 조회 기준 모델값"
          />
          <SummaryMetricCard
            title="최종 추정 주가"
            value={formatPrice(finalTarget)}
            subText="모델 보정 후 기준"
          />
          <SummaryMetricCard
            title="추정 괴리율"
            value={formatPercent(estimatedGap)}
            subText="현재가 대비 여력"
          />
          <SummaryMetricCard
            title="현재 모델 도달률"
            value={formatPercent(targetProgress, false)}
            subText="현재가 / 최종 추정 주가"
          />
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>해석</span>
            <strong>{makeSummaryLabel(technicalTarget, valuationTarget, consensusTarget, finalTarget)}</strong>
          </div>
          <p className="target-basis-summary">
            A/B/C 값이 서로 가까우면 추정가의 방향성이 비교적 일관된 것으로
            볼 수 있습니다. 반대로 A는 높고 B가 낮거나, C가 없으면 현재 모델
            추정가는 참고값으로 보고 Detail 영역에서 근거를 다시 확인하는 것이
            좋습니다.
          </p>
        </div>
      </div>
    </section>
  );
}

function SummaryMetricCard({
  title,
  value,
  subText,
}: {
  title: string;
  value: string;
  subText: string;
}) {
  return (
    <div className="target-metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <em>{subText}</em>
    </div>
  );
}

function getTechnicalTarget(targetPrice: any, range: any) {
  const candidates = targetPrice?.targetBasis?.candidates;

  if (Array.isArray(candidates)) {
    const technicalCandidate = candidates.find((candidate) =>
      String(candidate?.label ?? "").includes("기술"),
    );

    const value = getNumber(technicalCandidate?.value);

    if (value != null) return value;
  }

  return getNumber(range?.baseTarget);
}

function calculateAbcEstimate({
  technicalTarget,
  valuationTarget,
  consensusTarget,
}: {
  technicalTarget?: number | null;
  valuationTarget?: number | null;
  consensusTarget?: number | null;
}) {
  const hasTechnical = technicalTarget != null && Number.isFinite(technicalTarget);
  const hasValuation = valuationTarget != null && Number.isFinite(valuationTarget);
  const hasConsensus = consensusTarget != null && Number.isFinite(consensusTarget);

  if (!hasTechnical && !hasValuation && !hasConsensus) {
    return {
      value: null,
      description: "A/B/C 데이터 대기",
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

  const value =
    (technicalTarget ?? 0) * weights.technical +
    (valuationTarget ?? 0) * weights.valuation +
    (consensusTarget ?? 0) * weights.consensus;

  return {
    value: roundPrice(value),
    description: formatWeights(weights),
  };
}

function formatWeights(weights: { technical: number; valuation: number; consensus: number }) {
  const parts = [];

  if (weights.technical > 0) parts.push(`A ${formatWeight(weights.technical)}`);
  if (weights.valuation > 0) parts.push(`B ${formatWeight(weights.valuation)}`);
  if (weights.consensus > 0) parts.push(`C ${formatWeight(weights.consensus)}`);

  return parts.length ? parts.join(" · ") : "가중치 대기";
}

function makeSummaryLabel(
  technicalTarget?: number | null,
  valuationTarget?: number | null,
  consensusTarget?: number | null,
  finalTarget?: number | null,
) {
  const values = [technicalTarget, valuationTarget, consensusTarget].filter(
    (value): value is number => value != null && Number.isFinite(value),
  );

  if (!values.length || finalTarget == null) return "기준가 확인 필요";
  if (values.length < 3) return "일부 기준가 기준";

  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const dispersion = avg > 0 ? ((max - min) / avg) * 100 : 0;

  if (dispersion <= 10) return "A/B/C 방향성 양호";
  if (dispersion <= 25) return "A/B/C 차이 일부 존재";
  return "A/B/C 차이 큼 · 근거 확인 필요";
}

function makeConsensusSubText(consensus?: ConsensusData | null) {
  if (!consensus?.averageTargetPrice) return "입력/저장 후 반영";

  const parts = [];

  if (consensus.investmentOpinion) parts.push(consensus.investmentOpinion);
  if (consensus.analystCount != null) parts.push(`${consensus.analystCount}개`);

  return parts.length ? parts.join(" · ") : "저장된 컨센서스";
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

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return null;

  if (value >= 100_000) return Math.round(value / 10) * 10;
  if (value >= 10_000) return Math.round(value / 5) * 5;
  return Math.round(value);
}

function formatPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatPercent(value?: number | null, withSign = true) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatWeight(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${(value * 100).toFixed(0)}%`;
}

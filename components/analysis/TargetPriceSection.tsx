"use client";

import { useMemo, type ReactNode } from "react";
import { calculateTechnicalStrategy } from "../../lib/technicalStrategy";
import type { ChartRow, CompositeScore } from "../../types/stock";

type Props = {
  score?: CompositeScore;
  lastFetchedAt?: string | null;
  rows?: ChartRow[];
};

type TargetTone = "positive" | "negative" | "neutral";

type Option2Estimate = {
  currentPrice: number | null;
  technicalTarget: number | null;
  valuationTarget: number | null;
  consensusTarget: number | null;
  basisAverage: number | null;
  estimate: number | null;
  quantPercent: number;
  supplyPercent: number;
  riskPercent: number;
  totalAdjustmentAmount: number | null;
  weightLabel: string;
};

type ReferenceRange = {
  currentPrice: number;
  conservativeTarget: number;
  conservativeUpsidePercent: number;
  baseTarget: number;
  baseUpsidePercent: number;
  aggressiveTarget: number;
  aggressiveUpsidePercent: number;
  riskLine: number;
  riskDownsidePercent: number;
};

export default function TargetPriceSection({ score, lastFetchedAt, rows = [] }: Props) {
  const sourceRange =
    score?.targetPrice?.finalTargetRange ??
    score?.targetPrice?.technicalTargetRange ??
    null;
  const technicalStrategy = useMemo(() => calculateTechnicalStrategy(rows), [rows]);
  const technicalBasePrice = technicalStrategy.priceRange.basePrice;
  const option2 = calculateOption2Estimate(score, technicalBasePrice);
  const range = makeReferenceRange(option2, sourceRange);

  const targetProgress =
    range && range.baseTarget > 0
      ? Number(((range.currentPrice / range.baseTarget) * 100).toFixed(1))
      : null;

  const upsidePrice = range
    ? Number((range.baseTarget - range.currentPrice).toFixed(2))
    : null;

  return (
    <section className="target-section">
      <Card>
        <div className="target-header">
          <div>
            <SectionTitleSmall>추정가 산정 방식</SectionTitleSmall>
            <p className="target-subtitle">
              A. 기본 기술적 추정가는 기술전략의 기준값을 대표 추정가로 사용하고,
              맞춥니다. 최저·최고 추정가와 위험 기준선은 매수·보유 판단을 돕는
              참고 구간입니다.
            </p>
          </div>
          <div className={`target-badge ${range ? "available" : "unavailable"}`}>
            {range ? "2안 기준 표시" : "데이터 대기"}
          </div>
        </div>

        <TargetBasisMeta
          currentPrice={range?.currentPrice}
          lastFetchedAt={lastFetchedAt}
          hasRange={Boolean(range)}
          weightLabel={option2.weightLabel}
        />

        <div className="target-grid">
          <TargetMetricCard
            title="기준 현재가"
            value={formatNumber(range?.currentPrice)}
            subText="조회 시점 가격"
            tone="neutral"
          />
          <TargetMetricCard
            title="최저 추정가"
            value={formatNumber(range?.conservativeTarget)}
            subText={`현재가 대비 ${formatUpside(range?.conservativeUpsidePercent)}`}
            tone={getTargetTone(range?.conservativeUpsidePercent)}
          />
          <TargetMetricCard
            title="추정가"
            value={formatNumber(range?.baseTarget)}
            subText={`현재가 대비 ${formatUpside(range?.baseUpsidePercent)}`}
            tone={getTargetTone(range?.baseUpsidePercent)}
          />
          <TargetMetricCard
            title="최고 추정가"
            value={formatNumber(range?.aggressiveTarget)}
            subText={`현재가 대비 ${formatUpside(range?.aggressiveUpsidePercent)}`}
            tone={getTargetTone(range?.aggressiveUpsidePercent)}
          />
          <TargetMetricCard
            title="도달률"
            value={formatTargetProgress(targetProgress)}
            subText="현재가 / 추정가"
            tone={getTargetProgressTone(targetProgress)}
          />
          <TargetMetricCard
            title="남은 차이"
            value={formatSignedNumber(upsidePrice)}
            subText={`추정가와 현재가 차이 ${formatUpside(range?.baseUpsidePercent)}`}
            tone={getTargetTone(upsidePrice)}
          />
          <TargetMetricCard
            title="위험 기준선"
            value={formatNumber(range?.riskLine)}
            subText={`하락 위험 ${formatUpside(range?.riskDownsidePercent)}`}
            tone="negative"
          />
        </div>

        <div className="target-comment-box">
          <span>해석</span>
          <strong>{makeTargetComment(range)}</strong>
        </div>

        <p className="notice-text">
          추정가 숫자는 Summary의 2안 산정 방식과 같은 기준으로 표시합니다.
          이 추정가 참고 구간은 매수·보유 판단을 돕기 위한 보조 구간입니다.
        </p>
      </Card>
    </section>
  );
}

function TargetBasisMeta({
  currentPrice,
  lastFetchedAt,
  hasRange,
  weightLabel,
}: {
  currentPrice?: number | null;
  lastFetchedAt?: string | null;
  hasRange: boolean;
  weightLabel: string;
}) {
  return (
    <div className="target-basis-box" style={{ marginBottom: 16 }}>
      <div className="target-basis-header">
        <span>기준 정보</span>
        <strong>{hasRange ? "현재 조회 시점 기준" : "추정가 대기"}</strong>
      </div>
      <p className="target-basis-summary">
        조회 시각: {formatDateTime(lastFetchedAt)} · 기준 현재가:{" "}
        {formatNumber(currentPrice)} · 적용 가중치: {weightLabel}
      </p>
    </div>
  );
}

function TargetMetricCard({
  title,
  value,
  subText,
  tone,
}: {
  title: string;
  value: string;
  subText: string;
  tone: TargetTone;
}) {
  return (
    <div className="target-metric-card">
      <span>{title}</span>
      <strong className={tone}>{value}</strong>
      <em className={tone}>{subText}</em>
    </div>
  );
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

function SectionTitleSmall({ children }: { children: ReactNode }) {
  return <h3 className="section-title small">{children}</h3>;
}

function calculateOption2Estimate(
  score?: CompositeScore,
  technicalBasePrice?: number | null,
): Option2Estimate {
  const targetPrice = score?.targetPrice;
  const sourceRange =
    targetPrice?.finalTargetRange ?? targetPrice?.technicalTargetRange ?? null;

  const currentPrice = getNumber(sourceRange?.currentPrice);
  const technicalTarget = getNumber(technicalBasePrice) ?? getTechnicalTarget(targetPrice);
  const valuationTarget = getNumber(targetPrice?.valuationTargetRange?.valuationTarget);
  const consensusTarget = getNumber((targetPrice as any)?.consensusTarget);

  const hasTechnical = isValidNumber(technicalTarget);
  const hasValuation = isValidNumber(valuationTarget);
  const hasConsensus = isValidNumber(consensusTarget);

  if (!hasTechnical && !hasValuation && !hasConsensus) {
    return {
      currentPrice,
      technicalTarget: null,
      valuationTarget: null,
      consensusTarget: null,
      basisAverage: null,
      estimate: null,
      quantPercent: 0,
      supplyPercent: 0,
      riskPercent: 0,
      totalAdjustmentAmount: null,
      weightLabel: "A/B/C 데이터 대기",
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
  const technicalWeight = totalWeight > 0 ? rawWeights.technical / totalWeight : 0;
  const valuationWeight = totalWeight > 0 ? rawWeights.valuation / totalWeight : 0;
  const consensusWeight = totalWeight > 0 ? rawWeights.consensus / totalWeight : 0;

  const basisAverage = roundPrice(
    (technicalTarget ?? 0) * technicalWeight +
      (valuationTarget ?? 0) * valuationWeight +
      (consensusTarget ?? 0) * consensusWeight,
  );

  const selectedMode = String(targetPrice?.selectedTargetMode ?? "");
  const targetModes = Array.isArray(targetPrice?.targetModes)
    ? targetPrice.targetModes
    : [];
  const modeResult =
    targetModes.find((mode: any) => String(mode?.mode ?? "") === selectedMode) ??
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
  const totalAdjustmentAmount =
    quantAmount != null && supplyAmount != null && riskAmount != null
      ? roundPrice(quantAmount + supplyAmount + riskAmount)
      : null;
  const estimate =
    basisAverage != null && totalAdjustmentAmount != null
      ? roundPrice(basisAverage + totalAdjustmentAmount)
      : null;

  return {
    currentPrice,
    technicalTarget,
    valuationTarget,
    consensusTarget,
    basisAverage,
    estimate,
    quantPercent,
    supplyPercent,
    riskPercent,
    totalAdjustmentAmount,
    weightLabel: formatWeights(technicalWeight, valuationWeight, consensusWeight),
  };
}

function makeReferenceRange(
  option2: Option2Estimate,
  sourceRange:
    | NonNullable<CompositeScore["targetPrice"]["finalTargetRange"]>
    | NonNullable<CompositeScore["targetPrice"]["technicalTargetRange"]>
    | null,
): ReferenceRange | null {
  const currentPrice = option2.currentPrice ?? getNumber(sourceRange?.currentPrice);
  const baseTarget = option2.estimate;

  if (currentPrice == null || baseTarget == null || baseTarget <= 0) {
    return null;
  }

  const sourceBase = getNumber(sourceRange?.baseTarget);
  const conservativeRatio = getSafeRangeRatio(
    getNumber(sourceRange?.conservativeTarget),
    sourceBase,
    0.985,
    0.75,
    1.02,
  );
  const aggressiveRatio = getSafeRangeRatio(
    getNumber(sourceRange?.aggressiveTarget),
    sourceBase,
    1.1,
    1.02,
    1.35,
  );

  const calculatedConservativeTarget =
    roundPrice(baseTarget * conservativeRatio) ?? baseTarget;
  const calculatedAggressiveTarget = roundPrice(baseTarget * aggressiveRatio) ?? baseTarget;

  const conservativeTarget = Math.min(
    calculatedConservativeTarget,
    roundPrice(baseTarget * 0.95) ?? baseTarget,
  );
  const aggressiveTarget = Math.max(
    calculatedAggressiveTarget,
    roundPrice(baseTarget * 1.05) ?? baseTarget,
  );

  const riskLine =
    getNumber(sourceRange?.riskLine) ?? roundPrice(currentPrice * 0.9) ?? currentPrice;

  return {
    currentPrice,
    conservativeTarget,
    conservativeUpsidePercent: calculateUpsidePercent(
      conservativeTarget,
      currentPrice,
    ),
    baseTarget,
    baseUpsidePercent: calculateUpsidePercent(baseTarget, currentPrice),
    aggressiveTarget,
    aggressiveUpsidePercent: calculateUpsidePercent(aggressiveTarget, currentPrice),
    riskLine,
    riskDownsidePercent: calculateUpsidePercent(riskLine, currentPrice),
  };
}

function getTechnicalTarget(targetPrice?: CompositeScore["targetPrice"]) {
  const technicalRangeBase = getNumber(targetPrice?.technicalTargetRange?.baseTarget);

  if (technicalRangeBase != null) return technicalRangeBase;

  const finalRangeBase = getNumber(targetPrice?.finalTargetRange?.baseTarget);

  if (finalRangeBase != null) return finalRangeBase;

  const candidates = targetPrice?.targetBasis?.candidates;

  if (Array.isArray(candidates)) {
    const technicalCandidate = candidates.find((candidate) =>
      String(candidate?.label ?? "").includes("기술"),
    );

    const value = getNumber(technicalCandidate?.value);

    if (value != null) return value;
  }

  return null;
}

function calculateAdjustmentAmount(basisAverage: number | null, percent: number) {
  if (basisAverage == null || !Number.isFinite(basisAverage)) return null;

  return roundPrice((basisAverage * percent) / 100);
}

function getSafeRangeRatio(
  value: number | null,
  base: number | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (value == null || base == null || base <= 0) return fallback;

  const ratio = value / base;

  if (!Number.isFinite(ratio) || ratio < min || ratio > max) return fallback;

  return ratio;
}

function calculateUpsidePercent(target: number, currentPrice: number) {
  if (!currentPrice || !Number.isFinite(currentPrice)) return 0;

  return ((target - currentPrice) / currentPrice) * 100;
}

function makeTargetComment(range?: ReferenceRange | null) {
  if (!range) {
    return "분석 실행 후 추정가가 표시됩니다.";
  }

  const targetProgress =
    range.baseTarget > 0 ? (range.currentPrice / range.baseTarget) * 100 : null;
  const upsidePrice = range.baseTarget - range.currentPrice;

  if (targetProgress != null && targetProgress >= 105) {
    return `현재가가 추정가를 ${formatTargetProgress(
      targetProgress,
    )} 수준으로 초과했습니다. 추정가 대비 ${formatSignedNumber(
      upsidePrice,
    )} 차이로, 과열과 위험 기준선을 먼저 확인하는 것이 좋습니다.`;
  }

  if (targetProgress != null && targetProgress >= 97) {
    return `현재가가 추정가의 ${formatTargetProgress(
      targetProgress,
    )} 수준입니다. 남은 차이는 ${formatSignedNumber(
      upsidePrice,
    )}로 제한적일 수 있어 수급과 위험 기준선을 함께 확인해야 합니다.`;
  }

  if (range.baseUpsidePercent > 0) {
    return `추정가까지 ${formatUpside(
      range.baseUpsidePercent,
    )}의 여력이 있습니다. 단, 위험 기준선과 Detail 4~5의 수급·위험 분석을 함께 확인해야 합니다.`;
  }

  if (range.baseUpsidePercent < 0) {
    return "현재가가 추정가를 초과하고 있습니다. 단기 과열 여부와 위험 기준선을 먼저 확인하는 것이 좋습니다.";
  }

  return "현재가와 추정가가 가까운 수준입니다. 추가 판단은 Detail 영역의 기준가·수급·위험 분석을 함께 확인하세요.";
}

function formatWeights(
  technicalWeight: number,
  valuationWeight: number,
  consensusWeight: number,
) {
  const parts = [];

  if (technicalWeight > 0) parts.push(`A ${formatWeight(technicalWeight)}`);
  if (valuationWeight > 0) parts.push(`B ${formatWeight(valuationWeight)}`);
  if (consensusWeight > 0) parts.push(`C ${formatWeight(consensusWeight)}`);

  return parts.length ? parts.join(" · ") : "가중치 대기";
}

function formatWeight(value: number) {
  return `${(value * 100).toFixed(0)}%`;
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

function formatUpside(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTargetProgress(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "조회 전";

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

function getTargetTone(value?: number | null): TargetTone {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function getTargetProgressTone(value?: number | null): TargetTone {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value >= 105) return "negative";
  if (value >= 97) return "neutral";
  if (value >= 90) return "neutral";
  return "positive";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isValidNumber(value?: number | null) {
  return value != null && Number.isFinite(value);
}

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return null;

  if (value >= 100_000) return Math.round(value / 10) * 10;
  if (value >= 10_000) return Math.round(value / 5) * 5;
  return Math.round(value);
}

"use client";

import type { ReactNode } from "react";
import type { CompositeScore, TargetBasis } from "../../types/stock";

type Props = {
  score?: CompositeScore;
  lastFetchedAt?: string | null;
};

type TargetTone = "positive" | "negative" | "neutral";

type AbcEstimate = {
  value: number | null;
  technicalWeight: number | null;
  valuationWeight: number | null;
  consensusWeight: number | null;
  description: string;
};

export default function TargetPriceSection({ score, lastFetchedAt }: Props) {
  const range = score?.targetPrice?.technicalTargetRange;
  const basis = score?.targetPrice?.targetBasis;
  const valuationRange = score?.targetPrice?.valuationTargetRange ?? null;
  const abcEstimate = calculateAbcEstimate({
    technicalTarget: getTechnicalBasisPrice(basis, range?.baseTarget),
    valuationTarget: valuationRange?.valuationTarget ?? null,
    consensusTarget: score?.targetPrice?.consensusTarget ?? null,
  });

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
            <SectionTitleSmall>추정 주가 참고 범위</SectionTitleSmall>
            <p className="target-subtitle">
              현재 화면은 A 기술적 기준가, B 실적·밸류 기준가, C 컨센서스
              기준가를 분리해 보여줍니다. 아직 최종 산식에는 기존 모델
              추정가가 함께 표시됩니다.
            </p>
          </div>
          <div className={`target-badge ${range ? "available" : "unavailable"}`}>
            {range ? "A/B/C 구조 확인" : "추정 주가 대기"}
          </div>
        </div>

        <TargetBasisMeta
          currentPrice={range?.currentPrice}
          lastFetchedAt={lastFetchedAt}
          hasRange={Boolean(range)}
        />

        <div className="target-grid">
          <TargetMetricCard
            title="기준 현재가"
            value={formatNumber(range?.currentPrice)}
            subText="추정 주가 산정에 사용한 조회 시점 가격"
            tone="neutral"
          />
          <TargetMetricCard
            title="현재 모델 추정가"
            value={formatNumber(range?.baseTarget)}
            subText={`기존 로직 기준 추정 괴리율 ${formatUpside(range?.baseUpsidePercent)}`}
            tone={getTargetTone(range?.baseUpsidePercent)}
          />
          <TargetMetricCard
            title="A/B/C 기준 1차 추정가"
            value={formatNumber(abcEstimate.value)}
            subText={abcEstimate.description}
            tone={getTargetTone(
              range?.currentPrice && abcEstimate.value
                ? percentChange(abcEstimate.value, range.currentPrice)
                : null,
            )}
          />
          <TargetMetricCard
            title="현재 모델 도달률"
            value={formatTargetProgress(targetProgress)}
            subText="기준 현재가 / 현재 모델 추정가"
            tone={getTargetProgressTone(targetProgress)}
          />
          <TargetMetricCard
            title="현재 모델 상승여력"
            value={formatSignedNumber(upsidePrice)}
            subText={`현재가 대비 차이 ${formatUpside(range?.baseUpsidePercent)}`}
            tone={getTargetTone(upsidePrice)}
          />
          <TargetMetricCard
            title="하락 지지선"
            value={formatNumber(range?.riskLine)}
            subText={`현재가 대비 ${formatUpside(range?.riskDownsidePercent)}`}
            tone="negative"
          />
        </div>

        <TargetStructureBox
          score={score}
          basis={basis}
          abcEstimate={abcEstimate}
        />

        <div className="target-comment-box">
          <span>해석</span>
          <strong>{makeTargetComment(score, abcEstimate)}</strong>
        </div>

        <TargetBasisBox basis={basis} valuationRange={valuationRange} />

        <p className="notice-text">
          A/B/C 기준 1차 추정가는 산정 구조를 이해하기 위한 비교값입니다. 현재
          모델 추정가는 기존 로직으로 계산된 값이며, 다음 단계에서 A/B/C
          가중산식과 수급·위험 보정을 실제 최종 추정 주가 산식에 반영합니다.
        </p>
      </Card>
    </section>
  );
}

function TargetStructureBox({
  score,
  basis,
  abcEstimate,
}: {
  score?: CompositeScore;
  basis?: TargetBasis | null;
  abcEstimate: AbcEstimate;
}) {
  const range = score?.targetPrice?.technicalTargetRange;
  const valuationRange = score?.targetPrice?.valuationTargetRange ?? null;
  const technicalBasisPrice = getTechnicalBasisPrice(basis, range?.baseTarget);
  const valuationTarget = valuationRange?.valuationTarget ?? null;
  const consensusTarget = score?.targetPrice?.consensusTarget ?? null;
  const supplyScore = score?.supply?.score ?? null;
  const riskLine = range?.riskLine ?? null;
  const modelGap =
    abcEstimate.value != null && range?.baseTarget != null
      ? percentChange(range.baseTarget, abcEstimate.value)
      : null;

  return (
    <div className="target-basis-box" style={{ marginTop: 16 }}>
      <div className="target-basis-header">
        <span>추정 주가 산정 구조</span>
        <strong>A/B/C 기준가와 현재 모델 추정가 비교</strong>
      </div>

      <p className="target-basis-summary">
        A/B/C 기준가는 추정 주가를 이해하기 위한 분해값입니다. 현재 모델
        추정가가 A/B/C 기준 1차 추정가와 크게 다르면, 아직 기존 산식의 보정값이
        크게 작동하고 있다는 뜻입니다.
      </p>

      <div className="target-grid" style={{ marginTop: 12 }}>
        <TargetMetricCard
          title="A. 기술적 기준가"
          value={formatNumber(technicalBasisPrice)}
          subText={makeTechnicalBasisText(basis)}
          tone={getTargetTone(
            range?.currentPrice && technicalBasisPrice
              ? percentChange(technicalBasisPrice, range.currentPrice)
              : null,
          )}
        />
        <TargetMetricCard
          title="B. 실적·밸류 기준가"
          value={formatNumber(valuationTarget)}
          subText={makeValuationText(valuationRange)}
          tone={getValuationTone(valuationTarget, range?.currentPrice)}
        />
        <TargetMetricCard
          title="C. 컨센서스 기준가"
          value={formatNumber(consensusTarget)}
          subText="컨센서스 입력 후 별도 기준가로 표시"
          tone="neutral"
        />
        <TargetMetricCard
          title="A/B/C 기준 1차 추정가"
          value={formatNumber(abcEstimate.value)}
          subText={formatAbcWeights(abcEstimate)}
          tone={getTargetTone(
            range?.currentPrice && abcEstimate.value
              ? percentChange(abcEstimate.value, range.currentPrice)
              : null,
          )}
        />
        <TargetMetricCard
          title="현재 모델 추정가"
          value={formatNumber(range?.baseTarget)}
          subText={`A/B/C 1차 대비 ${formatUpside(modelGap)}`}
          tone={getTargetTone(modelGap)}
        />
        <TargetMetricCard
          title="수급 참고"
          value={formatScore(supplyScore)}
          subText={makeSupplyText(score)}
          tone={getScoreTone(supplyScore)}
        />
        <TargetMetricCard
          title="하락 지지선"
          value={formatNumber(riskLine)}
          subText={makeRiskText(range)}
          tone="negative"
        />
      </div>

      <div className="target-basis-adjustments">
        <p>
          현재 표시 기준: 컨센서스가 없으면 A 기술적 기준가 60%, B 실적·밸류
          기준가 40%로 A/B 기준 1차 추정가를 계산합니다.
        </p>
        <p>
          컨센서스가 있으면 A 40%, B 35%, C 25%로 1차 추정가를 계산하는
          구조를 적용할 예정입니다.
        </p>
        <p>
          현재 모델 추정가는 아직 기존 lib/score.ts 로직의 산출값입니다. 따라서
          A/B/C 기준 1차 추정가와 다를 수 있습니다.
        </p>
      </div>
    </div>
  );
}

function TargetBasisMeta({
  currentPrice,
  lastFetchedAt,
  hasRange,
}: {
  currentPrice?: number | null;
  lastFetchedAt?: string | null;
  hasRange: boolean;
}) {
  return (
    <div className="target-basis-box" style={{ marginBottom: 16 }}>
      <div className="target-basis-header">
        <span>산정 기준</span>
        <strong>{hasRange ? "현재 조회 시점 기준" : "추정 주가 산정 대기"}</strong>
      </div>
      <p className="target-basis-summary">
        조회 시각: {formatDateTime(lastFetchedAt)} · 기준 현재가:{" "}
        {formatNumber(currentPrice)}
      </p>
      <div className="target-basis-adjustments">
        <p>
          추정 주가 성격: A 기술적 기준가, B 실적·밸류 기준가, C 컨센서스
          기준가를 구분해 현재 모델 추정가와 비교하는 참고 지표
        </p>
        <p>
          다시 조회하면 최신 현재가와 지표를 기준으로 추정 주가 참고 범위가
          갱신됩니다.
        </p>
      </div>
    </div>
  );
}

function TargetBasisBox({
  basis,
  valuationRange,
}: {
  basis?: TargetBasis | null;
  valuationRange?: NonNullable<CompositeScore["targetPrice"]["valuationTargetRange"]> | null;
}) {
  if (!basis) {
    return null;
  }

  return (
    <div className="target-basis-box">
      <div className="target-basis-header">
        <span>세부 산정 근거</span>
        <strong>산정 방식: {basis.method}</strong>
      </div>

      <p className="target-basis-summary">{basis.summary}</p>

      <div className="target-basis-table-wrap">
        <table className="target-basis-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>가격</th>
              <th>반영 비중</th>
            </tr>
          </thead>
          <tbody>
            {basis.candidates.map((candidate) => (
              <tr key={candidate.label}>
                <td>{candidate.label}</td>
                <td>{formatNumber(candidate.value)}</td>
                <td>{formatWeight(candidate.weight)}</td>
              </tr>
            ))}
            {valuationRange?.valuationTarget != null ? (
              <tr>
                <td>B. 실적·밸류 기준가</td>
                <td>{formatNumber(valuationRange.valuationTarget)}</td>
                <td>별도 기준가</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="target-basis-adjustments">
        {basis.adjustments.map((adjustment) => (
          <p key={adjustment}>{adjustment}</p>
        ))}
      </div>
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

function calculateAbcEstimate({
  technicalTarget,
  valuationTarget,
  consensusTarget,
}: {
  technicalTarget?: number | null;
  valuationTarget?: number | null;
  consensusTarget?: number | null;
}): AbcEstimate {
  const hasTechnical =
    technicalTarget != null && Number.isFinite(technicalTarget);
  const hasValuation =
    valuationTarget != null && Number.isFinite(valuationTarget);
  const hasConsensus =
    consensusTarget != null && Number.isFinite(consensusTarget);

  if (!hasTechnical && !hasValuation && !hasConsensus) {
    return {
      value: null,
      technicalWeight: null,
      valuationWeight: null,
      consensusWeight: null,
      description: "A/B/C 기준가 대기",
    };
  }

  if (hasConsensus) {
    const weights = normalizeWeights({
      technicalWeight: hasTechnical ? 0.4 : 0,
      valuationWeight: hasValuation ? 0.35 : 0,
      consensusWeight: 0.25,
    });

    const value =
      (technicalTarget ?? 0) * weights.technicalWeight +
      (valuationTarget ?? 0) * weights.valuationWeight +
      (consensusTarget ?? 0) * weights.consensusWeight;

    return {
      value: roundPrice(value),
      ...weights,
      description: "A 40% · B 35% · C 25% 기준",
    };
  }

  const weights = normalizeWeights({
    technicalWeight: hasTechnical ? 0.6 : 0,
    valuationWeight: hasValuation ? 0.4 : 0,
    consensusWeight: 0,
  });

  const value =
    (technicalTarget ?? 0) * weights.technicalWeight +
    (valuationTarget ?? 0) * weights.valuationWeight;

  return {
    value: roundPrice(value),
    ...weights,
    description: "A 60% · B 40% 기준",
  };
}

function normalizeWeights({
  technicalWeight,
  valuationWeight,
  consensusWeight,
}: {
  technicalWeight: number;
  valuationWeight: number;
  consensusWeight: number;
}) {
  const total = technicalWeight + valuationWeight + consensusWeight;

  if (total <= 0) {
    return {
      technicalWeight: 0,
      valuationWeight: 0,
      consensusWeight: 0,
    };
  }

  return {
    technicalWeight: technicalWeight / total,
    valuationWeight: valuationWeight / total,
    consensusWeight: consensusWeight / total,
  };
}

function makeTargetComment(score: CompositeScore | undefined, abcEstimate: AbcEstimate) {
  const range = score?.targetPrice?.technicalTargetRange;

  if (!range) {
    return "분석 실행 후 현재 조회 시점 기준 추정 주가 참고 범위가 표시됩니다.";
  }

  const modelGap =
    abcEstimate.value != null ? percentChange(range.baseTarget, abcEstimate.value) : null;
  const targetProgress =
    range.baseTarget > 0 ? (range.currentPrice / range.baseTarget) * 100 : null;
  const upsidePrice = range.baseTarget - range.currentPrice;

  if (modelGap != null && Math.abs(modelGap) >= 10) {
    return `현재 모델 추정가는 A/B/C 기준 1차 추정가와 ${formatUpside(
      modelGap,
    )} 차이가 있습니다. 아직 기존 모델 보정값이 크게 반영된 상태이므로, 다음 단계에서 A/B/C 산식을 실제 최종 산식에 맞춰 정리해야 합니다.`;
  }

  if (targetProgress != null && targetProgress >= 97) {
    return `기준 현재가가 현재 모델 추정가의 ${targetProgress.toFixed(
      1,
    )}% 수준입니다. 남은 상승여력은 ${formatSignedNumber(
      upsidePrice,
    )}로 제한적일 수 있어 수급과 하락 지지선을 함께 확인해야 합니다.`;
  }

  return "A/B/C 기준 1차 추정가와 현재 모델 추정가를 비교해, 기존 모델이 어느 정도 공격적 또는 보수적으로 계산됐는지 확인하는 구간입니다.";
}

function getTechnicalBasisPrice(
  basis?: TargetBasis | null,
  fallback?: number | null,
) {
  const technicalCandidate = basis?.candidates.find((candidate) =>
    candidate.label.includes("기술"),
  );

  return technicalCandidate?.value ?? fallback ?? null;
}

function makeTechnicalBasisText(basis?: TargetBasis | null) {
  if (!basis) return "차트 기반 기준가 대기";

  const technicalCandidate = basis.candidates.find((candidate) =>
    candidate.label.includes("기술"),
  );

  if (technicalCandidate) {
    return `기술 후보 반영 비중 ${formatWeight(technicalCandidate.weight)}`;
  }

  return "최근 고점·볼린저밴드·변동성 기반";
}

function makeValuationText(
  valuationRange?: NonNullable<CompositeScore["targetPrice"]["valuationTargetRange"]> | null,
) {
  if (!valuationRange?.valuationTarget) {
    return "EPS/BPS 또는 PER/PBR 데이터 부족";
  }

  const parts = [];

  if (valuationRange.epsTarget != null) {
    parts.push("EPS 기준 포함");
  }

  if (valuationRange.bpsTarget != null) {
    parts.push("BPS 기준 포함");
  }

  return parts.length > 0 ? parts.join(" · ") : "실적·밸류 기준";
}

function makeSupplyText(score?: CompositeScore) {
  const supplyScore = score?.supply?.score ?? null;

  if (supplyScore == null) return "수급 데이터 대기";
  if (supplyScore >= 70) return "외국인·기관 흐름 우호";
  if (supplyScore < 50) return "수급 보수적";
  return "수급 중립";
}

function makeRiskText(range?: CompositeScore["targetPrice"]["technicalTargetRange"]) {
  if (!range) return "하락 지지선 대기";

  return `현재가 대비 ${formatUpside(range.riskDownsidePercent)}`;
}

function percentChange(target: number, current: number) {
  if (!Number.isFinite(target) || !Number.isFinite(current) || current === 0) {
    return null;
  }

  return ((target - current) / current) * 100;
}

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return null;

  if (value >= 100_000) return Math.round(value / 10) * 10;
  if (value >= 10_000) return Math.round(value / 5) * 5;
  return Math.round(value);
}

function formatAbcWeights(estimate: AbcEstimate) {
  const parts = [];

  if (estimate.technicalWeight != null && estimate.technicalWeight > 0) {
    parts.push(`A ${formatWeight(estimate.technicalWeight)}`);
  }

  if (estimate.valuationWeight != null && estimate.valuationWeight > 0) {
    parts.push(`B ${formatWeight(estimate.valuationWeight)}`);
  }

  if (estimate.consensusWeight != null && estimate.consensusWeight > 0) {
    parts.push(`C ${formatWeight(estimate.consensusWeight)}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "가중치 대기";
}

function formatScore(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${value} / 100`;
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

function formatWeight(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${(value * 100).toFixed(1)}%`;
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

function getValuationTone(
  valuationTarget?: number | null,
  currentPrice?: number | null,
): TargetTone {
  if (
    valuationTarget == null ||
    Number.isNaN(valuationTarget) ||
    currentPrice == null ||
    Number.isNaN(currentPrice)
  ) {
    return "neutral";
  }

  if (valuationTarget > currentPrice) return "positive";
  if (valuationTarget < currentPrice) return "negative";
  return "neutral";
}

function getScoreTone(value?: number | null): TargetTone {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value >= 70) return "positive";
  if (value < 50) return "negative";
  return "neutral";
}

function getTargetProgressTone(value?: number | null): TargetTone {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value >= 97) return "negative";
  if (value >= 90) return "neutral";
  return "positive";
}


"use client";

import type { ReactNode } from "react";
import type { CompositeScore, TargetBasis } from "../../types/stock";

type Props = {
  score?: CompositeScore;
  lastFetchedAt?: string | null;
};

type TargetTone = "positive" | "negative" | "neutral";

export default function TargetPriceSection({ score, lastFetchedAt }: Props) {
  const range = score?.targetPrice?.technicalTargetRange;
  const basis = score?.targetPrice?.targetBasis;
  const valuationRange = score?.targetPrice?.valuationTargetRange ?? null;

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
              현재 조회 시점의 가격을 기준으로 A 기술적 기준가, B 실적·밸류
              기준가, C 컨센서스 기준가를 구분하고 수급·위험 보정을 함께
              확인합니다.
            </p>
          </div>
          <div className={`target-badge ${range ? "available" : "unavailable"}`}>
            {range ? "추정 주가 산정 구조" : "추정 주가 대기"}
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
            title="최종 추정 주가"
            value={formatNumber(range?.baseTarget)}
            subText={`현재가 대비 추정 괴리율 ${formatUpside(range?.baseUpsidePercent)}`}
            tone={getTargetTone(range?.baseUpsidePercent)}
          />
          <TargetMetricCard
            title="추정 주가 도달률"
            value={formatTargetProgress(targetProgress)}
            subText="기준 현재가 / 최종 추정 주가"
            tone={getTargetProgressTone(targetProgress)}
          />
          <TargetMetricCard
            title="상승여력 가격"
            value={formatSignedNumber(upsidePrice)}
            subText={`현재가 대비 차이 ${formatUpside(range?.baseUpsidePercent)}`}
            tone={getTargetTone(upsidePrice)}
          />
          <TargetMetricCard
            title="위험 기준선"
            value={formatNumber(range?.riskLine)}
            subText={`하락 위험 ${formatUpside(range?.riskDownsidePercent)}`}
            tone="negative"
          />
        </div>

        <TargetStructureBox score={score} basis={basis} />

        <div className="target-comment-box">
          <span>해석</span>
          <strong>{makeTargetComment(score)}</strong>
        </div>

        <TargetBasisBox basis={basis} valuationRange={valuationRange} />

        <p className="notice-text">
          최종 추정 주가는 A 기술적 기준가와 B 실적·밸류 기준가를 우선
          반영하고, C 컨센서스 데이터가 입력되면 별도 기준가로 비교합니다.
          이후 수급과 위험 요인을 보정해 해석합니다.
        </p>
      </Card>
    </section>
  );
}

function TargetStructureBox({
  score,
  basis,
}: {
  score?: CompositeScore;
  basis?: TargetBasis | null;
}) {
  const range = score?.targetPrice?.technicalTargetRange;
  const valuationRange = score?.targetPrice?.valuationTargetRange ?? null;
  const technicalBasisPrice = getTechnicalBasisPrice(basis, range?.baseTarget);
  const valuationTarget = valuationRange?.valuationTarget ?? null;
  const consensusTarget = score?.targetPrice?.consensusTarget ?? null;
  const supplyScore = score?.supply?.score ?? null;
  const riskLine = range?.riskLine ?? null;

  return (
    <div className="target-basis-box" style={{ marginTop: 16 }}>
      <div className="target-basis-header">
        <span>추정 주가 산정 구조</span>
        <strong>A/B/C 기준가 + 수급·위험 보정</strong>
      </div>

      <p className="target-basis-summary">
        1차 기준가는 A 기술적 기준가, B 실적·밸류 기준가, C 컨센서스
        기준가를 구분해 확인합니다. 최종 추정 주가는 여기에 수급 보정과 위험
        보정을 함께 고려합니다.
      </p>

      <div className="target-grid" style={{ marginTop: 12 }}>
        <TargetMetricCard
          title="A. 기술적 기준가"
          value={formatNumber(technicalBasisPrice)}
          subText={makeTechnicalBasisText(basis)}
          tone={getTargetTone(range?.baseUpsidePercent)}
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
          subText="컨센서스 입력 후 산정 반영 예정"
          tone="neutral"
        />
        <TargetMetricCard
          title="수급 보정"
          value={formatScore(supplyScore)}
          subText={makeSupplyText(score)}
          tone={getScoreTone(supplyScore)}
        />
        <TargetMetricCard
          title="위험 보정"
          value={formatNumber(riskLine)}
          subText={makeRiskText(range)}
          tone="negative"
        />
        <TargetMetricCard
          title="최종 추정 주가"
          value={formatNumber(range?.baseTarget)}
          subText={`추정 괴리율 ${formatUpside(range?.baseUpsidePercent)}`}
          tone={getTargetTone(range?.baseUpsidePercent)}
        />
      </div>

      <div className="target-basis-adjustments">
        <p>
          산식 방향: 1차 기준가 = A 기술적 기준가 × 기술 비중 + B 실적·밸류
          기준가 × 실적 비중 + C 컨센서스 기준가 × 컨센서스 비중
        </p>
        <p>
          최종 추정 주가 = 1차 기준가 × 수급 보정 × 위험 보정
        </p>
        <p>
          현재 단계에서는 C 컨센서스 기준가는 입력·저장 후 별도 기준가로
          표시하고, 다음 단계에서 실제 산식에 반영합니다.
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
          추정 주가 성격: 기술적 기준가, 실적·밸류 기준가, 컨센서스 기준가를
          구분해 최종 추정 주가를 해석하는 참고 지표
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

function makeTargetComment(score?: CompositeScore) {
  const range = score?.targetPrice?.technicalTargetRange;

  if (!range) {
    return "분석 실행 후 현재 조회 시점 기준 추정 주가 참고 범위가 표시됩니다.";
  }

  const targetScore = score?.targetPrice?.score ?? 0;
  const supplyScore = score?.supply?.score ?? 0;
  const volumeScore = score?.volume?.score ?? 0;
  const targetProgress =
    range.baseTarget > 0 ? (range.currentPrice / range.baseTarget) * 100 : null;
  const upsidePrice = range.baseTarget - range.currentPrice;

  if (targetProgress != null && targetProgress >= 97) {
    return `기준 현재가가 최종 추정 주가의 ${targetProgress.toFixed(
      1,
    )}% 수준입니다. 남은 상승여력은 ${formatSignedNumber(
      upsidePrice,
    )}로 제한적일 수 있어 수급 보정과 위험 보정을 우선 확인해야 합니다.`;
  }

  if (targetScore >= 70 && supplyScore >= 70 && volumeScore >= 65) {
    return "기술적 기준가와 수급·거래 흐름이 함께 받쳐주고 있어 최종 추정 주가까지는 관심 구간으로 볼 수 있습니다.";
  }

  if (targetScore >= 65 && supplyScore >= 70) {
    return "수급은 긍정적이지만 거래 확인이 필요합니다. 최종 추정 주가를 참고하되 보수 기준가와 위험 기준선을 함께 확인하는 것이 좋습니다.";
  }

  if (targetScore < 50) {
    return "상승여력이 작거나 위험 기준선이 가까운 구간입니다. 무리한 추정 주가 해석보다는 위험 관리가 필요합니다.";
  }

  return "A 기술적 기준가, B 실적·밸류 기준가, 수급·위험 보정을 함께 확인해 최종 추정 주가를 해석해야 합니다.";
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
  if (supplyScore < 50) return "수급 보정 보수 적용";
  return "수급 중립 확인";
}

function makeRiskText(range?: CompositeScore["targetPrice"]["technicalTargetRange"]) {
  if (!range) return "위험 기준선 대기";

  return `현재가 대비 ${formatUpside(range.riskDownsidePercent)}`;
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

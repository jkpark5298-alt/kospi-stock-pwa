"use client";

import type { ReactNode } from "react";
import type { CompositeScore, TargetBasis } from "../../types/stock";

type Props = {
  score?: CompositeScore;
};

export default function TargetPriceSection({ score }: Props) {
  const range = score?.targetPrice?.technicalTargetRange;
  const basis = score?.targetPrice?.targetBasis;

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
            <SectionTitleSmall>목표가 참고 범위</SectionTitleSmall>
            <p className="target-subtitle">
              기준 목표가, 목표 도달률, 상승 여력 가격을 중심으로 현재 가격
              위치를 확인합니다.
            </p>
          </div>
          <div
            className={`target-badge ${range ? "available" : "unavailable"}`}
          >
            {range ? "기술·밸류·퀀트 목표가" : "목표가 대기"}
          </div>
        </div>

        <div className="target-grid">
          <TargetMetricCard
            title="현재가"
            value={formatNumber(range?.currentPrice)}
            subText="분석 기준 가격"
            tone="neutral"
          />
          <TargetMetricCard
            title="기준 목표가"
            value={formatNumber(range?.baseTarget)}
            subText={`상승 여력률 ${formatUpside(range?.baseUpsidePercent)}`}
            tone={getTargetTone(range?.baseUpsidePercent)}
          />
          <TargetMetricCard
            title="목표 도달률"
            value={formatTargetProgress(targetProgress)}
            subText="현재가 / 기준 목표가"
            tone={getTargetProgressTone(targetProgress)}
          />
          <TargetMetricCard
            title="상승 여력 가격"
            value={formatSignedNumber(upsidePrice)}
            subText={`상승 여력률 ${formatUpside(range?.baseUpsidePercent)}`}
            tone={getTargetTone(upsidePrice)}
          />
          <TargetMetricCard
            title="위험 기준선"
            value={formatNumber(range?.riskLine)}
            subText={`하락 여지 ${formatUpside(range?.riskDownsidePercent)}`}
            tone="negative"
          />
        </div>

        <div className="target-comment-box">
          <span>해석</span>
          <strong>{makeTargetComment(score)}</strong>
        </div>

        <TargetBasisBox basis={basis} />

        <p className="notice-text">
          이 값은 증권사 목표주가가 아니라 차트·밸류에이션·퀀트 보정 기반 참고
          범위입니다. 실제 투자 판단에는 시장 상황과 리스크를 함께 확인해야
          합니다.
        </p>
      </Card>
    </section>
  );
}

function TargetBasisBox({ basis }: { basis?: TargetBasis | null }) {
  if (!basis) {
    return null;
  }

  return (
    <div className="target-basis-box">
      <div className="target-basis-header">
        <span>산정 근거</span>
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
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="target-metric-card">
      <span>{title}</span>
      <strong className={tone}>{value}</strong>
      <em className={tone}>{subText}</em>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function SectionTitleSmall({ children }: { children: ReactNode }) {
  return <h3 className="section-title small">{children}</h3>;
}

function makeTargetComment(score?: CompositeScore) {
  const range = score?.targetPrice?.technicalTargetRange;

  if (!range) {
    return "분석 실행 후 목표가 참고 범위가 표시됩니다.";
  }

  const targetScore = score?.targetPrice?.score ?? 0;
  const supplyScore = score?.supply?.score ?? 0;
  const volumeScore = score?.volume?.score ?? 0;
  const targetProgress =
    range.baseTarget > 0 ? (range.currentPrice / range.baseTarget) * 100 : null;
  const upsidePrice = range.baseTarget - range.currentPrice;

  if (targetProgress != null && targetProgress >= 97) {
    return `현재가는 기준 목표가의 ${targetProgress.toFixed(1)}% 수준입니다. 상승 여력은 ${formatSignedNumber(
      upsidePrice,
    )}로 크지 않으므로 목표 도달률을 우선 확인해야 합니다.`;
  }

  if (targetScore >= 70 && supplyScore >= 70 && volumeScore >= 65) {
    return "수급과 거래량이 함께 받쳐주고 있어 기준 목표가까지는 관심 구간으로 볼 수 있습니다.";
  }

  if (targetScore >= 65 && supplyScore >= 70) {
    return "수급은 긍정적이나 거래량 확인이 필요합니다. 기준 목표가는 참고하되 보수적 목표가를 먼저 확인하는 것이 좋습니다.";
  }

  if (targetScore < 50) {
    return "상승 여력이 크지 않거나 위험 기준선이 가까운 구간입니다. 무리한 목표가 추정은 주의가 필요합니다.";
  }

  return "기술·밸류에이션·퀀트 보정 기반 목표가 참고 범위가 계산되었습니다. 위험 기준선 이탈 여부를 함께 확인해야 합니다.";
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

function getTargetTone(
  value?: number | null,
): "positive" | "negative" | "neutral" {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function getTargetProgressTone(
  value?: number | null,
): "positive" | "negative" | "neutral" {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value >= 97) return "negative";
  if (value >= 90) return "neutral";
  return "positive";
}

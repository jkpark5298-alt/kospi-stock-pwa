"use client";

import type { ReactNode } from "react";
import type { CompositeScore } from "../../types/stock";

type Props = {
  score?: CompositeScore;
  lastFetchedAt?: string | null;
};

type TargetTone = "positive" | "negative" | "neutral";

export default function TargetPriceSection({ score, lastFetchedAt }: Props) {
  const range =
    score?.targetPrice?.finalTargetRange ??
    score?.targetPrice?.technicalTargetRange ??
    null;

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
            <SectionTitleSmall>참고 범위</SectionTitleSmall>
            <p className="target-subtitle">
              추정가 산정은 Summary의 “추정가 산정 방식”에서 하나로 확인합니다.
              이 영역은 보수·기준·공격 범위와 위험 기준선만 참고용으로 보여줍니다.
            </p>
          </div>
          <div className={`target-badge ${range ? "available" : "unavailable"}`}>
            {range ? "참고 범위 표시" : "데이터 대기"}
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
            subText="조회 시점 가격"
            tone="neutral"
          />
          <TargetMetricCard
            title="보수 범위"
            value={formatNumber(range?.conservativeTarget)}
            subText={`현재가 대비 ${formatUpside(range?.conservativeUpsidePercent)}`}
            tone={getTargetTone(range?.conservativeUpsidePercent)}
          />
          <TargetMetricCard
            title="기준 범위"
            value={formatNumber(range?.baseTarget)}
            subText={`현재가 대비 ${formatUpside(range?.baseUpsidePercent)}`}
            tone={getTargetTone(range?.baseUpsidePercent)}
          />
          <TargetMetricCard
            title="공격 범위"
            value={formatNumber(range?.aggressiveTarget)}
            subText={`현재가 대비 ${formatUpside(range?.aggressiveUpsidePercent)}`}
            tone={getTargetTone(range?.aggressiveUpsidePercent)}
          />
          <TargetMetricCard
            title="도달률"
            value={formatTargetProgress(targetProgress)}
            subText="현재가 / 기준 범위"
            tone={getTargetProgressTone(targetProgress)}
          />
          <TargetMetricCard
            title="남은 차이"
            value={formatSignedNumber(upsidePrice)}
            subText={`기준 범위와 현재가 차이 ${formatUpside(range?.baseUpsidePercent)}`}
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
          추정가 숫자는 Summary의 “추정가 산정 방식”에서 하나로 표시합니다.
          이 참고 범위는 매수·보유 판단을 돕기 위한 보조 구간입니다.
        </p>
      </Card>
    </section>
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
        <span>기준 정보</span>
        <strong>{hasRange ? "현재 조회 시점 기준" : "참고 범위 대기"}</strong>
      </div>
      <p className="target-basis-summary">
        조회 시각: {formatDateTime(lastFetchedAt)} · 기준 현재가:{" "}
        {formatNumber(currentPrice)}
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

function makeTargetComment(
  range?: NonNullable<CompositeScore["targetPrice"]["finalTargetRange"]> | null,
) {
  if (!range) {
    return "분석 실행 후 참고 범위가 표시됩니다.";
  }

  const targetProgress =
    range.baseTarget > 0 ? (range.currentPrice / range.baseTarget) * 100 : null;
  const upsidePrice = range.baseTarget - range.currentPrice;

  if (targetProgress != null && targetProgress >= 97) {
    return `현재가가 기준 범위의 ${targetProgress.toFixed(
      1,
    )}% 수준입니다. 남은 차이는 ${formatSignedNumber(
      upsidePrice,
    )}로 제한적일 수 있어 수급과 위험 기준선을 함께 확인해야 합니다.`;
  }

  if (range.baseUpsidePercent > 0) {
    return `기준 범위까지 ${formatUpside(
      range.baseUpsidePercent,
    )}의 여력이 있습니다. 단, 위험 기준선과 Detail 4~5의 수급·위험 분석을 함께 확인해야 합니다.`;
  }

  if (range.baseUpsidePercent < 0) {
    return `현재가가 기준 범위를 웃돌고 있습니다. 단기 과열 여부와 위험 기준선을 먼저 확인하는 것이 좋습니다.`;
  }

  return "현재가는 기준 범위와 가까운 수준입니다. 추가 판단은 Detail 영역의 기준가·수급·위험 분석을 함께 확인하세요.";
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
  if (value >= 97) return "negative";
  if (value >= 90) return "neutral";
  return "positive";
}

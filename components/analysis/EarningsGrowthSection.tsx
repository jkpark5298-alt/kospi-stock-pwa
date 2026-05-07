"use client";

import type { ReactNode } from "react";
import type { EarningsGrowthData } from "../../types/stock";

type Props = {
  earningsGrowth?: EarningsGrowthData;
};

export default function EarningsGrowthSection({ earningsGrowth }: Props) {
  const data = earningsGrowth ?? makeEmptyEarningsGrowth();

  return (
    <section className="score-section">
      <Card>
        <div className="score-header">
          <div>
            <SectionTitleSmall>실적 성장 분석</SectionTitleSmall>
            <p className="score-subtitle">
              예상 순이익·영업이익·EPS 성장률과 흑자 전환 여부를 기준으로
              회사의 이익 성장 가능성을 확인합니다.
            </p>
          </div>

          <div className="score-mode-badge">
            {data.available ? "실적 데이터 반영" : "데이터 준비 중"}
          </div>
        </div>

        <div className="score-main-grid">
          <div className="score-total-card">
            <div className="score-total-label">실적 성장 점수</div>
            <div className="score-total-value">
              {data.score != null ? `${data.score}` : "-"}
              <span>/ 100</span>
            </div>
            <div className={`score-grade ${getScoreGradeTone(data.score)}`}>
              {data.label || "데이터 대기"}
            </div>
          </div>

          <div className="score-detail-grid">
            <MetricCard
              title="예상 순이익 증가율"
              value={formatPercent(data.netIncomeGrowthRate)}
              caption={formatIncomePair(
                data.lastYearNetIncome,
                data.expectedNetIncome,
              )}
            />

            <MetricCard
              title="예상 영업이익 증가율"
              value={formatPercent(data.operatingProfitGrowthRate)}
              caption={formatIncomePair(
                data.lastYearOperatingProfit,
                data.expectedOperatingProfit,
              )}
            />

            <MetricCard
              title="예상 EPS 증가율"
              value={formatPercent(data.epsGrowthRate)}
              caption={formatEpsPair(data.lastYearEps, data.expectedEps)}
            />

            <MetricCard
              title="흑자 전환 여부"
              value={formatTurnaround(data.turnaround, data.deficitReduction)}
              caption="순이익 또는 영업이익 개선 여부"
            />
          </div>
        </div>

        <div className="score-comment-box">
          <span>판단 요약</span>
          <strong>{makeSummary(data)}</strong>
        </div>

        <div className="target-plan-box">
          <span>데이터 연결 상태</span>
          <p>
            {data.available
              ? `실적 성장 데이터 출처: ${formatSource(data.source)}`
              : "현재는 실적 성장 점수 구조만 준비된 상태입니다. 다음 단계에서 KIS, DART, 컨센서스 또는 수동 입력 데이터를 연결할 수 있습니다."}
          </p>
        </div>

        <p className="notice-text">
          실적 성장 점수는 회사의 이익 성장 가능성을 보기 위한 보조 지표입니다.
          예상치는 실제 발표 실적과 달라질 수 있으므로 기술·수급·거래대금
          흐름과 함께 확인해야 합니다.
        </p>
      </Card>
    </section>
  );
}

function MetricCard({
  title,
  value,
  caption,
}: {
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="score-part-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <em>{caption}</em>
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

function makeEmptyEarningsGrowth(): EarningsGrowthData {
  return {
    available: false,
    source: "none",
    updatedAt: null,
    warning: "예상 실적 데이터 연결 전입니다.",

    lastYearNetIncome: null,
    expectedNetIncome: null,
    netIncomeGrowthRate: null,

    lastYearOperatingProfit: null,
    expectedOperatingProfit: null,
    operatingProfitGrowthRate: null,

    lastYearEps: null,
    expectedEps: null,
    epsGrowthRate: null,

    turnaround: null,
    deficitReduction: null,

    score: null,
    label: "데이터 대기",
    reasons: [
      "예상 순이익·영업이익·EPS 성장률 데이터는 다음 단계에서 연결됩니다.",
    ],
  };
}

function makeSummary(data: EarningsGrowthData) {
  if (!data.available) {
    return (
      data.reasons?.[0] ||
      "예상 순이익·영업이익·EPS 성장률 데이터 연결 전입니다."
    );
  }

  const positives: string[] = [];
  const cautions: string[] = [];

  if ((data.netIncomeGrowthRate ?? 0) >= 10) {
    positives.push("예상 순이익 증가");
  } else if (data.netIncomeGrowthRate != null && data.netIncomeGrowthRate <= 0) {
    cautions.push("예상 순이익 정체 또는 감소");
  }

  if ((data.operatingProfitGrowthRate ?? 0) >= 10) {
    positives.push("예상 영업이익 증가");
  } else if (
    data.operatingProfitGrowthRate != null &&
    data.operatingProfitGrowthRate <= 0
  ) {
    cautions.push("예상 영업이익 정체 또는 감소");
  }

  if ((data.epsGrowthRate ?? 0) >= 10) {
    positives.push("예상 EPS 증가");
  }

  if (data.turnaround) {
    positives.push("흑자 전환 기대");
  } else if (data.deficitReduction) {
    positives.push("적자 축소 기대");
  }

  if (positives.length > 0 && cautions.length > 0) {
    return `${positives.join(", ")}는 긍정적이나 ${cautions.join(
      ", ",
    )} 여부 확인이 필요합니다.`;
  }

  if (positives.length > 0) {
    return `${positives.join(", ")} 흐름이 실적 성장 측면에서 긍정적입니다.`;
  }

  if (cautions.length > 0) {
    return `${cautions.join(", ")} 가능성이 있어 보수적 확인이 필요합니다.`;
  }

  return "실적 성장 데이터는 있으나 뚜렷한 성장 신호는 아직 확인되지 않습니다.";
}

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "데이터 준비 중";

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatIncomePair(previous: number | null, expected: number | null) {
  if (previous == null || expected == null) {
    return "전년/예상 데이터 준비 중";
  }

  return `전년 ${formatNumber(previous)} → 예상 ${formatNumber(expected)}`;
}

function formatEpsPair(previous: number | null, expected: number | null) {
  if (previous == null || expected == null) {
    return "전년/예상 EPS 준비 중";
  }

  return `전년 ${formatNumber(previous)} → 예상 ${formatNumber(expected)}`;
}

function formatTurnaround(
  turnaround: boolean | null,
  deficitReduction: boolean | null,
) {
  if (turnaround === true) return "흑자 전환 기대";
  if (deficitReduction === true) return "적자 축소 기대";
  if (turnaround === false || deficitReduction === false) return "해당 없음";
  return "데이터 준비 중";
}

function formatSource(source: EarningsGrowthData["source"]) {
  if (source === "manual") return "수동 입력";
  if (source === "kis") return "KIS";
  if (source === "dart") return "DART";
  if (source === "consensus") return "컨센서스";
  return "미연결";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function getScoreGradeTone(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value >= 65) return "positive";
  if (value >= 50) return "neutral";
  return "negative";
}

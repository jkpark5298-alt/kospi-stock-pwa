"use client";

import { useState, type ReactNode } from "react";
import type { CompositeScore, ScorePart, ScoreWeights } from "../../types/stock";

type Props = {
  score?: CompositeScore;
};

type ExtendedScoreKey =
  | keyof ScoreWeights
  | "signalAgreement"
  | "earningsGrowth";

export default function CompositeScoreSection({ score }: Props) {
  const [isWeightDetailOpen, setIsWeightDetailOpen] = useState(false);
  const signalAgreement = getScorePart(score, "signalAgreement");
  const earningsGrowth = getScorePart(score, "earningsGrowth");

  return (
    <section className="score-section">
      <Card>
        <div className="score-header">
          <div>
            <SectionTitleSmall>종합 신뢰도 점수</SectionTitleSmall>
            <p className="score-subtitle">
              기술·거래량·거래대금·수급·목표여력·신호 일치도·실적 성장을
              합산해 현재 심리 구간과 분석 신뢰도를 판단합니다. 실적 성장
              데이터가 없으면 해당 가중치는 제외하고 나머지 항목에 재분배합니다.
            </p>
          </div>

          <div className="score-mode-badge">
            {score?.targetPrice?.available
              ? "목표여력 반영"
              : "목표여력 대기"}
          </div>
        </div>

        <div className="score-main-grid">
          <div className="score-total-card">
            <div className="score-total-label">종합 점수</div>
            <div className="score-total-value">
              {score?.total != null ? `${score.total}` : "-"}
              <span>/ 100</span>
            </div>
            <div className={`score-grade ${getScoreGradeTone(score?.total)}`}>
              {score?.grade || "데이터 대기"}
            </div>
          </div>

          <div className="score-detail-grid">
            <ScorePartCard title="기술 점수" part={score?.technical} />
            <ScorePartCard title="거래량·거래대금 점수" part={score?.volume} />
            <ScorePartCard title="수급 점수" part={score?.supply} />
            <ScorePartCard title="목표여력 점수" part={score?.targetPrice} />
            <ScorePartCard title="신호 일치도" part={signalAgreement} />
            <ScorePartCard
              title="실적 성장"
              part={earningsGrowth}
              unavailableScoreText="가중치 제외"
              unavailableLabelText="데이터 없음"
            />
          </div>
        </div>

        <div className="score-weight-box">
          <div>
            <span className="score-weight-title">현재 적용 가중치</span>
            <strong>{formatAppliedWeights(score?.appliedWeights)}</strong>
          </div>
          <p>
            종합 신뢰도는 기술·거래 흐름·수급·추정 주가 여력에 더해 신호
            일치도와 실적 성장을 반영합니다. 데이터가 없는 항목은 제외하고,
            남은 지표에 가중치를 자동 재분배합니다.
          </p>
          <button
            className="button secondary-button"
            type="button"
            onClick={() => setIsWeightDetailOpen((value) => !value)}
          >
            {isWeightDetailOpen ? "가중치 조정 내역 닫기" : "가중치 조정 내역 보기"}
          </button>

          {isWeightDetailOpen ? (
            <WeightAdjustmentTable adjustments={score?.weightAdjustments} />
          ) : null}
        </div>

        <div className="score-comment-box">
          <span>해석</span>
          <strong>
            {score?.comment || "분석 실행 후 종합 점수가 표시됩니다."}
          </strong>
        </div>

        <div className="target-plan-box">
          <span>향후 목표가 자동 산정 구조</span>
          <p>
            {score?.targetPricePlan?.status ||
              "목표가 참고 범위는 분석 실행 후 표시됩니다."}
          </p>
        </div>
      </Card>
    </section>
  );
}

function WeightAdjustmentTable({
  adjustments,
}: {
  adjustments?: Array<{
    label: string;
    baseWeight: number;
    appliedWeight: number | null;
    adjustmentPercent: number | null;
    status: "applied" | "excluded";
    reason: string;
  }>;
}) {
  if (!adjustments || adjustments.length === 0) {
    return (
      <div className="target-basis-box" style={{ marginTop: 12 }}>
        <p className="target-basis-summary">가중치 조정 내역 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="target-basis-table-wrap" style={{ marginTop: 12 }}>
      <table className="target-basis-table">
        <thead>
          <tr>
            <th>지표</th>
            <th>기본 비중</th>
            <th>적용 비중</th>
            <th>조정폭</th>
            <th>사유</th>
          </tr>
        </thead>
        <tbody>
          {adjustments.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{formatWeight(item.baseWeight)}</td>
              <td>
                {item.appliedWeight == null
                  ? "제외"
                  : formatWeight(item.appliedWeight)}
              </td>
              <td>{formatAdjustmentPercent(item.adjustmentPercent)}</td>
              <td>{item.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScorePartCard({
  title,
  part,
  unavailableScoreText = "대기",
  unavailableLabelText = "데이터 대기",
}: {
  title: string;
  part?: ScorePart;
  unavailableScoreText?: string;
  unavailableLabelText?: string;
}) {
  const isAvailable = Boolean(part?.available && part?.score != null);
  const scoreText = isAvailable ? `${part?.score}` : unavailableScoreText;
  const labelText = isAvailable ? part?.label || "데이터 표시" : unavailableLabelText;

  return (
    <div className="score-part-card">
      <span>{title}</span>
      <strong>{scoreText}</strong>
      <em>{labelText}</em>
    </div>
  );
}

function getScorePart(score: CompositeScore | undefined, key: string) {
  if (!score) return undefined;

  return (score as unknown as Record<string, ScorePart | undefined>)[key];
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

function getScoreGradeTone(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value >= 65) return "positive";
  if (value >= 50) return "neutral";
  return "negative";
}

function formatAppliedWeights(weights?: Partial<ScoreWeights>) {
  if (!weights || Object.keys(weights).length === 0) {
    return "데이터 대기";
  }

  const weightMap = weights as Partial<Record<ExtendedScoreKey, number>>;

  const labels: Array<[ExtendedScoreKey, string]> = [
    ["technical", "기술"],
    ["volume", "거래량"],
    ["supply", "수급"],
    ["targetPrice", "목표여력"],
    ["signalAgreement", "신호일치도"],
    ["earningsGrowth", "실적성장"],
  ];

  return labels
    .filter(([key]) => weightMap[key] != null)
    .map(([key, label]) => `${label} ${((weightMap[key] ?? 0) * 100).toFixed(1)}%`)
    .join(" / ");
}


function formatWeight(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatAdjustmentPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "제외";
  if (value > 0) return `+${value.toFixed(1)}%p`;
  if (value < 0) return `${value.toFixed(1)}%p`;
  return "0.0%p";
}

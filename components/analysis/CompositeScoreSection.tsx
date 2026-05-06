"use client";

import type { ReactNode } from "react";
import type { CompositeScore, ScorePart, ScoreWeights } from "../../types/stock";

type Props = {
  score?: CompositeScore;
};

export default function CompositeScoreSection({ score }: Props) {
  return (
    <section className="score-section">
      <Card>
        <div className="score-header">
          <div>
            <SectionTitleSmall>종합 신뢰도 점수</SectionTitleSmall>
            <p className="score-subtitle">
              기술·거래량·수급·목표여력 점수를 합산해 현재 관심 구간 여부를
              진단합니다.
            </p>
          </div>
          <div className="score-mode-badge">
            {score?.targetPrice?.available ? "목표여력 반영" : "목표여력 대기"}
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
            <ScorePartCard title="거래량 점수" part={score?.volume} />
            <ScorePartCard title="수급 점수" part={score?.supply} />
            <ScorePartCard title="목표여력 점수" part={score?.targetPrice} />
          </div>
        </div>

        <div className="score-weight-box">
          <div>
            <span className="score-weight-title">현재 적용 가중치</span>
            <strong>{formatAppliedWeights(score?.appliedWeights)}</strong>
          </div>
          <p>
            목표여력 점수는 기준 목표가 대비 남은 상승 공간과 수급·거래량 보정을
            함께 반영합니다. 컨센서스 목표가는 아직 연결하지 않았습니다.
          </p>
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

function ScorePartCard({ title, part }: { title: string; part?: ScorePart }) {
  const scoreText = part?.score != null ? `${part.score}` : "대기";
  const labelText = part?.label || "데이터 대기";

  return (
    <div className="score-part-card">
      <span>{title}</span>
      <strong>{scoreText}</strong>
      <em>{labelText}</em>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
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
  if (!weights || Object.keys(weights).length === 0) return "데이터 대기";

  const labels: Array<[keyof ScoreWeights, string]> = [
    ["technical", "기술"],
    ["volume", "거래량"],
    ["supply", "수급"],
    ["targetPrice", "목표여력"],
  ];

  return labels
    .filter(([key]) => weights[key] != null)
    .map(
      ([key, label]) => `${label} ${((weights[key] ?? 0) * 100).toFixed(1)}%`,
    )
    .join(" / ");
}

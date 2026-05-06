"use client";

import type { ReactNode } from "react";
import type { QuantModelResult, QuantScorePart } from "../../types/stock";

type Props = {
  quant?: QuantModelResult;
};

export default function QuantScoreSection({ quant }: Props) {
  return (
    <section className="score-section">
      <Card>
        <div className="score-header">
          <div>
            <SectionTitleSmall>퀀트 모델 점수</SectionTitleSmall>
            <p className="score-subtitle">
              모멘텀·밸류에이션·수급·리스크·목표여력을 합산해 현재 구간을
              판단합니다.
            </p>
          </div>
          <div className="score-mode-badge">
            {quant?.available ? quant.action : "데이터 대기"}
          </div>
        </div>

        <div className="score-main-grid">
          <div className="score-total-card">
            <div className="score-total-label">퀀트 점수</div>
            <div className="score-total-value">
              {quant?.total != null ? `${quant.total}` : "-"}
              <span>/ 100</span>
            </div>
            <div className={`score-grade ${getScoreGradeTone(quant?.total)}`}>
              {quant?.grade || "데이터 대기"}
            </div>
          </div>

          <div className="score-detail-grid">
            <QuantPartCard title="모멘텀" part={quant?.momentum} />
            <QuantPartCard title="밸류에이션" part={quant?.valuation} />
            <QuantPartCard title="수급" part={quant?.supply} />
            <QuantPartCard title="리스크" part={quant?.risk} />
            <QuantPartCard title="목표여력" part={quant?.target} />
          </div>
        </div>

        <div className="score-comment-box">
          <span>판단 요약</span>
          <strong>
            {quant?.summary || "분석 실행 후 퀀트 판단이 표시됩니다."}
          </strong>
        </div>

        <p className="notice-text">
          퀀트 점수는 매수·매도 신호가 아니라 현재 가격 위치와 위험도를 함께
          보기 위한 참고 지표입니다.
        </p>
      </Card>
    </section>
  );
}

function QuantPartCard({
  title,
  part,
}: {
  title: string;
  part?: QuantScorePart;
}) {
  const scoreText = part ? `${part.score} / ${part.maxScore}` : "대기";
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

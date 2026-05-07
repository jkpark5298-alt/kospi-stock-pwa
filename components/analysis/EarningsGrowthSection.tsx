"use client";

import type { ReactNode } from "react";
import type { EarningsGrowthData, ManualEarningsGrowthInput } from "../../types/stock";

type Props = {
  earningsGrowth?: EarningsGrowthData;
  manualInput: ManualEarningsGrowthInput;
  onManualInputChange: (next: ManualEarningsGrowthInput) => void;
  onApplyManualInput: () => void;
};

export default function EarningsGrowthSection({
  earningsGrowth,
  manualInput,
  onManualInputChange,
  onApplyManualInput,
}: Props) {
  const data = earningsGrowth ?? makeEmptyEarningsGrowth();

  function updateField(key: keyof ManualEarningsGrowthInput, value: string) {
    onManualInputChange({
      ...manualInput,
      [key]: value,
    });
  }

  return (
    <section className="score-section">
      <Card>
        <div className="score-header">
          <div>
            <SectionTitleSmall>실적 성장 분석</SectionTitleSmall>
            <p className="score-subtitle">
              자동 데이터가 있으면 자동값을 우선 사용하고, 자동 데이터가 없거나
              늦을 때는 수동 입력값으로 예상 순이익·영업이익·EPS 성장률을
              계산합니다.
            </p>
          </div>

          <div className="score-mode-badge">
            {data.available ? `데이터 출처: ${formatSource(data.source)}` : "데이터 준비 중"}
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
              caption={formatIncomePair(data.lastYearNetIncome, data.expectedNetIncome)}
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

        <div className="manual-earnings-box">
          <div className="manual-earnings-header">
            <div>
              <span>수동 입력</span>
              <p>
                단위: 순이익·영업이익은 억원, EPS는 원입니다. 자동 데이터가
                들어오면 자동 데이터가 우선 적용됩니다.
              </p>
            </div>
            <button className="button primary-button" onClick={onApplyManualInput}>
              수동 입력값 반영
            </button>
          </div>

          <div className="manual-earnings-grid">
            <InputField
              label="전년 순이익(억원)"
              value={manualInput.lastYearNetIncome}
              onChange={(value) => updateField("lastYearNetIncome", value)}
            />
            <InputField
              label="예상 순이익(억원)"
              value={manualInput.expectedNetIncome}
              onChange={(value) => updateField("expectedNetIncome", value)}
            />
            <InputField
              label="전년 영업이익(억원)"
              value={manualInput.lastYearOperatingProfit}
              onChange={(value) => updateField("lastYearOperatingProfit", value)}
            />
            <InputField
              label="예상 영업이익(억원)"
              value={manualInput.expectedOperatingProfit}
              onChange={(value) => updateField("expectedOperatingProfit", value)}
            />
            <InputField
              label="전년 EPS(원)"
              value={manualInput.lastYearEps}
              onChange={(value) => updateField("lastYearEps", value)}
            />
            <InputField
              label="예상 EPS(원)"
              value={manualInput.expectedEps}
              onChange={(value) => updateField("expectedEps", value)}
            />

            <SelectField
              label="흑자 전환"
              value={manualInput.turnaround}
              onChange={(value) => updateField("turnaround", value)}
            />
            <SelectField
              label="적자 축소"
              value={manualInput.deficitReduction}
              onChange={(value) => updateField("deficitReduction", value)}
            />
          </div>
        </div>

        <div className="score-comment-box">
          <span>판단 요약</span>
          <strong>{makeSummary(data)}</strong>
        </div>

        <div className="target-plan-box">
          <span>데이터 우선순위</span>
          <p>
            자동 데이터(DART/KIS/컨센서스)가 있으면 자동값을 우선 사용합니다.
            자동 데이터가 없거나 오류가 발생하면 수동 입력값이 보조 데이터로
            사용됩니다.
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

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="manual-earnings-field">
      <span>{label}</span>
      <input
        className="form-control"
        value={value}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
        placeholder="예: 1200"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "" | "true" | "false";
  onChange: (value: "" | "true" | "false") => void;
}) {
  return (
    <label className="manual-earnings-field">
      <span>{label}</span>
      <select
        className="form-control"
        value={value}
        onChange={(e) => onChange(e.target.value as "" | "true" | "false")}
      >
        <option value="">자동 판단</option>
        <option value="true">예</option>
        <option value="false">아니오</option>
      </select>
    </label>
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

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
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
    reasons: ["자동 데이터 또는 수동 입력값이 필요합니다."],
  };
}

function makeSummary(data: EarningsGrowthData) {
  if (!data.available) {
    return data.reasons?.[0] || "자동 데이터 또는 수동 입력값이 필요합니다.";
  }

  const positives: string[] = [];
  const cautions: string[] = [];

  if ((data.netIncomeGrowthRate ?? 0) >= 10) positives.push("예상 순이익 증가");
  else if (data.netIncomeGrowthRate != null && data.netIncomeGrowthRate <= 0)
    cautions.push("예상 순이익 정체 또는 감소");

  if ((data.operatingProfitGrowthRate ?? 0) >= 10)
    positives.push("예상 영업이익 증가");
  else if (
    data.operatingProfitGrowthRate != null &&
    data.operatingProfitGrowthRate <= 0
  )
    cautions.push("예상 영업이익 정체 또는 감소");

  if ((data.epsGrowthRate ?? 0) >= 10) positives.push("예상 EPS 증가");
  if (data.turnaround) positives.push("흑자 전환 기대");
  else if (data.deficitReduction) positives.push("적자 축소 기대");

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
  if (previous == null || expected == null) return "전년/예상 데이터 준비 중";
  return `전년 ${formatNumber(previous)}억원 → 예상 ${formatNumber(expected)}억원`;
}

function formatEpsPair(previous: number | null, expected: number | null) {
  if (previous == null || expected == null) return "전년/예상 EPS 준비 중";
  return `전년 ${formatNumber(previous)}원 → 예상 ${formatNumber(expected)}원`;
}

function formatTurnaround(turnaround: boolean | null, deficitReduction: boolean | null) {
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
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
}

function getScoreGradeTone(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value >= 65) return "positive";
  if (value >= 50) return "neutral";
  return "negative";
}

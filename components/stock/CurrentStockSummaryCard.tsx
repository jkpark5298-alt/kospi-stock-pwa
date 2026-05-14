"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockResponse } from "../../types/stock";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
} from "../../utils/format";

type Props = {
  data: StockResponse | null;
};

type DailyTargetSnapshot = {
  date: string;
  symbol: string;
  targetPrice: number;
  basisPrice: number;
  source: "first-query" | "current-query" | "manual";
  savedAt: string;
};

type SummaryTone = "positive" | "negative" | "neutral";

type AbcEstimate = {
  value: number | null;
  technicalWeight: number | null;
  valuationWeight: number | null;
  consensusWeight: number | null;
  description: string;
};

const DAILY_TARGET_STORAGE_PREFIX = "kospi-daily-target";

export default function CurrentStockSummaryCard({ data }: Props) {
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const todayKey = useMemo(() => makeTodayKey(), []);
  const dailyTargetKey = useMemo(
    () => makeDailyTargetKey(data?.symbol, todayKey),
    [data?.symbol, todayKey],
  );

  const [dailyTarget, setDailyTarget] = useState<DailyTargetSnapshot | null>(
    null,
  );
  const [manualTargetInput, setManualTargetInput] = useState("");

  useEffect(() => {
    if (!range || !data?.symbol || typeof window === "undefined") {
      setDailyTarget(null);
      setManualTargetInput("");
      return;
    }

    const stored = readDailyTargetSnapshot(dailyTargetKey);

    if (stored) {
      setDailyTarget(stored);
      setManualTargetInput(formatManualTargetInput(String(stored.targetPrice)));
      return;
    }

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      source: "first-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }, [dailyTargetKey, data?.symbol, range, todayKey]);

  const targetProgress =
    range && range.baseTarget > 0
      ? Number(((range.currentPrice / range.baseTarget) * 100).toFixed(1))
      : null;

  const upsidePrice = range
    ? Number((range.baseTarget - range.currentPrice).toFixed(2))
    : null;

  const dailyTargetProgress =
    dailyTarget && range && dailyTarget.targetPrice > 0
      ? Number(((range.currentPrice / dailyTarget.targetPrice) * 100).toFixed(1))
      : null;

  const dailyUpsidePrice =
    dailyTarget && range
      ? Number((dailyTarget.targetPrice - range.currentPrice).toFixed(2))
      : null;

  const dailyUpsidePercent =
    dailyTarget && range && range.currentPrice > 0
      ? Number(
          (
            ((dailyTarget.targetPrice - range.currentPrice) /
              range.currentPrice) *
            100
          ).toFixed(2),
        )
      : null;

  const displaySymbol = data?.symbol || "데이터 없음";
  const displayName = data?.name || "종목명 없음";
  const displayMeta = [displaySymbol, data?.exchange, data?.currency]
    .filter(Boolean)
    .join(" · ");
  const quickSummary = makeCurrentSummaryInterpretation(data, range);
  const abcEstimate = makeAbcEstimate(data);

  function handleSaveCurrentAsDailyTarget() {
    if (!range || !data?.symbol) return;

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      source: "current-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  function handleSaveManualDailyTarget() {
    if (!range || !data?.symbol) return;

    const parsed = parseManualTargetInput(manualTargetInput);

    if (parsed == null || parsed <= 0) return;

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: parsed,
      basisPrice: range.currentPrice,
      source: "manual",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  function handleResetDailyTarget() {
    if (!range || !data?.symbol || typeof window === "undefined") return;

    window.localStorage.removeItem(dailyTargetKey);

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      source: "first-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  return (
    <div className="card">
      <h3 className="section-title small">현재 종목 요약</h3>

      <div className="stock-identity">
        <div className="stock-name">{displayName}</div>
        <div className="stock-meta">{displayMeta || "시장 정보 대기"}</div>
      </div>

      <div className="metric-list">
        <MetricRow label="현재가" value={formatNumber(data?.currentPrice)} />
        <MetricRow
          label="전일 대비"
          value={`${formatSignedNumber(data?.changePrice)} / ${formatPercent(
            data?.change,
          )}`}
        />
        <MetricRow
          label="추정 주가(현재 조회 기준)"
          value={`${formatNumber(range?.baseTarget)} ${formatDailyTargetSuffix(
            dailyTarget,
          )}`}
        />
        <MetricRow
          label="추정 괴리율"
          value={`${formatSignedNumber(upsidePrice)} / ${formatUpside(
            range?.baseUpsidePercent,
          )}`}
        />
        <MetricRow
          label="기술적 분석"
          value={data?.signalSummary || "데이터 없음"}
        />
        <MetricRow
          label="종합 점수"
          value={
            data?.score?.total != null
              ? `${data.score.total} / 100 · ${data.score.grade}`
              : "데이터 없음"
          }
        />
        <MetricRow
          label="퀀트 점수"
          value={
            data?.quant?.total != null
              ? `${data.quant.total} / 100 · ${data.quant.grade}`
              : "데이터 없음"
          }
        />
        <MetricRow
          label="추정 주가 도달 가능성"
          value={
            data?.score?.targetPrice?.score != null
              ? `${data.score.targetPrice.score} / 100 · ${data.score.targetPrice.label}`
              : "데이터 없음"
          }
        />
        <MetricRow
          label="현재 조회 기준 추정 주가 도달률"
          value={formatTargetProgress(targetProgress)}
        />
        <MetricRow
          label="당일 기준 추정 주가 도달률"
          value={`${formatTargetProgress(dailyTargetProgress)} · ${formatSignedNumber(
            dailyUpsidePrice,
          )} / ${formatUpside(dailyUpsidePercent)}`}
        />
        <MetricRow
          label="위험 기준선"
          value={`${formatNumber(range?.riskLine)} / ${formatUpside(
            range?.riskDownsidePercent,
          )}`}
        />
      </div>

      <div className="target-basis-box" style={{ marginTop: 16 }}>
        <div className="target-basis-header">
          <span>핵심 해석</span>
          <strong>{quickSummary.overall}</strong>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          {quickSummary.cards.map((card) => (
            <div className="target-metric-card" key={card.title}>
              <span>
                {card.icon} {card.title}
              </span>
              <strong className={card.tone}>{card.label}</strong>
              <em className={card.tone}>{card.detail}</em>
            </div>
          ))}
        </div>

        <p className="target-basis-summary" style={{ marginTop: 12 }}>
          {quickSummary.summary}
        </p>
      </div>

      <ReferenceAbcEstimateBox data={data} estimate={abcEstimate} />

      <div className="target-basis-box" style={{ marginTop: 16 }}>
        <div className="target-basis-header">
          <span>기술적 분석이란?</span>
          <strong>{data?.signalSummary || "데이터 없음"}</strong>
        </div>
        <p className="target-basis-summary">
          기술적 분석은 이동평균, RSI, MACD, 볼린저밴드 등 차트 지표를
          바탕으로 현재 주가 흐름과 매수·매도 참고 구간을 요약한 신호입니다.
          실제 판단은 수급, 실적, 공시, 시장 상황과 함께 확인해야 합니다.
        </p>

        <div className="target-basis-adjustments" style={{ marginTop: 12 }}>
          <p>
            <strong>상대적 강세</strong> → 상승 흐름 우위, 단기 과열 여부 확인
          </p>
          <p>
            <strong>중립</strong> → 방향성 확인 필요, 관망 구간
          </p>
          <p>
            <strong>약세</strong> → 하락 압력 우위, 반등 확인 필요
          </p>
          <p>
            <strong>단기 과열</strong> → 추격 매수 신중, 변동성 확인
          </p>
          <p>
            <strong>조정 후 반등</strong> → 매수 관심 구간 가능성
          </p>
        </div>
      </div>

      <div className="target-basis-box" style={{ marginTop: 16 }}>
        <div className="target-basis-header">
          <span>당일 기준 추정 주가 설정</span>
          <strong>{formatDailyTargetSource(dailyTarget)}</strong>
        </div>

        <p className="target-basis-summary">
          당일 기준 추정 주가: {formatNumber(dailyTarget?.targetPrice)} · 저장
          기준가: {formatNumber(dailyTarget?.basisPrice)} · 저장 시각:{" "}
          {formatDateTime(dailyTarget?.savedAt)}
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <input
            className="form-control"
            value={manualTargetInput}
            inputMode="decimal"
            onChange={(event) =>
              setManualTargetInput(formatManualTargetInput(event.target.value))
            }
            placeholder="직접 입력 예: 288,000"
            style={{ maxWidth: 220 }}
          />
          <button
            className="button secondary-button"
            type="button"
            onClick={handleSaveManualDailyTarget}
            disabled={!range}
          >
            직접 입력 저장
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={handleSaveCurrentAsDailyTarget}
            disabled={!range}
          >
            현재 조회 추정 주가로 저장
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={handleResetDailyTarget}
            disabled={!range}
          >
            오늘 기준 초기화
          </button>
        </div>

        <div className="target-basis-adjustments">
          <p>
            첫 조회 시 당일 기준 추정 주가가 자동 저장됩니다. 이후에는 직접
            입력하거나 현재 조회 추정 주가로 다시 저장할 수 있습니다.
          </p>
          <p>
            추정 주가(현재 조회 기준)는 조회할 때마다 바뀔 수 있고, 당일 기준
            추정 주가는 같은 날짜의 추정 주가 도달률 평가 기준으로 유지됩니다.
          </p>
        </div>
      </div>

      <p className="notice-text">
        추정 주가(현재 조회 기준)는 최신 현재가와 지표로 다시 계산됩니다. 괄호
        안의 당일 기준 추정 주가는 오늘 평가 기준으로 저장된 추정 주가입니다.
      </p>
    </div>
  );
}

function ReferenceAbcEstimateBox({
  data,
  estimate,
}: {
  data: StockResponse | null;
  estimate: AbcEstimate;
}) {
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const basis = data?.score?.targetPrice?.targetBasis;
  const valuationRange = data?.score?.targetPrice?.valuationTargetRange ?? null;
  const technicalTarget = getTechnicalBasisPrice(basis, range?.baseTarget);
  const valuationTarget = valuationRange?.valuationTarget ?? null;
  const consensusTarget = data?.score?.targetPrice?.consensusTarget ?? null;
  const modelTarget = range?.baseTarget ?? null;
  const modelGap =
    estimate.value != null && modelTarget != null
      ? percentChange(modelTarget, estimate.value)
      : null;

  return (
    <div className="target-basis-box" style={{ marginTop: 16 }}>
      <div className="target-basis-header">
        <span>참고 A/B/C 추정가</span>
        <strong>{estimate.value != null ? "요약 기준가 비교" : "데이터 대기"}</strong>
      </div>

      <p className="target-basis-summary">
        현재 종목 요약에서는 A 기술적 기준가, B 실적·밸류 기준가, C 컨센서스
        기준가를 참고값으로 함께 보여줍니다. 현재 모델 추정가와 A/B/C 기준
        1차 추정가는 아직 다를 수 있습니다.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        <div className="target-metric-card">
          <span>A. 기술적 기준가</span>
          <strong>{formatNumber(technicalTarget)}</strong>
          <em>{makeTechnicalBasisText(basis)}</em>
        </div>

        <div className="target-metric-card">
          <span>B. 실적·밸류 기준가</span>
          <strong>{formatNumber(valuationTarget)}</strong>
          <em>{makeValuationText(valuationRange)}</em>
        </div>

        <div className="target-metric-card">
          <span>C. 컨센서스 기준가</span>
          <strong>{formatNumber(consensusTarget)}</strong>
          <em>컨센서스 입력 후 표시</em>
        </div>

        <div className="target-metric-card">
          <span>A/B/C 기준 1차 추정가</span>
          <strong>{formatNumber(estimate.value)}</strong>
          <em>{formatAbcWeights(estimate)}</em>
        </div>

        <div className="target-metric-card">
          <span>현재 모델 추정가</span>
          <strong>{formatNumber(modelTarget)}</strong>
          <em>A/B/C 1차 대비 {formatUpside(modelGap)}</em>
        </div>
      </div>

      <div className="target-basis-adjustments">
        <p>
          현재 표시 기준: 컨센서스가 없으면 A 60%, B 40%로 1차 추정가를
          계산합니다.
        </p>
        <p>
          컨센서스가 입력되면 A 40%, B 35%, C 25% 구조로 비교할 예정입니다.
        </p>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function makeCurrentSummaryInterpretation(
  data: StockResponse | null,
  range?: NonNullable<StockResponse["score"]>["targetPrice"]["technicalTargetRange"],
) {
  const latest = getLatestChartRow(data?.chartData);
  const current = data?.currentPrice ?? latest?.close ?? range?.currentPrice ?? null;
  const chart = makeChartSummary(current, latest);
  const prediction = makePredictionSummary(current, range);
  const overall = makeOverallSummary(chart.label, prediction.label);

  return {
    overall: overall.title,
    summary: overall.detail,
    cards: [
      {
        title: "차트",
        icon: chart.icon,
        label: chart.label,
        detail: chart.detail,
        tone: chart.tone,
      },
      {
        title: "예측",
        icon: prediction.icon,
        label: prediction.label,
        detail: prediction.detail,
        tone: prediction.tone,
      },
      {
        title: "종합",
        icon: overall.icon,
        label: overall.title,
        detail: overall.shortDetail,
        tone: overall.tone,
      },
    ],
  };
}

function getLatestChartRow(chartData?: StockResponse["chartData"]) {
  if (!chartData?.length) return null;

  for (let index = chartData.length - 1; index >= 0; index -= 1) {
    const row = chartData[index];

    if (row?.close != null && Number.isFinite(row.close)) {
      return row;
    }
  }

  return null;
}

function makeChartSummary(
  current: number | null,
  latest: ReturnType<typeof getLatestChartRow>,
) {
  if (!latest || current == null) {
    return {
      icon: "⚪",
      label: "차트 확인 필요",
      detail: "데이터 대기",
      tone: "neutral" as SummaryTone,
    };
  }

  const sma20 = latest.sma20 ?? null;
  const sma60 = latest.sma60 ?? null;
  const bbUpper = latest.bbUpper ?? null;
  const bbLower = latest.bbLower ?? null;
  const rsi14 = latest.rsi14 ?? null;

  const isUpTrend =
    sma20 != null && sma60 != null && current > sma20 && sma20 > sma60;
  const isAboveAvg =
    sma20 != null && sma60 != null && current > sma20 && current > sma60;
  const isWeak =
    sma20 != null && sma60 != null && current < sma20 && current < sma60;

  const bandPosition =
    bbUpper != null && bbLower != null && bbUpper > bbLower
      ? (current - bbLower) / (bbUpper - bbLower)
      : null;

  const isOverheated =
    (bandPosition != null && bandPosition >= 0.85) ||
    (rsi14 != null && rsi14 >= 70);

  if (isUpTrend && isOverheated) {
    return {
      icon: "⚠️",
      label: "단기 과열 주의",
      detail: "상승 추세 강함",
      tone: "negative" as SummaryTone,
    };
  }

  if (isUpTrend || isAboveAvg) {
    return {
      icon: "🟢",
      label: "상승 추세 유지",
      detail: "이동평균선 위",
      tone: "positive" as SummaryTone,
    };
  }

  if (isWeak) {
    return {
      icon: "🔻",
      label: "추세 약세",
      detail: "이동평균선 아래",
      tone: "negative" as SummaryTone,
    };
  }

  return {
    icon: "⚪",
    label: "방향성 확인",
    detail: "혼조 구간",
    tone: "neutral" as SummaryTone,
  };
}

function makePredictionSummary(
  current: number | null,
  range?: NonNullable<StockResponse["score"]>["targetPrice"]["technicalTargetRange"],
) {
  const baseTarget = range?.baseTarget ?? null;

  if (current == null || baseTarget == null || baseTarget <= 0) {
    return {
      icon: "⚪",
      label: "예측 확인 필요",
      detail: "추정가 대기",
      tone: "neutral" as SummaryTone,
    };
  }

  const upsideRate = ((baseTarget - current) / current) * 100;
  const progress = (current / baseTarget) * 100;

  if (upsideRate >= 3) {
    return {
      icon: "🟢",
      label: "상승 여력 있음",
      detail: `추정가까지 ${upsideRate.toFixed(1)}%`,
      tone: "positive" as SummaryTone,
    };
  }

  if (progress >= 97 && progress <= 103) {
    return {
      icon: "⚠️",
      label: "추정가 근접",
      detail: `도달률 ${progress.toFixed(1)}%`,
      tone: "neutral" as SummaryTone,
    };
  }

  if (upsideRate < -3) {
    return {
      icon: "🔻",
      label: "추정가 초과",
      detail: `초과 ${Math.abs(upsideRate).toFixed(1)}%`,
      tone: "negative" as SummaryTone,
    };
  }

  return {
    icon: "⚪",
    label: "예측 중립",
    detail: `괴리 ${upsideRate.toFixed(1)}%`,
    tone: "neutral" as SummaryTone,
  };
}

function makeOverallSummary(chartLabel: string, predictionLabel: string) {
  if (chartLabel.includes("과열") && predictionLabel.includes("상승 여력")) {
    return {
      icon: "⚠️",
      title: "상승 여력 있음 · 단기 과열 주의",
      shortDetail: "추격 매수 신중",
      detail:
        "예측상 여력은 남아 있지만 차트는 단기 과열 신호를 함께 보여줍니다. 상승 흐름은 유지하되 추격 매수는 신중히 확인하는 구간입니다.",
      tone: "neutral" as SummaryTone,
    };
  }

  if (chartLabel.includes("과열") && predictionLabel.includes("근접")) {
    return {
      icon: "⚠️",
      title: "추정가 근접 · 단기 과열 주의",
      shortDetail: "변동성 확인",
      detail:
        "현재가는 추정 주가에 가까우며 차트상 단기 과열 신호가 있습니다. 추가 상승보다 변동성 확대 여부를 먼저 확인해야 합니다.",
      tone: "negative" as SummaryTone,
    };
  }

  if (chartLabel.includes("상승") && predictionLabel.includes("상승 여력")) {
    return {
      icon: "🟢",
      title: "상승 추세 · 상승 여력",
      shortDetail: "흐름 양호",
      detail:
        "차트 흐름과 추정 주가 기준이 모두 우호적입니다. 다만 실제 판단은 수급과 위험 기준선을 함께 확인해야 합니다.",
      tone: "positive" as SummaryTone,
    };
  }

  if (chartLabel.includes("약세")) {
    return {
      icon: "🔻",
      title: "추세 약세 확인",
      shortDetail: "반등 확인 필요",
      detail:
        "현재 차트 흐름이 약해 단기 반등 여부와 수급 개선 여부를 함께 확인해야 합니다.",
      tone: "negative" as SummaryTone,
    };
  }

  return {
    icon: "⚪",
    title: "방향성 확인 필요",
    shortDetail: "혼조 구간",
    detail:
      "차트와 추정 주가 기준이 뚜렷하게 한 방향으로 일치하지 않아 추가 확인이 필요한 구간입니다.",
    tone: "neutral" as SummaryTone,
  };
}

function makeAbcEstimate(data: StockResponse | null): AbcEstimate {
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const basis = data?.score?.targetPrice?.targetBasis;
  const valuationRange = data?.score?.targetPrice?.valuationTargetRange ?? null;
  const technicalTarget = getTechnicalBasisPrice(basis, range?.baseTarget);
  const valuationTarget = valuationRange?.valuationTarget ?? null;
  const consensusTarget = data?.score?.targetPrice?.consensusTarget ?? null;

  return calculateAbcEstimate({
    technicalTarget,
    valuationTarget,
    consensusTarget,
  });
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

function getTechnicalBasisPrice(
  basis?: NonNullable<StockResponse["score"]>["targetPrice"]["targetBasis"],
  fallback?: number | null,
) {
  const technicalCandidate = basis?.candidates.find((candidate) =>
    candidate.label.includes("기술"),
  );

  return technicalCandidate?.value ?? fallback ?? null;
}

function makeTechnicalBasisText(
  basis?: NonNullable<StockResponse["score"]>["targetPrice"]["targetBasis"],
) {
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
  valuationRange?: NonNullable<StockResponse["score"]>["targetPrice"]["valuationTargetRange"] | null,
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

function makeTodayKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function makeDailyTargetKey(symbol?: string | null, todayKey = makeTodayKey()) {
  return `${DAILY_TARGET_STORAGE_PREFIX}:${todayKey}:${(symbol || "")
    .trim()
    .toUpperCase()}`;
}

function readDailyTargetSnapshot(key: string): DailyTargetSnapshot | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as DailyTargetSnapshot;

    if (
      !parsed ||
      !Number.isFinite(parsed.targetPrice) ||
      !Number.isFinite(parsed.basisPrice)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeDailyTargetSnapshot(key: string, snapshot: DailyTargetSnapshot) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // localStorage 저장이 실패해도 화면 조회는 계속 진행합니다.
  }
}

function formatDailyTargetSuffix(snapshot?: DailyTargetSnapshot | null) {
  if (!snapshot) return "(당일 기준 추정 주가 데이터 없음)";

  return `(당일 기준 추정 주가 ${formatNumber(snapshot.targetPrice)})`;
}

function formatDailyTargetSource(snapshot?: DailyTargetSnapshot | null) {
  if (!snapshot) return "당일 기준 추정 주가 대기";

  if (snapshot.source === "manual") return "직접 입력 기준";
  if (snapshot.source === "current-query") return "현재 조회 추정 주가 저장 기준";
  return "오늘 첫 조회 기준";
}

function formatManualTargetInput(value: string) {
  const raw = value.replace(/,/g, "").replace(/\s/g, "");

  if (!raw) return "";

  const cleaned = raw.replace(/[^0-9.]/g, "");

  if (!cleaned) return "";

  const dotIndex = cleaned.indexOf(".");
  const integerPart = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned;
  const decimalPart =
    dotIndex >= 0 ? cleaned.slice(dotIndex + 1).replace(/\./g, "") : "";

  const formattedInteger = integerPart
    ? Number(integerPart).toLocaleString("en-US")
    : "0";

  if (dotIndex >= 0) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
}

function parseManualTargetInput(value: string) {
  const parsed = Number(value.replace(/[\s,]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function formatTargetProgress(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(1)}%`;
}

function formatUpside(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatWeight(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "저장 전";

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

"use client";

import type { StockResponse } from "../../types/stock";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
} from "../../utils/format";

type Props = {
  data: StockResponse | null;
};

export default function CurrentStockSummaryCard({ data }: Props) {
  const range = data?.score?.targetPrice?.technicalTargetRange;

  const targetProgress =
    range && range.baseTarget > 0
      ? Number(((range.currentPrice / range.baseTarget) * 100).toFixed(1))
      : null;

  const upsidePrice = range
    ? Number((range.baseTarget - range.currentPrice).toFixed(2))
    : null;

  const displaySymbol = data?.symbol || "데이터 없음";
  const displayName = data?.name || "종목명 없음";
  const displayMeta = [displaySymbol, data?.exchange, data?.currency]
    .filter(Boolean)
    .join(" · ");

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
          value={`${formatSignedNumber(data?.changePrice)} / ${formatPercent(data?.change)}`}
        />
        <MetricRow
          label="분석 신호"
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
          label="목표여력 점수"
          value={
            data?.score?.targetPrice?.score != null
              ? `${data.score.targetPrice.score} / 100 · ${data.score.targetPrice.label}`
              : "데이터 없음"
          }
        />
        <MetricRow
          label="기준 목표가"
          value={formatNumber(range?.baseTarget)}
        />
        <MetricRow
          label="목표 도달률"
          value={formatTargetProgress(targetProgress)}
        />
        <MetricRow
          label="상승 여력"
          value={`${formatSignedNumber(upsidePrice)} / ${formatUpside(range?.baseUpsidePercent)}`}
        />
        <MetricRow
          label="위험 기준선"
          value={`${formatNumber(range?.riskLine)} / ${formatUpside(range?.riskDownsidePercent)}`}
        />
      </div>

      <p className="notice-text">
        이 요약은 현재 화면의 기술·수급·목표여력 데이터를 한 번에 확인하기 위한
        참고 정보입니다.
      </p>
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

function formatTargetProgress(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(1)}%`;
}

function formatUpside(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

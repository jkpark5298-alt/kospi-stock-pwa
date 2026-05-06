"use client";

import type { Fundamentals } from "../../types/stock";

type Props = {
  fundamentals?: Fundamentals;
};

export default function BasicInfoSection({ fundamentals }: Props) {
  return (
    <section className="data-section">
      <div className="card">
        <h3 className="section-title small">종목 기본 정보</h3>
        <p className="target-subtitle">
          시가총액, 밸류에이션, 배당, 52주 가격 범위를 확인합니다.
        </p>

        <div className="metric-list">
          <MetricRow
            label="시가총액"
            value={formatMarketCap(fundamentals?.marketCap)}
          />
          <MetricRow label="PER" value={formatRatio(fundamentals?.per, "배")} />
          <MetricRow label="PBR" value={formatRatio(fundamentals?.pbr, "배")} />
          <MetricRow
            label="EPS"
            value={formatCurrencyValue(fundamentals?.eps)}
          />
          <MetricRow
            label="BPS"
            value={formatCurrencyValue(fundamentals?.bps)}
          />
          <MetricRow
            label="배당수익률"
            value={formatNullablePercent(fundamentals?.dividendYield)}
          />
          <MetricRow
            label="52주 고가"
            value={formatCurrencyValue(fundamentals?.high52w)}
          />
          <MetricRow
            label="52주 저가"
            value={formatCurrencyValue(fundamentals?.low52w)}
          />
          <MetricRow
            label="외국인 보유율"
            value={formatNullablePercent(fundamentals?.foreignOwnershipRate)}
          />
          <MetricRow
            label="상장주식수"
            value={formatShares(fundamentals?.sharesOutstanding)}
          />
        </div>

        <p className="notice-text">
          현재는 API 구조를 먼저 준비한 단계입니다. 값이 없는 항목은 데이터 연결
          후 자동으로 표시됩니다.
        </p>
      </div>
    </section>
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

function formatMarketCap(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const trillion = value / 1_0000_0000_0000;
  if (trillion >= 1) return `${trillion.toFixed(2)}조`;

  const hundredMillion = value / 1_0000_0000;
  return `${hundredMillion.toFixed(0)}억`;
}

function formatRatio(value?: number | null, suffix = "") {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(2)} ${suffix}`.trim();
}

function formatCurrencyValue(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatNullablePercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(2)}%`;
}

function formatShares(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(
    value,
  )}주`;
}

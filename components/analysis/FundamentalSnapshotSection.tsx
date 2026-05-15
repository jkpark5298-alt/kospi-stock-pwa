"use client";

type Props = {
  data?: {
    fundamentals?: {
      marketCap?: number | null;
      per?: number | null;
      pbr?: number | null;
      eps?: number | null;
      bps?: number | null;
      dividendYield?: number | null;
    } | null;
    score?: {
      targetPrice?: {
        valuationTargetRange?: {
          epsTarget?: number | null;
          bpsTarget?: number | null;
          valuationTarget?: number | null;
          perAdjustment?: number | null;
          pbrAdjustment?: number | null;
        } | null;
      };
    };
  } | null;
};

export default function FundamentalSnapshotSection({ data }: Props) {
  const fundamentals = data?.fundamentals;
  const valuation = data?.score?.targetPrice?.valuationTargetRange ?? null;

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>한투 실적·밸류 핵심 요약</span>
          <strong>{formatNumber(valuation?.valuationTarget)}</strong>
        </div>

        <p className="target-basis-summary">
          한투 데이터 중 실적·밸류 기준 추정 주가에 직접 필요한 핵심값만
          요약합니다. 수급 데이터는 Detail 4, 52주 고가·저가와 위험 관련
          데이터는 Detail 5에서 따로 확인합니다.
        </p>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <SnapshotCard
            title="시가총액"
            value={formatMarketCap(fundamentals?.marketCap)}
            subText="기업 규모 참고"
          />
          <SnapshotCard
            title="PER"
            value={formatRatio(fundamentals?.per)}
            subText="이익 대비 주가 부담"
          />
          <SnapshotCard
            title="PBR"
            value={formatRatio(fundamentals?.pbr)}
            subText="자산 대비 주가 부담"
          />
          <SnapshotCard
            title="EPS"
            value={formatNumber(fundamentals?.eps)}
            subText="주당순이익"
          />
          <SnapshotCard
            title="BPS"
            value={formatNumber(fundamentals?.bps)}
            subText="주당순자산"
          />
          <SnapshotCard
            title="배당수익률"
            value={formatPercent(fundamentals?.dividendYield)}
            subText="배당 참고"
          />
          <SnapshotCard
            title="EPS 기준가"
            value={formatNumber(valuation?.epsTarget)}
            subText="이익가치 기준"
          />
          <SnapshotCard
            title="BPS 기준가"
            value={formatNumber(valuation?.bpsTarget)}
            subText="자산가치 기준"
          />
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>추정 주가 기준 설명</span>
            <strong>EPS/BPS + PER/PBR 부담</strong>
          </div>
          <p className="target-basis-summary">
            실적·밸류 기준 추정 주가는 EPS 기준 이익가치와 BPS 기준
            자산가치를 함께 참고합니다. PER 또는 PBR 부담이 크면 기준가는
            보수적으로 해석하고, EPS/BPS가 안정적이면 실적·밸류 기준가의
            신뢰도가 높아집니다.
          </p>
        </div>
      </div>
    </section>
  );
}

function SnapshotCard({
  title,
  value,
  subText,
}: {
  title: string;
  value: string;
  subText: string;
}) {
  return (
    <div className="target-metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <em>{subText}</em>
    </div>
  );
}

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatMarketCap(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  if (value >= 1_0000_0000_0000) {
    return `${(value / 1_0000_0000_0000).toFixed(2)}조`;
  }

  if (value >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(2)}억`;
  }

  return formatNumber(value);
}

function formatRatio(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(2)}배`;
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(2)}%`;
}

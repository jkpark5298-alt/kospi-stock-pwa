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
    earningsGrowth?: {
      available?: boolean;
      operatingProfitGrowthRate?: number | null;
      netIncomeGrowthRate?: number | null;
      epsGrowthRate?: number | null;
      score?: number | null;
      label?: string | null;
    } | null;
    score?: {
      targetPrice?: {
        valuationTargetRange?: {
          epsTarget?: number | null;
          bpsTarget?: number | null;
          valuationTarget?: number | null;
          perAdjustment?: number | null;
          pbrAdjustment?: number | null;
          reasons?: string[];
        } | null;
      };
    };
  } | null;
};

export default function ValuationBasisExplanation({ data }: Props) {
  const fundamentals = data?.fundamentals;
  const earnings = data?.earningsGrowth;
  const valuationRange = data?.score?.targetPrice?.valuationTargetRange ?? null;

  const eps = makeEpsAnalysis(fundamentals?.eps, valuationRange?.epsTarget);
  const bps = makeBpsAnalysis(fundamentals?.bps, valuationRange?.bpsTarget);
  const per = makePerAnalysis(fundamentals?.per);
  const pbr = makePbrAnalysis(fundamentals?.pbr);
  const growth = makeGrowthAnalysis(earnings);

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>실적·밸류 기준가 산정 방식</span>
          <strong>{formatNumber(valuationRange?.valuationTarget)}</strong>
        </div>

        <p className="target-basis-summary">
          실적·밸류 기준가는 EPS와 BPS를 기준으로 이익가치와 자산가치를
          계산하고, PER/PBR 부담과 실적 성장률을 함께 반영한 가치 기준가입니다.
          실적 성장성이 좋으면 기준가 신뢰도가 높아지고, PER/PBR 부담이 크면
          보수적으로 해석합니다.
        </p>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <ValueMetricCard title="EPS 기준" value={eps.title} subText={eps.description} />
          <ValueMetricCard title="BPS 기준" value={bps.title} subText={bps.description} />
          <ValueMetricCard title="PER" value={per.title} subText={per.description} />
          <ValueMetricCard title="PBR" value={pbr.title} subText={pbr.description} />
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>실적·밸류 기준가 분석</span>
            <strong>{growth.title}</strong>
          </div>

          <div className="target-basis-adjustments">
            <p>시가총액: {formatMarketCap(fundamentals?.marketCap)}</p>
            <p>EPS: {formatNumber(fundamentals?.eps)} · BPS: {formatNumber(fundamentals?.bps)}</p>
            <p>PER: {formatRatio(fundamentals?.per)} · PBR: {formatRatio(fundamentals?.pbr)}</p>
            <p>배당수익률: {formatPercent(fundamentals?.dividendYield)}</p>
            <p>영업이익 성장률: {formatPercent(earnings?.operatingProfitGrowthRate)}</p>
            <p>순이익 성장률: {formatPercent(earnings?.netIncomeGrowthRate)}</p>
            <p>EPS 성장률: {formatPercent(earnings?.epsGrowthRate)}</p>
          </div>
        </div>

        {valuationRange?.reasons?.length ? (
          <div className="target-basis-box" style={{ marginTop: 16 }}>
            <div className="target-basis-header">
              <span>KIS 재무·밸류 보조평가</span>
              <strong>기준가 보조 근거</strong>
            </div>

            <div className="target-basis-adjustments">
              {valuationRange.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ValueMetricCard({
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

function makeEpsAnalysis(eps?: number | null, epsTarget?: number | null) {
  if (eps == null || Number.isNaN(eps)) {
    return {
      title: "데이터 없음",
      description: "EPS 데이터 대기",
    };
  }

  if (eps > 0) {
    return {
      title: "이익가치 산정 가능",
      description: `EPS 기준가 ${formatNumber(epsTarget)}`,
    };
  }

  return {
    title: "이익가치 취약",
    description: "EPS가 0 이하라 보수적 해석",
  };
}

function makeBpsAnalysis(bps?: number | null, bpsTarget?: number | null) {
  if (bps == null || Number.isNaN(bps)) {
    return {
      title: "데이터 없음",
      description: "BPS 데이터 대기",
    };
  }

  if (bps > 0) {
    return {
      title: "자산가치 산정 가능",
      description: `BPS 기준가 ${formatNumber(bpsTarget)}`,
    };
  }

  return {
    title: "자산가치 확인 필요",
    description: "BPS 기준 해석 제한",
  };
}

function makePerAnalysis(per?: number | null) {
  if (per == null || Number.isNaN(per) || per <= 0) {
    return {
      title: "확인 필요",
      description: "PER 데이터 부족",
    };
  }

  if (per >= 35) {
    return {
      title: "부담 높음",
      description: `PER ${per.toFixed(2)}배`,
    };
  }

  if (per <= 12) {
    return {
      title: "부담 낮음",
      description: `PER ${per.toFixed(2)}배`,
    };
  }

  return {
    title: "중립",
    description: `PER ${per.toFixed(2)}배`,
  };
}

function makePbrAnalysis(pbr?: number | null) {
  if (pbr == null || Number.isNaN(pbr) || pbr <= 0) {
    return {
      title: "확인 필요",
      description: "PBR 데이터 부족",
    };
  }

  if (pbr >= 4) {
    return {
      title: "부담 높음",
      description: `PBR ${pbr.toFixed(2)}배`,
    };
  }

  if (pbr <= 1.2) {
    return {
      title: "부담 낮음",
      description: `PBR ${pbr.toFixed(2)}배`,
    };
  }

  return {
    title: "중립",
    description: `PBR ${pbr.toFixed(2)}배`,
  };
}

function makeGrowthAnalysis(earnings?: Props["data"]["earningsGrowth"]) {
  if (!earnings?.available) {
    return {
      title: "실적 성장 데이터 대기",
    };
  }

  if ((earnings.score ?? 0) >= 70) {
    return {
      title: "실적 성장 우호",
    };
  }

  if ((earnings.score ?? 0) < 45) {
    return {
      title: "실적 성장 확인 필요",
    };
  }

  return {
    title: earnings.label || "실적 성장 중립",
  };
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

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

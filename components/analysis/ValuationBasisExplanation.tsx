"use client";

type EarningsGrowthData = {
  available?: boolean;
  operatingProfitGrowthRate?: number | null;
  netIncomeGrowthRate?: number | null;
  epsGrowthRate?: number | null;
  score?: number | null;
  label?: string | null;
} | null | undefined;

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
    earningsGrowth?: EarningsGrowthData;
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
          EPS는 이익가치, BPS는 자산가치 기준으로 보고 PER/PBR 부담을
          반영해 실적·밸류 기준 추정 주가를 계산합니다. 실적 성장률은 이
          기준가를 신뢰할 수 있는지 확인하는 보조 지표입니다.
        </p>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>실적·밸류 기준가 분석</span>
            <strong>{growth.title}</strong>
          </div>

          <div className="target-basis-adjustments">
            <p>{eps.description}</p>
            <p>{bps.description}</p>
            <p>{per.description}</p>
            <p>{pbr.description}</p>
            <p>
              영업이익 성장률 {formatPercent(earnings?.operatingProfitGrowthRate)} ·
              순이익 성장률 {formatPercent(earnings?.netIncomeGrowthRate)} ·
              EPS 성장률 {formatPercent(earnings?.epsGrowthRate)}
            </p>
            {valuationRange?.reasons?.length ? (
              <p>{valuationRange.reasons.join(" ")}</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function makeEpsAnalysis(eps?: number | null, epsTarget?: number | null) {
  if (eps == null || Number.isNaN(eps)) {
    return {
      description: "EPS 데이터가 없어 이익가치 기준가 산정은 제한적입니다.",
    };
  }

  if (eps > 0) {
    return {
      description: `EPS가 양수라 이익가치 기준가 산정이 가능합니다. EPS 기준가는 ${formatNumber(
        epsTarget,
      )}입니다.`,
    };
  }

  return {
    description: "EPS가 0 이하라 이익가치 기준가는 보수적으로 봅니다.",
  };
}

function makeBpsAnalysis(bps?: number | null, bpsTarget?: number | null) {
  if (bps == null || Number.isNaN(bps)) {
    return {
      description: "BPS 데이터가 없어 자산가치 기준가 산정은 제한적입니다.",
    };
  }

  if (bps > 0) {
    return {
      description: `BPS가 확인되어 자산가치 기준가 산정이 가능합니다. BPS 기준가는 ${formatNumber(
        bpsTarget,
      )}입니다.`,
    };
  }

  return {
    description: "BPS 기준 자산가치 해석은 제한적입니다.",
  };
}

function makePerAnalysis(per?: number | null) {
  if (per == null || Number.isNaN(per) || per <= 0) {
    return {
      description: "PER 데이터가 부족해 이익 대비 주가 부담은 확인이 필요합니다.",
    };
  }

  if (per >= 35) {
    return {
      description: `PER ${per.toFixed(
        2,
      )}배로 이익 대비 주가 부담이 높은 편이라 기준가를 보수적으로 해석합니다.`,
    };
  }

  if (per <= 12) {
    return {
      description: `PER ${per.toFixed(
        2,
      )}배로 이익 대비 주가 부담은 낮은 편입니다.`,
    };
  }

  return {
    description: `PER ${per.toFixed(2)}배로 이익 대비 주가 부담은 중립 구간입니다.`,
  };
}

function makePbrAnalysis(pbr?: number | null) {
  if (pbr == null || Number.isNaN(pbr) || pbr <= 0) {
    return {
      description: "PBR 데이터가 부족해 자산 대비 주가 부담은 확인이 필요합니다.",
    };
  }

  if (pbr >= 4) {
    return {
      description: `PBR ${pbr.toFixed(
        2,
      )}배로 자산 대비 주가 부담이 높은 편입니다.`,
    };
  }

  if (pbr <= 1.2) {
    return {
      description: `PBR ${pbr.toFixed(
        2,
      )}배로 자산 대비 주가 부담은 낮은 편입니다.`,
    };
  }

  return {
    description: `PBR ${pbr.toFixed(2)}배로 자산 대비 주가 부담은 중립 구간입니다.`,
  };
}

function makeGrowthAnalysis(earnings?: EarningsGrowthData) {
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

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

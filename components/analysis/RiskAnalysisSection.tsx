"use client";

type ChartRow = {
  close?: number | null;
  rsi14?: number | null;
  bbUpper?: number | null;
  bbLower?: number | null;
};

type TargetModeResultLike = {
  mode?: string | null;
  quantAdjustment?: {
    baseAdjustmentPercent?: number | null;
    positiveAdjustmentPercent?: number | null;
    riskAdjustmentPercent?: number | null;
  } | null;
};

type TargetPriceLike = {
  finalTargetRange?: {
    currentPrice: number;
    baseTarget: number;
    baseUpsidePercent: number;
    riskLine: number;
    riskDownsidePercent: number;
  } | null;
  technicalTargetRange?: {
    currentPrice: number;
    baseTarget: number;
    baseUpsidePercent: number;
    riskLine: number;
    riskDownsidePercent: number;
  } | null;
  targetBasis?: {
    candidates?: {
      label: string;
      value: number;
      weight: number;
    }[];
  } | null;
  valuationTargetRange?: {
    valuationTarget?: number | null;
  } | null;
  consensusTarget?: number | null;
  selectedTargetMode?: string | null;
  targetModes?: TargetModeResultLike[] | null;
};

type Props = {
  data?: {
    currentPrice?: number | null;
    chartData?: ChartRow[];
    fundamentals?: {
      high52w?: number | null;
      low52w?: number | null;
    } | null;
    score?: {
      targetPrice?: TargetPriceLike;
    };
  } | null;
};

type RiskTone = "positive" | "negative" | "neutral";

type RiskItem = {
  title: string;
  description: string;
  tone: RiskTone;
  isRisk: boolean;
};

type Option2Estimate = {
  currentPrice: number | null;
  technicalTarget: number | null;
  valuationTarget: number | null;
  consensusTarget: number | null;
  basisAverage: number | null;
  estimate: number | null;
  quantPercent: number;
  supplyPercent: number;
  riskPercent: number;
  totalAdjustmentAmount: number | null;
};

export default function RiskAnalysisSection({ data }: Props) {
  const targetPrice = data?.score?.targetPrice ?? null;
  const sourceRange =
    targetPrice?.finalTargetRange ?? targetPrice?.technicalTargetRange ?? null;
  const latest = getLatestChartRow(data?.chartData);
  const currentPrice =
    data?.currentPrice ?? sourceRange?.currentPrice ?? latest?.close ?? null;

  const option2 = calculateOption2Estimate(targetPrice, currentPrice);
  const estimate = option2.estimate;
  const riskLineValue = sourceRange?.riskLine ?? makeFallbackRiskLine(currentPrice);
  const baseUpsidePercent =
    estimate != null && currentPrice != null && currentPrice > 0
      ? ((estimate - currentPrice) / currentPrice) * 100
      : null;
  const riskDownsidePercent =
    riskLineValue != null && currentPrice != null && currentPrice > 0
      ? ((riskLineValue - currentPrice) / currentPrice) * 100
      : null;

  const riskLine = makeRiskLineAnalysis(currentPrice, riskLineValue);
  const overheat = makeOverheatAnalysis(latest?.rsi14, currentPrice, latest);
  const high52w = makeHigh52wAnalysis(currentPrice, data?.fundamentals?.high52w);
  const rsi = makeRsiRiskAnalysis(latest?.rsi14);
  const bollinger = makeBollingerRiskAnalysis(currentPrice, latest);
  const targetProgress = makeTargetProgressAnalysis(currentPrice, estimate);

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>위험 분석 방식</span>
          <strong>
            {makeOverallRiskLabel([
              riskLine,
              overheat,
              high52w,
              rsi,
              bollinger,
              targetProgress,
            ])}
          </strong>
        </div>

        <p className="target-basis-summary">
          위험 분석은 2안 추정가 기준으로 현재 가격이 과열권인지, 위험
          기준선과 얼마나 떨어져 있는지, 52주 고가와 볼린저밴드 상단에
          가까운지를 확인하는 영역입니다.
        </p>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <RiskMetricCard
            title="위험 기준선"
            value={formatNumber(riskLineValue)}
            subText={riskLine.description}
            tone={riskLine.tone}
          />
          <RiskMetricCard
            title="단기 과열"
            value={overheat.title}
            subText={overheat.description}
            tone={overheat.tone}
          />
          <RiskMetricCard
            title="52주 고가 근접"
            value={high52w.title}
            subText={high52w.description}
            tone={high52w.tone}
          />
          <RiskMetricCard
            title="추정가 도달률"
            value={targetProgress.title}
            subText={targetProgress.description}
            tone={targetProgress.tone}
          />
          <RiskMetricCard
            title="RSI 과열"
            value={rsi.title}
            subText={rsi.description}
            tone={rsi.tone}
          />
          <RiskMetricCard
            title="볼린저밴드 상단"
            value={bollinger.title}
            subText={bollinger.description}
            tone={bollinger.tone}
          />
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>위험 해석</span>
            <strong>
              {makeRiskSummary([
                riskLine,
                overheat,
                high52w,
                rsi,
                bollinger,
                targetProgress,
              ])}
            </strong>
          </div>

          <div className="target-basis-adjustments">
            <p>현재가: {formatNumber(currentPrice)}</p>
            <p>추정가: {formatNumber(estimate)}</p>
            <p>추정 괴리율: {formatPercent(baseUpsidePercent)}</p>
            <p>
              위험 기준선 대비 하락 여지: {formatPercent(riskDownsidePercent)}
            </p>
            <p>52주 고가: {formatNumber(data?.fundamentals?.high52w)}</p>
            <p>52주 저가: {formatNumber(data?.fundamentals?.low52w)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RiskMetricCard({
  title,
  value,
  subText,
  tone,
}: {
  title: string;
  value: string;
  subText: string;
  tone: RiskTone;
}) {
  return (
    <div className="target-metric-card">
      <span>{title}</span>
      <strong className={tone}>{value}</strong>
      <em className={tone}>{subText}</em>
    </div>
  );
}

function calculateOption2Estimate(
  targetPrice?: TargetPriceLike | null,
  currentPrice?: number | null,
): Option2Estimate {
  const sourceRange =
    targetPrice?.finalTargetRange ?? targetPrice?.technicalTargetRange ?? null;

  const baseCurrentPrice = currentPrice ?? sourceRange?.currentPrice ?? null;
  const technicalTarget = getTechnicalTarget(targetPrice);
  const valuationTarget = getNumber(targetPrice?.valuationTargetRange?.valuationTarget);
  const consensusTarget = getNumber(targetPrice?.consensusTarget);

  const hasTechnical = isValidNumber(technicalTarget);
  const hasValuation = isValidNumber(valuationTarget);
  const hasConsensus = isValidNumber(consensusTarget);

  if (!hasTechnical && !hasValuation && !hasConsensus) {
    return {
      currentPrice: baseCurrentPrice,
      technicalTarget: null,
      valuationTarget: null,
      consensusTarget: null,
      basisAverage: null,
      estimate: null,
      quantPercent: 0,
      supplyPercent: 0,
      riskPercent: 0,
      totalAdjustmentAmount: null,
    };
  }

  const rawWeights = hasConsensus
    ? {
        technical: hasTechnical ? 0.4 : 0,
        valuation: hasValuation ? 0.35 : 0,
        consensus: 0.25,
      }
    : {
        technical: hasTechnical ? 0.6 : 0,
        valuation: hasValuation ? 0.4 : 0,
        consensus: 0,
      };

  const totalWeight =
    rawWeights.technical + rawWeights.valuation + rawWeights.consensus;
  const technicalWeight = totalWeight > 0 ? rawWeights.technical / totalWeight : 0;
  const valuationWeight = totalWeight > 0 ? rawWeights.valuation / totalWeight : 0;
  const consensusWeight = totalWeight > 0 ? rawWeights.consensus / totalWeight : 0;

  const basisAverage = roundPrice(
    (technicalTarget ?? 0) * technicalWeight +
      (valuationTarget ?? 0) * valuationWeight +
      (consensusTarget ?? 0) * consensusWeight,
  );

  const selectedMode = String(targetPrice?.selectedTargetMode ?? "");
  const targetModes = Array.isArray(targetPrice?.targetModes)
    ? targetPrice.targetModes
    : [];
  const modeResult =
    targetModes.find((mode: any) => String(mode?.mode ?? "") === selectedMode) ??
    targetModes[0] ??
    null;
  const quantAdjustment = modeResult?.quantAdjustment ?? {};
  const quantPercent = getNumber(quantAdjustment.baseAdjustmentPercent) ?? 0;
  const supplyPercent = getNumber(quantAdjustment.positiveAdjustmentPercent) ?? 0;
  const riskPercent = getNumber(quantAdjustment.riskAdjustmentPercent) ?? 0;

  const quantAmount = calculateAdjustmentAmount(basisAverage, quantPercent);
  const supplyAmount = calculateAdjustmentAmount(basisAverage, supplyPercent);
  const riskAmount = calculateAdjustmentAmount(basisAverage, riskPercent);
  const totalAdjustmentAmount =
    quantAmount != null && supplyAmount != null && riskAmount != null
      ? roundPrice(quantAmount + supplyAmount + riskAmount)
      : null;
  const estimate =
    basisAverage != null && totalAdjustmentAmount != null
      ? roundPrice(basisAverage + totalAdjustmentAmount)
      : null;

  return {
    currentPrice: baseCurrentPrice,
    technicalTarget,
    valuationTarget,
    consensusTarget,
    basisAverage,
    estimate,
    quantPercent,
    supplyPercent,
    riskPercent,
    totalAdjustmentAmount,
  };
}

function getTechnicalTarget(targetPrice?: TargetPriceLike | null) {
  const candidates = targetPrice?.targetBasis?.candidates;

  if (Array.isArray(candidates)) {
    const technicalCandidate = candidates.find((candidate) =>
      String(candidate?.label ?? "").includes("기술"),
    );

    const value = getNumber(technicalCandidate?.value);

    if (value != null) return value;
  }

  return getNumber(targetPrice?.technicalTargetRange?.baseTarget);
}

function calculateAdjustmentAmount(basisAverage: number | null, percent: number) {
  if (basisAverage == null || !Number.isFinite(basisAverage)) return null;

  return roundPrice((basisAverage * percent) / 100);
}

function getLatestChartRow(rows?: ChartRow[]) {
  if (!rows?.length) return null;

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];

    if (row?.close != null && Number.isFinite(row.close)) {
      return row;
    }
  }

  return null;
}

function makeRiskLineAnalysis(
  currentPrice?: number | null,
  riskLine?: number | null,
): RiskItem {
  if (!currentPrice || !riskLine || riskLine <= 0) {
    return {
      title: "데이터 없음",
      description: "위험 기준선 대기",
      tone: "neutral",
      isRisk: false,
    };
  }

  const gap = ((currentPrice - riskLine) / currentPrice) * 100;

  if (gap <= 8) {
    return {
      title: "근접",
      description: `위험 기준선까지 ${gap.toFixed(1)}%`,
      tone: "negative",
      isRisk: true,
    };
  }

  return {
    title: "여유",
    description: `위험 기준선까지 ${gap.toFixed(1)}%`,
    tone: "neutral",
    isRisk: false,
  };
}

function makeOverheatAnalysis(
  rsi?: number | null,
  currentPrice?: number | null,
  row?: ChartRow | null,
): RiskItem {
  const bandRisk = getBandPosition(currentPrice, row) >= 0.85;
  const rsiRisk = rsi != null && rsi >= 70;

  if (bandRisk && rsiRisk) {
    return {
      title: "과열 높음",
      description: "RSI와 볼린저밴드가 모두 과열권",
      tone: "negative",
      isRisk: true,
    };
  }

  if (bandRisk || rsiRisk) {
    return {
      title: "과열 주의",
      description: "일부 과열 신호 확인",
      tone: "negative",
      isRisk: true,
    };
  }

  return {
    title: "과열 제한적",
    description: "단기 과열 신호 제한적",
    tone: "neutral",
    isRisk: false,
  };
}

function makeHigh52wAnalysis(
  currentPrice?: number | null,
  high52w?: number | null,
): RiskItem {
  if (!currentPrice || !high52w || high52w <= 0) {
    return {
      title: "데이터 없음",
      description: "52주 고가 데이터 대기",
      tone: "neutral",
      isRisk: false,
    };
  }

  const progress = (currentPrice / high52w) * 100;

  if (progress >= 95) {
    return {
      title: "고가권",
      description: `52주 고가의 ${progress.toFixed(1)}%`,
      tone: "negative",
      isRisk: true,
    };
  }

  if (progress >= 85) {
    return {
      title: "상단권",
      description: `52주 고가의 ${progress.toFixed(1)}%`,
      tone: "neutral",
      isRisk: false,
    };
  }

  return {
    title: "여유",
    description: `52주 고가의 ${progress.toFixed(1)}%`,
    tone: "positive",
    isRisk: false,
  };
}

function makeRsiRiskAnalysis(rsi?: number | null): RiskItem {
  if (rsi == null || Number.isNaN(rsi)) {
    return {
      title: "데이터 없음",
      description: "RSI 데이터 대기",
      tone: "neutral",
      isRisk: false,
    };
  }

  if (rsi >= 70) {
    return {
      title: "과열권",
      description: `RSI ${rsi.toFixed(1)}`,
      tone: "negative",
      isRisk: true,
    };
  }

  if (rsi <= 30) {
    return {
      title: "침체권",
      description: `RSI ${rsi.toFixed(1)} · 반등 확인`,
      tone: "neutral",
      isRisk: false,
    };
  }

  return {
    title: "중립권",
    description: `RSI ${rsi.toFixed(1)}`,
    tone: "positive",
    isRisk: false,
  };
}

function makeBollingerRiskAnalysis(
  currentPrice?: number | null,
  row?: ChartRow | null,
): RiskItem {
  const position = getBandPosition(currentPrice, row);

  if (!Number.isFinite(position)) {
    return {
      title: "데이터 없음",
      description: "볼린저밴드 데이터 대기",
      tone: "neutral",
      isRisk: false,
    };
  }

  if (position >= 0.85) {
    return {
      title: "상단 근접",
      description: `밴드 위치 ${(position * 100).toFixed(1)}%`,
      tone: "negative",
      isRisk: true,
    };
  }

  if (position <= 0.2) {
    return {
      title: "하단권",
      description: `밴드 위치 ${(position * 100).toFixed(1)}%`,
      tone: "neutral",
      isRisk: false,
    };
  }

  return {
    title: "중간권",
    description: `밴드 위치 ${(position * 100).toFixed(1)}%`,
    tone: "positive",
    isRisk: false,
  };
}

function makeTargetProgressAnalysis(
  currentPrice?: number | null,
  estimate?: number | null,
): RiskItem {
  if (!currentPrice || !estimate || estimate <= 0) {
    return {
      title: "데이터 없음",
      description: "추정가 대기",
      tone: "neutral",
      isRisk: false,
    };
  }

  const progress = (currentPrice / estimate) * 100;

  if (progress >= 105) {
    return {
      title: `${progress.toFixed(1)}%`,
      description: "추정가 초과",
      tone: "negative",
      isRisk: true,
    };
  }

  if (progress >= 97) {
    return {
      title: `${progress.toFixed(1)}%`,
      description: "추정가에 근접",
      tone: "negative",
      isRisk: true,
    };
  }

  if (progress >= 90) {
    return {
      title: `${progress.toFixed(1)}%`,
      description: "추정가 상단 접근",
      tone: "neutral",
      isRisk: false,
    };
  }

  return {
    title: `${progress.toFixed(1)}%`,
    description: "추정가까지 여유 있음",
    tone: "positive",
    isRisk: false,
  };
}

function getBandPosition(currentPrice?: number | null, row?: ChartRow | null) {
  if (
    !currentPrice ||
    !row?.bbUpper ||
    !row?.bbLower ||
    row.bbUpper <= row.bbLower
  ) {
    return Number.NaN;
  }

  return (currentPrice - row.bbLower) / (row.bbUpper - row.bbLower);
}

function makeOverallRiskLabel(items: RiskItem[]) {
  const riskCount = items.filter((item) => item.isRisk).length;

  if (riskCount >= 3) return "위험 신호 다수";
  if (riskCount >= 1) return "일부 위험 신호";
  return "위험 신호 제한적";
}

function makeRiskSummary(items: RiskItem[]) {
  const riskCount = items.filter((item) => item.isRisk).length;

  if (riskCount >= 3) {
    return "추격 매수 신중 · 변동성 확인";
  }

  if (riskCount >= 1) {
    return "일부 위험 신호 확인";
  }

  return "위험 부담 제한적";
}

function makeFallbackRiskLine(currentPrice?: number | null) {
  if (currentPrice == null || !Number.isFinite(currentPrice)) return null;

  return roundPrice(currentPrice * 0.9);
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

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isValidNumber(value?: number | null) {
  return value != null && Number.isFinite(value);
}

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return null;

  if (value >= 100_000) return Math.round(value / 10) * 10;
  if (value >= 10_000) return Math.round(value / 5) * 5;
  return Math.round(value);
}

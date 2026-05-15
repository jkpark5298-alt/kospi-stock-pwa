"use client";

type ChartRow = {
  close?: number | null;
  rsi14?: number | null;
  bbUpper?: number | null;
  bbLower?: number | null;
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
      targetPrice?: {
        technicalTargetRange?: {
          currentPrice: number;
          baseTarget: number;
          baseUpsidePercent: number;
          riskLine: number;
          riskDownsidePercent: number;
        } | null;
      };
    };
  } | null;
};

export default function RiskAnalysisSection({ data }: Props) {
  const range = data?.score?.targetPrice?.technicalTargetRange ?? null;
  const latest = getLatestChartRow(data?.chartData);
  const currentPrice = data?.currentPrice ?? range?.currentPrice ?? latest?.close ?? null;

  const riskLine = makeRiskLineAnalysis(currentPrice, range?.riskLine);
  const overheat = makeOverheatAnalysis(latest?.rsi14, currentPrice, latest);
  const high52w = makeHigh52wAnalysis(currentPrice, data?.fundamentals?.high52w);
  const rsi = makeRsiRiskAnalysis(latest?.rsi14);
  const bollinger = makeBollingerRiskAnalysis(currentPrice, latest);
  const targetProgress = makeTargetProgressAnalysis(currentPrice, range?.baseTarget);

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>위험 분석 방식</span>
          <strong>{makeOverallRiskLabel([riskLine, overheat, high52w, rsi, bollinger, targetProgress])}</strong>
        </div>

        <p className="target-basis-summary">
          위험 분석은 추정 주가가 있더라도 현재 가격이 과열권인지, 위험
          기준선과 얼마나 떨어져 있는지, 52주 고가와 볼린저밴드 상단에
          가까운지를 확인하는 영역입니다. 상승 가능성과 별개로 진입 부담과
          변동성 확대 가능성을 함께 봅니다.
        </p>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <RiskMetricCard
            title="위험 기준선"
            value={formatNumber(range?.riskLine)}
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
            title="현재 모델 도달률"
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
            <strong>{makeRiskSummary([riskLine, overheat, high52w, rsi, bollinger, targetProgress])}</strong>
          </div>

          <div className="target-basis-adjustments">
            <p>현재가: {formatNumber(currentPrice)}</p>
            <p>현재 모델 추정가: {formatNumber(range?.baseTarget)}</p>
            <p>현재 모델 추정 괴리율: {formatPercent(range?.baseUpsidePercent)}</p>
            <p>위험 기준선 대비 하락 여지: {formatPercent(range?.riskDownsidePercent)}</p>
            <p>52주 고가: {formatNumber(data?.fundamentals?.high52w)}</p>
            <p>52주 저가: {formatNumber(data?.fundamentals?.low52w)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

type RiskTone = "positive" | "negative" | "neutral";

type RiskItem = {
  title: string;
  description: string;
  tone: RiskTone;
  isRisk: boolean;
};

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
    description: "단기 과열 신호는 제한적",
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
  baseTarget?: number | null,
): RiskItem {
  if (!currentPrice || !baseTarget || baseTarget <= 0) {
    return {
      title: "데이터 없음",
      description: "현재 모델 추정가 대기",
      tone: "neutral",
      isRisk: false,
    };
  }

  const progress = (currentPrice / baseTarget) * 100;

  if (progress >= 97) {
    return {
      title: `${progress.toFixed(1)}%`,
      description: "현재 모델 추정가에 근접",
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

"use client";

type ChartRow = {
  close?: number | null;
  sma20?: number | null;
  sma60?: number | null;
  rsi14?: number | null;
  macd?: number | null;
  signal?: number | null;
  bbUpper?: number | null;
  bbLower?: number | null;
  volume?: number | null;
};

type Props = {
  data?: {
    currentPrice?: number | null;
    signalSummary?: string | null;
    chartData?: ChartRow[];
    score?: {
      targetPrice?: {
        technicalTargetRange?: {
          baseTarget: number;
          baseUpsidePercent: number;
          currentPrice: number;
        } | null;
      };
    };
  } | null;
};

export default function TechnicalBasisExplanation({ data }: Props) {
  const latest = getLatestChartRow(data?.chartData);
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const currentPrice = data?.currentPrice ?? latest?.close ?? range?.currentPrice ?? null;

  const trend = makeTrendAnalysis(currentPrice, latest);
  const rsi = makeRsiAnalysis(latest?.rsi14);
  const macd = makeMacdAnalysis(latest?.macd, latest?.signal);
  const band = makeBollingerAnalysis(currentPrice, latest);
  const target = makeTargetAnalysis(range);

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>기술적 기준가 산정 방식</span>
          <strong>{formatNumber(range?.baseTarget)}</strong>
        </div>

        <p className="target-basis-summary">
          기술적 기준가는 현재가, 이동평균, RSI, MACD, 볼린저밴드, 거래량,
          변동성을 바탕으로 계산한 차트 기반 1차 기준가입니다. 상승 추세가
          강하면 기준가가 높아질 수 있고, 단기 과열이나 변동성 확대가 있으면
          보수적으로 해석합니다.
        </p>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <TechMetricCard
            title="이동평균/추세"
            value={trend.title}
            subText={trend.description}
          />
          <TechMetricCard title="RSI" value={rsi.title} subText={rsi.description} />
          <TechMetricCard
            title="MACD"
            value={macd.title}
            subText={macd.description}
          />
          <TechMetricCard
            title="볼린저밴드"
            value={band.title}
            subText={band.description}
          />
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>기술적 기준가 분석</span>
            <strong>{data?.signalSummary || "기술 신호 대기"}</strong>
          </div>

          <div className="target-basis-adjustments">
            <p>현재가: {formatNumber(currentPrice)}</p>
            <p>20일 이동평균: {formatNumber(latest?.sma20)}</p>
            <p>60일 이동평균: {formatNumber(latest?.sma60)}</p>
            <p>거래량: {formatNumber(latest?.volume)}</p>
            <p>{target}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TechMetricCard({
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

function makeTrendAnalysis(current?: number | null, row?: ChartRow | null) {
  if (!current || !row?.sma20 || !row?.sma60) {
    return {
      title: "확인 필요",
      description: "현재가와 이동평균 데이터 대기",
    };
  }

  if (current > row.sma20 && row.sma20 > row.sma60) {
    return {
      title: "상승 흐름",
      description: "현재가가 20일·60일 이동평균선 위",
    };
  }

  if (current < row.sma20 && current < row.sma60) {
    return {
      title: "약세 흐름",
      description: "현재가가 주요 이동평균선 아래",
    };
  }

  return {
    title: "혼조",
    description: "이동평균 기준 방향성 확인 필요",
  };
}

function makeRsiAnalysis(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return {
      title: "데이터 없음",
      description: "RSI 데이터 대기",
    };
  }

  if (value >= 70) {
    return {
      title: "과열권",
      description: `RSI ${value.toFixed(1)} · 추격 매수 신중`,
    };
  }

  if (value <= 30) {
    return {
      title: "침체권",
      description: `RSI ${value.toFixed(1)} · 반등 여부 확인`,
    };
  }

  return {
    title: "중립권",
    description: `RSI ${value.toFixed(1)} · 방향성 확인`,
  };
}

function makeMacdAnalysis(macd?: number | null, signal?: number | null) {
  if (macd == null || signal == null) {
    return {
      title: "데이터 없음",
      description: "MACD 데이터 대기",
    };
  }

  if (macd > signal) {
    return {
      title: "상승 우위",
      description: "MACD가 Signal 위",
    };
  }

  if (macd < signal) {
    return {
      title: "하락 우위",
      description: "MACD가 Signal 아래",
    };
  }

  return {
    title: "중립",
    description: "MACD와 Signal이 근접",
  };
}

function makeBollingerAnalysis(current?: number | null, row?: ChartRow | null) {
  if (!current || !row?.bbUpper || !row?.bbLower || row.bbUpper <= row.bbLower) {
    return {
      title: "확인 필요",
      description: "볼린저밴드 데이터 대기",
    };
  }

  const position = (current - row.bbLower) / (row.bbUpper - row.bbLower);

  if (position >= 0.85) {
    return {
      title: "상단권",
      description: "단기 과열과 변동성 확대 확인",
    };
  }

  if (position <= 0.2) {
    return {
      title: "하단권",
      description: "과매도 또는 반등 여부 확인",
    };
  }

  return {
    title: "중간권",
    description: "밴드 내 정상 변동 구간",
  };
}

function makeTargetAnalysis(
  range?: {
    baseTarget: number;
    baseUpsidePercent: number;
    currentPrice: number;
  } | null,
) {
  if (!range) {
    return "기술적 기준가 데이터가 아직 없습니다.";
  }

  return `기술적 기준가는 ${formatNumber(
    range.baseTarget,
  )}이며 현재가 대비 ${formatPercent(range.baseUpsidePercent)} 수준입니다.`;
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

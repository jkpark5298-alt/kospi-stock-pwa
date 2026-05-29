import type { ChartRow } from "@/types/stock";
import type {
  MarketRegime,
  StrategyInterpretationRule,
  StrategyRiskPenalty,
  StrategyScoreRow,
  TechnicalStrategyResult,
} from "@/types/technicalStrategy";
import {
  INDICATOR_SCORE_TABLE,
  INTERPRETATION_TABLE,
  PRICE_RANGE_TABLE,
  TRADE_SIGNAL_TABLE,
  REGIME_BONUS_TABLE,
  REGIME_RULES,
  RISK_PENALTY_TABLE,
  TECHNICAL_STRATEGY_MAX_SCORE,
} from "@/lib/technicalStrategyConfig";

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(TECHNICAL_STRATEGY_MAX_SCORE, Math.round(value)));
}

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value / 10) * 10;
}

function averageAbsoluteDailyChangePercent(rows: ChartRow[]) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const changes: number[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]?.close;
    const curr = sorted[i]?.close;

    if (isNumber(prev) && isNumber(curr) && prev > 0) {
      changes.push(Math.abs((curr - prev) / prev));
    }
  }

  if (!changes.length) return 0.025;

  return changes.reduce((sum, value) => sum + value, 0) / changes.length;
}

function getNumericValues(
  rows: ChartRow[],
  key: "open" | "high" | "low" | "close" | "bbUpper" | "bbLower" | "sma20" | "sma60",
) {
  return rows
    .map((row) => row[key])
    .filter((value): value is number => isNumber(value));
}


function getLatestRow(rows: ChartRow[]) {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null;
}

function getPastRow(rows: ChartRow[], offset: number) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.at(-1 - offset) ?? null;
}

function makeScoreRow(
  key: StrategyScoreRow["key"],
  score: number,
  status: StrategyScoreRow["status"],
  reason: string,
): StrategyScoreRow {
  const config = INDICATOR_SCORE_TABLE[key];

  return {
    key,
    label: config.label,
    score,
    maxScore: config.maxScore,
    status,
    reason,
  };
}

function scoreTrend(rows: ChartRow[], latest: ChartRow): StrategyScoreRow {
  const past5 = getPastRow(rows, 5);
  const close = latest.close;
  const sma20 = latest.sma20;
  const sma60 = latest.sma60;

  if (!isNumber(close)) {
    return makeScoreRow("trend", 0, "neutral", "현재가 데이터가 부족합니다.");
  }

  let score = 8;
  const reasons: string[] = [];

  if (isNumber(sma20) && close > sma20) {
    score += 6;
    reasons.push("현재가가 20일 이동평균선 위에 있습니다.");
  } else if (isNumber(sma20)) {
    score -= 3;
    reasons.push("현재가가 20일 이동평균선 아래에 있습니다.");
  }

  if (isNumber(sma60) && close > sma60) {
    score += 6;
    reasons.push("현재가가 60일 이동평균선 위에 있습니다.");
  } else if (isNumber(sma60)) {
    score -= 4;
    reasons.push("현재가가 60일 이동평균선 아래에 있습니다.");
  }

  if (past5 && isNumber(past5.sma20) && isNumber(sma20) && sma20 > past5.sma20) {
    score += 5;
    reasons.push("20일 이동평균선 기울기가 상승입니다.");
  }

  const finalScore = Math.max(0, Math.min(INDICATOR_SCORE_TABLE.trend.maxScore, score));

  return makeScoreRow(
    "trend",
    finalScore,
    finalScore >= 18 ? "positive" : finalScore >= 10 ? "neutral" : "negative",
    reasons.join(" ") || "추세 판단 데이터가 제한적입니다.",
  );
}

function scorePrice(rows: ChartRow[], latest: ChartRow): StrategyScoreRow {
  const recent = rows.slice(-60).filter((row) => isNumber(row.close));
  const close = latest.close;

  if (!isNumber(close) || recent.length < 10) {
    return makeScoreRow("price", 0, "neutral", "가격 위치 판단 데이터가 부족합니다.");
  }

  const closes = recent.map((row) => row.close as number);
  const recentHigh = Math.max(...closes);
  const recentLow = Math.min(...closes);
  const range = recentHigh - recentLow;

  if (range <= 0) {
    return makeScoreRow("price", 8, "neutral", "가격 범위가 좁아 위치 판단이 제한적입니다.");
  }

  const position = (close - recentLow) / range;

  if (position >= 0.55 && position <= 0.85) {
    return makeScoreRow("price", 16, "positive", "최근 60일 가격 범위에서 중상단에 위치합니다.");
  }

  if (position > 0.85) {
    return makeScoreRow("price", 10, "risk", "최근 60일 고점권에 가까워 추격 위험을 함께 봐야 합니다.");
  }

  if (position >= 0.35) {
    return makeScoreRow("price", 11, "neutral", "최근 60일 가격 범위에서 중간권에 위치합니다.");
  }

  return makeScoreRow("price", 6, "negative", "최근 60일 가격 범위에서 하단권에 위치합니다.");
}

function scoreMacd(latest: ChartRow): StrategyScoreRow {
  const macd = latest.macd;
  const signal = latest.signal;
  const histogram = latest.histogram;

  if (!isNumber(macd) || !isNumber(signal)) {
    return makeScoreRow("macd", 0, "neutral", "MACD 데이터가 부족합니다.");
  }

  let score = 8;
  const reasons: string[] = [];

  if (macd > signal) {
    score += 8;
    reasons.push("MACD가 Signal 위에 있어 단기 모멘텀이 우호적입니다.");
  } else {
    score -= 4;
    reasons.push("MACD가 Signal 아래에 있어 단기 모멘텀이 약합니다.");
  }

  if (isNumber(histogram) && histogram > 0) {
    score += 4;
    reasons.push("히스토그램이 양수입니다.");
  }

  const finalScore = Math.max(0, Math.min(INDICATOR_SCORE_TABLE.macd.maxScore, score));

  return makeScoreRow(
    "macd",
    finalScore,
    finalScore >= 14 ? "positive" : finalScore >= 8 ? "neutral" : "negative",
    reasons.join(" "),
  );
}

function scoreRsi(latest: ChartRow): StrategyScoreRow {
  const rsi = latest.rsi14;

  if (!isNumber(rsi)) {
    return makeScoreRow("rsi", 0, "neutral", "RSI 데이터가 부족합니다.");
  }

  if (rsi >= 50 && rsi <= 70) {
    return makeScoreRow("rsi", 17, "positive", `RSI14 ${rsi.toFixed(2)}는 중립 50 위, 과열 70 아래의 우호 구간입니다.`);
  }

  if (rsi > 70) {
    return makeScoreRow("rsi", 10, "risk", `RSI14 ${rsi.toFixed(2)}는 과열권에 가까워 추격 위험이 있습니다.`);
  }

  if (rsi >= 40) {
    return makeScoreRow("rsi", 10, "neutral", `RSI14 ${rsi.toFixed(2)}는 중립권입니다.`);
  }

  if (rsi >= 30) {
    return makeScoreRow("rsi", 6, "negative", `RSI14 ${rsi.toFixed(2)}는 약세권입니다.`);
  }

  return makeScoreRow("rsi", 8, "risk", `RSI14 ${rsi.toFixed(2)}는 과매도권입니다. 반등 가능성과 하락 위험을 함께 봐야 합니다.`);
}

function scoreBollinger(latest: ChartRow): StrategyScoreRow {
  const close = latest.close;
  const upper = latest.bbUpper;
  const middle = latest.bbMiddle;
  const lower = latest.bbLower;

  if (!isNumber(close) || !isNumber(upper) || !isNumber(lower) || upper <= lower) {
    return makeScoreRow("bollinger", 0, "neutral", "볼린저밴드 데이터가 부족합니다.");
  }

  const position = (close - lower) / (upper - lower);

  if (isNumber(middle) && close >= middle && position <= 0.85) {
    return makeScoreRow("bollinger", 13, "positive", "현재가가 볼린저밴드 중심선 위에 있고 상단 과열 전입니다.");
  }

  if (position > 0.85) {
    return makeScoreRow("bollinger", 8, "risk", "현재가가 볼린저밴드 상단권에 가까워 과열 가능성이 있습니다.");
  }

  if (position >= 0.35) {
    return makeScoreRow("bollinger", 8, "neutral", "현재가가 볼린저밴드 중앙권에 있습니다.");
  }

  return makeScoreRow("bollinger", 5, "negative", "현재가가 볼린저밴드 하단권에 있습니다.");
}

function detectRegime(rows: StrategyScoreRow[]): MarketRegime {
  const total = rows.reduce((sum, row) => sum + row.score, 0);
  const positiveCount = rows.filter((row) => row.status === "positive").length;
  const negativeCount = rows.filter((row) => row.status === "negative").length;
  const riskCount = rows.filter((row) => row.status === "risk").length;

  if (total >= 65 && positiveCount >= 3 && riskCount <= 1) {
    return "uptrend";
  }

  if (total < 45 || negativeCount >= 3) {
    return "downtrend";
  }

  return "sideways";
}

function calculateRiskPenalties(regime: MarketRegime, latest: ChartRow): StrategyRiskPenalty[] {
  const penalties: StrategyRiskPenalty[] = [];

  const rsi = latest.rsi14;
  const close = latest.close;
  const sma60 = latest.sma60;
  const macd = latest.macd;
  const signal = latest.signal;
  const upper = latest.bbUpper;
  const lower = latest.bbLower;

  penalties.push({
    key: "rsiOverheated",
    label: RISK_PENALTY_TABLE.rsiOverheated.label,
    penalty: RISK_PENALTY_TABLE.rsiOverheated.penalty,
    active: isNumber(rsi) && rsi >= 72,
    reason: "RSI가 72 이상이면 단기 과열 위험을 반영합니다.",
  });

  penalties.push({
    key: "bollingerUpperRisk",
    label: RISK_PENALTY_TABLE.bollingerUpperRisk.label,
    penalty: RISK_PENALTY_TABLE.bollingerUpperRisk.penalty,
    active:
      isNumber(close) &&
      isNumber(upper) &&
      isNumber(lower) &&
      upper > lower &&
      (close - lower) / (upper - lower) >= 0.9,
    reason: "볼린저밴드 상단 90% 이상이면 과열 위험을 반영합니다.",
  });

  penalties.push({
    key: "macdWeak",
    label: RISK_PENALTY_TABLE.macdWeak.label,
    penalty: RISK_PENALTY_TABLE.macdWeak.penalty,
    active: isNumber(macd) && isNumber(signal) && macd < signal,
    reason: "MACD가 Signal 아래이면 모멘텀 약화 위험을 반영합니다.",
  });

  penalties.push({
    key: "belowSma60",
    label: RISK_PENALTY_TABLE.belowSma60.label,
    penalty: RISK_PENALTY_TABLE.belowSma60.penalty,
    active: regime === "downtrend" && isNumber(close) && isNumber(sma60) && close < sma60,
    reason: "하락 장세에서 현재가가 60일선 아래이면 위험을 크게 반영합니다.",
  });

  return penalties;
}


function calculateTechnicalPriceRange({
  rows,
  latest,
  regime,
  finalScore,
}: {
  rows: ChartRow[];
  latest: ChartRow;
  regime: MarketRegime;
  finalScore: number;
}) {
  const currentPrice = latest.close;

  if (!isNumber(currentPrice) || currentPrice <= 0) {
    return {
      currentPrice: null,
      lowerPrice: null,
      basePrice: null,
      upperPrice: null,
      lowerBasis: ["현재가 데이터가 부족합니다."],
      baseBasis: ["현재가 데이터가 부족합니다."],
      upperBasis: ["현재가 데이터가 부족합니다."],
      confidence: "low" as const,
      summary: "추정가 계산 데이터가 부족합니다.",
    };
  }

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const recentRows = sorted.slice(-60);
  const rangeConfig = PRICE_RANGE_TABLE[regime];

  const highs = getNumericValues(recentRows, "high");
  const lows = getNumericValues(recentRows, "low");
  const closes = getNumericValues(recentRows, "close");

  const highCandidates = highs.length ? highs : closes;
  const lowCandidates = lows.length ? lows : closes;

  const recentHigh = highCandidates.length ? Math.max(...highCandidates) : currentPrice;
  const recentLow = lowCandidates.length ? Math.min(...lowCandidates) : currentPrice;

  const volatility = averageAbsoluteDailyChangePercent(recentRows);
  const minBand = rangeConfig.minBandPercent / 100;

  const volatilityLower =
    currentPrice *
    (1 - Math.max(volatility * rangeConfig.volatilityMultiplierLower, minBand));
  const volatilityUpper =
    currentPrice *
    (1 + Math.max(volatility * rangeConfig.volatilityMultiplierUpper, minBand));

  const lowerCandidates = [
    recentLow,
    latest.bbLower,
    latest.sma20,
    latest.sma60,
    volatilityLower,
  ].filter((value): value is number => isNumber(value) && value > 0 && value < currentPrice);

  const upperCandidates = [
    recentHigh,
    latest.bbUpper,
    volatilityUpper,
  ].filter((value): value is number => isNumber(value) && value > currentPrice);

  const lowerRaw = lowerCandidates.length
    ? Math.max(...lowerCandidates)
    : currentPrice * (1 - minBand);

  const upperRaw = upperCandidates.length
    ? Math.max(...upperCandidates)
    : currentPrice * (1 + minBand);

  const scoreAdjustmentPercent = (finalScore - 50) / 10;
  const baseRaw =
    currentPrice *
    (1 + (rangeConfig.regimeAdjustmentPercent + scoreAdjustmentPercent) / 100);

  const upperCap = currentPrice * (1 + rangeConfig.maxUpperCapPercent / 100);

  const lowerPrice = roundPrice(Math.min(lowerRaw, currentPrice * 0.995));
  const upperPrice = roundPrice(Math.min(Math.max(upperRaw, currentPrice * 1.01), upperCap));
  const basePrice = roundPrice(
    Math.max(
      lowerPrice ?? currentPrice * 0.95,
      Math.min(baseRaw, upperPrice ?? currentPrice * 1.05),
    ),
  );

  const confidence: "high" | "medium" | "low" =
    recentRows.length >= 50 && highs.length >= 30 && lows.length >= 30
      ? "high"
      : recentRows.length >= 30
        ? "medium"
        : "low";

  return {
    currentPrice: roundPrice(currentPrice),
    lowerPrice,
    basePrice,
    upperPrice,
    lowerBasis: [
      "최근 60일 저가",
      "볼린저밴드 하단",
      "SMA20/SMA60",
      "변동성 하단",
    ],
    baseBasis: [
      "현재가",
      "장세 보정",
      "최종 점수 보정",
    ],
    upperBasis: [
      "최근 60일 고가",
      "볼린저밴드 상단",
      "변동성 상단",
    ],
    confidence,
    summary: `하단 ${lowerPrice?.toLocaleString() ?? "-"}원 / 기준 ${basePrice?.toLocaleString() ?? "-"}원 / 상단 ${upperPrice?.toLocaleString() ?? "-"}원`,
  };
}


function calculateTradeSignals({
  latest,
  regime,
  finalScore,
  priceRange,
}: {
  latest: ChartRow;
  regime: MarketRegime;
  finalScore: number;
  priceRange: ReturnType<typeof calculateTechnicalPriceRange>;
}) {
  const currentPrice = priceRange.currentPrice;
  const lowerPrice = priceRange.lowerPrice;
  const basePrice = priceRange.basePrice;
  const upperPrice = priceRange.upperPrice;

  const rsi = latest.rsi14;
  const macd = latest.macd;
  const signal = latest.signal;
  const close = latest.close;
  const bbUpper = latest.bbUpper;
  const bbLower = latest.bbLower;

  const hasPrice = isNumber(currentPrice) && currentPrice > 0;
  const macdPositive = isNumber(macd) && isNumber(signal) && macd > signal;
  const macdNegative = isNumber(macd) && isNumber(signal) && macd < signal;
  const rsiHealthy = isNumber(rsi) && rsi >= 45 && rsi <= 68;
  const rsiOverheated = isNumber(rsi) && rsi >= 70;
  const rsiWeak = isNumber(rsi) && rsi < 40;

  const nearBase =
    hasPrice &&
    isNumber(basePrice) &&
    currentPrice <= basePrice * 1.01 &&
    currentPrice >= basePrice * 0.94;

  const nearLower =
    hasPrice &&
    isNumber(lowerPrice) &&
    currentPrice <= lowerPrice * 1.03 &&
    currentPrice >= lowerPrice * 0.98;

  const belowLower =
    hasPrice &&
    isNumber(lowerPrice) &&
    currentPrice < lowerPrice * 0.985;

  const nearUpper =
    hasPrice &&
    isNumber(upperPrice) &&
    currentPrice >= upperPrice * 0.97;

  const aboveUpper =
    hasPrice &&
    isNumber(upperPrice) &&
    currentPrice > upperPrice;

  const bollingerUpperRisk =
    isNumber(close) &&
    isNumber(bbUpper) &&
    isNumber(bbLower) &&
    bbUpper > bbLower &&
    (close - bbLower) / (bbUpper - bbLower) >= 0.9;

  const entryActive =
    hasPrice &&
    regime === "uptrend" &&
    finalScore >= 65 &&
    nearBase &&
    macdPositive &&
    !rsiOverheated;

  const scaleBuyActive =
    hasPrice &&
    finalScore >= 55 &&
    (nearLower || nearBase) &&
    !belowLower &&
    !rsiOverheated;

  const stopLossActive =
    hasPrice &&
    (belowLower || (regime === "downtrend" && finalScore < 45 && macdNegative));

  const takeProfitActive =
    hasPrice &&
    (nearUpper || aboveUpper || rsiOverheated || bollingerUpperRisk);

  const exitActive =
    hasPrice &&
    regime === "downtrend" &&
    finalScore < 40 &&
    (macdNegative || rsiWeak || belowLower);

  return [
    {
      type: "entry" as const,
      label: TRADE_SIGNAL_TABLE.entry.label,
      active: entryActive,
      strength: entryActive && finalScore >= 75 ? "strong" as const : entryActive ? "normal" as const : "none" as const,
      price: basePrice,
      condition: "상승 장세 + 65점 이상 + 기준가 근처 + MACD 우호 + RSI 비과열",
      reason: entryActive
        ? "장세와 점수가 우호적이고 기준 추정가 근처라 진입 후보로 볼 수 있습니다."
        : "진입 조건이 모두 충족되지는 않았습니다.",
    },
    {
      type: "scaleBuy" as const,
      label: TRADE_SIGNAL_TABLE.scaleBuy.label,
      active: scaleBuyActive,
      strength: scaleBuyActive && nearLower ? "strong" as const : scaleBuyActive ? "normal" as const : "none" as const,
      price: lowerPrice,
      condition: "55점 이상 + 하단/기준 추정가 근처 + 하단 이탈 아님 + RSI 비과열",
      reason: scaleBuyActive
        ? "상승 근거는 있으나 가격 부담을 줄이기 위해 분할매수 구간으로 볼 수 있습니다."
        : "분할매수 조건이 충분하지 않습니다.",
    },
    {
      type: "stopLoss" as const,
      label: TRADE_SIGNAL_TABLE.stopLoss.label,
      active: stopLossActive,
      strength: stopLossActive && belowLower ? "strong" as const : stopLossActive ? "watch" as const : "none" as const,
      price: lowerPrice,
      condition: "하단 추정가 이탈 또는 하락 장세 + 약한 점수 + MACD 약세",
      reason: stopLossActive
        ? "하단 방어선 이탈 또는 약세 신호가 있어 손절 기준을 확인해야 합니다."
        : "현재는 손절 조건이 직접적으로 발생하지 않았습니다.",
    },
    {
      type: "takeProfit" as const,
      label: TRADE_SIGNAL_TABLE.takeProfit.label,
      active: takeProfitActive,
      strength: aboveUpper ? "strong" as const : takeProfitActive ? "watch" as const : "none" as const,
      price: upperPrice,
      condition: "상단 추정가 근접/돌파 또는 RSI 과열 또는 볼린저밴드 상단 과열",
      reason: takeProfitActive
        ? "상단권 또는 과열 신호가 있어 일부 익절을 검토할 수 있습니다."
        : "익절 조건은 아직 강하지 않습니다.",
    },
    {
      type: "exit" as const,
      label: TRADE_SIGNAL_TABLE.exit.label,
      active: exitActive,
      strength: exitActive && belowLower ? "strong" as const : exitActive ? "watch" as const : "none" as const,
      price: lowerPrice,
      condition: "하락 장세 + 40점 미만 + MACD/RSI 약세 또는 하단 이탈",
      reason: exitActive
        ? "하락 장세와 약한 점수가 겹쳐 청산 또는 비중 축소를 검토해야 합니다."
        : "청산 조건이 직접적으로 발생하지 않았습니다.",
    },
  ];
}

function getInterpretation(score: number): StrategyInterpretationRule {
  return (
    INTERPRETATION_TABLE.find((rule) => score >= rule.min && score <= rule.max) ??
    INTERPRETATION_TABLE[INTERPRETATION_TABLE.length - 1]
  );
}

export function calculateTechnicalStrategy(rows: ChartRow[]): TechnicalStrategyResult {
  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const latest = getLatestRow(sortedRows);

  if (!latest) {
    return {
      available: false,
      regime: "sideways",
      regimeLabel: "데이터 없음",
      regimeDescription: "장세 판별을 위한 차트 데이터가 없습니다.",
      commonScore: 0,
      regimeBonus: 0,
      riskPenalty: 0,
      finalScore: 0,
      action: "관망",
      actionLabel: "데이터 대기",
      actionDescription: "데이터가 쌓인 뒤 판단합니다.",
      rows: [],
      riskPenalties: [],
      latest: null,
      priceRange: {
        currentPrice: null,
        lowerPrice: null,
        basePrice: null,
        upperPrice: null,
        lowerBasis: [],
        baseBasis: [],
        upperBasis: [],
        confidence: "low",
        summary: "차트 데이터가 부족합니다.",
      },
      tradeSignals: [],
      summary: "차트 데이터가 부족합니다.",
    };
  }

  const scoreRows = [
    scoreTrend(sortedRows, latest),
    scorePrice(sortedRows, latest),
    scoreMacd(latest),
    scoreRsi(latest),
    scoreBollinger(latest),
  ];

  const commonScore = scoreRows.reduce((sum, row) => sum + row.score, 0);
  const regime = detectRegime(scoreRows);
  const regimeRule = REGIME_RULES.find((rule) => rule.regime === regime) ?? REGIME_RULES[1];
  const regimeBonus = REGIME_BONUS_TABLE[regime];
  const riskPenalties = calculateRiskPenalties(regime, latest);
  const riskPenalty = riskPenalties
    .filter((penalty) => penalty.active)
    .reduce((sum, penalty) => sum + penalty.penalty, 0);
  const finalScore = clampScore(commonScore + regimeBonus - riskPenalty);
  const interpretation = getInterpretation(finalScore);
  const priceRange = calculateTechnicalPriceRange({
    rows: sortedRows,
    latest,
    regime,
    finalScore,
  });
  const tradeSignals = calculateTradeSignals({
    latest,
    regime,
    finalScore,
    priceRange,
  });

  return {
    available: true,
    regime,
    regimeLabel: regimeRule.label,
    regimeDescription: regimeRule.description,
    commonScore,
    regimeBonus,
    riskPenalty,
    finalScore,
    action: interpretation.action,
    actionLabel: interpretation.label,
    actionDescription: interpretation.description,
    rows: scoreRows,
    riskPenalties,
    latest,
    priceRange,
    tradeSignals,
    summary: `${regimeRule.label} / ${finalScore}점 / ${interpretation.label} / ${priceRange.summary}`,
  };
}

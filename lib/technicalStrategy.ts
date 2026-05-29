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
    summary: `${regimeRule.label} / ${finalScore}점 / ${interpretation.label}`,
  };
}

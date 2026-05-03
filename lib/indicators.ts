export function sma(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return Number((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
  });
}

export function ema(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    if (i === period - 1) {
      prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(Number(prev.toFixed(2)));
      continue;
    }

    prev = data[i] * k + (prev as number) * (1 - k);
    result.push(Number(prev.toFixed(2)));
  }

  return result;
}

export function rsi(data: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(data.length).fill(null);

  for (let i = period; i < data.length; i++) {
    let gains = 0;
    let losses = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j] - data[j - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
      out[i] = 100;
      continue;
    }

    const rs = avgGain / avgLoss;
    out[i] = Number((100 - 100 / (1 + rs)).toFixed(2));
  }

  return out;
}

export function macd(data: number[]) {
  const ema12 = ema(data, 12);
  const ema26 = ema(data, 26);

  const macdLine = data.map((_, i) => {
    if (ema12[i] == null || ema26[i] == null) return null;
    return Number(((ema12[i] as number) - (ema26[i] as number)).toFixed(2));
  });

  const validMacd = macdLine.filter((v): v is number => v != null);
  const validSignal = ema(validMacd, 9);
  let validIndex = 0;

  const signalLine = macdLine.map((value) => {
    if (value == null) return null;
    const signal = validSignal[validIndex] ?? null;
    validIndex += 1;
    return signal == null ? null : Number(signal.toFixed(2));
  });

  const histogram = macdLine.map((value, i) => {
    if (value == null || signalLine[i] == null) return null;
    return Number((value - (signalLine[i] as number)).toFixed(2));
  });

  return { macdLine, signalLine, histogram };
}

export function bollingerBands(data: number[], period = 20, multiplier = 2) {
  const middle = sma(data, period);
  const upper: (number | null)[] = Array(data.length).fill(null);
  const lower: (number | null)[] = Array(data.length).fill(null);

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = middle[i];
    if (mean == null) continue;

    const variance = slice.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period;
    const std = Math.sqrt(variance);

    upper[i] = Number((mean + multiplier * std).toFixed(2));
    lower[i] = Number((mean - multiplier * std).toFixed(2));
  }

  return { upper, middle, lower };
}

export function obv(closes: number[], volumes: number[]) {
  const out: number[] = [];
  let current = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      out.push(0);
      continue;
    }

    if (closes[i] > closes[i - 1]) current += volumes[i] ?? 0;
    if (closes[i] < closes[i - 1]) current -= volumes[i] ?? 0;
    out.push(current);
  }

  return out;
}

export function simpleForecast(closes: number[], days = 5) {
  if (closes.length < 20) return [];

  const recent = closes.slice(-20);
  const returns: number[] = [];

  for (let i = 1; i < recent.length; i++) {
    returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  let last = closes[closes.length - 1];
  const result: number[] = [];

  for (let i = 0; i < days; i++) {
    last *= 1 + mean;
    result.push(Number(last.toFixed(2)));
  }

  return result;
}

export function makeSignal(params: {
  current: number;
  sma20: number | null;
  sma60: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
}) {
  const { current, sma20, sma60, rsi, macd, macdSignal } = params;
  let score = 0;

  if (sma20 != null && current > sma20) score += 1;
  if (sma60 != null && current > sma60) score += 1;
  if (rsi != null && rsi < 30) score += 1;
  if (rsi != null && rsi > 70) score -= 1;
  if (macd != null && macdSignal != null && macd > macdSignal) score += 1;
  if (macd != null && macdSignal != null && macd < macdSignal) score -= 1;

  if (score >= 2) return "상대적 강세";
  if (score <= -1) return "상대적 약세";
  return "중립";
}

export function makeFearGreedScore(params: {
  current: number;
  sma20: number | null;
  sma60: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  change: number;
  obvNow: number | null;
  obvPrev: number | null;
}) {
  const { current, sma20, sma60, rsi, macd, macdSignal, change, obvNow, obvPrev } = params;
  let score = 50;

  if (sma20 != null) score += current > sma20 ? 8 : -8;
  if (sma60 != null) score += current > sma60 ? 8 : -8;
  if (rsi != null) {
    if (rsi >= 70) score += 10;
    else if (rsi >= 55) score += 6;
    else if (rsi <= 30) score -= 10;
    else if (rsi <= 45) score -= 6;
  }
  if (macd != null && macdSignal != null) score += macd > macdSignal ? 8 : -8;
  if (change > 1) score += 6;
  if (change < -1) score -= 6;
  if (obvNow != null && obvPrev != null) score += obvNow > obvPrev ? 5 : -5;

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  let label = "Neutral";
  if (clamped <= 24) label = "Extreme Fear";
  else if (clamped <= 44) label = "Fear";
  else if (clamped <= 55) label = "Neutral";
  else if (clamped <= 75) label = "Greed";
  else label = "Extreme Greed";

  return { score: clamped, label };
}

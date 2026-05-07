export type EarningsGrowthSource = "none" | "manual" | "kis" | "dart" | "consensus";

export type EarningsGrowthInput = {
  source?: EarningsGrowthSource;
  updatedAt?: string | null;

  lastYearNetIncome?: number | null;
  expectedNetIncome?: number | null;

  lastYearOperatingProfit?: number | null;
  expectedOperatingProfit?: number | null;

  lastYearEps?: number | null;
  expectedEps?: number | null;

  turnaround?: boolean | null;
  deficitReduction?: boolean | null;
};

export type EarningsGrowthData = {
  available: boolean;
  source: EarningsGrowthSource;
  updatedAt: string | null;
  warning?: string;

  lastYearNetIncome: number | null;
  expectedNetIncome: number | null;
  netIncomeGrowthRate: number | null;

  lastYearOperatingProfit: number | null;
  expectedOperatingProfit: number | null;
  operatingProfitGrowthRate: number | null;

  lastYearEps: number | null;
  expectedEps: number | null;
  epsGrowthRate: number | null;

  turnaround: boolean | null;
  deficitReduction: boolean | null;

  score: number | null;
  label: string;
  reasons: string[];
};

export type EarningsGrowthBuildOptions = {
  automatic?: EarningsGrowthInput | null;
  manual?: EarningsGrowthInput | null;
};

export function calculateEarningsGrowthData({
  automatic,
  manual,
}: EarningsGrowthBuildOptions): EarningsGrowthData {
  const selected = hasUsableEarningsInput(automatic)
    ? {
        ...automatic,
        source: automatic?.source && automatic.source !== "none" ? automatic.source : "kis",
      }
    : hasUsableEarningsInput(manual)
      ? {
          ...manual,
          source: "manual" as const,
        }
      : null;

  if (!selected) {
    return makeEmptyEarningsGrowth();
  }

  const netIncomeGrowthRate = calculateGrowthRate(
    selected.lastYearNetIncome,
    selected.expectedNetIncome,
  );
  const operatingProfitGrowthRate = calculateGrowthRate(
    selected.lastYearOperatingProfit,
    selected.expectedOperatingProfit,
  );
  const epsGrowthRate = calculateGrowthRate(selected.lastYearEps, selected.expectedEps);

  const turnaround =
    selected.turnaround ??
    Boolean(
      ((selected.lastYearNetIncome ?? 0) < 0 && (selected.expectedNetIncome ?? 0) > 0) ||
        ((selected.lastYearOperatingProfit ?? 0) < 0 &&
          (selected.expectedOperatingProfit ?? 0) > 0),
    );

  const deficitReduction =
    selected.deficitReduction ??
    Boolean(
      !turnaround &&
        (((selected.lastYearNetIncome ?? 0) < 0 &&
          (selected.expectedNetIncome ?? 0) < 0 &&
          Math.abs(selected.expectedNetIncome ?? 0) <
            Math.abs(selected.lastYearNetIncome ?? 0)) ||
          ((selected.lastYearOperatingProfit ?? 0) < 0 &&
            (selected.expectedOperatingProfit ?? 0) < 0 &&
            Math.abs(selected.expectedOperatingProfit ?? 0) <
              Math.abs(selected.lastYearOperatingProfit ?? 0))),
    );

  const scoreResult = scoreEarningsGrowth({
    netIncomeGrowthRate,
    operatingProfitGrowthRate,
    epsGrowthRate,
    turnaround,
    deficitReduction,
  });

  return {
    available: true,
    source: selected.source ?? "manual",
    updatedAt: selected.updatedAt ?? new Date().toISOString(),

    lastYearNetIncome: normalizeNullableNumber(selected.lastYearNetIncome),
    expectedNetIncome: normalizeNullableNumber(selected.expectedNetIncome),
    netIncomeGrowthRate,

    lastYearOperatingProfit: normalizeNullableNumber(selected.lastYearOperatingProfit),
    expectedOperatingProfit: normalizeNullableNumber(selected.expectedOperatingProfit),
    operatingProfitGrowthRate,

    lastYearEps: normalizeNullableNumber(selected.lastYearEps),
    expectedEps: normalizeNullableNumber(selected.expectedEps),
    epsGrowthRate,

    turnaround,
    deficitReduction,

    score: scoreResult.score,
    label: scoreResult.label,
    reasons: scoreResult.reasons,
  };
}

export function makeEmptyEarningsGrowth(): EarningsGrowthData {
  return {
    available: false,
    source: "none",
    updatedAt: null,
    warning: "예상 실적 데이터 연결 전입니다.",

    lastYearNetIncome: null,
    expectedNetIncome: null,
    netIncomeGrowthRate: null,

    lastYearOperatingProfit: null,
    expectedOperatingProfit: null,
    operatingProfitGrowthRate: null,

    lastYearEps: null,
    expectedEps: null,
    epsGrowthRate: null,

    turnaround: null,
    deficitReduction: null,

    score: null,
    label: "데이터 대기",
    reasons: [
      "자동 실적 데이터가 없고 수동 입력값도 없어 실적 성장 점수를 계산하지 않았습니다.",
    ],
  };
}

export function hasUsableEarningsInput(input?: EarningsGrowthInput | null) {
  if (!input) return false;

  return [
    input.lastYearNetIncome,
    input.expectedNetIncome,
    input.lastYearOperatingProfit,
    input.expectedOperatingProfit,
    input.lastYearEps,
    input.expectedEps,
  ].some((value) => value != null && Number.isFinite(Number(value)));
}

export function parseManualEarningsGrowthFromSearchParams(
  searchParams: URLSearchParams,
): EarningsGrowthInput | null {
  const manual: EarningsGrowthInput = {
    source: "manual",
    updatedAt: new Date().toISOString(),
    lastYearNetIncome: readNumber(searchParams, "lastYearNetIncome"),
    expectedNetIncome: readNumber(searchParams, "expectedNetIncome"),
    lastYearOperatingProfit: readNumber(searchParams, "lastYearOperatingProfit"),
    expectedOperatingProfit: readNumber(searchParams, "expectedOperatingProfit"),
    lastYearEps: readNumber(searchParams, "lastYearEps"),
    expectedEps: readNumber(searchParams, "expectedEps"),
    turnaround: readBoolean(searchParams, "turnaround"),
    deficitReduction: readBoolean(searchParams, "deficitReduction"),
  };

  return hasUsableEarningsInput(manual) ||
    manual.turnaround != null ||
    manual.deficitReduction != null
    ? manual
    : null;
}

function scoreEarningsGrowth({
  netIncomeGrowthRate,
  operatingProfitGrowthRate,
  epsGrowthRate,
  turnaround,
  deficitReduction,
}: {
  netIncomeGrowthRate: number | null;
  operatingProfitGrowthRate: number | null;
  epsGrowthRate: number | null;
  turnaround: boolean | null;
  deficitReduction: boolean | null;
}) {
  let score = 0;
  const reasons: string[] = [];

  if (netIncomeGrowthRate != null) {
    if (netIncomeGrowthRate >= 50) {
      score += 35;
      reasons.push("예상 순이익 증가율이 50% 이상으로 강합니다.");
    } else if (netIncomeGrowthRate >= 30) {
      score += 28;
      reasons.push("예상 순이익 증가율이 30% 이상입니다.");
    } else if (netIncomeGrowthRate >= 10) {
      score += 20;
      reasons.push("예상 순이익 증가율이 10% 이상입니다.");
    } else if (netIncomeGrowthRate > 0) {
      score += 10;
      reasons.push("예상 순이익이 소폭 증가할 전망입니다.");
    } else {
      reasons.push("예상 순이익 증가율이 양수가 아닙니다.");
    }
  } else {
    reasons.push("예상 순이익 증가율 데이터가 없습니다.");
  }

  if (operatingProfitGrowthRate != null) {
    if (operatingProfitGrowthRate >= 30) {
      score += 25;
      reasons.push("예상 영업이익 증가율이 30% 이상입니다.");
    } else if (operatingProfitGrowthRate >= 10) {
      score += 18;
      reasons.push("예상 영업이익 증가율이 10% 이상입니다.");
    } else if (operatingProfitGrowthRate > 0) {
      score += 9;
      reasons.push("예상 영업이익이 소폭 증가할 전망입니다.");
    } else {
      reasons.push("예상 영업이익 증가율이 양수가 아닙니다.");
    }
  } else {
    reasons.push("예상 영업이익 증가율 데이터가 없습니다.");
  }

  if (epsGrowthRate != null) {
    if (epsGrowthRate >= 25) {
      score += 25;
      reasons.push("예상 EPS 증가율이 25% 이상입니다.");
    } else if (epsGrowthRate >= 10) {
      score += 18;
      reasons.push("예상 EPS 증가율이 10% 이상입니다.");
    } else if (epsGrowthRate > 0) {
      score += 8;
      reasons.push("예상 EPS가 소폭 증가할 전망입니다.");
    } else {
      reasons.push("예상 EPS 증가율이 양수가 아닙니다.");
    }
  } else {
    reasons.push("예상 EPS 증가율 데이터가 없습니다.");
  }

  if (turnaround) {
    score += 15;
    reasons.push("흑자 전환 기대가 반영됐습니다.");
  } else if (deficitReduction) {
    score += 8;
    reasons.push("적자 축소 기대가 반영됐습니다.");
  }

  const finalScore = clampScore(score);

  return {
    score: finalScore,
    label: getLabel(finalScore),
    reasons,
  };
}

function calculateGrowthRate(previous?: number | null, expected?: number | null) {
  const prev = normalizeNullableNumber(previous);
  const next = normalizeNullableNumber(expected);

  if (prev == null || next == null || prev === 0) return null;

  return ((next - prev) / Math.abs(prev)) * 100;
}

function normalizeNullableNumber(value?: number | null) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readNumber(searchParams: URLSearchParams, key: string) {
  const raw = searchParams.get(key);

  if (raw == null || raw.trim() === "") return null;

  const parsed = Number(raw.replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function readBoolean(searchParams: URLSearchParams, key: string) {
  const raw = searchParams.get(key);

  if (raw == null || raw.trim() === "") return null;

  if (raw === "true") return true;
  if (raw === "false") return false;

  return null;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getLabel(score: number) {
  if (score >= 80) return "강함";
  if (score >= 65) return "긍정";
  if (score >= 50) return "중립";
  if (score >= 35) return "약함";
  return "주의";
}

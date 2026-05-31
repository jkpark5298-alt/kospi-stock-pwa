"use client";

import { useEffect, useMemo, useState } from "react";

type FundamentalsResponse = {
  ok: boolean;
  message?: string;
  source?: string;
  inputSymbol?: string;
  normalizedCode?: string;
  data?: {
    marketCap?: number | null;
    per?: number | null;
    pbr?: number | null;
    eps?: number | null;
    bps?: number | null;
    dividendYield?: number | null;
    foreignOwnershipRate?: number | null;
    sharesOutstanding?: number | null;
    high52w?: number | null;
    low52w?: number | null;
  };
  error?: string;
};

type SupplySummary = {
  individualNetBuy: number;
  foreignNetBuy: number;
  institutionNetBuy: number;
  smartMoneyNetBuy: number;
};

type SupplyResponse = {
  ok: boolean;
  message?: string;
  inputSymbol?: string;
  normalizedCode?: string;
  supply?: {
    code?: string;
    rowCount?: number;
    recent5?: SupplySummary;
    recent20?: SupplySummary;
    foreignPositiveStreak5?: boolean;
    institutionPositiveStreak5?: boolean;
    smartMoneyPositiveStreak5?: boolean;
    latestRows?: Array<Record<string, unknown>>;
  };
  error?: string;
};

type CachedValue<T> = {
  savedAt: string;
  data: T;
};

type EvaluationTone = "positive" | "negative" | "neutral";

type EvaluationResult = {
  label: string;
  scoreText: string;
  tone: EvaluationTone;
  reasons: string[];
};

type Props = {
  symbol?: string | null;
  name?: string | null;
};

const FUNDAMENTALS_CACHE_PREFIX = "kospi-kis-fundamentals";
const SUPPLY_CACHE_PREFIX = "kospi-kis-supply";
const KIS_CACHE_TTL_MS = 10 * 60 * 1000;

export default function KisFundamentalsSection({ symbol, name }: Props) {
  const [fundamentals, setFundamentals] =
    useState<FundamentalsResponse | null>(null);
  const [supply, setSupply] = useState<SupplyResponse | null>(null);
  const [fundamentalsCachedAt, setFundamentalsCachedAt] = useState<string | null>(
    null,
  );
  const [supplyCachedAt, setSupplyCachedAt] = useState<string | null>(null);
  const [isFundamentalsLoading, setIsFundamentalsLoading] = useState(false);
  const [isSupplyLoading, setIsSupplyLoading] = useState(false);
  const [isFinancialOpen, setIsFinancialOpen] = useState(true);
  const [isSupplyOpen, setIsSupplyOpen] = useState(true);

  const fundamentalsCacheKey = useMemo(
    () => makeCacheKey(FUNDAMENTALS_CACHE_PREFIX, symbol),
    [symbol],
  );
  const supplyCacheKey = useMemo(
    () => makeCacheKey(SUPPLY_CACHE_PREFIX, symbol),
    [symbol],
  );

  useEffect(() => {
    if (!symbol) {
      setFundamentals(null);
      setSupply(null);
      setFundamentalsCachedAt(null);
      setSupplyCachedAt(null);
      return;
    }

    const cachedFundamentals =
      readCache<FundamentalsResponse>(fundamentalsCacheKey);
    const cachedSupply = readCache<SupplyResponse>(supplyCacheKey);

    if (cachedFundamentals) {
      setFundamentals(cachedFundamentals.data);
      setFundamentalsCachedAt(cachedFundamentals.savedAt);
    } else {
      setFundamentals(null);
      setFundamentalsCachedAt(null);
    }

    if (cachedSupply) {
      setSupply(cachedSupply.data);
      setSupplyCachedAt(cachedSupply.savedAt);
    } else {
      refreshSupply();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundamentalsCacheKey, supplyCacheKey, symbol]);

  async function refreshAll() {
    await refreshSupply();
  }

  async function refreshFundamentals() {
    setFundamentals(null);
    setFundamentalsCachedAt(null);
    setIsFundamentalsLoading(false);
  }

  async function refreshSupply() {
    if (!symbol) return;

    setIsSupplyLoading(true);

    try {
      const response = await fetch(
        `/api/kis/supply?symbol=${encodeURIComponent(symbol)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as SupplyResponse;

      setSupply(payload);

      if (payload.ok) {
        const savedAt = new Date().toISOString();
        setSupplyCachedAt(savedAt);
        writeCache(supplyCacheKey, { savedAt, data: payload });
      } else {
        setSupplyCachedAt(null);
        removeCache(supplyCacheKey);
      }
    } catch (error) {
      setSupply({
        ok: false,
        message: "한투 수급 데이터를 불러오지 못했습니다.",
        error: error instanceof Error ? error.message : String(error),
      });
      setSupplyCachedAt(null);
      removeCache(supplyCacheKey);
    } finally {
      setIsSupplyLoading(false);
    }
  }

  function clearKisCache() {
    removeCache(fundamentalsCacheKey);
    removeCache(supplyCacheKey);
    setFundamentalsCachedAt(null);
    setSupplyCachedAt(null);
  }

  const financialData = fundamentals?.data;
  const supplyData = supply?.supply;
  const financialEvaluation = evaluateFinancials(financialData);
  const supplyEvaluation = evaluateSupply(supplyData);
  const isLoading = isFundamentalsLoading || isSupplyLoading;
  const statusLabel =
    fundamentals?.ok || supply?.ok
      ? "KIS 연결"
      : isLoading
        ? "KIS 조회 중"
        : "KIS 대기";

  return (
    <section className="target-section">
      <div className="card">
        <div className="target-header">
          <div>
            <h3 className="section-title small">한투 데이터 자동 확인</h3>
            <p className="target-subtitle">
              한투 KIS에서 재무·밸류에이션과 수급·거래 데이터를 함께 확인합니다.
              저장된 성공 응답이 있으면 먼저 보여주고, 다시 조회 버튼을 눌렀을
              때만 KIS를 새로 호출합니다.
            </p>
          </div>
          <div
            className={`target-badge ${
              fundamentals?.ok || supply?.ok ? "available" : "unavailable"
            }`}
          >
            {statusLabel}
          </div>
        </div>

        <div className="target-basis-box">
          <div className="target-basis-header">
            <span>조회 대상</span>
            <strong>{name || symbol || "종목 선택 전"}</strong>
          </div>
          <p className="target-basis-summary">
            재무: {getStatusText(fundamentals, isFundamentalsLoading)} · 저장{" "}
            {fundamentalsCachedAt ? formatDateTime(fundamentalsCachedAt) : "없음"}
            <br />
            수급: {getStatusText(supply, isSupplyLoading)} · 저장{" "}
            {supplyCachedAt ? formatDateTime(supplyCachedAt) : "없음"}
          </p>
          <div className="target-basis-adjustments">
            <p>
              이 섹션은 기존 종목 기본 정보와 수급·거래 신뢰도 분석을 통합한
              한투 데이터 확인 화면입니다.
            </p>
            <p>
              성공한 응답만 임시저장하고 실패 응답은 저장하지 않아, 토큰 제한이나
              일시 오류가 다음 조회에 남지 않도록 합니다.
            </p>
          </div>
        </div>

        <div className="target-grid" style={{ marginTop: 16 }}>
          <EvaluationCard
            title="재무·밸류에이션 평가"
            evaluation={financialEvaluation}
          />
          <EvaluationCard title="수급·거래 평가" evaluation={supplyEvaluation} />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <button
            className="button secondary-button"
            type="button"
            onClick={refreshAll}
            disabled={!symbol || isLoading}
          >
            {isLoading ? "KIS 다시 조회 중" : "KIS 다시 조회"}
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={clearKisCache}
            disabled={!fundamentalsCachedAt && !supplyCachedAt}
          >
            임시저장 삭제
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={() => setIsFinancialOpen((value) => !value)}
          >
            {isFinancialOpen ? "재무 닫기" : "재무 보기"}
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={() => setIsSupplyOpen((value) => !value)}
          >
            {isSupplyOpen ? "수급 닫기" : "수급 보기"}
          </button>
        </div>

        {isFinancialOpen ? (
          <>
            <h4 className="section-title small" style={{ marginTop: 18 }}>
              재무·밸류에이션
            </h4>
            <div className="target-grid">
              <MetricCard title="시가총액" value={formatMarketCap(financialData?.marketCap)} subText="규모 참고" />
              <MetricCard title="상장주식수" value={formatShares(financialData?.sharesOutstanding)} subText="유통 규모 참고" />
              <MetricCard title="PER" value={formatRatio(financialData?.per)} subText="주가수익비율" />
              <MetricCard title="PBR" value={formatRatio(financialData?.pbr)} subText="주가순자산비율" />
              <MetricCard title="EPS" value={formatNumber(financialData?.eps)} subText="주당순이익" />
              <MetricCard title="BPS" value={formatNumber(financialData?.bps)} subText="주당순자산" />
              <MetricCard title="배당수익률" value={formatPercent(financialData?.dividendYield)} subText="배당 참고" />
              <MetricCard title="외국인보유율" value={formatPercent(financialData?.foreignOwnershipRate)} subText="수급 참고" />
              <MetricCard title="52주 고가" value={formatNumber(financialData?.high52w)} subText="상단 위험 참고" />
              <MetricCard title="52주 저가" value={formatNumber(financialData?.low52w)} subText="하단 위험 참고" />
            </div>
          </>
        ) : null}

        {isSupplyOpen ? (
          <>
            <h4 className="section-title small" style={{ marginTop: 18 }}>
              수급·거래
            </h4>
            <div className="target-grid">
              <MetricCard
                title="외국인 5일"
                value={formatSignedNumber(supplyData?.recent5?.foreignNetBuy)}
                subText="최근 5거래일 순매수"
              />
              <MetricCard
                title="기관 5일"
                value={formatSignedNumber(supplyData?.recent5?.institutionNetBuy)}
                subText="최근 5거래일 순매수"
              />
              <MetricCard
                title="외인+기관 5일"
                value={formatSignedNumber(supplyData?.recent5?.smartMoneyNetBuy)}
                subText="스마트머니 합산"
              />
              <MetricCard
                title="외인+기관 20일"
                value={formatSignedNumber(supplyData?.recent20?.smartMoneyNetBuy)}
                subText="중기 수급 참고"
              />
              <MetricCard
                title="외국인 연속"
                value={formatBoolean(supplyData?.foreignPositiveStreak5)}
                subText="5일 연속 순매수"
              />
              <MetricCard
                title="기관 연속"
                value={formatBoolean(supplyData?.institutionPositiveStreak5)}
                subText="5일 연속 순매수"
              />
            </div>
            {supply?.ok ? null : (
              <p className="notice-text">
                {supply?.error
                  ? `수급 데이터 조회 실패: ${supply.error}`
                  : "수급 데이터는 KIS 다시 조회 후 표시됩니다."}
              </p>
            )}
          </>
        ) : null}

        <p className="notice-text">
          한투 데이터는 추정 주가 판단 보조 데이터입니다. 다음 단계에서 실적 성장
          점수, 밸류에이션 추정 주가, 추정 주가 신뢰도에 자동 반영합니다.
        </p>
      </div>
    </section>
  );
}

function EvaluationCard({
  title,
  evaluation,
}: {
  title: string;
  evaluation: EvaluationResult;
}) {
  return (
    <div className="target-metric-card">
      <span>{title}</span>
      <strong className={evaluation.tone}>{evaluation.scoreText}</strong>
      <em className={evaluation.tone}>{evaluation.label}</em>
      <div style={{ marginTop: 10 }}>
        {evaluation.reasons.map((reason) => (
          <p key={reason} className="notice-text" style={{ margin: "4px 0" }}>
            {reason}
          </p>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
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
      <strong className="neutral" style={{ wordBreak: "keep-all", overflowWrap: "anywhere" }}>
        {value}
      </strong>
      <em className="neutral">{subText}</em>
    </div>
  );
}

function evaluateFinancials(
  data?: FundamentalsResponse["data"],
): EvaluationResult {
  if (!data) {
    return {
      label: "데이터 확인 필요",
      scoreText: "대기",
      tone: "neutral",
      reasons: ["KIS 다시 조회 후 재무·밸류에이션 평가를 표시합니다."],
    };
  }

  let score = 50;
  const reasons: string[] = [];

  if (data.eps != null && data.eps > 0) {
    score += 15;
    reasons.push("EPS가 양수라 이익 기반 밸류에이션 평가가 가능합니다.");
  } else if (data.eps != null && data.eps <= 0) {
    score -= 15;
    reasons.push("EPS가 0 이하라 이익 기반 평가는 보수적으로 봅니다.");
  } else {
    reasons.push("EPS 데이터가 없어 이익 기반 평가는 제한됩니다.");
  }

  if (data.per != null) {
    if (data.per > 0 && data.per <= 15) {
      score += 12;
      reasons.push("PER이 낮은 편이라 밸류에이션 부담은 제한적으로 봅니다.");
    } else if (data.per <= 30) {
      score += 3;
      reasons.push("PER은 중립 구간으로 판단합니다.");
    } else {
      score -= 8;
      reasons.push("PER이 높은 편이라 밸류에이션 부담을 확인해야 합니다.");
    }
  }

  if (data.pbr != null) {
    if (data.pbr > 0 && data.pbr <= 1.5) {
      score += 10;
      reasons.push("PBR이 낮은 편이라 자산가치 대비 부담은 제한적으로 봅니다.");
    } else if (data.pbr <= 4) {
      score += 2;
      reasons.push("PBR은 중립 구간으로 판단합니다.");
    } else {
      score -= 8;
      reasons.push("PBR이 높은 편이라 주가순자산 부담을 확인해야 합니다.");
    }
  }

  if (data.foreignOwnershipRate != null) {
    if (data.foreignOwnershipRate >= 40) {
      score += 6;
      reasons.push("외국인보유율이 높은 편이라 수급 참고값은 긍정적으로 봅니다.");
    } else if (data.foreignOwnershipRate < 10) {
      score -= 3;
      reasons.push("외국인보유율이 낮아 외국인 수급 확인이 필요합니다.");
    }
  }

  if (data.high52w != null && data.low52w != null && data.high52w > data.low52w) {
    reasons.push("52주 고가·저가는 위험 기준선과 가격 위치 판단에 활용합니다.");
  }

  const normalizedScore = clamp(score, 0, 100);

  return {
    label: getEvaluationLabel(normalizedScore),
    scoreText: `${normalizedScore} / 100`,
    tone: getEvaluationTone(normalizedScore),
    reasons: reasons.length > 0 ? reasons : ["재무 데이터는 확인됐지만 평가 근거가 부족합니다."],
  };
}

function evaluateSupply(data?: SupplyResponse["supply"]): EvaluationResult {
  if (!data) {
    return {
      label: "데이터 확인 필요",
      scoreText: "대기",
      tone: "neutral",
      reasons: ["KIS 다시 조회 후 수급·거래 평가를 표시합니다."],
    };
  }

  let score = 50;
  const reasons: string[] = [];
  const recent5SmartMoney = data.recent5?.smartMoneyNetBuy;
  const recent20SmartMoney = data.recent20?.smartMoneyNetBuy;

  if (recent5SmartMoney != null) {
    if (recent5SmartMoney > 0) {
      score += 15;
      reasons.push("최근 5거래일 외국인+기관 합산 수급이 순매수입니다.");
    } else if (recent5SmartMoney < 0) {
      score -= 15;
      reasons.push("최근 5거래일 외국인+기관 합산 수급이 순매도입니다.");
    }
  }

  if (recent20SmartMoney != null) {
    if (recent20SmartMoney > 0) {
      score += 10;
      reasons.push("최근 20거래일 중기 수급이 순매수 방향입니다.");
    } else if (recent20SmartMoney < 0) {
      score -= 10;
      reasons.push("최근 20거래일 중기 수급이 순매도 방향입니다.");
    }
  }

  if (data.foreignPositiveStreak5) {
    score += 8;
    reasons.push("외국인이 5일 연속 순매수 흐름입니다.");
  }

  if (data.institutionPositiveStreak5) {
    score += 8;
    reasons.push("기관이 5일 연속 순매수 흐름입니다.");
  }

  if (data.smartMoneyPositiveStreak5) {
    score += 6;
    reasons.push("외국인+기관 동반 수급 흐름이 긍정적입니다.");
  }

  if (data.rowCount != null && data.rowCount < 5) {
    score -= 8;
    reasons.push("수급 표본이 적어 판정 신뢰도는 낮게 봅니다.");
  }

  const normalizedScore = clamp(score, 0, 100);

  return {
    label: getEvaluationLabel(normalizedScore),
    scoreText: `${normalizedScore} / 100`,
    tone: getEvaluationTone(normalizedScore),
    reasons: reasons.length > 0 ? reasons : ["수급 데이터는 확인됐지만 방향성 판단 근거가 부족합니다."],
  };
}

function getEvaluationLabel(score: number) {
  if (score >= 75) return "긍정";
  if (score >= 60) return "보통 이상";
  if (score >= 45) return "중립";
  if (score >= 30) return "주의";
  return "약함";
}

function getEvaluationTone(score: number): EvaluationTone {
  if (score >= 60) return "positive";
  if (score < 45) return "negative";
  return "neutral";
}

function makeCacheKey(prefix: string, symbol?: string | null) {
  return `${prefix}:${(symbol || "").trim().toUpperCase()}`;
}

function readCache<T>(key: string): CachedValue<T> | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedValue<T>;

    if (!parsed?.savedAt || !parsed?.data) return null;

    const age = Date.now() - new Date(parsed.savedAt).getTime();

    if (Number.isFinite(age) && age > KIS_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: CachedValue<T>) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 임시저장 실패 시에도 화면 표시는 유지합니다.
  }
}

function removeCache(key: string) {
  if (!key || typeof window === "undefined") return;

  window.localStorage.removeItem(key);
}

function getStatusText(
  data: { ok: boolean; message?: string; error?: string } | null,
  isLoading: boolean,
) {
  if (isLoading) return "조회 중";
  if (!data) return "조회 전";
  if (data.ok) return data.message || "조회 성공";

  return data.error || data.message || "조회 실패";
}

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
}

function formatMarketCap(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const abs = Math.abs(value);

  if (abs >= 1_0000_0000_0000) {
    return `${formatCompactNumber(value / 1_0000_0000_0000)}조`;
  }

  if (abs >= 1_0000_0000) {
    return `${formatCompactNumber(value / 1_0000_0000)}억`;
  }

  return formatNumber(value);
}

function formatShares(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const abs = Math.abs(value);

  if (abs >= 1_0000_0000) {
    return `${formatCompactNumber(value / 1_0000_0000)}억주`;
  }

  if (abs >= 1_0000) {
    return `${formatCompactNumber(value / 1_0000)}만주`;
  }

  return `${formatNumber(value)}주`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function formatSignedNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const formatted = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(Math.abs(value));

  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;

  return "0";
}

function formatRatio(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return value.toFixed(2);
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${value.toFixed(2)}%`;
}

function formatBoolean(value?: boolean | null) {
  if (value == null) return "확인 필요";

  return value ? "예" : "아니오";
}

function formatDateTime(value?: string | null) {
  if (!value) return "저장 전";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value), min), max);
}

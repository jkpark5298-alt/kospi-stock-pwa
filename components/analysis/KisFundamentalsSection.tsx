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
      refreshFundamentals();
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
    await refreshFundamentals();
    await refreshSupply();
  }

  async function refreshFundamentals() {
    if (!symbol) return;

    setIsFundamentalsLoading(true);

    try {
      const response = await fetch(
        `/api/kis/fundamentals?symbol=${encodeURIComponent(symbol)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as FundamentalsResponse;

      setFundamentals(payload);

      if (payload.ok) {
        const savedAt = new Date().toISOString();
        setFundamentalsCachedAt(savedAt);
        writeCache(fundamentalsCacheKey, { savedAt, data: payload });
      } else {
        setFundamentalsCachedAt(null);
        removeCache(fundamentalsCacheKey);
      }
    } catch (error) {
      setFundamentals({
        ok: false,
        message: "한투 재무·밸류에이션 데이터를 불러오지 못했습니다.",
        error: error instanceof Error ? error.message : String(error),
      });
      setFundamentalsCachedAt(null);
      removeCache(fundamentalsCacheKey);
    } finally {
      setIsFundamentalsLoading(false);
    }
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

  const data = fundamentals?.data;
  const supplyData = supply?.supply;
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
              <MetricCard title="시가총액" value={formatNumber(data?.marketCap)} subText="규모 참고" />
              <MetricCard title="상장주식수" value={formatNumber(data?.sharesOutstanding)} subText="유통 규모 참고" />
              <MetricCard title="PER" value={formatRatio(data?.per)} subText="주가수익비율" />
              <MetricCard title="PBR" value={formatRatio(data?.pbr)} subText="주가순자산비율" />
              <MetricCard title="EPS" value={formatNumber(data?.eps)} subText="주당순이익" />
              <MetricCard title="BPS" value={formatNumber(data?.bps)} subText="주당순자산" />
              <MetricCard title="배당수익률" value={formatPercent(data?.dividendYield)} subText="배당 참고" />
              <MetricCard title="외국인보유율" value={formatPercent(data?.foreignOwnershipRate)} subText="수급 참고" />
              <MetricCard title="52주 고가" value={formatNumber(data?.high52w)} subText="상단 위험 참고" />
              <MetricCard title="52주 저가" value={formatNumber(data?.low52w)} subText="하단 위험 참고" />
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
      <strong className="neutral">{value}</strong>
      <em className="neutral">{subText}</em>
    </div>
  );
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

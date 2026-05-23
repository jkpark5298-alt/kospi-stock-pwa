"use client";

import { useEffect, useMemo, useState } from "react";

type FundamentalsPayload = {
  ok: boolean;
  message?: string;
  normalizedCode?: string;
  data?: FundamentalsData;
  error?: string;
};

type FundamentalsData = {
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

type Props = {
  symbol?: string | null;
  name?: string | null;
  valuationTarget?: number | null;
  lastFetchedAt?: string | null;
  data?: {
    symbol?: string | null;
    name?: string | null;
    fundamentals?: FundamentalsData | null;
    score?: {
      targetPrice?: {
        valuationTargetRange?: {
          epsTarget?: number | null;
          bpsTarget?: number | null;
          valuationTarget?: number | null;
        } | null;
      };
    };
  } | null;
};

const FUNDAMENTALS_CACHE_PREFIX = "kospi-kis-fundamentals";
const KIS_CACHE_TTL_MS = 10 * 60 * 1000;

export default function FundamentalSnapshotSection({
  symbol,
  name,
  valuationTarget,
  lastFetchedAt,
  data,
}: Props) {
  const resolvedSymbol = symbol ?? data?.symbol ?? null;
  const resolvedName = name ?? data?.name ?? null;
  const fallbackFundamentals = data?.fundamentals ?? null;
  const resolvedValuationTarget =
    valuationTarget ??
    data?.score?.targetPrice?.valuationTargetRange?.valuationTarget ??
    null;
  const cacheKey = useMemo(
    () => makeCacheKey(FUNDAMENTALS_CACHE_PREFIX, resolvedSymbol),
    [resolvedSymbol],
  );

  const [payload, setPayload] = useState<FundamentalsPayload | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!resolvedSymbol) {
      setPayload(null);
      setCachedAt(null);
      return;
    }

    const cached = readCache<FundamentalsPayload>(cacheKey);

    if (cached) {
      setPayload(cached.data);
      setCachedAt(cached.savedAt);
      return;
    }

    if (fallbackFundamentals && isUsableFundamentals(fallbackFundamentals)) {
      setPayload({
        ok: true,
        message: "분석하기 자동 조회 결과",
        data: fallbackFundamentals,
      });
      setCachedAt(lastFetchedAt ?? null);
      return;
    }

    refreshFundamentals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, resolvedSymbol, lastFetchedAt]);

  useEffect(() => {
    if (!fallbackFundamentals || !isUsableFundamentals(fallbackFundamentals)) {
      return;
    }

    setPayload((prev) => {
      if (prev?.ok && isUsableFundamentals(prev.data)) return prev;

      return {
        ok: true,
        message: "분석하기 자동 조회 결과",
        data: fallbackFundamentals,
      };
    });

    if (lastFetchedAt) {
      setCachedAt(lastFetchedAt);
    }
  }, [fallbackFundamentals, lastFetchedAt]);

  const fundamentals = payload?.data ?? fallbackFundamentals ?? null;
  const statusText = payload?.ok
    ? "KIS 데이터"
    : fundamentals && isUsableFundamentals(fundamentals)
      ? "분석 데이터"
      : isLoading
        ? "조회 중"
        : "데이터 대기";
  const dataSourceText = payload?.ok
    ? "한투 핵심 자동 조회 반영"
    : fundamentals && isUsableFundamentals(fundamentals)
      ? "기본 분석값 반영"
      : "한투 재조회 대기";

  async function refreshFundamentals() {
    if (!resolvedSymbol) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/kis/fundamentals?symbol=${encodeURIComponent(resolvedSymbol)}`,
        { cache: "no-store" },
      );
      const nextPayload = (await response.json()) as FundamentalsPayload;

      setPayload(nextPayload);

      if (nextPayload.ok && isUsableFundamentals(nextPayload.data)) {
        const savedAt = new Date().toISOString();
        setCachedAt(savedAt);
        writeCache(cacheKey, { savedAt, data: nextPayload });
      } else {
        setCachedAt(null);
        removeCache(cacheKey);
      }
    } catch (error) {
      setPayload({
        ok: false,
        message: "한투 재무·밸류에이션 데이터를 불러오지 못했습니다.",
        error: error instanceof Error ? error.message : String(error),
      });
      setCachedAt(null);
      removeCache(cacheKey);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>한투 실적·밸류 핵심 요약</span>
          <strong>{formatNumber(resolvedValuationTarget)}</strong>
        </div>

        <p className="target-basis-summary">
          분석하기를 누르면 한투 핵심 재조회가 자동으로 실행되고, 조회된
          EPS·BPS·PER·PBR·시가총액 등을 이 영역에 반영합니다. 실적·밸류
          기준가는 확인 가능한 산정값이 있으면 유지하고, 세부 재무 데이터는
          자동 조회 결과를 우선 표시합니다.
        </p>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>데이터 상태</span>
            <strong>{statusText}</strong>
          </div>
          <p className="target-basis-summary">
            종목: {resolvedName || resolvedSymbol || "데이터 없음"} · 저장 시각:{" "}
            {cachedAt ? formatDateTime(cachedAt) : "없음"} · {dataSourceText}
          </p>
          <div style={{ marginTop: 12 }}>
            <button
              className="button secondary-button"
              type="button"
              onClick={refreshFundamentals}
              disabled={!resolvedSymbol || isLoading}
            >
              {isLoading ? "조회 중" : "한투 핵심 재조회"}
            </button>
          </div>
        </div>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <SnapshotCard
            title="시가총액"
            value={formatMarketCap(fundamentals?.marketCap)}
            subText="기업 규모"
          />
          <SnapshotCard
            title="PER"
            value={formatRatio(fundamentals?.per)}
            subText="이익 대비 부담"
          />
          <SnapshotCard
            title="PBR"
            value={formatRatio(fundamentals?.pbr)}
            subText="자산 대비 부담"
          />
          <SnapshotCard
            title="EPS"
            value={formatNumber(fundamentals?.eps)}
            subText="이익가치 기준"
          />
          <SnapshotCard
            title="BPS"
            value={formatNumber(fundamentals?.bps)}
            subText="자산가치 기준"
          />
          <SnapshotCard
            title="배당수익률"
            value={formatPercent(fundamentals?.dividendYield)}
            subText="배당 참고"
          />
        </div>

        {payload && !payload.ok ? (
          <p className="notice-text" style={{ marginTop: 12 }}>
            {payload.message ||
              payload.error ||
              "한투 데이터를 확인하지 못했습니다. 기존 산정값이 있으면 B 기준가는 유지됩니다."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SnapshotCard({
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

function makeCacheKey(prefix: string, symbol?: string | null) {
  return `${prefix}:${(symbol || "").trim().toUpperCase()}`;
}

function readCache<T>(key: string): { savedAt: string; data: T } | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as { savedAt: string; data: T };
    const savedAt = new Date(parsed.savedAt).getTime();

    if (!Number.isFinite(savedAt) || Date.now() - savedAt > KIS_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: { savedAt: string; data: T }) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage 저장이 실패해도 화면 표시는 계속 진행합니다.
  }
}

function removeCache(key: string) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // localStorage 삭제 실패는 조용히 무시합니다.
  }
}

function isUsableFundamentals(value?: FundamentalsData | null) {
  if (!value) return false;

  return [value.per, value.pbr, value.eps, value.bps].some(
    (item) => typeof item === "number" && Number.isFinite(item) && item > 0,
  );
}

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatMarketCap(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  if (value >= 1_0000_0000_0000) {
    return `${(value / 1_0000_0000_0000).toFixed(2)}조`;
  }

  if (value >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(2)}억`;
  }

  return formatNumber(value);
}

function formatRatio(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(2)}배`;
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(2)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "없음";

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

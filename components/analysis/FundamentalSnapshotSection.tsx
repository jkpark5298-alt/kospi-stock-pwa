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

export default function FundamentalSnapshotSection({ data }: Props) {
  const symbol = data?.symbol ?? null;
  const fallbackFundamentals = data?.fundamentals ?? null;
  const valuation = data?.score?.targetPrice?.valuationTargetRange ?? null;
  const cacheKey = useMemo(() => makeCacheKey(FUNDAMENTALS_CACHE_PREFIX, symbol), [symbol]);

  const [payload, setPayload] = useState<FundamentalsPayload | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!symbol) {
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

    refreshFundamentals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, symbol]);

  const fundamentals = payload?.data ?? fallbackFundamentals ?? null;
  const statusText = payload?.ok
    ? "KIS 데이터"
    : fundamentals
      ? "기본 데이터"
      : isLoading
        ? "조회 중"
        : "데이터 대기";

  async function refreshFundamentals() {
    if (!symbol) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/kis/fundamentals?symbol=${encodeURIComponent(symbol)}`,
        { cache: "no-store" },
      );
      const nextPayload = (await response.json()) as FundamentalsPayload;

      setPayload(nextPayload);

      if (nextPayload.ok) {
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
        message: "한투 실적·밸류 핵심 데이터를 불러오지 못했습니다.",
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
          <strong>{formatNumber(valuation?.valuationTarget)}</strong>
        </div>

        <p className="target-basis-summary">
          실적·밸류 기준 추정 주가에 직접 필요한 핵심값만 표시합니다. 한투
          재무·밸류 데이터가 있으면 우선 사용하고, 수급은 Detail 4, 위험
          지표는 Detail 5에서 따로 확인합니다.
        </p>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>데이터 상태</span>
            <strong>{statusText}</strong>
          </div>
          <p className="target-basis-summary">
            종목: {data?.name || symbol || "데이터 없음"} · 저장 시각:{" "}
            {cachedAt ? formatDateTime(cachedAt) : "없음"}
          </p>
          <div style={{ marginTop: 12 }}>
            <button
              className="button secondary-button"
              type="button"
              onClick={refreshFundamentals}
              disabled={!symbol || isLoading}
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
            {payload.message || payload.error || "한투 데이터를 확인하지 못했습니다."}
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
    // 캐시 저장 실패는 화면 표시를 막지 않습니다.
  }
}

function removeCache(key: string) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // 캐시 삭제 실패는 화면 표시를 막지 않습니다.
  }
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

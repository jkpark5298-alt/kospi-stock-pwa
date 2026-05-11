"use client";

import { useEffect, useMemo, useState } from "react";

type KisFundamentalsResponse = {
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
  analysisUse?: {
    valuation?: { available: boolean; usage: string };
    risk?: { available: boolean; usage: string };
    supplyReference?: { available: boolean; usage: string };
    incomeReference?: { available: boolean; usage: string };
  };
  error?: string;
};

type CachedKisFundamentals = {
  savedAt: string;
  data: KisFundamentalsResponse;
};

type Props = {
  symbol?: string | null;
  name?: string | null;
};

const KIS_FUNDAMENTALS_CACHE_PREFIX = "kospi-kis-fundamentals";
const KIS_FUNDAMENTALS_CACHE_TTL_MS = 10 * 60 * 1000;

export default function KisFundamentalsSection({ symbol, name }: Props) {
  const [data, setData] = useState<KisFundamentalsResponse | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const cacheKey = useMemo(() => makeKisCacheKey(symbol), [symbol]);

  useEffect(() => {
    if (!symbol) {
      setData(null);
      setCachedAt(null);
      return;
    }

    const cached = readKisCache(cacheKey);

    if (cached) {
      setData(cached.data);
      setCachedAt(cached.savedAt);
      return;
    }

    refreshFundamentals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, symbol]);

  async function refreshFundamentals() {
    if (!symbol) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/kis/fundamentals?symbol=${encodeURIComponent(symbol)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as KisFundamentalsResponse;
      const savedAt = new Date().toISOString();

      setData(payload);
      setCachedAt(savedAt);
      writeKisCache(cacheKey, { savedAt, data: payload });
    } catch (error) {
      setData({
        ok: false,
        message: "한투 재무·밸류에이션 데이터를 불러오지 못했습니다.",
        error: error instanceof Error ? error.message : String(error),
      });
      setCachedAt(null);
    } finally {
      setIsLoading(false);
    }
  }

  const fundamentals = data?.data;

  return (
    <section className="target-section">
      <div className="card">
        <div className="target-header">
          <div>
            <h3 className="section-title small">한투 재무·밸류에이션 확인</h3>
            <p className="target-subtitle">
              한투 KIS에서 PER, PBR, EPS, BPS, 배당수익률, 외국인보유율,
              52주 고저가를 받아 추정 주가 판단 보조 데이터로 확인합니다.
            </p>
          </div>
          <div className={`target-badge ${data?.ok ? "available" : "unavailable"}`}>
            {isLoading ? "KIS 조회 중" : data?.ok ? "KIS 연결" : "KIS 대기"}
          </div>
        </div>

        <div className="target-basis-box">
          <div className="target-basis-header">
            <span>조회 대상</span>
            <strong>{name || symbol || "종목 선택 전"}</strong>
          </div>
          <p className="target-basis-summary">
            출처: 한투 KIS · 상태: {isLoading ? "조회 중" : data?.message || "조회 전"} ·
            임시저장: {cachedAt ? formatDateTime(cachedAt) : "없음"}
          </p>
          <div className="target-basis-adjustments">
            <p>
              이 데이터는 실적 성장 자동화와 추정 주가 신뢰도 계산에 연결하기 위한
              기초 재무·밸류에이션 데이터입니다.
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
            onClick={() => setIsOpen((value) => !value)}
          >
            {isOpen ? "재무 데이터 닫기" : "재무 데이터 보기"}
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={refreshFundamentals}
            disabled={!symbol || isLoading}
          >
            {isLoading ? "다시 조회 중" : "KIS 다시 조회"}
          </button>
        </div>

        {isOpen ? (
          <div className="target-grid" style={{ marginTop: 16 }}>
            <MetricCard title="PER" value={formatRatio(fundamentals?.per)} subText="주가수익비율" />
            <MetricCard title="PBR" value={formatRatio(fundamentals?.pbr)} subText="주가순자산비율" />
            <MetricCard title="EPS" value={formatNumber(fundamentals?.eps)} subText="주당순이익" />
            <MetricCard title="BPS" value={formatNumber(fundamentals?.bps)} subText="주당순자산" />
            <MetricCard
              title="배당수익률"
              value={formatPercent(fundamentals?.dividendYield)}
              subText="배당 참고"
            />
            <MetricCard
              title="외국인보유율"
              value={formatPercent(fundamentals?.foreignOwnershipRate)}
              subText="수급 참고"
            />
            <MetricCard
              title="52주 고가"
              value={formatNumber(fundamentals?.high52w)}
              subText="상단 위험 참고"
            />
            <MetricCard
              title="52주 저가"
              value={formatNumber(fundamentals?.low52w)}
              subText="하단 위험 참고"
            />
          </div>
        ) : null}

        <p className="notice-text">
          이번 단계에서는 한투 재무·밸류에이션 데이터를 화면에 표시합니다. 다음
          단계에서 실적 성장 점수, 밸류에이션 추정 주가, 추정 주가 신뢰도에
          자동 반영합니다.
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

function makeKisCacheKey(symbol?: string | null) {
  return `${KIS_FUNDAMENTALS_CACHE_PREFIX}:${(symbol || "").trim().toUpperCase()}`;
}

function readKisCache(key: string): CachedKisFundamentals | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedKisFundamentals;

    if (!parsed?.savedAt || !parsed?.data) return null;

    const age = Date.now() - new Date(parsed.savedAt).getTime();

    if (Number.isFinite(age) && age > KIS_FUNDAMENTALS_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeKisCache(key: string, value: CachedKisFundamentals) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 임시저장 실패 시에도 화면 표시는 유지합니다.
  }
}

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
}

function formatRatio(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return value.toFixed(2);
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${value.toFixed(2)}%`;
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

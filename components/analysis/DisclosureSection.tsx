"use client";

import { useEffect, useMemo, useState } from "react";

type DisclosureItem = {
  receiptNo: string;
  date: string;
  corpCode: string;
  corpName: string;
  reportName: string;
  corpClass?: string;
  filerName?: string;
  note?: string;
  viewerUrl: string;
};

type DisclosureResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  source?: string;
  stockCode?: string | null;
  corpCode?: string | null;
  corpName?: string | null;
  period?: {
    bgnDe: string;
    endDe: string;
    days: number;
  };
  disclosures: DisclosureItem[];
};

type CachedDisclosure = {
  savedAt: string;
  data: DisclosureResponse;
};

type Props = {
  symbol?: string | null;
  name?: string | null;
};

const DISCLOSURE_CACHE_PREFIX = "kospi-dart-disclosures";
const DISCLOSURE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export default function DisclosureSection({ symbol, name }: Props) {
  const [data, setData] = useState<DisclosureResponse | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const cacheKey = useMemo(() => makeDisclosureCacheKey(symbol), [symbol]);

  useEffect(() => {
    if (!symbol) {
      setData(null);
      setCachedAt(null);
      return;
    }

    const cached = readDisclosureCache(cacheKey);

    if (cached) {
      setData(cached.data);
      setCachedAt(cached.savedAt);
      return;
    }

    refreshDisclosures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, symbol]);

  async function refreshDisclosures() {
    if (!symbol) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/dart/disclosures?symbol=${encodeURIComponent(symbol)}&days=90&pageCount=10`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as DisclosureResponse;
      const savedAt = new Date().toISOString();

      setData(payload);
      setCachedAt(savedAt);
      writeDisclosureCache(cacheKey, { savedAt, data: payload });
    } catch (error) {
      setData({
        ok: false,
        code: "FETCH_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "최근 공시를 불러오지 못했습니다.",
        disclosures: [],
      });
      setCachedAt(null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClearCache() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(cacheKey);
    }

    setData(null);
    setCachedAt(null);
  }

  const cacheStatus = cachedAt
    ? `임시저장 ${formatDateTime(cachedAt)}`
    : "임시저장 없음";

  return (
    <section className="target-section">
      <div className="card">
        <div className="target-header">
          <div>
            <h3 className="section-title small">공시·재무 자동 확인</h3>
            <p className="target-subtitle">
              DART 최근 공시를 임시저장해 보여주고, 다시 조회 버튼을 눌렀을 때만
              DART에서 새로 가져옵니다.
            </p>
          </div>
          <div className={`target-badge ${data?.ok ? "available" : "unavailable"}`}>
            {isLoading ? "공시 조회 중" : data?.ok ? "DART 연결" : "DART 대기"}
          </div>
        </div>

        <div className="target-basis-box">
          <div className="target-basis-header">
            <span>조회 대상</span>
            <strong>{name || data?.corpName || symbol || "종목 선택 전"}</strong>
          </div>
          <p className="target-basis-summary">
            출처: DART OpenAPI · 기간: 최근 {data?.period?.days ?? 90}일 · 상태:{" "}
            {isLoading ? "조회 중" : data?.message || "조회 전"} · {cacheStatus}
          </p>
          <div className="target-basis-adjustments">
            <p>
              공시 데이터는 추정 주가를 직접 계산하는 값이 아니라, 최근 이슈와
              리스크를 확인하기 위한 참고 정보입니다.
            </p>
            <p>
              같은 종목은 저장된 조회 결과를 먼저 보여주며, DART 재조회는
              사용자가 직접 실행할 때만 수행합니다.
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
            {isOpen ? "최근 공시 닫기" : "최근 공시 보기"}
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={refreshDisclosures}
            disabled={!symbol || isLoading}
          >
            {isLoading ? "다시 조회 중" : "DART 다시 조회"}
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={handleClearCache}
            disabled={!cachedAt}
          >
            임시저장 삭제
          </button>
        </div>

        {isOpen ? (
          <DisclosureList
            disclosures={data?.disclosures || []}
            isLoading={isLoading}
            message={data?.message}
          />
        ) : null}

        <p className="notice-text">
          DART 공시는 브라우저에 임시저장됩니다. 저장된 결과가 있으면 화면 조회
          때마다 DART를 다시 호출하지 않고, “DART 다시 조회”를 눌렀을 때 새로
          가져옵니다.
        </p>
      </div>
    </section>
  );
}

function DisclosureList({
  disclosures,
  isLoading,
  message,
}: {
  disclosures: DisclosureItem[];
  isLoading: boolean;
  message?: string;
}) {
  if (isLoading) {
    return (
      <div className="target-basis-box" style={{ marginTop: 12 }}>
        <p className="target-basis-summary">최근 공시를 조회하고 있습니다.</p>
      </div>
    );
  }

  if (disclosures.length === 0) {
    return (
      <div className="target-basis-box" style={{ marginTop: 12 }}>
        <p className="target-basis-summary">
          {message || "최근 공시 데이터가 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="target-basis-table-wrap" style={{ marginTop: 12 }}>
      <table className="target-basis-table">
        <thead>
          <tr>
            <th>공시일</th>
            <th>공시 제목</th>
            <th>제출인</th>
            <th>원문</th>
          </tr>
        </thead>
        <tbody>
          {disclosures.map((item) => (
            <tr key={item.receiptNo}>
              <td>{formatDate(item.date)}</td>
              <td>{item.reportName}</td>
              <td>{item.filerName || item.corpName}</td>
              <td>
                <a href={item.viewerUrl} target="_blank" rel="noreferrer">
                  열기
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function makeDisclosureCacheKey(symbol?: string | null) {
  return `${DISCLOSURE_CACHE_PREFIX}:${(symbol || "").trim().toUpperCase()}`;
}

function readDisclosureCache(key: string): CachedDisclosure | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedDisclosure;

    if (!parsed?.savedAt || !parsed?.data) return null;

    const age = Date.now() - new Date(parsed.savedAt).getTime();

    if (Number.isFinite(age) && age > DISCLOSURE_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeDisclosureCache(key: string, value: CachedDisclosure) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 임시저장 실패 시에도 공시 화면 표시는 유지합니다.
  }
}

function formatDate(value?: string | null) {
  if (!value || value.length !== 8) return value || "-";

  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
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

"use client";

import { useEffect, useState } from "react";

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

type Props = {
  symbol?: string | null;
  name?: string | null;
};

export default function DisclosureSection({ symbol, name }: Props) {
  const [data, setData] = useState<DisclosureResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!symbol) {
      setData(null);
      return;
    }

    const controller = new AbortController();

    async function loadDisclosures() {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/dart/disclosures?symbol=${encodeURIComponent(symbol || "")}&days=90&pageCount=10`,
          { signal: controller.signal },
        );

        const payload = (await response.json()) as DisclosureResponse;

        setData(payload);
      } catch (error) {
        if (controller.signal.aborted) return;

        setData({
          ok: false,
          code: "FETCH_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "최근 공시를 불러오지 못했습니다.",
          disclosures: [],
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadDisclosures();

    return () => controller.abort();
  }, [symbol]);

  return (
    <section className="target-section">
      <div className="card">
        <div className="target-header">
          <div>
            <h3 className="section-title small">공시·재무 자동 확인</h3>
            <p className="target-subtitle">
              DART 최근 공시를 확인해 추정 주가 판단에 참고할 수 있도록 표시합니다.
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
            {isLoading ? "조회 중" : data?.message || "조회 전"}
          </p>
          <div className="target-basis-adjustments">
            <p>
              공시 데이터는 추정 주가를 직접 계산하는 값이 아니라, 최근 이슈와
              리스크를 확인하기 위한 참고 정보입니다.
            </p>
          </div>
        </div>

        <button
          className="button secondary-button"
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          style={{ marginTop: 12 }}
        >
          {isOpen ? "최근 공시 닫기" : "최근 공시 보기"}
        </button>

        {isOpen ? (
          <DisclosureList
            disclosures={data?.disclosures || []}
            isLoading={isLoading}
            message={data?.message}
          />
        ) : null}

        <p className="notice-text">
          DART 공시 링크는 원문 확인용입니다. 중요 공시가 있을 경우 추정 주가
          신뢰도와 위험 보정에 반영하는 기능을 다음 단계에서 추가할 수 있습니다.
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

function formatDate(value?: string | null) {
  if (!value || value.length !== 8) return value || "-";

  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}

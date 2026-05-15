"use client";

import { useEffect, useMemo, useState } from "react";

type ConsensusSource = "naver" | "fnguide" | "manual" | "report";

type ConsensusData = {
  averageTargetPrice: number | null;
  highTargetPrice: number | null;
  lowTargetPrice: number | null;
  investmentOpinion: string;
  analystCount: number | null;
  source: ConsensusSource;
  baseDate: string;
  rawText: string;
  savedAt: string;
};

type Props = {
  symbol?: string | null;
  name?: string | null;
  appTargetPrice?: number | null;
};

const CONSENSUS_STORAGE_PREFIX = "kospi-consensus-data";

const EMPTY_CONSENSUS: ConsensusData = {
  averageTargetPrice: null,
  highTargetPrice: null,
  lowTargetPrice: null,
  investmentOpinion: "",
  analystCount: null,
  source: "naver",
  baseDate: "",
  rawText: "",
  savedAt: "",
};

export default function ConsensusInputSection({
  symbol,
  name,
  appTargetPrice,
}: Props) {
  const storageKey = useMemo(() => makeStorageKey(symbol, name), [symbol, name]);
  const [rawText, setRawText] = useState("");
  const [consensus, setConsensus] = useState<ConsensusData>(EMPTY_CONSENSUS);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setRawText("");
      setConsensus(EMPTY_CONSENSUS);
      setSavedAt(null);
      return;
    }

    const saved = readConsensus(storageKey);

    if (saved) {
      setConsensus(saved);
      setRawText(saved.rawText || "");
      setSavedAt(saved.savedAt || null);
      return;
    }

    setRawText("");
    setConsensus(EMPTY_CONSENSUS);
    setSavedAt(null);
  }, [storageKey]);

  const comparison = makeConsensusComparison(
    appTargetPrice,
    consensus.averageTargetPrice,
    consensus.highTargetPrice,
    consensus.lowTargetPrice,
  );

  const hasConsensus =
    consensus.averageTargetPrice != null ||
    consensus.highTargetPrice != null ||
    consensus.lowTargetPrice != null ||
    consensus.analystCount != null ||
    Boolean(consensus.investmentOpinion);

  const displayName = name || symbol || "현재 종목";

  function handleParse() {
    const parsed = parseConsensusText(rawText);

    setConsensus((prev) => ({
      ...prev,
      ...parsed,
      rawText,
    }));
  }

  function handleSave() {
    if (typeof window === "undefined") return;

    const next: ConsensusData = {
      ...consensus,
      rawText,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setConsensus(next);
    setSavedAt(next.savedAt);
  }

  function handleClear() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }

    setRawText("");
    setConsensus(EMPTY_CONSENSUS);
    setSavedAt(null);
  }

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>컨센서스 기준가 산정 방식</span>
          <strong>{hasConsensus ? "컨센서스 반영 가능" : "컨센서스 대기"}</strong>
        </div>

        <p className="target-basis-summary">
          네이버증권, FnGuide, 리포트 목표가의 평균·최고·최저 목표가를
          참고해 외부 시장 기대치를 확인합니다. 컨센서스 기준가는 앱 모델
          추정가가 시장 기대치보다 보수적인지, 과도하게 높은지 비교하는 보조
          기준입니다.
        </p>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <ConsensusMetricCard
            title="평균 목표가"
            value={formatPrice(consensus.averageTargetPrice)}
            subText="컨센서스 기준"
          />
          <ConsensusMetricCard
            title="최고 목표가"
            value={formatPrice(consensus.highTargetPrice)}
            subText="공격적 전망"
          />
          <ConsensusMetricCard
            title="최저 목표가"
            value={formatPrice(consensus.lowTargetPrice)}
            subText="보수적 전망"
          />
          <ConsensusMetricCard
            title="참여 증권사"
            value={formatCount(consensus.analystCount)}
            subText={consensus.investmentOpinion || "투자의견 없음"}
          />
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>앱 추정가 vs 컨센서스</span>
            <strong>{comparison.title}</strong>
          </div>

          <p className="target-basis-summary">{comparison.description}</p>

          <div className="target-basis-adjustments">
            <p>앱 추정가: {formatPrice(appTargetPrice)}</p>
            <p>컨센서스 평균: {formatPrice(consensus.averageTargetPrice)}</p>
            <p>차이: {comparison.gapText}</p>
            <p>저장 시각: {formatDateTime(savedAt)}</p>
          </div>
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>컨센서스 원문 입력/저장</span>
            <strong>{displayName}</strong>
          </div>

          <p className="target-basis-summary">
            네이버증권, FnGuide, 리포트 화면에서 컨센서스 관련 텍스트를
            복사해 붙여넣으면 평균 목표가, 최고·최저 목표가, 투자의견, 참여
            증권사 수를 최대한 읽어 저장합니다.
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 14,
            }}
          >
            <textarea
              className="form-control"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={`예시)
평균 목표가 296,000
최고 목표가 330,000
최저 목표가 250,000
투자의견 BUY
참여 18개 증권사`}
              rows={7}
              style={{
                width: "100%",
                resize: "vertical",
                minHeight: 140,
                lineHeight: 1.5,
              }}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                className="button primary-button"
                type="button"
                onClick={handleParse}
              >
                컨센서스 읽기
              </button>
              <button
                className="button secondary-button"
                type="button"
                onClick={handleSave}
              >
                저장
              </button>
              <button
                className="button secondary-button"
                type="button"
                onClick={handleClear}
                disabled={!rawText && !hasConsensus && !savedAt}
              >
                삭제
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginTop: 16,
          }}
        >
          <label className="metric-row" style={{ display: "grid", gap: 6 }}>
            <span>출처</span>
            <select
              className="form-control"
              value={consensus.source}
              onChange={(event) =>
                setConsensus((prev) => ({
                  ...prev,
                  source: event.target.value as ConsensusSource,
                }))
              }
            >
              <option value="naver">네이버증권</option>
              <option value="fnguide">FnGuide</option>
              <option value="report">리포트</option>
              <option value="manual">수동</option>
            </select>
          </label>

          <label className="metric-row" style={{ display: "grid", gap: 6 }}>
            <span>기준일</span>
            <input
              className="form-control"
              value={consensus.baseDate}
              onChange={(event) =>
                setConsensus((prev) => ({
                  ...prev,
                  baseDate: event.target.value,
                }))
              }
              placeholder="예: 2026-05-11"
            />
          </label>

          <label className="metric-row" style={{ display: "grid", gap: 6 }}>
            <span>투자의견</span>
            <input
              className="form-control"
              value={consensus.investmentOpinion}
              onChange={(event) =>
                setConsensus((prev) => ({
                  ...prev,
                  investmentOpinion: event.target.value,
                }))
              }
              placeholder="예: BUY / 매수 / 중립"
            />
          </label>
        </div>

        <p className="notice-text" style={{ marginTop: 14 }}>
          이 데이터는 자동 크롤링이 아니라 사용자가 복사해 붙여넣은 텍스트를
          파싱해 저장하는 방식입니다. 종목 코드가 없을 때도 임시 저장키로
          저장되며, 종목 조회 후에는 종목별 저장키로 관리됩니다.
        </p>
      </div>
    </section>
  );
}

function ConsensusMetricCard({
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

function parseConsensusText(text: string): Partial<ConsensusData> {
  const averageTargetPrice =
    findPriceByLabels(text, [
      "평균 목표가",
      "평균목표가",
      "목표주가 평균",
      "컨센서스 평균",
      "평균",
      "consensus",
      "average",
    ]) ?? findFirstPrice(text);

  const highTargetPrice = findPriceByLabels(text, [
    "최고 목표가",
    "최고목표가",
    "상단",
    "최고",
    "highest",
    "high",
  ]);

  const lowTargetPrice = findPriceByLabels(text, [
    "최저 목표가",
    "최저목표가",
    "하단",
    "최저",
    "lowest",
    "low",
  ]);

  const analystCount = findAnalystCount(text);
  const investmentOpinion = findOpinion(text);
  const baseDate = findDate(text);

  return {
    averageTargetPrice,
    highTargetPrice,
    lowTargetPrice,
    analystCount,
    investmentOpinion,
    baseDate,
  };
}

function findPriceByLabels(text: string, labels: string[]) {
  const normalized = text.replace(/\s+/g, " ");

  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const regex = new RegExp(`${escaped}[^0-9]{0,20}([0-9][0-9,\\.]{2,})`, "i");
    const match = normalized.match(regex);
    const parsed = parsePrice(match?.[1]);

    if (parsed != null) return parsed;
  }

  return null;
}

function findFirstPrice(text: string) {
  const match = text.match(/([0-9][0-9,]{3,})\s*원?/);
  return parsePrice(match?.[1]);
}

function findAnalystCount(text: string) {
  const patterns = [
    /([0-9]{1,2})\s*개\s*증권사/,
    /([0-9]{1,2})\s*명/,
    /참여[^0-9]{0,10}([0-9]{1,2})/,
    /증권사[^0-9]{0,10}([0-9]{1,2})/,
    /analyst[^0-9]{0,10}([0-9]{1,2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const parsed = Number(match[1]);

      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function findOpinion(text: string) {
  const opinionKeywords = [
    "Strong Buy",
    "BUY",
    "Buy",
    "매수",
    "중립",
    "보유",
    "Hold",
    "Sell",
    "매도",
  ];

  for (const keyword of opinionKeywords) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      return keyword;
    }
  }

  return "";
}

function findDate(text: string) {
  const match =
    text.match(/20[0-9]{2}[-./][0-9]{1,2}[-./][0-9]{1,2}/) ??
    text.match(/20[0-9]{2}년\s*[0-9]{1,2}월\s*[0-9]{1,2}일/);

  return match?.[0] ?? "";
}

function parsePrice(value?: string | null) {
  if (!value) return null;

  const parsed = Number(value.replace(/,/g, ""));

  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed);
}

function makeConsensusComparison(
  appTargetPrice?: number | null,
  averageTargetPrice?: number | null,
  highTargetPrice?: number | null,
  lowTargetPrice?: number | null,
) {
  if (!appTargetPrice || !averageTargetPrice) {
    return {
      title: "컨센서스 대기",
      description:
        "앱 추정가와 컨센서스 평균 목표가가 모두 있어야 비교할 수 있습니다.",
      gapText: "데이터 없음",
    };
  }

  const gapRate = ((averageTargetPrice - appTargetPrice) / appTargetPrice) * 100;
  const rangeRate =
    highTargetPrice && lowTargetPrice && averageTargetPrice > 0
      ? ((highTargetPrice - lowTargetPrice) / averageTargetPrice) * 100
      : null;

  if (gapRate >= 3) {
    return {
      title: "앱 추정가가 보수적",
      description:
        "컨센서스 평균 목표가가 앱 추정가보다 높습니다. 시장 기대치는 앱 추정가보다 우호적으로 볼 수 있습니다.",
      gapText: `+${gapRate.toFixed(2)}%`,
    };
  }

  if (gapRate <= -3) {
    return {
      title: "앱 추정가 과대 여부 확인",
      description:
        "앱 추정가가 컨센서스 평균보다 높습니다. 과대 추정 가능성과 보수 조정 필요성을 확인해야 합니다.",
      gapText: `${gapRate.toFixed(2)}%`,
    };
  }

  return {
    title:
      rangeRate != null && rangeRate >= 25
        ? "평균은 근접 · 의견 차이 큼"
        : "컨센서스와 근접",
    description:
      rangeRate != null && rangeRate >= 25
        ? "앱 추정가와 컨센서스 평균은 비슷하지만 최고·최저 목표가 차이가 커 시장 의견 차이가 있는 편입니다."
        : "앱 추정가와 컨센서스 평균 목표가가 비교적 가까운 편입니다.",
    gapText: `${gapRate >= 0 ? "+" : ""}${gapRate.toFixed(2)}%`,
  };
}

function readConsensus(key: string): ConsensusData | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as ConsensusData;

    if (!parsed || typeof parsed !== "object") return null;

    return {
      ...EMPTY_CONSENSUS,
      ...parsed,
    };
  } catch {
    return null;
  }
}

function makeStorageKey(symbol?: string | null, name?: string | null) {
  const normalizedSymbol = (symbol || "").trim().toUpperCase();

  if (normalizedSymbol) {
    return `${CONSENSUS_STORAGE_PREFIX}:${normalizedSymbol}`;
  }

  const normalizedName = (name || "").trim();

  if (normalizedName) {
    return `${CONSENSUS_STORAGE_PREFIX}:NAME:${normalizedName}`;
  }

  return `${CONSENSUS_STORAGE_PREFIX}:CURRENT`;
}

function formatPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatCount(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${value}개`;
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

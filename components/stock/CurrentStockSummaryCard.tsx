"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockResponse } from "../../types/stock";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
} from "../../utils/format";

type Props = {
  data: StockResponse | null;
};

type DailyTargetSnapshot = {
  date: string;
  symbol: string;
  targetPrice: number;
  basisPrice: number;
  source: "first-query" | "current-query" | "manual";
  savedAt: string;
};

const DAILY_TARGET_STORAGE_PREFIX = "kospi-daily-target";

export default function CurrentStockSummaryCard({ data }: Props) {
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const todayKey = useMemo(() => makeTodayKey(), []);
  const dailyTargetKey = useMemo(
    () => makeDailyTargetKey(data?.symbol, todayKey),
    [data?.symbol, todayKey],
  );

  const [dailyTarget, setDailyTarget] = useState<DailyTargetSnapshot | null>(null);
  const [manualTargetInput, setManualTargetInput] = useState("");

  useEffect(() => {
    if (!range || !data?.symbol || typeof window === "undefined") {
      setDailyTarget(null);
      setManualTargetInput("");
      return;
    }

    const stored = readDailyTargetSnapshot(dailyTargetKey);

    if (stored) {
      setDailyTarget(stored);
      setManualTargetInput(formatManualTargetInput(String(stored.targetPrice)));
      return;
    }

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      source: "first-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }, [dailyTargetKey, data?.symbol, range, todayKey]);

  const targetProgress =
    range && range.baseTarget > 0
      ? Number(((range.currentPrice / range.baseTarget) * 100).toFixed(1))
      : null;

  const upsidePrice = range
    ? Number((range.baseTarget - range.currentPrice).toFixed(2))
    : null;

  const dailyTargetProgress =
    dailyTarget && range && dailyTarget.targetPrice > 0
      ? Number(((range.currentPrice / dailyTarget.targetPrice) * 100).toFixed(1))
      : null;

  const dailyUpsidePrice =
    dailyTarget && range
      ? Number((dailyTarget.targetPrice - range.currentPrice).toFixed(2))
      : null;

  const dailyUpsidePercent =
    dailyTarget && range && range.currentPrice > 0
      ? Number(
          (
            ((dailyTarget.targetPrice - range.currentPrice) /
              range.currentPrice) *
            100
          ).toFixed(2),
        )
      : null;

  const displaySymbol = data?.symbol || "데이터 없음";
  const displayName = data?.name || "종목명 없음";
  const displayMeta = [displaySymbol, data?.exchange, data?.currency]
    .filter(Boolean)
    .join(" · ");

  function handleSaveCurrentAsDailyTarget() {
    if (!range || !data?.symbol) return;

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      source: "current-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  function handleSaveManualDailyTarget() {
    if (!range || !data?.symbol) return;

    const parsed = parseManualTargetInput(manualTargetInput);

    if (parsed == null || parsed <= 0) return;

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: parsed,
      basisPrice: range.currentPrice,
      source: "manual",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  function handleResetDailyTarget() {
    if (!range || !data?.symbol || typeof window === "undefined") return;

    window.localStorage.removeItem(dailyTargetKey);

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      source: "first-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  return (
    <div className="card">
      <h3 className="section-title small">현재 종목 요약</h3>

      <div className="stock-identity">
        <div className="stock-name">{displayName}</div>
        <div className="stock-meta">{displayMeta || "시장 정보 대기"}</div>
      </div>

      <div className="metric-list">
        <MetricRow label="현재가" value={formatNumber(data?.currentPrice)} />
        <MetricRow
          label="전일 대비"
          value={`${formatSignedNumber(data?.changePrice)} / ${formatPercent(
            data?.change,
          )}`}
        />
        <MetricRow
          label="분석 신호"
          value={data?.signalSummary || "데이터 없음"}
        />
        <MetricRow
          label="종합 점수"
          value={
            data?.score?.total != null
              ? `${data.score.total} / 100 · ${data.score.grade}`
              : "데이터 없음"
          }
        />
        <MetricRow
          label="퀀트 점수"
          value={
            data?.quant?.total != null
              ? `${data.quant.total} / 100 · ${data.quant.grade}`
              : "데이터 없음"
          }
        />
        <MetricRow
          label="목표여력 점수"
          value={
            data?.score?.targetPrice?.score != null
              ? `${data.score.targetPrice.score} / 100 · ${data.score.targetPrice.label}`
              : "데이터 없음"
          }
        />

        <MetricRow
          label="현재 조회 기준 목표가"
          value={`${formatNumber(range?.baseTarget)} ${formatDailyTargetSuffix(
            dailyTarget,
          )}`}
        />
        <MetricRow
          label="현재 조회 기준 목표여력"
          value={`${formatSignedNumber(upsidePrice)} / ${formatUpside(
            range?.baseUpsidePercent,
          )}`}
        />
        <MetricRow
          label="현재 조회 기준 목표 도달률"
          value={formatTargetProgress(targetProgress)}
        />
        <MetricRow
          label="당일 기준 목표 도달률"
          value={`${formatTargetProgress(dailyTargetProgress)} · ${formatSignedNumber(
            dailyUpsidePrice,
          )} / ${formatUpside(dailyUpsidePercent)}`}
        />
        <MetricRow
          label="위험 기준선"
          value={`${formatNumber(range?.riskLine)} / ${formatUpside(
            range?.riskDownsidePercent,
          )}`}
        />
      </div>

      <div className="target-basis-box" style={{ marginTop: 16 }}>
        <div className="target-basis-header">
          <span>당일 기준 목표가 설정</span>
          <strong>{formatDailyTargetSource(dailyTarget)}</strong>
        </div>

        <p className="target-basis-summary">
          당일 기준 목표가: {formatNumber(dailyTarget?.targetPrice)} · 저장 기준가:{" "}
          {formatNumber(dailyTarget?.basisPrice)} · 저장 시각:{" "}
          {formatDateTime(dailyTarget?.savedAt)}
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <input
            className="form-control"
            value={manualTargetInput}
            inputMode="decimal"
            onChange={(event) =>
              setManualTargetInput(formatManualTargetInput(event.target.value))
            }
            placeholder="직접 입력 예: 288,000"
            style={{ maxWidth: 220 }}
          />
          <button
            className="button secondary-button"
            type="button"
            onClick={handleSaveManualDailyTarget}
            disabled={!range}
          >
            직접 입력 저장
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={handleSaveCurrentAsDailyTarget}
            disabled={!range}
          >
            현재 조회 목표가로 저장
          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={handleResetDailyTarget}
            disabled={!range}
          >
            오늘 기준 초기화
          </button>
        </div>

        <div className="target-basis-adjustments">
          <p>
            첫 조회 시 당일 기준 목표가가 자동 저장됩니다. 이후에는 직접 입력하거나
            현재 조회 목표가로 다시 저장할 수 있습니다.
          </p>
          <p>
            현재 조회 기준 목표가는 조회할 때마다 바뀔 수 있고, 당일 기준 목표가는
            같은 날짜의 목표 도달률 평가 기준으로 유지됩니다.
          </p>
        </div>
      </div>

      <p className="notice-text">
        현재 조회 기준 목표가는 최신 현재가와 지표로 다시 계산됩니다. 괄호 안의
        당일 기준 목표가는 오늘 평가 기준으로 저장된 목표가입니다.
      </p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function makeTodayKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function makeDailyTargetKey(symbol?: string | null, todayKey = makeTodayKey()) {
  return `${DAILY_TARGET_STORAGE_PREFIX}:${todayKey}:${(symbol || "")
    .trim()
    .toUpperCase()}`;
}

function readDailyTargetSnapshot(key: string): DailyTargetSnapshot | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as DailyTargetSnapshot;

    if (
      !parsed ||
      !Number.isFinite(parsed.targetPrice) ||
      !Number.isFinite(parsed.basisPrice)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeDailyTargetSnapshot(key: string, snapshot: DailyTargetSnapshot) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // localStorage 저장이 실패해도 화면 조회는 계속 진행합니다.
  }
}

function formatDailyTargetSuffix(snapshot?: DailyTargetSnapshot | null) {
  if (!snapshot) return "(당일 기준 목표가 데이터 없음)";

  return `(당일 기준 목표가 ${formatNumber(snapshot.targetPrice)})`;
}

function formatDailyTargetSource(snapshot?: DailyTargetSnapshot | null) {
  if (!snapshot) return "당일 기준 목표가 대기";

  if (snapshot.source === "manual") return "직접 입력 기준";
  if (snapshot.source === "current-query") return "현재 조회 목표가 저장 기준";
  return "오늘 첫 조회 기준";
}

function formatManualTargetInput(value: string) {
  const raw = value.replace(/,/g, "").replace(/\s/g, "");

  if (!raw) return "";

  const cleaned = raw.replace(/[^0-9.]/g, "");

  if (!cleaned) return "";

  const dotIndex = cleaned.indexOf(".");
  const integerPart = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned;
  const decimalPart =
    dotIndex >= 0 ? cleaned.slice(dotIndex + 1).replace(/\./g, "") : "";

  const formattedInteger = integerPart
    ? Number(integerPart).toLocaleString("en-US")
    : "0";

  if (dotIndex >= 0) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
}

function parseManualTargetInput(value: string) {
  const parsed = Number(value.replace(/[\s,]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function formatTargetProgress(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(1)}%`;
}

function formatUpside(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
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

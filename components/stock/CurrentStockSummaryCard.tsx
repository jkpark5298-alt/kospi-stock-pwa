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

export default function CurrentStockSummaryCard({ data }: Props) {
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const todayKey = useMemo(() => makeTodayKey(), []);
  const dailyTargetKey = useMemo(
    () => makeDailyTargetKey(data?.symbol, todayKey),
    [data?.symbol, todayKey],
  );
  const [dailyTarget, setDailyTarget] = useState<DailyTargetSnapshot | null>(null);

  useEffect(() => {
    if (!range || !data?.symbol || typeof window === "undefined") {
      setDailyTarget(null);
      return;
    }

    const stored = readDailyTargetSnapshot(dailyTargetKey);

    if (stored) {
      setDailyTarget(stored);
      return;
    }

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
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
          (((dailyTarget.targetPrice - range.currentPrice) / range.currentPrice) * 100).toFixed(2),
        )
      : null;

  const displaySymbol = data?.symbol || "데이터 없음";
  const displayName = data?.name || "종목명 없음";
  const displayMeta = [displaySymbol, data?.exchange, data?.currency]
    .filter(Boolean)
    .join(" · ");

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
          value={`${formatNumber(range?.baseTarget)} ${formatDailyTargetSuffix(dailyTarget)}`}
        />
        <MetricRow
          label="현재 조회 기준 목표여력"
          value={`${formatSignedNumber(upsidePrice)} / ${formatUpside(
            range?.baseUpsidePercent,
          )}`}
        />
        <MetricRow
          label="당일 기준 목표 도달률"
          value={`${formatTargetProgress(dailyTargetProgress)} · ${formatSignedNumber(
            dailyUpsidePrice,
          )} / ${formatUpside(dailyUpsidePercent)}`}
        />
        <MetricRow
          label="현재 조회 기준 목표 도달률"
          value={formatTargetProgress(targetProgress)}
        />
        <MetricRow
          label="위험 기준선"
          value={`${formatNumber(range?.riskLine)} / ${formatUpside(
            range?.riskDownsidePercent,
          )}`}
        />
      </div>

      <p className="notice-text">
        현재 조회 기준 목표가는 조회할 때마다 최신 현재가와 지표로 다시 계산됩니다.
        괄호 안의 당일 기준 목표가는 해당 종목의 오늘 첫 조회 목표가로 저장되어
        같은 날짜에는 목표 도달률 평가 기준으로 유지됩니다.
      </p>
    </div>
  );
}

type DailyTargetSnapshot = {
  date: string;
  symbol: string;
  targetPrice: number;
  basisPrice: number;
  savedAt: string;
};

const DAILY_TARGET_STORAGE_PREFIX = "kospi-daily-target";

function makeTodayKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function makeDailyTargetKey(symbol?: string | null, todayKey = makeTodayKey()) {
  return `${DAILY_TARGET_STORAGE_PREFIX}:${todayKey}:${(symbol || "").trim().toUpperCase()}`;
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatTargetProgress(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(1)}%`;
}

function formatUpside(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

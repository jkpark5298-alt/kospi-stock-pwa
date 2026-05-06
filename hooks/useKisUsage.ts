"use client";

import { useEffect, useState } from "react";
import type { StockResponse } from "../types/stock";

const KIS_SYNC_CODE_KEY = "kospi-kis-sync-code";
export const KIS_DAILY_LIMIT = 100;

type KisUsageApiResponse = {
  ok?: boolean;
  remaining?: number;
  limit?: number;
  error?: string;
};

function clampRemaining(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return KIS_DAILY_LIMIT;
  return Math.min(KIS_DAILY_LIMIT, Math.max(0, numeric));
}

function normalizeSyncCode(value: string) {
  return value.trim();
}

function estimateKisCallCountFromResponse(response: StockResponse) {
  if (!response.ok || response.cached) return 0;

  // 1차 연동 기준:
  // 종목 분석 조회가 성공하면 KIS 사용량 1회로 간주합니다.
  // 추후 /api/stock 응답에 실제 kisCallUsed 값이 생기면 이 함수만 바꾸면 됩니다.
  return 1;
}

async function requestKisUsage(
  syncCode: string,
  incrementBy = 0,
): Promise<KisUsageApiResponse> {
  const method = incrementBy > 0 ? "POST" : "GET";
  const url =
    method === "GET"
      ? `/api/kis-usage?syncCode=${encodeURIComponent(syncCode)}`
      : "/api/kis-usage";

  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers:
      method === "POST"
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
    body:
      method === "POST"
        ? JSON.stringify({
            syncCode,
            incrementBy,
          })
        : undefined,
  });

  const json = (await response.json()) as KisUsageApiResponse;

  if (!response.ok || !json.ok) {
    throw new Error(json.error || "KIS 사용량을 불러오지 못했습니다.");
  }

  return json;
}

export function useKisUsage() {
  const [kisRemainingCalls, setKisRemainingCalls] = useState(KIS_DAILY_LIMIT);
  const [kisSyncCode, setKisSyncCode] = useState("");
  const [kisSyncInput, setKisSyncInput] = useState("");
  const [kisUsageLoading, setKisUsageLoading] = useState(false);
  const [kisUsageError, setKisUsageError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = normalizeSyncCode(
      window.localStorage.getItem(KIS_SYNC_CODE_KEY) || "",
    );

    if (!saved) return;

    setKisSyncCode(saved);
    setKisSyncInput(saved);
    void refreshKisUsage(saved);
  }, []);

  async function refreshKisUsage(targetSyncCode = kisSyncCode) {
    const normalized = normalizeSyncCode(targetSyncCode);

    if (!normalized) {
      setKisRemainingCalls(KIS_DAILY_LIMIT);
      return KIS_DAILY_LIMIT;
    }

    setKisUsageLoading(true);
    setKisUsageError("");

    try {
      const json = await requestKisUsage(normalized);
      const remaining = clampRemaining(json.remaining);
      setKisRemainingCalls(remaining);
      return remaining;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "KIS 사용량을 불러오지 못했습니다.";
      setKisUsageError(message);
      return kisRemainingCalls;
    } finally {
      setKisUsageLoading(false);
    }
  }

  async function saveKisSyncCode() {
    const normalized = normalizeSyncCode(kisSyncInput);

    if (!normalized) {
      setKisUsageError("동기화 코드를 입력해 주세요.");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(KIS_SYNC_CODE_KEY, normalized);
    }

    setKisSyncCode(normalized);
    setKisSyncInput(normalized);
    await refreshKisUsage(normalized);
  }

  async function recordKisApiUsageFromResponse(response: StockResponse) {
    const normalized = normalizeSyncCode(kisSyncCode);
    const estimatedCalls = estimateKisCallCountFromResponse(response);

    if (!normalized || estimatedCalls <= 0) {
      return kisRemainingCalls;
    }

    setKisUsageLoading(true);
    setKisUsageError("");

    try {
      const json = await requestKisUsage(normalized, estimatedCalls);
      const remaining = clampRemaining(json.remaining);
      setKisRemainingCalls(remaining);
      return remaining;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "KIS 사용량을 저장하지 못했습니다.";
      setKisUsageError(message);
      return kisRemainingCalls;
    } finally {
      setKisUsageLoading(false);
    }
  }

  return {
    kisRemainingCalls,
    kisSyncCode,
    kisSyncInput,
    kisUsageLoading,
    kisUsageError,
    setKisSyncInput,
    saveKisSyncCode,
    refreshKisUsage,
    recordKisApiUsageFromResponse,
  };
}

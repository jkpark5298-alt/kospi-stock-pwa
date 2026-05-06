"use client";

import { useEffect, useState } from "react";
import type { StockResponse } from "../types/stock";

const KIS_API_USAGE_KEY = "kospi-kis-api-usage";
export const KIS_DAILY_LIMIT = 100;

type KisApiUsage = {
  date: string;
  used: number;
};

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readKisApiUsage(): KisApiUsage {
  if (typeof window === "undefined") {
    return { date: getTodayKey(), used: 0 };
  }

  try {
    const saved = window.localStorage.getItem(KIS_API_USAGE_KEY);

    if (!saved) {
      return { date: getTodayKey(), used: 0 };
    }

    const parsed = JSON.parse(saved) as Partial<KisApiUsage>;
    const today = getTodayKey();

    if (parsed.date !== today) {
      return { date: today, used: 0 };
    }

    return {
      date: today,
      used: clampNumber(Number(parsed.used ?? 0), 0, KIS_DAILY_LIMIT),
    };
  } catch {
    window.localStorage.removeItem(KIS_API_USAGE_KEY);
    return { date: getTodayKey(), used: 0 };
  }
}

function saveKisApiUsage(usage: KisApiUsage) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(KIS_API_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // localStorage 접근이 막힌 환경에서는 조용히 무시합니다.
  }
}

function calculateKisRemainingCalls(usage: KisApiUsage) {
  return clampNumber(KIS_DAILY_LIMIT - usage.used, 0, KIS_DAILY_LIMIT);
}

function estimateKisCallCountFromResponse(response: StockResponse) {
  if (!response.ok || response.cached) return 0;

  let count = 0;

  if (response.supply) count += 1;
  if (response.fundamentals) count += 1;

  return count;
}

export function useKisUsage() {
  const [kisRemainingCalls, setKisRemainingCalls] = useState(KIS_DAILY_LIMIT);

  useEffect(() => {
    setKisRemainingCalls(calculateKisRemainingCalls(readKisApiUsage()));
  }, []);

  function recordKisApiUsageFromResponse(response: StockResponse) {
    const estimatedCalls = estimateKisCallCountFromResponse(response);
    const currentUsage = readKisApiUsage();

    if (estimatedCalls <= 0) {
      const remaining = calculateKisRemainingCalls(currentUsage);
      setKisRemainingCalls(remaining);
      return remaining;
    }

    const nextUsage: KisApiUsage = {
      date: getTodayKey(),
      used: clampNumber(currentUsage.used + estimatedCalls, 0, KIS_DAILY_LIMIT),
    };

    saveKisApiUsage(nextUsage);
    const remaining = calculateKisRemainingCalls(nextUsage);
    setKisRemainingCalls(remaining);
    return remaining;
  }

  return { kisRemainingCalls, recordKisApiUsageFromResponse };
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StockResponse } from "../types/stock";
import {
  PREDICTION_HORIZONS,
  type PredictionHorizon,
  type PredictionRecord,
  type PredictionResult,
} from "../types/prediction";

type PredictionsApiResponse = {
  ok?: boolean;
  records?: PredictionRecord[];
  record?: PredictionRecord;
  updatedRecords?: PredictionRecord[];
  verifiedCount?: number;
  error?: string;
};

function normalizeSymbol(value?: string | null) {
  return (value || "").trim().toUpperCase();
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function roundPrice(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function createPredictionResult(
  expectedPrice: number | null,
  targetDate: string,
): PredictionResult {
  return {
    expectedPrice,
    targetDate,
    actualPrice: null,
    errorRate: null,
    directionHit: null,
  };
}

export function createPredictionPreview(data: StockResponse | null) {
  const now = new Date();
  const currentPrice = data?.currentPrice ?? null;
  const targetRange = data?.score?.targetPrice?.technicalTargetRange;
  const baseTarget = targetRange?.baseTarget ?? currentPrice;
  const targetUpside =
    currentPrice != null && baseTarget != null && currentPrice > 0
      ? (baseTarget - currentPrice) / currentPrice
      : 0;

  const scoreAdjustment = ((data?.score?.total ?? 50) - 50) / 100;
  const quantAdjustment = ((data?.quant?.total ?? 50) - 50) / 120;
  const combinedMomentum = Math.max(
    -0.18,
    Math.min(0.18, targetUpside + scoreAdjustment + quantAdjustment),
  );

  const results = PREDICTION_HORIZONS.reduce(
    (acc, horizon) => {
      const horizonRatio = horizon.days / 60;
      const expectedPrice =
        currentPrice == null
          ? null
          : roundPrice(currentPrice * (1 + combinedMomentum * horizonRatio));

      acc[horizon.key] = createPredictionResult(
        expectedPrice,
        addDays(now, horizon.days).toISOString(),
      );
      return acc;
    },
    {} as Record<PredictionHorizon, PredictionResult>,
  );

  return {
    currentPrice,
    results,
  };
}

function createPredictionRecord(
  data: StockResponse,
  syncCode: string,
): PredictionRecord {
  const preview = createPredictionPreview(data);

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    syncCode,
    symbol: normalizeSymbol(data.symbol),
    name: data.name || "",
    predictedAt: new Date().toISOString(),
    currentPrice: preview.currentPrice,
    scoreTotal: data.score?.total ?? null,
    quantTotal: data.quant?.total ?? null,
    results: preview.results,
  };
}

async function requestPredictions(
  syncCode: string,
  options?: {
    symbol?: string | null;
    method?: "GET" | "POST" | "DELETE";
    record?: PredictionRecord;
    scope?: "symbol" | "all";
  },
) {
  const method = options?.method || "GET";

  if (method === "GET") {
    const params = new URLSearchParams();
    params.set("syncCode", syncCode);
    if (options?.symbol) params.set("symbol", normalizeSymbol(options.symbol));

    const response = await fetch(`/api/predictions?${params.toString()}`, {
      cache: "no-store",
    });

    const json = (await response.json()) as PredictionsApiResponse;

    if (!response.ok || !json.ok) {
      throw new Error(json.error || "예측 기록을 불러오지 못했습니다.");
    }

    return json;
  }

  const response = await fetch("/api/predictions", {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      syncCode,
      record: options?.record,
      symbol: options?.symbol,
      scope: options?.scope,
    }),
  });

  const json = (await response.json()) as PredictionsApiResponse;

  if (!response.ok || !json.ok) {
    throw new Error(json.error || "예측 기록 요청에 실패했습니다.");
  }

  return json;
}

async function requestPredictionVerification(syncCode: string) {
  const response = await fetch("/api/predictions/verify", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      syncCode,
    }),
  });

  const json = (await response.json()) as PredictionsApiResponse;

  if (!response.ok || !json.ok) {
    throw new Error(json.error || "예측 기록 검증에 실패했습니다.");
  }

  return json;
}

export function usePredictionHistory(syncCode: string) {
  const [records, setRecords] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedSyncCode = useMemo(() => syncCode.trim(), [syncCode]);

  const refreshPredictions = useCallback(
    async (symbol?: string | null) => {
      if (!normalizedSyncCode) {
        setRecords([]);
        setError("");
        return [];
      }

      setLoading(true);
      setError("");

      try {
        const json = await requestPredictions(normalizedSyncCode, {
          symbol,
        });
        const nextRecords = json.records || [];
        setRecords(nextRecords);
        return nextRecords;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "예측 기록을 불러오지 못했습니다.";
        setError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [normalizedSyncCode],
  );

  useEffect(() => {
    void refreshPredictions();
  }, [refreshPredictions]);

  async function savePrediction(data: StockResponse) {
    if (!normalizedSyncCode) {
      setError("동기화 코드 저장 후 예측 기록을 저장할 수 있습니다.");
      return null;
    }

    const record = createPredictionRecord(data, normalizedSyncCode);
    setLoading(true);
    setError("");

    try {
      const json = await requestPredictions(normalizedSyncCode, {
        method: "POST",
        record,
      });
      const savedRecord = json.record || record;
      setRecords((prev) => [savedRecord, ...prev]);
      return savedRecord;
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "예측 기록을 저장하지 못했습니다.";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function verifyPredictions() {
    if (!normalizedSyncCode) {
      setError("동기화 코드 저장 후 예측 기록을 검증할 수 있습니다.");
      return [];
    }

    setLoading(true);
    setError("");

    try {
      const json = await requestPredictionVerification(normalizedSyncCode);
      await refreshPredictions();
      return json.updatedRecords || [];
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "예측 기록을 검증하지 못했습니다.";
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function clearCurrentSymbolPredictions(symbol: string) {
    if (!normalizedSyncCode) {
      setRecords([]);
      return;
    }

    const normalizedSymbol = normalizeSymbol(symbol);
    setLoading(true);
    setError("");

    try {
      await requestPredictions(normalizedSyncCode, {
        method: "DELETE",
        symbol: normalizedSymbol,
        scope: "symbol",
      });
      setRecords((prev) =>
        prev.filter((record) => record.symbol !== normalizedSymbol),
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "예측 기록을 삭제하지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function clearAllPredictions() {
    if (!normalizedSyncCode) {
      setRecords([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await requestPredictions(normalizedSyncCode, {
        method: "DELETE",
        scope: "all",
      });
      setRecords([]);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "예측 기록을 삭제하지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return {
    records,
    loading,
    error,
    refreshPredictions,
    savePrediction,
    verifyPredictions,
    clearCurrentSymbolPredictions,
    clearAllPredictions,
  };
}

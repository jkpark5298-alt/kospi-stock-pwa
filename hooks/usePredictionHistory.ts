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

type ConsensusData = {
  averageTargetPrice?: number | null;
};

type FundamentalsData = {
  per?: number | null;
  pbr?: number | null;
  eps?: number | null;
  bps?: number | null;
};

type EstimateWeights = {
  technical: number;
  valuation: number;
  consensus: number;
};

const CONSENSUS_STORAGE_PREFIX = "kospi-consensus-data";

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

  if (value >= 100_000) return Math.round(value / 10) * 10;
  if (value >= 10_000) return Math.round(value / 5) * 5;
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
  const targetPrice = calculateOption2Estimate(data);
  const targetUpside =
    currentPrice != null && targetPrice != null && currentPrice > 0
      ? (targetPrice - currentPrice) / currentPrice
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
    targetPrice,
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
      setError("동기화 코드를 저장해야 예측 기록을 저장할 수 있습니다.");
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
      setError("동기화 코드를 저장해야 예측 기록을 검증할 수 있습니다.");
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

function calculateOption2Estimate(data: StockResponse | null) {
  const targetPrice = data?.score?.targetPrice;
  const currentPrice =
    getNumber(data?.currentPrice) ??
    getNumber(targetPrice?.finalTargetRange?.currentPrice) ??
    getNumber(targetPrice?.technicalTargetRange?.currentPrice) ??
    null;

  const technicalTarget = getTechnicalTarget(targetPrice);
  const valuationTarget =
    getNumber(targetPrice?.valuationTargetRange?.valuationTarget) ??
    calculateValuationTarget(currentPrice, data?.fundamentals as FundamentalsData | null);
  const consensusTarget =
    getNumber((targetPrice as any)?.consensusTarget) ??
    getNumber(readConsensus(data?.symbol, data?.name)?.averageTargetPrice);

  const basisAverage = calculateBasisAverage({
    technicalTarget,
    valuationTarget,
    consensusTarget,
  });

  if (basisAverage == null) return null;

  const quantAdjustment = getSelectedQuantAdjustment(targetPrice);
  const quantPercent = getNumber(quantAdjustment?.baseAdjustmentPercent) ?? 0;
  const supplyPercent = getNumber(quantAdjustment?.positiveAdjustmentPercent) ?? 0;
  const riskPercent = getNumber(quantAdjustment?.riskAdjustmentPercent) ?? 0;

  const quantAmount = calculateAdjustmentAmount(basisAverage, quantPercent) ?? 0;
  const supplyAmount = calculateAdjustmentAmount(basisAverage, supplyPercent) ?? 0;
  const riskAmount = calculateAdjustmentAmount(basisAverage, riskPercent) ?? 0;
  const totalAmount = roundPrice(quantAmount + supplyAmount + riskAmount) ?? 0;

  return roundPrice(basisAverage + totalAmount);
}

function calculateBasisAverage({
  technicalTarget,
  valuationTarget,
  consensusTarget,
}: {
  technicalTarget?: number | null;
  valuationTarget?: number | null;
  consensusTarget?: number | null;
}) {
  const hasTechnical = technicalTarget != null && Number.isFinite(technicalTarget);
  const hasValuation = valuationTarget != null && Number.isFinite(valuationTarget);
  const hasConsensus = consensusTarget != null && Number.isFinite(consensusTarget);

  if (!hasTechnical && !hasValuation && !hasConsensus) return null;

  const rawWeights = hasConsensus
    ? {
        technical: hasTechnical ? 0.4 : 0,
        valuation: hasValuation ? 0.35 : 0,
        consensus: 0.25,
      }
    : {
        technical: hasTechnical ? 0.6 : 0,
        valuation: hasValuation ? 0.4 : 0,
        consensus: 0,
      };

  const totalWeight = rawWeights.technical + rawWeights.valuation + rawWeights.consensus;

  const weights: EstimateWeights = {
    technical: totalWeight > 0 ? rawWeights.technical / totalWeight : 0,
    valuation: totalWeight > 0 ? rawWeights.valuation / totalWeight : 0,
    consensus: totalWeight > 0 ? rawWeights.consensus / totalWeight : 0,
  };

  return roundPrice(
    (technicalTarget ?? 0) * weights.technical +
      (valuationTarget ?? 0) * weights.valuation +
      (consensusTarget ?? 0) * weights.consensus,
  );
}

function getTechnicalTarget(targetPrice?: StockResponse["score"]["targetPrice"]) {
  const candidates = targetPrice?.targetBasis?.candidates;

  if (Array.isArray(candidates)) {
    const technicalCandidate = candidates.find((candidate) =>
      String(candidate?.label ?? "").includes("기술"),
    );
    const value = getNumber(technicalCandidate?.value);

    if (value != null) return value;
  }

  return getNumber(targetPrice?.technicalTargetRange?.baseTarget);
}

function getSelectedQuantAdjustment(targetPrice?: StockResponse["score"]["targetPrice"]) {
  const selectedMode = String(targetPrice?.selectedTargetMode ?? "");
  const targetModes = Array.isArray(targetPrice?.targetModes)
    ? targetPrice.targetModes
    : [];
  const modeResult =
    targetModes.find((mode) => String(mode?.mode ?? "") === selectedMode) ??
    targetModes[0] ??
    null;

  return modeResult?.quantAdjustment ?? null;
}

function calculateValuationTarget(
  currentPrice?: number | null,
  fundamentals?: FundamentalsData | null,
) {
  if (!currentPrice || !fundamentals) return null;

  const epsTarget =
    fundamentals.eps != null &&
    fundamentals.eps > 0 &&
    fundamentals.per != null &&
    fundamentals.per > 0
      ? roundPrice(fundamentals.eps * fundamentals.per * getPerAdjustment(fundamentals.per))
      : null;
  const bpsTarget =
    fundamentals.bps != null &&
    fundamentals.bps > 0 &&
    fundamentals.pbr != null &&
    fundamentals.pbr > 0
      ? roundPrice(fundamentals.bps * fundamentals.pbr * getPbrAdjustment(fundamentals.pbr))
      : null;

  const targets = [epsTarget, bpsTarget].filter(
    (value): value is number => value != null && Number.isFinite(value) && value > 0,
  );

  if (!targets.length) return null;

  const average = roundPrice(targets.reduce((sum, value) => sum + value, 0) / targets.length);

  if (average == null) return null;

  return clampValuationTarget(average, currentPrice);
}

function calculateAdjustmentAmount(basisAverage: number | null, percent: number) {
  if (basisAverage == null || !Number.isFinite(basisAverage)) return null;

  return roundPrice((basisAverage * percent) / 100);
}

function clampValuationTarget(target: number, currentPrice: number) {
  const lower = currentPrice * 0.8;
  const upper = currentPrice * 1.35;

  return roundPrice(Math.max(lower, Math.min(target, upper)));
}

function getPerAdjustment(per?: number | null) {
  if (per == null || !Number.isFinite(per) || per <= 0) return 1;
  if (per <= 10) return 1.08;
  if (per <= 20) return 1;
  if (per <= 30) return 0.92;
  if (per <= 40) return 0.84;
  return 0.75;
}

function getPbrAdjustment(pbr?: number | null) {
  if (pbr == null || !Number.isFinite(pbr) || pbr <= 0) return 1;
  if (pbr <= 1) return 1.08;
  if (pbr <= 2) return 1;
  if (pbr <= 3) return 0.92;
  if (pbr <= 5) return 0.85;
  return 0.75;
}

function readConsensus(symbol?: string | null, name?: string | null): ConsensusData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(makeConsensusStorageKey(symbol, name));

    if (!raw) return null;

    const parsed = JSON.parse(raw) as ConsensusData;

    if (!parsed || typeof parsed !== "object") return null;

    return parsed;
  } catch {
    return null;
  }
}

function makeConsensusStorageKey(symbol?: string | null, name?: string | null) {
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

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

"use client";

import { useEffect, useState } from "react";
import type { StockResponse } from "../types/stock";
import {
  PREDICTION_HORIZONS,
  type PredictionRecord,
  type PredictionResult,
} from "../types/prediction";

const PREDICTION_HISTORY_KEY = "kospi-prediction-history";
const MAX_PREDICTION_RECORDS = 80;

function isPredictionRecord(value: unknown): value is PredictionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as PredictionRecord;
  return (
    typeof record.id === "string" &&
    typeof record.symbol === "string" &&
    typeof record.predictedAt === "string" &&
    typeof record.currentPrice === "number" &&
    !!record.results &&
    typeof record.results === "object"
  );
}

function normalizeSymbol(value?: string | null) {
  return (value || "").trim().toUpperCase();
}

function makePredictionResult(
  expectedPrice: number | null | undefined,
): PredictionResult {
  return {
    expectedPrice:
      typeof expectedPrice === "number" && !Number.isNaN(expectedPrice)
        ? expectedPrice
        : null,
    actualPrice: null,
    errorRate: null,
    directionHit: null,
    verifiedAt: null,
  };
}

function makeInterpolatedPrice(
  currentPrice: number | null,
  targetPrice: number | null,
  ratio: number,
) {
  if (currentPrice == null || targetPrice == null) return null;
  if (Number.isNaN(currentPrice) || Number.isNaN(targetPrice)) return null;
  return Number(
    (currentPrice + (targetPrice - currentPrice) * ratio).toFixed(2),
  );
}

function createPredictionPreview(
  data: StockResponse | null,
): Pick<PredictionRecord, "results"> {
  const currentPrice = data?.currentPrice ?? null;
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const forecast = data?.forecast ?? [];

  const fallback5d = makeInterpolatedPrice(
    currentPrice,
    range?.baseTarget ?? null,
    0.25,
  );
  const fallback20d = makeInterpolatedPrice(
    currentPrice,
    range?.baseTarget ?? null,
    0.65,
  );
  const fallback60d = makeInterpolatedPrice(
    currentPrice,
    range?.aggressiveTarget ?? range?.baseTarget ?? null,
    1,
  );

  return {
    results: {
      "5d": makePredictionResult(forecast[4] ?? fallback5d),
      "20d": makePredictionResult(forecast[19] ?? fallback20d),
      "60d": makePredictionResult(forecast[59] ?? fallback60d),
    },
  };
}

function createPredictionRecord(
  data: StockResponse | null,
): PredictionRecord | null {
  if (
    !data?.symbol ||
    data.currentPrice == null ||
    Number.isNaN(data.currentPrice)
  ) {
    return null;
  }

  const range = data.score?.targetPrice?.technicalTargetRange;
  const preview = createPredictionPreview(data);
  const now = new Date().toISOString();

  return {
    id: `${normalizeSymbol(data.symbol)}-${Date.now()}`,
    symbol: normalizeSymbol(data.symbol),
    name: data.name || normalizeSymbol(data.symbol),
    predictedAt: now,
    currentPrice: data.currentPrice,
    conservativeTarget: range?.conservativeTarget ?? null,
    baseTarget: range?.baseTarget ?? null,
    aggressiveTarget: range?.aggressiveTarget ?? null,
    riskLine: range?.riskLine ?? null,
    totalScore: data.score?.total ?? null,
    quantScore: data.quant?.total ?? null,
    results: preview.results,
  };
}

function differenceInCalendarDays(later: Date, earlier: Date) {
  const startLater = new Date(
    later.getFullYear(),
    later.getMonth(),
    later.getDate(),
  ).getTime();
  const startEarlier = new Date(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate(),
  ).getTime();
  return Math.floor((startLater - startEarlier) / 86_400_000);
}

function updatePredictionHistoryWithActualPrice(
  records: PredictionRecord[],
  symbol: string,
  actualPrice: number | null,
) {
  if (!symbol || actualPrice == null || Number.isNaN(actualPrice)) {
    return records;
  }

  const normalizedSymbol = normalizeSymbol(symbol);
  let changed = false;
  const now = new Date();

  const next = records.map((record) => {
    if (record.symbol !== normalizedSymbol) return record;

    const predictedAt = new Date(record.predictedAt);
    const daysPassed = differenceInCalendarDays(now, predictedAt);
    const updatedResults = { ...record.results };
    let recordChanged = false;

    PREDICTION_HORIZONS.forEach((horizon) => {
      const currentResult = updatedResults[horizon.key];
      if (
        !currentResult ||
        currentResult.actualPrice != null ||
        daysPassed < horizon.days
      ) {
        return;
      }
      if (currentResult.expectedPrice == null) return;

      const expectedDirection =
        currentResult.expectedPrice - record.currentPrice;
      const actualDirection = actualPrice - record.currentPrice;
      const directionHit =
        expectedDirection === 0
          ? Math.abs(actualDirection) < 0.0001
          : expectedDirection * actualDirection > 0;
      const errorRate =
        actualPrice === 0
          ? null
          : Math.abs(
              (actualPrice - currentResult.expectedPrice) / actualPrice,
            ) * 100;

      updatedResults[horizon.key] = {
        ...currentResult,
        actualPrice,
        errorRate: errorRate == null ? null : Number(errorRate.toFixed(2)),
        directionHit,
        verifiedAt: now.toISOString(),
      };
      recordChanged = true;
      changed = true;
    });

    return recordChanged ? { ...record, results: updatedResults } : record;
  });

  return changed ? next : records;
}

export function usePredictionHistory(
  data: StockResponse | null,
  inputSymbol: string,
) {
  const [predictionHistory, setPredictionHistory] = useState<
    PredictionRecord[]
  >([]);
  const [predictionHistoryLoaded, setPredictionHistoryLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PREDICTION_HISTORY_KEY);

      if (!saved) {
        setPredictionHistoryLoaded(true);
        return;
      }

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        setPredictionHistory(parsed.filter(isPredictionRecord));
      } else {
        window.localStorage.removeItem(PREDICTION_HISTORY_KEY);
      }
    } catch {
      window.localStorage.removeItem(PREDICTION_HISTORY_KEY);
    } finally {
      setPredictionHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!predictionHistoryLoaded) return;

    try {
      if (predictionHistory.length > 0) {
        window.localStorage.setItem(
          PREDICTION_HISTORY_KEY,
          JSON.stringify(predictionHistory.slice(0, MAX_PREDICTION_RECORDS)),
        );
      } else {
        window.localStorage.removeItem(PREDICTION_HISTORY_KEY);
      }
    } catch {
      // localStorage 접근이 막힌 환경에서는 조용히 무시합니다.
    }
  }, [predictionHistory, predictionHistoryLoaded]);

  useEffect(() => {
    if (!data?.symbol || data.currentPrice == null) return;

    setPredictionHistory((prev) =>
      updatePredictionHistoryWithActualPrice(
        prev,
        data.symbol || "",
        data.currentPrice ?? null,
      ),
    );
  }, [data?.symbol, data?.currentPrice]);

  function handleSavePrediction() {
    const record = createPredictionRecord(data);

    if (!record) {
      alert("예측값을 저장하려면 먼저 종목 분석을 완료해 주세요.");
      return;
    }

    setPredictionHistory((prev) => {
      const duplicated = prev.some(
        (item) =>
          item.symbol === record.symbol &&
          new Date(item.predictedAt).toDateString() ===
            new Date(record.predictedAt).toDateString(),
      );

      if (duplicated) {
        alert("오늘 이미 이 종목의 예측값을 저장했습니다.");
        return prev;
      }

      alert(
        "현재 예측값을 저장했습니다. 같은 종목을 며칠 뒤 다시 분석하면 실제 주가와 자동 비교됩니다.",
      );
      return [record, ...prev].slice(0, MAX_PREDICTION_RECORDS);
    });
  }

  function handleClearCurrentSymbolPredictions() {
    const normalizedSymbol = normalizeSymbol(data?.symbol || inputSymbol);

    if (!normalizedSymbol) {
      alert("삭제할 종목을 먼저 분석하거나 종목 코드를 입력해 주세요.");
      return;
    }

    const hasRecords = predictionHistory.some(
      (record) => record.symbol === normalizedSymbol,
    );

    if (!hasRecords) {
      alert("현재 종목에 저장된 예측 기록이 없습니다.");
      return;
    }

    if (!window.confirm(`${normalizedSymbol} 예측 기록을 삭제할까요?`)) {
      return;
    }

    setPredictionHistory((prev) =>
      prev.filter((record) => record.symbol !== normalizedSymbol),
    );
  }

  function handleClearAllPredictions() {
    if (predictionHistory.length === 0) {
      alert("삭제할 예측 기록이 없습니다.");
      return;
    }

    if (
      !window.confirm(
        "모든 종목의 예측 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
      )
    ) {
      return;
    }

    setPredictionHistory([]);
  }

  return {
    predictionHistory,
    handleSavePrediction,
    handleClearCurrentSymbolPredictions,
    handleClearAllPredictions,
  };
}

export { createPredictionPreview };

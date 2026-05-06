"use client";

import type { ReactNode } from "react";
import type { ChartRow, StockResponse } from "../../types/stock";
import {
  PREDICTION_HORIZONS,
  type PredictionHorizon,
  type PredictionRecord,
  type PredictionResult,
  type PredictionStats,
} from "../../types/prediction";
import {
  formatDateTimeFull,
  formatDateTimeLabel,
  formatErrorRate,
  formatHitRate,
  formatPercent,
  formatPrice,
  formatScoreValue,
  formatSignedNumber,
} from "../../utils/format";
import { createPredictionPreview } from "../../hooks/usePredictionHistory";
import KisRemainingCard from "./KisRemainingCard";

type Props = {
  data: StockResponse | null;
  records: PredictionRecord[];
  predictionLoading: boolean;
  predictionError: string;
  lastFetchedAt: string | null;
  kisRemainingCalls: number;
  kisSyncCode: string;
  kisSyncInput: string;
  kisUsageLoading: boolean;
  kisUsageError: string;
  onKisSyncInputChange: (value: string) => void;
  onSaveKisSyncCode: () => void;
  onSavePrediction: () => void;
  onVerifyPredictions: () => void;
  onClearCurrentSymbol: () => void;
  onClearAll: () => void;
};

export default function PredictionDashboard({
  data,
  records,
  predictionLoading,
  predictionError,
  lastFetchedAt,
  kisRemainingCalls,
  kisSyncCode,
  kisSyncInput,
  kisUsageLoading,
  kisUsageError,
  onKisSyncInputChange,
  onSaveKisSyncCode,
  onSavePrediction,
  onVerifyPredictions,
  onClearCurrentSymbol,
  onClearAll,
}: Props) {
  const normalizedSymbol = normalizeSymbol(data?.symbol);
  const symbolRecords = records.filter(
    (record) => record.symbol === normalizedSymbol,
  );
  const overallStats = calculatePredictionStats(symbolRecords);
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const preview = createPredictionPreview(data);
  const latestClose = getLatestClose(data?.chartData);
  const priceGap =
    data?.currentPrice != null && latestClose != null
      ? data.currentPrice - latestClose
      : null;
  const priceGapRate =
    priceGap != null && latestClose ? (priceGap / latestClose) * 100 : null;
  const dataSourceLabel = getDataSourceLabel(data);
  const priceCheckLabel = getPriceCheckLabel(data?.currentPrice, latestClose);

  return (
    <section className="prediction-section">
      <Card>
        <div className="prediction-header">
          <div>
            <SectionTitleSmall>예측 검증 대시보드</SectionTitleSmall>
            <p className="prediction-subtitle">
              현재 예측값을 Supabase에 저장하고, 이후 실제 주가와 비교해 오차율과 방향성
              적중률을 확인합니다.
            </p>
          </div>
          <div className="prediction-badge">Supabase 연동 검증</div>
        </div>

        <div className="prediction-save-card">
          <div>
            <span className="prediction-kicker">현재 예측값 저장</span>
            <strong>{data?.name || "종목명 대기"}</strong>
            <em>{data?.symbol || "분석 후 종목코드 표시"}</em>
          </div>

          <div className="prediction-save-grid">
            <MetricRow label="현재가" value={formatPrice(data?.currentPrice)} />
            <MetricRow label="기준 목표가" value={formatPrice(range?.baseTarget)} />
            <MetricRow
              label="5일 예상가"
              value={formatPrice(preview.results["5d"].expectedPrice)}
            />
            <MetricRow
              label="20일 예상가"
              value={formatPrice(preview.results["20d"].expectedPrice)}
            />
            <MetricRow
              label="60일 예상가"
              value={formatPrice(preview.results["60d"].expectedPrice)}
            />
            <MetricRow label="종합 점수" value={formatScoreValue(data?.score?.total)} />
            <MetricRow label="퀀트 점수" value={formatScoreValue(data?.quant?.total)} />
          </div>

          <button
            className="button primary-button prediction-save-button"
            onClick={onSavePrediction}
            disabled={!data?.symbol || data.currentPrice == null}
          >
            현재 예측값 저장하기
          </button>
        </div>

        <div className="prediction-status-grid">
          <KisRemainingCard
            remainingCalls={kisRemainingCalls}
            syncCode={kisSyncCode}
            syncInput={kisSyncInput}
            loading={kisUsageLoading}
            error={kisUsageError}
            onSyncInputChange={onKisSyncInputChange}
            onSaveSyncCode={onSaveKisSyncCode}
          />
          <div className="prediction-status-card">
            <span>데이터 상태</span>
            <strong>{priceCheckLabel}</strong>
            <em>현재가 출처: {dataSourceLabel}</em>
            <small>마지막 조회: {formatDateTimeFull(lastFetchedAt)}</small>
          </div>
          <div className="prediction-status-card">
            <span>가격 확인용</span>
            <strong>현재가 {formatPrice(data?.currentPrice)}</strong>
            <em>차트 최신 종가 {formatPrice(latestClose)}</em>
            <small>
              차이 {formatSignedNumber(priceGap)} / {formatPercent(priceGapRate)}
            </small>
          </div>
          <div className="prediction-status-card prediction-management-card">
            <span>예측 기록 관리</span>
            <strong>저장 {overallStats.total}건</strong>
            <em>
              {predictionLoading
                ? "예측 기록 동기화 중입니다."
                : "PC·아이폰 기록을 함께 관리합니다."}
            </em>
            {predictionError ? <small>{predictionError}</small> : null}
            <div className="prediction-management-actions">
              <button
                type="button"
                className="button primary-button prediction-manage-button"
                onClick={onVerifyPredictions}
              >
                예측 기록 검증하기
              </button>
              <button
                type="button"
                className="button secondary-button prediction-manage-button"
                onClick={onClearCurrentSymbol}
              >
                이 종목 기록 삭제
              </button>
              <button
                type="button"
                className="button ghost-button prediction-manage-button"
                onClick={onClearAll}
              >
                전체 기록 삭제
              </button>
            </div>
          </div>
        </div>

        <div className="prediction-summary-grid">
          <PredictionSummaryCard
            title="저장된 예측"
            value={`${overallStats.total}건`}
            subText="이 종목 기준"
          />
          <PredictionSummaryCard
            title="검증 완료"
            value={`${overallStats.verified}건`}
            subText="5·20·60일 합산"
          />
          <PredictionSummaryCard
            title="방향성 적중률"
            value={formatHitRate(overallStats.hitRate)}
            subText="상승/하락 방향 비교"
          />
          <PredictionSummaryCard
            title="평균 오차율"
            value={formatErrorRate(overallStats.avgErrorRate)}
            subText="예상가 대비 실제가"
          />
        </div>

        <div className="prediction-horizon-grid">
          {PREDICTION_HORIZONS.map((horizon) => {
            const stats = calculatePredictionStats(symbolRecords, horizon.key);
            return (
              <div className="prediction-horizon-card" key={horizon.key}>
                <span>{horizon.label} 예측</span>
                <strong>{formatHitRate(stats.hitRate)}</strong>
                <em>평균 오차 {formatErrorRate(stats.avgErrorRate)}</em>
                <small>검증 {stats.verified}건</small>
              </div>
            );
          })}
        </div>

        <div className="prediction-table-wrap">
          <table className="prediction-table">
            <thead>
              <tr>
                <th>예측일</th>
                <th>구간</th>
                <th>당시가</th>
                <th>예상가</th>
                <th>실제가</th>
                <th>오차율</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {buildPredictionRows(symbolRecords)
                .slice(0, 12)
                .map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTimeLabel(row.predictedAt)}</td>
                    <td>{row.horizonLabel}</td>
                    <td>{formatPrice(row.currentPrice)}</td>
                    <td>{formatPrice(row.expectedPrice)}</td>
                    <td>
                      {row.actualPrice == null
                        ? "대기중"
                        : formatPrice(row.actualPrice)}
                    </td>
                    <td>{formatErrorRate(row.errorRate)}</td>
                    <td>
                      <span
                        className={`prediction-result ${getPredictionResultTone(row.directionHit)}`}
                      >
                        {formatPredictionResult(row.directionHit)}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {symbolRecords.length === 0 ? (
            <p className="muted-text prediction-empty-text">
              아직 저장된 예측 기록이 없습니다. 분석 결과가 표시되면 현재
              예측값을 저장해 주세요.
            </p>
          ) : null}
        </div>

        <p className="notice-text">
          예측 기록은 Supabase에 저장됩니다. PC와 아이폰에서 같은 동기화 코드를
          사용하면 저장 기록이 함께 표시됩니다.
        </p>
      </Card>
    </section>
  );
}

function PredictionSummaryCard({
  title,
  value,
  subText,
}: {
  title: string;
  value: string;
  subText: string;
}) {
  return (
    <div className="prediction-summary-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <em>{subText}</em>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

function SectionTitleSmall({ children }: { children: ReactNode }) {
  return <h3 className="section-title small">{children}</h3>;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getLatestClose(chartData?: ChartRow[] | null) {
  if (!chartData?.length) return null;

  for (let i = chartData.length - 1; i >= 0; i -= 1) {
    const close = chartData[i]?.close;
    if (close != null && Number.isFinite(close)) {
      return close;
    }
  }

  return null;
}

function getDataSourceLabel(data: StockResponse | null) {
  if (!data) return "분석 전";
  if (data.cached) {
    return `캐시 데이터${data.cacheSource ? ` (${data.cacheSource})` : ""}`;
  }
  if (data.warning) return "API 응답 / 경고 있음";
  return "API 응답 기준";
}

function getPriceCheckLabel(
  currentPrice?: number | null,
  latestClose?: number | null,
) {
  if (currentPrice == null || latestClose == null) return "확인 대기";
  if (!latestClose) return "확인 대기";

  const gapRate = Math.abs((currentPrice - latestClose) / latestClose) * 100;

  if (gapRate <= 0.5) return "정상 범위";
  if (gapRate <= 3) return "가격 차이 확인";
  return "가격 검증 필요";
}

function normalizeSymbol(value?: string | null) {
  return (value || "").trim().toUpperCase();
}

function calculatePredictionStats(
  records: PredictionRecord[],
  horizon?: PredictionHorizon,
): PredictionStats {
  const results = records.flatMap((record) => {
    if (horizon) return [record.results[horizon]];
    return PREDICTION_HORIZONS.map((item) => record.results[item.key]);
  });

  const verified = results.filter(
    (
      result,
    ): result is PredictionResult & {
      directionHit: boolean;
      errorRate: number;
    } => !!result && result.directionHit != null && result.errorRate != null,
  );

  const hitCount = verified.filter((result) => result.directionHit).length;
  const avgErrorRate = verified.length
    ? verified.reduce((sum, result) => sum + result.errorRate, 0) /
      verified.length
    : null;

  return {
    total: records.length,
    verified: verified.length,
    hitRate: verified.length
      ? Number(((hitCount / verified.length) * 100).toFixed(1))
      : null,
    avgErrorRate: avgErrorRate == null ? null : Number(avgErrorRate.toFixed(2)),
  };
}

function buildPredictionRows(records: PredictionRecord[]) {
  return records.flatMap((record) =>
    PREDICTION_HORIZONS.map((horizon) => {
      const result = record.results[horizon.key];
      return {
        id: `${record.id}-${horizon.key}`,
        predictedAt: record.predictedAt,
        horizonLabel: horizon.label,
        currentPrice: record.currentPrice,
        expectedPrice: result?.expectedPrice ?? null,
        actualPrice: result?.actualPrice ?? null,
        errorRate: result?.errorRate ?? null,
        directionHit: result?.directionHit ?? null,
      };
    }),
  );
}

function formatPredictionResult(value?: boolean | null) {
  if (value == null) return "대기";
  return value ? "적중" : "실패";
}

function getPredictionResultTone(value?: boolean | null) {
  if (value == null) return "waiting";
  return value ? "hit" : "miss";
}

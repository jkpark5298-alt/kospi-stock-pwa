"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ChartRow, StockResponse } from "../../types/stock";
import { calculateTechnicalStrategy } from "../../lib/technicalStrategy";

type LineSpec = {
  key: keyof ChartRow;
  color: string;
  dashed?: boolean;
};

type PriceTrendLine = {
  key: "pivotResistance" | "pivotSupport" | "linearRegression";
  label: string;
  color: string;
  startIndex: number;
  endIndex: number;
  startValue: number;
  endValue: number;
  dashed?: boolean;
};


type Props = {
  data: StockResponse | null;
  rows: ChartRow[];
};

export default function ChartAnalysisSections({ data, rows }: Props) {
  const recentRows = useMemo(() => rows.slice(-10).reverse(), [rows]);
  const latestRow = useMemo(
    () => (rows.length ? rows[rows.length - 1] : null),
    [rows],
  );
  const previousRow = useMemo(
    () => (rows.length > 1 ? rows[rows.length - 2] : null),
    [rows],
  );
  const obvTrend = getObvTrend(latestRow?.obv, previousRow?.obv);
  const bbStatus = getBollingerStatus(
    latestRow?.close,
    latestRow?.bbUpper,
    latestRow?.bbLower,
  );

    const technicalSummary = makeTechnicalSummary(data, latestRow, bbStatus, obvTrend);
  const technicalStrategy = useMemo(() => calculateTechnicalStrategy(rows), [rows]);
  const [activeTechnicalPanel, setActiveTechnicalPanel] = useState<"market" | "score" | "interpretation" | "price" | "signal">("market");
  const [showSidewaysDetailModal, setShowSidewaysDetailModal] = useState(false);
  const [sidewaysModalZoom, setSidewaysModalZoom] = useState(1);
  const regimeLabel = technicalStrategy.regimeLabel ?? "";
  const isSidewaysRegime = regimeLabel.includes("횡보");
  const isDownRegime = regimeLabel.includes("하락");
  const regimeColor = isDownRegime ? "#2563eb" : isSidewaysRegime ? "#d97706" : "#ef4444";
  const regimeBackground = isDownRegime ? "#eff6ff" : isSidewaysRegime ? "#fffbeb" : "#fff1f2";
  const regimeBorder = isDownRegime ? "#93c5fd" : isSidewaysRegime ? "#facc15" : "#fca5a5";
  const regimeSimpleReason = isSidewaysRegime
    ? "상승 근거와 상단 부담이 동시에 나타나는 구간입니다. 방향이 완전히 열린 상승장보다, 확인 후 분할 접근이 적합한 흐름입니다."
    : isDownRegime
      ? "가격이 주요 기준선 아래에 있거나 모멘텀이 약해 방어적 접근이 필요한 흐름입니다."
      : "가격과 모멘텀이 우호적으로 움직이며 상승 방향성이 상대적으로 강한 흐름입니다.";

  const latestTechnicalRow = rows.length ? (rows[rows.length - 1] as any) : {};
  const latestTechnical = ((technicalStrategy as any).latest ?? {}) as any;

  const pickTechnicalNumber = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value.replace(/,/g, ""));
        if (Number.isFinite(parsed)) return parsed;
      }
    }

    return null;
  };

  const formatTechnicalNumber = (value?: number | null, digits = 1) =>
    value == null || !Number.isFinite(value)
      ? "데이터 없음"
      : new Intl.NumberFormat("ko-KR", { maximumFractionDigits: digits }).format(value);

  const formatTechnicalPercent = (value?: number | null) =>
    value == null || !Number.isFinite(value)
      ? "데이터 없음"
      : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

  const closeForReason = pickTechnicalNumber(
    latestTechnical.close,
    latestTechnical.currentPrice,
    latestTechnicalRow.close,
  );
  const sma20ForReason = pickTechnicalNumber(latestTechnical.sma20, latestTechnicalRow.sma20);
  const sma60ForReason = pickTechnicalNumber(latestTechnical.sma60, latestTechnicalRow.sma60);
  const rsiForReason = pickTechnicalNumber(latestTechnical.rsi14, latestTechnical.rsi, latestTechnicalRow.rsi14, latestTechnicalRow.rsi);
  const macdForReason = pickTechnicalNumber(latestTechnical.macd, latestTechnicalRow.macd);
  const macdSignalForReason = pickTechnicalNumber(
    latestTechnical.macdSignal,
    latestTechnical.signal,
    latestTechnicalRow.macdSignal,
    latestTechnicalRow.signal,
  );
  const bbUpperForReason = pickTechnicalNumber(latestTechnical.bbUpper, latestTechnicalRow.bbUpper);
  const bbLowerForReason = pickTechnicalNumber(latestTechnical.bbLower, latestTechnicalRow.bbLower);

  const priceVsSma20Percent =
    closeForReason != null && sma20ForReason != null && sma20ForReason !== 0
      ? ((closeForReason - sma20ForReason) / sma20ForReason) * 100
      : null;
  const priceVsSma60Percent =
    closeForReason != null && sma60ForReason != null && sma60ForReason !== 0
      ? ((closeForReason - sma60ForReason) / sma60ForReason) * 100
      : null;
  const rsiToOverheatGap =
    rsiForReason != null ? 70 - rsiForReason : null;
  const macdSignalGap =
    macdForReason != null && macdSignalForReason != null
      ? macdForReason - macdSignalForReason
      : null;
  const bbUpperGapPercent =
    closeForReason != null && bbUpperForReason != null && closeForReason !== 0
      ? ((bbUpperForReason - closeForReason) / closeForReason) * 100
      : null;
  const bbLowerGapPercent =
    closeForReason != null && bbLowerForReason != null && closeForReason !== 0
      ? ((closeForReason - bbLowerForReason) / closeForReason) * 100
      : null;

  const sidewaysChartRows = rows.slice(-70);
  const sidewaysChartValues = sidewaysChartRows
    .flatMap((row: any) => [row.close, row.sma20, row.sma60, row.bbUpper, row.bbLower])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const sidewaysMinValue = sidewaysChartValues.length ? Math.min(...sidewaysChartValues) : 0;
  const sidewaysMaxValue = sidewaysChartValues.length ? Math.max(...sidewaysChartValues) : 1;
  const sidewaysRangeValue = sidewaysMaxValue - sidewaysMinValue || 1;

  const getSidewaysPoint = (index: number, value?: number | null) => {
    const width = 940;
    const height = 360;
    const padLeft = 58;
    const padRight = 48;
    const padTop = 28;
    const padBottom = 42;
    const count = Math.max(1, sidewaysChartRows.length - 1);
    const x = padLeft + ((width - padLeft - padRight) * index) / count;
    const y =
      padTop +
      ((height - padTop - padBottom) *
        (sidewaysMaxValue - (typeof value === "number" ? value : sidewaysMinValue))) /
        sidewaysRangeValue;

    return { x, y };
  };

  const makeSidewaysPath = (key: "close" | "sma20" | "sma60" | "bbUpper" | "bbLower") =>
    sidewaysChartRows
      .map((row: any, index) => {
        const value = row?.[key];

        if (typeof value !== "number" || !Number.isFinite(value)) return "";

        const point = getSidewaysPoint(index, value);
        return `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");

  const findClosestSidewaysIndex = (targetValue?: number | null) => {
    if (!sidewaysChartRows.length || targetValue == null || !Number.isFinite(targetValue)) {
      return Math.max(0, sidewaysChartRows.length - 1);
    }

    let bestIndex = 0;
    let bestGap = Number.POSITIVE_INFINITY;

    sidewaysChartRows.forEach((row: any, index) => {
      const close = pickTechnicalNumber(row?.close);

      if (close == null) return;

      const gap = Math.abs(close - targetValue);

      if (gap < bestGap) {
        bestGap = gap;
        bestIndex = index;
      }
    });

    return bestIndex;
  };

  const sidewaysLastIndex = Math.max(0, sidewaysChartRows.length - 1);
  const sidewaysMidIndex = Math.max(0, Math.floor(sidewaysChartRows.length * 0.55));
  const sidewaysEarlyIndex = Math.max(0, Math.floor(sidewaysChartRows.length * 0.2));
  const sidewaysLowIndex = findClosestSidewaysIndex(bbLowerForReason);
  const sidewaysUpperIndex = findClosestSidewaysIndex(bbUpperForReason);
  const sidewaysBaseTarget = technicalStrategy.priceRange.basePrice;
  const sidewaysLowerTarget = technicalStrategy.priceRange.lowerPrice;
  const sidewaysUpperTarget = technicalStrategy.priceRange.upperPrice;
return (
    <>
      {showSidewaysDetailModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="횡보 장세 상세 보기"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.52)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShowSidewaysDetailModal(false)}
        >
          <div
            style={{
              width: "min(1320px, 98vw)",
              maxHeight: "92vh",
              overflow: "auto",
              borderRadius: 24,
              background: "#ffffff",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.35)",
              padding: 24,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>횡보 장세 상세 보기</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 700 }}>
                  확대 가능 · 그래프에서 기준과 실제 수치를 한눈에 확인
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" onClick={() => setSidewaysModalZoom((zoom) => Math.max(0.8, Number((zoom - 0.1).toFixed(1))))} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontWeight: 900 }}>-</button>
                <strong style={{ minWidth: 52, textAlign: "center", color: "#475569" }}>{Math.round(sidewaysModalZoom * 100)}%</strong>
                <button type="button" onClick={() => setSidewaysModalZoom((zoom) => Math.min(1.6, Number((zoom + 0.1).toFixed(1))))} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontWeight: 900 }}>+</button>
                <button type="button" onClick={() => setShowSidewaysDetailModal(false)} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontWeight: 900 }}>×</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
              <div className="mini-stat" style={{ background: "#fff1f2", borderColor: "#fecaca" }}><span>현재가 vs SMA20</span><strong style={{ color: "#dc2626" }}>{formatTechnicalPercent(priceVsSma20Percent)}</strong></div>
              <div className="mini-stat" style={{ background: "#fff1f2", borderColor: "#fecaca" }}><span>현재가 vs SMA60</span><strong style={{ color: "#dc2626" }}>{formatTechnicalPercent(priceVsSma60Percent)}</strong></div>
              <div className="mini-stat" style={{ background: "#fffbeb", borderColor: "#facc15" }}><span>RSI14</span><strong>{formatTechnicalNumber(rsiForReason, 1)}</strong><small>70까지 {formatTechnicalNumber(rsiToOverheatGap, 1)}p</small></div>
              <div className="mini-stat" style={{ background: "#fffbeb", borderColor: "#facc15" }}><span>MACD - Signal</span><strong style={{ color: "#dc2626" }}>{formatTechnicalNumber(macdSignalGap, 2)}</strong></div>
              <div className="mini-stat" style={{ background: "#fffbeb", borderColor: "#facc15" }}><span>BB 상단까지</span><strong style={{ color: "#dc2626" }}>{formatTechnicalPercent(bbUpperGapPercent)}</strong></div>
              <div className="mini-stat" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}><span>BB 하단 대비</span><strong style={{ color: "#2563eb" }}>{formatTechnicalPercent(bbLowerGapPercent)}</strong></div>
            </div>

            <div style={{ transform: `scale(${sidewaysModalZoom})`, transformOrigin: "top left", width: `${100 / sidewaysModalZoom}%` }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 20, padding: 16, background: "#ffffff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 8 }}>
                  <strong style={{ color: "#0f172a" }}>차트 설명</strong>
                  <span style={{ color: "#ef4444", fontWeight: 800 }}>● 상승 사유</span>
                  <span style={{ color: "#f59e0b", fontWeight: 800 }}>● 횡보 사유</span>
                  <span style={{ color: "#2563eb", fontWeight: 800 }}>● 하락/지지</span>
                  <span style={{ color: "#ec4899", fontWeight: 800 }}>● 추정가</span>
                </div>

                <svg viewBox="0 0 1040 500" width="100%" height="500" role="img">
                  <rect x="0" y="0" width="1040" height="500" fill="#ffffff" />
                  {[0, 1, 2, 3, 4].map((line) => (
                    <line key={line} x1="58" x2="988" y1={30 + line * 72} y2={30 + line * 72} stroke="#e2e8f0" strokeDasharray="4 6" />
                  ))}

                  <path d={makeSidewaysPath("bbUpper")} fill="none" stroke="#c084fc" strokeWidth="2" strokeDasharray="7 6" opacity="0.7" />
                  <path d={makeSidewaysPath("bbLower")} fill="none" stroke="#c084fc" strokeWidth="2" strokeDasharray="7 6" opacity="0.7" />
                  <path d={makeSidewaysPath("sma20")} fill="none" stroke="#f97316" strokeWidth="3" />
                  <path d={makeSidewaysPath("sma60")} fill="none" stroke="#22c55e" strokeWidth="3" />
                  <path d={makeSidewaysPath("close")} fill="none" stroke="#2563eb" strokeWidth="3" />

                  <rect
                    x={getSidewaysPoint(sidewaysEarlyIndex, closeForReason).x}
                    y="105"
                    width={Math.max(300, getSidewaysPoint(sidewaysLastIndex, closeForReason).x - getSidewaysPoint(sidewaysEarlyIndex, closeForReason).x - 120)}
                    height="205"
                    fill="#fef3c7"
                    opacity="0.42"
                    stroke="#f59e0b"
                    strokeDasharray="8 6"
                  />
                  <text x="500" y="205" fill="#b45309" fontSize="18" fontWeight="900" textAnchor="middle">횡보 판단 구간</text>
                  <text x="500" y="230" fill="#92400e" fontSize="14" fontWeight="700" textAnchor="middle">상승 신호와 상단 부담이 동시에 확인</text>

                  {[
                    { index: sidewaysUpperIndex, value: bbUpperForReason, color: "#ef4444", title: "상승 신호", note: `BB 상단까지 ${formatTechnicalPercent(bbUpperGapPercent)}`, dx: -230, dy: -108 },
                    { index: sidewaysMidIndex, value: closeForReason, color: "#f59e0b", title: "횡보 근거", note: `RSI ${formatTechnicalNumber(rsiForReason, 1)} · 70까지 ${formatTechnicalNumber(rsiToOverheatGap, 1)}p`, dx: -110, dy: -92 },
                    { index: sidewaysLowIndex, value: bbLowerForReason, color: "#2563eb", title: "하락/지지", note: `BB 하단 대비 ${formatTechnicalPercent(bbLowerGapPercent)}`, dx: -20, dy: 82 },
                    { index: sidewaysLastIndex, value: sidewaysBaseTarget, color: "#ec4899", title: "기준 추정가", note: formatStrategyPrice(sidewaysBaseTarget), dx: -90, dy: -34 },
                    { index: Math.max(0, sidewaysLastIndex - 4), value: sidewaysLowerTarget, color: "#ec4899", title: "하단", note: formatStrategyPrice(sidewaysLowerTarget), dx: -90, dy: 92 },
                    { index: Math.max(0, sidewaysLastIndex - 2), value: sidewaysUpperTarget, color: "#ec4899", title: "상단", note: formatStrategyPrice(sidewaysUpperTarget), dx: -90, dy: -146 },
                  ].map((marker, index) => {
                    const point = getSidewaysPoint(marker.index, marker.value);
                    const boxX = Math.max(70, Math.min(900, point.x + marker.dx));
                    const boxY = Math.max(24, Math.min(348, point.y + marker.dy));

                    return (
                      <g key={index}>
                        <line x1={point.x} y1={point.y} x2={boxX + 70} y2={boxY + 34} stroke={marker.color} strokeWidth="2" opacity="0.75" />
                        <circle cx={point.x} cy={point.y} r="7" fill="#ffffff" stroke={marker.color} strokeWidth="4" />
                        <rect x={boxX} y={boxY} width="150" height="62" rx="10" fill="#ffffff" stroke={marker.color} strokeWidth="2" />
                        <text x={boxX + 75} y={boxY + 24} fill={marker.color} fontSize="15" fontWeight="900" textAnchor="middle">{marker.title}</text>
                        <text x={boxX + 75} y={boxY + 46} fill="#0f172a" fontSize="13" fontWeight="800" textAnchor="middle">{marker.note}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
                <div style={{ border: "1px solid #facc15", background: "#fffbeb", borderRadius: 18, padding: 16 }}>
                  <strong style={{ display: "block", color: "#d97706", fontSize: 18, marginBottom: 8 }}>왜 횡보 장세인가?</strong>
                  <p style={{ margin: 0, lineHeight: 1.7, color: "#334155", fontWeight: 700 }}>
                    현재가는 SMA20 대비 {formatTechnicalPercent(priceVsSma20Percent)}, SMA60 대비 {formatTechnicalPercent(priceVsSma60Percent)}로 추세선 위에 있습니다.
                    다만 RSI가 {formatTechnicalNumber(rsiForReason, 1)}로 과열선 70에 가까워졌고,
                    BB 상단까지 남은 거리가 {formatTechnicalPercent(bbUpperGapPercent)}에 불과해 상단 저항 부담이 있습니다.
                    그래서 강한 상승 확정이 아니라 횡보 장세로 분류합니다.
                  </p>
                </div>

                <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 18, padding: 16 }}>
                  <strong style={{ display: "block", color: "#0f172a", fontSize: 18, marginBottom: 8 }}>대응 의미</strong>
                  <p style={{ margin: 0, lineHeight: 1.7, color: "#475569", fontWeight: 700 }}>
                    신규 진입은 한 번에 들어가기보다 기준가와 하단 구간을 나누어 확인하는 분할 접근이 적합합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <section className="data-section">
        <Card>
          <SectionTitleSmall>기술적 기준 종합 해석</SectionTitleSmall>

          <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTechnicalPanel("market");
                  setShowSidewaysDetailModal(true);
                }}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 18,
                  border: activeTechnicalPanel === "market" ? "1px solid #ef4444" : "1px solid #e2e8f0",
                  background: activeTechnicalPanel === "market" ? "#fff1f2" : "#fff",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: "#ef4444" }}>1 시장 설명</span>
                <strong style={{ display: "block", marginTop: 10, fontSize: 24 }}>
                  {technicalStrategy.regimeLabel}
                </strong>
                <small style={{ display: "block", marginTop: 8, color: "#64748b", lineHeight: 1.5 }}>
                  상승 빨간색 · 횡보 노란색 · 하락 파란색
                </small>
              </button>

              <button
                type="button"
                onClick={() => setActiveTechnicalPanel("score")}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 18,
                  border: activeTechnicalPanel === "score" ? "1px solid #10b981" : "1px solid #e2e8f0",
                  background: activeTechnicalPanel === "score" ? "#ecfdf5" : "#fff",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: "#059669" }}>2 점수</span>
                <strong style={{ display: "block", marginTop: 10, fontSize: 30, color: "#059669" }}>
                  {technicalStrategy.finalScore}점
                </strong>
                <small style={{ display: "block", marginTop: 8, color: "#64748b", lineHeight: 1.5 }}>
                  누르면 점수표 표시
                </small>
              </button>

              <button
                type="button"
                onClick={() => setActiveTechnicalPanel("interpretation")}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 18,
                  border: activeTechnicalPanel === "interpretation" ? "1px solid #2563eb" : "1px solid #e2e8f0",
                  background: activeTechnicalPanel === "interpretation" ? "#eff6ff" : "#fff",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}>3 점수 해석</span>
                <strong style={{ display: "block", marginTop: 10, fontSize: 24, color: "#1d4ed8" }}>
                  {technicalStrategy.actionLabel}
                </strong>
                <small style={{ display: "block", marginTop: 8, color: "#64748b", lineHeight: 1.5 }}>
                  매수 · 관망 · 회피 · 보유 의미
                </small>
              </button>

              <button
                type="button"
                onClick={() => setActiveTechnicalPanel("price")}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 18,
                  border: activeTechnicalPanel === "price" ? "1px solid #ec4899" : "1px solid #e2e8f0",
                  background: activeTechnicalPanel === "price" ? "#fdf2f8" : "#fff",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: "#db2777" }}>4 추정가</span>
                <strong style={{ display: "block", marginTop: 10, fontSize: 22, color: "#be185d" }}>
                  기준 {formatStrategyPrice(technicalStrategy.priceRange.basePrice)}
                </strong>
                <small style={{ display: "block", marginTop: 8, color: "#64748b", lineHeight: 1.5 }}>
                  하단~상단 범위의 대표 추정가
                </small>
              </button>

              <button
                type="button"
                onClick={() => setActiveTechnicalPanel("signal")}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 18,
                  border: activeTechnicalPanel === "signal" ? "1px solid #7c3aed" : "1px solid #e2e8f0",
                  background: activeTechnicalPanel === "signal" ? "#f5f3ff" : "#fff",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed" }}>5 시그널</span>
                <strong style={{ display: "block", marginTop: 10, fontSize: 24, color: "#5b21b6" }}>
                  {technicalStrategy.tradeSignals.some((signal) => signal.active) ? "활성 신호" : "관망 우선"}
                </strong>
                <small style={{ display: "block", marginTop: 8, color: "#64748b", lineHeight: 1.5 }}>
                  진입 · 분할매수 · 손절 · 익절 · 청산
                </small>
              </button>
            </div>

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 18,
                padding: 18,
                background: "#fff",
              }}
            >
              {activeTechnicalPanel === "market" ? (
                <div>
                  <div className="target-basis-header">
                    <span>시장 설명</span>
                    <strong style={{ color: regimeColor }}>{technicalStrategy.regimeLabel}</strong>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div
                      className="mini-stat"
                      style={{
                        borderColor: priceVsSma20Percent != null && priceVsSma20Percent >= 0 ? "#fecaca" : "#bfdbfe",
                        background: priceVsSma20Percent != null && priceVsSma20Percent >= 0 ? "#fff1f2" : "#eff6ff",
                      }}
                    >
                      <span>현재가 vs SMA20</span>
                      <strong>{formatTechnicalPercent(priceVsSma20Percent)}</strong>
                      <small>단기 추세선 대비 위치</small>
                    </div>

                    <div
                      className="mini-stat"
                      style={{
                        borderColor: priceVsSma60Percent != null && priceVsSma60Percent >= 0 ? "#fecaca" : "#bfdbfe",
                        background: priceVsSma60Percent != null && priceVsSma60Percent >= 0 ? "#fff1f2" : "#eff6ff",
                      }}
                    >
                      <span>현재가 vs SMA60</span>
                      <strong>{formatTechnicalPercent(priceVsSma60Percent)}</strong>
                      <small>중기 추세선 대비 위치</small>
                    </div>

                    <div
                      className="mini-stat"
                      style={{
                        borderColor: "#facc15",
                        background: "#fffbeb",
                      }}
                    >
                      <span>RSI14</span>
                      <strong>{formatTechnicalNumber(rsiForReason, 1)}</strong>
                      <small>
                        과열선 70까지 {formatTechnicalNumber(rsiToOverheatGap, 1)}p
                      </small>
                    </div>

                    <div
                      className="mini-stat"
                      style={{
                        borderColor: macdSignalGap != null && macdSignalGap >= 0 ? "#fecaca" : "#bfdbfe",
                        background: macdSignalGap != null && macdSignalGap >= 0 ? "#fff1f2" : "#eff6ff",
                      }}
                    >
                      <span>MACD - Signal</span>
                      <strong>{formatTechnicalNumber(macdSignalGap, 2)}</strong>
                      <small>0보다 크면 단기 모멘텀 우위</small>
                    </div>

                    <div
                      className="mini-stat"
                      style={{
                        borderColor: "#facc15",
                        background: "#fffbeb",
                      }}
                    >
                      <span>BB 상단까지</span>
                      <strong>{formatTechnicalPercent(bbUpperGapPercent)}</strong>
                      <small>상단 저항까지 남은 거리</small>
                    </div>

                    <div
                      className="mini-stat"
                      style={{
                        borderColor: "#e2e8f0",
                        background: "#ffffff",
                      }}
                    >
                      <span>BB 하단 대비</span>
                      <strong>{formatTechnicalPercent(bbLowerGapPercent)}</strong>
                      <small>하단 지지선과의 거리</small>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 16,
                      border: `1px solid ${regimeBorder}`,
                      background: regimeBackground,
                    }}
                  >
                    <strong style={{ display: "block", color: regimeColor, marginBottom: 8 }}>
                      왜 {technicalStrategy.regimeLabel}인가?
                    </strong>
                    <p style={{ margin: 0, lineHeight: 1.7 }}>
                      {regimeSimpleReason}
                    </p>
                    <p style={{ margin: "8px 0 0", lineHeight: 1.7 }}>
                      수치상으로는 현재가가 이동평균선 대비 어느 위치에 있는지, RSI가 과열선 70에 얼마나 가까운지,
                      MACD가 Signal보다 얼마나 우위인지, 볼린저밴드 상단까지 남은 거리를 함께 봅니다.
                    </p>
                  </div>
                </div>
              ) : null}

              {activeTechnicalPanel === "score" ? (
                <div>
                  <div className="target-basis-header">
                    <span>점수표</span>
                    <strong>TABLE 기준</strong>
                  </div>
                  <div className="target-basis-adjustments" style={{ marginTop: 12 }}>
                    {technicalStrategy.rows.map((row) => (
                      <p key={row.key}>
                        {row.label}: {row.score}/{row.maxScore}점 · {row.status} · {row.reason}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTechnicalPanel === "interpretation" ? (
                <div>
                  <div className="target-basis-header">
                    <span>점수 해석</span>
                    <strong>{technicalStrategy.actionLabel}</strong>
                  </div>
                  <div className="target-basis-adjustments" style={{ marginTop: 12 }}>
                    <p>{technicalStrategy.actionDescription}</p>
                    <p>현재 점수는 {technicalStrategy.finalScore}점입니다. 점수별 의미를 매수, 관망, 회피, 보유관리로 나눠 보여줍니다.</p>
                  </div>
                </div>
              ) : null}

              {activeTechnicalPanel === "price" ? (
                <div>
                  <div className="target-basis-header">
                    <span>추정가 범위</span>
                    <strong>기준 = 대표 추정가</strong>
                  </div>

                  <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
                    <div className="mini-stat">
                      <span>하단</span>
                      <strong>{formatStrategyPrice(technicalStrategy.priceRange.lowerPrice)}</strong>
                      <small>보수적 기준가</small>
                    </div>
                    <div className="mini-stat" style={{ borderColor: "#f9a8d4", background: "#fdf2f8" }}>
                      <span>기준</span>
                      <strong>{formatStrategyPrice(technicalStrategy.priceRange.basePrice)}</strong>
                      <small>대표 추정가</small>
                    </div>
                    <div className="mini-stat">
                      <span>상단</span>
                      <strong>{formatStrategyPrice(technicalStrategy.priceRange.upperPrice)}</strong>
                      <small>낙관적 기준가</small>
                    </div>
                    <div className="mini-stat">
                      <span>의미</span>
                      <strong>예상 범위</strong>
                      <small>기준값은 하단~상단 범위의 중심 기준입니다.</small>
                    </div>
                  </div>

                  <div className="target-basis-adjustments" style={{ marginTop: 12 }}>
                    <p>하단 근거: {technicalStrategy.priceRange.lowerBasis.join(" · ") || "데이터 대기"}</p>
                    <p>기준 근거: {technicalStrategy.priceRange.baseBasis.join(" · ") || "데이터 대기"}</p>
                    <p>상단 근거: {technicalStrategy.priceRange.upperBasis.join(" · ") || "데이터 대기"}</p>
                    <p>추정가 근거는 그래프에서 분홍색 점과 금액으로 표시하는 구조입니다.</p>
                  </div>
                </div>
              ) : null}

              {activeTechnicalPanel === "signal" ? (
                <div>
                  <div className="target-basis-header">
                    <span>시그널</span>
                    <strong>
                      {technicalStrategy.tradeSignals.filter((signal) => signal.active).length
                        ? "활성 신호 있음"
                        : "관망 우선"}
                    </strong>
                  </div>
                  <div className="target-basis-adjustments" style={{ marginTop: 12 }}>
                    {technicalStrategy.tradeSignals.map((signal) => (
                      <p key={signal.type}>
                        {signal.label}: {signal.active ? "활성" : "비활성"}
                        {" · "}
                        강도 {signal.strength}
                        {" · "}
                        기준가 {formatStrategyPrice(signal.price)}
                        {" · "}
                        {signal.reason}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="target-basis-header">
            <span>차트 기준 결론</span>
            <strong>{technicalSummary.overall}</strong>
          </div>
          <p className="target-basis-summary" style={{ marginTop: 12 }}>
            {technicalSummary.summary}
          </p>
          <div className="metric-list" style={{ marginTop: 12 }}>
            <MetricRow label="RSI14" value={formatNumber(latestRow?.rsi14)} />
            <MetricRow label="MACD" value={formatNumber(latestRow?.macd)} />
            <MetricRow label="볼린저밴드" value={bbStatus} />
            <MetricRow label="OBV 추세" value={obvTrend} />
          </div>
        </Card>
      </section>

      <section className="chart-stack">
        <Card className="chart-card">
          <ChartHeader
            title="주가 차트"
            description={`${data?.symbol || "-"} / 종가, SMA20, SMA60, Bollinger Band`}
          />
          <PriceChart rows={rows} />
        </Card>

        <section className="indicator-grid">
          <Card className="chart-card">
            <ChartHeader
              title="RSI14"
              description="일반적으로 70 이상 과열, 30 이하 과매도 구간으로 참고"
            />
            <LineChart
              rows={rows}
              dataKey="rsi14"
              stroke="#7c3aed"
              fixedMin={0}
              fixedMax={100}
              guides={[30, 70]}
            />
          </Card>

          <Card className="chart-card">
            <ChartHeader title="MACD" description="MACD / Signal / Histogram" />
            <MacdChart rows={rows} />
          </Card>
        </section>

        <section className="indicator-grid">
          <Card className="chart-card">
            <ChartHeader
              title="매물대 차트"
              description="과거 종가 구간별 거래량 합산 기반 추정"
            />
            <VolumeProfileChart rows={rows} />
          </Card>

          <Card className="chart-card">
            <ChartHeader
              title="OBV"
              description="거래량 흐름으로 매수·매도 압력 참고"
            />
            <LineChart rows={rows} dataKey="obv" stroke="#0f766e" />
          </Card>
        </section>
      </section>

      <section className="data-section">
        <Card>
          <SectionTitleSmall>주가 분석 TOOL</SectionTitleSmall>
          <div className="metric-list">
            <MetricRow label="RSI14" value={formatNumber(latestRow?.rsi14)} />
            <MetricRow label="MACD" value={formatNumber(latestRow?.macd)} />
            <MetricRow label="Signal" value={formatNumber(latestRow?.signal)} />
            <MetricRow
              label="Histogram"
              value={formatNumber(latestRow?.histogram)}
            />
            <MetricRow label="Bollinger Band" value={bbStatus} />
            <MetricRow label="BB Upper" value={formatNumber(latestRow?.bbUpper)} />
            <MetricRow label="BB Lower" value={formatNumber(latestRow?.bbLower)} />
            <MetricRow label="OBV" value={formatCompactNumber(latestRow?.obv)} />
            <MetricRow label="OBV 추세" value={obvTrend} />
            <MetricRow
              label="Fear & Greed"
              value={
                data?.fearGreed
                  ? `${data.fearGreed.score} / 100 · ${data.fearGreed.label}`
                  : "데이터 없음"
              }
            />
          </div>
          <p className="notice-text">
            Fear & Greed는 외부 지수가 아니라 RSI, MACD, 이동평균, 당일
            등락률, OBV를 이용한 자체 참고 점수입니다.
          </p>
        </Card>
      </section>

      <section className="data-section">
        <Card>
          <SectionTitleSmall>최근 10일 데이터</SectionTitleSmall>
          {recentRows.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <Th>날짜</Th>
                    <Th>종가</Th>
                    <Th>SMA20</Th>
                    <Th>SMA60</Th>
                    <Th>BB 상단</Th>
                    <Th>BB 하단</Th>
                    <Th>RSI14</Th>
                    <Th>MACD</Th>
                    <Th>Signal</Th>
                    <Th>Histogram</Th>
                    <Th>OBV</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((row) => (
                    <tr key={row.date}>
                      <Td>{row.date}</Td>
                      <Td>{formatNumber(row.close)}</Td>
                      <Td>{formatNumber(row.sma20)}</Td>
                      <Td>{formatNumber(row.sma60)}</Td>
                      <Td>{formatNumber(row.bbUpper)}</Td>
                      <Td>{formatNumber(row.bbLower)}</Td>
                      <Td>{formatNumber(row.rsi14)}</Td>
                      <Td>{formatNumber(row.macd)}</Td>
                      <Td>{formatNumber(row.signal)}</Td>
                      <Td>{formatNumber(row.histogram)}</Td>
                      <Td>{formatCompactNumber(row.obv)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-text">표시할 최근 데이터가 없습니다.</p>
          )}
        </Card>
      </section>
    </>
  );
}

function makeTechnicalSummary(
  data: StockResponse | null,
  latestRow: ChartRow | null,
  bbStatus: string,
  obvTrend: string,
) {
  const signal = data?.signalSummary || "데이터 없음";
  const rsi = typeof latestRow?.rsi14 === "number" ? latestRow.rsi14 : null;
  const macd = typeof latestRow?.macd === "number" ? latestRow.macd : null;
  const signalLine = typeof latestRow?.signal === "number" ? latestRow.signal : null;

  const rsiText =
    rsi == null
      ? "RSI 데이터는 아직 부족합니다."
      : rsi >= 70
        ? "RSI가 70 이상으로 단기 과열 여부를 확인해야 합니다."
        : rsi <= 30
          ? "RSI가 30 이하로 단기 과매도 구간을 참고할 수 있습니다."
          : "RSI는 중립권에 있어 과열·과매도 신호는 제한적입니다.";

  const macdText =
    macd == null || signalLine == null
      ? "MACD 데이터는 아직 부족합니다."
      : macd >= signalLine
        ? "MACD가 Signal보다 높아 단기 흐름은 상대적으로 우호적입니다."
        : "MACD가 Signal보다 낮아 단기 모멘텀 약화 가능성을 확인해야 합니다.";

  return {
    overall: signal,
    summary: `기술적 기준은 현재가, 이동평균, RSI, MACD, 볼린저밴드, OBV를 묶어 본 차트 중심 해석입니다. ${rsiText} ${macdText} 볼린저밴드는 ${bbStatus}, OBV 흐름은 ${obvTrend}로 확인됩니다.`,
  };
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

function ChartHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="chart-header">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="info-card">
      <div className="info-label">{title}</div>
      {children}
    </div>
  );
}

function BigValue({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "positive" | "negative" | "neutral";
}) {
  return <div className={`big-value ${tone}`}>{children}</div>;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SupplyMetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="supply-metric-card">
      <span>{title}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function SupplyJudgement({ title, value }: { title: string; value: string }) {
  return (
    <div className="supply-judgement">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PriceChart({ rows }: { rows: ChartRow[] }) {
  const priceTrendLines = useMemo(() => buildPriceTrendLines(rows), [rows]);
return (
    <div className="chart-inner">
      <Legend
        items={[
          { label: "종가", color: "#2563eb" },
          { label: "SMA20", color: "#f59e0b" },
          { label: "SMA60", color: "#10b981" },
          { label: "BB 상단", color: "#94a3b8" },
          { label: "BB 하단", color: "#94a3b8" },
        ]}
      />
      <MultiLineChart
        rows={rows}
        lines={[
          { key: "close", color: "#2563eb" },
          { key: "sma20", color: "#f59e0b" },
          { key: "sma60", color: "#10b981" },
          { key: "bbUpper", color: "#94a3b8", dashed: true },
          { key: "bbLower", color: "#94a3b8", dashed: true },
        ]}
        trendLines={priceTrendLines}
        showDates
      />
    </div>
  );
}

function MacdChart({ rows }: { rows: ChartRow[] }) {
  const filtered = rows.filter(
    (r) => r.macd != null || r.signal != null || r.histogram != null,
  );

  if (!filtered.length) return <EmptyChartMessage />;

  const width = 1000;
  const height = 300;
  const pad = { top: 24, right: 26, bottom: 44, left: 26 };
  const plotHeight = height - pad.top - pad.bottom;

  const histValues = filtered
    .map((r) => r.histogram)
    .filter((v): v is number => v != null && !Number.isNaN(v));
  const lineValues = filtered
    .flatMap((r) => [r.macd, r.signal])
    .filter((v): v is number => v != null && !Number.isNaN(v));

  const all = [...histValues, ...lineValues, 0];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;

  const x = (i: number) =>
    filtered.length === 1
      ? width / 2
      : pad.left + (i / (filtered.length - 1)) * (width - pad.left - pad.right);

  const y = (v: number) =>
    pad.top + plotHeight - ((v - min) / range) * plotHeight;
  const zeroY = y(0);

  const macdPoints = filtered
    .map((r, i) => ({ x: x(i), y: y(r.macd ?? 0), v: r.macd }))
    .filter(isValidPoint);

  const signalPoints = filtered
    .map((r, i) => ({ x: x(i), y: y(r.signal ?? 0), v: r.signal }))
    .filter(isValidPoint);

  return (
    <div className="chart-inner">
      <Legend
        items={[
          { label: "MACD", color: "#2563eb" },
          { label: "Signal", color: "#ef4444" },
          { label: "Histogram +", color: "#16a34a" },
          { label: "Histogram -", color: "#dc2626" },
        ]}
      />

      <svg className="chart-svg macd-svg" viewBox={`0 0 ${width} ${height}`}>
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
        <GridLines
          width={width}
          height={height}
          padTop={pad.top}
          padRight={pad.right}
          padBottom={pad.bottom}
          padLeft={pad.left}
          lines={4}
        />
        <line
          x1={pad.left}
          y1={zeroY}
          x2={width - pad.right}
          y2={zeroY}
          stroke="#94a3b8"
          strokeDasharray="4 4"
        />

        {filtered.map((r, i) => {
          const xv = x(i);
          const hv = r.histogram ?? 0;
          const yv = y(hv);
          const top = Math.min(zeroY, yv);
          const barH = Math.max(1, Math.abs(zeroY - yv));
          const barW = Math.max(
            4,
            (width - pad.left - pad.right) /
              Math.max(filtered.length * 1.8, 20),
          );

          return (
            <rect
              key={`${r.date}-hist`}
              x={xv - barW / 2}
              y={top}
              width={barW}
              height={barH}
              fill={hv >= 0 ? "#16a34a" : "#dc2626"}
              opacity={0.75}
            />
          );
        })}

        {macdPoints.length > 0 && (
          <path
            d={buildPath(macdPoints)}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
          />
        )}
        {signalPoints.length > 0 && (
          <path
            d={buildPath(signalPoints)}
            fill="none"
            stroke="#ef4444"
            strokeWidth="3"
          />
        )}

        <DateLabels
          rows={filtered}
          width={width}
          height={height}
          padLeft={pad.left}
          padRight={pad.right}
        />
      </svg>
    </div>
  );
}

function LineChart({
  rows,
  dataKey,
  stroke,
  fixedMin,
  fixedMax,
  guides = [],
}: {
  rows: ChartRow[];
  dataKey: keyof ChartRow;
  stroke: string;
  fixedMin?: number;
  fixedMax?: number;
  guides?: number[];
}) {
  const filtered = rows.filter((r) => {
    const v = r[dataKey];
    return typeof v === "number" && !Number.isNaN(v);
  });

  if (!filtered.length) return <EmptyChartMessage />;

  const width = 1000;
  const height = 280;
  const pad = { top: 24, right: 26, bottom: 44, left: 26 };
  const plotHeight = height - pad.top - pad.bottom;

  const values = filtered
    .map((r) => r[dataKey])
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

  const min = fixedMin ?? Math.min(...values);
  const max = fixedMax ?? Math.max(...values);
  const range = max - min || 1;

  const points = filtered.map((r, i) => {
    const value = r[dataKey] as number;
    const x =
      filtered.length === 1
        ? width / 2
        : pad.left +
          (i / (filtered.length - 1)) * (width - pad.left - pad.right);
    const y = pad.top + plotHeight - ((value - min) / range) * plotHeight;
    return { x, y, v: value };
  });

  return (
    <svg className="chart-svg line-svg" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
      <GridLines
        width={width}
        height={height}
        padTop={pad.top}
        padRight={pad.right}
        padBottom={pad.bottom}
        padLeft={pad.left}
        lines={4}
      />

      {guides.map((g) => {
        const gy = pad.top + plotHeight - ((g - min) / range) * plotHeight;
        return (
          <line
            key={g}
            x1={pad.left}
            y1={gy}
            x2={width - pad.right}
            y2={gy}
            stroke="#cbd5e1"
            strokeDasharray="5 5"
          />
        );
      })}

      <path d={buildPath(points)} fill="none" stroke={stroke} strokeWidth="3" />
      <DateLabels
        rows={filtered}
        width={width}
        height={height}
        padLeft={pad.left}
        padRight={pad.right}
      />
    </svg>
  );
}

function MultiLineChart({
  rows,
  lines,
  showDates = false,
  trendLines = [],
}: {
  rows: ChartRow[];
  lines: LineSpec[];
  showDates?: boolean;
  trendLines?: PriceTrendLine[];
}) {
  const filtered = rows.filter((r) =>
    lines.some(
      ({ key }) =>
        typeof r[key] === "number" && !Number.isNaN(r[key] as number),
    ),
  );

  if (!filtered.length) return <EmptyChartMessage />;

  const width = 1000;
  const height = 360;
  const pad = { top: 24, right: 26, bottom: 52, left: 26 };
  const plotHeight = height - pad.top - pad.bottom;

  const values = filtered.flatMap((r) =>
    lines
      .map(({ key }) => r[key])
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v)),
  );

  const trendLineValues = trendLines.flatMap((line) => [line.startValue, line.endValue]);
  const allValues = [...values, ...trendLineValues].filter(
    (value): value is number => typeof value === "number" && !Number.isNaN(value),
  );

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const linePaths = lines.map(({ key, color, dashed }) => {
    const points = filtered.map((r, i) => {
      const raw = r[key];
      const value = typeof raw === "number" ? raw : null;
      const x =
        filtered.length === 1
          ? width / 2
          : pad.left +
            (i / (filtered.length - 1)) * (width - pad.left - pad.right);
      if (value == null || Number.isNaN(value)) return { x, y: 0, v: null };
      const y = pad.top + plotHeight - ((value - min) / range) * plotHeight;
      return { x, y, v: value };
    });

    return { key: String(key), color, dashed, d: buildPath(points) };
  });

  return (
    <svg className="chart-svg price-svg" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
      <GridLines
        width={width}
        height={height}
        padTop={pad.top}
        padRight={pad.right}
        padBottom={pad.bottom}
        padLeft={pad.left}
        lines={5}
      />
      {linePaths.map((line) => (
        <path
          key={line.key}
          d={line.d}
          fill="none"
          stroke={line.color}
          strokeWidth={line.dashed ? "2" : "3"}
          strokeDasharray={line.dashed ? "7 6" : undefined}
        />
      ))}
            {trendLines.map((line) => {
        const denominator = Math.max(filtered.length - 1, 1);
        const x1 =
          filtered.length === 1
            ? width / 2
            : pad.left + (line.startIndex / denominator) * (width - pad.left - pad.right);
        const x2 =
          filtered.length === 1
            ? width / 2
            : pad.left + (line.endIndex / denominator) * (width - pad.left - pad.right);
        const y1 = pad.top + plotHeight - ((line.startValue - min) / range) * plotHeight;
        const y2 = pad.top + plotHeight - ((line.endValue - min) / range) * plotHeight;

        return (
          <path
            key={line.key}
            d={`M ${x1} ${y1} L ${x2} ${y2}`}
            fill="none"
            stroke={line.color}
            strokeWidth="2.5"
            strokeDasharray={line.dashed ? "7 6" : "4 5"}
            opacity="0.9"
          />
        );
      })}

{showDates ? (
        <DateLabels
          rows={filtered}
          width={width}
          height={height}
          padLeft={pad.left}
          padRight={pad.right}
        />
      ) : null}
    </svg>
  );
}

function VolumeProfileChart({ rows }: { rows: ChartRow[] }) {
  const buckets = useMemo(() => buildVolumeProfile(rows, 10), [rows]);

  if (!buckets.length) return <EmptyChartMessage />;

  const maxVolume = Math.max(...buckets.map((bucket) => bucket.volume));

  return (
    <div className="volume-profile">
      {buckets.map((bucket) => {
        const width =
          maxVolume > 0 ? Math.max(4, (bucket.volume / maxVolume) * 100) : 0;
        return (
          <div className="volume-profile-row" key={bucket.label}>
            <span className="volume-price">{bucket.label}</span>
            <div className="volume-bar-track">
              <div className="volume-bar" style={{ width: `${width}%` }} />
            </div>
            <span className="volume-value">
              {formatCompactNumber(bucket.volume)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GridLines({
  width,
  height,
  padTop,
  padRight,
  padBottom,
  padLeft,
  lines,
}: {
  width: number;
  height: number;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  lines: number;
}) {
  return (
    <>
      {Array.from({ length: lines + 1 }).map((_, i) => {
        const y = padTop + (i / lines) * (height - padTop - padBottom);
        return (
          <line
            key={i}
            x1={padLeft}
            y1={y}
            x2={width - padRight}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        );
      })}
    </>
  );
}

function DateLabels({
  rows,
  width,
  height,
  padLeft,
  padRight,
}: {
  rows: ChartRow[];
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
}) {
  const indexes = getLabelIndexes(rows.length, 5);

  return (
    <>
      {indexes.map((index) => {
        const x =
          rows.length === 1
            ? width / 2
            : padLeft +
              (index / (rows.length - 1)) * (width - padLeft - padRight);
        return (
          <text
            key={`${rows[index]?.date}-${index}`}
            x={x}
            y={height - 14}
            textAnchor="middle"
            className="chart-date-label"
          >
            {formatDateLabel(rows[index]?.date)}
          </text>
        );
      })}
    </>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <div key={item.label} className="legend-item">
          <span className="legend-dot" style={{ background: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyChartMessage() {
  return <div className="empty-chart">그래프를 표시할 데이터가 없습니다.</div>;
}

function buildPath(
  points: Array<{ x: number; y: number; v: number | null | undefined }>,
) {
  let d = "";
  points.forEach((p) => {
    if (p.v == null || Number.isNaN(p.v)) return;
    d += `${d ? " L" : "M"} ${p.x} ${p.y}`;
  });
  return d;
}

function isValidPoint(point: {
  x: number;
  y: number;
  v: number | null | undefined;
}): point is { x: number; y: number; v: number } {
  return typeof point.v === "number" && !Number.isNaN(point.v);
}


function buildPriceTrendLines(rows: ChartRow[]): PriceTrendLine[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const recentStart = Math.max(0, sorted.length - 60);
  const recentRows = sorted.slice(recentStart);

  if (recentRows.length < 10) return [];

  const lines: PriceTrendLine[] = [];

  const resistance = buildPivotLine({
    rows: recentRows,
    absoluteOffset: recentStart,
    key: "high",
    type: "pivotResistance",
    label: "Resistance",
    color: "#dc2626",
    pickHigh: true,
  });

  if (resistance) lines.push(resistance);

  const support = buildPivotLine({
    rows: recentRows,
    absoluteOffset: recentStart,
    key: "low",
    type: "pivotSupport",
    label: "Support",
    color: "#16a34a",
    pickHigh: false,
  });

  if (support) lines.push(support);

  const regression = buildLinearRegressionLine(recentRows, recentStart);

  if (regression) lines.push(regression);

  return lines;
}

function buildPivotLine({
  rows,
  absoluteOffset,
  key,
  type,
  label,
  color,
  pickHigh,
}: {
  rows: ChartRow[];
  absoluteOffset: number;
  key: "high" | "low";
  type: PriceTrendLine["key"];
  label: string;
  color: string;
  pickHigh: boolean;
}): PriceTrendLine | null {
  const pivots: Array<{ index: number; value: number }> = [];

  for (let i = 2; i < rows.length - 2; i += 1) {
    const value = rows[i]?.[key];

    if (typeof value !== "number" || Number.isNaN(value)) continue;

    const neighbors = [
      rows[i - 2]?.[key],
      rows[i - 1]?.[key],
      rows[i + 1]?.[key],
      rows[i + 2]?.[key],
    ].filter((item): item is number => typeof item === "number" && !Number.isNaN(item));

    if (neighbors.length < 4) continue;

    const isPivot = pickHigh
      ? neighbors.every((neighbor) => value >= neighbor)
      : neighbors.every((neighbor) => value <= neighbor);

    if (isPivot) {
      pivots.push({ index: absoluteOffset + i, value });
    }
  }

  const selected = pivots.slice(-4);

  if (selected.length < 2) return null;

  const first = selected[0];
  const last = selected[selected.length - 1];

  if (!first || !last || first.index === last.index) return null;

  return {
    key: type,
    label,
    color,
    startIndex: first.index,
    endIndex: last.index,
    startValue: first.value,
    endValue: last.value,
    dashed: true,
  };
}

function buildLinearRegressionLine(rows: ChartRow[], absoluteOffset: number): PriceTrendLine | null {
  const points = rows
    .map((row, index) => ({
      x: index,
      y: row.close,
    }))
    .filter((point): point is { x: number; y: number } => {
      return typeof point.y === "number" && !Number.isNaN(point.y);
    });

  if (points.length < 10) return null;

  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;

  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const first = points[0];
  const last = points[points.length - 1];

  if (!first || !last) return null;

  return {
    key: "linearRegression",
    label: slope >= 0 ? "Regression Up" : "Regression Down",
    color: "#7c3aed",
    startIndex: absoluteOffset + first.x,
    endIndex: absoluteOffset + last.x,
    startValue: intercept + slope * first.x,
    endValue: intercept + slope * last.x,
    dashed: false,
  };
}

function buildVolumeProfile(rows: ChartRow[], bucketCount: number) {
  const validRows = rows.filter(
    (row) => typeof row.close === "number" && typeof row.volume === "number",
  );
  if (!validRows.length) return [];

  const closes = validRows.map((row) => row.close as number);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const bucketSize = range / bucketCount;

  const buckets = Array.from({ length: bucketCount }).map((_, index) => {
    const low = min + bucketSize * index;
    const high =
      index === bucketCount - 1 ? max : min + bucketSize * (index + 1);
    return { low, high, volume: 0 };
  });

  validRows.forEach((row) => {
    const close = row.close as number;
    const volume = row.volume ?? 0;
    const index = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((close - min) / bucketSize)),
    );
    buckets[index].volume += volume;
  });

  return buckets.reverse().map((bucket) => ({
    label: `${formatShortPrice(bucket.low)}~${formatShortPrice(bucket.high)}`,
    volume: bucket.volume,
  }));
}

function getLabelIndexes(length: number, count: number) {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);

  const indexes = new Set<number>();
  for (let i = 0; i < count; i++) {
    indexes.add(Math.round((i / (count - 1)) * (length - 1)));
  }
  return Array.from(indexes).sort((a, b) => a - b);
}

function getBollingerStatus(
  close?: number | null,
  upper?: number | null,
  lower?: number | null,
) {
  if (close == null || upper == null || lower == null) return "데이터 없음";
  const bandWidth = upper - lower;
  if (bandWidth <= 0) return "데이터 없음";
  const position = (close - lower) / bandWidth;

  if (position >= 0.9) return "상단 근접";
  if (position <= 0.1) return "하단 근접";
  if (position >= 0.6) return "상단권";
  if (position <= 0.4) return "하단권";
  return "중앙권";
}

function getObvTrend(now?: number | null, prev?: number | null) {
  if (now == null || prev == null) return "데이터 없음";
  if (now > prev) return "상승";
  if (now < prev) return "하락";
  return "보합";
}

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatCompactNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateLabel(date?: string) {
  if (!date) return "-";
  const [, month, day] = date.split("-");
  return `${month}/${day}`;
}

function formatShortPrice(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td>{children}</td>;
}

function formatStrategyPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return (
    new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 0,
    }).format(value) + "원"
  );
}

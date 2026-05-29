"use client";

import { useMemo, type ReactNode } from "react";
import type { ChartRow, StockResponse } from "../../types/stock";
import { calculateTechnicalStrategy } from "../../lib/technicalStrategy";

type LineSpec = {
  key: keyof ChartRow;
  color: string;
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
return (
    <>
      <section className="data-section">
        <Card>
          <SectionTitleSmall>기술적 기준 종합 해석</SectionTitleSmall>
          <div className="target-basis-box" style={{ marginTop: 14 }}>
            <div className="target-basis-header">
              <span>기술전략 종합판정</span>
              <strong>{technicalStrategy.summary}</strong>
            </div>

            <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
              <div className="mini-stat">
                <span>장세</span>
                <strong>{technicalStrategy.regimeLabel}</strong>
                <small>{technicalStrategy.regimeDescription}</small>
              </div>

              <div className="mini-stat">
                <span>최종 점수</span>
                <strong>{technicalStrategy.finalScore}점</strong>
                <small>
                  공통 {technicalStrategy.commonScore}점 · 장세 {technicalStrategy.regimeBonus >= 0 ? "+" : ""}
                  {technicalStrategy.regimeBonus}점 · 위험 -{technicalStrategy.riskPenalty}점
                </small>
              </div>

              <div className="mini-stat">
                <span>점수 해석</span>
                <strong>{technicalStrategy.actionLabel}</strong>
                <small>{technicalStrategy.actionDescription}</small>
              </div>

              <div className="mini-stat">
                <span>신뢰도</span>
                <strong>{technicalStrategy.priceRange.confidence}</strong>
                <small>{technicalStrategy.priceRange.summary}</small>
              </div>
            </div>

            <div className="target-basis-adjustments" style={{ marginTop: 12 }}>
              <p>
                하단 추정가: {formatStrategyPrice(technicalStrategy.priceRange.lowerPrice)}
                {" / "}
                기준 추정가: {formatStrategyPrice(technicalStrategy.priceRange.basePrice)}
                {" / "}
                상단 추정가: {formatStrategyPrice(technicalStrategy.priceRange.upperPrice)}
              </p>
              <p>하단 근거: {technicalStrategy.priceRange.lowerBasis.join(" · ") || "데이터 대기"}</p>
              <p>기준 근거: {technicalStrategy.priceRange.baseBasis.join(" · ") || "데이터 대기"}</p>
              <p>상단 근거: {technicalStrategy.priceRange.upperBasis.join(" · ") || "데이터 대기"}</p>
            </div>

            <div className="target-basis-box" style={{ marginTop: 12 }}>
              <div className="target-basis-header">
                <span>매매 시그널</span>
                <strong>
                  {technicalStrategy.tradeSignals.filter((signal) => signal.active).length
                    ? "활성 신호 있음"
                    : "관망 우선"}
                </strong>
              </div>

              <div className="target-basis-adjustments">
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

            <div className="target-basis-box" style={{ marginTop: 12 }}>
              <div className="target-basis-header">
                <span>지표별 점수표</span>
                <strong>TABLE 기준</strong>
              </div>

              <div className="target-basis-adjustments">
                {technicalStrategy.rows.map((row) => (
                  <p key={row.key}>
                    {row.label}: {row.score}/{row.maxScore}점 · {row.status} · {row.reason}
                  </p>
                ))}
              </div>
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
}: {
  rows: ChartRow[];
  lines: LineSpec[];
  showDates?: boolean;
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

  const min = Math.min(...values);
  const max = Math.max(...values);
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

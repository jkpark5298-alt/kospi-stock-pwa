"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type ChartRow = {
  date: string;
  close: number | null;
  sma20?: number | null;
  sma60?: number | null;
  rsi14?: number | null;
  macd?: number | null;
  signal?: number | null;
  histogram?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  volume?: number | null;
  obv?: number | null;
};

type StockResponse = {
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  currentPrice?: number;
  prevPrice?: number;
  changePrice?: number;
  change?: number;
  signalSummary?: string;
  chartData?: ChartRow[];
  forecast?: number[];
  fearGreed?: {
    score: number;
    label: string;
  };
  cached?: boolean;
  cacheSource?: string;
  warning?: string;
  blocked?: boolean;
  error?: string;
  detail?: string;
  status?: number;
};

type LineSpec = {
  key: keyof ChartRow;
  color: string;
  dashed?: boolean;
};

const DEFAULT_SYMBOL = "005930.KS";
const DEFAULT_RANGE = "6mo";
const WATCHLIST_KEY = "kospi-watchlist";

export default function HomePage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [data, setData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uiError, setUiError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(WATCHLIST_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setWatchlist(parsed);
      } catch {
        localStorage.removeItem(WATCHLIST_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (watchlist.length > 0) {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } else {
      localStorage.removeItem(WATCHLIST_KEY);
    }
  }, [watchlist]);

  async function fetchStock(targetSymbol?: string, targetRange?: string) {
    const finalSymbol = (targetSymbol ?? symbol).trim();
    const finalRange = targetRange ?? range;

    if (!finalSymbol) {
      setUiError("종목 코드를 입력해 주세요.");
      setData(null);
      return;
    }

    setLoading(true);
    setUiError("");

    try {
      const res = await fetch(
        `/api/stock?symbol=${encodeURIComponent(finalSymbol)}&range=${encodeURIComponent(finalRange)}`,
        { cache: "no-store" }
      );

      const json: StockResponse = await res.json();

      if (!res.ok) {
        setData(json);
        if (json.blocked) {
          setUiError("현재 주가 서버가 요청을 제한하고 있습니다. 잠시 후 다시 시도해 주세요.");
        } else {
          setUiError(json.error || "주가 데이터를 불러오지 못했습니다.");
        }
        return;
      }

      setData(json);
    } catch (error: unknown) {
      setData(null);
      setUiError(error instanceof Error ? error.message : "주가 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleAnalyze() {
    fetchStock();
  }

  function handleSaveWatchlist() {
    const trimmed = symbol.trim().toUpperCase();

    if (!trimmed) {
      alert("저장할 종목 코드를 입력해 주세요.");
      return;
    }

    if (watchlist.includes(trimmed)) {
      alert("이미 저장한 관심종목입니다.");
      return;
    }

    setWatchlist((prev) => [...prev, trimmed]);
  }

  function handleDeleteWatchlist(item: string) {
    setWatchlist((prev) => prev.filter((v) => v !== item));
  }

  function handleSelectWatchlist(item: string) {
    setSymbol(item);
    fetchStock(item, range);
  }

  const chartData = data?.chartData ?? [];
  const recentRows = useMemo(() => chartData.slice(-10).reverse(), [chartData]);
  const latestRow = useMemo(
    () => (chartData.length ? chartData[chartData.length - 1] : null),
    [chartData]
  );
  const previousRow = useMemo(
    () => (chartData.length > 1 ? chartData[chartData.length - 2] : null),
    [chartData]
  );

  const obvTrend = getObvTrend(latestRow?.obv, previousRow?.obv);
  const bbStatus = getBollingerStatus(latestRow?.close, latestRow?.bbUpper, latestRow?.bbLower);

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="hero">
          <div>
            <p className="eyebrow">KOSPI TECHNICAL DASHBOARD</p>
            <h1 className="hero-title">KOSPI Stock PWA</h1>
            <p className="hero-subtitle">
              코스피 국내 주식 분석 + 관심종목 저장 + PWA 설치 지원
            </p>
          </div>
          <div className="hero-badge">모바일 최적화</div>
        </header>

        <section className="top-grid">
          <Card>
            <SectionTitle>종목 분석</SectionTitle>

            <div className="search-form">
              <input
                className="form-control stock-input"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAnalyze();
                }}
                placeholder="예: 005930.KS"
              />

              <select
                className="form-control range-select"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="1mo">1개월</option>
                <option value="3mo">3개월</option>
                <option value="6mo">6개월</option>
                <option value="1y">1년</option>
              </select>

              <button className="button primary-button" onClick={handleAnalyze} disabled={loading}>
                {loading ? "불러오는 중..." : "분석하기"}
              </button>

              <button className="button secondary-button" onClick={handleSaveWatchlist}>
                관심종목 저장
              </button>
            </div>

            <StockIdentity data={data} inputSymbol={symbol} />

            <StatusMessage data={data} uiError={uiError} />
          </Card>

          <Card>
            <SectionTitle>관심종목</SectionTitle>

            <div className="watch-list">
              {watchlist.length === 0 ? (
                <p className="muted-text">저장된 관심종목이 없습니다.</p>
              ) : (
                watchlist.map((item) => (
                  <div key={item} className="watch-item">
                    <button className="watch-symbol" onClick={() => handleSelectWatchlist(item)}>
                      {item}
                    </button>

                    <button className="watch-delete" onClick={() => handleDeleteWatchlist(item)}>
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>

            <p className="watch-tip">
              자주 쓰는 예시: ^KS11 / 005930.KS / 000660.KS / 035420.KS / 035720.KS
            </p>
          </Card>
        </section>

        <section className="summary-grid summary-grid-four">
          <InfoCard title="현재가">
            <BigValue>{formatNumber(data?.currentPrice)}</BigValue>
          </InfoCard>

          <InfoCard title="전일 대비 %">
            <BigValue tone={getChangeTone(data?.change)}>{formatPercent(data?.change)}</BigValue>
          </InfoCard>

          <InfoCard title="전일 대비 가격">
            <BigValue tone={getChangeTone(data?.changePrice)}>{formatSignedNumber(data?.changePrice)}</BigValue>
          </InfoCard>

          <InfoCard title="분석 신호">
            <div className="signal-text">{data?.signalSummary || "데이터 없음"}</div>
          </InfoCard>
        </section>

        <section className="chart-stack">
          <Card className="chart-card">
            <ChartHeader
              title="주가 차트"
              description={`${data?.symbol || "-"} / 종가, SMA20, SMA60, Bollinger Band`}
            />
            <PriceChart rows={chartData} />
          </Card>

          <section className="indicator-grid">
            <Card className="chart-card">
              <ChartHeader
                title="RSI14"
                description="일반적으로 70 이상 과열, 30 이하 과매도 구간으로 참고"
              />
              <LineChart
                rows={chartData}
                dataKey="rsi14"
                stroke="#7c3aed"
                fixedMin={0}
                fixedMax={100}
                guides={[30, 70]}
              />
            </Card>

            <Card className="chart-card">
              <ChartHeader title="MACD" description="MACD / Signal / Histogram" />
              <MacdChart rows={chartData} />
            </Card>
          </section>

          <section className="indicator-grid">
            <Card className="chart-card">
              <ChartHeader title="매물대 차트" description="과거 종가 구간별 거래량 합산 기반 추정" />
              <VolumeProfileChart rows={chartData} />
            </Card>

            <Card className="chart-card">
              <ChartHeader title="OBV" description="거래량 흐름으로 매수·매도 압력 참고" />
              <LineChart rows={chartData} dataKey="obv" stroke="#0f766e" />
            </Card>
          </section>
        </section>

        <section className="bottom-grid bottom-grid-wide">
          <Card>
            <SectionTitleSmall>5일 단순 시뮬레이션</SectionTitleSmall>
            {data?.forecast && data.forecast.length > 0 ? (
              <ul className="forecast-list">
                {data.forecast.map((value, idx) => (
                  <li key={idx}>
                    <span>Day {idx + 1}</span>
                    <strong>{formatNumber(value)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">예측 데이터가 부족합니다.</p>
            )}
            <p className="notice-text">
              이 값은 투자 예측이 아니라 최근 흐름을 단순 연장한 참고용 계산입니다.
            </p>
          </Card>

          <Card>
            <SectionTitleSmall>주가 분석 TOOL</SectionTitleSmall>
            <div className="metric-list">
              <MetricRow label="RSI14" value={formatNumber(latestRow?.rsi14)} />
              <MetricRow label="MACD" value={formatNumber(latestRow?.macd)} />
              <MetricRow label="Signal" value={formatNumber(latestRow?.signal)} />
              <MetricRow label="Histogram" value={formatNumber(latestRow?.histogram)} />
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
              Fear & Greed는 외부 지수가 아니라 RSI, MACD, 이동평균, 당일 등락률, OBV를 이용한 자체 참고 점수입니다.
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
      </div>
    </main>
  );
}

function StockIdentity({
  data,
  inputSymbol,
}: {
  data: StockResponse | null;
  inputSymbol: string;
}) {
  const displaySymbol = data?.symbol || inputSymbol.trim().toUpperCase() || "종목 코드 없음";
  const displayName = data?.name || "종목명은 분석 후 표시됩니다.";
  const metaItems = [displaySymbol, data?.exchange, data?.currency].filter(Boolean);

  return (
    <div className="stock-identity">
      <div className="stock-name">{displayName}</div>
      <div className="stock-meta">{metaItems.join(" · ")}</div>
    </div>
  );
}

function StatusMessage({ data, uiError }: { data: StockResponse | null; uiError: string }) {
  if (uiError) return <p className="status-message error-message">{uiError}</p>;
  if (data?.warning) return <p className="status-message warning-message">{data.warning}</p>;
  if (data?.cached) return <p className="status-message info-message">캐시 데이터로 표시 중입니다.</p>;
  return <p className="status-message muted-text">종목 코드를 입력하고 분석하기를 눌러주세요.</p>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

function SectionTitleSmall({ children }: { children: ReactNode }) {
  return <h3 className="section-title small">{children}</h3>;
}

function ChartHeader({ title, description }: { title: string; description?: string }) {
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
    (r) => r.macd != null || r.signal != null || r.histogram != null
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
  const y = (v: number) => pad.top + plotHeight - ((v - min) / range) * plotHeight;
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
        <GridLines width={width} height={height} padTop={pad.top} padRight={pad.right} padBottom={pad.bottom} padLeft={pad.left} lines={4} />
        <line x1={pad.left} y1={zeroY} x2={width - pad.right} y2={zeroY} stroke="#94a3b8" strokeDasharray="4 4" />

        {filtered.map((r, i) => {
          const xv = x(i);
          const hv = r.histogram ?? 0;
          const yv = y(hv);
          const top = Math.min(zeroY, yv);
          const barH = Math.max(1, Math.abs(zeroY - yv));
          const barW = Math.max(4, (width - pad.left - pad.right) / Math.max(filtered.length * 1.8, 20));

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

        {macdPoints.length > 0 && <path d={buildPath(macdPoints)} fill="none" stroke="#2563eb" strokeWidth="3" />}
        {signalPoints.length > 0 && <path d={buildPath(signalPoints)} fill="none" stroke="#ef4444" strokeWidth="3" />}
        <DateLabels rows={filtered} width={width} height={height} padLeft={pad.left} padRight={pad.right} />
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
    const x = filtered.length === 1 ? width / 2 : pad.left + (i / (filtered.length - 1)) * (width - pad.left - pad.right);
    const y = pad.top + plotHeight - ((value - min) / range) * plotHeight;
    return { x, y, v: value };
  });

  return (
    <svg className="chart-svg line-svg" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
      <GridLines width={width} height={height} padTop={pad.top} padRight={pad.right} padBottom={pad.bottom} padLeft={pad.left} lines={4} />

      {guides.map((g) => {
        const gy = pad.top + plotHeight - ((g - min) / range) * plotHeight;
        return <line key={g} x1={pad.left} y1={gy} x2={width - pad.right} y2={gy} stroke="#cbd5e1" strokeDasharray="5 5" />;
      })}

      <path d={buildPath(points)} fill="none" stroke={stroke} strokeWidth="3" />
      <DateLabels rows={filtered} width={width} height={height} padLeft={pad.left} padRight={pad.right} />
    </svg>
  );
}

function MultiLineChart({ rows, lines, showDates = false }: { rows: ChartRow[]; lines: LineSpec[]; showDates?: boolean }) {
  const filtered = rows.filter((r) =>
    lines.some(({ key }) => typeof r[key] === "number" && !Number.isNaN(r[key] as number))
  );

  if (!filtered.length) return <EmptyChartMessage />;

  const width = 1000;
  const height = 360;
  const pad = { top: 24, right: 26, bottom: 52, left: 26 };
  const plotHeight = height - pad.top - pad.bottom;

  const values = filtered.flatMap((r) =>
    lines
      .map(({ key }) => r[key])
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
  );

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const linePaths = lines.map(({ key, color, dashed }) => {
    const points = filtered.map((r, i) => {
      const raw = r[key];
      const value = typeof raw === "number" ? raw : null;
      const x = filtered.length === 1 ? width / 2 : pad.left + (i / (filtered.length - 1)) * (width - pad.left - pad.right);
      if (value == null || Number.isNaN(value)) return { x, y: 0, v: null };
      const y = pad.top + plotHeight - ((value - min) / range) * plotHeight;
      return { x, y, v: value };
    });

    return { key: String(key), color, dashed, d: buildPath(points) };
  });

  return (
    <svg className="chart-svg price-svg" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
      <GridLines width={width} height={height} padTop={pad.top} padRight={pad.right} padBottom={pad.bottom} padLeft={pad.left} lines={5} />
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
      {showDates ? <DateLabels rows={filtered} width={width} height={height} padLeft={pad.left} padRight={pad.right} /> : null}
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
        const width = maxVolume > 0 ? Math.max(4, (bucket.volume / maxVolume) * 100) : 0;
        return (
          <div className="volume-profile-row" key={bucket.label}>
            <span className="volume-price">{bucket.label}</span>
            <div className="volume-bar-track">
              <div className="volume-bar" style={{ width: `${width}%` }} />
            </div>
            <span className="volume-value">{formatCompactNumber(bucket.volume)}</span>
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
        return <line key={i} x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
    </>
  );
}

function DateLabels({ rows, width, height, padLeft, padRight }: { rows: ChartRow[]; width: number; height: number; padLeft: number; padRight: number }) {
  const indexes = getLabelIndexes(rows.length, 5);

  return (
    <>
      {indexes.map((index) => {
        const x = rows.length === 1 ? width / 2 : padLeft + (index / (rows.length - 1)) * (width - padLeft - padRight);
        return (
          <text key={`${rows[index]?.date}-${index}`} x={x} y={height - 14} textAnchor="middle" className="chart-date-label">
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

function buildPath(points: Array<{ x: number; y: number; v: number | null | undefined }>) {
  let d = "";
  points.forEach((p) => {
    if (p.v == null || Number.isNaN(p.v)) return;
    d += `${d ? " L" : "M"} ${p.x} ${p.y}`;
  });
  return d;
}

function isValidPoint(point: { x: number; y: number; v: number | null | undefined }): point is { x: number; y: number; v: number } {
  return typeof point.v === "number" && !Number.isNaN(point.v);
}

function buildVolumeProfile(rows: ChartRow[], bucketCount: number) {
  const validRows = rows.filter((row) => typeof row.close === "number" && typeof row.volume === "number");
  if (!validRows.length) return [];

  const closes = validRows.map((row) => row.close as number);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const bucketSize = range / bucketCount;
  const buckets = Array.from({ length: bucketCount }).map((_, index) => {
    const low = min + bucketSize * index;
    const high = index === bucketCount - 1 ? max : min + bucketSize * (index + 1);
    return { low, high, volume: 0 };
  });

  validRows.forEach((row) => {
    const close = row.close as number;
    const volume = row.volume ?? 0;
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((close - min) / bucketSize)));
    buckets[index].volume += volume;
  });

  return buckets
    .reverse()
    .map((bucket) => ({
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

function getBollingerStatus(close?: number | null, upper?: number | null, lower?: number | null) {
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
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
}

function formatSignedNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  const formatted = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return "0";
}

function formatCompactNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDateLabel(date?: string) {
  if (!date) return "-";
  const [, month, day] = date.split("-");
  return `${month}/${day}`;
}

function formatShortPrice(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
}

function getChangeTone(value?: number | null): "positive" | "negative" | "neutral" {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function Th({ children }: { children: ReactNode }) {
  return <th>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td>{children}</td>;
}
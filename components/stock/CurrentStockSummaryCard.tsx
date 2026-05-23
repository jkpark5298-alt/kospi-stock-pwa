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

type DailyTargetSnapshot = {
  date: string;
  symbol: string;
  targetPrice: number;
  basisPrice: number;
  source: "first-query" | "current-query" | "manual";
  savedAt: string;
};

type SummaryTone = "positive" | "negative" | "neutral";

type AbcEstimate = {
  value: number | null;
  technicalWeight: number | null;
  valuationWeight: number | null;
  consensusWeight: number | null;
  description: string;
};

const DAILY_TARGET_STORAGE_PREFIX = "kospi-daily-target";

export default function CurrentStockSummaryCard({ data }: Props) {
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const todayKey = useMemo(() => makeTodayKey(), []);
  const dailyTargetKey = useMemo(
    () => makeDailyTargetKey(data?.symbol, todayKey),
    [data?.symbol, todayKey],
  );

  const [dailyTarget, setDailyTarget] = useState<DailyTargetSnapshot | null>(
    null,
  );
  const [manualTargetInput, setManualTargetInput] = useState("");

  useEffect(() => {
    if (!range || !data?.symbol || typeof window === "undefined") {
      setDailyTarget(null);
      setManualTargetInput("");
      return;
    }

    const stored = readDailyTargetSnapshot(dailyTargetKey);

    if (stored) {
      setDailyTarget(stored);
      setManualTargetInput(formatManualTargetInput(String(stored.targetPrice)));
      return;
    }

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      source: "first-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
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
          (
            ((dailyTarget.targetPrice - range.currentPrice) /
              range.currentPrice) *
            100
          ).toFixed(2),
        )
      : null;

  const displaySymbol = data?.symbol || "?곗씠???놁쓬";
  const displayName = data?.name || "醫낅ぉ紐??놁쓬";
  const displayMeta = [displaySymbol, data?.exchange, data?.currency]
    .filter(Boolean)
    .join(" 쨌 ");
  const quickSummary = makeCurrentSummaryInterpretation(data, range);
  const abcEstimate = makeAbcEstimate(data);

  function handleSaveCurrentAsDailyTarget() {
    if (!range || !data?.symbol) return;

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      source: "current-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  function handleSaveManualDailyTarget() {
    if (!range || !data?.symbol) return;

    const parsed = parseManualTargetInput(manualTargetInput);

    if (parsed == null || parsed <= 0) return;

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: parsed,
      basisPrice: range.currentPrice,
      source: "manual",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  function handleResetDailyTarget() {
    if (!range || !data?.symbol || typeof window === "undefined") return;

    window.localStorage.removeItem(dailyTargetKey);

    const next: DailyTargetSnapshot = {
      date: todayKey,
      symbol: data.symbol,
      targetPrice: range.baseTarget,
      basisPrice: range.currentPrice,
      source: "first-query",
      savedAt: new Date().toISOString(),
    };

    writeDailyTargetSnapshot(dailyTargetKey, next);
    setDailyTarget(next);
    setManualTargetInput(formatManualTargetInput(String(next.targetPrice)));
  }

  return (
    <div className="card">
      <h3 className="section-title small">?꾩옱 醫낅ぉ ?붿빟</h3>

      <div className="stock-identity">
        <div className="stock-name">{displayName}</div>
        <div className="stock-meta">{displayMeta || "?쒖옣 ?뺣낫 ?湲?}</div>
      </div>

      <div className="metric-list">
        <MetricRow label="?꾩옱媛" value={formatNumber(data?.currentPrice)} />
        <MetricRow
          label="?꾩씪 ?鍮?
          value={`${formatSignedNumber(data?.changePrice)} / ${formatPercent(
            data?.change,
          )}`}
        />
        <MetricRow
          label="異붿젙 二쇨?(?꾩옱 議고쉶 湲곗?)"
          value={`${formatNumber(range?.baseTarget)} ${formatDailyTargetSuffix(
            dailyTarget,
          )}`}
        />
        <MetricRow
          label="異붿젙 愿대━??
          value={`${formatSignedNumber(upsidePrice)} / ${formatUpside(
            range?.baseUpsidePercent,
          )}`}
        />
        <MetricRow
          label="湲곗닠??遺꾩꽍"
          value={data?.signalSummary || "?곗씠???놁쓬"}
        />
        <MetricRow
          label="醫낇빀 ?먯닔"
          value={
            data?.score?.total != null
              ? `${data.score.total} / 100 쨌 ${data.score.grade}`
              : "?곗씠???놁쓬"
          }
        />
        <MetricRow
          label="異붿젙 二쇨? ?꾨떖 媛?μ꽦"
          value={
            data?.score?.targetPrice?.score != null
              ? `${data.score.targetPrice.score} / 100 쨌 ${data.score.targetPrice.label}`
              : "?곗씠???놁쓬"
          }
        />
        <MetricRow
          label="?꾩옱 議고쉶 湲곗? 異붿젙 二쇨? ?꾨떖瑜?
          value={formatTargetProgress(targetProgress)}
        />
        <MetricRow
          label="?뱀씪 湲곗? 異붿젙 二쇨? ?꾨떖瑜?
          value={`${formatTargetProgress(dailyTargetProgress)} 쨌 ${formatSignedNumber(
            dailyUpsidePrice,
          )} / ${formatUpside(dailyUpsidePercent)}`}
        />
        <MetricRow
          label="하락 지지선"
          value={`${formatNumber(range?.riskLine)} / ${formatUpside(
            range?.riskDownsidePercent,
          )}`}
        />
      </div>

      <div className="target-basis-box" style={{ marginTop: 16 }}>
        <div className="target-basis-header">
          <span>?듭떖 ?댁꽍</span>
          <strong>{quickSummary.overall}</strong>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          {quickSummary.cards.map((card) => (
            <div className="target-metric-card" key={card.title}>
              <span>
                {card.icon} {card.title}
              </span>
              <strong className={card.tone}>{card.label}</strong>
              <em className={card.tone}>{card.detail}</em>
            </div>
          ))}
        </div>

        <p className="target-basis-summary" style={{ marginTop: 12 }}>
          {quickSummary.summary}
        </p>
      </div>

      <ReferenceAbcEstimateBox data={data} estimate={abcEstimate} />

      <div className="target-basis-box" style={{ marginTop: 16 }}>
        <div className="target-basis-header">
          <span>湲곗닠??遺꾩꽍?대??</span>
          <strong>{data?.signalSummary || "?곗씠???놁쓬"}</strong>
        </div>
        <p className="target-basis-summary">
          湲곗닠??遺꾩꽍? ?대룞?됯퇏, RSI, MACD, 蹂쇰┛?諛대뱶 ??李⑦듃 吏?쒕?
          諛뷀깢?쇰줈 ?꾩옱 二쇨? ?먮쫫怨?留ㅼ닔쨌留ㅻ룄 李멸퀬 援ш컙???붿빟???좏샇?낅땲??
          ?ㅼ젣 ?먮떒? ?섍툒, ?ㅼ쟻, 怨듭떆, ?쒖옣 ?곹솴怨??④퍡 ?뺤씤?댁빞 ?⑸땲??
        </p>

        <div className="target-basis-adjustments" style={{ marginTop: 12 }}>
          <p>
            <strong>?곷???媛뺤꽭</strong> ???곸듅 ?먮쫫 ?곗쐞, ?④린 怨쇱뿴 ?щ? ?뺤씤
          </p>
          <p>
            <strong>以묐┰</strong> ??諛⑺뼢???뺤씤 ?꾩슂, 愿留?援ш컙
          </p>
          <p>
            <strong>?쎌꽭</strong> ???섎씫 ?뺣젰 ?곗쐞, 諛섎벑 ?뺤씤 ?꾩슂
          </p>
          <p>
            <strong>?④린 怨쇱뿴</strong> ??異붽꺽 留ㅼ닔 ?좎쨷, 蹂?숈꽦 ?뺤씤
          </p>
          <p>
            <strong>議곗젙 ??諛섎벑</strong> ??留ㅼ닔 愿??援ш컙 媛?μ꽦
          </p>
        </div>
      </div>

      <div className="target-basis-box" style={{ marginTop: 16 }}>
        <div className="target-basis-header">
          <span>?뱀씪 湲곗? 異붿젙 二쇨? ?ㅼ젙</span>
          <strong>{formatDailyTargetSource(dailyTarget)}</strong>
        </div>

        <p className="target-basis-summary">
          ?뱀씪 湲곗? 異붿젙 二쇨?: {formatNumber(dailyTarget?.targetPrice)} 쨌 ???          湲곗?媛: {formatNumber(dailyTarget?.basisPrice)} 쨌 ????쒓컖:{" "}
          {formatDateTime(dailyTarget?.savedAt)}
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <input
            className="form-control"
            value={manualTargetInput}
            inputMode="decimal"
            onChange={(event) =>
              setManualTargetInput(formatManualTargetInput(event.target.value))
            }
            placeholder="吏곸젒 ?낅젰 ?? 288,000"
            style={{ maxWidth: 220 }}
          />
          <button
            className="button secondary-button"
            type="button"
            onClick={handleSaveManualDailyTarget}
            disabled={!range}
          >
            吏곸젒 ?낅젰 ???          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={handleSaveCurrentAsDailyTarget}
            disabled={!range}
          >
            ?꾩옱 議고쉶 異붿젙 二쇨?濡????          </button>
          <button
            className="button secondary-button"
            type="button"
            onClick={handleResetDailyTarget}
            disabled={!range}
          >
            ?ㅻ뒛 湲곗? 珥덇린??          </button>
        </div>

        <div className="target-basis-adjustments">
          <p>
            泥?議고쉶 ???뱀씪 湲곗? 異붿젙 二쇨?媛 ?먮룞 ??λ맗?덈떎. ?댄썑?먮뒗 吏곸젒
            ?낅젰?섍굅???꾩옱 議고쉶 異붿젙 二쇨?濡??ㅼ떆 ??ν븷 ???덉뒿?덈떎.
          </p>
          <p>
            異붿젙 二쇨?(?꾩옱 議고쉶 湲곗?)??議고쉶???뚮쭏??諛붾????덇퀬, ?뱀씪 湲곗?
            異붿젙 二쇨???媛숈? ?좎쭨??異붿젙 二쇨? ?꾨떖瑜??됯? 湲곗??쇰줈 ?좎??⑸땲??
          </p>
        </div>
      </div>

      <p className="notice-text">
        異붿젙 二쇨?(?꾩옱 議고쉶 湲곗?)??理쒖떊 ?꾩옱媛? 吏?쒕줈 ?ㅼ떆 怨꾩궛?⑸땲?? 愿꾪샇
        ?덉쓽 ?뱀씪 湲곗? 異붿젙 二쇨????ㅻ뒛 ?됯? 湲곗??쇰줈 ??λ맂 異붿젙 二쇨??낅땲??
      </p>
    </div>
  );
}

function ReferenceAbcEstimateBox({
  data,
  estimate,
}: {
  data: StockResponse | null;
  estimate: AbcEstimate;
}) {
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const basis = data?.score?.targetPrice?.targetBasis;
  const valuationRange = data?.score?.targetPrice?.valuationTargetRange ?? null;
  const technicalTarget = getTechnicalBasisPrice(basis, range?.baseTarget);
  const valuationTarget = valuationRange?.valuationTarget ?? null;
  const consensusTarget = data?.score?.targetPrice?.consensusTarget ?? null;
  const modelTarget = range?.baseTarget ?? null;
  const modelGap =
    estimate.value != null && modelTarget != null
      ? percentChange(modelTarget, estimate.value)
      : null;

  return (
    <div className="target-basis-box" style={{ marginTop: 16 }}>
      <div className="target-basis-header">
        <span>李멸퀬 A/B/C 異붿젙媛</span>
        <strong>{estimate.value != null ? "?붿빟 湲곗?媛 鍮꾧탳" : "?곗씠???湲?}</strong>
      </div>

      <p className="target-basis-summary">
        ?꾩옱 醫낅ぉ ?붿빟?먯꽌??A 湲곗닠??湲곗?媛, B ?ㅼ쟻쨌諛몃쪟 湲곗?媛, C 而⑥꽱?쒖뒪
        湲곗?媛瑜?李멸퀬媛믪쑝濡??④퍡 蹂댁뿬以띾땲?? ?꾩옱 紐⑤뜽 異붿젙媛? A/B/C 湲곗?
        1李?異붿젙媛???꾩쭅 ?ㅻ? ???덉뒿?덈떎.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        <div className="target-metric-card">
          <span>A. 湲곗닠??湲곗?媛</span>
          <strong>{formatNumber(technicalTarget)}</strong>
          <em>{makeTechnicalBasisText(basis)}</em>
        </div>

        <div className="target-metric-card">
          <span>B. ?ㅼ쟻쨌諛몃쪟 湲곗?媛</span>
          <strong>{formatNumber(valuationTarget)}</strong>
          <em>{makeValuationText(valuationRange)}</em>
        </div>

        <div className="target-metric-card">
          <span>C. 而⑥꽱?쒖뒪 湲곗?媛</span>
          <strong>{formatNumber(consensusTarget)}</strong>
          <em>而⑥꽱?쒖뒪 ?낅젰 ???쒖떆</em>
        </div>

        <div className="target-metric-card">
          <span>A/B/C 湲곗? 1李?異붿젙媛</span>
          <strong>{formatNumber(estimate.value)}</strong>
          <em>{formatAbcWeights(estimate)}</em>
        </div>

        <div className="target-metric-card">
          <span>?꾩옱 紐⑤뜽 異붿젙媛</span>
          <strong>{formatNumber(modelTarget)}</strong>
          <em>A/B/C 1李??鍮?{formatUpside(modelGap)}</em>
        </div>
      </div>

      <div className="target-basis-adjustments">
        <p>
          ?꾩옱 ?쒖떆 湲곗?: 而⑥꽱?쒖뒪媛 ?놁쑝硫?A 60%, B 40%濡?1李?異붿젙媛瑜?          怨꾩궛?⑸땲??
        </p>
        <p>
          而⑥꽱?쒖뒪媛 ?낅젰?섎㈃ A 40%, B 35%, C 25% 援ъ“濡?鍮꾧탳???덉젙?낅땲??
        </p>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function makeCurrentSummaryInterpretation(
  data: StockResponse | null,
  range?: NonNullable<StockResponse["score"]>["targetPrice"]["technicalTargetRange"],
) {
  const latest = getLatestChartRow(data?.chartData);
  const current = data?.currentPrice ?? latest?.close ?? range?.currentPrice ?? null;
  const chart = makeChartSummary(current, latest);
  const prediction = makePredictionSummary(current, range);
  const overall = makeOverallSummary(chart.label, prediction.label);

  return {
    overall: overall.title,
    summary: overall.detail,
    cards: [
      {
        title: "李⑦듃",
        icon: chart.icon,
        label: chart.label,
        detail: chart.detail,
        tone: chart.tone,
      },
      {
        title: "?덉륫",
        icon: prediction.icon,
        label: prediction.label,
        detail: prediction.detail,
        tone: prediction.tone,
      },
      {
        title: "醫낇빀",
        icon: overall.icon,
        label: overall.title,
        detail: overall.shortDetail,
        tone: overall.tone,
      },
    ],
  };
}

function getLatestChartRow(chartData?: StockResponse["chartData"]) {
  if (!chartData?.length) return null;

  for (let index = chartData.length - 1; index >= 0; index -= 1) {
    const row = chartData[index];

    if (row?.close != null && Number.isFinite(row.close)) {
      return row;
    }
  }

  return null;
}

function makeChartSummary(
  current: number | null,
  latest: ReturnType<typeof getLatestChartRow>,
) {
  if (!latest || current == null) {
    return {
      icon: "??,
      label: "李⑦듃 ?뺤씤 ?꾩슂",
      detail: "?곗씠???湲?,
      tone: "neutral" as SummaryTone,
    };
  }

  const sma20 = latest.sma20 ?? null;
  const sma60 = latest.sma60 ?? null;
  const bbUpper = latest.bbUpper ?? null;
  const bbLower = latest.bbLower ?? null;
  const rsi14 = latest.rsi14 ?? null;

  const isUpTrend =
    sma20 != null && sma60 != null && current > sma20 && sma20 > sma60;
  const isAboveAvg =
    sma20 != null && sma60 != null && current > sma20 && current > sma60;
  const isWeak =
    sma20 != null && sma60 != null && current < sma20 && current < sma60;

  const bandPosition =
    bbUpper != null && bbLower != null && bbUpper > bbLower
      ? (current - bbLower) / (bbUpper - bbLower)
      : null;

  const isOverheated =
    (bandPosition != null && bandPosition >= 0.85) ||
    (rsi14 != null && rsi14 >= 70);

  if (isUpTrend && isOverheated) {
    return {
      icon: "?좑툘",
      label: "?④린 怨쇱뿴 二쇱쓽",
      detail: "?곸듅 異붿꽭 媛뺥븿",
      tone: "negative" as SummaryTone,
    };
  }

  if (isUpTrend || isAboveAvg) {
    return {
      icon: "?윟",
      label: "?곸듅 異붿꽭 ?좎?",
      detail: "?대룞?됯퇏????,
      tone: "positive" as SummaryTone,
    };
  }

  if (isWeak) {
    return {
      icon: "?뵽",
      label: "異붿꽭 ?쎌꽭",
      detail: "?대룞?됯퇏???꾨옒",
      tone: "negative" as SummaryTone,
    };
  }

  return {
    icon: "??,
    label: "諛⑺뼢???뺤씤",
    detail: "?쇱“ 援ш컙",
    tone: "neutral" as SummaryTone,
  };
}

function makePredictionSummary(
  current: number | null,
  range?: NonNullable<StockResponse["score"]>["targetPrice"]["technicalTargetRange"],
) {
  const baseTarget = range?.baseTarget ?? null;

  if (current == null || baseTarget == null || baseTarget <= 0) {
    return {
      icon: "??,
      label: "?덉륫 ?뺤씤 ?꾩슂",
      detail: "異붿젙媛 ?湲?,
      tone: "neutral" as SummaryTone,
    };
  }

  const upsideRate = ((baseTarget - current) / current) * 100;
  const progress = (current / baseTarget) * 100;

  if (upsideRate >= 3) {
    return {
      icon: "?윟",
      label: "?곸듅 ?щ젰 ?덉쓬",
      detail: `異붿젙媛源뚯? ${upsideRate.toFixed(1)}%`,
      tone: "positive" as SummaryTone,
    };
  }

  if (progress >= 97 && progress <= 103) {
    return {
      icon: "?좑툘",
      label: "異붿젙媛 洹쇱젒",
      detail: `?꾨떖瑜?${progress.toFixed(1)}%`,
      tone: "neutral" as SummaryTone,
    };
  }

  if (upsideRate < -3) {
    return {
      icon: "?뵽",
      label: "異붿젙媛 珥덇낵",
      detail: `珥덇낵 ${Math.abs(upsideRate).toFixed(1)}%`,
      tone: "negative" as SummaryTone,
    };
  }

  return {
    icon: "??,
    label: "?덉륫 以묐┰",
    detail: `愿대━ ${upsideRate.toFixed(1)}%`,
    tone: "neutral" as SummaryTone,
  };
}

function makeOverallSummary(chartLabel: string, predictionLabel: string) {
  if (chartLabel.includes("怨쇱뿴") && predictionLabel.includes("?곸듅 ?щ젰")) {
    return {
      icon: "?좑툘",
      title: "?곸듅 ?щ젰 ?덉쓬 쨌 ?④린 怨쇱뿴 二쇱쓽",
      shortDetail: "異붽꺽 留ㅼ닔 ?좎쨷",
      detail:
        "?덉륫???щ젰? ?⑥븘 ?덉?留?李⑦듃???④린 怨쇱뿴 ?좏샇瑜??④퍡 蹂댁뿬以띾땲?? ?곸듅 ?먮쫫? ?좎??섎릺 異붽꺽 留ㅼ닔???좎쨷???뺤씤?섎뒗 援ш컙?낅땲??",
      tone: "neutral" as SummaryTone,
    };
  }

  if (chartLabel.includes("怨쇱뿴") && predictionLabel.includes("洹쇱젒")) {
    return {
      icon: "?좑툘",
      title: "異붿젙媛 洹쇱젒 쨌 ?④린 怨쇱뿴 二쇱쓽",
      shortDetail: "蹂?숈꽦 ?뺤씤",
      detail:
        "?꾩옱媛??異붿젙 二쇨???媛源뚯슦硫?李⑦듃???④린 怨쇱뿴 ?좏샇媛 ?덉뒿?덈떎. 異붽? ?곸듅蹂대떎 蹂?숈꽦 ?뺣? ?щ?瑜?癒쇱? ?뺤씤?댁빞 ?⑸땲??",
      tone: "negative" as SummaryTone,
    };
  }

  if (chartLabel.includes("?곸듅") && predictionLabel.includes("?곸듅 ?щ젰")) {
    return {
      icon: "?윟",
      title: "?곸듅 異붿꽭 쨌 ?곸듅 ?щ젰",
      shortDetail: "?먮쫫 ?묓샇",
      detail:
        "李⑦듃 ?먮쫫怨?異붿젙 二쇨? 湲곗???紐⑤몢 ?고샇?곸엯?덈떎. ?ㅻ쭔 ?ㅼ젣 ?먮떒? ?섍툒怨??꾪뿕 湲곗??좎쓣 ?④퍡 ?뺤씤?댁빞 ?⑸땲??",
      tone: "positive" as SummaryTone,
    };
  }

  if (chartLabel.includes("?쎌꽭")) {
    return {
      icon: "?뵽",
      title: "異붿꽭 ?쎌꽭 ?뺤씤",
      shortDetail: "諛섎벑 ?뺤씤 ?꾩슂",
      detail:
        "?꾩옱 李⑦듃 ?먮쫫???쏀빐 ?④린 諛섎벑 ?щ?? ?섍툒 媛쒖꽑 ?щ?瑜??④퍡 ?뺤씤?댁빞 ?⑸땲??",
      tone: "negative" as SummaryTone,
    };
  }

  return {
    icon: "??,
    title: "諛⑺뼢???뺤씤 ?꾩슂",
    shortDetail: "?쇱“ 援ш컙",
    detail:
      "李⑦듃? 異붿젙 二쇨? 湲곗????쒕졆?섍쾶 ??諛⑺뼢?쇰줈 ?쇱튂?섏? ?딆븘 異붽? ?뺤씤???꾩슂??援ш컙?낅땲??",
    tone: "neutral" as SummaryTone,
  };
}

function makeAbcEstimate(data: StockResponse | null): AbcEstimate {
  const range = data?.score?.targetPrice?.technicalTargetRange;
  const basis = data?.score?.targetPrice?.targetBasis;
  const valuationRange = data?.score?.targetPrice?.valuationTargetRange ?? null;
  const technicalTarget = getTechnicalBasisPrice(basis, range?.baseTarget);
  const valuationTarget = valuationRange?.valuationTarget ?? null;
  const consensusTarget = data?.score?.targetPrice?.consensusTarget ?? null;

  return calculateAbcEstimate({
    technicalTarget,
    valuationTarget,
    consensusTarget,
  });
}

function calculateAbcEstimate({
  technicalTarget,
  valuationTarget,
  consensusTarget,
}: {
  technicalTarget?: number | null;
  valuationTarget?: number | null;
  consensusTarget?: number | null;
}): AbcEstimate {
  const hasTechnical =
    technicalTarget != null && Number.isFinite(technicalTarget);
  const hasValuation =
    valuationTarget != null && Number.isFinite(valuationTarget);
  const hasConsensus =
    consensusTarget != null && Number.isFinite(consensusTarget);

  if (!hasTechnical && !hasValuation && !hasConsensus) {
    return {
      value: null,
      technicalWeight: null,
      valuationWeight: null,
      consensusWeight: null,
      description: "A/B/C 湲곗?媛 ?湲?,
    };
  }

  if (hasConsensus) {
    const weights = normalizeWeights({
      technicalWeight: hasTechnical ? 0.4 : 0,
      valuationWeight: hasValuation ? 0.35 : 0,
      consensusWeight: 0.25,
    });

    const value =
      (technicalTarget ?? 0) * weights.technicalWeight +
      (valuationTarget ?? 0) * weights.valuationWeight +
      (consensusTarget ?? 0) * weights.consensusWeight;

    return {
      value: roundPrice(value),
      ...weights,
      description: "A 40% 쨌 B 35% 쨌 C 25% 湲곗?",
    };
  }

  const weights = normalizeWeights({
    technicalWeight: hasTechnical ? 0.6 : 0,
    valuationWeight: hasValuation ? 0.4 : 0,
    consensusWeight: 0,
  });

  const value =
    (technicalTarget ?? 0) * weights.technicalWeight +
    (valuationTarget ?? 0) * weights.valuationWeight;

  return {
    value: roundPrice(value),
    ...weights,
    description: "A 60% 쨌 B 40% 湲곗?",
  };
}

function normalizeWeights({
  technicalWeight,
  valuationWeight,
  consensusWeight,
}: {
  technicalWeight: number;
  valuationWeight: number;
  consensusWeight: number;
}) {
  const total = technicalWeight + valuationWeight + consensusWeight;

  if (total <= 0) {
    return {
      technicalWeight: 0,
      valuationWeight: 0,
      consensusWeight: 0,
    };
  }

  return {
    technicalWeight: technicalWeight / total,
    valuationWeight: valuationWeight / total,
    consensusWeight: consensusWeight / total,
  };
}

function getTechnicalBasisPrice(
  basis?: NonNullable<StockResponse["score"]>["targetPrice"]["targetBasis"],
  fallback?: number | null,
) {
  const technicalCandidate = basis?.candidates.find((candidate) =>
    candidate.label.includes("湲곗닠"),
  );

  return technicalCandidate?.value ?? fallback ?? null;
}

function makeTechnicalBasisText(
  basis?: NonNullable<StockResponse["score"]>["targetPrice"]["targetBasis"],
) {
  if (!basis) return "李⑦듃 湲곕컲 湲곗?媛 ?湲?;

  const technicalCandidate = basis.candidates.find((candidate) =>
    candidate.label.includes("湲곗닠"),
  );

  if (technicalCandidate) {
    return `湲곗닠 ?꾨낫 諛섏쁺 鍮꾩쨷 ${formatWeight(technicalCandidate.weight)}`;
  }

  return "理쒓렐 怨좎젏쨌蹂쇰┛?諛대뱶쨌蹂?숈꽦 湲곕컲";
}

function makeValuationText(
  valuationRange?: NonNullable<StockResponse["score"]>["targetPrice"]["valuationTargetRange"] | null,
) {
  if (!valuationRange?.valuationTarget) {
    return "EPS/BPS ?먮뒗 PER/PBR ?곗씠??遺議?;
  }

  const parts = [];

  if (valuationRange.epsTarget != null) {
    parts.push("EPS 湲곗? ?ы븿");
  }

  if (valuationRange.bpsTarget != null) {
    parts.push("BPS 湲곗? ?ы븿");
  }

  return parts.length > 0 ? parts.join(" 쨌 ") : "?ㅼ쟻쨌諛몃쪟 湲곗?";
}

function formatAbcWeights(estimate: AbcEstimate) {
  const parts = [];

  if (estimate.technicalWeight != null && estimate.technicalWeight > 0) {
    parts.push(`A ${formatWeight(estimate.technicalWeight)}`);
  }

  if (estimate.valuationWeight != null && estimate.valuationWeight > 0) {
    parts.push(`B ${formatWeight(estimate.valuationWeight)}`);
  }

  if (estimate.consensusWeight != null && estimate.consensusWeight > 0) {
    parts.push(`C ${formatWeight(estimate.consensusWeight)}`);
  }

  return parts.length > 0 ? parts.join(" 쨌 ") : "媛以묒튂 ?湲?;
}

function percentChange(target: number, current: number) {
  if (!Number.isFinite(target) || !Number.isFinite(current) || current === 0) {
    return null;
  }

  return ((target - current) / current) * 100;
}

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return null;

  if (value >= 100_000) return Math.round(value / 10) * 10;
  if (value >= 10_000) return Math.round(value / 5) * 5;
  return Math.round(value);
}

function makeTodayKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function makeDailyTargetKey(symbol?: string | null, todayKey = makeTodayKey()) {
  return `${DAILY_TARGET_STORAGE_PREFIX}:${todayKey}:${(symbol || "")
    .trim()
    .toUpperCase()}`;
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
    // localStorage ??μ씠 ?ㅽ뙣?대룄 ?붾㈃ 議고쉶??怨꾩냽 吏꾪뻾?⑸땲??
  }
}

function formatDailyTargetSuffix(snapshot?: DailyTargetSnapshot | null) {
  if (!snapshot) return "(?뱀씪 湲곗? 異붿젙 二쇨? ?곗씠???놁쓬)";

  return `(?뱀씪 湲곗? 異붿젙 二쇨? ${formatNumber(snapshot.targetPrice)})`;
}

function formatDailyTargetSource(snapshot?: DailyTargetSnapshot | null) {
  if (!snapshot) return "?뱀씪 湲곗? 異붿젙 二쇨? ?湲?;

  if (snapshot.source === "manual") return "吏곸젒 ?낅젰 湲곗?";
  if (snapshot.source === "current-query") return "?꾩옱 議고쉶 異붿젙 二쇨? ???湲곗?";
  return "?ㅻ뒛 泥?議고쉶 湲곗?";
}

function formatManualTargetInput(value: string) {
  const raw = value.replace(/,/g, "").replace(/\s/g, "");

  if (!raw) return "";

  const cleaned = raw.replace(/[^0-9.]/g, "");

  if (!cleaned) return "";

  const dotIndex = cleaned.indexOf(".");
  const integerPart = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned;
  const decimalPart =
    dotIndex >= 0 ? cleaned.slice(dotIndex + 1).replace(/\./g, "") : "";

  const formattedInteger = integerPart
    ? Number(integerPart).toLocaleString("en-US")
    : "0";

  if (dotIndex >= 0) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
}

function parseManualTargetInput(value: string) {
  const parsed = Number(value.replace(/[\s,]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function formatTargetProgress(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "?곗씠???놁쓬";
  return `${value.toFixed(1)}%`;
}

function formatUpside(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "?곗씠???놁쓬";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatWeight(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "?곗씠???놁쓬";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "?????;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


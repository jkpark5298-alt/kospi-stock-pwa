"use client";

import { useEffect, useMemo, useState } from "react";

type ConsensusData = {
  averageTargetPrice?: number | null;
  highTargetPrice?: number | null;
  lowTargetPrice?: number | null;
  investmentOpinion?: string;
  analystCount?: number | null;
  savedAt?: string;
};

type SupabaseConsensusData = {
  averageTarget?: number | null;
  highTarget?: number | null;
  lowTarget?: number | null;
  opinion?: string | null;
  brokerCount?: number | null;
  source?: string | null;
  baseDate?: string | null;
};

type FundamentalsData = {
  marketCap?: number | null;
  per?: number | null;
  pbr?: number | null;
  eps?: number | null;
  bps?: number | null;
  dividendYield?: number | null;
  foreignOwnershipRate?: number | null;
  sharesOutstanding?: number | null;
  high52w?: number | null;
  low52w?: number | null;
};

type FundamentalsPayload = {
  ok: boolean;
  data?: FundamentalsData;
  message?: string;
  error?: string;
};

type ValuationFallback = {
  epsTarget: number | null;
  bpsTarget: number | null;
  valuationTarget: number | null;
  method: string;
};

type EstimateWeights = {
  technical: number;
  valuation: number;
  consensus: number;
};

type AdjustmentInfo = {
  quantPercent: number;
  supplyPercent: number;
  riskPercent: number;
  totalPercent: number | null;
  quantAmount: number | null;
  supplyAmount: number | null;
  riskAmount: number | null;
  totalAmount: number | null;
};

type EstimateResult = {
  basisAverage: number | null;
  estimate: number | null;
  weights: EstimateWeights;
  weightText: string;
  adjustment: AdjustmentInfo;
  estimateSource: string;
};

type Props = {
  data?: any;
};

const CONSENSUS_STORAGE_PREFIX = "kospi-consensus-data";
const FUNDAMENTALS_CACHE_PREFIX = "kospi-kis-fundamentals";
const KIS_CACHE_TTL_MS = 10 * 60 * 1000;

export default function SummaryAbcOverviewSection({ data }: Props) {
  const symbol = data?.symbol ?? null;
  const name = data?.name ?? null;

  const storageKey = useMemo(() => makeConsensusStorageKey(symbol, name), [symbol, name]);
  const fundamentalsCacheKey = useMemo(
    () => makeCacheKey(FUNDAMENTALS_CACHE_PREFIX, symbol),
    [symbol],
  );

  const [savedConsensus, setSavedConsensus] = useState<ConsensusData | null>(null);
  const [kisFundamentals, setKisFundamentals] = useState<FundamentalsData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setSavedConsensus(null);
      return;
    }

    setSavedConsensus(readConsensus(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!symbol || typeof window === "undefined") {
      setKisFundamentals(null);
      return;
    }

    const cached = readCache<FundamentalsPayload>(fundamentalsCacheKey);

    if (cached?.data?.ok && cached.data.data) {
      setKisFundamentals(cached.data.data);
      return;
    }

    let isMounted = true;

    async function fetchFundamentals() {
      try {
        const response = await fetch(
          `/api/kis/fundamentals?symbol=${encodeURIComponent(symbol)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as FundamentalsPayload;

        if (!isMounted) return;

        if (payload.ok && payload.data) {
          setKisFundamentals(payload.data);
          writeCache(fundamentalsCacheKey, {
            savedAt: new Date().toISOString(),
            data: payload,
          });
        } else {
          setKisFundamentals(null);
        }
      } catch {
        if (isMounted) {
          setKisFundamentals(null);
        }
      }
    }

    fetchFundamentals();

    return () => {
      isMounted = false;
    };
  }, [fundamentalsCacheKey, symbol]);

  const targetPrice = data?.score?.targetPrice ?? null;
  const range = targetPrice?.technicalTargetRange ?? null;
  const finalRange = targetPrice?.finalTargetRange ?? null;
  const valuationRange = targetPrice?.valuationTargetRange ?? null;
  const targetModes = Array.isArray(targetPrice?.targetModes)
    ? targetPrice.targetModes
    : [];
  const selectedTargetMode = targetPrice?.selectedTargetMode ?? "balanced";
  const selectedModeResult =
    targetModes.find((modeResult: any) => modeResult?.mode === selectedTargetMode) ??
    targetModes.find((modeResult: any) => modeResult?.mode === "balanced") ??
    targetModes[0] ??
    null;

  const currentPrice =
    getNumber(data?.currentPrice) ??
    getNumber(finalRange?.currentPrice) ??
    getNumber(range?.currentPrice) ??
    null;
  const fundamentals = data?.fundamentals ?? kisFundamentals ?? null;

  const technicalTarget = getTechnicalTarget(targetPrice, range);
  const valuationFallback = calculateValuationTargetRange(currentPrice, fundamentals);
  const valuationTarget =
    getNumber(valuationRange?.valuationTarget) ??
    getNumber(valuationFallback.valuationTarget);
  const supabaseConsensus = data?.consensus as SupabaseConsensusData | null | undefined;
  const consensusTarget =
    getNumber(targetPrice?.consensusTarget) ??
    getNumber(supabaseConsensus?.averageTarget) ??
    getNumber(savedConsensus?.averageTargetPrice);

  const estimate = calculateEstimate({
    technicalTarget,
    valuationTarget,
    consensusTarget,
    selectedModeResult,
  });

  const estimateGap =
    estimate.estimate != null && currentPrice != null
      ? ((estimate.estimate - currentPrice) / currentPrice) * 100
      : null;

  const estimateProgress =
    estimate.estimate != null && currentPrice != null && estimate.estimate > 0
      ? (currentPrice / estimate.estimate) * 100
      : null;

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>異붿젙媛 ?곗젙 諛⑹떇</span>
          <strong>
            {estimate.estimate != null ? formatPrice(estimate.estimate) : "?곗씠???湲?}
          </strong>
        </div>

        <p className="target-basis-summary">
          異붿젙媛??A/B/C 湲곗?媛??媛以묓룊洹좎뿉 ??맞룹닔湲됀룹쐞??蹂댁젙???뷀빐
          怨꾩궛?⑸땲?? 而⑥꽱?쒖뒪媛 ?놁쑝硫?A/B 湲곗??쇰줈 媛以묒튂瑜??먮룞 ?щ텇諛고빀?덈떎.
        </p>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>1. 湲곗?媛</span>
            <strong>{estimate.weightText}</strong>
          </div>

          <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
            <SummaryMetricCard
              title="A. 湲곗닠??湲곗?媛"
              value={formatPrice(technicalTarget)}
              subText={`媛以묒튂 ${formatWeight(estimate.weights.technical)}`}
            />
            <SummaryMetricCard
              title="B. ?ㅼ쟻쨌諛몃쪟 湲곗?媛"
              value={formatPrice(valuationTarget)}
              subText={`媛以묒튂 ${formatWeight(estimate.weights.valuation)} 쨌 ${makeValuationSubText(
                valuationRange,
                valuationFallback,
              )}`}
            />
            <SummaryMetricCard
              title="C. 而⑥꽱?쒖뒪 湲곗?媛"
              value={formatPrice(consensusTarget)}
              subText={`媛以묒튂 ${formatWeight(estimate.weights.consensus)} 쨌 ${makeConsensusSubText(
                savedConsensus,
              )}`}
            />
            <SummaryMetricCard
              title="湲곗?媛 媛以묓룊洹?
              value={formatPrice(estimate.basisAverage)}
              subText={consensusTarget != null ? "A+B+C 湲곗?" : "A+B 湲곗?"}
            />
          </div>
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>2. 蹂댁젙</span>
            <strong>
              {formatAdjustment(
                estimate.adjustment.totalPercent,
                estimate.adjustment.totalAmount,
              )}
            </strong>
          </div>

          <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
            <SummaryMetricCard
              title="???蹂댁젙"
              value={formatAdjustment(
                estimate.adjustment.quantPercent,
                estimate.adjustment.quantAmount,
              )}
              subText="湲곕낯 紐⑤뜽 ?먯닔"
            />
            <SummaryMetricCard
              title="?섍툒 蹂댁젙"
              value={formatAdjustment(
                estimate.adjustment.supplyPercent,
                estimate.adjustment.supplyAmount,
              )}
              subText="?섍툒쨌紐⑤찘? 媛??
            />
            <SummaryMetricCard
              title="?꾪뿕 蹂댁젙"
              value={formatAdjustment(
                estimate.adjustment.riskPercent,
                estimate.adjustment.riskAmount,
              )}
              subText="怨쇱뿴쨌蹂?숈꽦 ?쒗븳"
            />
            <SummaryMetricCard
              title="珥?蹂댁젙"
              value={formatAdjustment(
                estimate.adjustment.totalPercent,
                estimate.adjustment.totalAmount,
              )}
              subText="????섍툒+?꾪뿕"
            />
          </div>
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>3. 異붿젙媛</span>
            <strong>{makeSummaryLabel(technicalTarget, valuationTarget, consensusTarget, estimate.estimate)}</strong>
          </div>

          <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
            <SummaryMetricCard
              title="異붿젙媛"
              value={formatPrice(estimate.estimate)}
              subText={estimate.estimateSource}
            />
            <SummaryMetricCard
              title="異붿젙 愿대━??
              value={formatPercent(estimateGap)}
              subText="?꾩옱媛 ?鍮?
            />
            <SummaryMetricCard
              title="異붿젙媛 ?꾨떖瑜?
              value={formatPercent(estimateProgress, false)}
              subText="?꾩옱媛 / 異붿젙媛"
            />
            <SummaryMetricCard
              title="?몃? ?곗젙 洹쇨굅"
              value="Detail 1~5"
              subText="湲곗?媛쨌?섍툒쨌?꾪뿕 ?뺤씤"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryMetricCard({
  title,
  value,
  subText,
}: {
  title: string;
  value: string;
  subText: string;
}) {
  return (
    <div className="target-metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <em>{subText}</em>
    </div>
  );
}

function calculateEstimate({
  technicalTarget,
  valuationTarget,
  consensusTarget,
  selectedModeResult,
}: {
  technicalTarget?: number | null;
  valuationTarget?: number | null;
  consensusTarget?: number | null;
  selectedModeResult?: any;
}): EstimateResult {
  const hasTechnical = technicalTarget != null && Number.isFinite(technicalTarget);
  const hasValuation = valuationTarget != null && Number.isFinite(valuationTarget);
  const hasConsensus = consensusTarget != null && Number.isFinite(consensusTarget);

  if (!hasTechnical && !hasValuation && !hasConsensus) {
    return {
      basisAverage: null,
      estimate: null,
      weights: {
        technical: 0,
        valuation: 0,
        consensus: 0,
      },
      weightText: "A/B/C ?곗씠???湲?,
      adjustment: makeAdjustmentInfo(null, 0, 0, 0),
      estimateSource: "?곗씠???湲?,
    };
  }

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

  const weights = {
    technical: totalWeight > 0 ? rawWeights.technical / totalWeight : 0,
    valuation: totalWeight > 0 ? rawWeights.valuation / totalWeight : 0,
    consensus: totalWeight > 0 ? rawWeights.consensus / totalWeight : 0,
  };

  const basisAverage = roundPrice(
    (technicalTarget ?? 0) * weights.technical +
      (valuationTarget ?? 0) * weights.valuation +
      (consensusTarget ?? 0) * weights.consensus,
  );

  if (basisAverage == null) {
    return {
      basisAverage: null,
      estimate: null,
      weights,
      weightText: formatWeights(weights),
      adjustment: makeAdjustmentInfo(null, 0, 0, 0),
      estimateSource: "?곗씠???湲?,
    };
  }

  const quantAdjustment = selectedModeResult?.quantAdjustment ?? {};
  const quantPercent = getNumber(quantAdjustment.baseAdjustmentPercent) ?? 0;
  const riskPercent = getNumber(quantAdjustment.riskAdjustmentPercent) ?? 0;
  const supplyPercent = getNumber(quantAdjustment.positiveAdjustmentPercent) ?? 0;

  const adjustment = makeAdjustmentInfo(
    basisAverage,
    quantPercent,
    supplyPercent,
    riskPercent,
  );

  const estimate = roundPrice(basisAverage + (adjustment.totalAmount ?? 0));

  return {
    basisAverage,
    estimate,
    weights,
    weightText: formatWeights(weights),
    adjustment,
    estimateSource: "湲곗?媛 媛以묓룊洹?+ 蹂댁젙",
  };
}

function makeAdjustmentInfo(
  basisAverage: number | null,
  quantPercent: number,
  supplyPercent: number,
  riskPercent: number,
): AdjustmentInfo {
  const quantAmount = calculateAdjustmentAmount(basisAverage, quantPercent);
  const supplyAmount = calculateAdjustmentAmount(basisAverage, supplyPercent);
  const riskAmount = calculateAdjustmentAmount(basisAverage, riskPercent);

  const totalAmount =
    quantAmount != null && supplyAmount != null && riskAmount != null
      ? roundPrice(quantAmount + supplyAmount + riskAmount)
      : null;

  const totalPercent =
    basisAverage != null && basisAverage !== 0 && totalAmount != null
      ? (totalAmount / basisAverage) * 100
      : null;

  return {
    quantPercent,
    supplyPercent,
    riskPercent,
    totalPercent,
    quantAmount,
    supplyAmount,
    riskAmount,
    totalAmount,
  };
}

function calculateAdjustmentAmount(basisAverage: number | null, percent: number) {
  if (basisAverage == null || !Number.isFinite(basisAverage)) return null;

  return roundPrice((basisAverage * percent) / 100);
}

function getTechnicalTarget(targetPrice: any, range: any) {
  const candidates = targetPrice?.targetBasis?.candidates;

  if (Array.isArray(candidates)) {
    const technicalCandidate = candidates.find((candidate) =>
      String(candidate?.label ?? "").includes("湲곗닠"),
    );

    const value = getNumber(technicalCandidate?.value);

    if (value != null) return value;
  }

  return getNumber(range?.baseTarget);
}

function calculateValuationTargetRange(
  currentPrice?: number | null,
  fundamentals?: FundamentalsData | null,
): ValuationFallback {
  if (!fundamentals || currentPrice == null || currentPrice <= 0) {
    return {
      epsTarget: null,
      bpsTarget: null,
      valuationTarget: null,
      method: "KIS 議고쉶 ??諛섏쁺",
    };
  }

  const per = fundamentals.per;
  const pbr = fundamentals.pbr;
  const eps = fundamentals.eps;
  const bps = fundamentals.bps;

  const perAdjustment = getPerAdjustment(per);
  const pbrAdjustment = getPbrAdjustment(pbr);

  const epsTarget =
    eps != null && eps > 0 && per != null && per > 0 && perAdjustment != null
      ? roundPrice(eps * per * perAdjustment)
      : null;
  const bpsTarget =
    bps != null && bps > 0 && pbr != null && pbr > 0 && pbrAdjustment != null
      ? roundPrice(bps * pbr * pbrAdjustment)
      : null;

  const targets = [epsTarget, bpsTarget].filter(
    (value): value is number => value != null && Number.isFinite(value) && value > 0,
  );

  if (!targets.length) {
    return {
      epsTarget,
      bpsTarget,
      valuationTarget: null,
      method: "EPS/BPS ?곗젙 ?湲?,
    };
  }

  const valuationTarget = roundPrice(
    targets.reduce((sum, value) => sum + value, 0) / targets.length,
  );

  if (valuationTarget == null) {
    return {
      epsTarget,
      bpsTarget,
      valuationTarget: null,
      method: "?ㅼ쟻쨌諛몃쪟 ?곗젙 ?湲?,
    };
  }

  return {
    epsTarget,
    bpsTarget,
    valuationTarget: clampValuationTarget(valuationTarget, currentPrice),
    method: "EPS/PER + BPS/PBR",
  };
}

function formatWeights(weights: EstimateWeights) {
  const parts = [];

  if (weights.technical > 0) parts.push(`A ${formatWeight(weights.technical)}`);
  if (weights.valuation > 0) parts.push(`B ${formatWeight(weights.valuation)}`);
  if (weights.consensus > 0) parts.push(`C ${formatWeight(weights.consensus)}`);

  return parts.length ? parts.join(" 쨌 ") : "媛以묒튂 ?湲?;
}

function makeSummaryLabel(
  technicalTarget?: number | null,
  valuationTarget?: number | null,
  consensusTarget?: number | null,
  estimate?: number | null,
) {
  const values = [technicalTarget, valuationTarget, consensusTarget].filter(
    (value): value is number => value != null && Number.isFinite(value),
  );

  if (!values.length || estimate == null) return "異붿젙媛 ?뺤씤 ?꾩슂";
  if (values.length < 3) return "A/B 湲곗?";

  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const dispersion = avg > 0 ? ((max - min) / avg) * 100 : 0;

  if (dispersion <= 10) return "A/B/C ?쇱튂";
  if (dispersion <= 25) return "?쇰? 李⑥씠";
  return "李⑥씠 ??;
}

function makeValuationSubText(valuationRange: any, fallback: ValuationFallback) {
  if (valuationRange?.valuationTarget != null) return "EPS/PER + BPS/PBR";
  if (fallback.valuationTarget != null) return fallback.method;
  return "KIS 議고쉶 ??諛섏쁺";
}

function makeConsensusSubText(consensus?: ConsensusData | null) {
  if (!consensus?.averageTargetPrice) return "?낅젰/?????諛섏쁺";

  const parts = [];

  if (consensus.investmentOpinion) parts.push(consensus.investmentOpinion);
  if (consensus.analystCount != null) parts.push(`${consensus.analystCount}媛?);

  return parts.length ? parts.join(" 쨌 ") : "??λ맂 而⑥꽱?쒖뒪";
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

function makeCacheKey(prefix: string, symbol?: string | null) {
  return `${prefix}:${(symbol || "").trim().toUpperCase()}`;
}

function readConsensus(key: string): ConsensusData | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as ConsensusData;

    if (!parsed || typeof parsed !== "object") return null;

    return parsed;
  } catch {
    return null;
  }
}

function readCache<T>(key: string): { savedAt: string; data: T } | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as { savedAt: string; data: T };
    const savedAt = new Date(parsed.savedAt).getTime();

    if (!Number.isFinite(savedAt) || Date.now() - savedAt > KIS_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: { savedAt: string; data: T }) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 罹먯떆 ????ㅽ뙣???붾㈃ ?쒖떆瑜?留됱? ?딆뒿?덈떎.
  }
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPerAdjustment(per?: number | null) {
  if (per == null || !Number.isFinite(per) || per <= 0) return null;
  if (per <= 10) return 1.08;
  if (per <= 20) return 1;
  if (per <= 30) return 0.92;
  if (per <= 40) return 0.84;
  return 0.75;
}

function getPbrAdjustment(pbr?: number | null) {
  if (pbr == null || !Number.isFinite(pbr) || pbr <= 0) return null;
  if (pbr <= 1) return 1.08;
  if (pbr <= 2) return 1;
  if (pbr <= 3) return 0.92;
  if (pbr <= 5) return 0.85;
  return 0.75;
}

function clampValuationTarget(target: number, currentPrice: number) {
  const lower = currentPrice * 0.8;
  const upper = currentPrice * 1.35;

  return roundPrice(Math.max(lower, Math.min(target, upper)));
}

function roundPrice(value: number) {
  if (!Number.isFinite(value)) return null;

  if (value >= 100_000) return Math.round(value / 10) * 10;
  if (value >= 10_000) return Math.round(value / 5) * 5;
  return Math.round(value);
}

function formatPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "?곗씠???놁쓬";

  return `${new Intl.NumberFormat("ko-KR").format(value)}??;
}

function formatSignedPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "?곗씠???놁쓬";

  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("ko-KR").format(value)}??;
}

function formatPercent(value?: number | null, withSign = true) {
  if (value == null || Number.isNaN(value)) return "?곗씠???놁쓬";

  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatAdjustment(percent?: number | null, amount?: number | null) {
  if (percent == null || Number.isNaN(percent)) return "?곗씠???놁쓬";

  return `${formatPercent(percent)} / ${formatSignedPrice(amount)}`;
}

function formatWeight(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "?곗씠???놁쓬";

  return `${(value * 100).toFixed(0)}%`;
}


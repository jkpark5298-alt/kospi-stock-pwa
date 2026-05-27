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

    if (cached?.data?.ok && isUsableFundamentals(cached.data.data)) {
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

        if (payload.ok && isUsableFundamentals(payload.data)) {
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

  const usableFundamentals = getUsableFundamentals(data?.fundamentals, kisFundamentals);

  const technicalTarget = getTechnicalTarget(targetPrice, range);
  const valuationFallback = calculateValuationTargetRange(currentPrice, usableFundamentals);
  const valuationTarget =
    getNumber(valuationRange?.valuationTarget) ??
    getNumber(valuationFallback.valuationTarget);
  const consensusTarget =
    getNumber(targetPrice?.consensusTarget) ??
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
          <span>추정가 산정 방식</span>
          <strong>
            {estimate.estimate != null ? formatPrice(estimate.estimate) : "데이터 대기"}
          </strong>
        </div>

        <p className="target-basis-summary">
          추정가는 A/B/C 기준가의 가중평균에 퀀트·수급·위험 보정을 더해 계산합니다.
          컨센서스가 없으면 A/B 기준으로 가중치를 자동 재분배합니다.
        </p>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>1. 기준가</span>
            <strong>{estimate.weightText}</strong>
          </div>

          <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
            <SummaryMetricCard
              title="A. 기술적 기준가"
              value={formatPrice(technicalTarget)}
              subText={`가중치 ${formatWeight(estimate.weights.technical)}`}
            />
            <SummaryMetricCard
              title="B. 실적·밸류 기준가"
              value={formatPrice(valuationTarget)}
              subText={`가중치 ${formatWeight(estimate.weights.valuation)} · ${makeValuationSubText(
                valuationRange,
                valuationFallback,
              )}`}
            />
            <SummaryMetricCard
              title="C. 컨센서스 기준가"
              value={formatPrice(consensusTarget)}
              subText={`가중치 ${formatWeight(estimate.weights.consensus)} · ${makeConsensusSubText(
                savedConsensus,
              )}`}
            />
            <SummaryMetricCard
              title="기준가 가중평균"
              value={formatPrice(estimate.basisAverage)}
              subText={consensusTarget != null ? "A+B+C 기준" : "A+B 기준"}
            />
          </div>
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>2. 보정</span>
            <strong>
              {formatAdjustment(
                estimate.adjustment.totalPercent,
                estimate.adjustment.totalAmount,
              )}
            </strong>
          </div>

          <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
            <SummaryMetricCard
              title="퀀트 보정"
              value={formatAdjustment(
                estimate.adjustment.quantPercent,
                estimate.adjustment.quantAmount,
              )}
              subText="기본 모델 점수"
            />
            <SummaryMetricCard
              title="수급 보정"
              value={formatAdjustment(
                estimate.adjustment.supplyPercent,
                estimate.adjustment.supplyAmount,
              )}
              subText="수급·모멘텀 가산"
            />
            <SummaryMetricCard
              title="위험 보정"
              value={formatAdjustment(
                estimate.adjustment.riskPercent,
                estimate.adjustment.riskAmount,
              )}
              subText="과열·변동성 제한"
            />
            <SummaryMetricCard
              title="총 보정"
              value={formatAdjustment(
                estimate.adjustment.totalPercent,
                estimate.adjustment.totalAmount,
              )}
              subText="퀀트+수급+위험"
            />
          </div>
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>3. 추정가</span>
            <strong>
              {makeSummaryLabel(technicalTarget, valuationTarget, consensusTarget, estimate.estimate)}
            </strong>
          </div>

          <div className="summary-grid summary-grid-four" style={{ marginTop: 12 }}>
            <SummaryMetricCard
              title="추정가"
              value={formatPrice(estimate.estimate)}
              subText={estimate.estimateSource}
            />
            <SummaryMetricCard
              title="추정 괴리율"
              value={formatPercent(estimateGap)}
              subText="현재가 대비"
            />
            <SummaryMetricCard
              title="추정가 도달률"
              value={formatPercent(estimateProgress, false)}
              subText="현재가 / 추정가"
            />
            <SummaryMetricCard
              title="세부 산정 근거"
              value="Detail 1~5"
              subText="기준가·수급·위험 확인"
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
  const detailLink = getSummaryDetailLink(title, subText);
  const canOpenDetail = detailLink != null;

  function handleOpenDetail() {
    if (!detailLink || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const detailElement = document.querySelector(
      `[data-detail-id="${detailLink.detailId}"]`,
    ) as HTMLElement | null;

    const popup = window.open(
      "",
      "_blank",
      "popup=yes,width=1280,height=920,noopener=no,noreferrer=no",
    );

    if (!popup) {
      alert("브라우저에서 새 창이 차단되었습니다. 팝업 허용 후 다시 클릭해 주세요.");
      return;
    }

    const stylesHtml = getSummaryCurrentDocumentStyles();
    const detailHtml = detailElement
      ? makeOpenedDetailHtml(detailElement)
      : makeFallbackDetailHtml(detailLink.title, value, subText);

    popup.document.open();
    popup.document.write(
      makeLinkedDetailWindowHtml({
        title: detailLink.title,
        value,
        subText,
        detailHtml,
        stylesHtml,
      }),
    );
    popup.document.close();
    popup.focus();
  }

  return (
    <div
      className="target-metric-card"
      role={canOpenDetail ? "button" : undefined}
      tabIndex={canOpenDetail ? 0 : undefined}
      onClick={handleOpenDetail}
      onKeyDown={(event) => {
        if (!canOpenDetail) return;

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpenDetail();
        }
      }}
      title={canOpenDetail ? "연결된 DETAIL 새 창으로 보기" : undefined}
    >
      <span>{title}</span>
      <strong>{value}</strong>
      <em>{subText}</em>
    </div>
  );
}

function getSummaryDetailLink(title: string, subText: string) {
  const normalizedTitle = String(title ?? "");
  const normalizedSubText = String(subText ?? "");

  if (normalizedTitle.includes("A.") || normalizedTitle.includes("기술적")) {
    return {
      detailId: "detail-1",
      title: "A. 기술적 기준가 내용 및 분석",
    };
  }

  if (
    normalizedTitle.includes("B.") ||
    normalizedTitle.includes("실적") ||
    normalizedTitle.includes("밸류")
  ) {
    return {
      detailId: "detail-2",
      title: "B. 실적·밸류 기준가 내용 및 분석",
    };
  }

  if (normalizedTitle.includes("C.") || normalizedTitle.includes("컨센서스")) {
    return {
      detailId: "detail-3",
      title: "C. 컨센서스 기준가 내용 및 분석",
    };
  }

  if (
    normalizedTitle.includes("수급") ||
    normalizedTitle.includes("긍정 신호") ||
    normalizedSubText.includes("수급") ||
    normalizedSubText.includes("모멘텀")
  ) {
    return {
      detailId: "detail-4",
      title: "수급 및 분석",
    };
  }

  if (normalizedTitle.includes("위험")) {
    return {
      detailId: "detail-5",
      title: "위험 및 검증 분석",
    };
  }

  return null;
}

function makeOpenedDetailHtml(detailElement: HTMLElement) {
  const clone = detailElement.cloneNode(true) as HTMLElement;

  if (clone instanceof HTMLDetailsElement) {
    clone.open = true;
  }

  clone.querySelectorAll("details").forEach((detailsElement) => {
    detailsElement.setAttribute("open", "");
  });

  return clone.outerHTML;
}

function makeFallbackDetailHtml(title: string, value: string, subText: string) {
  return `
    <section class="linked-detail-fallback">
      <h2>${escapeSummaryDetailHtml(title)}</h2>
      <p>연결된 DETAIL 섹션을 현재 화면에서 찾지 못했습니다. 분석 실행 후 다시 클릭해 주세요.</p>
      <div class="linked-detail-value">
        <strong>${escapeSummaryDetailHtml(value)}</strong>
        <em>${escapeSummaryDetailHtml(subText)}</em>
      </div>
    </section>
  `;
}

function getSummaryCurrentDocumentStyles() {
  if (typeof document === "undefined") return "";

  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => {
      if (node.tagName.toLowerCase() === "link") {
        const href = (node as HTMLLinkElement).href;
        return href ? `<link rel="stylesheet" href="${escapeSummaryDetailHtml(href)}" />` : "";
      }

      return `<style>${node.textContent ?? ""}</style>`;
    })
    .join("\n");
}

function makeLinkedDetailWindowHtml({
  title,
  value,
  subText,
  detailHtml,
  stylesHtml,
}: {
  title: string;
  value: string;
  subText: string;
  detailHtml: string;
  stylesHtml: string;
}) {
  const safeTitle = escapeSummaryDetailHtml(title);
  const safeValue = escapeSummaryDetailHtml(value);
  const safeSubText = escapeSummaryDetailHtml(subText);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  ${stylesHtml}
  <style>
    body {
      margin: 0;
      background: #eef4ff;
      color: #0f172a;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .linked-detail-window {
      width: min(1180px, calc(100% - 32px));
      margin: 28px auto;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 28px;
      background: #fff;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.14);
      overflow: hidden;
    }

    .linked-detail-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 26px 32px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(255, 255, 255, 0.96);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .linked-detail-eyebrow {
      display: block;
      color: #2563eb;
      font-weight: 900;
      font-size: 0.8rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .linked-detail-header h1 {
      margin: 0;
      font-size: clamp(1.55rem, 3vw, 2.35rem);
      line-height: 1.2;
      letter-spacing: -0.04em;
    }

    .linked-detail-close {
      height: 42px;
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 999px;
      background: #fff;
      padding: 0 18px;
      font-weight: 900;
      cursor: pointer;
    }

    .linked-detail-summary {
      padding: 24px 32px 0;
    }

    .linked-detail-value {
      border-radius: 24px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(219, 234, 254, 0.78));
      padding: 20px;
      margin-bottom: 18px;
    }

    .linked-detail-label {
      display: block;
      color: #64748b;
      font-size: 0.82rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .linked-detail-value strong {
      display: block;
      margin-top: 8px;
      color: #1d4ed8;
      font-size: clamp(1.8rem, 5vw, 2.7rem);
    }

    .linked-detail-value em {
      display: block;
      margin-top: 8px;
      color: #64748b;
      font-style: normal;
      line-height: 1.55;
    }

    .linked-detail-content {
      padding: 0 32px 32px;
    }

    .linked-detail-content > details,
    .linked-detail-content > section,
    .linked-detail-content .section-group {
      margin-top: 0 !important;
    }

    .linked-detail-content details {
      display: block;
    }

    .linked-detail-fallback {
      border-radius: 24px;
      background: rgba(15, 23, 42, 0.045);
      padding: 22px;
      color: #334155;
      line-height: 1.75;
      font-size: 1.05rem;
    }
  </style>
</head>
<body>
  <div class="linked-detail-window">
    <header class="linked-detail-header">
      <div>
        <span class="linked-detail-eyebrow">LINKED DETAIL</span>
        <h1>${safeTitle}</h1>
      </div>
      <button class="linked-detail-close" type="button" onclick="window.close()">닫기</button>
    </header>

    <main>
      <section class="linked-detail-summary">
        <div class="linked-detail-value">
          <span class="linked-detail-label">선택한 기준</span>
          <strong>${safeValue}</strong>
          <em>${safeSubText}</em>
        </div>
      </section>

      <section class="linked-detail-content">
        ${detailHtml}
      </section>
    </main>
  </div>
</body>
</html>`;
}

function escapeSummaryDetailHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
      weightText: "A/B/C 데이터 대기",
      adjustment: makeAdjustmentInfo(null, 0, 0, 0),
      estimateSource: "데이터 대기",
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
      estimateSource: "데이터 대기",
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
    estimateSource: "기준가 가중평균 + 보정",
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
      String(candidate?.label ?? "").includes("기술"),
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
  if (!isUsableFundamentals(fundamentals) || currentPrice == null || currentPrice <= 0) {
    return {
      epsTarget: null,
      bpsTarget: null,
      valuationTarget: null,
      method: "KIS 조회 후 반영",
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
      method: "EPS/BPS 산정 대기",
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
      method: "실적·밸류 산정 대기",
    };
  }

  return {
    epsTarget,
    bpsTarget,
    valuationTarget: clampValuationTarget(valuationTarget, currentPrice),
    method: "EPS/PER + BPS/PBR",
  };
}

function getUsableFundamentals(
  primary?: FundamentalsData | null,
  fallback?: FundamentalsData | null,
) {
  if (isUsableFundamentals(primary)) return primary;
  if (isUsableFundamentals(fallback)) return fallback;
  return null;
}

function isUsableFundamentals(value?: FundamentalsData | null): value is FundamentalsData {
  if (!value) return false;

  const numbers = [value.per, value.pbr, value.eps, value.bps];

  return numbers.some((item) => item != null && Number.isFinite(item) && item > 0);
}

function formatWeights(weights: EstimateWeights) {
  const parts = [];

  if (weights.technical > 0) parts.push(`A ${formatWeight(weights.technical)}`);
  if (weights.valuation > 0) parts.push(`B ${formatWeight(weights.valuation)}`);
  if (weights.consensus > 0) parts.push(`C ${formatWeight(weights.consensus)}`);

  return parts.length ? parts.join(" · ") : "가중치 대기";
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

  if (!values.length || estimate == null) return "추정가 확인 필요";
  if (values.length < 3) return "A/B 기준";

  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const dispersion = avg > 0 ? ((max - min) / avg) * 100 : 0;

  if (dispersion <= 10) return "A/B/C 일치";
  if (dispersion <= 25) return "일부 차이";
  return "차이 큼";
}

function makeValuationSubText(valuationRange: any, fallback: ValuationFallback) {
  if (valuationRange?.valuationTarget != null) return "EPS/PER + BPS/PBR";
  if (fallback.valuationTarget != null) return fallback.method;
  return "KIS 조회 후 반영";
}

function makeConsensusSubText(consensus?: ConsensusData | null) {
  if (!consensus?.averageTargetPrice) return "입력/저장 후 반영";

  const parts = [];

  if (consensus.investmentOpinion) parts.push(consensus.investmentOpinion);
  if (consensus.analystCount != null) parts.push(`${consensus.analystCount}개`);

  return parts.length ? parts.join(" · ") : "저장된 컨센서스";
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
    // 캐시 저장 실패는 화면 표시를 막지 않습니다.
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
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatSignedPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatPercent(value?: number | null, withSign = true) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatAdjustment(percent?: number | null, amount?: number | null) {
  if (percent == null || Number.isNaN(percent)) return "데이터 없음";

  return `${formatPercent(percent)} / ${formatSignedPrice(amount)}`;
}

function formatWeight(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${(value * 100).toFixed(0)}%`;
}

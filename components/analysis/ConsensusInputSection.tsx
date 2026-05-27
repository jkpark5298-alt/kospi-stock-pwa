"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ConsensusSource = "naver" | "fnguide" | "manual" | "report" | "excel";

type ConsensusData = {
  averageTargetPrice: number | null;
  highTargetPrice: number | null;
  lowTargetPrice: number | null;
  investmentOpinion: string;
  analystCount: number | null;
  reportCount: number | null;
  source: ConsensusSource;
  baseDate: string;
  memo: string;
  rawText: string;
  savedAt: string;
};

type ConsensusUploadTarget = {
  symbol: string;
  name?: string | null;
  baseDate: string;
  averageTarget: number | null;
  highTarget: number | null;
  lowTarget: number | null;
  opinion?: string | null;
  brokerCount?: number | null;
  reportCount?: number | null;
  source?: string | null;
  memo?: string | null;
};

type ConsensusApiRecord = {
  symbol?: string | null;
  name?: string | null;
  baseDate?: string | null;
  averageTarget?: number | null;
  highTarget?: number | null;
  lowTarget?: number | null;
  opinion?: string | null;
  brokerCount?: number | null;
  reportCount?: number | null;
  source?: string | null;
  memo?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

type Props = {
  symbol?: string | null;
  name?: string | null;
  appTargetPrice?: number | null;
  currentPrice?: number | null;
  targetPrice?: any | null;
  fundamentals?: any | null;
};

const CONSENSUS_STORAGE_PREFIX = "kospi-consensus-data";

const EMPTY_CONSENSUS: ConsensusData = {
  averageTargetPrice: null,
  highTargetPrice: null,
  lowTargetPrice: null,
  investmentOpinion: "",
  analystCount: null,
  reportCount: null,
  source: "naver",
  baseDate: "",
  memo: "",
  rawText: "",
  savedAt: "",
};

export default function ConsensusInputSection({
  symbol,
  name,
  appTargetPrice,
  currentPrice,
  targetPrice,
  fundamentals,
}: Props) {
  const storageKey = useMemo(() => makeStorageKey(symbol, name), [symbol, name]);
  const normalizedSymbol = useMemo(() => normalizeSymbol(symbol), [symbol]);

  const [rawText, setRawText] = useState("");
  const [consensus, setConsensus] = useState<ConsensusData>(EMPTY_CONSENSUS);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState("엑셀 파일을 선택해 주세요.");
  const [uploadRows, setUploadRows] = useState<ConsensusUploadTarget[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setRawText("");
      setConsensus(EMPTY_CONSENSUS);
      setSavedAt(null);
      return;
    }

    const saved = readConsensus(storageKey);

    if (saved) {
      setConsensus(saved);
      setRawText(saved.rawText || "");
      setSavedAt(saved.savedAt || null);
      return;
    }

    setRawText("");
    setConsensus(EMPTY_CONSENSUS);
    setSavedAt(null);
  }, [storageKey]);

  useEffect(() => {
    refreshCurrentConsensus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSymbol]);

  const computedAppTargetPrice =
    calculateSummaryAppTargetPrice({
      currentPrice,
      targetPrice,
      fundamentals,
      consensusAverageTargetPrice: consensus.averageTargetPrice,
    }) ?? appTargetPrice;

  const comparison = makeConsensusComparison(
    computedAppTargetPrice,
    consensus.averageTargetPrice,
    consensus.highTargetPrice,
    consensus.lowTargetPrice,
  );

  const hasConsensus =
    consensus.averageTargetPrice != null ||
    consensus.highTargetPrice != null ||
    consensus.lowTargetPrice != null ||
    consensus.analystCount != null ||
    Boolean(consensus.investmentOpinion);

  const displayName = name || symbol || "현재 종목";

  function applyConsensus(next: ConsensusData) {
    setConsensus(next);
    setRawText(next.rawText || "");
    setSavedAt(next.savedAt || null);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  }

  async function refreshCurrentConsensus() {
    if (!normalizedSymbol) return;

    setIsRefreshing(true);

    try {
      const response = await fetch(
        `/api/consensus?symbol=${encodeURIComponent(normalizedSymbol)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        record?: ConsensusApiRecord | null;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        setUploadStatus(payload.error || "현재 종목 컨센서스 조회에 실패했습니다.");
        return;
      }

      if (!payload.record) {
        setUploadStatus("현재 종목에 저장된 Supabase 컨센서스가 없습니다.");
        return;
      }

      const next = mapApiRecordToConsensus(payload.record);
      applyConsensus(next);
      setUploadStatus(
        `${normalizedSymbol} 컨센서스를 불러왔습니다. 평균목표가 ${formatPrice(
          next.averageTargetPrice,
        )}`,
      );
    } catch (error) {
      setUploadStatus(
        error instanceof Error
          ? error.message
          : "현재 종목 컨센서스 조회에 실패했습니다.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleParse() {
    const parsed = parseConsensusText(rawText);

    setConsensus((prev) => ({
      ...prev,
      ...parsed,
      rawText,
    }));
  }

  function handleSave() {
    if (typeof window === "undefined") return;

    const next: ConsensusData = {
      ...consensus,
      rawText,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setConsensus(next);
    setSavedAt(next.savedAt);
    setUploadStatus("브라우저 임시 저장을 완료했습니다. Supabase 저장은 엑셀 업로드를 사용하세요.");
  }

  function handleClear() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }

    setRawText("");
    setConsensus(EMPTY_CONSENSUS);
    setSavedAt(null);
    setUploadStatus("현재 화면의 임시 입력값을 지웠습니다.");
  }

  async function handleExcelFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploadFileName(file.name);
    setUploadStatus("엑셀 파일을 읽는 중입니다.");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName =
        workbook.SheetNames.find((item) => item.trim() === "컨센서스") ??
        workbook.SheetNames[0];

      if (!sheetName) {
        setUploadRows([]);
        setUploadStatus("엑셀 시트를 찾지 못했습니다.");
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      const parsedRows = rows
        .map((row) => mapExcelRowToTarget(row))
        .filter((row): row is ConsensusUploadTarget => Boolean(row));

      setUploadRows(parsedRows);

      if (!parsedRows.length) {
        setUploadStatus(
          "저장할 행이 없습니다. 필수 컬럼은 종목코드, 기준일, 평균목표가입니다.",
        );
        return;
      }

      setUploadStatus(
        `${file.name}에서 ${parsedRows.length}건을 읽었습니다. Supabase 저장을 눌러 주세요.`,
      );
    } catch (error) {
      setUploadRows([]);
      setUploadStatus(
        error instanceof Error ? error.message : "엑셀 파일을 읽지 못했습니다.",
      );
    } finally {
      event.target.value = "";
    }
  }

  async function handleUploadToSupabase() {
    if (!uploadRows.length) {
      setUploadStatus("저장할 컨센서스 행이 없습니다.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Supabase에 저장 중입니다.");

    try {
      const response = await fetch("/api/consensus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targets: uploadRows,
          uploadedFileName: uploadFileName || null,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        count?: number;
        records?: ConsensusApiRecord[];
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        setUploadStatus(payload.error || "Supabase 저장에 실패했습니다.");
        return;
      }

      const matchedRecord = payload.records?.find(
        (record) => normalizeSymbol(record.symbol) === normalizedSymbol,
      );

      if (matchedRecord) {
        applyConsensus(mapApiRecordToConsensus(matchedRecord));
      } else if (normalizedSymbol) {
        await refreshCurrentConsensus();
      }

      setUploadStatus(
        `Supabase 저장 완료: ${payload.count ?? uploadRows.length}건 저장`,
      );
    } catch (error) {
      setUploadStatus(
        error instanceof Error ? error.message : "Supabase 저장에 실패했습니다.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>컨센서스 기준가 산정 방식</span>
          <strong>{hasConsensus ? "컨센서스 반영 가능" : "컨센서스 대기"}</strong>
        </div>

        <p className="target-basis-summary">
          네이버증권, FnGuide, 증권사 리포트의 평균·최고·최저 목표가와
          투자의견을 엑셀로 입력한 뒤 Supabase에 저장합니다. 저장된 평균목표가는
          다음 단계에서 C. 컨센서스 기준가로 연결합니다.
        </p>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>컨센서스 엑셀 업로드</span>
            <strong>{uploadRows.length ? `${uploadRows.length}건 읽음` : "대기"}</strong>
          </div>

          <p className="target-basis-summary">
            엑셀 컬럼: 종목코드, 종목명, 기준일, 평균목표가, 최고목표가,
            최저목표가, 투자의견, 참여증권사수, 리포트수, 출처, 메모
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
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelFileChange}
              style={{ maxWidth: 320 }}
            />
            <button
              className="button primary-button"
              type="button"
              onClick={handleUploadToSupabase}
              disabled={!uploadRows.length || isUploading}
            >
              {isUploading ? "저장 중" : "Supabase 저장"}
            </button>
            <button
              className="button secondary-button"
              type="button"
              onClick={refreshCurrentConsensus}
              disabled={!normalizedSymbol || isRefreshing}
            >
              {isRefreshing ? "조회 중" : "현재 종목 새로고침"}
            </button>
          </div>

          <div className="target-basis-adjustments">
            <p>파일명: {uploadFileName || "선택 전"}</p>
            <p>상태: {uploadStatus}</p>
          </div>

          {uploadRows.length ? (
            <div className="target-basis-adjustments">
              <p>
                미리보기:{" "}
                {uploadRows
                  .slice(0, 3)
                  .map(
                    (row) =>
                      `${row.symbol} ${formatPrice(row.averageTarget)} ${
                        row.opinion || ""
                      }`,
                  )
                  .join(" / ")}
              </p>
            </div>
          ) : null}
        </div>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <ConsensusMetricCard
            title="평균목표가"
            value={formatPrice(consensus.averageTargetPrice)}
            subText="C 기준가 후보"
          />
          <ConsensusMetricCard
            title="최고목표가"
            value={formatPrice(consensus.highTargetPrice)}
            subText="공격적 전망"
          />
          <ConsensusMetricCard
            title="최저목표가"
            value={formatPrice(consensus.lowTargetPrice)}
            subText="보수적 전망"
          />
          <ConsensusMetricCard
            title="참여증권사수"
            value={formatCount(consensus.analystCount)}
            subText={consensus.investmentOpinion || "투자의견 없음"}
          />
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>앱 추정가 vs 컨센서스</span>
            <strong>{comparison.title}</strong>
          </div>

          <p className="target-basis-summary">{comparison.description}</p>

          <div className="target-basis-adjustments">
            <p>앱 추정가: {formatPrice(computedAppTargetPrice)}</p>
            <p>컨센서스 평균: {formatPrice(consensus.averageTargetPrice)}</p>
            <p>차이: {comparison.gapText}</p>
            <p>저장 시각: {formatDateTime(savedAt)}</p>
            <p>기준일: {consensus.baseDate || "데이터 없음"}</p>
            <p>출처: {formatSource(consensus.source)}</p>
          </div>
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>컨센서스 원문 입력/임시 저장</span>
            <strong>{displayName}</strong>
          </div>

          <p className="target-basis-summary">
            엑셀 업로드 전 간단히 목표가를 읽어보는 보조 입력입니다. 이 저장은
            브라우저 임시 저장이며, Supabase 저장은 위 엑셀 업로드 영역을
            사용합니다.
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 14,
            }}
          >
            <textarea
              className="form-control"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={`예시)
평균목표가 296,000
최고목표가 330,000
최저목표가 250,000
투자의견 BUY
참여 18개 증권사`}
              rows={7}
              style={{
                width: "100%",
                resize: "vertical",
                minHeight: 140,
                lineHeight: 1.5,
              }}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                className="button primary-button"
                type="button"
                onClick={handleParse}
              >
                컨센서스 읽기
              </button>
              <button
                className="button secondary-button"
                type="button"
                onClick={handleSave}
              >
                임시 저장
              </button>
              <button
                className="button secondary-button"
                type="button"
                onClick={handleClear}
                disabled={!rawText && !hasConsensus && !savedAt}
              >
                지우기
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginTop: 16,
          }}
        >
          <label className="metric-row" style={{ display: "grid", gap: 6 }}>
            <span>출처</span>
            <select
              className="form-control"
              value={consensus.source}
              onChange={(event) =>
                setConsensus((prev) => ({
                  ...prev,
                  source: event.target.value as ConsensusSource,
                }))
              }
            >
              <option value="naver">네이버증권</option>
              <option value="fnguide">FnGuide</option>
              <option value="report">리포트</option>
              <option value="manual">수동</option>
              <option value="excel">엑셀</option>
            </select>
          </label>

          <label className="metric-row" style={{ display: "grid", gap: 6 }}>
            <span>기준일</span>
            <input
              className="form-control"
              value={consensus.baseDate}
              onChange={(event) =>
                setConsensus((prev) => ({
                  ...prev,
                  baseDate: event.target.value,
                }))
              }
              placeholder="예: 2026-05-23"
            />
          </label>

          <label className="metric-row" style={{ display: "grid", gap: 6 }}>
            <span>투자의견</span>
            <input
              className="form-control"
              value={consensus.investmentOpinion}
              onChange={(event) =>
                setConsensus((prev) => ({
                  ...prev,
                  investmentOpinion: event.target.value,
                }))
              }
              placeholder="예: BUY / 매수 / 중립"
            />
          </label>
        </div>

        <p className="notice-text" style={{ marginTop: 14 }}>
          2단계에서는 엑셀 업로드와 Supabase 저장까지만 연결합니다. Summary의
          C. 컨센서스 기준가 자동 반영은 다음 단계에서 적용합니다.
        </p>
      </div>
    </section>
  );
}

function ConsensusMetricCard({
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

function mapExcelRowToTarget(
  row: Record<string, unknown>,
): ConsensusUploadTarget | null {
  const symbol = normalizeSymbol(getCell(row, ["종목코드", "symbol", "Symbol"]));
  const baseDate = parseDateValue(getCell(row, ["기준일", "baseDate", "base_date"]));
  const averageTarget = parseNumber(
    getCell(row, ["평균목표가", "평균 목표가", "averageTarget", "average_target"]),
  );

  if (!symbol || !baseDate || averageTarget == null || averageTarget <= 0) {
    return null;
  }

  return {
    symbol,
    name: toCleanString(getCell(row, ["종목명", "name", "Name"])),
    baseDate,
    averageTarget,
    highTarget: parseNumber(
      getCell(row, ["최고목표가", "최고 목표가", "highTarget", "high_target"]),
    ),
    lowTarget: parseNumber(
      getCell(row, ["최저목표가", "최저 목표가", "lowTarget", "low_target"]),
    ),
    opinion: toCleanString(getCell(row, ["투자의견", "opinion"])),
    brokerCount: parseInteger(
      getCell(row, ["참여증권사수", "참여 증권사 수", "brokerCount", "broker_count"]),
    ),
    reportCount: parseInteger(
      getCell(row, ["리포트수", "리포트 수", "reportCount", "report_count"]),
    ),
    source: toCleanString(getCell(row, ["출처", "source"])) || "엑셀",
    memo: toCleanString(getCell(row, ["메모", "memo"])),
  };
}

function getCell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }

  const normalizedMap = new Map(
    Object.keys(row).map((key) => [normalizeHeader(key), key]),
  );

  for (const key of keys) {
    const matchedKey = normalizedMap.get(normalizeHeader(key));

    if (matchedKey) return row[matchedKey];
  }

  return null;
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

function mapApiRecordToConsensus(record: ConsensusApiRecord): ConsensusData {
  return {
    averageTargetPrice: toNullableNumber(record.averageTarget),
    highTargetPrice: toNullableNumber(record.highTarget),
    lowTargetPrice: toNullableNumber(record.lowTarget),
    investmentOpinion: record.opinion || "",
    analystCount: toNullableNumber(record.brokerCount),
    reportCount: toNullableNumber(record.reportCount),
    source: normalizeConsensusSource(record.source),
    baseDate: record.baseDate || "",
    memo: record.memo || "",
    rawText: "",
    savedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
  };
}

function parseConsensusText(text: string): Partial<ConsensusData> {
  const averageTargetPrice =
    findPriceByLabels(text, [
      "평균 목표가",
      "평균목표가",
      "목표주가 평균",
      "컨센서스 평균",
      "평균",
      "consensus",
      "average",
    ]) ?? findFirstPrice(text);

  const highTargetPrice = findPriceByLabels(text, [
    "최고 목표가",
    "최고목표가",
    "상단",
    "최고",
    "highest",
    "high",
  ]);

  const lowTargetPrice = findPriceByLabels(text, [
    "최저 목표가",
    "최저목표가",
    "하단",
    "최저",
    "lowest",
    "low",
  ]);

  const analystCount = findAnalystCount(text);
  const investmentOpinion = findOpinion(text);
  const baseDate = findDate(text);

  return {
    averageTargetPrice,
    highTargetPrice,
    lowTargetPrice,
    analystCount,
    investmentOpinion,
    baseDate,
  };
}

function findPriceByLabels(text: string, labels: string[]) {
  const normalized = text.replace(/\s+/g, " ");

  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const regex = new RegExp(`${escaped}[^0-9]{0,20}([0-9][0-9,\\.]{2,})`, "i");
    const match = normalized.match(regex);
    const parsed = parsePrice(match?.[1]);

    if (parsed != null) return parsed;
  }

  return null;
}

function findFirstPrice(text: string) {
  const match = text.match(/([0-9][0-9,]{3,})\s*원?/);
  return parsePrice(match?.[1]);
}

function findAnalystCount(text: string) {
  const patterns = [
    /([0-9]{1,2})\s*개\s*증권사/,
    /([0-9]{1,2})\s*명/,
    /참여[^0-9]{0,10}([0-9]{1,2})/,
    /증권사[^0-9]{0,10}([0-9]{1,2})/,
    /analyst[^0-9]{0,10}([0-9]{1,2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const parsed = Number(match[1]);

      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function findOpinion(text: string) {
  const opinionKeywords = [
    "Strong Buy",
    "BUY",
    "Buy",
    "매수",
    "중립",
    "보유",
    "Hold",
    "Sell",
    "매도",
  ];

  for (const keyword of opinionKeywords) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      return keyword;
    }
  }

  return "";
}

function findDate(text: string) {
  const match =
    text.match(/20[0-9]{2}[-./][0-9]{1,2}[-./][0-9]{1,2}/) ??
    text.match(/20[0-9]{2}년\s*[0-9]{1,2}월\s*[0-9]{1,2}일/);

  return match?.[0] ?? "";
}

function parsePrice(value?: string | null) {
  if (!value) return null;

  const parsed = Number(value.replace(/,/g, ""));

  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed);
}

function calculateSummaryAppTargetPrice({
  currentPrice,
  targetPrice,
  fundamentals,
  consensusAverageTargetPrice,
}: {
  currentPrice?: number | null;
  targetPrice?: any | null;
  fundamentals?: any | null;
  consensusAverageTargetPrice?: number | null;
}) {
  const range = targetPrice?.finalTargetRange ?? targetPrice?.technicalTargetRange ?? null;
  const baseCurrentPrice = getEstimateNumber(currentPrice) ?? getEstimateNumber(range?.currentPrice) ?? null;
  const technicalTarget = getConsensusTechnicalTarget(targetPrice);
  const valuationTarget =
    getEstimateNumber(targetPrice?.valuationTargetRange?.valuationTarget) ??
    calculateConsensusValuationTarget(baseCurrentPrice, fundamentals);
  const consensusTarget =
    getEstimateNumber(targetPrice?.consensusTarget) ?? getEstimateNumber(consensusAverageTargetPrice);

  return calculateConsensusEstimate({
    technicalTarget,
    valuationTarget,
    consensusTarget,
    targetPrice,
  });
}

function calculateConsensusEstimate({
  technicalTarget,
  valuationTarget,
  consensusTarget,
  targetPrice,
}: {
  technicalTarget?: number | null;
  valuationTarget?: number | null;
  consensusTarget?: number | null;
  targetPrice?: any | null;
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

  const weights = {
    technical: totalWeight > 0 ? rawWeights.technical / totalWeight : 0,
    valuation: totalWeight > 0 ? rawWeights.valuation / totalWeight : 0,
    consensus: totalWeight > 0 ? rawWeights.consensus / totalWeight : 0,
  };

  const basisAverage = roundConsensusPrice(
    (technicalTarget ?? 0) * weights.technical +
      (valuationTarget ?? 0) * weights.valuation +
      (consensusTarget ?? 0) * weights.consensus,
  );

  const selectedMode = String(targetPrice?.selectedTargetMode ?? "");
  const targetModes = Array.isArray(targetPrice?.targetModes) ? targetPrice.targetModes : [];
  const modeResult =
    targetModes.find((mode: any) => String(mode?.mode ?? "") === selectedMode) ??
    targetModes[0] ??
    null;
  const quantAdjustment = modeResult?.quantAdjustment ?? {};
  const quantPercent = getEstimateNumber(quantAdjustment.baseAdjustmentPercent) ?? 0;
  const supplyPercent = getEstimateNumber(quantAdjustment.positiveAdjustmentPercent) ?? 0;
  const riskPercent = getEstimateNumber(quantAdjustment.riskAdjustmentPercent) ?? 0;

  const quantAmount = calculateConsensusAdjustmentAmount(basisAverage, quantPercent);
  const supplyAmount = calculateConsensusAdjustmentAmount(basisAverage, supplyPercent);
  const riskAmount = calculateConsensusAdjustmentAmount(basisAverage, riskPercent);
  const totalAmount =
    quantAmount != null && supplyAmount != null && riskAmount != null
      ? roundConsensusPrice(quantAmount + supplyAmount + riskAmount)
      : null;

  return basisAverage != null && totalAmount != null ? roundConsensusPrice(basisAverage + totalAmount) : null;
}

function getConsensusTechnicalTarget(targetPrice?: any | null) {
  const candidates = targetPrice?.targetBasis?.candidates;

  if (Array.isArray(candidates)) {
    const technicalCandidate = candidates.find((candidate: any) =>
      String(candidate?.label ?? "").includes("기술"),
    );

    const value = getEstimateNumber(technicalCandidate?.value);
    if (value != null) return value;
  }

  return getEstimateNumber(targetPrice?.technicalTargetRange?.baseTarget);
}

function calculateConsensusValuationTarget(currentPrice?: number | null, fundamentals?: any | null) {
  if (!currentPrice || !fundamentals) return null;

  const eps = getEstimateNumber(fundamentals.eps);
  const per = getEstimateNumber(fundamentals.per);

  return eps != null && eps > 0 && per != null && per > 0
    ? roundConsensusPrice(eps * per * getConsensusPerAdjustment(per))
    : null;
}

function getConsensusPerAdjustment(per: number) {
  if (per <= 8) return 1.08;
  if (per <= 15) return 1;
  if (per <= 25) return 0.94;
  return 0.88;
}

function calculateConsensusAdjustmentAmount(base?: number | null, percent?: number | null) {
  if (base == null || percent == null || !Number.isFinite(base) || !Number.isFinite(percent)) return null;
  return roundConsensusPrice(base * (percent / 100));
}

function roundConsensusPrice(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value / 10) * 10;
}

function getEstimateNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function makeConsensusComparison(
  appTargetPrice?: number | null,
  averageTargetPrice?: number | null,
  highTargetPrice?: number | null,
  lowTargetPrice?: number | null,
) {
  if (!appTargetPrice || !averageTargetPrice) {
    return {
      title: "컨센서스 대기",
      description:
        "앱 추정가와 컨센서스 평균 목표가가 모두 있어야 비교할 수 있습니다.",
      gapText: "데이터 없음",
    };
  }

  const gapRate = ((averageTargetPrice - appTargetPrice) / appTargetPrice) * 100;
  const rangeRate =
    highTargetPrice && lowTargetPrice && averageTargetPrice > 0
      ? ((highTargetPrice - lowTargetPrice) / averageTargetPrice) * 100
      : null;

  if (gapRate >= 3) {
    return {
      title: "앱 추정가가 보수적",
      description:
        "컨센서스 평균 목표가가 앱 추정가보다 높습니다. 시장 기대치는 앱 추정가보다 우호적으로 볼 수 있습니다.",
      gapText: `+${gapRate.toFixed(2)}%`,
    };
  }

  if (gapRate <= -3) {
    return {
      title: "앱 추정가 과대 여부 확인",
      description:
        "앱 추정가가 컨센서스 평균보다 높습니다. 과대 추정 가능성과 보수 조정 필요성을 확인해야 합니다.",
      gapText: `${gapRate.toFixed(2)}%`,
    };
  }

  return {
    title:
      rangeRate != null && rangeRate >= 25
        ? "평균은 근접 · 의견 차이 큼"
        : "컨센서스와 근접",
    description:
      rangeRate != null && rangeRate >= 25
        ? "앱 추정가와 컨센서스 평균은 비슷하지만 최고·최저 목표가 차이가 커 시장 의견 차이가 있는 편입니다."
        : "앱 추정가와 컨센서스 평균 목표가가 비교적 가까운 편입니다.",
    gapText: `${gapRate >= 0 ? "+" : ""}${gapRate.toFixed(2)}%`,
  };
}

function readConsensus(key: string): ConsensusData | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as ConsensusData;

    if (!parsed || typeof parsed !== "object") return null;

    return {
      ...EMPTY_CONSENSUS,
      ...parsed,
    };
  } catch {
    return null;
  }
}

function makeStorageKey(symbol?: string | null, name?: string | null) {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (normalizedSymbol) {
    return `${CONSENSUS_STORAGE_PREFIX}:${normalizedSymbol}`;
  }

  const normalizedName = (name || "").trim();

  if (normalizedName) {
    return `${CONSENSUS_STORAGE_PREFIX}:NAME:${normalizedName}`;
  }

  return `${CONSENSUS_STORAGE_PREFIX}:CURRENT`;
}

function normalizeSymbol(value?: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeConsensusSource(value?: string | null): ConsensusSource {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized.includes("naver") || normalized.includes("네이버")) return "naver";
  if (normalized.includes("fnguide") || normalized.includes("fn")) return "fnguide";
  if (normalized.includes("report") || normalized.includes("리포트")) return "report";
  if (normalized.includes("excel") || normalized.includes("엑셀")) return "excel";
  if (normalized.includes("manual") || normalized.includes("수동")) return "manual";

  return "excel";
}

function formatSource(value: ConsensusSource) {
  if (value === "naver") return "네이버증권";
  if (value === "fnguide") return "FnGuide";
  if (value === "report") return "리포트";
  if (value === "manual") return "수동";
  if (value === "excel") return "엑셀";
  return value;
}

function formatPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatCount(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  return `${value}개`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "저장 전";

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

function parseNumber(value: unknown) {
  if (value == null || value === "") return null;

  const parsed = Number(String(value).replace(/,/g, "").trim());

  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed);
}

function parseInteger(value: unknown) {
  const parsed = parseNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function parseDateValue(value: unknown) {
  if (value == null || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateInput(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(
        parsed.d,
      ).padStart(2, "0")}`;
    }
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  if (/^\d{4}[./]\d{1,2}[./]\d{1,2}$/.test(text)) {
    const [year, month, day] = text.split(/[./]/);
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return text;
}

function formatDateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(value.getDate()).padStart(2, "0")}`;
}

function toCleanString(value: unknown) {
  if (value == null) return "";

  return String(value).trim();
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  return parseNumber(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

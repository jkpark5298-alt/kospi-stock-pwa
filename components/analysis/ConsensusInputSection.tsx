"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ConsensusTarget = {
  symbol: string;
  name: string | null;
  baseDate: string;
  averageTarget: number | null;
  highTarget: number | null;
  lowTarget: number | null;
  opinion: string | null;
  brokerCount: number | null;
  reportCount: number | null;
  source: string | null;
  memo: string | null;
  uploadedFileName?: string | null;
  updatedAt?: string | null;
};

type ConsensusUploadRow = {
  symbol: string;
  name: string | null;
  baseDate: string;
  averageTarget: number | null;
  highTarget: number | null;
  lowTarget: number | null;
  opinion: string | null;
  brokerCount: number | null;
  reportCount: number | null;
  source: string | null;
  memo: string | null;
};

type ConsensusApiResponse = {
  ok: boolean;
  data?: ConsensusTarget | null;
  rows?: ConsensusTarget[];
  count?: number;
  error?: string;
  message?: string;
};

type Props = {
  symbol?: string | null;
  name?: string | null;
  appTargetPrice?: number | null;
  onConsensusUpdated?: () => void | Promise<void>;
};

const REQUIRED_HEADERS = ["종목코드", "기준일", "평균목표가"];
const EXCEL_HEADERS = [
  "종목코드",
  "종목명",
  "기준일",
  "평균목표가",
  "최고목표가",
  "최저목표가",
  "투자의견",
  "참여증권사수",
  "리포트수",
  "출처",
  "메모",
];

export default function ConsensusInputSection({
  symbol,
  name,
  appTargetPrice,
  onConsensusUpdated,
}: Props) {
  const normalizedSymbol = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [latestConsensus, setLatestConsensus] = useState<ConsensusTarget | null>(null);
  const [uploadPreview, setUploadPreview] = useState<ConsensusUploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestConsensus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSymbol]);

  const comparison = makeConsensusComparison(
    appTargetPrice,
    latestConsensus?.averageTarget,
    latestConsensus?.highTarget,
    latestConsensus?.lowTarget,
  );

  async function fetchLatestConsensus() {
    if (!normalizedSymbol) {
      setLatestConsensus(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/consensus?symbol=${encodeURIComponent(normalizedSymbol)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as ConsensusApiResponse;

      if (payload.ok && payload.data) {
        setLatestConsensus(payload.data);
      } else {
        setLatestConsensus(null);
      }
    } catch {
      setLatestConsensus(null);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setMessage(null);
    setError(null);

    if (!file) {
      setUploadPreview([]);
      return;
    }

    try {
      const rows = await parseConsensusExcel(file);
      setUploadPreview(rows);
      setMessage(`${rows.length.toLocaleString("ko-KR")}개 행을 읽었습니다. 저장 버튼을 누르면 Supabase에 반영됩니다.`);
    } catch (parseError) {
      setUploadPreview([]);
      setError(parseError instanceof Error ? parseError.message : "엑셀 파일을 읽지 못했습니다.");
    }
  }

  async function handleUpload() {
    if (!selectedFile || uploadPreview.length === 0) {
      setError("먼저 컨센서스 엑셀 파일을 선택해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/consensus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          rows: uploadPreview,
        }),
      });
      const payload = (await response.json()) as ConsensusApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || payload.message || "컨센서스 저장에 실패했습니다.");
      }

      setMessage(`Supabase 저장 완료: ${payload.count ?? uploadPreview.length}건`);
      await fetchLatestConsensus();
      await onConsensusUpdated?.();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "컨센서스 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>컨센서스 기준가 입력 방식</span>
          <strong>{latestConsensus?.averageTarget ? "Supabase 반영 중" : "컨센서스 대기"}</strong>
        </div>

        <p className="target-basis-summary">
          컨센서스는 한글 엑셀 양식으로 입력한 뒤 Supabase에 저장합니다. 현재 종목과
          종목코드가 일치하는 최신 기준일의 평균목표가가 C. 컨센서스 기준가로 자동 반영됩니다.
        </p>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <ConsensusMetricCard
            title="평균목표가"
            value={formatPrice(latestConsensus?.averageTarget)}
            subText="C 기준가"
          />
          <ConsensusMetricCard
            title="최고목표가"
            value={formatPrice(latestConsensus?.highTarget)}
            subText="공격 범위 참고"
          />
          <ConsensusMetricCard
            title="최저목표가"
            value={formatPrice(latestConsensus?.lowTarget)}
            subText="보수 범위 참고"
          />
          <ConsensusMetricCard
            title="참여증권사수"
            value={formatCount(latestConsensus?.brokerCount)}
            subText={latestConsensus?.opinion || "투자의견 없음"}
          />
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>앱 추정가 vs 컨센서스</span>
            <strong>{comparison.title}</strong>
          </div>
          <p className="target-basis-summary">{comparison.description}</p>
          <div className="target-basis-adjustments">
            <p>현재 종목: {name || symbol || "데이터 없음"}</p>
            <p>앱 추정가: {formatPrice(appTargetPrice)}</p>
            <p>컨센서스 평균: {formatPrice(latestConsensus?.averageTarget)}</p>
            <p>차이: {comparison.gapText}</p>
            <p>기준일: {latestConsensus?.baseDate || "데이터 없음"}</p>
            <p>출처: {latestConsensus?.source || "데이터 없음"}</p>
          </div>
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>컨센서스 엑셀 업로드</span>
            <strong>{selectedFile?.name || "파일 선택 대기"}</strong>
          </div>

          <p className="target-basis-summary">
            엑셀 시트명은 “컨센서스”를 권장합니다. 컬럼명은 종목코드, 종목명, 기준일,
            평균목표가, 최고목표가, 최저목표가, 투자의견, 참여증권사수, 리포트수, 출처, 메모입니다.
          </p>

          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <input
              className="form-control"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="button primary-button"
                type="button"
                onClick={handleUpload}
                disabled={loading || uploadPreview.length === 0}
              >
                {loading ? "저장 중" : "Supabase에 저장"}
              </button>
              <button
                className="button secondary-button"
                type="button"
                onClick={fetchLatestConsensus}
                disabled={!normalizedSymbol || loading}
              >
                현재 종목 컨센서스 새로고침
              </button>
            </div>
          </div>

          {message ? <p className="status-message info-message" style={{ marginTop: 12 }}>{message}</p> : null}
          {error ? <p className="status-message error-message" style={{ marginTop: 12 }}>{error}</p> : null}
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>엑셀 양식</span>
            <strong>{EXCEL_HEADERS.join(" · ")}</strong>
          </div>
          <p className="target-basis-summary">
            목표가는 296000 또는 296,000처럼 입력할 수 있고, 화면에는 296,000원 형식으로 표시됩니다.
          </p>
        </div>

        {uploadPreview.length > 0 ? (
          <div className="target-basis-box" style={{ marginTop: 16 }}>
            <div className="target-basis-header">
              <span>업로드 미리보기</span>
              <strong>{uploadPreview.length.toLocaleString("ko-KR")}건</strong>
            </div>
            <div className="target-basis-adjustments">
              {uploadPreview.slice(0, 5).map((row) => (
                <p key={`${row.symbol}-${row.baseDate}`}>
                  {row.symbol} · {row.name || "종목명 없음"} · {row.baseDate} · 평균 {formatPrice(row.averageTarget)}
                </p>
              ))}
              {uploadPreview.length > 5 ? <p>외 {uploadPreview.length - 5}건</p> : null}
            </div>
          </div>
        ) : null}

        <p className="notice-text" style={{ marginTop: 14 }}>
          저장 기준은 종목코드 + 기준일입니다. 같은 종목코드와 기준일을 다시 올리면 기존 값이 업데이트됩니다.
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

async function parseConsensusExcel(file: File): Promise<ConsensusUploadRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find((item) => item.trim() === "컨센서스") ?? workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("엑셀 파일에 시트가 없습니다.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  if (rows.length === 0) {
    throw new Error("읽을 데이터가 없습니다.");
  }

  const headers = Object.keys(rows[0] || {}).map((item) => item.trim());
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`필수 컬럼이 없습니다: ${missingHeaders.join(", ")}`);
  }

  const parsedRows = rows
    .map(mapExcelRow)
    .filter((row): row is ConsensusUploadRow => Boolean(row));

  if (parsedRows.length === 0) {
    throw new Error("저장 가능한 컨센서스 행이 없습니다.");
  }

  return parsedRows;
}

function mapExcelRow(row: Record<string, unknown>): ConsensusUploadRow | null {
  const symbol = normalizeSymbol(row["종목코드"]);
  const baseDate = parseDateValue(row["기준일"]);
  const averageTarget = parseNumber(row["평균목표가"]);

  if (!symbol || !baseDate || averageTarget == null) return null;

  return {
    symbol,
    name: parseText(row["종목명"]),
    baseDate,
    averageTarget,
    highTarget: parseNumber(row["최고목표가"]),
    lowTarget: parseNumber(row["최저목표가"]),
    opinion: parseText(row["투자의견"]),
    brokerCount: parseInteger(row["참여증권사수"]),
    reportCount: parseInteger(row["리포트수"]),
    source: parseText(row["출처"]),
    memo: parseText(row["메모"]),
  };
}

function makeConsensusComparison(
  appTargetPrice?: number | null,
  averageTarget?: number | null,
  highTarget?: number | null,
  lowTarget?: number | null,
) {
  if (!appTargetPrice || !averageTarget) {
    return {
      title: "컨센서스 대기",
      description: "앱 추정가와 컨센서스 평균목표가가 모두 있어야 비교할 수 있습니다.",
      gapText: "데이터 없음",
    };
  }

  const gapRate = ((averageTarget - appTargetPrice) / appTargetPrice) * 100;
  const rangeRate =
    highTarget && lowTarget && averageTarget > 0
      ? ((highTarget - lowTarget) / averageTarget) * 100
      : null;

  if (gapRate >= 3) {
    return {
      title: "앱 추정가가 보수적",
      description: "컨센서스 평균목표가가 앱 추정가보다 높습니다. 시장 기대치는 앱 추정가보다 우호적인 편입니다.",
      gapText: `+${gapRate.toFixed(2)}%`,
    };
  }

  if (gapRate <= -3) {
    return {
      title: "앱 추정가 과대 여부 확인",
      description: "앱 추정가가 컨센서스 평균보다 높습니다. 과대 추정 가능성과 보수 조정 필요성을 확인해야 합니다.",
      gapText: `${gapRate.toFixed(2)}%`,
    };
  }

  return {
    title: rangeRate != null && rangeRate >= 25 ? "평균 근접 · 의견 차이 있음" : "컨센서스와 근접",
    description:
      rangeRate != null && rangeRate >= 25
        ? "앱 추정가와 컨센서스 평균은 비슷하지만 최고·최저 목표가 차이가 커 시장 의견 차이가 있는 편입니다."
        : "앱 추정가와 컨센서스 평균목표가가 비교적 가까운 편입니다.",
    gapText: `${gapRate >= 0 ? "+" : ""}${gapRate.toFixed(2)}%`,
  };
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = String(value ?? "").trim();
  const normalized = text.replace(/[./]/g, "-");
  const match = normalized.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);

  if (!match) return "";

  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function parseNumber(value: unknown) {
  if (value == null || value === "") return null;

  const cleaned = String(value).replaceAll(",", "").replace(/[^0-9.-]/g, "").trim();
  const numeric = Number(cleaned);

  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function parseInteger(value: unknown) {
  const numeric = parseNumber(value);
  return numeric == null ? null : Math.trunc(numeric);
}

function parseText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeSymbol(value?: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function formatPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatCount(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${new Intl.NumberFormat("ko-KR").format(value)}개`;
}

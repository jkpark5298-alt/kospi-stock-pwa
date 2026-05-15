"use client";

type SupplySummary = {
  individualNetBuy?: number | null;
  foreignNetBuy?: number | null;
  institutionNetBuy?: number | null;
  smartMoneyNetBuy?: number | null;
};

type SupplyData = {
  available?: boolean;
  warning?: string;
  rowCount?: number;
  recent5?: SupplySummary;
  recent20?: SupplySummary;
  foreignPositiveStreak5?: boolean;
  institutionPositiveStreak5?: boolean;
  smartMoneyPositiveStreak5?: boolean;
  latestRows?: Array<{
    date: string;
    individualNetBuy?: number | null;
    foreignNetBuy?: number | null;
    institutionNetBuy?: number | null;
    programNetBuy?: number | null;
  }>;
};

type Props = {
  data?: {
    supply?: SupplyData | null;
    fundamentals?: {
      foreignOwnershipRate?: number | null;
    } | null;
    score?: {
      supply?: {
        available?: boolean;
        score?: number | null;
        label?: string;
        reasons?: string[];
      };
    };
  } | null;
};

export default function SupplyAnalysisSection({ data }: Props) {
  const supply = data?.supply;
  const supplyScore = data?.score?.supply;
  const recent5 = supply?.recent5;
  const recent20 = supply?.recent20;
  const smart5 = recent5?.smartMoneyNetBuy ?? null;
  const smart20 = recent20?.smartMoneyNetBuy ?? null;
  const interpretation = makeSupplyInterpretation(smart5, smart20, supplyScore?.score);

  return (
    <section className="score-section">
      <div className="card">
        <div className="target-basis-header">
          <span>수급 분석 방식</span>
          <strong>{supplyScore?.label || "수급 데이터 대기"}</strong>
        </div>

        <p className="target-basis-summary">
          수급 분석은 외국인·기관 매매 흐름과 외국인 보유율을 통해 A/B/C
          기준가를 실제 시장 자금 흐름이 뒷받침하는지 확인하는 영역입니다.
          외국인과 기관이 함께 순매수하면 긍정적으로 보고, 동반 순매도면
          보수적으로 해석합니다.
        </p>

        <div className="summary-grid summary-grid-four" style={{ marginTop: 16 }}>
          <SupplyMetricCard
            title="외국인 5일"
            value={formatSignedCompactNumber(recent5?.foreignNetBuy)}
            subText={makeFlowText(recent5?.foreignNetBuy)}
          />
          <SupplyMetricCard
            title="기관 5일"
            value={formatSignedCompactNumber(recent5?.institutionNetBuy)}
            subText={makeFlowText(recent5?.institutionNetBuy)}
          />
          <SupplyMetricCard
            title="외국인+기관 5일"
            value={formatSignedCompactNumber(smart5)}
            subText={makeFlowText(smart5)}
          />
          <SupplyMetricCard
            title="외국인+기관 20일"
            value={formatSignedCompactNumber(smart20)}
            subText={makeFlowText(smart20)}
          />
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>수급 핵심 지표</span>
            <strong>{interpretation.title}</strong>
          </div>

          <div className="target-basis-adjustments">
            <p>수급 점수: {formatScore(supplyScore?.score)}</p>
            <p>외국인 보유율: {formatPercent(data?.fundamentals?.foreignOwnershipRate)}</p>
            <p>외국인 5일 연속 순매수: {formatBooleanSignal(supply?.foreignPositiveStreak5)}</p>
            <p>기관 5일 연속 순매수: {formatBooleanSignal(supply?.institutionPositiveStreak5)}</p>
            <p>외국인+기관 5일 연속 순매수: {formatBooleanSignal(supply?.smartMoneyPositiveStreak5)}</p>
            <p>수급 데이터 행 수: {formatCount(supply?.rowCount)}</p>
          </div>
        </div>

        <div className="target-basis-box" style={{ marginTop: 16 }}>
          <div className="target-basis-header">
            <span>수급 해석</span>
            <strong>{interpretation.shortLabel}</strong>
          </div>

          <p className="target-basis-summary">{interpretation.description}</p>

          {supplyScore?.reasons?.length ? (
            <div className="target-basis-adjustments">
              {supplyScore.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          ) : null}

          {supply?.warning ? (
            <p className="notice-text" style={{ marginTop: 12 }}>
              {supply.warning}
            </p>
          ) : null}
        </div>

        {supply?.latestRows?.length ? (
          <div className="target-basis-box" style={{ marginTop: 16 }}>
            <div className="target-basis-header">
              <span>최근 수급 원자료</span>
              <strong>최근 {Math.min(supply.latestRows.length, 5)}개 거래일</strong>
            </div>

            <div className="target-basis-table-wrap">
              <table className="target-basis-table">
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>개인</th>
                    <th>외국인</th>
                    <th>기관</th>
                    <th>프로그램</th>
                  </tr>
                </thead>
                <tbody>
                  {supply.latestRows.slice(0, 5).map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{formatSignedCompactNumber(row.individualNetBuy)}</td>
                      <td>{formatSignedCompactNumber(row.foreignNetBuy)}</td>
                      <td>{formatSignedCompactNumber(row.institutionNetBuy)}</td>
                      <td>{formatSignedCompactNumber(row.programNetBuy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SupplyMetricCard({
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

function makeSupplyInterpretation(
  smart5?: number | null,
  smart20?: number | null,
  score?: number | null,
) {
  if (score == null && smart5 == null && smart20 == null) {
    return {
      title: "수급 데이터 대기",
      shortLabel: "확인 필요",
      description:
        "외국인·기관 수급 데이터가 확인되면 A/B/C 기준가를 자금 흐름이 뒷받침하는지 분석합니다.",
    };
  }

  if ((smart5 ?? 0) > 0 && (smart20 ?? 0) > 0) {
    return {
      title: "외국인·기관 수급 우호",
      shortLabel: "긍정",
      description:
        "최근 5일과 20일 외국인+기관 합산 수급이 순매수입니다. 기준가 방향을 시장 자금 흐름이 일부 뒷받침하는 구간으로 해석할 수 있습니다.",
    };
  }

  if ((smart5 ?? 0) < 0 && (smart20 ?? 0) < 0) {
    return {
      title: "외국인·기관 수급 약함",
      shortLabel: "보수",
      description:
        "최근 5일과 20일 외국인+기관 합산 수급이 순매도입니다. 기술적·실적 기준가가 있더라도 단기 도달 가능성은 보수적으로 보는 것이 좋습니다.",
    };
  }

  if ((score ?? 0) >= 70) {
    return {
      title: "수급 점수 양호",
      shortLabel: "긍정",
      description:
        "수급 점수가 양호합니다. 다만 5일·20일 흐름이 엇갈리면 단기 방향성은 추가 확인이 필요합니다.",
    };
  }

  return {
    title: "수급 혼조",
    shortLabel: "중립",
    description:
      "외국인·기관 수급 흐름이 한 방향으로 뚜렷하지 않습니다. 기준가 판단에는 중립 또는 보조 자료로 반영하는 것이 적절합니다.",
  };
}

function makeFlowText(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  if (value > 0) return "순매수";
  if (value < 0) return "순매도";
  return "중립";
}

function formatBooleanSignal(value?: boolean | null) {
  if (value == null) return "데이터 없음";
  return value ? "충족" : "미충족";
}

function formatScore(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value} / 100`;
}

function formatCount(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value}건`;
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";
  return `${value.toFixed(2)}%`;
}

function formatSignedCompactNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const formatted = new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return "0";
}

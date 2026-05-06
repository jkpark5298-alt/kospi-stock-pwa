"use client";

import type { ChartRow, StockResponse } from "../../types/stock";

type Props = {
  data: StockResponse | null;
  rows: ChartRow[];
};

export default function SupplySection({ data, rows }: Props) {
  const supplyAnalysis = getSupplyAnalysis(data, rows);

  return (
    <section className="supply-section">
      <div className="card">
        <div className="supply-header">
          <div>
            <h3 className="section-title small">수급·거래량 신뢰도 분석</h3>
            <p className="supply-subtitle">
              한투 API의 외국인·기관 순매수와 기존 기술지표를 함께 참고합니다.
            </p>
          </div>
          <div
            className={`supply-badge ${data?.supply?.available ? "available" : "unavailable"}`}
          >
            {data?.supply?.available ? "수급 데이터 연결" : "수급 데이터 대기"}
          </div>
        </div>

        <div className="supply-metric-grid">
          <SupplyMetricCard
            title="외국인 5일"
            value={formatSignedCompactNumber(
              data?.supply?.recent5?.foreignNetBuy,
            )}
            tone={getChangeTone(data?.supply?.recent5?.foreignNetBuy)}
          />
          <SupplyMetricCard
            title="기관 5일"
            value={formatSignedCompactNumber(
              data?.supply?.recent5?.institutionNetBuy,
            )}
            tone={getChangeTone(data?.supply?.recent5?.institutionNetBuy)}
          />
          <SupplyMetricCard
            title="외인+기관 5일"
            value={formatSignedCompactNumber(
              data?.supply?.recent5?.smartMoneyNetBuy,
            )}
            tone={getChangeTone(data?.supply?.recent5?.smartMoneyNetBuy)}
          />
          <SupplyMetricCard
            title="외인+기관 20일"
            value={formatSignedCompactNumber(
              data?.supply?.recent20?.smartMoneyNetBuy,
            )}
            tone={getChangeTone(data?.supply?.recent20?.smartMoneyNetBuy)}
          />
        </div>

        {data?.supply?.warning ? (
          <p className="status-message warning-message">{data.supply.warning}</p>
        ) : null}

        <div className="supply-judgement-grid">
          <SupplyJudgement title="수급 판정" value={supplyAnalysis.supplyView} />
          <SupplyJudgement
            title="기술+수급"
            value={supplyAnalysis.technicalSupplyView}
          />
          <SupplyJudgement
            title="다이버전스"
            value={supplyAnalysis.divergenceView}
          />
        </div>

        <div className="supply-mini-table-wrap">
          <table className="supply-mini-table">
            <thead>
              <tr>
                <th>일자</th>
                <th>외국인</th>
                <th>기관</th>
                <th>합산</th>
              </tr>
            </thead>
            <tbody>
              {(data?.supply?.latestRows ?? []).slice(0, 5).map((row) => {
                const hasForeign = row.foreignNetBuy != null;
                const hasInstitution = row.institutionNetBuy != null;
                const smartMoney =
                  hasForeign || hasInstitution
                    ? (row.foreignNetBuy ?? 0) + (row.institutionNetBuy ?? 0)
                    : null;

                return (
                  <tr key={row.date}>
                    <td>{row.date || "-"}</td>
                    <td className={getChangeTone(row.foreignNetBuy)}>
                      {formatSignedCompactNumber(row.foreignNetBuy)}
                    </td>
                    <td className={getChangeTone(row.institutionNetBuy)}>
                      {formatSignedCompactNumber(row.institutionNetBuy)}
                    </td>
                    <td className={getChangeTone(smartMoney)}>
                      {formatSignedCompactNumber(smartMoney)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data?.supply?.available &&
          (data.supply.latestRows?.length ?? 0) === 0 ? (
            <p className="muted-text">표시할 수급 상세 데이터가 없습니다.</p>
          ) : null}
        </div>

        <p className="notice-text">
          수급 데이터는 투자 판단을 보조하는 참고 지표입니다. 매수·매도 단정
          신호가 아니라 가격 지표와 함께 확인해야 합니다.
        </p>
      </div>
    </section>
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

function getSupplyAnalysis(data: StockResponse | null, rows: ChartRow[]) {
  const supply = data?.supply;

  if (!supply?.available) {
    return {
      supplyView: "수급 데이터 대기",
      technicalSupplyView: "수급 확인 후 판단",
      divergenceView: "수급 확인 후 판단",
    };
  }

  const recent5Smart = supply.recent5?.smartMoneyNetBuy ?? 0;
  const recent20Smart = supply.recent20?.smartMoneyNetBuy ?? 0;
  const foreign5 = supply.recent5?.foreignNetBuy ?? 0;
  const institution5 = supply.recent5?.institutionNetBuy ?? 0;

  let supplyView = "중립";

  if (recent5Smart > 0 && recent20Smart > 0) {
    if (foreign5 > 0 && institution5 > 0) {
      supplyView = "단기·중기 동반 긍정";
    } else {
      supplyView = "중기 긍정 / 단기 혼조";
    }
  } else if (recent5Smart > 0 && recent20Smart <= 0) {
    supplyView = "단기 수급 유입";
  } else if (recent5Smart <= 0 && recent20Smart > 0) {
    supplyView = "중기 긍정 / 단기 약화";
  } else if (recent5Smart < 0 && recent20Smart < 0) {
    supplyView = "수급 이탈 주의";
  }

  const latest = rows.length ? rows[rows.length - 1] : null;
  const before5 = rows.length >= 6 ? rows[rows.length - 6] : null;
  const fiveDayReturn =
    latest?.close != null && before5?.close != null && before5.close !== 0
      ? ((latest.close - before5.close) / before5.close) * 100
      : null;

  const macdPositive =
    latest?.macd != null &&
    latest?.signal != null &&
    latest.macd > latest.signal;
  const macdNearCross =
    latest?.macd != null &&
    latest?.signal != null &&
    latest?.histogram != null &&
    latest.macd <= latest.signal &&
    latest.histogram > -Math.abs(latest.macd) * 0.05;

  let technicalSupplyView = "기술·수급 판단 대기";

  if (macdPositive && recent5Smart > 0) {
    technicalSupplyView = "기술 반등 + 수급 동반";
  } else if (macdPositive && recent5Smart <= 0) {
    technicalSupplyView = "기술 반등이나 수급 약함";
  } else if (!macdPositive && recent5Smart > 0) {
    technicalSupplyView = "수급 유입 / 기술 확인 필요";
  } else if (!macdPositive && recent5Smart <= 0) {
    technicalSupplyView = "기술·수급 모두 확인 필요";
  }

  let divergenceView = "조건 미충족";

  if (
    fiveDayReturn != null &&
    fiveDayReturn < 0 &&
    (latest?.rsi14 ?? 100) <= 35 &&
    recent5Smart > 0
  ) {
    divergenceView = "수급 다이버전스 후보";
  } else if (
    fiveDayReturn != null &&
    fiveDayReturn < 0 &&
    recent5Smart > 0 &&
    macdNearCross
  ) {
    divergenceView = "MACD 전환 전 수급 유입";
  }

  if (supply.smartMoneyPositiveStreak5) {
    divergenceView =
      divergenceView === "조건 미충족" ? "5일 연속 수급 유입" : divergenceView;
  }

  return {
    supplyView,
    technicalSupplyView,
    divergenceView,
  };
}

function getChangeTone(value?: number | null) {
  if (value == null || Number.isNaN(value) || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function formatSignedCompactNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "데이터 없음";

  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";

  if (abs >= 1_0000_0000) {
    return `${sign}${(abs / 1_0000_0000).toFixed(1)}억`;
  }

  if (abs >= 1_0000) {
    return `${sign}${(abs / 1_0000).toFixed(1)}만`;
  }

  return `${sign}${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(abs)}`;
}

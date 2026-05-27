"use client";

import { KIS_DAILY_LIMIT } from "../../hooks/useKisUsage";

type Props = {
  remainingCalls: number;
  syncCode: string;
  syncInput: string;
  loading: boolean;
  error: string;
  onSyncInputChange: (value: string) => void;
  onSaveSyncCode: () => void;
};

function getUsageTone(remainingCalls: number) {
  if (remainingCalls <= 0) return "danger";
  if (remainingCalls <= 30) return "warning";
  return "normal";
}

export default function KisRemainingCard({
  remainingCalls,
  syncCode,
  syncInput,
  loading,
  error,
  onSyncInputChange,
  onSaveSyncCode,
}: Props) {
  const tone = getUsageTone(remainingCalls);
  const usedCalls = Math.max(0, KIS_DAILY_LIMIT - remainingCalls);

  return (
    <div className={`prediction-status-card kis-remaining-card kis-usage-${tone}`}>
      <span>KIS API 잔여 호출</span>

      {syncCode ? (
        <>
          <strong>
            {remainingCalls} / {KIS_DAILY_LIMIT}회 남음
          </strong>
          <em>
            오늘 사용 {usedCalls}회 · 동기화 코드: {syncCode}
          </em>
        </>
      ) : (
        <>
          <strong>동기화 코드 필요</strong>
          <em>PC와 아이폰에 같은 코드를 입력하면 호출 수를 함께 관리합니다.</em>
          <div className="prediction-management-actions">
            <input
              className="form-control stock-input"
              value={syncInput}
              onChange={(event) => onSyncInputChange(event.target.value)}
              placeholder="예: My-kospi-2026"
              aria-label="KIS 호출 동기화 코드"
            />
            <button
              type="button"
              className="button secondary-button prediction-manage-button"
              onClick={onSaveSyncCode}
              disabled={loading}
            >
              {loading ? "확인 중..." : "저장"}
            </button>
          </div>
        </>
      )}

      {error ? <small>{error}</small> : null}
    </div>
  );
}

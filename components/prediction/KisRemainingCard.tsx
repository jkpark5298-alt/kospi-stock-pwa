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

export default function KisRemainingCard({
  remainingCalls,
  syncCode,
  syncInput,
  loading,
  error,
  onSyncInputChange,
  onSaveSyncCode,
}: Props) {
  return (
    <div className="prediction-status-card kis-remaining-card">
      <span>KIS API 잔여 호출</span>

      {syncCode ? (
        <strong>
          {remainingCalls} / {KIS_DAILY_LIMIT}회 남음
        </strong>
      ) : (
        <>
          <strong>동기화 코드 필요</strong>
          <em>PC와 아이폰에 같은 코드를 입력하세요.</em>
          <div className="prediction-management-actions">
            <input
              className="form-control stock-input"
              value={syncInput}
              onChange={(event) => onSyncInputChange(event.target.value)}
              placeholder="예: my-kospi-2026"
              aria-label="KIS 호출 동기화 코드"
            />
            <button
              type="button"
              className="button secondary-button prediction-manage-button"
              onClick={onSaveSyncCode}
              disabled={loading}
            >
              {loading ? "확인 중" : "저장"}
            </button>
          </div>
        </>
      )}

      {syncCode ? <em>PC·아이폰 연동 중</em> : null}
      {error ? <small>{error}</small> : null}
    </div>
  );
}

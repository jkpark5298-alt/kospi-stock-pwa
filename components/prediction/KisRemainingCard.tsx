"use client";

import { KIS_DAILY_LIMIT } from "../../hooks/useKisUsage";

type Props = {
  remainingCalls: number;
};

export default function KisRemainingCard({ remainingCalls }: Props) {
  return (
    <div className="prediction-status-card kis-remaining-card">
      <span>KIS API 잔여 호출</span>
      <strong>
        {remainingCalls} / {KIS_DAILY_LIMIT}회 남음
      </strong>
    </div>
  );
}

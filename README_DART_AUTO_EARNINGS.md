# DART 자동 실적 데이터 연결 준비

생성 시각: 2026-05-10 10:17:50

## 이번 단계 목표

DART 확정 실적 데이터를 앱에 연결하기 위한 사전 준비 파일입니다.

이번 ZIP은 아직 화면/API에 직접 연결하지 않고, DART 조회 helper 파일을 먼저 추가합니다.
이렇게 하는 이유는 기존 기능을 깨지 않고 다음 단계에서 안전하게 `app/api/stock/route.ts`에 연결하기 위해서입니다.

## 포함 파일

```txt
lib/dartEarnings.ts
README_DART_AUTO_EARNINGS.md
```

## 새 파일

```txt
lib/dartEarnings.ts
```

역할:

```txt
1. DART API 키 확인
2. DART corp_code가 있을 때 확정 실적 조회
3. 순이익, 영업이익, EPS 항목 추출
4. 전기 실적과 당기 실적을 성장률 계산용 데이터로 변환
5. 오류/데이터 없음/키 없음 상태를 안전하게 반환
```

## 환경변수

Vercel과 로컬 `.env.local`에 아래 중 하나가 필요합니다.

```txt
DART_API_KEY=발급받은_오픈다트_API_KEY
```

또는

```txt
OPENDART_API_KEY=발급받은_오픈다트_API_KEY
```

## 중요한 점

DART는 예상 실적이 아니라 확정 실적 중심입니다.

따라서 다음 단계에서 화면 문구를 아래처럼 정리하는 것이 좋습니다.

```txt
예상 순이익 증가율 → 순이익 성장률
예상 영업이익 증가율 → 영업이익 성장률
예상 EPS 증가율 → EPS 성장률
```

## 다음 단계

다음 단계에서 추가할 기능:

```txt
1. KRX 종목코드 → DART corp_code 매핑
2. app/api/stock/route.ts에서 fetchDartEarningsGrowth 호출
3. 자동 데이터가 있으면 DART 확정 실적 자동 적용
4. 자동 데이터 없으면 기존 수동 입력값 사용
5. 화면에 데이터 출처: DART 표시
```

## 적용 후 확인

이번 단계는 새 파일 추가만 하므로 빌드 확인만 하면 됩니다.

```powershell
npm run build
```

통과하면:

```powershell
git status
git add lib/dartEarnings.ts README_DART_AUTO_EARNINGS.md
git commit -m "Add DART earnings helper"
git push
```

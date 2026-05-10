# DART 자동 실적 데이터 route 연결

생성 시각: 2026-05-10 10:28:39

## 이번 단계 목표

기존에 추가한 DART helper 파일을 `app/api/stock/route.ts`에 연결합니다.

## 포함 파일

```txt
app/api/stock/route.ts
lib/dartEarnings.ts
lib/dartCorpCode.ts
README_DART_ROUTE_CONNECT.md
```

## 반영 내용

```txt
1. app/api/stock/route.ts에서 resolveDartCorpCode 호출
2. corp_code가 있는 종목은 fetchDartEarningsGrowth 호출
3. DART 데이터가 있으면 자동 실적 데이터로 적용
4. DART 데이터가 없거나 API 키가 없으면 기존 수동 입력 구조 유지
5. ETF/ETN/지수형 상품은 실적 성장 분석 제외 유지
```

## 현재 지원되는 DART 자동 실적 1차 종목

```txt
005930 삼성전자
000660 SK하이닉스
005380 현대차
035420 NAVER
051910 LG화학
006400 삼성SDI
005490 POSCO홀딩스
000270 기아
068270 셀트리온
373220 LG에너지솔루션
```

## 환경변수

DART 자동 실적 조회를 실제로 사용하려면 로컬 `.env.local`과 Vercel 환경변수에 아래 중 하나가 필요합니다.

```txt
DART_API_KEY=오픈다트_API_KEY
```

또는

```txt
OPENDART_API_KEY=오픈다트_API_KEY
```

환경변수가 없으면 빌드는 정상 통과하고, 앱은 기존처럼 수동 입력값을 사용합니다.

## 적용 방법

ZIP을 프로젝트 루트에 풀어주세요.

```txt
C:\DATA\My DATA\에어제타\주가분석\kospi-stock-pwa
```

## 적용 후 확인

```powershell
npm run build
```

통과하면:

```powershell
git status
git add app/api/stock/route.ts lib/dartEarnings.ts lib/dartCorpCode.ts README_DART_ROUTE_CONNECT.md
git commit -m "Connect DART earnings to stock API"
git push
```

## 테스트 기준

### DART API 키가 없는 경우

```txt
기존 수동 입력 방식 그대로 유지
빌드 및 화면 정상
```

### DART API 키가 있고 지원 종목인 경우

```txt
데이터 출처: DART
자동 적용 중
실적 성장 점수 자동 계산
```

## 다음 단계

```txt
1. 화면 문구를 예상 성장률 → 실적 성장률로 정리
2. DART corpCode.xml 전체 매핑 자동화
3. DART API 상태를 화면에 보조 문구로 표시
```

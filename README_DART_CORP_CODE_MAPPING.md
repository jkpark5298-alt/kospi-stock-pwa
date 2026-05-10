# DART corp_code 매핑 1차 준비

생성 시각: 2026-05-10 10:24:28

## 이번 단계 목표

DART 자동 실적 조회에 필요한 `corp_code` 매핑 helper를 추가합니다.

DART API는 일반 주식 종목코드만으로 조회하지 않고, DART 고유 `corp_code`가 필요합니다.

예:

```txt
삼성전자 종목코드: 005930
삼성전자 DART corp_code: 00126380
```

## 포함 파일

```txt
lib/dartCorpCode.ts
README_DART_CORP_CODE_MAPPING.md
```

## 이번 단계에서 하는 일

```txt
1. KRX 종목코드 → DART corp_code 변환 helper 추가
2. 대표 대형주 10개 내장 매핑 추가
3. 다음 단계에서 app/api/stock/route.ts에 연결할 준비
```

## 1차 내장 매핑 종목

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

## 적용 방법

ZIP 파일을 프로젝트 루트에 풀어주세요.

프로젝트 루트:

```txt
C:\DATA\My DATA\에어제타\주가분석\kospi-stock-pwa
```

## 적용 후 확인

이번 단계는 새 파일 추가만 하므로 빌드 확인만 하면 됩니다.

```powershell
npm run build
```

통과하면:

```powershell
git status
git add lib/dartCorpCode.ts README_DART_CORP_CODE_MAPPING.md
git commit -m "Add DART corp code mapping helper"
git push
```

## 다음 단계

다음 단계에서 할 작업:

```txt
1. app/api/stock/route.ts에서 resolveDartCorpCode 호출
2. fetchDartEarningsGrowth에 corpCode 전달
3. DART 데이터가 있으면 자동 실적 데이터로 적용
4. 데이터 출처에 DART 표시
```

## 주의

이번 파일은 helper 추가 단계입니다.
아직 화면에 DART 데이터가 바로 표시되지는 않습니다.
다음 단계에서 API 연결을 진행합니다.

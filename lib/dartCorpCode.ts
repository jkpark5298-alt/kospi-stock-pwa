export type DartCorpCodeMap = Record<string, string>;

export type DartCorpCodeResolveResult = {
  stockCode: string;
  corpCode: string | null;
  source: "built-in" | "none";
  message: string;
};

/**
 * DART corp_code 매핑 1차 준비 파일입니다.
 *
 * DART API는 일반 주식 종목코드(예: 005930)만으로 재무제표를 조회할 수 없고,
 * DART 고유 corp_code(예: 삼성전자 00126380)가 필요합니다.
 *
 * 이번 단계에서는 대표 종목 몇 개를 안전하게 하드코딩으로 시작합니다.
 * 다음 단계에서 DART corpCode.xml 다운로드/파싱 구조로 확장합니다.
 */
export const BUILT_IN_DART_CORP_CODE_MAP: DartCorpCodeMap = {
  /**
   * 주요 대형주 1차 매핑
   * 주의: corp_code는 DART 고유 코드입니다.
   */
  "005930": "00126380", // 삼성전자
  "000660": "00164779", // SK하이닉스
  "005380": "00164742", // 현대차
  "035420": "00266961", // NAVER
  "051910": "00356370", // LG화학
  "006400": "00126362", // 삼성SDI
  "005490": "00155319", // POSCO홀딩스
  "000270": "00106641", // 기아
  "068270": "00413046", // 셀트리온
  "373220": "01515323", // LG에너지솔루션
};

export function resolveDartCorpCode(
  symbolOrCode: string,
): DartCorpCodeResolveResult {
  const stockCode = normalizeStockCode(symbolOrCode);
  const corpCode = BUILT_IN_DART_CORP_CODE_MAP[stockCode] || null;

  if (corpCode) {
    return {
      stockCode,
      corpCode,
      source: "built-in",
      message: "내장 DART corp_code 매핑으로 조회했습니다.",
    };
  }

  return {
    stockCode,
    corpCode: null,
    source: "none",
    message:
      "내장 DART corp_code 매핑에 없는 종목입니다. 다음 단계에서 전체 corp_code 매핑을 연결합니다.",
  };
}

export function normalizeStockCode(value: string) {
  return value
    .replace(/\.(KS|KQ)$/i, "")
    .replace(/[^0-9]/g, "")
    .trim()
    .padStart(6, "0");
}

export function isBuiltInDartCorpCodeSupported(symbolOrCode: string) {
  const stockCode = normalizeStockCode(symbolOrCode);

  return Boolean(BUILT_IN_DART_CORP_CODE_MAP[stockCode]);
}

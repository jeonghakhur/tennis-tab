import {
  formatPhoneNumber,
  unformatPhoneNumber,
  validatePhoneNumber,
  maskPhoneNumber,
} from "../phone";

describe("formatPhoneNumber", () => {
  it("빈 문자열은 빈 문자열을 반환한다", () => {
    expect(formatPhoneNumber("")).toBe("");
  });

  it("3자리 이하는 숫자만 반환한다", () => {
    expect(formatPhoneNumber("0")).toBe("0");
    expect(formatPhoneNumber("01")).toBe("01");
    expect(formatPhoneNumber("010")).toBe("010");
  });

  it("4~7자리는 앞 3자리-나머지 형식으로 반환한다", () => {
    expect(formatPhoneNumber("0101")).toBe("010-1");
    expect(formatPhoneNumber("01012")).toBe("010-12");
    expect(formatPhoneNumber("010123")).toBe("010-123");
    expect(formatPhoneNumber("0101234")).toBe("010-1234");
  });

  it("8자리 이상은 3-4-4 형식으로 반환한다", () => {
    expect(formatPhoneNumber("01012345")).toBe("010-1234-5");
    expect(formatPhoneNumber("0101234567")).toBe("010-1234-567");
    expect(formatPhoneNumber("01012345678")).toBe("010-1234-5678");
  });

  it("11자리 초과 입력은 11자리까지만 포맷한다", () => {
    expect(formatPhoneNumber("010123456789")).toBe("010-1234-5678");
    expect(formatPhoneNumber("01012345678999")).toBe("010-1234-5678");
  });

  it("하이픈이 포함된 입력도 숫자만 추출하여 포맷한다", () => {
    expect(formatPhoneNumber("010-1234-5678")).toBe("010-1234-5678");
    expect(formatPhoneNumber("010-12")).toBe("010-12");
  });

  it("비숫자 문자가 포함되어도 숫자만 추출한다", () => {
    expect(formatPhoneNumber("(010) 1234 5678")).toBe("010-1234-5678");
  });

  // 다양한 구분자 — 하이픈/공백/점/언더스코어 전부 정규화되어야 함
  it("점(.) 구분자를 처리한다", () => {
    expect(formatPhoneNumber("010.1234.5678")).toBe("010-1234-5678");
  });

  it("언더스코어(_) 구분자를 처리한다", () => {
    expect(formatPhoneNumber("010_1234_5678")).toBe("010-1234-5678");
  });

  it("공백만 구분자로 사용된 경우를 처리한다", () => {
    expect(formatPhoneNumber("010 1234 5678")).toBe("010-1234-5678");
  });

  it("혼합 구분자도 처리한다", () => {
    expect(formatPhoneNumber("010-1234 5678")).toBe("010-1234-5678");
    expect(formatPhoneNumber("010.1234-5678")).toBe("010-1234-5678");
  });

  // idempotent 검증 — 이미 포맷된 값을 다시 포맷해도 결과가 같아야 함
  it("idempotent: 이미 포맷된 값을 재포맷해도 동일해야 한다", () => {
    const once = formatPhoneNumber("01012345678");
    const twice = formatPhoneNumber(once);
    expect(twice).toBe(once);
    expect(twice).toBe("010-1234-5678");
  });

  // 숫자 없는 입력 → 빈 문자열
  it("숫자가 전혀 없는 입력은 빈 문자열을 반환한다", () => {
    expect(formatPhoneNumber("abc-def-ghij")).toBe("");
    expect(formatPhoneNumber("---")).toBe("");
  });
});

describe("unformatPhoneNumber", () => {
  it("포맷된 전화번호에서 숫자만 추출한다", () => {
    expect(unformatPhoneNumber("010-1234-5678")).toBe("01012345678");
  });

  it("숫자만 있는 입력은 그대로 반환한다", () => {
    expect(unformatPhoneNumber("01012345678")).toBe("01012345678");
  });

  it("빈 문자열은 빈 문자열을 반환한다", () => {
    expect(unformatPhoneNumber("")).toBe("");
  });

  it("특수문자가 포함된 입력에서 숫자만 추출한다", () => {
    expect(unformatPhoneNumber("+82-10-1234-5678")).toBe("821012345678");
    expect(unformatPhoneNumber("(010) 1234.5678")).toBe("01012345678");
  });

  // 다양한 구분자 검증
  it("다양한 구분자를 모두 제거한다", () => {
    expect(unformatPhoneNumber("010_1234_5678")).toBe("01012345678");
    expect(unformatPhoneNumber("010 1234 5678")).toBe("01012345678");
    expect(unformatPhoneNumber("010.1234.5678")).toBe("01012345678");
  });

  // idempotent — 이미 숫자만 있는 값을 다시 unformat해도 동일
  it("idempotent: 숫자만 있는 값을 재처리해도 동일하다", () => {
    const result = unformatPhoneNumber("01012345678");
    expect(unformatPhoneNumber(result)).toBe(result);
  });

  it("숫자가 전혀 없는 입력은 빈 문자열을 반환한다", () => {
    expect(unformatPhoneNumber("abc-def")).toBe("");
    expect(unformatPhoneNumber("---")).toBe("");
  });
});

describe("validatePhoneNumber", () => {
  it("빈 값은 유효하다 (optional field)", () => {
    expect(validatePhoneNumber("")).toBe(true);
  });

  it("유효한 10자리 번호는 true를 반환한다", () => {
    expect(validatePhoneNumber("0101234567")).toBe(true);
    expect(validatePhoneNumber("010-123-4567")).toBe(true);
  });

  it("유효한 11자리 번호는 true를 반환한다", () => {
    expect(validatePhoneNumber("01012345678")).toBe(true);
    expect(validatePhoneNumber("010-1234-5678")).toBe(true);
  });

  it("10자리 미만이면 에러 메시지를 반환한다", () => {
    expect(validatePhoneNumber("010123456")).toBe(
      "전화번호는 10-11자리여야 합니다."
    );
    expect(validatePhoneNumber("01012")).toBe(
      "전화번호는 10-11자리여야 합니다."
    );
  });

  it("11자리 초과이면 에러 메시지를 반환한다", () => {
    expect(validatePhoneNumber("010123456789")).toBe(
      "전화번호는 10-11자리여야 합니다."
    );
  });

  it("01로 시작하지 않으면 에러 메시지를 반환한다", () => {
    expect(validatePhoneNumber("0201234567")).toBe(
      "올바른 휴대폰 번호 형식이 아닙니다."
    );
    expect(validatePhoneNumber("0312345678")).toBe(
      "올바른 휴대폰 번호 형식이 아닙니다."
    );
  });

  it("포맷된 번호도 정상 검증한다", () => {
    expect(validatePhoneNumber("010-1234-5678")).toBe(true);
    expect(validatePhoneNumber("02-1234-5678")).toBe(
      "올바른 휴대폰 번호 형식이 아닙니다."
    );
  });
});

describe("maskPhoneNumber", () => {
  it("11자리 번호의 가운데 4자리를 마스킹한다", () => {
    expect(maskPhoneNumber("01012345678")).toBe("010-****-5678");
  });

  it("포맷된 번호도 마스킹한다", () => {
    expect(maskPhoneNumber("010-1234-5678")).toBe("010-****-5678");
  });

  it("10자리 번호도 마스킹한다", () => {
    expect(maskPhoneNumber("0101234567")).toBe("010-****-567");
  });

  it("3파트로 분리되지 않는 짧은 번호는 포맷된 그대로 반환한다", () => {
    expect(maskPhoneNumber("010")).toBe("010");
    expect(maskPhoneNumber("0101")).toBe("010-1");
    expect(maskPhoneNumber("")).toBe("");
  });
});

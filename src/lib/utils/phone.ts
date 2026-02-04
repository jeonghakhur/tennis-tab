/**
 * 전화번호 유틸리티 함수
 */

/**
 * 전화번호 포맷팅 (010-1234-5678)
 */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  } else {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
}

/**
 * 전화번호에서 숫자만 추출 (저장용)
 */
export function unformatPhoneNumber(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * 전화번호 유효성 검사
 * @returns true if valid, error message if invalid
 */
export function validatePhoneNumber(value: string): true | string {
  const digits = unformatPhoneNumber(value);

  if (!digits) {
    return true; // 빈 값은 허용 (optional field)
  }

  if (digits.length < 10 || digits.length > 11) {
    return "전화번호는 10-11자리여야 합니다.";
  }

  if (!digits.startsWith("01")) {
    return "올바른 휴대폰 번호 형식이 아닙니다.";
  }

  return true;
}

/**
 * 전화번호 마스킹 (010-****-5678)
 */
export function maskPhoneNumber(value: string): string {
  const formatted = formatPhoneNumber(value);
  const parts = formatted.split("-");

  if (parts.length === 3) {
    return `${parts[0]}-****-${parts[2]}`;
  }

  return formatted;
}

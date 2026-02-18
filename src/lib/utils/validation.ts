/**
 * 공용 입력 검증/살균 유틸리티
 * 서버(Server Action)와 클라이언트(Form) 양쪽에서 사용
 */

// ============================================================================
// XSS 방지 — HTML 태그, 스크립트 패턴 제거
// ============================================================================

/** HTML 태그 및 스크립트 패턴 제거 */
export function sanitizeInput(value: string): string {
  const withoutTags = value.replace(/<[^>]*>/g, '')
  return withoutTags
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

/** 객체의 모든 string 필드에 sanitize 적용 */
export function sanitizeObject<T extends object>(obj: T): T {
  const result = { ...obj } as Record<string, unknown>
  for (const key of Object.keys(result)) {
    const val = result[key]
    if (typeof val === 'string') {
      result[key] = sanitizeInput(val)
    }
  }
  return result as T
}

// ============================================================================
// 필드별 검증 함수 — 입력값이 비어있으면 통과 (optional 필드 허용)
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_DIGITS_REGEX = /^01[0-9]{8,9}$/

/** 이메일 형식 검증 (빈 값은 통과) */
export function validateEmail(value: string | undefined | null, fieldName: string): string | null {
  if (!value || value.trim().length === 0) return null
  if (!EMAIL_REGEX.test(value.trim())) {
    return `${fieldName}이(가) 올바른 이메일 형식이 아닙니다.`
  }
  return null
}

/** 전화번호 형식 검증 — 숫자만 추출 후 01X로 시작하는 10~11자리 (빈 값은 통과) */
export function validatePhone(value: string | undefined | null, fieldName: string): string | null {
  if (!value || value.trim().length === 0) return null
  // 숫자와 허용 구분자(-, 공백)만 허용
  if (/[^0-9\-\s]/.test(value.trim())) {
    return `${fieldName}은(는) 숫자만 입력해주세요.`
  }
  const digits = value.replace(/\D/g, '')
  if (!PHONE_DIGITS_REGEX.test(digits)) {
    return `${fieldName}이(가) 올바른 전화번호 형식이 아닙니다. (예: 01012345678)`
  }
  return null
}

/** 최소 길이 검증 (빈 값은 minLength=0일 때만 통과) */
export function validateMinLength(
  value: string | undefined | null,
  minLength: number,
  fieldName: string,
): string | null {
  const trimmed = value?.trim() || ''
  if (trimmed.length === 0 && minLength > 0) {
    return `${fieldName}을(를) 입력해주세요.`
  }
  if (trimmed.length > 0 && trimmed.length < minLength) {
    return `${fieldName}은(는) 최소 ${minLength}자 이상이어야 합니다.`
  }
  return null
}

/** 최대 길이 검증 */
export function validateMaxLength(
  value: string | undefined | null,
  maxLength: number,
  fieldName: string,
): string | null {
  const trimmed = value?.trim() || ''
  if (trimmed.length > maxLength) {
    return `${fieldName}은(는) 최대 ${maxLength}자까지 입력 가능합니다.`
  }
  return null
}

// ============================================================================
// 협회 입력 전용 검증
// ============================================================================

export interface AssociationValidationErrors {
  name?: string
  region?: string
  district?: string
  description?: string
  president_name?: string
  president_phone?: string
  president_email?: string
  secretary_name?: string
  secretary_phone?: string
  secretary_email?: string
}

const ASSOCIATION_NAME_MIN = 2
const ASSOCIATION_NAME_MAX = 50
const FIELD_MAX_LENGTH = 100
const DESCRIPTION_MAX_LENGTH = 500

/** 협회 입력 전체 검증 — 에러가 있으면 필드별 메시지 반환 */
export function validateAssociationInput(data: {
  name?: string
  region?: string
  district?: string
  description?: string
  president_name?: string
  president_phone?: string
  president_email?: string
  secretary_name?: string
  secretary_phone?: string
  secretary_email?: string
}): AssociationValidationErrors {
  const errors: AssociationValidationErrors = {}
  const name = data.name
  const description = data.description

  // 필수: 이름
  const nameMinErr = validateMinLength(name, ASSOCIATION_NAME_MIN, '협회 이름')
  if (nameMinErr) errors.name = nameMinErr
  const nameMaxErr = validateMaxLength(name, ASSOCIATION_NAME_MAX, '협회 이름')
  if (nameMaxErr) errors.name = nameMaxErr

  // 선택: 지역
  const regionMax = validateMaxLength(data.region, FIELD_MAX_LENGTH, '시/도')
  if (regionMax) errors.region = regionMax
  const districtMax = validateMaxLength(data.district, FIELD_MAX_LENGTH, '구/군')
  if (districtMax) errors.district = districtMax

  // 선택: 설명
  const descMax = validateMaxLength(description, DESCRIPTION_MAX_LENGTH, '협회 소개')
  if (descMax) errors.description = descMax

  // 선택: 협회장
  const pNameMax = validateMaxLength(data.president_name, FIELD_MAX_LENGTH, '협회장 이름')
  if (pNameMax) errors.president_name = pNameMax
  const pPhone = validatePhone(data.president_phone, '협회장 연락처')
  if (pPhone) errors.president_phone = pPhone
  const pEmail = validateEmail(data.president_email, '협회장 이메일')
  if (pEmail) errors.president_email = pEmail

  // 선택: 사무장
  const sNameMax = validateMaxLength(data.secretary_name, FIELD_MAX_LENGTH, '사무장 이름')
  if (sNameMax) errors.secretary_name = sNameMax
  const sPhone = validatePhone(data.secretary_phone, '사무장 연락처')
  if (sPhone) errors.secretary_phone = sPhone
  const sEmail = validateEmail(data.secretary_email, '사무장 이메일')
  if (sEmail) errors.secretary_email = sEmail

  return errors
}

/** 에러 객체가 비어있는지 확인 — 모든 ValidationErrors 인터페이스에서 사용 가능 */
export function hasValidationErrors<T extends object>(errors: T): boolean {
  return Object.values(errors).some((v) => !!v)
}

// ============================================================================
// 클럽 입력 전용 검증
// ============================================================================

export interface ClubValidationErrors {
  name?: string
  representative_name?: string
  city?: string
  district?: string
  address?: string
  contact_phone?: string
  contact_email?: string
  description?: string
  max_members?: string
}

const CLUB_NAME_MIN = 2
const CLUB_NAME_MAX = 50
const REPRESENTATIVE_NAME_MIN = 2
const ADDRESS_MAX_LENGTH = 200

/** 클럽 입력 전체 검증 */
export function validateClubInput(data: {
  name?: string
  representative_name?: string
  city?: string
  district?: string
  address?: string
  contact_phone?: string
  contact_email?: string
  description?: string
  max_members?: number | null
}): ClubValidationErrors {
  const errors: ClubValidationErrors = {}

  // 필수: 이름
  const nameMinErr = validateMinLength(data.name, CLUB_NAME_MIN, '클럽 이름')
  if (nameMinErr) errors.name = nameMinErr
  const nameMaxErr = validateMaxLength(data.name, CLUB_NAME_MAX, '클럽 이름')
  if (nameMaxErr) errors.name = nameMaxErr

  // 필수: 대표자명
  const repMinErr = validateMinLength(data.representative_name, REPRESENTATIVE_NAME_MIN, '대표자명')
  if (repMinErr) errors.representative_name = repMinErr
  const repMaxErr = validateMaxLength(data.representative_name, FIELD_MAX_LENGTH, '대표자명')
  if (repMaxErr) errors.representative_name = repMaxErr

  // 선택: 지역
  const cityMax = validateMaxLength(data.city, FIELD_MAX_LENGTH, '시/도')
  if (cityMax) errors.city = cityMax
  const districtMax = validateMaxLength(data.district, FIELD_MAX_LENGTH, '구/군')
  if (districtMax) errors.district = districtMax

  // 선택: 주소
  const addrMax = validateMaxLength(data.address, ADDRESS_MAX_LENGTH, '상세 주소')
  if (addrMax) errors.address = addrMax

  // 필수: 연락처 (숫자만 허용 + 형식 검증)
  const phoneRequired = validateMinLength(data.contact_phone, 1, '연락처')
  if (phoneRequired) {
    errors.contact_phone = phoneRequired
  } else {
    const phoneErr = validatePhone(data.contact_phone, '연락처')
    if (phoneErr) errors.contact_phone = phoneErr
  }

  // 필수: 이메일
  const emailRequired = validateMinLength(data.contact_email, 1, '이메일')
  if (emailRequired) {
    errors.contact_email = emailRequired
  } else {
    const emailErr = validateEmail(data.contact_email, '이메일')
    if (emailErr) errors.contact_email = emailErr
  }

  // 선택: 설명
  const descMax = validateMaxLength(data.description, DESCRIPTION_MAX_LENGTH, '클럽 소개')
  if (descMax) errors.description = descMax

  // 선택: 최대 회원 수
  if (data.max_members !== undefined && data.max_members !== null) {
    if (!Number.isFinite(data.max_members) || data.max_members < 1 || !Number.isInteger(data.max_members)) {
      errors.max_members = '최대 회원 수는 1 이상의 정수여야 합니다.'
    }
  }

  return errors
}

// ============================================================================
// 클럽 회원(비가입) 입력 검증
// ============================================================================

export interface MemberValidationErrors {
  name?: string
  birth_date?: string
  phone?: string
  start_year?: string
  rating?: string
}

const BIRTH_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/
const START_YEAR_REGEX = /^\d{4}$/
const CURRENT_YEAR = new Date().getFullYear()

/** 비가입 회원 입력 검증 */
export function validateMemberInput(data: {
  name?: string
  birth_date?: string
  phone?: string
  start_year?: string
  rating?: number
}): MemberValidationErrors {
  const errors: MemberValidationErrors = {}

  // 필수: 이름
  const nameMinErr = validateMinLength(data.name, 1, '이름')
  if (nameMinErr) errors.name = nameMinErr
  const nameMaxErr = validateMaxLength(data.name, FIELD_MAX_LENGTH, '이름')
  if (nameMaxErr) errors.name = nameMaxErr

  // 선택: 생년월일 (YYYY-MM)
  if (data.birth_date && data.birth_date.trim().length > 0) {
    if (!BIRTH_DATE_REGEX.test(data.birth_date.trim())) {
      errors.birth_date = '생년월일은 YYYY-MM 형식이어야 합니다.'
    }
  }

  // 선택: 연락처
  const phoneErr = validatePhone(data.phone, '연락처')
  if (phoneErr) errors.phone = phoneErr

  // 선택: 입문년도 (4자리 숫자, 현재년도 이하)
  if (data.start_year && data.start_year.trim().length > 0) {
    if (!START_YEAR_REGEX.test(data.start_year.trim())) {
      errors.start_year = '입문년도는 4자리 숫자여야 합니다.'
    } else {
      const year = parseInt(data.start_year, 10)
      if (year < 1950 || year > CURRENT_YEAR) {
        errors.start_year = `입문년도는 1950~${CURRENT_YEAR} 범위여야 합니다.`
      }
    }
  }

  // 선택: 레이팅 (1~9999)
  if (data.rating !== undefined && data.rating !== null) {
    if (!Number.isFinite(data.rating) || data.rating < 1 || data.rating > 9999 || !Number.isInteger(data.rating)) {
      errors.rating = '레이팅은 1~9999 범위의 정수여야 합니다.'
    }
  }

  return errors
}

// ============================================================================
// 포스트 검증
// ============================================================================

export interface PostValidationErrors {
  category?: string
  title?: string
  content?: string
}

const VALID_POST_CATEGORIES = ['NOTICE', 'FREE', 'INFO', 'REVIEW']

export function validatePostInput(data: {
  category?: string
  title?: string
  content?: string
}): PostValidationErrors {
  const errors: PostValidationErrors = {}

  if (!data.category || !VALID_POST_CATEGORIES.includes(data.category)) {
    errors.category = '카테고리를 선택해주세요.'
  }
  if (!data.title || data.title.trim().length === 0) {
    errors.title = '제목을 입력해주세요.'
  } else if (data.title.trim().length > 100) {
    errors.title = '제목은 100자 이내로 입력해주세요.'
  }
  // content는 HTML(리치텍스트)이므로 빈 값만 검증 (HTML 태그 제외 후 빈 내용 체크)
  if (!data.content || data.content.trim().length === 0) {
    errors.content = '내용을 입력해주세요.'
  } else {
    // HTML 태그 제거 후 실제 텍스트가 비어있는지 확인
    const textOnly = data.content.replace(/<[^>]*>/g, '').trim()
    if (textOnly.length === 0) {
      errors.content = '내용을 입력해주세요.'
    } else if (data.content.length > 50000) {
      errors.content = '내용이 너무 깁니다.'
    }
  }

  return errors
}

// ============================================================================
// 댓글 검증
// ============================================================================

export interface CommentValidationErrors {
  content?: string
}

export function validateCommentInput(data: {
  content?: string
}): CommentValidationErrors {
  const errors: CommentValidationErrors = {}

  if (!data.content || data.content.trim().length === 0) {
    errors.content = '댓글 내용을 입력해주세요.'
  } else if (data.content.trim().length > 1000) {
    errors.content = '댓글은 1000자 이내로 입력해주세요.'
  }

  return errors
}

// ============================================================================
// 문의 검증
// ============================================================================

export interface InquiryValidationErrors {
  category?: string
  title?: string
  content?: string
}

const VALID_INQUIRY_CATEGORIES = ['SERVICE', 'TOURNAMENT', 'ACCOUNT', 'ETC']

export function validateInquiryInput(data: {
  category?: string
  title?: string
  content?: string
}): InquiryValidationErrors {
  const errors: InquiryValidationErrors = {}

  if (!data.category || !VALID_INQUIRY_CATEGORIES.includes(data.category)) {
    errors.category = '문의 유형을 선택해주세요.'
  }
  if (!data.title || data.title.trim().length === 0) {
    errors.title = '제목을 입력해주세요.'
  } else if (data.title.trim().length > 100) {
    errors.title = '제목은 100자 이내로 입력해주세요.'
  }
  if (!data.content || data.content.trim().length === 0) {
    errors.content = '내용을 입력해주세요.'
  } else if (data.content.trim().length > 3000) {
    errors.content = '내용은 3000자 이내로 입력해주세요.'
  }

  return errors
}

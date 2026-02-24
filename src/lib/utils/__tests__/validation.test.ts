import {
  sanitizeInput,
  sanitizeObject,
  validateEmail,
  validatePhone,
  validateMinLength,
  validateMaxLength,
  validateAssociationInput,
  hasValidationErrors,
  validateClubInput,
  validateMemberInput,
  validateInquiryInput,
} from '../validation'

// ============================================================================
// sanitizeInput
// ============================================================================

describe('sanitizeInput', () => {
  it('HTML 태그를 제거한다', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('alert(1)')
    expect(sanitizeInput('<b>bold</b>')).toBe('bold')
    expect(sanitizeInput('<img src="x" />')).toBe('')
  })

  it('javascript: 프로토콜을 제거한다', () => {
    expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)')
    expect(sanitizeInput('JAVASCRIPT:void(0)')).toBe('void(0)')
  })

  it('onXxx= 이벤트 핸들러 패턴을 제거한다', () => {
    expect(sanitizeInput('onclick=alert(1)')).toBe('alert(1)')
    expect(sanitizeInput('onMouseOver= doEvil()')).toBe('doEvil()')
  })

  it('복합 패턴을 모두 제거한다', () => {
    const input = '<div onclick=alert(1)>javascript:hack</div>'
    const result = sanitizeInput(input)
    expect(result).not.toContain('<')
    expect(result).not.toContain('javascript:')
    expect(result).not.toContain('onclick=')
  })

  it('앞뒤 공백을 trim한다', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  it('정상 텍스트는 그대로 반환한다', () => {
    expect(sanitizeInput('서울 테니스 협회')).toBe('서울 테니스 협회')
    expect(sanitizeInput('test@example.com')).toBe('test@example.com')
  })
})

// ============================================================================
// sanitizeObject
// ============================================================================

describe('sanitizeObject', () => {
  it('string 필드에 sanitize를 적용한다', () => {
    const obj = { name: '<b>test</b>', desc: 'javascript:hack' }
    const result = sanitizeObject(obj)
    expect(result.name).toBe('test')
    expect(result.desc).toBe('hack')
  })

  it('number/boolean 필드는 그대로 유지한다', () => {
    const obj = { name: 'ok', count: 42, active: true }
    const result = sanitizeObject(obj)
    expect(result.count).toBe(42)
    expect(result.active).toBe(true)
  })

  it('중첩 객체의 string은 sanitize하지 않는다 (shallow)', () => {
    const obj = { nested: { evil: '<script>x</script>' }, top: '<b>y</b>' }
    const result = sanitizeObject(obj)
    expect(result.nested.evil).toBe('<script>x</script>')
    expect(result.top).toBe('y')
  })

  it('원본 객체를 변경하지 않는다', () => {
    const obj = { name: '<b>test</b>' }
    const result = sanitizeObject(obj)
    expect(obj.name).toBe('<b>test</b>')
    expect(result.name).toBe('test')
  })
})

// ============================================================================
// validateEmail
// ============================================================================

describe('validateEmail', () => {
  it('null/undefined/빈 문자열은 통과한다', () => {
    expect(validateEmail(null, '이메일')).toBeNull()
    expect(validateEmail(undefined, '이메일')).toBeNull()
    expect(validateEmail('', '이메일')).toBeNull()
    expect(validateEmail('   ', '이메일')).toBeNull()
  })

  it('유효한 이메일은 통과한다', () => {
    expect(validateEmail('test@example.com', '이메일')).toBeNull()
    expect(validateEmail('user.name@domain.co.kr', '이메일')).toBeNull()
  })

  it('유효하지 않은 이메일은 에러를 반환한다', () => {
    expect(validateEmail('test', '이메일')).not.toBeNull()
    expect(validateEmail('test@', '이메일')).not.toBeNull()
    expect(validateEmail('@example.com', '이메일')).not.toBeNull()
    expect(validateEmail('test @example.com', '이메일')).not.toBeNull()
  })

  it('에러 메시지에 필드명을 포함한다', () => {
    const result = validateEmail('invalid', '협회장 이메일')
    expect(result).toContain('협회장 이메일')
  })
})

// ============================================================================
// validatePhone
// ============================================================================

describe('validatePhone', () => {
  it('null/빈 문자열은 통과한다', () => {
    expect(validatePhone(null, '연락처')).toBeNull()
    expect(validatePhone('', '연락처')).toBeNull()
    expect(validatePhone('   ', '연락처')).toBeNull()
  })

  it('유효한 전화번호는 통과한다', () => {
    expect(validatePhone('01012345678', '연락처')).toBeNull()
    expect(validatePhone('010-1234-5678', '연락처')).toBeNull()
    expect(validatePhone('0109876543', '연락처')).toBeNull()
  })

  it('숫자가 아닌 문자가 포함되면 에러를 반환한다', () => {
    const result = validatePhone('010abcd5678', '연락처')
    expect(result).toContain('숫자만')
  })

  it('01X로 시작하지 않거나 길이가 맞지 않으면 에러를 반환한다', () => {
    expect(validatePhone('02012345678', '연락처')).not.toBeNull()
    expect(validatePhone('123', '연락처')).not.toBeNull()
    expect(validatePhone('010123456789999', '연락처')).not.toBeNull()
  })
})

// ============================================================================
// validateMinLength
// ============================================================================

describe('validateMinLength', () => {
  it('빈 값 + minLength > 0이면 에러를 반환한다', () => {
    expect(validateMinLength('', 1, '이름')).not.toBeNull()
    expect(validateMinLength(null, 2, '이름')).not.toBeNull()
    expect(validateMinLength(undefined, 1, '이름')).not.toBeNull()
  })

  it('빈 값 + minLength = 0이면 통과한다', () => {
    expect(validateMinLength('', 0, '이름')).toBeNull()
    expect(validateMinLength(null, 0, '이름')).toBeNull()
  })

  it('정확히 minLength와 같으면 통과한다', () => {
    expect(validateMinLength('ab', 2, '이름')).toBeNull()
  })

  it('minLength보다 짧으면 에러를 반환한다', () => {
    expect(validateMinLength('a', 2, '이름')).not.toBeNull()
  })

  it('minLength보다 길면 통과한다', () => {
    expect(validateMinLength('abc', 2, '이름')).toBeNull()
  })
})

// ============================================================================
// validateMaxLength
// ============================================================================

describe('validateMaxLength', () => {
  it('정확히 maxLength와 같으면 통과한다', () => {
    expect(validateMaxLength('abcde', 5, '필드')).toBeNull()
  })

  it('maxLength를 초과하면 에러를 반환한다', () => {
    expect(validateMaxLength('abcdef', 5, '필드')).not.toBeNull()
  })

  it('maxLength보다 짧으면 통과한다', () => {
    expect(validateMaxLength('abc', 5, '필드')).toBeNull()
  })

  it('빈 값은 통과한다', () => {
    expect(validateMaxLength('', 5, '필드')).toBeNull()
    expect(validateMaxLength(null, 5, '필드')).toBeNull()
  })
})

// ============================================================================
// validateAssociationInput
// ============================================================================

describe('validateAssociationInput', () => {
  const validInput = {
    name: '서울 테니스 협회',
    region: '서울',
    district: '강남구',
    description: '테니스 협회입니다.',
    president_name: '홍길동',
    president_phone: '01012345678',
    president_email: 'president@test.com',
    secretary_name: '김철수',
    secretary_phone: '01098765432',
    secretary_email: 'secretary@test.com',
  }

  it('정상 입력은 빈 에러 객체를 반환한다', () => {
    const errors = validateAssociationInput(validInput)
    expect(hasValidationErrors(errors)).toBe(false)
  })

  it('이름이 없으면 name 에러를 반환한다', () => {
    const errors = validateAssociationInput({ ...validInput, name: '' })
    expect(errors.name).toBeDefined()
  })

  it('이름이 너무 짧으면 name 에러를 반환한다', () => {
    const errors = validateAssociationInput({ ...validInput, name: 'A' })
    expect(errors.name).toBeDefined()
  })

  it('이름이 최대 길이를 초과하면 name 에러를 반환한다', () => {
    const errors = validateAssociationInput({ ...validInput, name: 'A'.repeat(51) })
    expect(errors.name).toBeDefined()
  })

  it('잘못된 이메일이면 에러를 반환한다', () => {
    const errors = validateAssociationInput({
      ...validInput,
      president_email: 'invalid',
      secretary_email: 'also-invalid',
    })
    expect(errors.president_email).toBeDefined()
    expect(errors.secretary_email).toBeDefined()
  })

  it('잘못된 전화번호이면 에러를 반환한다', () => {
    const errors = validateAssociationInput({
      ...validInput,
      president_phone: '123',
    })
    expect(errors.president_phone).toBeDefined()
  })

  it('선택 필드가 비어있으면 에러 없이 통과한다', () => {
    const errors = validateAssociationInput({ name: '서울 협회' })
    expect(hasValidationErrors(errors)).toBe(false)
  })

  it('설명이 500자를 초과하면 에러를 반환한다', () => {
    const errors = validateAssociationInput({
      ...validInput,
      description: 'A'.repeat(501),
    })
    expect(errors.description).toBeDefined()
  })
})

// ============================================================================
// hasValidationErrors
// ============================================================================

describe('hasValidationErrors', () => {
  it('빈 객체는 false를 반환한다', () => {
    expect(hasValidationErrors({})).toBe(false)
  })

  it('모든 값이 undefined이면 false를 반환한다', () => {
    expect(hasValidationErrors({ name: undefined, email: undefined })).toBe(false)
  })

  it('하나라도 string 값이 있으면 true를 반환한다', () => {
    expect(hasValidationErrors({ name: '에러 메시지' })).toBe(true)
  })

  it('빈 문자열도 truthy로 취급하지 않는다', () => {
    expect(hasValidationErrors({ name: '' })).toBe(false)
  })
})

// ============================================================================
// validateClubInput
// ============================================================================

describe('validateClubInput', () => {
  const validInput = {
    name: '강남 테니스 클럽',
    representative_name: '홍길동',
    city: '서울',
    district: '강남구',
    address: '테헤란로 123',
    contact_phone: '01012345678',
    contact_email: 'club@test.com',
    description: '테니스 클럽입니다.',
    max_members: 50,
  }

  it('정상 입력은 빈 에러 객체를 반환한다', () => {
    const errors = validateClubInput(validInput)
    expect(hasValidationErrors(errors)).toBe(false)
  })

  it('이름이 없으면 에러를 반환한다', () => {
    const errors = validateClubInput({ ...validInput, name: '' })
    expect(errors.name).toBeDefined()
  })

  it('대표자명이 없으면 에러를 반환한다', () => {
    const errors = validateClubInput({ ...validInput, representative_name: '' })
    expect(errors.representative_name).toBeDefined()
  })

  it('연락처가 없으면 에러를 반환한다', () => {
    const errors = validateClubInput({ ...validInput, contact_phone: '' })
    expect(errors.contact_phone).toBeDefined()
  })

  it('이메일이 없으면 에러를 반환한다', () => {
    const errors = validateClubInput({ ...validInput, contact_email: '' })
    expect(errors.contact_email).toBeDefined()
  })

  it('잘못된 연락처 형식이면 에러를 반환한다', () => {
    const errors = validateClubInput({ ...validInput, contact_phone: '123' })
    expect(errors.contact_phone).toBeDefined()
  })

  it('잘못된 이메일 형식이면 에러를 반환한다', () => {
    const errors = validateClubInput({ ...validInput, contact_email: 'not-email' })
    expect(errors.contact_email).toBeDefined()
  })

  describe('max_members 검증', () => {
    it('null/undefined는 통과한다', () => {
      expect(validateClubInput({ ...validInput, max_members: null }).max_members).toBeUndefined()
      expect(validateClubInput({ ...validInput, max_members: undefined }).max_members).toBeUndefined()
    })

    it('0이면 에러를 반환한다', () => {
      expect(validateClubInput({ ...validInput, max_members: 0 }).max_members).toBeDefined()
    })

    it('음수이면 에러를 반환한다', () => {
      expect(validateClubInput({ ...validInput, max_members: -1 }).max_members).toBeDefined()
    })

    it('소수이면 에러를 반환한다', () => {
      expect(validateClubInput({ ...validInput, max_members: 3.5 }).max_members).toBeDefined()
    })

    it('양수 정수는 통과한다', () => {
      expect(validateClubInput({ ...validInput, max_members: 1 }).max_members).toBeUndefined()
      expect(validateClubInput({ ...validInput, max_members: 100 }).max_members).toBeUndefined()
    })
  })
})

// ============================================================================
// validateMemberInput
// ============================================================================

describe('validateMemberInput', () => {
  const validInput = {
    name: '홍길동',
    birth_year: '2000',
    phone: '01012345678',
    start_year: '2020',
    rating: 1500,
  }

  it('정상 입력은 빈 에러 객체를 반환한다', () => {
    const errors = validateMemberInput(validInput)
    expect(hasValidationErrors(errors)).toBe(false)
  })

  it('이름이 없으면 에러를 반환한다', () => {
    const errors = validateMemberInput({ ...validInput, name: '' })
    expect(errors.name).toBeDefined()
  })

  describe('birth_year 검증', () => {
    it('유효한 4자리 년도는 통과한다', () => {
      expect(validateMemberInput({ ...validInput, birth_year: '2000' }).birth_year).toBeUndefined()
      expect(validateMemberInput({ ...validInput, birth_year: '1990' }).birth_year).toBeUndefined()
    })

    it('빈 값은 통과한다', () => {
      expect(validateMemberInput({ ...validInput, birth_year: '' }).birth_year).toBeUndefined()
      expect(validateMemberInput({ ...validInput, birth_year: undefined }).birth_year).toBeUndefined()
    })

    it('범위를 벗어나면 에러를 반환한다', () => {
      expect(validateMemberInput({ ...validInput, birth_year: '1800' }).birth_year).toBeDefined()
    })

    it('형식이 맞지 않으면 에러를 반환한다', () => {
      expect(validateMemberInput({ ...validInput, birth_year: 'abc' }).birth_year).toBeDefined()
      expect(validateMemberInput({ ...validInput, birth_year: '99' }).birth_year).toBeDefined()
      expect(validateMemberInput({ ...validInput, birth_year: '2000-01' }).birth_year).toBeDefined()
    })
  })

  describe('start_year 검증', () => {
    it('유효한 년도는 통과한다', () => {
      expect(validateMemberInput({ ...validInput, start_year: '2020' }).start_year).toBeUndefined()
      expect(validateMemberInput({ ...validInput, start_year: '1950' }).start_year).toBeUndefined()
    })

    it('빈 값은 통과한다', () => {
      expect(validateMemberInput({ ...validInput, start_year: '' }).start_year).toBeUndefined()
    })

    it('1949 이하이면 에러를 반환한다', () => {
      expect(validateMemberInput({ ...validInput, start_year: '1949' }).start_year).toBeDefined()
    })

    it('현재년도+1 이상이면 에러를 반환한다', () => {
      const futureYear = String(new Date().getFullYear() + 1)
      expect(validateMemberInput({ ...validInput, start_year: futureYear }).start_year).toBeDefined()
    })

    it('4자리 숫자가 아니면 에러를 반환한다', () => {
      expect(validateMemberInput({ ...validInput, start_year: 'abc' }).start_year).toBeDefined()
      expect(validateMemberInput({ ...validInput, start_year: '20' }).start_year).toBeDefined()
    })
  })

  describe('rating 검증', () => {
    it('1~9999 범위의 정수는 통과한다', () => {
      expect(validateMemberInput({ ...validInput, rating: 1 }).rating).toBeUndefined()
      expect(validateMemberInput({ ...validInput, rating: 9999 }).rating).toBeUndefined()
      expect(validateMemberInput({ ...validInput, rating: 5000 }).rating).toBeUndefined()
    })

    it('null/undefined는 통과한다', () => {
      expect(validateMemberInput({ ...validInput, rating: undefined }).rating).toBeUndefined()
    })

    it('0이면 에러를 반환한다', () => {
      expect(validateMemberInput({ ...validInput, rating: 0 }).rating).toBeDefined()
    })

    it('10000 이상이면 에러를 반환한다', () => {
      expect(validateMemberInput({ ...validInput, rating: 10000 }).rating).toBeDefined()
    })

    it('소수이면 에러를 반환한다', () => {
      expect(validateMemberInput({ ...validInput, rating: 3.5 }).rating).toBeDefined()
    })
  })
})

// ============================================================================
// validateInquiryInput — 검증 + 보안 테스트
// ============================================================================

describe('validateInquiryInput', () => {
  const validInput = {
    category: 'SERVICE',
    title: '서비스 이용 문의입니다',
    content: '문의 내용을 작성합니다.',
  }

  // ── 정상 케이스 ──────────────────────────────────────────────────────────
  it('정상 입력은 에러가 없다', () => {
    expect(hasValidationErrors(validateInquiryInput(validInput))).toBe(false)
  })

  it('모든 카테고리 값은 통과한다', () => {
    const categories = ['SERVICE', 'TOURNAMENT', 'ACCOUNT', 'ETC']
    categories.forEach((category) => {
      expect(
        hasValidationErrors(validateInquiryInput({ ...validInput, category }))
      ).toBe(false)
    })
  })

  it('제목 1자는 통과한다', () => {
    expect(validateInquiryInput({ ...validInput, title: 'A' }).title).toBeUndefined()
  })

  it('제목 100자는 통과한다', () => {
    expect(validateInquiryInput({ ...validInput, title: 'A'.repeat(100) }).title).toBeUndefined()
  })

  it('내용 1자는 통과한다', () => {
    expect(validateInquiryInput({ ...validInput, content: '내용' }).content).toBeUndefined()
  })

  it('내용 3000자는 통과한다', () => {
    expect(validateInquiryInput({ ...validInput, content: 'A'.repeat(3000) }).content).toBeUndefined()
  })

  // ── 카테고리 검증 ────────────────────────────────────────────────────────
  describe('category', () => {
    it('빈 문자열이면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, category: '' }).category).toBeDefined()
    })

    it('undefined이면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, category: undefined }).category).toBeDefined()
    })

    it('허용되지 않은 값이면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, category: 'INVALID' }).category).toBeDefined()
      expect(validateInquiryInput({ ...validInput, category: 'service' }).category).toBeDefined()
      expect(validateInquiryInput({ ...validInput, category: 'HACKING' }).category).toBeDefined()
    })
  })

  // ── 제목 검증 ────────────────────────────────────────────────────────────
  describe('title', () => {
    it('빈 문자열이면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, title: '' }).title).toBeDefined()
    })

    it('공백만 있으면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, title: '   ' }).title).toBeDefined()
    })

    it('undefined이면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, title: undefined }).title).toBeDefined()
    })

    it('101자를 초과하면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, title: 'A'.repeat(101) }).title).toBeDefined()
    })
  })

  // ── 내용 검증 ────────────────────────────────────────────────────────────
  describe('content', () => {
    it('빈 문자열이면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, content: '' }).content).toBeDefined()
    })

    it('공백만 있으면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, content: '   ' }).content).toBeDefined()
    })

    it('3001자를 초과하면 에러를 반환한다', () => {
      expect(validateInquiryInput({ ...validInput, content: 'A'.repeat(3001) }).content).toBeDefined()
    })
  })

  // ── 보안 테스트 ──────────────────────────────────────────────────────────
  describe('보안 — XSS 공격 패턴', () => {
    it('sanitize 후 정상 텍스트만 남으면 검증을 통과한다', () => {
      // sanitizeObject를 거친 후의 결과물 검증
      const xssTitle = sanitizeInput('<script>alert("xss")</script>문의 제목')
      const xssContent = sanitizeInput('<img src=x onerror=alert(1)>내용입니다')
      expect(validateInquiryInput({
        ...validInput,
        title: xssTitle,
        content: xssContent,
      })).toEqual({}) // 에러 없음 (tag 제거 후 유효 텍스트)
    })

    it('sanitize 후 빈 문자열이 되면 필수 에러를 반환한다', () => {
      // 태그만으로 이루어진 입력 → sanitize 후 빈 문자열
      const onlyTags = sanitizeInput('<script></script><img/>')
      expect(onlyTags).toBe('')
      expect(validateInquiryInput({ ...validInput, title: onlyTags }).title).toBeDefined()
    })

    it('javascript: 프로토콜은 sanitize 후 제거된다', () => {
      const malicious = sanitizeInput('javascript:alert(1)')
      expect(malicious).not.toContain('javascript:')
    })

    it('이벤트 핸들러 패턴은 sanitize 후 제거된다', () => {
      const malicious = sanitizeInput('onclick=evil() 제목')
      expect(malicious).not.toMatch(/on\w+\s*=/)
    })

    it('허용되지 않은 category 주입은 에러를 반환한다', () => {
      // SQL injection 시도
      expect(validateInquiryInput({ ...validInput, category: "' OR 1=1 --" }).category).toBeDefined()
      // 스크립트 주입 시도
      expect(validateInquiryInput({ ...validInput, category: '<script>' }).category).toBeDefined()
      // 열거형 외 값
      expect(validateInquiryInput({ ...validInput, category: 'ADMIN' }).category).toBeDefined()
    })
  })

  // ── 경계값 테스트 ────────────────────────────────────────────────────────
  describe('경계값', () => {
    it('제목 100자 → 통과, 101자 → 에러', () => {
      expect(validateInquiryInput({ ...validInput, title: 'A'.repeat(100) }).title).toBeUndefined()
      expect(validateInquiryInput({ ...validInput, title: 'A'.repeat(101) }).title).toBeDefined()
    })

    it('내용 3000자 → 통과, 3001자 → 에러', () => {
      expect(validateInquiryInput({ ...validInput, content: 'A'.repeat(3000) }).content).toBeUndefined()
      expect(validateInquiryInput({ ...validInput, content: 'A'.repeat(3001) }).content).toBeDefined()
    })

    it('다국어 내용은 정상 처리된다', () => {
      expect(hasValidationErrors(validateInquiryInput({
        ...validInput,
        title: '대회 관련 문의 🎾',
        content: '테니스 대회 참가 방법에 대해 문의드립니다. Tennis tournament inquiry.',
      }))).toBe(false)
    })
  })
})

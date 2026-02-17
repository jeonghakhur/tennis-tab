import { getChosung, isChosung, matchesKoreanSearch } from '../korean'

describe('getChosung', () => {
  it('한글 음절에서 초성을 추출한다', () => {
    expect(getChosung('가')).toBe('ㄱ')
    expect(getChosung('나')).toBe('ㄴ')
    expect(getChosung('다')).toBe('ㄷ')
    expect(getChosung('라')).toBe('ㄹ')
    expect(getChosung('마')).toBe('ㅁ')
    expect(getChosung('바')).toBe('ㅂ')
    expect(getChosung('사')).toBe('ㅅ')
    expect(getChosung('아')).toBe('ㅇ')
    expect(getChosung('자')).toBe('ㅈ')
    expect(getChosung('차')).toBe('ㅊ')
    expect(getChosung('카')).toBe('ㅋ')
    expect(getChosung('타')).toBe('ㅌ')
    expect(getChosung('파')).toBe('ㅍ')
    expect(getChosung('하')).toBe('ㅎ')
  })

  it('한글 유니코드 마지막 글자(힣)의 초성을 추출한다', () => {
    expect(getChosung('힣')).toBe('ㅎ')
  })

  it('쌍자음 초성을 추출한다', () => {
    expect(getChosung('까')).toBe('ㄲ')
    expect(getChosung('따')).toBe('ㄸ')
    expect(getChosung('빠')).toBe('ㅃ')
    expect(getChosung('싸')).toBe('ㅆ')
    expect(getChosung('짜')).toBe('ㅉ')
  })

  it('영문은 원본을 반환한다', () => {
    expect(getChosung('A')).toBe('A')
    expect(getChosung('z')).toBe('z')
  })

  it('숫자는 원본을 반환한다', () => {
    expect(getChosung('0')).toBe('0')
    expect(getChosung('9')).toBe('9')
  })

  it('특수문자는 원본을 반환한다', () => {
    expect(getChosung('!')).toBe('!')
    expect(getChosung('@')).toBe('@')
    expect(getChosung(' ')).toBe(' ')
  })
})

describe('isChosung', () => {
  it('기본 자음은 true를 반환한다', () => {
    const basicConsonants = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
    for (const c of basicConsonants) {
      expect(isChosung(c)).toBe(true)
    }
  })

  it('쌍자음은 true를 반환한다', () => {
    const doubleConsonants = ['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ']
    for (const c of doubleConsonants) {
      expect(isChosung(c)).toBe(true)
    }
  })

  it('모음은 false를 반환한다', () => {
    expect(isChosung('ㅏ')).toBe(false)
    expect(isChosung('ㅓ')).toBe(false)
    expect(isChosung('ㅗ')).toBe(false)
    expect(isChosung('ㅜ')).toBe(false)
  })

  it('한글 음절은 false를 반환한다', () => {
    expect(isChosung('가')).toBe(false)
    expect(isChosung('한')).toBe(false)
  })

  it('영문은 false를 반환한다', () => {
    expect(isChosung('A')).toBe(false)
    expect(isChosung('z')).toBe(false)
  })

  it('숫자/특수문자는 false를 반환한다', () => {
    expect(isChosung('1')).toBe(false)
    expect(isChosung('!')).toBe(false)
  })
})

describe('matchesKoreanSearch', () => {
  it('빈 쿼리는 항상 true를 반환한다', () => {
    expect(matchesKoreanSearch('테니스', '')).toBe(true)
    expect(matchesKoreanSearch('', '')).toBe(true)
    expect(matchesKoreanSearch('anything', '')).toBe(true)
  })

  describe('일반 substring 매칭', () => {
    it('완전 일치하면 true를 반환한다', () => {
      expect(matchesKoreanSearch('테니스', '테니스')).toBe(true)
    })

    it('부분 일치하면 true를 반환한다', () => {
      expect(matchesKoreanSearch('테니스', '니스')).toBe(true)
      expect(matchesKoreanSearch('테니스', '테니')).toBe(true)
      expect(matchesKoreanSearch('테니스', '니')).toBe(true)
    })

    it('대소문자를 무시한다', () => {
      expect(matchesKoreanSearch('Tennis', 'tennis')).toBe(true)
      expect(matchesKoreanSearch('tennis', 'TENNIS')).toBe(true)
      expect(matchesKoreanSearch('Tennis Club', 'tennis club')).toBe(true)
    })

    it('일치하지 않으면 false를 반환한다', () => {
      expect(matchesKoreanSearch('테니스', '배드민턴')).toBe(false)
    })
  })

  describe('초성 검색', () => {
    it('전체 초성이 일치하면 true를 반환한다', () => {
      expect(matchesKoreanSearch('테니스', 'ㅌㄴㅅ')).toBe(true)
    })

    it('부분 초성이 일치하면 true를 반환한다', () => {
      expect(matchesKoreanSearch('테니스', 'ㅌㄴ')).toBe(true)
      expect(matchesKoreanSearch('테니스', 'ㄴㅅ')).toBe(true)
    })

    it('초성이 일치하지 않으면 false를 반환한다', () => {
      expect(matchesKoreanSearch('테니스', 'ㅋㅋ')).toBe(false)
      expect(matchesKoreanSearch('테니스', 'ㅌㅌ')).toBe(false)
    })

    it('여러 글자 대상에서 초성 검색이 동작한다', () => {
      expect(matchesKoreanSearch('대한테니스협회', 'ㄷㅎㅌㄴㅅㅎㅎ')).toBe(true)
      expect(matchesKoreanSearch('대한테니스협회', 'ㅌㄴㅅ')).toBe(true)
    })
  })

  describe('혼합 검색 (완성형 + 초성)', () => {
    it('완성형과 초성이 혼합된 쿼리가 일치하면 true를 반환한다', () => {
      expect(matchesKoreanSearch('테니스', '테ㄴ')).toBe(true)
      expect(matchesKoreanSearch('테니스', '테ㄴㅅ')).toBe(true)
    })

    it('순서가 맞지 않으면 false를 반환한다', () => {
      expect(matchesKoreanSearch('테니스', 'ㄴ테')).toBe(false)
    })

    it('영문과 초성이 혼합된 쿼리도 동작한다', () => {
      // 영문은 초성이 아니므로 완성형 비교 경로
      expect(matchesKoreanSearch('A테니스', 'aㅌ')).toBe(true)
    })
  })

  describe('엣지 케이스', () => {
    it('빈 타겟에 비어 있지 않은 쿼리는 false를 반환한다', () => {
      expect(matchesKoreanSearch('', '테')).toBe(false)
    })

    it('한 글자 매칭이 동작한다', () => {
      expect(matchesKoreanSearch('가', 'ㄱ')).toBe(true)
      expect(matchesKoreanSearch('가', '가')).toBe(true)
      expect(matchesKoreanSearch('가', 'ㄴ')).toBe(false)
    })

    it('공백이 포함된 문자열에서 검색이 동작한다', () => {
      expect(matchesKoreanSearch('테니스 클럽', '테니스')).toBe(true)
      expect(matchesKoreanSearch('테니스 클럽', 'ㅋㄹ')).toBe(true)
    })
  })
})

/**
 * 한글 초성 검색 유틸리티
 * 유니코드 한글 음절: 0xAC00 ~ 0xD7A3
 * 초성 = (code - 0xAC00) / (21 * 28)
 */

// 초성 배열 (19자)
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

/** 한글 음절에서 초성 추출. 한글이 아니면 원본 반환 */
export function getChosung(char: string): string {
  const code = char.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return char
  return CHOSUNG[Math.floor((code - 0xac00) / (21 * 28))]
}

/** 문자가 한글 자음(초성)인지 판별 */
export function isChosung(char: string): boolean {
  return CHOSUNG.includes(char as typeof CHOSUNG[number])
}

/**
 * 한글 초성/일반 텍스트 혼합 검색
 *
 * - 빈 쿼리 → true
 * - 일반 substring 매칭 (대소문자 무시)
 * - 전체 초성 쿼리 → 타겟 초성 시퀀스에서 연속 매칭
 * - 혼합 쿼리 (완성형+초성) → 문자별 매칭
 */
export function matchesKoreanSearch(target: string, query: string): boolean {
  if (!query) return true

  const lowerTarget = target.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // 1. 일반 substring 매칭
  if (lowerTarget.includes(lowerQuery)) return true

  // 쿼리가 초성만으로 구성되었는지 확인
  const allChosung = [...query].every(isChosung)

  if (allChosung) {
    // 2. 전체 초성 쿼리 → 타겟 초성 시퀀스에서 연속 매칭
    const targetChosung = [...target].map(getChosung).join('')
    return targetChosung.includes(query)
  }

  // 3. 혼합 쿼리 (완성형+초성) → 문자별 순차 매칭
  const queryChars = [...lowerQuery]
  let qi = 0
  for (let ti = 0; ti < target.length && qi < queryChars.length; ti++) {
    const qChar = queryChars[qi]
    if (isChosung(qChar)) {
      // 초성 비교
      if (getChosung(target[ti]) === qChar) qi++
    } else {
      // 완성형 비교 (대소문자 무시)
      if (target[ti].toLowerCase() === qChar) qi++
    }
  }
  return qi === queryChars.length
}

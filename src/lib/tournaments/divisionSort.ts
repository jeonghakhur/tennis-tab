// 부서명 정렬 우선순위 (부분 매칭)
// 이름이 키워드를 포함하면 해당 순서 적용, 미매칭은 맨 뒤
const DIVISION_ORDER = ['마스터', '챌린저', '퓨처스', '국화', '개나리']

function getDivisionPriority(name: string): number {
  const idx = DIVISION_ORDER.findIndex((keyword) => name.includes(keyword))
  return idx === -1 ? DIVISION_ORDER.length : idx
}

export function sortDivisions<T extends { name: string }>(divisions: T[]): T[] {
  return [...divisions].sort(
    (a, b) => getDivisionPriority(a.name) - getDivisionPriority(b.name)
  )
}

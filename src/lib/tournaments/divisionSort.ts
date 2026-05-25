// 부서 정렬 정책
// 1순위: display_order (있을 때만 의미 — 0/null은 뒤로)
// 2순위: 부서명 키워드 우선순위 (마스터, 챌린저, …)
// 3순위: 가나다순 (위가 모두 동률일 때)

const DIVISION_ORDER = ['마스터', '챌린저', '퓨처스', '국화', '개나리']

function getDivisionPriority(name: string): number {
  const idx = DIVISION_ORDER.findIndex((keyword) => name.includes(keyword))
  return idx === -1 ? DIVISION_ORDER.length : idx
}

// display_order 정규화: null/0/undefined는 Infinity로 취급 → 뒤로 배치
function getOrderValue(order: number | null | undefined): number {
  if (order === null || order === undefined || order === 0) return Number.POSITIVE_INFINITY
  return order
}

export function sortDivisions<T extends { name: string; display_order?: number | null }>(
  divisions: T[],
): T[] {
  return [...divisions].sort((a, b) => {
    const orderDiff = getOrderValue(a.display_order) - getOrderValue(b.display_order)
    if (orderDiff !== 0) return orderDiff
    const priorityDiff = getDivisionPriority(a.name) - getDivisionPriority(b.name)
    if (priorityDiff !== 0) return priorityDiff
    return a.name.localeCompare(b.name, 'ko')
  })
}

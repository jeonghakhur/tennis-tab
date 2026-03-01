/**
 * 로케일에 의존하지 않는 날짜 포맷 유틸
 * SSR/CSR Hydration mismatch 방지용
 */

export function formatKoreanDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}. ${m}. ${day}.`
}

export function formatKoreanDateTime(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}. ${m}. ${day}. ${h}:${min}`
}

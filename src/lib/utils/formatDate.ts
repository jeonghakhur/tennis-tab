/**
 * 날짜 포맷 유틸
 * 항상 KST(UTC+9) 기준으로 변환 — 서버(UTC)·클라이언트(KST) 모두 동일한 결과 보장
 * getHours() 등 로컬 시간 메서드는 서버 TZ에 따라 달라지므로 사용 금지
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function toKSTDate(dateStr: string | Date): Date {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return new Date(d.getTime() + KST_OFFSET_MS)
}

export function formatKoreanDate(dateStr: string | Date): string {
  const d = toKSTDate(dateStr)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return `${y}. ${m}. ${day}.`
}

export function formatKoreanDateTime(dateStr: string | Date): string {
  const d = toKSTDate(dateStr)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${y}. ${m}. ${day}. ${h}:${min}`
}

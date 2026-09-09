'use client'

import { useState } from 'react'
import { setClubFeePaid } from '@/lib/clubs/feeActions'

interface Props {
  clubId: string
  /** 대상 연도 (KST 기준 현재 연도) */
  year: number
  paid: boolean
  /** 접근성 라벨 — 목록처럼 별도 텍스트 라벨이 없는 곳에서 사용 */
  ariaLabel?: string
  /** 별도 텍스트 라벨 요소 id (상세 페이지) */
  ariaLabelledBy?: string
  /** 저장 성공 시 (paidAt: 납부 시각, 미납 전환이면 null) */
  onSaved: (paid: boolean, paidAt: string | null) => void
  onError: (message: string) => void
}

/**
 * 협회 연회비 납부 스위치 (저장 로직 포함, 피드백 UI는 상위에서 처리)
 * - 클릭 즉시 Server Action 호출, 완료될 때까지 비활성화
 * - 목록/상세 양쪽에서 재사용
 */
export function ClubFeeToggle({ clubId, year, paid, ariaLabel, ariaLabelledBy, onSaved, onError }: Props) {
  const [saving, setSaving] = useState(false)

  const handleToggle = async () => {
    if (saving) return
    const next = !paid
    setSaving(true)
    try {
      const result = await setClubFeePaid(clubId, year, next)
      if (result.error) {
        onError(result.error)
        return
      }
      onSaved(next, result.paidAt ?? null)
    } catch {
      onError('납부 여부 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={paid}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-busy={saving}
      disabled={saving}
      onClick={handleToggle}
      // OFF 트랙: --bg-secondary는 카드 배경과 같아 구분이 안 되므로 text-muted 반투명 회색 사용 (다크/라이트 공통)
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
        paid ? 'bg-(--color-success)' : 'bg-(--text-muted)/40 hover:bg-(--text-muted)/55'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          paid ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

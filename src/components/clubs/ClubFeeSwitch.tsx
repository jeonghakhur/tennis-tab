'use client'

import { useState } from 'react'
import { Badge } from '@/components/common/Badge'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { setClubFeePaid } from '@/lib/clubs/feeActions'
import { formatKoreanDate } from '@/lib/utils/formatDate'

interface Props {
  clubId: string
  /** 대상 연도 (KST 기준 현재 연도) */
  year: number
  initialPaid: boolean
  initialPaidAt: string | null
  /** 시스템 ADMIN 이상만 변경 가능 — false면 읽기 전용 배지 */
  canEdit: boolean
}

/**
 * 클럽 협회 연회비 납부 스위치
 * - 토글 즉시 저장 (별도 저장 버튼 없음)
 * - 실패 시 이전 상태로 롤백 + AlertDialog
 */
export function ClubFeeSwitch({ clubId, year, initialPaid, initialPaidAt, canEdit }: Props) {
  const [paid, setPaid] = useState(initialPaid)
  const [paidAt, setPaidAt] = useState<string | null>(initialPaidAt)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const handleToggle = async () => {
    if (!canEdit || saving) return
    const next = !paid
    // 낙관적 업데이트
    setPaid(next)
    setSaving(true)

    const result = await setClubFeePaid(clubId, year, next)
    setSaving(false)

    if (result.error) {
      setPaid(!next)
      setAlert({ isOpen: true, message: result.error })
      return
    }

    setPaidAt(result.paidAt ?? null)
    setToast({
      isOpen: true,
      message: next ? `${year}년 연회비 납부로 저장되었습니다.` : `${year}년 연회비 미납으로 변경되었습니다.`,
    })
  }

  const switchId = `club-fee-switch-${clubId}`

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p id={`${switchId}-label`} className="text-sm font-medium text-(--text-primary)">
            {year}년 협회 연회비
          </p>
          <p className="text-xs text-(--text-muted) mt-0.5">
            {paid && paidAt
              ? `${formatKoreanDate(paidAt)} 납부 처리됨`
              : canEdit
                ? '변경 즉시 저장됩니다. 매년 1월 1일부터 새 연도 기준으로 표시됩니다.'
                : '협회 관리자가 납부 여부를 관리합니다.'}
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            role="switch"
            aria-checked={paid}
            aria-labelledby={`${switchId}-label`}
            aria-busy={saving}
            disabled={saving}
            onClick={handleToggle}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
              paid ? 'bg-(--color-success)' : 'bg-(--bg-secondary) border border-(--border-color)'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                paid ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        ) : (
          <Badge variant={paid ? 'success' : 'warning'}>{paid ? '납부' : '미납'}</Badge>
        )}
      </div>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type="success"
      />
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title="오류"
        message={alert.message}
        type="error"
      />
    </>
  )
}

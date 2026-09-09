'use client'

import { useState } from 'react'
import { Badge } from '@/components/common/Badge'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { formatKoreanDate } from '@/lib/utils/formatDate'
import { ClubFeeToggle } from './ClubFeeToggle'

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
 * 클럽 상세 > 클럽 정보 탭의 협회 연회비 납부 행
 * - 라벨 + 납부 시각 안내 + 스위치(ClubFeeToggle), 피드백은 Toast/AlertDialog
 */
export function ClubFeeSwitch({ clubId, year, initialPaid, initialPaidAt, canEdit }: Props) {
  const [paid, setPaid] = useState(initialPaid)
  const [paidAt, setPaidAt] = useState<string | null>(initialPaidAt)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const labelId = `club-fee-label-${clubId}`

  const handleSaved = (nextPaid: boolean, nextPaidAt: string | null) => {
    setPaid(nextPaid)
    setPaidAt(nextPaidAt)
    setToast({
      isOpen: true,
      message: nextPaid ? `${year}년 연회비 납부로 저장되었습니다.` : `${year}년 연회비 미납으로 변경되었습니다.`,
    })
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p id={labelId} className="text-sm font-medium text-(--text-primary)">
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
          <ClubFeeToggle
            clubId={clubId}
            year={year}
            paid={paid}
            ariaLabelledBy={labelId}
            onSaved={handleSaved}
            onError={(message) => setAlert({ isOpen: true, message })}
          />
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

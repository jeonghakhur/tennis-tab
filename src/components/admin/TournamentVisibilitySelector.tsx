'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTournamentVisibility } from '@/lib/tournaments/actions'
import { AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import type { TournamentVisibility } from '@/lib/supabase/types'
import { TOURNAMENT_VISIBILITIES, VISIBILITY_CONFIG } from '@/lib/tournaments/visibility'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TournamentVisibilitySelectorProps {
  tournamentId: string
  currentVisibility: TournamentVisibility
}

/** 공개 범위별 셀렉트 트리거 색상 — Badge variant와 동일한 시맨틱 색 */
const TRIGGER_CLASS: Record<TournamentVisibility, string> = {
  PUBLIC: 'bg-subtle-success',
  UNLISTED: 'bg-subtle-warning',
  HIDDEN: 'bg-subtle-secondary',
}

/**
 * 대회 공개 범위 변경 셀렉터 (어드민 전용)
 * - TournamentStatusSelector와 동일한 확인 → 변경 → 결과 알림 흐름
 */
export function TournamentVisibilitySelector({
  tournamentId,
  currentVisibility,
}: TournamentVisibilitySelectorProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [pending, setPending] = useState<TournamentVisibility | null>(null)
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'success'
  }>({ isOpen: false, title: '', message: '', type: 'info' })

  const handleChange = (next: TournamentVisibility) => {
    if (next === currentVisibility || isLoading) return
    setPending(next)
  }

  const handleConfirm = async () => {
    if (!pending) return
    setIsLoading(true)
    try {
      const result = await updateTournamentVisibility(tournamentId, pending)
      if (result.success) {
        setAlertDialog({
          isOpen: true,
          title: '공개 범위 변경 완료',
          message: `공개 범위가 "${VISIBILITY_CONFIG[pending].label}"(으)로 변경되었습니다.`,
          type: 'success',
        })
        router.refresh()
      } else {
        setAlertDialog({ isOpen: true, title: '공개 범위 변경 실패', message: result.error, type: 'error' })
      }
    } catch {
      setAlertDialog({
        isOpen: true,
        title: '오류',
        message: '공개 범위 변경 중 오류가 발생했습니다.',
        type: 'error',
      })
    } finally {
      setPending(null)
      setIsLoading(false)
    }
  }

  return (
    <>
      <Select
        value={currentVisibility}
        onValueChange={(v) => handleChange(v as TournamentVisibility)}
        disabled={isLoading}
      >
        <SelectTrigger
          aria-label="대회 공개 범위"
          className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-400 dark:focus:border-gray-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${TRIGGER_CLASS[currentVisibility]}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TOURNAMENT_VISIBILITIES.map((key) => (
            <SelectItem key={key} value={key}>
              {VISIBILITY_CONFIG[key].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ConfirmDialog
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        title="공개 범위 변경"
        message={
          pending
            ? `공개 범위를 "${VISIBILITY_CONFIG[pending].label}"(으)로 변경하시겠습니까?\n${VISIBILITY_CONFIG[pending].description}`
            : ''
        }
        confirmText="변경"
        type="warning"
        isLoading={isLoading}
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </>
  )
}

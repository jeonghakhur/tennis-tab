'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { EntryCard } from '@/components/my/EntryCard'
import { EntryStatusFilter } from '@/components/my/EntryStatusFilter'
import { ConfirmDialog, Toast } from '@/components/common/AlertDialog'
import { deleteEntry } from '@/lib/entries/actions'
import type { MyEntry } from '@/lib/data/user'

// 필터에 표시할 상태 키 (EntryStatusFilter의 FILTER_OPTIONS와 일치)
const STATUS_KEYS = ['ALL', 'PENDING', 'APPROVED', 'CONFIRMED', 'WAITLISTED', 'CANCELLED'] as const

interface MyEntriesClientProps {
  entries: MyEntry[]
}

export function MyEntriesClient({ entries }: MyEntriesClientProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [cancelTarget, setCancelTarget] = useState<{ id: string; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    message: '',
    type: 'success',
  })

  // 상태별 건수 계산
  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: entries.length }
    for (const key of STATUS_KEYS) {
      if (key !== 'ALL') {
        map[key] = entries.filter((e) => e.status === key).length
      }
    }
    return map
  }, [entries])

  // 필터 적용
  const filteredEntries = useMemo(() => {
    if (statusFilter === 'ALL') return entries
    return entries.filter((e) => e.status === statusFilter)
  }, [entries, statusFilter])

  // 취소 요청 핸들러
  const handleCancelRequest = useCallback((entryId: string, tournamentTitle: string) => {
    setCancelTarget({ id: entryId, title: tournamentTitle })
  }, [])

  // 취소 확인 핸들러
  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget) return

    setIsDeleting(true)
    const result = await deleteEntry(cancelTarget.id)
    setIsDeleting(false)
    setCancelTarget(null)

    if (result.success) {
      setToast({ isOpen: true, message: '참가 신청이 취소되었습니다.', type: 'success' })
      router.refresh()
    } else {
      setToast({
        isOpen: true,
        message: result.error || '취소 처리 중 오류가 발생했습니다.',
        type: 'error',
      })
    }
  }, [cancelTarget, router])

  // 필터 결과 상태 라벨 (빈 상태 메시지용)
  const statusLabel: Record<string, string> = {
    PENDING: '대기',
    APPROVED: '승인',
    CONFIRMED: '확정',
    WAITLISTED: '대기자',
    CANCELLED: '취소',
  }

  return (
    <>
      <Navigation />
      <main
        className="min-h-screen pt-20"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
          {/* 페이지 제목 */}
          <h1
            className="text-2xl font-bold mb-5"
            style={{ color: 'var(--text-primary)' }}
          >
            내 신청 관리
          </h1>

          {/* 상태 필터 */}
          <div className="mb-5">
            <EntryStatusFilter
              selected={statusFilter}
              onChange={setStatusFilter}
              counts={counts}
            />
          </div>

          {/* 엔트리 리스트 */}
          {entries.length === 0 ? (
            // 전체 0건
            <section
              className="rounded-xl p-12 text-center"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <p
                className="text-base mb-4"
                style={{ color: 'var(--text-muted)' }}
              >
                참가 신청한 대회가 없습니다.
              </p>
              <Link
                href="/tournaments"
                className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--bg-primary)',
                }}
              >
                대회 찾아보기
              </Link>
            </section>
          ) : filteredEntries.length === 0 ? (
            // 필터 결과 0건
            <section
              className="rounded-xl p-12 text-center"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <p
                className="text-base"
                style={{ color: 'var(--text-muted)' }}
              >
                {statusLabel[statusFilter] ?? statusFilter} 상태의 신청이 없습니다.
              </p>
            </section>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onCancel={handleCancelRequest}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 취소 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title="참가 취소"
        message={`'${cancelTarget?.title ?? ''}' 참가 신청을 취소하시겠습니까?`}
        confirmText="취소하기"
        cancelText="돌아가기"
        type="warning"
        isLoading={isDeleting}
      />

      {/* 결과 토스트 */}
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
        message={toast.message}
        type={toast.type}
      />
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { getCoachesByClub, createCoach, updateCoach, deactivateCoach } from '@/lib/coaches/actions'
import { Toast } from '@/components/common/AlertDialog'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import { CoachCard } from './CoachCard'
import { CoachForm } from './CoachForm'
import type { Coach, CreateCoachInput } from '@/lib/lessons/types'

interface CoachListProps {
  clubId: string
  isAdmin: boolean
}

export function CoachList({ clubId, isAdmin }: CoachListProps) {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [confirmDeactivate, setConfirmDeactivate] = useState<Coach | null>(null)

  useEffect(() => {
    loadCoaches()
  }, [clubId])

  const loadCoaches = async () => {
    const { data } = await getCoachesByClub(clubId)
    setCoaches(data)
    setLoading(false)
  }

  const handleCreate = async (data: CreateCoachInput) => {
    const result = await createCoach(clubId, data)
    if (!result.error) {
      setToast({ isOpen: true, message: '코치가 등록되었습니다.', type: 'success' })
      loadCoaches()
    }
    return result
  }

  const handleUpdate = async (data: CreateCoachInput) => {
    if (!editingCoach) return { error: '코치를 선택해주세요.' }
    const result = await updateCoach(editingCoach.id, data)
    if (!result.error) {
      setToast({ isOpen: true, message: '코치 정보가 수정되었습니다.', type: 'success' })
      setEditingCoach(null)
      loadCoaches()
    }
    return result
  }

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return
    const result = await deactivateCoach(confirmDeactivate.id)
    if (!result.error) {
      setToast({ isOpen: true, message: '코치가 비활성화되었습니다.', type: 'success' })
      loadCoaches()
    }
    setConfirmDeactivate(null)
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
          코치 ({coaches.length}명)
        </h3>
        {isAdmin && (
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--bg-primary)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            코치 등록
          </button>
        )}
      </div>

      {coaches.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          등록된 코치가 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {coaches.map((coach) => (
            <CoachCard
              key={coach.id}
              coach={coach}
              isAdmin={isAdmin}
              onEdit={() => setEditingCoach(coach)}
            />
          ))}
        </div>
      )}

      {/* 코치 등록 폼 */}
      <CoachForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />

      {/* 코치 수정 폼 */}
      {editingCoach && (
        <CoachForm
          isOpen={!!editingCoach}
          onClose={() => setEditingCoach(null)}
          onSubmit={handleUpdate}
          initialData={editingCoach}
        />
      )}

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />

      <ConfirmDialog
        isOpen={!!confirmDeactivate}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={handleDeactivate}
        title="코치 비활성화"
        message={`${confirmDeactivate?.name} 코치를 비활성화하시겠습니까?`}
        type="warning"
      />
    </div>
  )
}

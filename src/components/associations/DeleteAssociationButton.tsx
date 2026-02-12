'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteAssociation } from '@/lib/associations/actions'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import { AlertDialog } from '@/components/common/AlertDialog'

interface Props {
  associationId: string
  associationName: string
  className?: string
}

/** 협회 삭제 버튼 (ConfirmDialog 포함) */
export function DeleteAssociationButton({ associationId, associationName, className }: Props) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const handleDelete = async () => {
    setLoading(true)
    try {
      const result = await deleteAssociation(associationId)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error })
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={loading}
        className={className ?? 'btn-secondary btn-sm text-xs text-red-500'}
      >
        삭제
      </button>

      <ConfirmDialog
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleDelete}
        title="협회 삭제"
        message={`"${associationName}" 협회를 삭제하시겠습니까?\n소속 클럽은 독립 클럽으로 전환되고, 매니저는 일반 사용자로 변경됩니다.`}
        type="warning"
        confirmText="삭제"
        cancelText="취소"
      />

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ isOpen: false, message: '' })}
        title="오류"
        message={alert.message}
        type="error"
      />
    </>
  )
}

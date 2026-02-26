'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AwardRegisterModal } from './AwardRegisterModal'
import { useRouter } from 'next/navigation'
import type { TournamentOption } from '@/lib/awards/actions'

interface ClubOption { id: string; name: string }

interface Props {
  tournaments: TournamentOption[]
  clubs: ClubOption[]
}

export function AwardsAdminBar({ tournaments, clubs }: Props) {
  const [registerOpen, setRegisterOpen] = useState(false)
  const router = useRouter()

  const handleCreated = () => {
    // 목록 새로고침
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setRegisterOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          backgroundColor: 'var(--accent-color)',
          color: 'var(--bg-primary)',
        }}
      >
        <Plus className="w-4 h-4" />
        수상자 등록
      </button>

      <AwardRegisterModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onCreated={handleCreated}
        tournaments={tournaments}
        clubs={clubs}
      />
    </>
  )
}

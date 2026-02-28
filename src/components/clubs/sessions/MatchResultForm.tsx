'use client'

import { useState, useRef } from 'react'
import { Modal } from '@/components/common/Modal'
import { AlertDialog } from '@/components/common/AlertDialog'
import { reportMatchResult } from '@/lib/clubs/session-actions'
import type { ClubMatchResult } from '@/lib/clubs/types'

interface MatchResultFormProps {
  match: ClubMatchResult
  myMemberId: string
  isOpen: boolean
  onClose: () => void
  onReported: () => void
}

export default function MatchResultForm({
  match,
  myMemberId,
  isOpen,
  onClose,
  onReported,
}: MatchResultFormProps) {
  const isPlayer1 = myMemberId === match.player1_member_id
  const opponentName = isPlayer1 ? match.player2?.name : match.player1?.name

  const [myScore, setMyScore] = useState('')
  const [opponentScore, setOpponentScore] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const myScoreRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const myScoreNum = Number(myScore)
    const oppScoreNum = Number(opponentScore)

    if (isNaN(myScoreNum) || myScoreNum < 0) {
      setAlert({ isOpen: true, message: '내 점수를 올바르게 입력해주세요.', type: 'error' })
      return
    }
    if (isNaN(oppScoreNum) || oppScoreNum < 0) {
      setAlert({ isOpen: true, message: '상대 점수를 올바르게 입력해주세요.', type: 'error' })
      return
    }

    setSaving(true)
    const result = await reportMatchResult(match.id, {
      my_score: myScoreNum,
      opponent_score: oppScoreNum,
    })
    setSaving(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    onReported()
  }

  const inputClass =
    'w-full px-4 py-3 text-center text-2xl font-bold rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none focus:border-(--accent-color)'

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="경기 결과 입력" size="sm">
        <form onSubmit={handleSubmit} noValidate>
          <Modal.Body>
            <div className="space-y-4">
              <p className="text-sm text-(--text-secondary) text-center">
                vs <strong className="text-(--text-primary)">{opponentName || '상대'}</strong>
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="my-score" className="block text-xs text-(--text-muted) mb-1 text-center">
                    내 점수
                  </label>
                  <input
                    id="my-score"
                    ref={myScoreRef}
                    type="number"
                    min={0}
                    value={myScore}
                    onChange={(e) => setMyScore(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label htmlFor="opp-score" className="block text-xs text-(--text-muted) mb-1 text-center">
                    상대 점수
                  </label>
                  <input
                    id="opp-score"
                    type="number"
                    min={0}
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
              </div>

              <p className="text-xs text-(--text-muted) text-center">
                양쪽 모두 같은 점수를 입력하면 자동 확정됩니다.
                <br />
                점수가 다르면 관리자에게 분쟁 처리가 요청됩니다.
              </p>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) border border-(--border-color)"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold disabled:opacity-50"
            >
              {saving ? '제출 중...' : '결과 제출'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}

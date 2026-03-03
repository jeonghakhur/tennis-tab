'use client'

import { useState, useRef } from 'react'
import { Modal } from '@/components/common/Modal'
import { AlertDialog } from '@/components/common/AlertDialog'
import { reportMatchResult, adminOverrideMatchResult } from '@/lib/clubs/session-actions'
import type { ClubMatchResult } from '@/lib/clubs/types'

interface MatchResultFormProps {
  match: ClubMatchResult
  myMemberId: string
  /** 관리자 직접 수정 모드 */
  isOfficerOverride?: boolean
  isOpen: boolean
  onClose: () => void
  onReported: () => void
}

export default function MatchResultForm({
  match,
  myMemberId,
  isOfficerOverride = false,
  isOpen,
  onClose,
  onReported,
}: MatchResultFormProps) {
  const isDoubles = match.match_type !== 'singles'

  // 관리자 모드: 팀1/팀2 관점, 기존 점수 pre-fill
  // 일반 모드: 내 팀 / 상대 팀 관점
  const isPlayer1 = myMemberId === match.player1_member_id || myMemberId === match.player1b_member_id
  // member 우선, 없으면 guest 폴백
  const p1Name = match.player1?.name ?? match.player1_guest?.name ?? '?'
  const p2Name = match.player2?.name ?? match.player2_guest?.name ?? '?'
  const p1bName = match.player1b?.name ?? match.player1b_guest?.name ?? '?'
  const p2bName = match.player2b?.name ?? match.player2b_guest?.name ?? '?'
  const team1Name = isDoubles
    ? `${p1Name} / ${p1bName}`
    : p1Name || '팀1'
  const team2Name = isDoubles
    ? `${p2Name} / ${p2bName}`
    : p2Name || '팀2'

  const [score1, setScore1] = useState(
    isOfficerOverride && match.player1_score != null ? String(match.player1_score) : ''
  )
  const [score2, setScore2] = useState(
    isOfficerOverride && match.player2_score != null ? String(match.player2_score) : ''
  )
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const score1Ref = useRef<HTMLInputElement>(null)

  // 일반 모드 표시용: 내 점수 / 상대 점수 매핑
  const myScore = isPlayer1 ? score1 : score2
  const oppScore = isPlayer1 ? score2 : score1
  const setMyScore = isPlayer1 ? setScore1 : setScore2
  const setOppScore = isPlayer1 ? setScore2 : setScore1

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const s1 = Number(score1)
    const s2 = Number(score2)

    if (isNaN(s1) || s1 < 0) {
      setAlert({ isOpen: true, message: '점수를 올바르게 입력해주세요.', type: 'error' })
      return
    }
    if (isNaN(s2) || s2 < 0) {
      setAlert({ isOpen: true, message: '점수를 올바르게 입력해주세요.', type: 'error' })
      return
    }

    setSaving(true)
    let result: { error?: string }

    if (isOfficerOverride) {
      result = await adminOverrideMatchResult(match.id, { player1_score: s1, player2_score: s2 })
    } else {
      result = await reportMatchResult(match.id, {
        my_score: isPlayer1 ? s1 : s2,
        opponent_score: isPlayer1 ? s2 : s1,
      })
    }
    setSaving(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    onReported()
  }

  const inputClass =
    'w-full px-4 py-3 text-center text-2xl font-bold rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none focus:border-(--accent-color)'

  const title = isOfficerOverride
    ? (match.status === 'COMPLETED' ? '점수 수정 (관리자)' : '결과 입력 (관리자)')
    : '경기 결과 입력'

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
        <form onSubmit={handleSubmit} noValidate>
          <Modal.Body>
            <div className="space-y-4">
              {isOfficerOverride ? (
                /* 관리자 모드: 팀1 vs 팀2 */
                <>
                  <p className="text-sm text-(--text-muted) text-center">
                    {team1Name} <span className="text-(--text-primary) font-semibold mx-1">vs</span> {team2Name}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="score1" className="block text-sm text-(--text-muted) mb-1 text-center truncate">
                        {team1Name}
                      </label>
                      <input
                        id="score1"
                        ref={score1Ref}
                        type="number"
                        min={0}
                        value={score1}
                        onChange={(e) => setScore1(e.target.value)}
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="score2" className="block text-sm text-(--text-muted) mb-1 text-center truncate">
                        {team2Name}
                      </label>
                      <input
                        id="score2"
                        type="number"
                        min={0}
                        value={score2}
                        onChange={(e) => setScore2(e.target.value)}
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* 일반 모드: 내 점수 / 상대 점수 */
                <>
                  <p className="text-sm text-(--text-secondary) text-center">
                    vs <strong className="text-(--text-primary)">
                      {isPlayer1 ? team2Name : team1Name}
                    </strong>
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="my-score" className="block text-sm text-(--text-muted) mb-1 text-center">
                        내 점수
                      </label>
                      <input
                        id="my-score"
                        ref={score1Ref}
                        type="number"
                        min={0}
                        value={myScore}
                        onChange={(e) => setMyScore(e.target.value)}
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="opp-score" className="block text-sm text-(--text-muted) mb-1 text-center">
                        상대 점수
                      </label>
                      <input
                        id="opp-score"
                        type="number"
                        min={0}
                        value={oppScore}
                        onChange={(e) => setOppScore(e.target.value)}
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
                </>
              )}
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
              {saving ? '처리 중...' : isOfficerOverride ? '확정' : '결과 제출'}
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

'use client'

import { useState, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { createAwards } from '@/lib/awards/actions'

type AwardRank = '우승' | '준우승' | '공동3위' | '3위'
type GameType = '단체전' | '개인전'

const AWARD_RANKS: AwardRank[] = ['우승', '준우승', '공동3위', '3위']
const GAME_TYPES: GameType[] = ['개인전', '단체전']

interface Form {
  year: string
  competition: string
  division: string
  game_type: GameType
  award_rank: AwardRank
  club_name: string
}

const DEFAULT_FORM: Form = {
  year: String(new Date().getFullYear()),
  competition: '',
  division: '',
  game_type: '개인전',
  award_rank: '우승',
  club_name: '',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  /** 자동완성용 기존 대회명 목록 */
  competitions: string[]
}

export function AwardRegisterModal({ isOpen, onClose, onCreated, competitions }: Props) {
  const [form, setForm] = useState<Form>(DEFAULT_FORM)
  const [players, setPlayers] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })
  const playerInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const resetForm = () => {
    setForm(DEFAULT_FORM)
    setPlayers([''])
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const updatePlayer = (idx: number, value: string) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? value : p)))
  }

  const addPlayer = () => {
    setPlayers((prev) => [...prev, ''])
    // 다음 렌더 사이클에서 새 인풋에 포커스
    setTimeout(() => {
      playerInputRefs.current[players.length]?.focus()
    }, 50)
  }

  const removePlayer = (idx: number) => {
    if (players.length === 1) return
    setPlayers((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    const trimmedPlayers = players.map((p) => p.trim()).filter(Boolean)
    if (!trimmedPlayers.length) {
      setAlert({ isOpen: true, message: '선수 이름을 1명 이상 입력해주세요.' })
      return
    }
    if (!form.competition.trim()) {
      setAlert({ isOpen: true, message: '대회명을 입력해주세요.' })
      return
    }
    if (!form.division.trim()) {
      setAlert({ isOpen: true, message: '부문을 입력해주세요.' })
      return
    }
    const year = Number(form.year)
    if (!year || year < 1990 || year > 2100) {
      setAlert({ isOpen: true, message: '올바른 연도를 입력해주세요.' })
      return
    }

    setSaving(true)
    const result = await createAwards({
      year,
      competition: form.competition.trim(),
      division: form.division.trim(),
      game_type: form.game_type,
      award_rank: form.award_rank,
      club_name: form.club_name.trim() || null,
      players: trimmedPlayers,
    })
    setSaving(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error })
      return
    }

    setToast({ isOpen: true, message: `${trimmedPlayers.length}명의 수상자가 등록되었습니다.` })
    resetForm()
    onCreated()
    onClose()
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="수상자 등록"
        size="md"
      >
        <Modal.Body>
          <div className="space-y-4">
            {/* 연도 + 순위 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="award-year"
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  연도 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="award-year"
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  min={1990}
                  max={2100}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="award-rank"
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  순위 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <select
                  id="award-rank"
                  value={form.award_rank}
                  onChange={(e) => setForm({ ...form, award_rank: e.target.value as AwardRank })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {AWARD_RANKS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 대회명 */}
            <div>
              <label
                htmlFor="award-competition"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                대회명 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="award-competition"
                type="text"
                list="competition-list"
                value={form.competition}
                onChange={(e) => setForm({ ...form, competition: e.target.value })}
                placeholder="예: 37회 마포구청장기"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              />
              <datalist id="competition-list">
                {competitions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* 부문 + 종목 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="award-division"
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  부문 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="award-division"
                  type="text"
                  value={form.division}
                  onChange={(e) => setForm({ ...form, division: e.target.value })}
                  placeholder="예: A부, 남자부"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="award-game-type"
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  종목
                </label>
                <select
                  id="award-game-type"
                  value={form.game_type}
                  onChange={(e) => setForm({ ...form, game_type: e.target.value as GameType })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {GAME_TYPES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 클럽명 */}
            <div>
              <label
                htmlFor="award-club"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                클럽명 <span className="font-normal">(선택)</span>
              </label>
              <input
                id="award-club"
                type="text"
                value={form.club_name}
                onChange={(e) => setForm({ ...form, club_name: e.target.value })}
                placeholder="예: 마포테니스클럽"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              />
            </div>

            {/* 선수 목록 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  선수 이름 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  <span className="ml-1 font-normal">(1명당 레코드 1개 생성)</span>
                </label>
                <button
                  type="button"
                  onClick={addPlayer}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{
                    color: 'var(--accent-color)',
                    border: '1px solid var(--accent-color)',
                  }}
                >
                  <Plus className="w-3 h-3" />
                  선수 추가
                </button>
              </div>
              <div className="space-y-2">
                {players.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      ref={(el) => { playerInputRefs.current[idx] = el }}
                      type="text"
                      value={name}
                      onChange={(e) => updatePlayer(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addPlayer()
                        }
                      }}
                      placeholder={`선수 ${idx + 1}`}
                      className="flex-1 px-3 py-2 rounded-lg text-sm"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removePlayer(idx)}
                      disabled={players.length === 1}
                      aria-label="선수 삭제"
                      className="p-1.5 rounded-lg transition-colors"
                      style={{
                        color: players.length === 1 ? 'var(--text-muted)' : 'var(--color-danger)',
                        opacity: players.length === 1 ? 0.4 : 1,
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Enter 키로 선수 추가 가능
              </p>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 btn-primary btn-sm"
          >
            {saving ? '등록 중...' : `${players.filter((p) => p.trim()).length}명 등록`}
          </button>
        </Modal.Footer>
      </Modal>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type="success"
      />
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title="입력 오류"
        message={alert.message}
        type="error"
      />
    </>
  )
}

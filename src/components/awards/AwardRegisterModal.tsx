'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, X, ChevronsUpDown, Check } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createAwards, getClubMembersForAwards, type TournamentOption } from '@/lib/awards/actions'

type AwardRank = '우승' | '준우승' | '공동3위' | '3위'
type GameType = '단체전' | '개인전'

const AWARD_RANKS: AwardRank[] = ['우승', '준우승', '공동3위', '3위']

function toGameType(matchType: string | null): GameType {
  if (matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES') return '단체전'
  return '개인전'
}

interface ClubOption { id: string; name: string }

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  tournaments: TournamentOption[]
  clubs: ClubOption[]
}

export function AwardRegisterModal({ isOpen, onClose, onCreated, tournaments, clubs }: Props) {
  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [selectedDivisionId, setSelectedDivisionId] = useState('')
  const [awardRank, setAwardRank] = useState<AwardRank>('우승')
  const [clubOpen, setClubOpen] = useState(false)
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const [clubMembers, setClubMembers] = useState<Array<{ id: string; name: string }>>([])
  const [players, setPlayers] = useState<string[]>([''])
  // 열려 있는 선수 컴보박스 인덱스 (null = 모두 닫힘)
  const [openPlayerIdx, setOpenPlayerIdx] = useState<number | null>(null)
  // 컴보박스 CommandInput에서 입력 중인 임시 값 (확정 전)
  const [tempInput, setTempInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })
  const lastAddedAtRef = useRef(0)

  const tournament = tournaments.find((t) => t.id === selectedTournamentId) ?? null
  const division = tournament?.divisions.find((d) => d.id === selectedDivisionId) ?? null
  const gameType: GameType = toGameType(tournament?.match_type ?? null)
  const selectedClub = clubs.find((c) => c.id === selectedClubId) ?? null

  useEffect(() => { setSelectedDivisionId('') }, [selectedTournamentId])

  useEffect(() => {
    if (!selectedClubId) { setClubMembers([]); return }
    getClubMembersForAwards(selectedClubId).then(setClubMembers)
  }, [selectedClubId])

  const resetForm = () => {
    setSelectedTournamentId('')
    setSelectedDivisionId('')
    setAwardRank('우승')
    setSelectedClubId('')
    setClubMembers([])
    setPlayers([''])
    setOpenPlayerIdx(null)
  }

  const handleClose = () => { resetForm(); onClose() }

  const updatePlayer = (idx: number, value: string) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? value : p)))
  }

  const addPlayer = () => {
    const now = Date.now()
    if (now - lastAddedAtRef.current < 200) return
    lastAddedAtRef.current = now
    const newIdx = players.length
    setPlayers((prev) => [...prev, ''])
    // 새 선수 컴보박스 자동 열기
    setTimeout(() => {
      setTempInput('')
      setOpenPlayerIdx(newIdx)
    }, 50)
  }

  const removePlayer = (idx: number) => {
    if (players.length === 1) return
    setPlayers((prev) => prev.filter((_, i) => i !== idx))
    setOpenPlayerIdx(null)
  }

  const openPlayerCombobox = (idx: number) => {
    setTempInput('')
    setOpenPlayerIdx(idx)
  }

  const confirmDirectInput = (idx: number) => {
    // tempInput이 있으면 그 값으로, 없으면 기존 이름 유지
    if (tempInput.trim()) updatePlayer(idx, tempInput.trim())
    setOpenPlayerIdx(null)
  }

  const handleSubmit = async () => {
    if (!tournament) { setAlert({ isOpen: true, message: '대회를 선택해주세요.' }); return }
    if (!division) { setAlert({ isOpen: true, message: '부문을 선택해주세요.' }); return }
    const trimmedPlayers = players.map((p) => p.trim()).filter(Boolean)
    if (!trimmedPlayers.length) {
      setAlert({ isOpen: true, message: '선수 이름을 1명 이상 입력해주세요.' })
      return
    }

    setSaving(true)
    const result = await createAwards({
      year: tournament.year,
      competition: tournament.title,
      division: division.name,
      game_type: gameType,
      award_rank: awardRank,
      club_name: selectedClub?.name ?? null,
      players: trimmedPlayers,
      tournament_id: tournament.id,
      division_id: division.id,
    })
    setSaving(false)

    if (result.error) { setAlert({ isOpen: true, message: result.error }); return }

    setToast({ isOpen: true, message: `${trimmedPlayers.length}명의 수상자가 등록되었습니다.` })
    resetForm()
    onCreated()
    onClose()
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="수상자 등록" size="md">
        <Modal.Body>
          <div className="space-y-4">
            {/* 대회 선택 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                대회 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                <SelectTrigger
                  className="w-full text-sm"
                  style={{ ...inputStyle, color: selectedTournamentId ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <SelectValue placeholder="대회를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.year}년 · {t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 부문 선택 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                부문 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId} disabled={!tournament}>
                <SelectTrigger
                  className="w-full text-sm"
                  style={{ ...inputStyle, color: selectedDivisionId ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <SelectValue placeholder={tournament ? '부문을 선택하세요' : '대회 선택 후 표시됩니다'} />
                </SelectTrigger>
                <SelectContent>
                  {tournament?.divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 대회 정보 요약 */}
            {tournament && division && (
              <div
                className="flex flex-wrap gap-3 px-3 py-2.5 rounded-lg text-xs"
                style={{ backgroundColor: 'var(--bg-card-hover)' }}
              >
                <span style={{ color: 'var(--text-muted)' }}>{tournament.year}년</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-secondary)' }}>{tournament.title}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-secondary)' }}>{division.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--court-info)' }}>{gameType}</span>
              </div>
            )}

            {/* 순위 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                순위 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AWARD_RANKS.map((rank) => (
                  <button
                    key={rank}
                    type="button"
                    onClick={() => setAwardRank(rank)}
                    className="py-2 rounded-lg text-sm font-medium transition-colors"
                    style={
                      awardRank === rank
                        ? { backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }
                        : { backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }
                    }
                  >
                    {rank}
                  </button>
                ))}
              </div>
            </div>

            {/* 클럽 선택 (컴보박스) */}
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                클럽 <span className="font-normal">(선택)</span>
              </p>
              <Popover open={clubOpen} onOpenChange={setClubOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={clubOpen}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left"
                    style={{ ...inputStyle, color: selectedClub ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    <span className="truncate">{selectedClub ? selectedClub.name : '클럽을 선택하세요'}</span>
                    <ChevronsUpDown className="w-4 h-4 shrink-0 ml-2 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-[var(--radix-popover-trigger-width)]"
                  align="start"
                  style={{ backgroundColor: 'white', border: '1px solid var(--border-color)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                >
                  <Command style={{ backgroundColor: 'white' }}>
                    <CommandInput placeholder="클럽 검색..." style={{ color: 'var(--text-primary)' }} />
                    <CommandList>
                      <CommandEmpty className="text-gray-400">검색 결과가 없습니다</CommandEmpty>
                      <CommandGroup>
                        {selectedClubId && (
                          <CommandItem
                            value="__clear__"
                            onSelect={() => { setSelectedClubId(''); setClubOpen(false) }}
                            className="text-gray-400"
                          >
                            <X className="w-3.5 h-3.5 mr-2" />선택 해제
                          </CommandItem>
                        )}
                        {clubs.map((club) => (
                          <CommandItem
                            key={club.id}
                            value={club.name}
                            onSelect={() => { setSelectedClubId(club.id); setClubOpen(false) }}
                            className="text-gray-800"
                          >
                            <Check className="mr-2 w-4 h-4" style={{ opacity: selectedClubId === club.id ? 1 : 0 }} />
                            {club.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* 선수 목록 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  선수 이름 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  <span className="ml-1 font-normal">(1명당 레코드 1개)</span>
                </label>
                <button
                  type="button"
                  onClick={addPlayer}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ color: 'var(--accent-color)', border: '1px solid var(--accent-color)' }}
                >
                  <Plus className="w-3 h-3" />추가
                </button>
              </div>

              <div className="space-y-2">
                {players.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {/* 선수 컴보박스: 직접 입력 + 클럽 회원 선택 */}
                    <Popover
                      open={openPlayerIdx === idx}
                      onOpenChange={(open) => {
                        if (open) {
                          openPlayerCombobox(idx)
                        } else {
                          setOpenPlayerIdx(null)
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          role="combobox"
                          aria-expanded={openPlayerIdx === idx}
                          className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left"
                          style={{ ...inputStyle, color: name ? 'var(--text-primary)' : 'var(--text-muted)' }}
                        >
                          <span className="truncate">{name || `선수 ${idx + 1}`}</span>
                          <ChevronsUpDown className="w-4 h-4 shrink-0 ml-2 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="p-0 w-[var(--radix-popover-trigger-width)]"
                        align="start"
                        style={{ backgroundColor: 'white', border: '1px solid var(--border-color)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                      >
                        <Command
                          filter={(value, search) => {
                            if (value === '__direct__') return 1 // 직접 입력은 항상 표시
                            if (value.toLowerCase().includes(search.toLowerCase())) return 1
                            return 0
                          }}
                          style={{ backgroundColor: 'white' }}
                        >
                          <CommandInput
                            placeholder="이름 입력..."
                            onValueChange={setTempInput}
                            style={{ color: '#111' }}
                          />
                          <CommandList>
                            <CommandGroup>
                              {/* 직접 입력 — 항상 첫 번째 */}
                              <CommandItem
                                value="__direct__"
                                onSelect={() => confirmDirectInput(idx)}
                                className="text-gray-800"
                              >
                                <span className="font-medium">직접 입력</span>
                                {(tempInput || name) && (
                                  <span className="ml-2 text-gray-400 truncate">
                                    &ldquo;{tempInput || name}&rdquo;
                                  </span>
                                )}
                              </CommandItem>

                              {/* 클럽 회원 목록 */}
                              {clubMembers.map((m) => (
                                <CommandItem
                                  key={m.id}
                                  value={m.name}
                                  onSelect={() => {
                                    updatePlayer(idx, m.name)
                                    setOpenPlayerIdx(null)
                                  }}
                                  className="text-gray-800"
                                >
                                  <Check
                                    className="mr-2 w-4 h-4"
                                    style={{ opacity: name === m.name ? 1 : 0 }}
                                  />
                                  {m.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>

                            {clubMembers.length === 0 && !tempInput && (
                              <p className="py-3 text-center text-xs text-gray-400">
                                {selectedClubId ? '회원이 없습니다' : '클럽 선택 시 회원 목록 표시'}
                              </p>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <button
                      type="button"
                      onClick={() => removePlayer(idx)}
                      disabled={players.length === 1}
                      aria-label="삭제"
                      className="p-1.5 rounded-lg shrink-0"
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

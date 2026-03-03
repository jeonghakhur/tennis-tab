'use client'

import { useState, useCallback, useEffect } from 'react'
import { Badge } from '@/components/common/Badge'
import { AlertDialog } from '@/components/common/AlertDialog'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createMatchResult,
  createAutoScheduleMatches,
  deleteMatchResult,
  deleteAllMatchResults,
  resolveMatchDispute,
} from '@/lib/clubs/session-actions'
import type { ClubMatchResult, SessionAttendanceDetail, MatchType } from '@/lib/clubs/types'
import SessionTimePicker from './SessionTimePicker'

interface BracketEditorProps {
  sessionId: string
  attendingMembers: SessionAttendanceDetail[]
  matches: ClubMatchResult[]
  courtNumbers: string[]
  onRefresh: () => void
}

// 기존 DB 레코드(doubles_men/women/mixed) 포함 모두 표시 가능하도록 Record<string>
const MATCH_TYPE_BADGES: Record<string, string> = {
  singles: '단식',
  doubles: '복식',
  doubles_men: '복식',
  doubles_women: '복식',
  doubles_mixed: '복식',
}

// shadcn Select는 빈 문자열 value 불가 → "none" 센티넬 사용
const NONE = 'none'
const toSelectVal = (v: string) => v || NONE
const fromSelectVal = (v: string) => (v === NONE ? '' : v)

export default function BracketEditor({
  sessionId,
  attendingMembers,
  matches,
  courtNumbers,
  onRefresh,
}: BracketEditorProps) {
  const [matchType, setMatchType] = useState<MatchType>('doubles')
  const [player1Id, setPlayer1Id] = useState('')
  const [player1bId, setPlayer1bId] = useState('')
  const [player2Id, setPlayer2Id] = useState('')
  const [player2bId, setPlayer2bId] = useState('')
  // 코트 1개이면 자동 선택
  const [courtNumber, setCourt] = useState(() => courtNumbers.length === 1 ? courtNumbers[0] : '')

  useEffect(() => {
    if (courtNumbers.length === 1) setCourt(courtNumbers[0])
  }, [courtNumbers])
  const [scheduledTime, setScheduledTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<{ isOpen: boolean; message: string; type: 'error' | 'success' | 'info' | 'warning' }>({ isOpen: false, message: '', type: 'error' })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [editingMatch, setEditingMatch] = useState<ClubMatchResult | null>(null)
  const [disputeMatch, setDisputeMatch] = useState<ClubMatchResult | null>(null)
  const [disputeP1Score, setDisputeP1Score] = useState('')
  const [disputeP2Score, setDisputeP2Score] = useState('')

  const isDoubles = matchType !== 'singles'

  // 자동 대진표 생성 (시간 슬롯 기반)
  const handleAutoSchedule = useCallback(async () => {
    if (attendingMembers.length < 2) {
      setAlert({ isOpen: true, message: '참석 확정 회원이 2명 이상 필요합니다.', type: 'error' })
      return
    }
    setSaving(true)
    const result = await createAutoScheduleMatches(sessionId)
    setSaving(false)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setAlert({ isOpen: true, message: `${result.count}경기가 자동 배정되었습니다.`, type: 'success' })
    onRefresh()
  }, [sessionId, attendingMembers.length, onRefresh])

  // 수동 1건 추가 / 수정
  const handleManualAdd = useCallback(async () => {
    if (!player1Id || !player2Id) {
      setAlert({ isOpen: true, message: '두 팀의 대표 선수를 모두 선택해주세요.', type: 'error' })
      return
    }
    if (isDoubles && (!player1bId || !player2bId)) {
      setAlert({ isOpen: true, message: '복식은 각 팀 2명을 모두 선택해주세요.', type: 'error' })
      return
    }
    if (new Set([player1Id, player1bId, player2Id, player2bId].filter(Boolean)).size !== [player1Id, player1bId, player2Id, player2bId].filter(Boolean).length) {
      setAlert({ isOpen: true, message: '같은 선수를 중복 선택할 수 없습니다.', type: 'error' })
      return
    }

    setSaving(true)
    const result = await createMatchResult({
      session_id: sessionId,
      match_type: matchType,
      player1_member_id: player1Id,
      player2_member_id: player2Id,
      player1b_member_id: isDoubles ? player1bId : undefined,
      player2b_member_id: isDoubles ? player2bId : undefined,
      court_number: courtNumber || undefined,
      scheduled_time: scheduledTime || undefined,
    })
    setSaving(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setPlayer1Id(''); setPlayer1bId(''); setPlayer2Id(''); setPlayer2bId('')
    // 코트 1개면 자동선택 유지, 그 외엔 초기화
    setCourt(courtNumbers.length === 1 ? courtNumbers[0] : '')
    setScheduledTime('')
    setEditingMatch(null)
    onRefresh()
  }, [sessionId, matchType, player1Id, player1bId, player2Id, player2bId, courtNumber, scheduledTime, isDoubles, onRefresh])

  // 경기 수정 시작
  const handleEditMatch = useCallback((m: ClubMatchResult) => {
    setEditingMatch(m)
    // 기존 doubles_men/women/mixed 레코드는 doubles로 매핑
    const mt = m.match_type?.startsWith('doubles') ? 'doubles' : (m.match_type || 'singles')
    setMatchType(mt as MatchType)
    setPlayer1Id(m.player1_member_id || '')
    setPlayer1bId(m.player1b_member_id || '')
    setPlayer2Id(m.player2_member_id || '')
    setPlayer2bId(m.player2b_member_id || '')
    setCourt(m.court_number || '')
    // DB는 "HH:MM:SS" 포맷 가능 → SessionTimePicker는 "HH:MM" 필요
    setScheduledTime(m.scheduled_time ? m.scheduled_time.slice(0, 5) : '')
    // 폼으로 스크롤
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, [])

  // 경기 삭제
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    const result = await deleteMatchResult(deleteTarget)
    setDeleteTarget(null)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    onRefresh()
  }, [deleteTarget, onRefresh])

  // 전체 삭제
  const handleDeleteAll = useCallback(async () => {
    setSaving(true)
    const result = await deleteAllMatchResults(sessionId)
    setSaving(false)
    setDeleteAllConfirm(false)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setAlert({ isOpen: true, message: '전체 경기가 삭제되었습니다.', type: 'success' })
    onRefresh()
  }, [sessionId, onRefresh])

  // 분쟁 해결
  const handleResolveDispute = useCallback(async () => {
    if (!disputeMatch) return
    const p1 = Number(disputeP1Score)
    const p2 = Number(disputeP2Score)
    if (isNaN(p1) || isNaN(p2) || p1 < 0 || p2 < 0) {
      setAlert({ isOpen: true, message: '점수를 올바르게 입력해주세요.', type: 'error' })
      return
    }
    setSaving(true)
    const result = await resolveMatchDispute(disputeMatch.id, { player1_score: p1, player2_score: p2 })
    setSaving(false)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setDisputeMatch(null); setDisputeP1Score(''); setDisputeP2Score('')
    onRefresh()
  }, [disputeMatch, disputeP1Score, disputeP2Score, onRefresh])

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none focus:border-(--accent-color) text-base'
  const disputedMatches = matches.filter((m) => m.status === 'DISPUTED')

  // 선택된 선수를 제외한 참석자 목록
  const availableForField = (excludeIds: string[]) =>
    attendingMembers.filter((a) => !excludeIds.includes(a.club_member_id))

  return (
    <div className="space-y-4">
      {/* 참석 확정 목록 */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-base font-semibold text-(--text-primary) mb-3">
          참석 확정 ({attendingMembers.length}명)
        </h3>
        <div className="flex flex-wrap gap-2">
          {attendingMembers.map((a) => (
            <span
              key={a.club_member_id}
              className="px-3 py-1.5 rounded-md bg-(--bg-secondary) text-sm text-(--text-primary)"
            >
              {a.member.name}
              {a.member.gender === 'MALE'
                ? <span className="inline-block w-2 h-2 rounded-full bg-blue-400 ml-1 align-middle" aria-label="남성" />
                : a.member.gender === 'FEMALE'
                ? <span className="inline-block w-2 h-2 rounded-full bg-rose-400 ml-1 align-middle" aria-label="여성" />
                : null}
              {a.member.rating ? ` (${a.member.rating})` : ''}
              {(a.available_from || a.available_until) && (
                <span className="text-(--text-muted) ml-1 text-xs">
                  {a.available_from?.slice(0, 5)}{a.available_until ? `~${a.available_until.slice(0, 5)}` : ''}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* 자동 대진 생성 */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-base font-semibold text-(--text-primary) mb-1">자동 대진표 생성</h3>
        <p className="text-sm text-(--text-muted) mb-4">
          참석 가능 시간 기반으로 30분 단위 경기를 코트 수에 맞게 자동 배정합니다.
        </p>
        <button
          onClick={handleAutoSchedule}
          disabled={saving || attendingMembers.length < 2}
          className="w-full px-4 py-3 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold text-base disabled:opacity-50"
        >
          {saving ? '생성 중...' : `자동 생성 (${attendingMembers.length}명 / 코트 ${courtNumbers.length || '미지정'})`}
        </button>
      </div>

      {/* 수동 경기 추가 */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-base font-semibold text-(--text-primary) mb-4">
          {editingMatch ? '경기 수정' : '수동 추가'}
        </h3>
        <div className="space-y-4">
          {/* 경기 유형 */}
          <div>
            <label className="block text-sm font-medium text-(--text-muted) mb-1.5" htmlFor="match-type-select">경기 유형</label>
            <Select
              value={matchType}
              onValueChange={(v) => {
                setMatchType(v as MatchType)
                setPlayer1bId(''); setPlayer2bId('')
              }}
            >
              <SelectTrigger id="match-type-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">단식</SelectItem>
                <SelectItem value="doubles">복식</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 팀 1 */}
          <div className="p-3 rounded-lg border border-(--border-color) space-y-3">
            <div className="text-sm font-semibold text-(--text-muted)">팀 1</div>
            <div className={`grid gap-3 ${isDoubles ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label className="block text-sm font-medium text-(--text-muted) mb-1.5" htmlFor="player1-select">
                  {isDoubles ? '선수 1A' : '선수 1'}
                </label>
                <Select
                  value={toSelectVal(player1Id)}
                  onValueChange={(v) => setPlayer1Id(fromSelectVal(v))}
                >
                  <SelectTrigger id="player1-select" className="w-full">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>선택</SelectItem>
                    {availableForField([player1bId, player2Id, player2bId]).map((a) => (
                      <SelectItem key={a.club_member_id} value={a.club_member_id}>{a.member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isDoubles && (
                <div>
                  <label className="block text-sm font-medium text-(--text-muted) mb-1.5" htmlFor="player1b-select">선수 1B</label>
                  <Select
                    value={toSelectVal(player1bId)}
                    onValueChange={(v) => setPlayer1bId(fromSelectVal(v))}
                  >
                    <SelectTrigger id="player1b-select" className="w-full">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>선택</SelectItem>
                      {availableForField([player1Id, player2Id, player2bId]).map((a) => (
                        <SelectItem key={a.club_member_id} value={a.club_member_id}>{a.member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* 팀 2 */}
          <div className="p-3 rounded-lg border border-(--border-color) space-y-3">
            <div className="text-sm font-semibold text-(--text-muted)">팀 2</div>
            <div className={`grid gap-3 ${isDoubles ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label className="block text-sm font-medium text-(--text-muted) mb-1.5" htmlFor="player2-select">
                  {isDoubles ? '선수 2A' : '선수 2'}
                </label>
                <Select
                  value={toSelectVal(player2Id)}
                  onValueChange={(v) => setPlayer2Id(fromSelectVal(v))}
                >
                  <SelectTrigger id="player2-select" className="w-full">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>선택</SelectItem>
                    {availableForField([player1Id, player1bId, player2bId]).map((a) => (
                      <SelectItem key={a.club_member_id} value={a.club_member_id}>{a.member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isDoubles && (
                <div>
                  <label className="block text-sm font-medium text-(--text-muted) mb-1.5" htmlFor="player2b-select">선수 2B</label>
                  <Select
                    value={toSelectVal(player2bId)}
                    onValueChange={(v) => setPlayer2bId(fromSelectVal(v))}
                  >
                    <SelectTrigger id="player2b-select" className="w-full">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>선택</SelectItem>
                      {availableForField([player1Id, player1bId, player2Id]).map((a) => (
                        <SelectItem key={a.club_member_id} value={a.club_member_id}>{a.member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* 코트 + 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-(--text-muted) mb-1.5" htmlFor="court-select">코트 (선택)</label>
              {courtNumbers.length > 0 ? (
                <Select
                  value={toSelectVal(courtNumber)}
                  onValueChange={(v) => setCourt(fromSelectVal(v))}
                >
                  <SelectTrigger id="court-select" className="w-full">
                    <SelectValue placeholder="미지정" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>미지정</SelectItem>
                    {courtNumbers.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  id="court-select"
                  value={courtNumber}
                  onChange={(e) => setCourt(e.target.value)}
                  className={inputClass}
                  placeholder="코트 번호"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-(--text-muted) mb-1.5" htmlFor="scheduled-time">시간 (선택)</label>
              <SessionTimePicker
                value={scheduledTime}
                onChange={setScheduledTime}
                placeholder="미지정"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {editingMatch && (
              <button
                onClick={() => { setEditingMatch(null); setPlayer1Id(''); setPlayer1bId(''); setPlayer2Id(''); setPlayer2bId(''); setCourt(''); setScheduledTime('') }}
                className="px-4 py-3 rounded-lg bg-(--bg-secondary) text-(--text-primary) text-base border border-(--border-color)"
              >
                취소
              </button>
            )}
            <button
              onClick={handleManualAdd}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold text-base disabled:opacity-50"
            >
              {saving ? '처리 중...' : editingMatch ? '수정 저장' : '경기 추가'}
            </button>
          </div>
        </div>
      </div>

      {/* 분쟁 경기 */}
      {disputedMatches.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-base font-semibold text-rose-400 mb-3">분쟁 경기 ({disputedMatches.length}건)</h3>
          <div className="space-y-2">
            {disputedMatches.map((m) => (
              <div key={m.id} className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base text-(--text-primary)">
                    {m.player1?.name}{m.player1b ? ` / ${m.player1b.name}` : ''} vs {m.player2?.name}{m.player2b ? ` / ${m.player2b.name}` : ''}
                  </span>
                  <Badge variant="danger">분쟁</Badge>
                </div>
                <div className="text-sm text-(--text-muted) mb-3 space-y-1">
                  <div>{m.player1?.name}: {m.player1_reported_score_p1} - {m.player1_reported_score_p2}</div>
                  <div>{m.player2?.name}: {m.player2_reported_score_p1} - {m.player2_reported_score_p2}</div>
                </div>
                <button onClick={() => setDisputeMatch(m)} className="px-3 py-1.5 text-sm rounded-md bg-rose-500 text-white font-semibold">
                  분쟁 해결
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 생성된 경기 목록 */}
      {matches.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-(--text-primary)">생성된 경기 ({matches.length}건)</h3>
            <button
              onClick={() => setDeleteAllConfirm(true)}
              className="text-sm text-rose-400 hover:text-rose-300 border border-rose-400/30 px-2.5 py-1 rounded"
            >
              전체 삭제
            </button>
          </div>
          <div className="space-y-1">
            {matches.map((m) => {
              const typeBadge = MATCH_TYPE_BADGES[m.match_type || 'singles']
              return (
                <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-(--bg-card-hover)">
                  <span className="text-base text-(--text-primary)">
                    <span className="text-xs font-semibold mr-2 px-1.5 py-0.5 rounded bg-(--bg-secondary)">{typeBadge}</span>
                    {m.player1?.name}{m.player1b ? ` / ${m.player1b.name}` : ''} vs {m.player2?.name}{m.player2b ? ` / ${m.player2b.name}` : ''}
                    {m.court_number && <span className="text-sm text-(--text-muted) ml-2">[{m.court_number}]</span>}
                    {m.scheduled_time && <span className="text-sm text-(--text-muted) ml-1">{m.scheduled_time}</span>}
                  </span>
                  {m.status !== 'COMPLETED' && (
                    <div className="flex gap-2 ml-2 shrink-0">
                      <button onClick={() => handleEditMatch(m)} className="text-sm text-blue-400 hover:text-blue-300">수정</button>
                      <button onClick={() => setDeleteTarget(m.id)} className="text-sm text-rose-400 hover:text-rose-300">삭제</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 분쟁 해결 폼 */}
      {disputeMatch && (
        <div className="glass-card rounded-xl p-4 border border-rose-500/30">
          <h4 className="text-base font-semibold text-(--text-primary) mb-4">
            분쟁 해결: {disputeMatch.player1?.name}{disputeMatch.player1b ? ` / ${disputeMatch.player1b.name}` : ''} vs {disputeMatch.player2?.name}{disputeMatch.player2b ? ` / ${disputeMatch.player2b.name}` : ''}
          </h4>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-(--text-muted) mb-1.5" htmlFor="dispute-p1-score">팀1 점수</label>
              <input id="dispute-p1-score" type="number" min={0} value={disputeP1Score} onChange={(e) => setDisputeP1Score(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-(--text-muted) mb-1.5" htmlFor="dispute-p2-score">팀2 점수</label>
              <input id="dispute-p2-score" type="number" min={0} value={disputeP2Score} onChange={(e) => setDisputeP2Score(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDisputeMatch(null)} className="flex-1 px-4 py-3 rounded-lg bg-(--bg-secondary) text-(--text-primary) text-base border border-(--border-color)">취소</button>
            <button onClick={handleResolveDispute} disabled={saving} className="flex-1 px-4 py-3 rounded-lg bg-rose-500 text-white font-semibold text-base disabled:opacity-50">{saving ? '처리 중...' : '확정'}</button>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} message="이 경기를 삭제하시겠습니까?" type="warning" />
      <ConfirmDialog isOpen={deleteAllConfirm} onConfirm={handleDeleteAll} onClose={() => setDeleteAllConfirm(false)} message={`생성된 경기 ${matches.length}건을 모두 삭제하시겠습니까?`} type="warning" />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} message={alert.message} type={alert.type} />
    </div>
  )
}

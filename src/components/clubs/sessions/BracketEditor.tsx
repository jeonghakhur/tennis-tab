'use client'

import { useState, useCallback, useEffect } from 'react'
import { Badge } from '@/components/common/Badge'
import { AlertDialog } from '@/components/common/AlertDialog'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import {
  createMatchResult,
  createRoundRobinMatches,
  createDoublesRoundRobinMatches,
  deleteMatchResult,
  resolveMatchDispute,
} from '@/lib/clubs/session-actions'
import type { ClubMatchResult, SessionAttendanceDetail, MatchType } from '@/lib/clubs/types'

interface BracketEditorProps {
  sessionId: string
  attendingMembers: SessionAttendanceDetail[]
  matches: ClubMatchResult[]
  courtNumbers: string[]
  onRefresh: () => void
}

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  singles: '단식',
  doubles_men: '남복',
  doubles_women: '여복',
  doubles_mixed: '혼복',
}

export default function BracketEditor({
  sessionId,
  attendingMembers,
  matches,
  courtNumbers,
  onRefresh,
}: BracketEditorProps) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [autoType, setAutoType] = useState<'singles' | 'doubles'>('singles')
  const [matchType, setMatchType] = useState<MatchType>('singles')
  const [player1Id, setPlayer1Id] = useState('')
  const [player1bId, setPlayer1bId] = useState('')
  const [player2Id, setPlayer2Id] = useState('')
  const [player2bId, setPlayer2bId] = useState('')
  const [courtNumber, setCourt] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [doublesPreview, setDoublesPreview] = useState<{ men: number; women: number; mixed: number; total: number } | null>(null)

  // 분쟁 해결
  const [disputeMatch, setDisputeMatch] = useState<ClubMatchResult | null>(null)
  const [disputeP1Score, setDisputeP1Score] = useState('')
  const [disputeP2Score, setDisputeP2Score] = useState('')

  const isDoubles = matchType !== 'singles'

  // 복식 미리보기 계산
  useEffect(() => {
    if (autoType !== 'doubles') { setDoublesPreview(null); return }
    const men = attendingMembers.filter((a) => a.member && (a.member as any).gender === 'MALE').length
    const women = attendingMembers.filter((a) => a.member && (a.member as any).gender === 'FEMALE').length
    const menPairs = Math.floor(men / 2)
    const womenPairs = Math.floor(women / 2)
    const menMatches = men >= 4 ? (menPairs * (menPairs - 1)) / 2 : 0
    const womenMatches = women >= 4 ? (womenPairs * (womenPairs - 1)) / 2 : 0
    const mixedTeams = (men >= 2 && women >= 2) ? Math.min(men, 4) * Math.min(women, 4) : 0
    const mixedMatches = mixedTeams > 1 ? (mixedTeams * (mixedTeams - 1)) / 2 : 0
    setDoublesPreview({ men: menMatches, women: womenMatches, mixed: mixedMatches, total: menMatches + womenMatches + mixedMatches })
  }, [autoType, attendingMembers])

  // 단식 라운드로빈 자동 생성
  const handleRoundRobin = useCallback(async () => {
    const memberIds = attendingMembers.map((a) => a.club_member_id)
    if (memberIds.length < 2) {
      setAlert({ isOpen: true, message: '참석 확정 회원이 2명 이상 필요합니다.', type: 'error' })
      return
    }
    setSaving(true)
    const result = await createRoundRobinMatches(sessionId, memberIds)
    setSaving(false)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setAlert({ isOpen: true, message: `${result.count}경기가 생성되었습니다.`, type: 'success' as 'error' })
    onRefresh()
  }, [sessionId, attendingMembers, onRefresh])

  // 복식 라운드로빈 자동 생성
  const handleDoublesRoundRobin = useCallback(async () => {
    const membersWithGender = attendingMembers.map((a) => ({
      id: a.club_member_id,
      gender: (a.member as any).gender || null,
    }))
    setSaving(true)
    const result = await createDoublesRoundRobinMatches(sessionId, membersWithGender)
    setSaving(false)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setAlert({ isOpen: true, message: `복식 ${result.count}경기 생성 완료! (남복 ${result.preview.men}, 여복 ${result.preview.women}, 혼복 ${result.preview.mixed})`, type: 'success' as 'error' })
    onRefresh()
  }, [sessionId, attendingMembers, onRefresh])

  // 수동 1건 추가
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
    setCourt(''); setScheduledTime('')
    onRefresh()
  }, [sessionId, matchType, player1Id, player1bId, player2Id, player2bId, courtNumber, scheduledTime, isDoubles, onRefresh])

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

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none focus:border-(--accent-color) text-sm'
  const disputedMatches = matches.filter((m) => m.status === 'DISPUTED')

  // 선택된 선수를 제외한 참석자 목록
  const usedIds = [player1Id, player1bId, player2Id, player2bId].filter(Boolean)
  const availableForField = (excludeIds: string[]) =>
    attendingMembers.filter((a) => !excludeIds.includes(a.club_member_id))

  return (
    <div className="space-y-4">
      {/* 참석 확정 목록 */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-(--text-primary) mb-2">
          참석 확정 ({attendingMembers.length}명)
        </h3>
        <div className="flex flex-wrap gap-2">
          {attendingMembers.map((a) => (
            <span
              key={a.club_member_id}
              className="px-2 py-1 rounded-md bg-(--bg-secondary) text-xs text-(--text-primary)"
            >
              {a.member.name}
              {(a.member as any).gender === 'MALE' ? ' 🔵' : (a.member as any).gender === 'FEMALE' ? ' 🔴' : ''}
              {a.member.rating ? ` (${a.member.rating})` : ''}
            </span>
          ))}
        </div>
      </div>

      {/* 대진 생성 모드 */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold text-(--text-primary)">대진 편성</h3>
          <div className="flex gap-1 p-0.5 rounded-md bg-(--bg-secondary)">
            {(['auto', 'manual'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  mode === m
                    ? 'bg-(--accent-color) text-(--bg-primary) font-semibold'
                    : 'text-(--text-muted)'
                }`}
              >
                {m === 'auto' ? '라운드로빈' : '수동 추가'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'auto' ? (
          <div className="space-y-3">
            {/* 단식 / 복식 탭 */}
            <div className="flex gap-1 p-0.5 rounded-md bg-(--bg-secondary) w-fit">
              {(['singles', 'doubles'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAutoType(t)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    autoType === t
                      ? 'bg-(--bg-card) text-(--text-primary) font-semibold shadow-sm'
                      : 'text-(--text-muted)'
                  }`}
                >
                  {t === 'singles' ? '🏃 단식' : '🎾 복식'}
                </button>
              ))}
            </div>

            {autoType === 'doubles' && doublesPreview && (
              <div className="p-3 rounded-lg bg-(--bg-secondary) text-xs text-(--text-secondary) space-y-1">
                <div className="font-semibold text-(--text-primary) mb-1">📊 생성 예정</div>
                {doublesPreview.men > 0 && <div>🔵 남복: {doublesPreview.men}경기</div>}
                {doublesPreview.women > 0 && <div>🔴 여복: {doublesPreview.women}경기</div>}
                {doublesPreview.mixed > 0 && <div>🎾 혼복: {doublesPreview.mixed}경기</div>}
                {doublesPreview.total === 0 && (
                  <div className="text-rose-400">남자 4명 이상, 여자 4명 이상 또는 각 2명 이상 필요</div>
                )}
                {doublesPreview.total > 0 && (
                  <div className="font-semibold text-(--accent-color)">합계: {doublesPreview.total}경기</div>
                )}
              </div>
            )}

            {autoType === 'singles' ? (
              <button
                onClick={handleRoundRobin}
                disabled={saving || attendingMembers.length < 2}
                className="w-full px-4 py-2 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold text-sm disabled:opacity-50"
              >
                {saving ? '생성 중...' : `단식 라운드로빈 (${attendingMembers.length}명)`}
              </button>
            ) : (
              <button
                onClick={handleDoublesRoundRobin}
                disabled={saving || !doublesPreview || doublesPreview.total === 0}
                className="w-full px-4 py-2 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold text-sm disabled:opacity-50"
              >
                {saving ? '생성 중...' : `복식 자동 생성 (${doublesPreview?.total || 0}경기)`}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* 경기 유형 선택 */}
            <div>
              <label className="block text-xs text-(--text-muted) mb-1">경기 유형</label>
              <select
                value={matchType}
                onChange={(e) => {
                  setMatchType(e.target.value as MatchType)
                  setPlayer1bId(''); setPlayer2bId('')
                }}
                className={inputClass}
              >
                <option value="singles">🏃 단식</option>
                <option value="doubles_men">🔵 남자 복식</option>
                <option value="doubles_women">🔴 여자 복식</option>
                <option value="doubles_mixed">🎾 혼합 복식</option>
              </select>
            </div>

            {/* 팀1 */}
            <div className="p-3 rounded-lg border border-(--border-color) space-y-2">
              <div className="text-xs font-semibold text-(--text-muted)">팀 1</div>
              <div className={`grid gap-2 ${isDoubles ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-xs text-(--text-muted) mb-1">
                    {isDoubles ? '선수 1A' : '선수 1'}
                  </label>
                  <select
                    value={player1Id}
                    onChange={(e) => setPlayer1Id(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">선택</option>
                    {availableForField([player1bId, player2Id, player2bId]).map((a) => (
                      <option key={a.club_member_id} value={a.club_member_id}>{a.member.name}</option>
                    ))}
                  </select>
                </div>
                {isDoubles && (
                  <div>
                    <label className="block text-xs text-(--text-muted) mb-1">선수 1B</label>
                    <select
                      value={player1bId}
                      onChange={(e) => setPlayer1bId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">선택</option>
                      {availableForField([player1Id, player2Id, player2bId]).map((a) => (
                        <option key={a.club_member_id} value={a.club_member_id}>{a.member.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* 팀2 */}
            <div className="p-3 rounded-lg border border-(--border-color) space-y-2">
              <div className="text-xs font-semibold text-(--text-muted)">팀 2</div>
              <div className={`grid gap-2 ${isDoubles ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-xs text-(--text-muted) mb-1">
                    {isDoubles ? '선수 2A' : '선수 2'}
                  </label>
                  <select
                    value={player2Id}
                    onChange={(e) => setPlayer2Id(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">선택</option>
                    {availableForField([player1Id, player1bId, player2bId]).map((a) => (
                      <option key={a.club_member_id} value={a.club_member_id}>{a.member.name}</option>
                    ))}
                  </select>
                </div>
                {isDoubles && (
                  <div>
                    <label className="block text-xs text-(--text-muted) mb-1">선수 2B</label>
                    <select
                      value={player2bId}
                      onChange={(e) => setPlayer2bId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">선택</option>
                      {availableForField([player1Id, player1bId, player2Id]).map((a) => (
                        <option key={a.club_member_id} value={a.club_member_id}>{a.member.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">코트 (선택)</label>
                {courtNumbers.length > 0 ? (
                  <select value={courtNumber} onChange={(e) => setCourt(e.target.value)} className={inputClass}>
                    <option value="">미지정</option>
                    {courtNumbers.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input value={courtNumber} onChange={(e) => setCourt(e.target.value)} className={inputClass} placeholder="코트 번호" />
                )}
              </div>
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">시간 (선택)</label>
                <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className={inputClass} />
              </div>
            </div>
            <button
              onClick={handleManualAdd}
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold text-sm disabled:opacity-50"
            >
              {saving ? '추가 중...' : '경기 추가'}
            </button>
          </div>
        )}
      </div>

      {/* 분쟁 경기 */}
      {disputedMatches.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-rose-400 mb-3">분쟁 경기 ({disputedMatches.length}건)</h3>
          <div className="space-y-2">
            {disputedMatches.map((m) => (
              <div key={m.id} className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-(--text-primary)">
                    {m.player1?.name}{m.player1b ? ` / ${m.player1b.name}` : ''} vs {m.player2?.name}{m.player2b ? ` / ${m.player2b.name}` : ''}
                  </span>
                  <Badge variant="danger">분쟁</Badge>
                </div>
                <div className="text-xs text-(--text-muted) mb-2 space-y-1">
                  <div>{m.player1?.name}: {m.player1_reported_score_p1} - {m.player1_reported_score_p2}</div>
                  <div>{m.player2?.name}: {m.player2_reported_score_p1} - {m.player2_reported_score_p2}</div>
                </div>
                <button onClick={() => setDisputeMatch(m)} className="px-3 py-1 text-xs rounded-md bg-rose-500 text-white font-semibold">
                  분쟁 해결
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기존 경기 목록 (삭제 가능) */}
      {matches.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-(--text-primary) mb-3">생성된 경기 ({matches.length}건)</h3>
          <div className="space-y-1">
            {matches.map((m) => {
              const typeLabel = MATCH_TYPE_LABELS[m.match_type || 'singles']
              return (
                <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-(--bg-card-hover)">
                  <span className="text-sm text-(--text-primary)">
                    <span className="text-xs text-(--text-muted) mr-1">[{typeLabel}]</span>
                    {m.player1?.name}{m.player1b ? ` / ${m.player1b.name}` : ''} vs {m.player2?.name}{m.player2b ? ` / ${m.player2b.name}` : ''}
                    {m.court_number && <span className="text-xs text-(--text-muted) ml-2">[{m.court_number}]</span>}
                  </span>
                  {m.status !== 'COMPLETED' && (
                    <button onClick={() => setDeleteTarget(m.id)} className="text-xs text-rose-400 hover:text-rose-300 ml-2 shrink-0">삭제</button>
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
          <h4 className="text-sm font-semibold text-(--text-primary) mb-3">
            분쟁 해결: {disputeMatch.player1?.name}{disputeMatch.player1b ? ` / ${disputeMatch.player1b.name}` : ''} vs {disputeMatch.player2?.name}{disputeMatch.player2b ? ` / ${disputeMatch.player2b.name}` : ''}
          </h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-(--text-muted) mb-1">팀1 점수</label>
              <input type="number" min={0} value={disputeP1Score} onChange={(e) => setDisputeP1Score(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-(--text-muted) mb-1">팀2 점수</label>
              <input type="number" min={0} value={disputeP2Score} onChange={(e) => setDisputeP2Score(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDisputeMatch(null)} className="flex-1 px-3 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) text-sm border border-(--border-color)">취소</button>
            <button onClick={handleResolveDispute} disabled={saving} className="flex-1 px-3 py-2 rounded-lg bg-rose-500 text-white font-semibold text-sm disabled:opacity-50">{saving ? '처리 중...' : '확정'}</button>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} message="이 경기를 삭제하시겠습니까?" type="warning" />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} message={alert.message} type={alert.type} />
    </div>
  )
}

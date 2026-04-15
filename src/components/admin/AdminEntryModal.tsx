'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { AlertDialog } from '@/components/common/AlertDialog'
import { adminUpdateEntry } from '@/lib/admin/entries'
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/utils/phone'
import type { MatchType, PartnerData, TeamMember } from '@/lib/supabase/types'
import type { Database } from '@/lib/supabase/types'

type Entry = Database['public']['Tables']['tournament_entries']['Row'] & {
  profiles: { name: string; email: string; phone: string | null; avatar_url: string | null; club: string | null } | null
  tournament_divisions: { name: string } | null
}

type Division = { id: string; name: string; max_teams: number | null }

interface AdminEntryModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  matchType: MatchType | null
  divisions: Division[]
  entry: Entry
}

type TeamMemberForm = { name: string; rating: string; club: string }

type FormState = {
  divisionId: string
  playerName: string
  phone: string
  clubName: string
  playerRating: string
  // 복식
  partnerName: string
  partnerClub: string
  partnerRating: string
  // 단체전
  applicantParticipates: boolean
  teamMembers: TeamMemberForm[]
}

export function AdminEntryModal({
  isOpen,
  onClose,
  tournamentId,
  matchType,
  divisions,
  entry,
}: AdminEntryModalProps) {
  const router = useRouter()
  const isTeamMatch = matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES'
  const isDoubles = matchType === 'INDIVIDUAL_DOUBLES'

  const [form, setForm] = useState<FormState>({
    divisionId: '',
    playerName: '',
    phone: '',
    clubName: '',
    playerRating: '',
    partnerName: '',
    partnerClub: '',
    partnerRating: '',
    applicantParticipates: true,
    teamMembers: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState<{ isOpen: boolean; message: string; type: 'error' | 'success' }>({
    isOpen: false, message: '', type: 'error',
  })

  // 모달 열릴 때 기존 데이터로 초기화
  useEffect(() => {
    if (!isOpen) return
    const partner = entry.partner_data as PartnerData | null
    const members = (entry.team_members as TeamMember[] | null) ?? []
    setForm({
      divisionId: entry.division_id,
      playerName: entry.player_name ?? '',
      phone: formatPhoneNumber(entry.phone || entry.profiles?.phone || ''),
      clubName: entry.club_name ?? '',
      playerRating: entry.player_rating != null ? String(entry.player_rating) : '',
      partnerName: partner?.name ?? '',
      partnerClub: partner?.club ?? '',
      partnerRating: partner?.rating != null ? String(partner.rating) : '',
      applicantParticipates: entry.applicant_participates !== false,
      teamMembers: members.map((m) => ({
        name: m.name,
        rating: m.rating != null ? String(m.rating) : '',
        club: (m as TeamMember & { club?: string }).club ?? '',
      })),
    })
  }, [isOpen, entry])

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const addTeamMember = () => set('teamMembers', [...form.teamMembers, { name: '', rating: '', club: '' }])
  const removeTeamMember = (idx: number) =>
    set('teamMembers', form.teamMembers.filter((_, i) => i !== idx))
  const updateTeamMember = (idx: number, field: keyof TeamMemberForm, value: string) =>
    set('teamMembers', form.teamMembers.map((m, i) => i === idx ? { ...m, [field]: value } : m))

  const showError = (message: string) => setAlert({ isOpen: true, message, type: 'error' })

  const validate = (): boolean => {
    if (!form.divisionId) { showError('참가 부서를 선택해주세요.'); return false }
    if (!form.playerName.trim()) { showError('이름을 입력해주세요.'); return false }
    if (!form.phone.trim()) { showError('전화번호를 입력해주세요.'); return false }
    if (isDoubles && !form.partnerName.trim()) { showError('파트너 이름을 입력해주세요.'); return false }
    if (isTeamMatch) {
      for (const [i, m] of form.teamMembers.entries()) {
        if (!m.name.trim()) { showError(`팀원 ${i + 1}의 이름을 입력해주세요.`); return false }
      }
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const result = await adminUpdateEntry(entry.id, tournamentId, {
        divisionId: form.divisionId,
        playerName: form.playerName,
        phone: unformatPhoneNumber(form.phone),
        clubName: form.clubName || null,
        playerRating: form.playerRating ? Number(form.playerRating) : null,
        partnerData: isDoubles && form.partnerName
          ? { name: form.partnerName, club: form.partnerClub, rating: Number(form.partnerRating) || 0 }
          : null,
        teamMembers: isTeamMatch
          ? form.teamMembers.map((m) => ({ name: m.name, rating: Number(m.rating) || 0, club: m.club || undefined }))
          : null,
        applicantParticipates: isTeamMatch ? form.applicantParticipates : true,
      })

      if (!result.success) {
        showError(result.error ?? '처리 중 오류가 발생했습니다.')
        return
      }

      router.refresh()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-(--border-color) bg-(--bg-primary) text-(--text-primary) text-sm focus:outline-none focus:border-(--accent-color) transition-colors'
  const labelClass = 'block text-sm font-medium text-(--text-secondary) mb-1'

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="참가자 정보 수정"
        size="lg"
        closeOnOverlayClick={false}
      >
        <Modal.Body>
          <div className="space-y-4">
            {/* 참가 부서 */}
            <div>
              <label className={labelClass}>참가 부서 *</label>
              <select
                value={form.divisionId}
                onChange={(e) => set('divisionId', e.target.value)}
                className={inputClass}
              >
                <option value="">부서 선택</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>이름 *</label>
                <input
                  type="text"
                  value={form.playerName}
                  onChange={(e) => set('playerName', e.target.value)}
                  className={inputClass}
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className={labelClass}>전화번호 *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', formatPhoneNumber(e.target.value))}
                  className={inputClass}
                  placeholder="010-0000-0000"
                />
              </div>
              <div>
                <label className={labelClass}>클럽</label>
                <input
                  type="text"
                  value={form.clubName}
                  onChange={(e) => set('clubName', e.target.value)}
                  className={inputClass}
                  placeholder="클럽명"
                />
              </div>
              <div>
                <label className={labelClass}>점수</label>
                <input
                  type="number"
                  value={form.playerRating}
                  onChange={(e) => set('playerRating', e.target.value)}
                  className={inputClass}
                  placeholder="0"
                  min={0}
                />
              </div>
            </div>

            {/* 복식: 파트너 정보 */}
            {isDoubles && (
              <div className="pt-3 border-t border-(--border-color)">
                <p className="text-sm font-semibold text-(--text-secondary) mb-3">파트너 정보</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>파트너 이름 *</label>
                    <input
                      type="text"
                      value={form.partnerName}
                      onChange={(e) => set('partnerName', e.target.value)}
                      className={inputClass}
                      placeholder="파트너 이름"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>파트너 클럽</label>
                    <input
                      type="text"
                      value={form.partnerClub}
                      onChange={(e) => set('partnerClub', e.target.value)}
                      className={inputClass}
                      placeholder="클럽명"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>파트너 점수</label>
                    <input
                      type="number"
                      value={form.partnerRating}
                      onChange={(e) => set('partnerRating', e.target.value)}
                      className={inputClass}
                      placeholder="0"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 단체전: 팀원 + 본인참가여부 */}
            {isTeamMatch && (
              <div className="pt-3 border-t border-(--border-color) space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-(--text-secondary)">팀원 목록</p>
                  <button
                    type="button"
                    onClick={addTeamMember}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-(--accent-color) text-white"
                  >
                    <Plus className="w-3 h-3" />
                    팀원 추가
                  </button>
                </div>
                {form.teamMembers.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-end">
                    <div>
                      {idx === 0 && <label className={labelClass}>이름</label>}
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => updateTeamMember(idx, 'name', e.target.value)}
                        className={inputClass}
                        placeholder="팀원 이름"
                      />
                    </div>
                    <div>
                      {idx === 0 && <label className={labelClass}>클럽</label>}
                      <input
                        type="text"
                        value={m.club}
                        onChange={(e) => updateTeamMember(idx, 'club', e.target.value)}
                        className={inputClass}
                        placeholder="클럽명"
                      />
                    </div>
                    <div>
                      {idx === 0 && <label className={labelClass}>점수</label>}
                      <input
                        type="number"
                        value={m.rating}
                        onChange={(e) => updateTeamMember(idx, 'rating', e.target.value)}
                        className={inputClass}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTeamMember(idx)}
                      className="p-2 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label="팀원 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* 본인 참가 여부 */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.applicantParticipates}
                    onChange={(e) => set('applicantParticipates', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-(--text-primary)">신청자 본인도 선수로 참가</span>
                </label>
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg bg-(--bg-secondary) text-(--text-secondary) text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-40"
          >
            {submitting ? '처리 중...' : '수정'}
          </button>
        </Modal.Footer>
      </Modal>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert((a) => ({ ...a, isOpen: false }))}
        title="입력 오류"
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}

'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ClubOption } from '@/lib/finance/actions'
import { upsertClubAlias, deleteClubAlias } from '@/lib/finance/actions'
import { ClubCombobox } from '../ClubCombobox'

interface Props {
  aliases: Array<{ alias: string; club_id: string; club_name: string }>
  clubs: ClubOption[]
  onError: (m: string) => void
  onSuccess: (m: string) => void
}

/** 엑셀 비고·적요의 클럽 약칭 → 클럽 매핑 */
export function AliasSettings({ aliases, clubs, onError, onSuccess }: Props) {
  const [alias, setAlias] = useState('')
  const [clubId, setClubId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!alias.trim() || !clubId) return onError('별칭과 클럽을 모두 입력해주세요.')
    setSaving(true)
    const r = await upsertClubAlias(alias, clubId)
    setSaving(false)
    if (r.error) return onError(r.error)
    setAlias(''); setClubId(null)
    onSuccess('별칭이 저장되었습니다.')
  }
  const remove = async (a: string) => {
    const r = await deleteClubAlias(a)
    if (r.error) return onError(r.error)
    onSuccess('별칭이 삭제되었습니다.')
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-(--text-primary)">클럽 별칭</h2>
      <p className="text-sm text-(--text-muted)">엑셀 가져오기와 적요 자동 인식에 사용됩니다. 클럽 정식 이름과 같은 표기는 등록할 필요가 없습니다.</p>
      <div className="glass-card rounded-xl p-4 space-y-3">
        <form onSubmit={add} noValidate className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[10rem]">
            <label htmlFor="alias-input" className="block text-sm text-(--text-muted) mb-1">별칭</label>
            <input id="alias-input" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="예: 테마인" maxLength={30} className="input-field text-sm" />
          </div>
          <div className="flex-1 min-w-[12rem]">
            <span className="block text-sm text-(--text-muted) mb-1">클럽</span>
            <ClubCombobox clubs={clubs} value={clubId} onChange={setClubId} placeholder="클럽 선택" aria-label="별칭 대상 클럽" />
          </div>
          <button type="submit" disabled={saving} className="btn-secondary btn-sm flex items-center gap-1"><Plus className="w-4 h-4" />추가</button>
        </form>
        <ul className="flex flex-wrap gap-2">
          {aliases.map((a) => (
            <li key={a.alias} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-(--bg-secondary) text-sm text-(--text-primary)">
              <span className="font-medium">{a.alias}</span>
              <span className="text-(--text-muted)">→ {a.club_name}</span>
              <button type="button" onClick={() => remove(a.alias)} className="p-0.5 rounded hover:bg-(--bg-card) text-(--color-danger)" aria-label={`${a.alias} 별칭 삭제`}><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
          {aliases.length === 0 && <li className="text-sm text-(--text-muted)">등록된 별칭이 없습니다.</li>}
        </ul>
      </div>
    </section>
  )
}

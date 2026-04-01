'use client'

import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Badge } from '@/components/common/Badge'
import { Users } from 'lucide-react'

interface EntryItem {
  id: string
  player_name: string | null
  club_name: string | null
  status: string
  partner_data: { name: string; club?: string; rating?: number } | null
  team_members: Array<{ name: string; rating?: number; club?: string }> | null
  profile_name: string | null
  profile_club: string | null
}

interface Props {
  divisionName: string
  entries: EntryItem[]
  matchType: string
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'purple' | 'secondary' }> = {
  CONFIRMED:  { label: '승인',   variant: 'success' },
  PENDING:    { label: '대기',   variant: 'warning' },
  WAITLISTED: { label: '대기자', variant: 'purple' },
}

export function DivisionEntryButton({ divisionName, entries, matchType }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const isTeam    = matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES'
  const isDoubles = matchType === 'INDIVIDUAL_DOUBLES'

  const totalCount = entries.length

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
        }}
      >
        <Users className="w-3.5 h-3.5" />
        신청현황
        <span
          className="px-1.5 py-0.5 rounded text-xs font-semibold"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
        >
          {totalCount}
        </span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`${divisionName} 신청현황`}
        description={`총 ${totalCount}건`}
        size="lg"
      >
        <Modal.Body>
          {entries.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
              신청 내역이 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => {
                const name = entry.player_name || entry.profile_name || '-'
                const club = entry.club_name || entry.profile_club || '-'
                const statusCfg = STATUS_CONFIG[entry.status]

                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 px-4 py-3 rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {/* 순번 */}
                    <span
                      className="text-sm font-medium w-6 text-right shrink-0 mt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {index + 1}
                    </span>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          {name}
                        </span>
                        {club && club !== '-' && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {club}
                          </span>
                        )}
                        {statusCfg && (
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        )}
                      </div>

                      {/* 복식: 파트너 */}
                      {isDoubles && entry.partner_data && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          파트너: {entry.partner_data.name}
                          {entry.partner_data.club ? ` (${entry.partner_data.club})` : ''}
                        </p>
                      )}

                      {/* 단체전: 팀원 */}
                      {isTeam && entry.team_members && entry.team_members.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {entry.team_members.map((member, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded"
                              style={{
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {member.name}
                              {member.rating ? ` ${member.rating}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  )
}

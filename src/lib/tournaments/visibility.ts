import type { TournamentVisibility, UserRole } from '@/lib/supabase/types'
import type { BadgeVariant } from '@/components/common/Badge'
import { canManageTournaments } from '@/lib/auth/roles'

/** 공개 범위 목록 (셀렉트 옵션 순서 고정용) */
export const TOURNAMENT_VISIBILITIES: readonly TournamentVisibility[] = ['PUBLIC', 'UNLISTED', 'HIDDEN'] as const

export const DEFAULT_TOURNAMENT_VISIBILITY: TournamentVisibility = 'PUBLIC'

/** 공개 범위별 라벨·배지·설명 — 어드민 UI와 폼에서 공용 */
export const VISIBILITY_CONFIG: Record<
  TournamentVisibility,
  { label: string; description: string; variant: BadgeVariant }
> = {
  PUBLIC: {
    label: '공개',
    description: '메인·대회 목록·검색에 모두 노출됩니다.',
    variant: 'success',
  },
  UNLISTED: {
    label: '링크 공개',
    description: '목록에는 나오지 않지만 링크로 접근·신청할 수 있습니다.',
    variant: 'warning',
  },
  HIDDEN: {
    label: '비공개',
    description: '관리자만 볼 수 있습니다. 일반 사용자는 접근할 수 없습니다.',
    variant: 'secondary',
  },
}

/** 문자열을 TournamentVisibility로 안전하게 변환 (잘못된 값은 null) */
export function parseVisibility(value: unknown): TournamentVisibility | null {
  if (typeof value !== 'string') return null
  return (TOURNAMENT_VISIBILITIES as readonly string[]).includes(value)
    ? (value as TournamentVisibility)
    : null
}

/**
 * 대회 상세·대진표·신청 접근 가능 여부
 * - PUBLIC / UNLISTED: 누구나
 * - HIDDEN: 대회 관리 권한(MANAGER 이상)만
 */
export function canViewTournament(
  visibility: TournamentVisibility | null | undefined,
  role: UserRole | null | undefined
): boolean {
  if (visibility !== 'HIDDEN') return true
  return canManageTournaments(role)
}

/** 목록(메인·대회 일정·사이트맵·챗봇)에 노출되는지 — 관리자는 목록에서 전부 볼 수 있음 */
export function isListedTournament(
  visibility: TournamentVisibility | null | undefined,
  role: UserRole | null | undefined
): boolean {
  if (canManageTournaments(role)) return true
  return (visibility ?? DEFAULT_TOURNAMENT_VISIBILITY) === 'PUBLIC'
}

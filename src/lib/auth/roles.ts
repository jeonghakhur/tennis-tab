import type { UserRole } from '@/lib/supabase/types'

/**
 * 사용자 권한 레벨 정의
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
  RESTRICTED: 'RESTRICTED',
} as const

/**
 * 권한 설명
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN: '전체 시스템 관리자 - 모든 권한 보유, 다른 사용자 권한 변경 가능',
  ADMIN: '대회 관리자 - 대회 생성, 수정, 삭제 및 전체 참가자 관리',
  MANAGER: '대회 운영자 - 자신이 생성한 대회만 관리 가능',
  USER: '일반 사용자 - 대회 참가, 결과 등록',
  RESTRICTED: '제한 사용자 - 일부 서비스 이용이 제한됨',
}

/**
 * 권한 레벨 (숫자가 높을수록 높은 권한)
 */
const ROLE_LEVELS: Record<UserRole, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  MANAGER: 2,
  USER: 1,
  RESTRICTED: 0,
}

/**
 * 특정 권한 이상인지 확인
 */
export function hasMinimumRole(
  userRole: UserRole | null | undefined,
  requiredRole: UserRole
): boolean {
  if (!userRole) return false
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole]
}

/**
 * 대회 관리 권한 확인 (MANAGER 이상)
 */
export function canManageTournaments(role: UserRole | null | undefined): boolean {
  return hasMinimumRole(role, 'MANAGER')
}

/**
 * 전체 관리자 권한 확인 (ADMIN 이상)
 */
export function isAdmin(role: UserRole | null | undefined): boolean {
  return hasMinimumRole(role, 'ADMIN')
}

/**
 * 최고 관리자 권한 확인 (SUPER_ADMIN만)
 */
export function isSuperAdmin(role: UserRole | null | undefined): boolean {
  return role === 'SUPER_ADMIN'
}

/**
 * 권한 변경 가능 여부 확인
 */
export function canChangeRole(
  currentUserRole: UserRole | null | undefined,
  targetUserRole: UserRole | null | undefined,
  newRole: UserRole
): boolean {
  // SUPER_ADMIN만 권한 변경 가능
  if (!isSuperAdmin(currentUserRole)) return false

  // SUPER_ADMIN은 다른 SUPER_ADMIN의 권한을 변경할 수 없음 (자신 제외)
  if (targetUserRole === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
    return false
  }

  return true
}

/**
 * 권한 표시용 레이블
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: '최고 관리자',
  ADMIN: '관리자',
  MANAGER: '운영자',
  USER: '일반 사용자',
  RESTRICTED: '제한 사용자',
}

/**
 * 권한 색상 (Tailwind 클래스)
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'text-red-500',
  ADMIN: 'text-orange-500',
  MANAGER: 'text-blue-500',
  USER: 'text-gray-500',
  RESTRICTED: 'text-rose-700',
}

/**
 * 제한 사용자 여부 확인
 */
export function isRestricted(role: UserRole | null | undefined): boolean {
  return role === 'RESTRICTED'
}

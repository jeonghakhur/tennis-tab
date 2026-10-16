import { describe, it, expect } from 'vitest'
import {
  parseVisibility,
  canViewTournament,
  isListedTournament,
  TOURNAMENT_VISIBILITIES,
} from '../visibility'

describe('parseVisibility', () => {
  it('유효한 값은 그대로 반환', () => {
    for (const v of TOURNAMENT_VISIBILITIES) {
      expect(parseVisibility(v)).toBe(v)
    }
  })

  it('잘못된 값·비문자열은 null', () => {
    expect(parseVisibility('public')).toBeNull()
    expect(parseVisibility('')).toBeNull()
    expect(parseVisibility(null)).toBeNull()
    expect(parseVisibility(undefined)).toBeNull()
    expect(parseVisibility(1)).toBeNull()
  })
})

describe('canViewTournament (상세·대진표·신청 접근)', () => {
  it('PUBLIC/UNLISTED는 비로그인 포함 누구나', () => {
    expect(canViewTournament('PUBLIC', null)).toBe(true)
    expect(canViewTournament('UNLISTED', null)).toBe(true)
    expect(canViewTournament('UNLISTED', 'USER')).toBe(true)
  })

  it('HIDDEN은 MANAGER 이상만', () => {
    expect(canViewTournament('HIDDEN', null)).toBe(false)
    expect(canViewTournament('HIDDEN', 'USER')).toBe(false)
    expect(canViewTournament('HIDDEN', 'MANAGER')).toBe(true)
    expect(canViewTournament('HIDDEN', 'ADMIN')).toBe(true)
    expect(canViewTournament('HIDDEN', 'SUPER_ADMIN')).toBe(true)
  })

  it('visibility가 없으면(구 데이터) 공개로 취급', () => {
    expect(canViewTournament(null, null)).toBe(true)
    expect(canViewTournament(undefined, 'USER')).toBe(true)
  })
})

describe('isListedTournament (목록 노출)', () => {
  it('일반 사용자는 PUBLIC만', () => {
    expect(isListedTournament('PUBLIC', 'USER')).toBe(true)
    expect(isListedTournament('UNLISTED', 'USER')).toBe(false)
    expect(isListedTournament('HIDDEN', 'USER')).toBe(false)
    expect(isListedTournament('UNLISTED', null)).toBe(false)
  })

  it('관리자(MANAGER 이상)는 전부 목록에서 확인 가능', () => {
    expect(isListedTournament('UNLISTED', 'MANAGER')).toBe(true)
    expect(isListedTournament('HIDDEN', 'ADMIN')).toBe(true)
    expect(isListedTournament('HIDDEN', 'SUPER_ADMIN')).toBe(true)
  })

  it('visibility가 없으면 PUBLIC으로 간주', () => {
    expect(isListedTournament(null, 'USER')).toBe(true)
  })
})

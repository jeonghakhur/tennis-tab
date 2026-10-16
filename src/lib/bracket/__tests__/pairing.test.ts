import { describe, it, expect } from 'vitest'
import {
  buildAutoPairs,
  summarizePairing,
  formatPairingEntryLabel,
  type SoloPairingEntry,
} from '../pairing'

function entry(id: string, rating: number | null, extra: Partial<SoloPairingEntry> = {}): SoloPairingEntry {
  return {
    id,
    player_name: `선수${id}`,
    club_name: null,
    player_rating: rating,
    partner_data: null,
    paired_into_entry_id: null,
    ...extra,
  }
}

/** 결정적 rng: 0 → 셔플이 항상 역순 회전 없이 안정적 결과 */
const zeroRng = () => 0

describe('buildAutoPairs', () => {
  it('2명 미만이면 페어 없이 남는 1명만 반환한다', () => {
    expect(buildAutoPairs([], 'RANDOM')).toEqual({ pairs: [], leftover: null })
    const only = entry('a', 4)
    expect(buildAutoPairs([only], 'RATING_BALANCED')).toEqual({ pairs: [], leftover: only })
  })

  it('RANDOM: 짝수 인원은 모두 편성되고 id가 중복되지 않는다', () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(String(i), i))
    const { pairs, leftover } = buildAutoPairs(entries, 'RANDOM')
    expect(pairs).toHaveLength(4)
    expect(leftover).toBeNull()
    const ids = pairs.flatMap((p) => [p.captain.id, p.partner.id])
    expect(new Set(ids).size).toBe(8)
  })

  it('RANDOM: 홀수 인원은 1명이 남는다', () => {
    const entries = Array.from({ length: 7 }, (_, i) => entry(String(i), null))
    const { pairs, leftover } = buildAutoPairs(entries, 'RANDOM', zeroRng)
    expect(pairs).toHaveLength(3)
    expect(leftover).not.toBeNull()
    const ids = new Set([...pairs.flatMap((p) => [p.captain.id, p.partner.id]), leftover!.id])
    expect(ids.size).toBe(7)
  })

  it('RATING_BALANCED: 상위와 하위를 짝짓고 대표는 점수가 높은 쪽이다', () => {
    const entries = [entry('a', 3.0), entry('b', 5.0), entry('c', 4.0), entry('d', 2.0)]
    const { pairs, leftover } = buildAutoPairs(entries, 'RATING_BALANCED')
    expect(leftover).toBeNull()
    expect(pairs.map((p) => [p.captain.id, p.partner.id])).toEqual([
      ['b', 'd'], // 5.0 ↔ 2.0
      ['c', 'a'], // 4.0 ↔ 3.0
    ])
  })

  it('RATING_BALANCED: 점수 미입력자는 뒤로 정렬되고 홀수면 미입력자가 남는다', () => {
    const entries = [entry('x', null), entry('a', 4.5), entry('b', 3.5), entry('c', 4.0), entry('y', null)]
    const { pairs, leftover } = buildAutoPairs(entries, 'RATING_BALANCED')
    expect(leftover?.id).toBe('y')
    expect(pairs.map((p) => [p.captain.id, p.partner.id])).toEqual([
      ['a', 'x'], // 4.5 ↔ 미입력
      ['c', 'b'], // 4.0 ↔ 3.5
    ])
  })
})

describe('summarizePairing', () => {
  it('파트너 행의 paired_into_entry_id 로 쌍을 복원하고 나머지는 미편성으로 분류한다', () => {
    const captain = entry('cap', 4, { partner_data: { name: '선수par', club: '', rating: 0 } })
    const partner = entry('par', 3, { paired_into_entry_id: 'cap' })
    const solo = entry('solo', 2)
    const { pairs, unpaired, orphans } = summarizePairing([solo, partner, captain])
    expect(pairs).toEqual([{ captain, partner }])
    expect(unpaired).toEqual([solo])
    expect(orphans).toEqual([])
  })

  it('대표가 목록에 없는 파트너 행은 orphans 로 분리한다', () => {
    const orphan = entry('p', null, { paired_into_entry_id: 'missing' })
    const { pairs, unpaired, orphans } = summarizePairing([orphan])
    expect(pairs).toEqual([])
    expect(unpaired).toEqual([])
    expect(orphans).toEqual([orphan])
  })

  it('일반 복식처럼 partner_data 만 있고 파트너 행이 없으면 미편성으로 본다', () => {
    const doubles = entry('d', 4, { partner_data: { name: '외부', club: 'X', rating: 4 } })
    const { pairs, unpaired } = summarizePairing([doubles])
    expect(pairs).toEqual([])
    expect(unpaired).toEqual([doubles])
  })
})

describe('formatPairingEntryLabel', () => {
  it('클럽·점수 유무에 따라 괄호 내용을 조합한다', () => {
    expect(formatPairingEntryLabel({ player_name: '홍길동', club_name: null, player_rating: null })).toBe('홍길동')
    expect(formatPairingEntryLabel({ player_name: '홍길동', club_name: '마포', player_rating: null })).toBe('홍길동 (마포)')
    expect(formatPairingEntryLabel({ player_name: '홍길동', club_name: '마포', player_rating: 4 })).toBe('홍길동 (마포, 4점)')
    expect(formatPairingEntryLabel({ player_name: '홍길동', club_name: null, player_rating: 0 })).toBe('홍길동 (0점)')
  })
})

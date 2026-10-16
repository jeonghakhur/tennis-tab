/**
 * 개인 접수 부서 복식 페어 편성 — 순수 로직 (서버/클라이언트 공용, DB 접근 없음)
 *
 * 용어
 * - 대표(captain): partner_data 에 파트너 정보를 담고 대진표에 올라가는 엔트리
 * - 파트너(partner): paired_into_entry_id 로 대표를 가리키는 엔트리 (대진표 풀에서 제외)
 */

import type { PartnerData } from '@/lib/supabase/types'

export type PairingStrategy = 'RANDOM' | 'RATING_BALANCED'

export const PAIRING_STRATEGY_LABELS: Record<PairingStrategy, { label: string; description: string }> = {
  RANDOM: { label: '랜덤', description: '미편성 인원을 무작위로 2명씩 묶습니다.' },
  RATING_BALANCED: {
    label: '점수 균형',
    description: '점수 상위와 하위를 짝지어 팀 전력을 고르게 맞춥니다. 점수 미입력자는 뒤로 정렬됩니다.',
  },
}

/** 페어 편성 대상 엔트리 (조회 결과 공통 형태) */
export interface SoloPairingEntry {
  id: string
  player_name: string
  club_name: string | null
  player_rating: number | null
  partner_data: PartnerData | null
  paired_into_entry_id: string | null
}

export interface SoloPair<T extends SoloPairingEntry = SoloPairingEntry> {
  captain: T
  partner: T
}

export interface PairingSummary<T extends SoloPairingEntry = SoloPairingEntry> {
  pairs: SoloPair<T>[]
  /** 아직 페어가 없는 엔트리 (대표도 파트너도 아님) */
  unpaired: T[]
  /** 파트너 행이 가리키는 대표가 목록에 없는 경우 (데이터 불일치) */
  orphans: T[]
}

/**
 * 엔트리 목록을 편성된 쌍 / 미편성 / 고아로 분류
 * 대표 여부는 "나를 가리키는 파트너 행이 있는가"로 판정 (partner_data 만으로는 일반 복식과 구분 불가)
 */
export function summarizePairing<T extends SoloPairingEntry>(entries: T[]): PairingSummary<T> {
  const byId = new Map(entries.map((e) => [e.id, e]))
  const pairedIds = new Set<string>()
  const pairs: SoloPair<T>[] = []
  const orphans: T[] = []

  for (const entry of entries) {
    if (!entry.paired_into_entry_id) continue
    const captain = byId.get(entry.paired_into_entry_id)
    if (!captain) {
      orphans.push(entry)
      continue
    }
    pairs.push({ captain, partner: entry })
    pairedIds.add(captain.id)
    pairedIds.add(entry.id)
  }

  const unpaired = entries.filter((e) => !pairedIds.has(e.id) && !e.paired_into_entry_id)

  // 대표 이름순으로 안정 정렬 (화면 표시 일관성)
  pairs.sort((a, b) => a.captain.player_name.localeCompare(b.captain.player_name, 'ko'))

  return { pairs, unpaired, orphans }
}

export interface AutoPairResult<T> {
  pairs: Array<{ captain: T; partner: T }>
  /** 홀수 인원일 때 남는 1명 */
  leftover: T | null
}

/** Fisher-Yates — rng 주입으로 테스트 가능 */
function shuffleWith<T>(items: T[], rng: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** 점수 내림차순, 미입력(null)은 맨 뒤. 동점은 입력 순서 유지 */
function sortByRatingDesc<T extends { player_rating: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.player_rating === null && b.player_rating === null) return 0
    if (a.player_rating === null) return 1
    if (b.player_rating === null) return -1
    return b.player_rating - a.player_rating
  })
}

/**
 * 자동 페어 생성 (순수 함수)
 * - RANDOM: 셔플 후 인접 2명씩
 * - RATING_BALANCED: 점수 정렬 후 상위 i번째 ↔ 하위 i번째. 홀수면 최하위(또는 미입력)가 남음
 * 대표(captain)는 항상 앞쪽(점수 높은 쪽 / 셔플 순서 앞) 엔트리
 */
export function buildAutoPairs<T extends { id: string; player_rating: number | null }>(
  entries: T[],
  strategy: PairingStrategy,
  rng: () => number = Math.random,
): AutoPairResult<T> {
  if (entries.length < 2) {
    return { pairs: [], leftover: entries[0] ?? null }
  }

  if (strategy === 'RANDOM') {
    const shuffled = shuffleWith(entries, rng)
    const leftover = shuffled.length % 2 === 1 ? shuffled[shuffled.length - 1] : null
    const even = leftover ? shuffled.slice(0, -1) : shuffled
    const pairs: AutoPairResult<T>['pairs'] = []
    for (let i = 0; i < even.length; i += 2) {
      pairs.push({ captain: even[i], partner: even[i + 1] })
    }
    return { pairs, leftover }
  }

  // RATING_BALANCED
  const sorted = sortByRatingDesc(entries)
  const leftover = sorted.length % 2 === 1 ? sorted[sorted.length - 1] : null
  const even = leftover ? sorted.slice(0, -1) : sorted
  const half = even.length / 2
  const pairs: AutoPairResult<T>['pairs'] = []
  for (let i = 0; i < half; i++) {
    pairs.push({ captain: even[i], partner: even[even.length - 1 - i] })
  }
  return { pairs, leftover }
}

/** 표시용: "홍길동 (클럽, 4.0)" 형태. 클럽/점수 미입력은 생략 */
export function formatPairingEntryLabel(entry: Pick<SoloPairingEntry, 'player_name' | 'club_name' | 'player_rating'>): string {
  const extras = [entry.club_name, entry.player_rating !== null ? `${entry.player_rating}점` : null].filter(Boolean)
  return extras.length > 0 ? `${entry.player_name} (${extras.join(', ')})` : entry.player_name
}

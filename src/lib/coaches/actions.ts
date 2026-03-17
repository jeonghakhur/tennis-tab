'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeObject } from '@/lib/utils/validation'
import type { Coach, CreateCoachInput, UpdateCoachInput } from '@/lib/lessons/types'

function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

async function checkAdminAuth() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null }
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return { error: '관리자 권한이 필요합니다.', user: null }
  }
  return { error: null, user }
}

// ============================================================================
// 코치 CRUD
// ============================================================================

/** 코치 목록 조회 (활성 코치만) */
export async function getCoaches(): Promise<{ error: string | null; data: Coach[] }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coaches')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) return { error: '코치 목록 조회에 실패했습니다.', data: [] }
  return { error: null, data: data || [] }
}

/** 전체 코치 목록 (관리자용 — 비활성 포함) */
export async function getAllCoaches(): Promise<{ error: string | null; data: Coach[] }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coaches')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return { error: '코치 목록 조회에 실패했습니다.', data: [] }
  return { error: null, data: data || [] }
}

/** 코치 등록 */
export async function createCoach(
  data: CreateCoachInput
): Promise<{ error: string | null; data?: Coach }> {
  const { error: authErr, user } = await checkAdminAuth()
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  if (!data.name || data.name.trim().length < 2) {
    return { error: '코치 이름은 2자 이상이어야 합니다.' }
  }

  const sanitized = sanitizeObject(data)
  const admin = createAdminClient()

  const { data: coach, error } = await admin
    .from('coaches')
    .insert({
      name: sanitized.name,
      bio: sanitized.bio || null,
      experience: sanitized.experience || null,
      certifications: sanitized.certifications || [],
      certification_files: data.certification_files || [],
      profile_image_url: sanitized.profile_image_url || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: '코치 등록에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null, data: coach }
}

/** 코치 정보 수정 */
export async function updateCoach(
  coachId: string,
  data: UpdateCoachInput
): Promise<{ error: string | null }> {
  const idErr = validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const sanitized = sanitizeObject(data)
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (sanitized.name !== undefined) updateData.name = sanitized.name
  if (sanitized.bio !== undefined) updateData.bio = sanitized.bio || null
  if (sanitized.experience !== undefined) updateData.experience = sanitized.experience || null
  if (sanitized.certifications !== undefined) updateData.certifications = sanitized.certifications
  if (data.certification_files !== undefined) updateData.certification_files = data.certification_files
  if (sanitized.profile_image_url !== undefined) updateData.profile_image_url = sanitized.profile_image_url || null

  const admin = createAdminClient()
  const { error } = await admin
    .from('coaches')
    .update(updateData)
    .eq('id', coachId)

  if (error) return { error: '코치 정보 수정에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null }
}

// ============================================================================
// 공개 조회 (비로그인 가능)
// ============================================================================

/** 공개 코치 카드 데이터 (레슨 안내 메인용) */
export interface PublicCoachCard {
  id: string
  name: string
  bio: string | null
  certifications: string[]
  profileImageUrl: string | null
  /** 대표 프로그램 ID (가장 최신 OPEN) */
  programId: string | null
  sessionDurationMinutes: number | null
  /** 최저 요금 요약 (예: "주중 1회 120,000원~") */
  feeSummary: string | null
  /** 오늘 이후 OPEN 슬롯 수 */
  openSlotCount: number
}

/** 코치 공개 목록 — 비로그인도 조회 가능, OPEN 프로그램이 있는 활성 코치만 */
export async function getPublicCoaches(): Promise<{
  error: string | null
  data: PublicCoachCard[]
}> {
  const admin = createAdminClient()

  // 코치 기준으로 조회 (프로그램 없어도 표시)
  const { data: coaches, error: coachError } = await admin
    .from('coaches')
    .select('id, name, bio, certifications, profile_image_url, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (coachError) return { error: '코치 목록 조회에 실패했습니다.', data: [] }
  if (!coaches || coaches.length === 0) return { error: null, data: [] }

  // 각 코치의 대표 프로그램 조회 (OPEN + 노출 중만)
  const { data: programs, error } = await admin
    .from('lesson_programs')
    .select('*')
    .in('coach_id', coaches.map(c => c.id))
    .eq('status', 'OPEN')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })

  if (error) return { error: '코치 목록 조회에 실패했습니다.', data: [] }

  // 코치별 대표 프로그램 매핑
  const coachProgramMap = new Map<string, typeof programs[number]>()
  for (const p of programs || []) {
    if (!coachProgramMap.has(p.coach_id)) {
      coachProgramMap.set(p.coach_id, p)
    }
  }

  const representativePrograms = coaches
    .map(c => coachProgramMap.get(c.id))
    .filter(Boolean) as typeof programs
  const programIds = representativePrograms.map((p) => p.id)

  // OPEN 슬롯 수 집계
  const today = new Date().toISOString().substring(0, 10)
  const { data: slots } = await admin
    .from('lesson_slots')
    .select('program_id')
    .in('program_id', programIds)
    .eq('status', 'OPEN')
    .gte('slot_date', today)

  const slotCountMap = new Map<string, number>()
  for (const s of slots || []) {
    slotCountMap.set(s.program_id, (slotCountMap.get(s.program_id) || 0) + 1)
  }

  // 요금 요약 생성
  const FEE_FIELDS: Array<{ key: string; label: string }> = [
    { key: 'fee_weekday_1', label: '주중 1회' },
    { key: 'fee_weekday_2', label: '주중 2회' },
    { key: 'fee_weekend_1', label: '주말 1회' },
    { key: 'fee_weekend_2', label: '주말 2회' },
    { key: 'fee_mixed_2', label: '혼합 2회' },
  ]

  const cards: PublicCoachCard[] = coaches.map((coach) => {
    const p = coachProgramMap.get(coach.id)

    // 최저가 요약
    let feeSummary: string | null = null
    if (p) {
      let minAmount = Infinity
      let minLabel = ''
      for (const { key, label } of FEE_FIELDS) {
        const amount = (p as unknown as Record<string, unknown>)[key]
        if (typeof amount === 'number' && amount > 0 && amount < minAmount) {
          minAmount = amount
          minLabel = label
        }
      }
      if (minAmount < Infinity) {
        feeSummary = `${minLabel} ${minAmount.toLocaleString()}원~`
      }
    }

    return {
      id: coach.id,
      name: coach.name || '미정',
      bio: coach.bio || null,
      certifications: coach.certifications || [],
      profileImageUrl: coach.profile_image_url || null,
      programId: p?.id || null,
      sessionDurationMinutes: p?.session_duration_minutes || null,
      feeSummary,
      openSlotCount: p ? (slotCountMap.get(p.id) || 0) : 0,
    }
  })

  return { error: null, data: cards }
}

/** 공개 코치 상세 — 비로그인 접근 가능 */
export interface PublicCoachDetail {
  id: string
  name: string
  bio: string | null
  experience: string | null
  certifications: string[]
  profileImageUrl: string | null
  /** 연결된 OPEN 프로그램 */
  program: {
    id: string
    title: string
    sessionDurationMinutes: number
    feeWeekday1: number | null
    feeWeekday2: number | null
    feeWeekend1: number | null
    feeWeekend2: number | null
    feeMixed2: number | null
  } | null
  /** 이번 주 빈 슬롯 날짜들 (중복 제거) */
  availableDates: string[]
}

export async function getPublicCoachDetail(coachId: string): Promise<{
  error: string | null
  data: PublicCoachDetail | null
}> {
  const idErr = validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr, data: null }

  const admin = createAdminClient()

  // 코치 기본 정보
  const { data: coach, error: coachErr } = await admin
    .from('coaches')
    .select('*')
    .eq('id', coachId)
    .eq('is_active', true)
    .single()

  if (coachErr || !coach) return { error: '코치를 찾을 수 없습니다.', data: null }

  // 대표 OPEN 프로그램
  const { data: programs } = await admin
    .from('lesson_programs')
    .select('*')
    .eq('coach_id', coachId)
    .eq('status', 'OPEN')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(1)

  const prog = programs?.[0] || null

  // 이번 주 빈 슬롯 날짜
  const today = new Date()
  const todayStr = today.toISOString().substring(0, 10)
  // 이번 주 일요일까지
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()))
  const endStr = endOfWeek.toISOString().substring(0, 10)

  let availableDates: string[] = []
  if (prog) {
    const { data: slots } = await admin
      .from('lesson_slots')
      .select('slot_date')
      .eq('program_id', prog.id)
      .eq('status', 'OPEN')
      .gte('slot_date', todayStr)
      .lte('slot_date', endStr)
      .order('slot_date')

    // 중복 제거
    availableDates = [...new Set((slots || []).map((s) => s.slot_date))]
  }

  return {
    error: null,
    data: {
      id: coach.id,
      name: coach.name,
      bio: coach.bio,
      experience: coach.experience,
      certifications: coach.certifications || [],
      profileImageUrl: coach.profile_image_url,
      program: prog
        ? {
            id: prog.id,
            title: prog.title,
            sessionDurationMinutes: prog.session_duration_minutes,
            feeWeekday1: prog.fee_weekday_1,
            feeWeekday2: prog.fee_weekday_2,
            feeWeekend1: prog.fee_weekend_1,
            feeWeekend2: prog.fee_weekend_2,
            feeMixed2: prog.fee_mixed_2,
          }
        : null,
      availableDates,
    },
  }
}

/** 코치 삭제 */
export async function deleteCoach(coachId: string): Promise<{ error: string | null }> {
  const idErr = validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { error } = await admin.from('coaches').delete().eq('id', coachId)

  if (error) return { error: '코치 삭제에 실패했습니다. 연결된 프로그램이 있는지 확인해주세요.' }

  revalidatePath('/lessons')
  return { error: null }
}

/** 코치 비활성화 */
export async function deactivateCoach(coachId: string): Promise<{ error: string | null }> {
  const idErr = validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { error } = await admin
    .from('coaches')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', coachId)

  if (error) return { error: '코치 비활성화에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null }
}


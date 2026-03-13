import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

/** Vercel Cron이 매시간 호출 — 날짜 기반 대회 상태 자동 전환 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // CRON_SECRET으로 인증 (Vercel이 Authorization: Bearer <secret> 헤더 자동 주입)
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/tournament-status] CRON_SECRET 환경변수 미설정')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('auto_transition_tournament_status')

  if (error) {
    console.error('[cron/tournament-status] 실행 실패:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const transitions = (data ?? []) as Array<{
    id: string
    title: string
    old_status: string
    new_status: string
  }>

  if (transitions.length > 0) {
    console.info('[cron/tournament-status] 전환 완료:', transitions)

    // 상태 변경된 대회가 있을 때만 캐시 무효화
    revalidatePath('/')
    revalidatePath('/tournaments')
    for (const t of transitions) {
      revalidatePath(`/tournaments/${t.id}`)
    }
  }

  return NextResponse.json({
    ok: true,
    transitioned: transitions.length,
    details: transitions,
    timestamp: new Date().toISOString(),
  })
}

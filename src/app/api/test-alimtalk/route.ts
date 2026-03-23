import { NextResponse } from 'next/server'
import { sendTournamentConfirmAlimtalk } from '@/lib/solapi/alimtalk'

// 테스트용 임시 엔드포인트 (테스트 후 삭제)
export async function GET() {
  const result = await sendTournamentConfirmAlimtalk({
    playerPhone: '01085891858',
    playerName: '허정학',
    tournamentName: '마포구 테니스 협회 춘계 대회',
    divisionName: '남자 단식 A조',
    tournamentDate: '2026-04-15 09:00',
    venue: '망원 한강공원 테니스장',
    detailUrl: 'https://mapo-tennis.vercel.app',
  })

  return NextResponse.json(result)
}

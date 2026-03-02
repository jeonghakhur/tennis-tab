import { NextResponse } from 'next/server'
import { getMemberGameResults } from '@/lib/clubs/session-actions'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const clubId = searchParams.get('clubId') || '3084ca9f-c86c-4365-917a-b25cd36e2291'
  const memberId = searchParams.get('memberId') || '36b1d068-cc1f-4a87-bac6-3766f9f4b3a6'
  const period = (searchParams.get('period') || 'all') as Parameters<typeof getMemberGameResults>[2]
  
  const result = await getMemberGameResults(clubId, memberId, period)
  return NextResponse.json({ count: result.results.length, stats: result.stats, first: result.results[0] })
}

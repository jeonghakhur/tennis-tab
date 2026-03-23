import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    hasApiKey: !!process.env.SOLAPI_API_KEY,
    hasApiSecret: !!process.env.SOLAPI_API_SECRET,
    hasPfId: !!process.env.SOLAPI_PFID,
    hasSender: !!process.env.SOLAPI_SENDER_NUMBER,
    hasTournamentConfirm: !!process.env.SOLAPI_TEMPLATE_TOURNAMENT_CONFIRM,
    templateTournamentConfirm: process.env.SOLAPI_TEMPLATE_TOURNAMENT_CONFIRM,
    pfId: process.env.SOLAPI_PFID,
    sender: process.env.SOLAPI_SENDER_NUMBER,
  })
}

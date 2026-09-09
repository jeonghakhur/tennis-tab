import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient, getVerifiedUser } from '@/lib/supabase/server'
import { hasMinimumRole } from '@/lib/auth/roles'
import { parseSettlementWorkbook } from '@/lib/finance/excelImport'

const MAX_FILE_BYTES = 5 * 1024 * 1024

/** 결산서 엑셀 업로드 → 파싱 결과(JSON). DB 반영은 하지 않음 (미리보기·매핑용) */
export async function POST(request: Request) {
  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!hasMinimumRole(profile?.role, 'ADMIN')) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: '파일은 5MB 이하만 업로드할 수 있습니다.' }, { status: 400 })
  if (!/\.xlsx?$/i.test(file.name)) return NextResponse.json({ error: '엑셀(.xlsx) 파일만 업로드할 수 있습니다.' }, { status: 400 })

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const result = parseSettlementWorkbook(workbook, XLSX)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: '엑셀 파일을 읽을 수 없습니다. 결산서 양식인지 확인해주세요.' }, { status: 422 })
  }
}

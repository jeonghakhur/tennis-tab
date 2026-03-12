import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMyEntries } from '@/lib/data/user'
import { MyEntriesClient } from './MyEntriesClient'

export const metadata = {
  title: '내 신청 관리 | Tennis Tab',
  description: '참가 신청한 대회 목록을 확인하고 관리합니다.',
}

export default async function MyEntriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const entries = await getMyEntries()

  return <MyEntriesClient entries={entries} />
}

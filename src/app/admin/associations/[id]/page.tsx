import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { AssociationForm } from '@/components/associations/AssociationForm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Association } from '@/lib/associations/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function EditAssociationPage({ params, searchParams }: Props) {
  const { id } = await params
  const { q } = await searchParams
  const listUrl = q ? `/admin/associations?q=${encodeURIComponent(q)}` : '/admin/associations'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/not-found')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isAdmin(profile?.role)) redirect('/admin')

  const admin = createAdminClient()
  const { data: association } = await admin
    .from('associations')
    .select('*')
    .eq('id', id)
    .single()

  if (!association) notFound()

  // 소유자 확인 (SUPER_ADMIN은 모두 접근 가능)
  if (profile?.role !== 'SUPER_ADMIN' && association.created_by !== user.id) {
    redirect('/admin/associations')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href={listUrl}
          className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">
            협회 수정
          </h1>
          <p className="text-(--text-secondary) mt-1">
            {association.name} 정보를 수정합니다.
          </p>
        </div>
      </div>

      <AssociationForm association={association as Association} returnUrl={listUrl} />
    </div>
  )
}

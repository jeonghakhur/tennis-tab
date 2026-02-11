import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { AssociationForm } from '@/components/associations/AssociationForm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewAssociationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/not-found')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isAdmin(profile?.role)) redirect('/admin')

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/associations"
          className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">
            협회 생성
          </h1>
          <p className="text-(--text-secondary) mt-1">
            새로운 협회를 생성합니다. (1인 1협회 제한)
          </p>
        </div>
      </div>

      <AssociationForm />
    </div>
  )
}

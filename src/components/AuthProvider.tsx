'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refresh: async () => {},
})

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  })
  const [supabase] = useState(() => createClient())
  const initializedRef = useRef(false)

  const initAuth = useCallback(async () => {
    try {
      // 서버에서 현재 사용자 정보 가져오기 (쿠키 기반)
      const { getCurrentUser } = await import('@/lib/auth/actions')
      const serverProfile = await getCurrentUser()

      if (serverProfile) {
        setAuthState({
          user: { id: serverProfile.id } as User,
          profile: serverProfile,
          loading: false,
        })
      } else {
        setAuthState({
          user: null,
          profile: null,
          loading: false,
        })
      }
    } catch (error) {
      console.error('[AuthProvider] initialization error:', error)
      setAuthState({
        user: null,
        profile: null,
        loading: false,
      })
    } finally {
      initializedRef.current = true
    }
  }, [])

  useEffect(() => {
    initAuth()

    // 인증 상태 변경 구독 (초기 로딩 후에만 반응)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // 초기 로딩이 완료되지 않았으면 무시
      if (!initializedRef.current) return

      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setAuthState({
          user: session.user,
          profile: profileData,
          loading: false,
        })
      } else {
        setAuthState({
          user: null,
          profile: null,
          loading: false,
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, initAuth])

  return (
    <AuthContext.Provider value={{ ...authState, refresh: initAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

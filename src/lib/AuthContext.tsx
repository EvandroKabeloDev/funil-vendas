import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from './supabase'

type AuthValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isGestor: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  session: null, profile: null, loading: true, isGestor: false, signOut: async () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let cancel = false
    async function loadProfile() {
      if (!session?.user) { setProfile(null); setLoading(false); return }
      const { data } = await supabase
        .from('profiles')
        .select('id, org_id, full_name, email, phone, role, is_active')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!cancel) { setProfile(data as Profile | null); setLoading(false) }
    }
    setLoading(true)
    loadProfile()
    return () => { cancel = true }
  }, [session])

  const value = useMemo<AuthValue>(() => ({
    session,
    profile,
    loading,
    isGestor: profile?.role === 'gestor',
    signOut: async () => { await supabase.auth.signOut() }
  }), [session, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

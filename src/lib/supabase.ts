import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------
// Configuracao em 2 camadas:
//  1) window.__ENV  -> gerado pelo container no boot (EasyPanel / producao)
//  2) import.meta.env -> arquivo .env (desenvolvimento local)
// Assim voce troca a URL/chave no painel sem precisar rebuildar a imagem.
// ---------------------------------------------------------------------
declare global {
  interface Window {
    __ENV?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }
  }
}

function readEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const runtime = typeof window !== 'undefined' ? window.__ENV?.[name] : undefined
  if (runtime && !runtime.startsWith('__')) return runtime
  return (import.meta.env[name] as string) ?? ''
}

const url = readEnv('VITE_SUPABASE_URL')
const key = readEnv('VITE_SUPABASE_ANON_KEY')

if (!url || !key) {
  throw new Error(
    'Configuracao ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ' +
      '(no .env em desenvolvimento, ou nas variaveis de ambiente do EasyPanel em producao).'
  )
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true, // mantem o usuario logado no app instalado
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

export type UserRole = 'gestor' | 'corretor'

export type Profile = {
  id: string
  org_id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  is_active: boolean
}

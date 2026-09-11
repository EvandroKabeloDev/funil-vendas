import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

type Mode = 'login' | 'signup' | 'reset'

export default function Login() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (loading) return <div className="splash">Carregando…</div>
  if (session) return <Navigate to="/app" replace />

  function friendlyError(message: string) {
    const map: Record<string, string> = {
      'Invalid login credentials': 'E-mail ou senha incorretos.',
      'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
      'User already registered': 'Este e-mail já possui cadastro. Faça login.',
      'Password should be at least 8 characters.': 'A senha deve ter ao menos 8 caracteres.'
    }
    return map[message] ?? message
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        navigate('/app', { replace: true })
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Password should be at least 8 characters.')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              org_name: orgName.trim(),
              phone: phone.trim()
            },
            emailRedirectTo: `${window.location.origin}/app`
          }
        })
        if (error) throw error
        if (data.session) navigate('/app', { replace: true })
        else setInfo('Cadastro criado! Confirme o link enviado para o seu e-mail e depois faça login.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/app`
        })
        if (error) throw error
        setInfo('Enviamos um link de redefinição para o seu e-mail.')
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Falha inesperada.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card panel">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div><strong>FUNIL</strong><span>Gestão de vendas</span></div>
        </div>

        <h1 className="auth-title">
          {mode === 'login' ? 'Entrar na sua conta' : mode === 'signup' ? 'Criar sua conta' : 'Recuperar senha'}
        </h1>
        <p className="auth-sub">
          {mode === 'login'
            ? 'Use o e-mail e a senha cadastrados.'
            : mode === 'signup'
              ? 'Leva menos de um minuto. Quem cria a empresa entra como gestor.'
              : 'Informe o e-mail da conta para receber o link.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <>
              <div className="field">
                <label htmlFor="fullName">Nome completo</label>
                <input id="fullName" required minLength={3} autoComplete="name"
                  value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="field">
                <label htmlFor="orgName">Empresa / imobiliária</label>
                <input id="orgName" required minLength={2} autoComplete="organization"
                  value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Nome da empresa" />
                <small className="hint">Se a empresa já existir, você entra nela como corretor.</small>
              </div>
              <div className="field">
                <label htmlFor="phone">Celular (opcional)</label>
                <input id="phone" inputMode="tel" autoComplete="tel"
                  value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 90000-0000" />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" required autoComplete="email" inputMode="email"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com" />
          </div>

          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input id="password" type="password" required minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" />
            </div>
          )}

          {error && <div className="auth-msg error">{error}</div>}
          {info && <div className="auth-msg ok">{info}</div>}

          <button className="btn primary block" type="submit" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'login' && (
            <>
              <button className="link" onClick={() => { setMode('signup'); setError(''); setInfo('') }}>Criar uma conta</button>
              <button className="link" onClick={() => { setMode('reset'); setError(''); setInfo('') }}>Esqueci minha senha</button>
            </>
          )}
          {mode !== 'login' && (
            <button className="link" onClick={() => { setMode('login'); setError(''); setInfo('') }}>Voltar para o login</button>
          )}
        </div>
      </div>
    </div>
  )
}

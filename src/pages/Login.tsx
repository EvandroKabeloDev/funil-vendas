import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

type Mode = 'login' | 'signup' | 'reset'
type Papel = 'gestor' | 'corretor'
type GestorOpcao = { id: string; full_name: string; org_name: string }

export default function Login() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('login')
  const [fullName, setFullName] = useState('')
  const [papel, setPapel] = useState<Papel | ''>('')
  const [gestorId, setGestorId] = useState('')
  const [orgName, setOrgName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [gestores, setGestores] = useState<GestorOpcao[]>([])
  const [carregandoGestores, setCarregandoGestores] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Lista de gestores: vem de uma funcao publica no banco, pois neste
  // momento o usuario ainda nao esta autenticado.
  useEffect(() => {
    if (mode !== 'signup' || papel !== 'corretor' || gestores.length) return
    setCarregandoGestores(true)
    supabase.rpc('gestores_disponiveis').then(({ data, error }) => {
      if (error) setError('Não foi possível carregar a lista de gestores.')
      else setGestores((data ?? []) as GestorOpcao[])
      setCarregandoGestores(false)
    })
  }, [mode, papel, gestores.length])

  if (loading) return <div className="splash">Carregando…</div>
  if (session) return <Navigate to="/app" replace />

  function friendlyError(message: string) {
    const map: Record<string, string> = {
      'Invalid login credentials': 'E-mail ou senha incorretos.',
      'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
      'User already registered': 'Este e-mail já possui cadastro. Faça login.',
      'Password should be at least 8 characters.': 'A senha deve ter ao menos 8 caracteres.'
    }
    if (map[message]) return map[message]
    if (/Selecione o gestor/i.test(message)) return 'Selecione o gestor responsável para concluir o cadastro.'
    if (/Gestor informado nao foi encontrado/i.test(message)) return 'O gestor selecionado não está mais disponível. Atualize a página.'
    if (/Database error saving new user/i.test(message)) return 'Não foi possível concluir o cadastro. Confira o gestor selecionado e tente novamente.'
    return message
  }

  function limparMensagens() { setError(''); setInfo('') }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    limparMensagens()
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        navigate('/app', { replace: true })

      } else if (mode === 'signup') {
        if (!papel) throw new Error('Escolha se você é gestor ou corretor.')
        if (papel === 'corretor' && !gestorId) throw new Error('Selecione o gestor responsável para concluir o cadastro.')
        if (password.length < 8) throw new Error('Password should be at least 8 characters.')

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: papel,
              gestor_id: papel === 'corretor' ? gestorId : null,
              org_name: papel === 'gestor' ? orgName.trim() : null,
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

  const semGestores = papel === 'corretor' && !carregandoGestores && gestores.length === 0

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
              ? 'Informe seus dados e escolha o seu perfil de acesso.'
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
                <label htmlFor="papel">Gestor / Corretor</label>
                <select
                  id="papel" required value={papel}
                  onChange={e => { setPapel(e.target.value as Papel); setGestorId(''); limparMensagens() }}
                >
                  <option value="" disabled>Selecione o seu perfil…</option>
                  <option value="gestor">Gestor</option>
                  <option value="corretor">Corretor</option>
                </select>
              </div>

              {papel === 'corretor' && (
                <div className="field">
                  <label htmlFor="gestor">Gestor responsável</label>
                  <select
                    id="gestor" required value={gestorId}
                    disabled={carregandoGestores || semGestores}
                    onChange={e => setGestorId(e.target.value)}
                  >
                    <option value="" disabled>
                      {carregandoGestores ? 'Carregando gestores…' : 'Selecione o seu gestor…'}
                    </option>
                    {gestores.map(g => (
                      <option key={g.id} value={g.id}>{g.full_name} — {g.org_name}</option>
                    ))}
                  </select>
                  {semGestores
                    ? <small className="hint warn-hint">Nenhum gestor cadastrado ainda. O primeiro acesso do sistema precisa ser de um gestor.</small>
                    : <small className="hint">Você entrará na equipe deste gestor e já poderá lançar seus leads.</small>}
                </div>
              )}

              {papel === 'gestor' && (
                <div className="field">
                  <label htmlFor="orgName">Nome da equipe / imobiliária</label>
                  <input id="orgName" required minLength={2} autoComplete="organization"
                    value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ex.: Imobiliária Central" />
                  <small className="hint">Os corretores selecionarão o seu nome ao se cadastrarem.</small>
                </div>
              )}

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

          <button className="btn primary block" type="submit" disabled={busy || (mode === 'signup' && semGestores)}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'login' && (
            <>
              <button className="link" onClick={() => { setMode('signup'); limparMensagens() }}>Criar uma conta</button>
              <button className="link" onClick={() => { setMode('reset'); limparMensagens() }}>Esqueci minha senha</button>
            </>
          )}
          {mode !== 'login' && (
            <button className="link" onClick={() => { setMode('login'); limparMensagens() }}>Voltar para o login</button>
          )}
        </div>
      </div>
    </div>
  )
}

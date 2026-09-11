import { useAuth } from '../lib/AuthContext'

// Placeholder da Etapa 2 (Lançamento / Desempenho / Cadastros).
export default function Home() {
  const { profile, isGestor, signOut } = useAuth()
  return (
    <div className="auth-wrap">
      <div className="auth-card panel">
        <h1 className="auth-title">Olá, {profile?.full_name} 👋</h1>
        <p className="auth-sub">
          Login funcionando. Perfil: <strong>{isGestor ? 'Gestor' : 'Corretor'}</strong>.
          As telas de Lançamento, Desempenho e Cadastros entram na Etapa 2.
        </p>
        <button className="btn block" onClick={signOut}>Sair</button>
      </div>
    </div>
  )
}

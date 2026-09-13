import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/AuthContext'

const META: Record<string, [string, string]> = {
  '/app/lancamento': ['Controle diário', 'Lançamento do funil'],
  '/app/desempenho': ['Análise da equipe', 'Desempenho comercial'],
  '/app/campanhas':  ['Origem dos leads', 'Minhas campanhas'],
  '/app/cadastros':  ['Configuração', 'Equipes e corretores']
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { profile, isGestor, signOut } = useAuth()
  const { pathname } = useLocation()
  const [eyebrow, title] = META[pathname] ?? ['Funil de vendas', 'Painel']

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long'
  })

  const iniciais = (profile?.full_name ?? '?')
    .split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div><strong>FUNIL</strong><span>Gestão de vendas</span></div>
        </div>
        <nav>
          <NavLink to="/app/lancamento" className="nav-btn">
            <span className="nav-icon">＋</span>Lançamento
          </NavLink>
          <NavLink to="/app/desempenho" className="nav-btn">
            <span className="nav-icon">▥</span>Desempenho
          </NavLink>
          {/* campanhas são pessoais do corretor; o gestor apenas as visualiza no Desempenho */}
          {!isGestor && (
            <NavLink to="/app/campanhas" className="nav-btn">
              <span className="nav-icon">◎</span>Campanhas
            </NavLink>
          )}
          {isGestor && (
            <NavLink to="/app/cadastros" className="nav-btn">
              <span className="nav-icon">⚙</span>Cadastros
            </NavLink>
          )}
        </nav>
        <div className="local-note">
          <strong>{profile?.full_name}</strong>
          <span className="role-tag">{isGestor ? 'Gestor' : 'Corretor'}</span>
          <button className="link" onClick={signOut}>Sair</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-titulo">
            <div className="eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
          </div>
          <div className="today">{today}</div>
          <div className="user-mobile">
            <div className="avatar" aria-hidden="true">{iniciais}</div>
            <div className="user-info">
              <strong>{profile?.full_name}</strong>
              <span className="role-tag">{isGestor ? 'Gestor' : 'Corretor'}</span>
            </div>
            <button className="btn sair" onClick={signOut}>Sair</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}

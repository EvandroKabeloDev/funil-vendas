import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/AuthContext'

export function ProtectedRoute({ children, gestorOnly = false }: { children: ReactNode; gestorOnly?: boolean }) {
  const { session, profile, loading, isGestor } = useAuth()
  const location = useLocation()

  if (loading) return <div className="splash">Carregando...</div>
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (gestorOnly && !isGestor) return <Navigate to="/app" replace />
  if (profile && !profile.is_active) return <div className="splash">Seu acesso esta inativo. Fale com o gestor.</div>
  return <>{children}</>
}

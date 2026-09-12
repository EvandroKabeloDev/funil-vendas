import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Cadastros from './pages/Cadastros'
import Lancamento from './pages/Lancamento'
import Desempenho from './pages/Desempenho'
import AppShell from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastProvider } from './components/Toast'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/app/lancamento"
          element={
            <ProtectedRoute>
              <AppShell><Lancamento /></AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/desempenho"
          element={
            <ProtectedRoute>
              <AppShell><Desempenho /></AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/cadastros"
          element={
            <ProtectedRoute gestorOnly>
              <AppShell><Cadastros /></AppShell>
            </ProtectedRoute>
          }
        />

        <Route path="/app" element={<Navigate to="/app/lancamento" replace />} />
        <Route path="*" element={<Navigate to="/app/lancamento" replace />} />
      </Routes>
    </ToastProvider>
  )
}

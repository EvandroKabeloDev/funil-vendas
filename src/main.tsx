import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import PwaLayer from './components/PwaLayer'
import { AuthProvider } from './lib/AuthContext'
import './styles/global.css'
import './styles/etapa3-append.css'
import './styles/desempenho.css'
import './styles/pwa.css'
import './styles/cadastro.css'


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PwaLayer />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

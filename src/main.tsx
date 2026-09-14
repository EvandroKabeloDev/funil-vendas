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
import './styles/funil-sentimento.css'
import './styles/campanhas.css'
import './styles/correcoes.css'
import './styles/ajustes.css'
import './styles/resumo-dia.css'


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

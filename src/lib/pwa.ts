// =====================================================================
// Hooks de PWA: instalacao, conexao e atualizacao de versao.
// Sem dependencias externas alem do virtual module do vite-plugin-pwa.
// =====================================================================
import { useEffect, useState } from 'react'

// evento nao-padronizado, disponivel em Chrome/Edge/Android
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISPENSADO = 'funil:install-dismissed'
const DIAS_PARA_REPERGUNTAR = 14

export function ehIOS(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ se identifica como Mac; a checagem de touch resolve
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function ehSafari(): boolean {
  const ua = navigator.userAgent
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome/.test(ua)
}

export function jaInstalado(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // propriedade legada do iOS
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function foiDispensadoRecentemente(): boolean {
  const raw = localStorage.getItem(DISPENSADO)
  if (!raw) return false
  const dias = (Date.now() - Number(raw)) / 86_400_000
  return dias < DIAS_PARA_REPERGUNTAR
}

/** Controla o convite de instalacao (Android/desktop via prompt, iOS via instrucao). */
export function useInstalacao() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null)
  const [visivel, setVisivel] = useState(false)
  const [instrucaoIOS, setInstrucaoIOS] = useState(false)

  useEffect(() => {
    if (jaInstalado() || foiDispensadoRecentemente()) return

    // Android / desktop: o navegador avisa quando o app e instalavel
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvento(e as BeforeInstallPromptEvent)
      setVisivel(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS nao dispara o evento: mostramos a instrucao manual do Safari
    if (ehIOS() && ehSafari()) {
      const t = window.setTimeout(() => { setInstrucaoIOS(true); setVisivel(true) }, 2500)
      return () => { window.clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt) }
    }

    const onInstalled = () => setVisivel(false)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    if (outcome === 'accepted') setVisivel(false)
    else dispensar()
    setEvento(null)
  }

  function dispensar() {
    localStorage.setItem(DISPENSADO, String(Date.now()))
    setVisivel(false)
  }

  return { visivel, instrucaoIOS, instalar, dispensar }
}

/** Estado da conexao, com memoria de que houve queda (para avisar o retorno). */
export function useConexao() {
  const [online, setOnline] = useState(navigator.onLine)
  const [voltou, setVoltou] = useState(false)

  useEffect(() => {
    const sobe = () => {
      setOnline(true)
      setVoltou(true)
      window.setTimeout(() => setVoltou(false), 3500)
    }
    const cai = () => setOnline(false)
    window.addEventListener('online', sobe)
    window.addEventListener('offline', cai)
    return () => {
      window.removeEventListener('online', sobe)
      window.removeEventListener('offline', cai)
    }
  }, [])

  return { online, voltou }
}

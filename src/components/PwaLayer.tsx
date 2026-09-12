import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useConexao, useInstalacao } from '../lib/pwa'

/**
 * Camada de PWA: aviso de conexao, convite de instalacao e nova versao.
 * Renderiza sobre o app, sem interferir no roteamento.
 */
export default function PwaLayer() {
  const { online, voltou } = useConexao()
  const { visivel, instrucaoIOS, instalar, dispensar } = useInstalacao()
  const [temAtualizacao, setTemAtualizacao] = useState(false)
  const [aplicar, setAplicar] = useState<(() => void) | null>(null)

  useEffect(() => {
    // registerType: 'autoUpdate' baixa sozinho; aqui so avisamos o usuario
    const atualizar = registerSW({
      immediate: true,
      onNeedRefresh() { setTemAtualizacao(true) }
    })
    setAplicar(() => () => atualizar(true))
  }, [])

  return (
    <>
      {/* ---------- conexao ---------- */}
      {!online && (
        <div className="net-bar offline" role="status">
          <i className="net-dot" />
          Sem conexão — os lançamentos não serão salvos até a internet voltar.
        </div>
      )}
      {online && voltou && (
        <div className="net-bar back" role="status">
          <i className="net-dot" />
          Conexão restabelecida.
        </div>
      )}

      {/* ---------- nova versao ---------- */}
      {temAtualizacao && (
        <div className="pwa-card update" role="alert">
          <div>
            <strong>Nova versão disponível</strong>
            <span>Atualize para receber as últimas melhorias.</span>
          </div>
          <div className="pwa-actions">
            <button className="btn small ghost" onClick={() => setTemAtualizacao(false)}>Depois</button>
            <button className="btn small primary" onClick={() => aplicar?.()}>Atualizar</button>
          </div>
        </div>
      )}

      {/* ---------- instalacao ---------- */}
      {visivel && (
        <div className="pwa-card install">
          <div className="pwa-icon">F</div>
          {instrucaoIOS ? (
            <>
              <div>
                <strong>Instale o Funil no seu iPhone</strong>
                <span>
                  Toque em <b>Compartilhar</b> na barra do Safari e escolha
                  <b> Adicionar à Tela de Início</b>.
                </span>
              </div>
              <div className="pwa-actions">
                <button className="btn small ghost" onClick={dispensar}>Entendi</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <strong>Instalar o Funil</strong>
                <span>Acesso rápido pela tela inicial, em tela cheia.</span>
              </div>
              <div className="pwa-actions">
                <button className="btn small ghost" onClick={dispensar}>Agora não</button>
                <button className="btn small primary" onClick={instalar}>Instalar</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

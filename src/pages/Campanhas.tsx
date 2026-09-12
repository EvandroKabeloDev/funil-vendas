import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import { traduzErro, type Campaign } from '../lib/types'

export default function Campanhas() {
  const { profile, isGestor } = useAuth()
  const toast = useToast()

  const [campanhas, setCampanhas] = useState<Campaign[]>([])
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, org_id, name, is_active, created_by, created_at')
      .order('name')
    if (error) toast(traduzErro(error), 'error')
    setCampanhas((data ?? []) as Campaign[])
    setLoading(false)
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  async function criar(e: FormEvent) {
    e.preventDefault()
    const name = nome.trim()
    if (name.length < 2) return toast('O nome da campanha deve ter ao menos 2 caracteres.', 'error')
    setBusy(true)
    const { error } = await supabase.from('campaigns').insert({
      org_id: profile!.org_id,
      name,
      created_by: profile!.id
    })
    setBusy(false)
    if (error) return toast(traduzErro(error), 'error')
    setNome('')
    toast('Campanha cadastrada.')
    carregar()
  }

  async function excluir(c: Campaign) {
    if (!confirm(`Excluir a campanha "${c.name}"?`)) return
    const { error } = await supabase.from('campaigns').delete().eq('id', c.id)
    if (error) return toast(traduzErro(error), 'error')
    toast('Campanha excluída.')
    carregar()
  }

  const podeExcluir = (c: Campaign) => isGestor || c.created_by === profile?.id

  if (loading) return <div className="panel card"><div className="empty">Carregando campanhas…</div></div>

  return (
    <>
      <div className="panel card">
        <div className="card-head">
          <h2>Cadastrar campanha</h2>
          <span className="pill">{campanhas.length}</span>
        </div>

        <form className="inline-form" onSubmit={criar}>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Nome da campanha"
            maxLength={120}
            required
          />
          <button className="btn primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Adicionar'}
          </button>
        </form>

        <div className="mini-list">
          {campanhas.length === 0 && <div className="empty">Nenhuma campanha cadastrada.</div>}
          {campanhas.map(c => (
            <div className="mini-item" key={c.id}>
              <span>
                <strong>{c.name}</strong>
                <small>
                  {c.created_by === profile?.id ? 'Criada por você' : 'Criada por outro usuário'}
                </small>
              </span>
              {podeExcluir(c) && (
                <button className="icon-btn" onClick={() => excluir(c)} aria-label="Excluir campanha">×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel card">
        <h2>Como usar</h2>
        <p className="hint-block">
          As campanhas ficam disponíveis no seletor da tela de <strong>Lançamento</strong>, ao lado de
          "Leads recebidos". Ao lançar o funil do dia, escolha a campanha que originou aqueles leads —
          o campo é opcional. Excluir uma campanha não apaga os lançamentos: eles apenas deixam de
          ficar associados a ela.
        </p>
      </div>
    </>
  )
}

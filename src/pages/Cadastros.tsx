import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import { traduzErro, type Broker, type Team, type TeamMate } from '../lib/types'

export default function Cadastros() {
  const { profile } = useAuth()
  const toast = useToast()

  const [teams, setTeams] = useState<Team[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [mates, setMates] = useState<TeamMate[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [teamName, setTeamName] = useState('')
  const [brokerName, setBrokerName] = useState('')
  const [brokerTeam, setBrokerTeam] = useState('')
  const [brokerProfile, setBrokerProfile] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const [t, b, p] = await Promise.all([
      supabase.from('teams').select('id, org_id, name, is_active').order('name'),
      supabase.from('brokers').select('id, org_id, team_id, profile_id, name, is_active').order('name'),
      supabase.from('profiles').select('id, full_name, email, role').order('full_name')
    ])
    if (t.error || b.error) toast(traduzErro(t.error ?? b.error), 'error')
    setTeams((t.data ?? []) as Team[])
    setBrokers((b.data ?? []) as Broker[])
    setMates((p.data ?? []) as TeamMate[])
    setLoading(false)
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  // primeira equipe da lista vira padrão do formulário de corretor
  useEffect(() => {
    if (!brokerTeam && teams.length) setBrokerTeam(teams[0].id)
  }, [teams, brokerTeam])

  async function criarEquipe(e: FormEvent) {
    e.preventDefault()
    const name = teamName.trim()
    if (name.length < 2) return toast('O nome da equipe deve ter ao menos 2 caracteres.', 'error')
    setBusy(true)
    const { error } = await supabase.from('teams').insert({ org_id: profile!.org_id, name })
    setBusy(false)
    if (error) return toast(traduzErro(error), 'error')
    setTeamName('')
    toast('Equipe adicionada.')
    carregar()
  }

  async function excluirEquipe(team: Team) {
    if (brokers.some(b => b.team_id === team.id))
      return toast('Remova primeiro os corretores desta equipe.', 'error')
    if (teams.length === 1) return toast('Mantenha pelo menos uma equipe.', 'error')
    if (!confirm(`Excluir a equipe "${team.name}"?`)) return
    const { error } = await supabase.from('teams').delete().eq('id', team.id)
    if (error) return toast(traduzErro(error), 'error')
    toast('Equipe excluída.')
    carregar()
  }

  async function criarCorretor(e: FormEvent) {
    e.preventDefault()
    const name = brokerName.trim()
    if (name.length < 2) return toast('O nome do corretor deve ter ao menos 2 caracteres.', 'error')
    if (!brokerTeam) return toast('Selecione uma equipe.', 'error')
    setBusy(true)
    const { error } = await supabase.from('brokers').insert({
      org_id: profile!.org_id,
      team_id: brokerTeam,
      name,
      profile_id: brokerProfile || null
    })
    setBusy(false)
    if (error) return toast(traduzErro(error), 'error')
    setBrokerName(''); setBrokerProfile('')
    toast('Corretor adicionado.')
    carregar()
  }

  async function vincularUsuario(broker: Broker, profileId: string) {
    const { error } = await supabase
      .from('brokers')
      .update({ profile_id: profileId || null })
      .eq('id', broker.id)
    if (error) return toast(traduzErro(error), 'error')
    toast(profileId ? 'Usuário vinculado.' : 'Vínculo removido.')
    carregar()
  }

  async function excluirCorretor(broker: Broker) {
    if (!confirm(`Excluir "${broker.name}" e todos os lançamentos dele?`)) return
    const { error } = await supabase.from('brokers').delete().eq('id', broker.id)
    if (error) return toast(traduzErro(error), 'error')
    toast('Corretor excluído.')
    carregar()
  }

  const nomeEquipe = (id: string) => teams.find(t => t.id === id)?.name ?? ''
  const usuarioDe = (id: string | null) => mates.find(m => m.id === id)

  if (loading) return <div className="panel card"><div className="empty">Carregando cadastros…</div></div>

  return (
    <>
      <div className="setup-grid">
        {/* ---------------- equipes ---------------- */}
        <div className="panel setup-card">
          <div className="card-head">
            <h2>Equipes</h2>
            <span className="pill">{teams.length}</span>
          </div>
          <form className="inline-form" onSubmit={criarEquipe}>
            <input
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="Nome da equipe"
              maxLength={120}
              required
            />
            <button className="btn primary" disabled={busy}>Adicionar</button>
          </form>
          <div className="mini-list">
            {teams.length === 0 && <div className="empty">Nenhuma equipe cadastrada.</div>}
            {teams.map(t => (
              <div className="mini-item" key={t.id}>
                <span>
                  <strong>{t.name}</strong>
                  <small>{brokers.filter(b => b.team_id === t.id).length} corretores</small>
                </span>
                <button className="icon-btn" onClick={() => excluirEquipe(t)} aria-label="Excluir equipe">×</button>
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- corretores ---------------- */}
        <div className="panel setup-card">
          <div className="card-head">
            <h2>Corretores</h2>
            <span className="pill">{brokers.length}</span>
          </div>
          <form className="inline-form wrap" onSubmit={criarCorretor}>
            <input
              value={brokerName}
              onChange={e => setBrokerName(e.target.value)}
              placeholder="Nome do corretor"
              maxLength={120}
              required
            />
            <select value={brokerTeam} onChange={e => setBrokerTeam(e.target.value)}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={brokerProfile} onChange={e => setBrokerProfile(e.target.value)}>
              <option value="">Sem login vinculado</option>
              {mates.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <button className="btn primary" disabled={busy || !teams.length}>Adicionar</button>
          </form>

          <div className="mini-list">
            {brokers.length === 0 && <div className="empty">Cadastre o primeiro corretor.</div>}
            {brokers.map(b => {
              const user = usuarioDe(b.profile_id)
              return (
                <div className="mini-item col" key={b.id}>
                  <div className="mini-row">
                    <span>
                      <strong>{b.name}</strong>
                      <small>{nomeEquipe(b.team_id)}</small>
                    </span>
                    <button className="icon-btn" onClick={() => excluirCorretor(b)} aria-label="Excluir corretor">×</button>
                  </div>
                  <div className="link-row">
                    <label>Login vinculado</label>
                    <select
                      value={b.profile_id ?? ''}
                      onChange={e => vincularUsuario(b, e.target.value)}
                    >
                      <option value="">Nenhum</option>
                      {mates.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  </div>
                  {!user && (
                    <small className="warn">
                      Sem login vinculado: este corretor não consegue lançar o próprio funil.
                    </small>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="panel backup">
        <h2>Como funciona o vínculo</h2>
        <p className="hint-block">
          O <strong>corretor</strong> é quem aparece nos relatórios. O <strong>login vinculado</strong> é a
          conta que pode lançar os números daquele corretor. Um corretor sem login vinculado só recebe
          lançamentos feitos pelo gestor. Para criar um login novo, a pessoa se cadastra pela tela inicial
          usando <strong>o mesmo nome de empresa</strong> — ela entra como corretor e aparece nesta lista.
        </p>
      </div>
    </>
  )
}

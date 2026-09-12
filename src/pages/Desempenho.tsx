import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import { traduzErro, type Broker, type Team } from '../lib/types'
import {
  PERIODOS, diaCurto, intervalo, montarFunil, pct, porCorretor, porMotivo,
  serieDiaria, soma, type EntryRow, type Periodo
} from '../lib/analytics'

export default function Desempenho() {
  const { profile, isGestor } = useAuth()
  const toast = useToast()

  const [rows, setRows] = useState<EntryRow[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const [teamId, setTeamId] = useState('')
  const [brokerId, setBrokerId] = useState('')
  const [loading, setLoading] = useState(true)

  const [de, ate] = useMemo(() => intervalo(periodo), [periodo])

  useEffect(() => {
    (async () => {
      const [t, b] = await Promise.all([
        supabase.from('teams').select('id, org_id, name, is_active').order('name'),
        supabase.from('brokers').select('id, org_id, team_id, profile_id, name, is_active').order('name')
      ])
      setTeams((t.data ?? []) as Team[])
      setBrokers((b.data ?? []) as Broker[])
    })()
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('vw_funnel_entries')
      .select('*')
      .gte('entry_date', de)
      .lte('entry_date', ate)
      .order('entry_date')

    if (teamId) q = q.eq('team_id', teamId)
    if (brokerId) q = q.eq('broker_id', brokerId)

    const { data, error } = await q
    if (error) toast(traduzErro(error), 'error')
    setRows((data ?? []) as EntryRow[])
    setLoading(false)
  }, [de, ate, teamId, brokerId, toast])

  useEffect(() => { carregar() }, [carregar])

  // limpa o corretor quando ele nao pertence mais a equipe filtrada
  useEffect(() => {
    if (brokerId && teamId) {
      const b = brokers.find(x => x.id === brokerId)
      if (b && b.team_id !== teamId) setBrokerId('')
    }
  }, [teamId, brokerId, brokers])

  const funil = useMemo(() => montarFunil(rows), [rows])
  const ranking = useMemo(() => porCorretor(rows), [rows])
  const motivos = useMemo(() => porMotivo(rows), [rows])
  const serie = useMemo(() => serieDiaria(rows, de, ate), [rows, de, ate])

  const totLeads = soma(rows, 'leads')
  const totVendas = soma(rows, 'sales')
  const totAgend = soma(rows, 'appointments')
  const totProp = soma(rows, 'proposals')
  const diasAtivos = new Set(rows.map(r => r.entry_date)).size
  const brokersFiltrados = teamId ? brokers.filter(b => b.team_id === teamId) : brokers

  const maxSerie = Math.max(...serie.map(s => s.leads), 1)

  if (loading) return <div className="panel card"><div className="empty">Carregando indicadores…</div></div>

  return (
    <>
      {/* ---------- filtros ---------- */}
      <div className="panel card ctx-bar">
        <div className="field">
          <label>Período</label>
          <div className="seg">
            {PERIODOS.map(p => (
              <button
                key={p.key}
                className={periodo === p.key ? 'active' : ''}
                onClick={() => setPeriodo(p.key)}
              >{p.label}</button>
            ))}
          </div>
        </div>
        {isGestor && (
          <>
            <div className="field">
              <label htmlFor="f-equipe">Equipe</label>
              <select id="f-equipe" value={teamId} onChange={e => setTeamId(e.target.value)}>
                <option value="">Todas as equipes</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-corretor">Corretor</label>
              <select id="f-corretor" value={brokerId} onChange={e => setBrokerId(e.target.value)}>
                <option value="">Todos os corretores</option>
                {brokersFiltrados.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="panel card">
          <div className="empty">
            Nenhum lançamento no período selecionado.<br />
            <small>Registre os números em <strong>Lançamento</strong> para ver os indicadores aqui.</small>
          </div>
        </div>
      ) : (
        <>
          {/* ---------- KPIs ---------- */}
          <div className="kpi-grid">
            <div className="panel kpi">
              <span className="kpi-label">Leads</span>
              <strong className="kpi-value">{totLeads}</strong>
              <small>{diasAtivos} dia(s) com lançamento</small>
            </div>
            <div className="panel kpi">
              <span className="kpi-label">Agendamentos</span>
              <strong className="kpi-value">{totAgend}</strong>
              <small>{pct(totAgend, totLeads)}% dos leads</small>
            </div>
            <div className="panel kpi">
              <span className="kpi-label">Propostas</span>
              <strong className="kpi-value">{totProp}</strong>
              <small>{pct(totProp, totLeads)}% dos leads</small>
            </div>
            <div className="panel kpi destaque">
              <span className="kpi-label">Vendas</span>
              <strong className="kpi-value">{totVendas}</strong>
              <small>{pct(totVendas, totLeads)}% de conversão</small>
            </div>
          </div>

          {/* ---------- funil ---------- */}
          <div className="panel card">
            <div className="card-head">
              <h2>Funil de conversão</h2>
              <span className="pill">{de.split('-').reverse().join('/')} a {ate.split('-').reverse().join('/')}</span>
            </div>
            <div className="funnel-chart">
              {funil.map((f, i) => (
                <div className="fc-row" key={f.key}>
                  <div className="fc-label">{f.label}</div>
                  <div className="fc-track">
                    <div className="fc-bar" style={{ width: `${f.largura}%` }}>
                      <span>{f.valor}</span>
                    </div>
                  </div>
                  <div className="fc-pct">
                    {f.pctBase}%
                    {i > 0 && <small>{f.pctEtapa}% da etapa anterior</small>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- evolucao diaria ---------- */}
          <div className="panel card">
            <div className="card-head">
              <h2>Evolução diária</h2>
              <div className="legend">
                <span><i className="dot orange" />Leads</span>
                <span><i className="dot green" />Vendas</span>
              </div>
            </div>
            <div className="spark">
              {serie.map(s => (
                <div className="spark-col" key={s.data} title={`${diaCurto(s.data)} — ${s.leads} leads, ${s.vendas} vendas`}>
                  <div className="spark-bars">
                    <div className="sb leads" style={{ height: `${(s.leads / maxSerie) * 100}%` }} />
                    <div className="sb vendas" style={{ height: `${(s.vendas / maxSerie) * 100}%` }} />
                  </div>
                  <span className="spark-x">{diaCurto(s.data)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- motivos ---------- */}
          <div className="panel card">
            <div className="card-head">
              <h2>Objeções por sentimento</h2>
              <span className="pill">{motivos.totalGeral} registradas</span>
            </div>
            <div className="reason-grid">
              {motivos.grupos.map(g => (
                <div className="reason-card" key={g.key} style={{ borderTopColor: g.cor }}>
                  <div className="rc-head">
                    <strong style={{ color: g.cor }}>{g.label}</strong>
                    <span>{g.total} leads</span>
                  </div>
                  {g.itens.map(it => (
                    <div className="rc-item" key={it.label}>
                      <div className="rc-top">
                        <span>{it.label}</span>
                        <strong>{it.valor}</strong>
                      </div>
                      <div className="rc-track">
                        <div className="rc-fill" style={{ width: `${it.pct}%`, background: g.cor }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ---------- ranking ---------- */}
          <div className="panel card">
            <div className="card-head">
              <h2>Comparativo por corretor</h2>
              <span className="pill">{ranking.length}</span>
            </div>
            <div className="table-wrap">
              <table className="rank-table">
                <thead>
                  <tr>
                    <th>Corretor</th><th>Equipe</th>
                    <th>Leads</th><th>Agend.</th><th>Prop.</th><th>Contr.</th><th>Vendas</th><th>Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.id}>
                      <td>
                        <span className={`pos ${i === 0 ? 'top' : ''}`}>{i + 1}</span>
                        {r.nome}
                      </td>
                      <td className="dim">{r.equipe}</td>
                      <td>{r.leads}</td>
                      <td>{r.agendamentos}</td>
                      <td>{r.propostas}</td>
                      <td>{r.contratos}</td>
                      <td><strong>{r.vendas}</strong></td>
                      <td>
                        <span className={`conv ${r.conversao >= 10 ? 'alta' : r.conversao > 0 ? 'media' : 'zero'}`}>
                          {r.conversao}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}

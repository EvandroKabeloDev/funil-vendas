import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import { traduzErro, type Broker, type Team } from '../lib/types'
import {
  PERIODOS, composicaoLeads, diaCurto, intervalo, montarFunil, pct,
  porCampanha, porCorretor, porMotivo, serieDiaria, soma,
  type EntryRow, type Periodo
} from '../lib/analytics'

export default function Desempenho() {
  const { isGestor } = useAuth()
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
    if (!isGestor) return // corretor não tem filtros de equipe/corretor
    ;(async () => {
      const [t, b] = await Promise.all([
        supabase.from('teams').select('id, org_id, name, is_active').order('name'),
        supabase.from('brokers').select('id, org_id, team_id, profile_id, name, is_active').order('name')
      ])
      setTeams((t.data ?? []) as Team[])
      setBrokers((b.data ?? []) as Broker[])
    })()
  }, [isGestor])

  const carregar = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('vw_funnel_entries')
      .select('*')
      .gte('entry_date', de)
      .lte('entry_date', ate)
      .order('entry_date')

    if (isGestor && teamId) q = q.eq('team_id', teamId)
    if (isGestor && brokerId) q = q.eq('broker_id', brokerId)

    const { data, error } = await q
    if (error) toast(traduzErro(error), 'error')
    setRows((data ?? []) as EntryRow[])
    setLoading(false)
  }, [de, ate, teamId, brokerId, isGestor, toast])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (brokerId && teamId) {
      const b = brokers.find(x => x.id === brokerId)
      if (b && b.team_id !== teamId) setBrokerId('')
    }
  }, [teamId, brokerId, brokers])

  const funil = useMemo(() => montarFunil(rows), [rows])
  const composicao = useMemo(() => composicaoLeads(rows), [rows])
  const ranking = useMemo(() => porCorretor(rows), [rows])
  const campanhas = useMemo(() => porCampanha(rows), [rows])
  const motivos = useMemo(() => porMotivo(rows), [rows])
  const serie = useMemo(() => serieDiaria(rows, de, ate), [rows, de, ate])

  const totLeads = soma(rows, 'leads')
  const totVendas = soma(rows, 'sales')
  const totAgend = soma(rows, 'appointments')
  const totProp = soma(rows, 'proposals')
  const diasAtivos = new Set(rows.map(r => r.entry_date)).size
  const brokersFiltrados = teamId ? brokers.filter(b => b.team_id === teamId) : brokers
  const maxSerie = Math.max(...serie.map(s => s.leads), 1)

  const classificados = composicao.reduce((t, f) => t + f.valor, 0)
  const semClassificar = Math.max(totLeads - classificados, 0)

  if (loading) return <div className="panel card"><div className="empty">Carregando indicadores…</div></div>

  return (
    <>
      {/* ---------- filtros ---------- */}
      <div className="panel card ctx-bar">
        <div className="field">
          <label>Período</label>
          <div className="seg">
            {PERIODOS.map(p => (
              <button key={p.key} className={periodo === p.key ? 'active' : ''} onClick={() => setPeriodo(p.key)}>
                {p.label}
              </button>
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
              <div className="legend">
                {composicao.map(f => (
                  <span key={f.key}><i className="dot" style={{ background: f.cor }} />{f.label}</span>
                ))}
              </div>
            </div>

            <div className="funnel-chart">
              {funil.map((f, i) => (
                <div className="fc-row" key={f.key}>
                  <div className="fc-label">{f.label}</div>
                  <div className="fc-track">
                    {f.key === 'leads' ? (
                      <div className="fc-bar segmentado" style={{ width: `${f.largura}%` }}>
                        {composicao.map(s => s.valor > 0 && (
                          <div key={s.key} className="fc-seg"
                            style={{ width: `${pct(s.valor, classificados || 1)}%`, background: s.cor }}
                            title={`${s.label}: ${s.valor} lead(s) — ${s.pct}%`}>
                            {s.pct >= 8 && <span>{s.pct}%</span>}
                          </div>
                        ))}
                        {semClassificar > 0 && (
                          <div className="fc-seg vazio"
                            style={{ width: `${pct(semClassificar, classificados || 1)}%` }}
                            title={`Sem classificação: ${semClassificar} lead(s)`} />
                        )}
                      </div>
                    ) : (
                      <div className="fc-bar" style={{ width: `${f.largura}%` }}>
                        <span>{f.valor}</span>
                      </div>
                    )}
                  </div>
                  <div className="fc-pct">
                    {f.key === 'leads' ? f.valor : `${f.pctBase}%`}
                    {i > 0 && <small>{f.pctEtapa}% da etapa anterior</small>}
                    {i === 0 && <small>total de leads</small>}
                  </div>
                </div>
              ))}
            </div>

            <div className="sent-summary">
              {composicao.map(s => (
                <div className="ss-item" key={s.key}>
                  <i className="dot" style={{ background: s.cor }} />
                  <strong>{s.label}</strong>
                  <span>{s.valor} <small>({s.pct}%)</small></span>
                </div>
              ))}
              {semClassificar > 0 && (
                <div className="ss-item">
                  <i className="dot" style={{ background: '#3a3a3a' }} />
                  <strong>Sem classificação</strong>
                  <span>{semClassificar} <small>({pct(semClassificar, totLeads)}%)</small></span>
                </div>
              )}
            </div>
          </div>

          {/* ---------- sentimento por campanha ---------- */}
          <div className="panel card">
            <div className="card-head">
              <h2>Sentimento por campanha</h2>
              <span className="pill">{campanhas.length}</span>
            </div>
            <div className="camp-list">
              {campanhas.map(c => (
                <div className="camp-item" key={c.id}>
                  <div className="camp-head">
                    <strong>{c.nome}</strong>
                    <span className="camp-total">{c.leads} lead(s)</span>
                  </div>
                  <div className="camp-bar">
                    {c.hot > 0 && (
                      <div className="cb-seg" style={{ width: `${c.pctHot}%`, background: 'var(--danger)' }}
                        title={`Quente: ${c.hot} (${c.pctHot}%)`}>
                        {c.pctHot >= 10 && <span>{c.pctHot}%</span>}
                      </div>
                    )}
                    {c.warm > 0 && (
                      <div className="cb-seg" style={{ width: `${c.pctWarm}%`, background: 'var(--yellow)' }}
                        title={`Morno: ${c.warm} (${c.pctWarm}%)`}>
                        {c.pctWarm >= 10 && <span>{c.pctWarm}%</span>}
                      </div>
                    )}
                    {c.cold > 0 && (
                      <div className="cb-seg" style={{ width: `${c.pctCold}%`, background: 'var(--blue)' }}
                        title={`Frio: ${c.cold} (${c.pctCold}%)`}>
                        {c.pctCold >= 10 && <span>{c.pctCold}%</span>}
                      </div>
                    )}
                  </div>
                  <div className="camp-nums">
                    <span><i className="dot" style={{ background: 'var(--danger)' }} />Quente <strong>{c.hot}</strong></span>
                    <span><i className="dot" style={{ background: 'var(--yellow)' }} />Morno <strong>{c.warm}</strong></span>
                    <span><i className="dot" style={{ background: 'var(--blue)' }} />Frio <strong>{c.cold}</strong></span>
                    <span className="camp-conv">Vendas <strong>{c.vendas}</strong> ({c.conversao}%)</span>
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

          {/* ---------- qualificação do sentimento ---------- */}
          <div className="panel card">
            <div className="card-head">
              <h2>Qualificação do sentimento</h2>
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

          {/* ---------- ranking (somente gestor) ---------- */}
          {isGestor && (
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
                        <td><span className={`pos ${i === 0 ? 'top' : ''}`}>{i + 1}</span>{r.nome}</td>
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
          )}
        </>
      )}
    </>
  )
}

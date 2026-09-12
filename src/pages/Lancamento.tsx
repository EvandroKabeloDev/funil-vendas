import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import { traduzErro, type Broker } from '../lib/types'
import {
  ETAPAS_FUNIL, FORM_VAZIO, MOTIVOS, SENTIMENTOS,
  alertasSuaves, amanhaISO, formatarData, hojeISO, toInt, validar,
  type EntryForm
} from '../lib/entry'

export default function Lancamento() {
  const { profile, isGestor } = useAuth()
  const toast = useToast()

  const [brokers, setBrokers] = useState<Broker[]>([])
  const [brokerId, setBrokerId] = useState('')
  const [data, setData] = useState(hojeISO())
  const [form, setForm] = useState<EntryForm>(FORM_VAZIO)
  const [entryId, setEntryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // ---------- corretores que este usuario pode lancar ----------
  useEffect(() => {
    (async () => {
      let q = supabase
        .from('brokers')
        .select('id, org_id, team_id, profile_id, name, is_active')
        .eq('is_active', true)
        .order('name')
      if (!isGestor) q = q.eq('profile_id', profile!.id)

      const { data: rows, error } = await q
      if (error) toast(traduzErro(error), 'error')
      const list = (rows ?? []) as Broker[]
      setBrokers(list)
      setBrokerId(prev => prev || list[0]?.id || '')
      setLoading(false)
    })()
  }, [isGestor, profile, toast])

  // ---------- carrega o lancamento do dia (se existir) ----------
  const carregarDia = useCallback(async () => {
    if (!brokerId || !data) return
    setBusy(true)
    const { data: row, error } = await supabase
      .from('funnel_entries')
      .select('*')
      .eq('broker_id', brokerId)
      .eq('entry_date', data)
      .maybeSingle()
    setBusy(false)

    if (error) { toast(traduzErro(error), 'error'); return }

    if (row) {
      const { id, org_id, broker_id, entry_date, created_by, created_at, updated_at, ...campos } = row
      setEntryId(id)
      setForm({
        ...FORM_VAZIO,
        ...campos,
        note_hot: campos.note_hot ?? '',
        note_warm: campos.note_warm ?? '',
        note_cold: campos.note_cold ?? ''
      })
    } else {
      setEntryId(null)
      setForm(FORM_VAZIO)
    }
  }, [brokerId, data, toast])

  useEffect(() => { carregarDia() }, [carregarDia])

  const set = (campo: keyof EntryForm, valor: number | string) =>
    setForm(f => ({ ...f, [campo]: valor }))

  const erros = useMemo(() => validar(form), [form])
  const avisos = useMemo(() => alertasSuaves(form), [form])
  const somaSent = form.hot + form.warm + form.cold
  const restante = form.leads - somaSent

  async function salvar() {
    if (erros.length) return toast(erros[0], 'error')
    setBusy(true)
    const payload = {
      org_id: profile!.org_id,
      broker_id: brokerId,
      entry_date: data,
      ...form,
      note_hot: form.note_hot.trim() || null,
      note_warm: form.note_warm.trim() || null,
      note_cold: form.note_cold.trim() || null,
      created_by: profile!.id
    }
    // uq_entry_broker_date permite o upsert: regrava o dia em vez de duplicar
    const { error } = await supabase
      .from('funnel_entries')
      .upsert(payload, { onConflict: 'broker_id,entry_date' })
    setBusy(false)
    if (error) return toast(traduzErro(error), 'error')
    toast(entryId ? 'Lançamento atualizado.' : 'Lançamento salvo.')
    carregarDia()
  }

  async function excluir() {
    if (!entryId) return
    if (!confirm(`Excluir o lançamento de ${formatarData(data)}?`)) return
    setBusy(true)
    const { error } = await supabase.from('funnel_entries').delete().eq('id', entryId)
    setBusy(false)
    if (error) return toast(traduzErro(error), 'error')
    toast('Lançamento excluído.')
    setEntryId(null)
    setForm(FORM_VAZIO)
  }

  if (loading) return <div className="panel card"><div className="empty">Carregando…</div></div>

  if (!brokers.length) return (
    <div className="panel card">
      <div className="empty">
        {isGestor
          ? 'Cadastre ao menos um corretor em Cadastros para começar a lançar.'
          : 'Seu login ainda não está vinculado a um corretor. Peça ao gestor para fazer o vínculo em Cadastros.'}
      </div>
    </div>
  )

  return (
    <>
      {/* ---------- contexto do lancamento ---------- */}
      <div className="panel card ctx-bar">
        <div className="field">
          <label htmlFor="corretor">Corretor</label>
          <select id="corretor" value={brokerId} onChange={e => setBrokerId(e.target.value)} disabled={!isGestor && brokers.length === 1}>
            {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="data">Data</label>
          <input id="data" type="date" value={data} max={amanhaISO()} onChange={e => setData(e.target.value)} />
        </div>
        <div className={`status-chip ${entryId ? 'edit' : 'new'}`}>
          {entryId ? 'Editando dia já lançado' : 'Novo lançamento'}
        </div>
      </div>

      {/* ---------- leads e classificacao ---------- */}
      <div className="panel card">
        <div className="card-head">
          <h2>Leads recebidos</h2>
          <span className={`pill ${restante === 0 ? 'ok' : 'alert'}`}>
            {restante === 0 ? 'Classificação completa' : `Faltam ${restante > 0 ? restante : 0}`}
          </span>
        </div>

        <div className="big-field">
          <label htmlFor="leads">Total de leads do dia</label>
          <input
            id="leads" inputMode="numeric" className="big-input"
            value={form.leads} onChange={e => set('leads', toInt(e.target.value))}
          />
        </div>

        <div className="sent-grid">
          {SENTIMENTOS.map(s => {
            const total = form[s.key]
            return (
              <div className="sent-card" key={s.key} style={{ borderTopColor: s.cor }}>
                <div className="sent-head">
                  <div>
                    <strong style={{ color: s.cor }}>{s.label}</strong>
                    <small>{s.desc}</small>
                  </div>
                  <input
                    inputMode="numeric" className="sent-input"
                    value={total} onChange={e => set(s.key, toInt(e.target.value))}
                    aria-label={`Total de leads ${s.label}`}
                  />
                </div>

                <div className="reason-row">
                  {MOTIVOS.map(m => {
                    const campo = `${s.key}_${m.suf}` as keyof EntryForm
                    const v = form[campo] as number
                    return (
                      <div className="reason" key={m.suf}>
                        <label>{m.label}</label>
                        <input
                          inputMode="numeric"
                          className={v > total ? 'invalid' : ''}
                          value={v} onChange={e => set(campo, toInt(e.target.value))}
                        />
                      </div>
                    )
                  })}
                </div>

                <textarea
                  className="note" rows={2} maxLength={500}
                  placeholder={`Observações sobre os leads ${s.label.toLowerCase()}…`}
                  value={form[`note_${s.key}` as keyof EntryForm] as string}
                  onChange={e => set(`note_${s.key}` as keyof EntryForm, e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* ---------- etapas do funil ---------- */}
      <div className="panel card">
        <div className="card-head"><h2>Etapas do funil</h2></div>
        <div className="funnel-grid">
          {ETAPAS_FUNIL.map(et => (
            <div className="funnel-item" key={et.key}>
              <label htmlFor={et.key}>{et.label}</label>
              <input
                id={et.key} inputMode="numeric"
                value={form[et.key] as number}
                onChange={e => set(et.key as keyof EntryForm, toInt(e.target.value))}
              />
              <small>{et.desc}</small>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- validacao e acoes ---------- */}
      {erros.length > 0 && (
        <div className="panel card msg-box error">
          <strong>Ajuste antes de salvar</strong>
          <ul>{erros.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {erros.length === 0 && avisos.length > 0 && (
        <div className="panel card msg-box warn-box">
          <strong>Confira estes números</strong>
          <ul>{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <small>Não impede o salvamento — é só um alerta de digitação.</small>
        </div>
      )}

      <div className="action-bar">
        <button className="btn primary" onClick={salvar} disabled={busy || erros.length > 0}>
          {busy ? 'Salvando…' : entryId ? 'Atualizar lançamento' : 'Salvar lançamento'}
        </button>
        {entryId && (
          <button className="btn danger" onClick={excluir} disabled={busy}>Excluir dia</button>
        )}
      </div>
    </>
  )
}

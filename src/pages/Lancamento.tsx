import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import NumberInput from '../components/NumberInput'
import { traduzErro, type Broker, type Campaign } from '../lib/types'
import {
  ETAPAS_FUNIL, FORM_VAZIO, MOTIVOS, SENTIMENTOS,
  alertasSuaves, amanhaISO, formatarData, hojeISO, validar,
  type EntryForm
} from '../lib/entry'

const RASCUNHO = 'funil:rascunho'

export default function Lancamento() {
  const { profile, isGestor } = useAuth()
  const toast = useToast()

  const [brokers, setBrokers] = useState<Broker[]>([])
  const [campanhas, setCampanhas] = useState<Campaign[]>([])
  const [brokerId, setBrokerId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [data, setData] = useState(hojeISO())
  const [form, setForm] = useState<EntryForm>(FORM_VAZIO)
  const [entryId, setEntryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rascunhoRecuperado, setRascunhoRecuperado] = useState(false)
  const tocado = useRef(false)

  // ---------- corretores e campanhas ----------
  useEffect(() => {
    (async () => {
      let qb = supabase
        .from('brokers')
        .select('id, org_id, team_id, profile_id, name, is_active')
        .eq('is_active', true)
        .order('name')
      if (!isGestor) qb = qb.eq('profile_id', profile!.id)

      const [b, c] = await Promise.all([
        qb,
        supabase
          .from('campaigns')
          .select('id, org_id, name, is_active, created_by, created_at')
          .eq('is_active', true)
          .eq('created_by', profile!.id)   // cada um lança com as próprias campanhas
          .order('name')
      ])

      if (b.error) toast(traduzErro(b.error), 'error')
      const list = (b.data ?? []) as Broker[]
      setBrokers(list)
      setBrokerId(prev => prev || list[0]?.id || '')
      setCampanhas((c.data ?? []) as Campaign[])
      setLoading(false)
    })()
  }, [isGestor, profile, toast])

  // ---------- carrega o dia ----------
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

    // rascunho tem prioridade sobre o banco (aba descartada no iOS)
    const bruto = sessionStorage.getItem(RASCUNHO)
    if (bruto) {
      try {
        const r = JSON.parse(bruto)
        if (r.brokerId === brokerId && r.data === data) {
          setEntryId(row?.id ?? null)
          setCampaignId(r.campaignId ?? '')
          setForm(r.form)
          setRascunhoRecuperado(true)
          return
        }
      } catch { /* rascunho inválido, segue com o banco */ }
    }

    setRascunhoRecuperado(false)
    if (row) {
      const {
        id, org_id, broker_id, entry_date, created_by, created_at, updated_at,
        campaign_id, ...campos
      } = row
      setEntryId(id)
      setCampaignId(campaign_id ?? '')
      setForm({
        ...FORM_VAZIO, ...campos,
        note_hot: campos.note_hot ?? '',
        note_warm: campos.note_warm ?? '',
        note_cold: campos.note_cold ?? ''
      })
    } else {
      setEntryId(null); setCampaignId(''); setForm(FORM_VAZIO)
    }
  }, [brokerId, data, toast])

  useEffect(() => { carregarDia() }, [carregarDia])

  // ---------- rascunho automático ----------
  useEffect(() => {
    if (!tocado.current || !brokerId) return
    sessionStorage.setItem(RASCUNHO, JSON.stringify({ brokerId, data, campaignId, form }))
  }, [form, campaignId, brokerId, data])

  const set = (campo: keyof EntryForm, valor: number | string) => {
    tocado.current = true
    setForm(f => ({ ...f, [campo]: valor }))
  }

  const erros = useMemo(() => validar(form), [form])
  const avisos = useMemo(() => alertasSuaves(form), [form])
  const restante = form.leads - (form.hot + form.warm + form.cold)

  async function salvar() {
    if (erros.length) return toast(erros[0], 'error')
    setBusy(true)
    const payload = {
      org_id: profile!.org_id,
      broker_id: brokerId,
      entry_date: data,
      campaign_id: campaignId || null,
      ...form,
      note_hot: form.note_hot.trim() || null,
      note_warm: form.note_warm.trim() || null,
      note_cold: form.note_cold.trim() || null,
      created_by: profile!.id
    }
    const { error } = await supabase
      .from('funnel_entries')
      .upsert(payload, { onConflict: 'broker_id,entry_date' })
    setBusy(false)
    if (error) return toast(traduzErro(error), 'error')
    sessionStorage.removeItem(RASCUNHO)
    tocado.current = false
    setRascunhoRecuperado(false)
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
    sessionStorage.removeItem(RASCUNHO)
    toast('Lançamento excluído.')
    setEntryId(null); setForm(FORM_VAZIO); setCampaignId('')
  }

  function descartarRascunho() {
    sessionStorage.removeItem(RASCUNHO)
    tocado.current = false
    setRascunhoRecuperado(false)
    carregarDia()
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
      {rascunhoRecuperado && (
        <div className="panel card msg-box warn-box">
          <strong>Rascunho recuperado</strong>
          <ul><li>Recuperamos o que você estava digitando antes da tela apagar. Confira e salve.</li></ul>
          <button className="btn small ghost" onClick={descartarRascunho}>Descartar rascunho</button>
        </div>
      )}

      {/* ---------- contexto ---------- */}
      <div className="panel card ctx-bar">
        <div className="field">
          <label htmlFor="corretor">Corretor</label>
          <select id="corretor" value={brokerId} onChange={e => setBrokerId(e.target.value)}
            disabled={!isGestor && brokers.length === 1}>
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

      {/* ---------- leads ---------- */}
      <div className="panel card">
        <div className="card-head com-campanha">
          <h2>Leads recebidos</h2>
          <div className="head-campanha">
            <label htmlFor="campanha">Campanha</label>
            <select id="campanha" value={campaignId} onChange={e => { tocado.current = true; setCampaignId(e.target.value) }}>
              <option value="">{campanhas.length ? 'Sem campanha' : 'Nenhuma campanha cadastrada'}</option>
              {campanhas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <span className={`pill ${restante === 0 ? 'ok' : 'alert'}`}>
            {restante === 0 ? 'Classificação completa' : `Faltam ${restante > 0 ? restante : 0}`}
          </span>
        </div>

        <div className="big-field">
          <label htmlFor="leads">Total de leads do dia</label>
          <NumberInput id="leads" className="big-input" value={form.leads}
            onChange={v => set('leads', v)} ariaLabel="Total de leads do dia" />
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
                  <NumberInput className="sent-input" value={total}
                    onChange={v => set(s.key, v)} ariaLabel={`Total de leads ${s.label}`} />
                </div>

                <div className="reason-row">
                  {MOTIVOS.map(m => {
                    const campo = `${s.key}_${m.suf}` as keyof EntryForm
                    const v = form[campo] as number
                    return (
                      <div className="reason" key={m.suf}>
                        <label>{m.label}</label>
                        <NumberInput value={v} onChange={n => set(campo, n)}
                          invalid={v > total} ariaLabel={`${m.label} em ${s.label}`} />
                      </div>
                    )
                  })}
                </div>

                <textarea className="note" rows={2} maxLength={500}
                  placeholder={`Observações sobre os leads ${s.label.toLowerCase()}…`}
                  value={form[`note_${s.key}` as keyof EntryForm] as string}
                  onChange={e => set(`note_${s.key}` as keyof EntryForm, e.target.value)} />
              </div>
            )
          })}
        </div>
      </div>

      {/* ---------- etapas ---------- */}
      <div className="panel card">
        <div className="card-head"><h2>Etapas do funil</h2></div>
        <div className="funnel-grid">
          {ETAPAS_FUNIL.map(et => (
            <div className="funnel-item" key={et.key}>
              <label htmlFor={et.key}>{et.label}</label>
              <NumberInput id={et.key} value={form[et.key] as number}
                onChange={v => set(et.key as keyof EntryForm, v)} ariaLabel={et.label} />
              <small>{et.desc}</small>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- validação ---------- */}
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
        {entryId && <button className="btn danger" onClick={excluir} disabled={busy}>Excluir dia</button>}
      </div>
    </>
  )
}

// =====================================================================
// Regras de negocio do lancamento diario.
// Espelham exatamente as CHECK constraints de public.funnel_entries,
// para que o usuario receba o aviso na tela ANTES de o banco recusar.
// =====================================================================

export type Sentiment = 'hot' | 'warm' | 'cold'

export type EntryForm = {
  leads: number
  hot: number; warm: number; cold: number
  hot_product: number; hot_location: number; hot_price: number
  warm_product: number; warm_location: number; warm_price: number
  cold_product: number; cold_location: number; cold_price: number
  appointments: number
  attendance: number
  proposals: number
  relationships: number
  contracts: number
  sales: number
  note_hot: string
  note_warm: string
  note_cold: string
}

export const FORM_VAZIO: EntryForm = {
  leads: 0, hot: 0, warm: 0, cold: 0,
  hot_product: 0, hot_location: 0, hot_price: 0,
  warm_product: 0, warm_location: 0, warm_price: 0,
  cold_product: 0, cold_location: 0, cold_price: 0,
  appointments: 0, attendance: 0, proposals: 0,
  relationships: 0, contracts: 0, sales: 0,
  note_hot: '', note_warm: '', note_cold: ''
}

export const SENTIMENTOS: { key: Sentiment; label: string; desc: string; cor: string }[] = [
  { key: 'hot',  label: 'Quente',  desc: 'Alta intencao de compra',  cor: 'var(--danger)' },
  { key: 'warm', label: 'Morno',   desc: 'Precisa de aquecimento',   cor: 'var(--yellow)' },
  { key: 'cold', label: 'Frio',    desc: 'Baixa intencao no momento', cor: 'var(--blue)'   }
]

export const MOTIVOS = [
  { suf: 'product',  label: 'Produto' },
  { suf: 'location', label: 'Local'   },
  { suf: 'price',    label: 'Preco'   }
] as const

export const ETAPAS_FUNIL = [
  { key: 'appointments',  label: 'Agendamentos', desc: 'Visitas marcadas' },
  { key: 'attendance',    label: 'Comparecimento', desc: 'Compareceram a visita' },
  { key: 'proposals',     label: 'Propostas', desc: 'Propostas enviadas' },
  { key: 'relationships', label: 'Relacionamentos', desc: 'Follow-ups ativos' },
  { key: 'contracts',     label: 'Contratos', desc: 'Contratos assinados' },
  { key: 'sales',         label: 'Vendas', desc: 'Vendas concluidas' }
] as const

/** Data de hoje no fuso local, no formato aceito por <input type="date">. */
export function hojeISO(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

/** Limite superior do input: o banco aceita ate CURRENT_DATE + 1. */
export function amanhaISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short'
  })
}

/**
 * Valida o formulario inteiro. Retorna [] quando esta pronto para gravar.
 * A ordem dos avisos segue a ordem visual da tela.
 */
export function validar(f: EntryForm): string[] {
  const erros: string[] = []
  const soma = f.hot + f.warm + f.cold

  // ck_sentiment_sum
  if (soma !== f.leads) {
    const dif = f.leads - soma
    erros.push(
      dif > 0
        ? `Faltam classificar ${dif} lead(s): quente + morno + frio deve somar ${f.leads}.`
        : `Ha ${Math.abs(dif)} lead(s) classificado(s) a mais: a soma nao pode passar de ${f.leads}.`
    )
  }

  // ck_hot_reasons / ck_warm_reasons / ck_cold_reasons
  for (const s of SENTIMENTOS) {
    const total = f[s.key]
    for (const m of MOTIVOS) {
      const v = f[`${s.key}_${m.suf}` as keyof EntryForm] as number
      if (v > total) {
        erros.push(`Motivo "${m.label}" em ${s.label} (${v}) nao pode passar do total de ${s.label.toLowerCase()} (${total}).`)
      }
    }
  }

  // char_length(note_*) <= 500
  for (const s of SENTIMENTOS) {
    const nota = f[`note_${s.key}` as keyof EntryForm] as string
    if (nota.length > 500) erros.push(`A observacao de ${s.label} passou de 500 caracteres.`)
  }

  // checks de nao-negativo
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'number' && v < 0) { erros.push('Nenhum campo pode ser negativo.'); break }
  }

  return erros
}

/** Avisos que nao bloqueiam a gravacao, mas indicam provavel erro de digitacao. */
export function alertasSuaves(f: EntryForm): string[] {
  const a: string[] = []
  if (f.attendance > f.appointments) a.push('Comparecimento maior que agendamentos.')
  if (f.sales > f.contracts) a.push('Vendas maior que contratos.')
  if (f.contracts > f.proposals) a.push('Contratos maior que propostas.')
  if (f.appointments > f.leads && f.leads > 0) a.push('Agendamentos maior que o total de leads.')
  return a
}

export const toInt = (v: string): number => {
  const n = parseInt(v.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? Math.min(n, 99999) : 0
}

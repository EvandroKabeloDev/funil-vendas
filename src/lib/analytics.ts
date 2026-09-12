// =====================================================================
// Agregacoes da tela de Desempenho.
// Le de public.vw_funnel_entries (ja traz broker_name / team_name).
// Nenhuma dependencia externa: os graficos sao SVG/CSS puros.
// =====================================================================

export type EntryRow = {
  id: string
  broker_id: string
  broker_name: string
  team_id: string
  team_name: string
  entry_date: string
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
  note_hot: string | null
  note_warm: string | null
  note_cold: string | null
}

export type Periodo = '7' | '30' | '90' | 'mes'

export const PERIODOS: { key: Periodo; label: string }[] = [
  { key: '7',   label: '7 dias'     },
  { key: '30',  label: '30 dias'    },
  { key: '90',  label: '90 dias'    },
  { key: 'mes', label: 'Este mês'   }
]

/** Converte o periodo escolhido em [dataInicial, dataFinal] no formato ISO. */
export function intervalo(p: Periodo): [string, string] {
  const hoje = new Date()
  const fim = new Date(hoje)
  let ini: Date
  if (p === 'mes') {
    ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  } else {
    ini = new Date(hoje)
    ini.setDate(ini.getDate() - (Number(p) - 1))
  }
  const iso = (d: Date) => {
    const c = new Date(d)
    c.setMinutes(c.getMinutes() - c.getTimezoneOffset())
    return c.toISOString().slice(0, 10)
  }
  return [iso(ini), iso(fim)]
}

export const soma = (rows: EntryRow[], campo: keyof EntryRow): number =>
  rows.reduce((acc, r) => acc + (Number(r[campo]) || 0), 0)

/** Percentual seguro contra divisao por zero. */
export const pct = (parte: number, total: number): number =>
  total > 0 ? Math.round((parte / total) * 1000) / 10 : 0

export const ETAPAS_FUNIL_VIS = [
  { key: 'leads',         label: 'Leads'          },
  { key: 'appointments',  label: 'Agendamentos'   },
  { key: 'attendance',    label: 'Comparecimento' },
  { key: 'proposals',     label: 'Propostas'      },
  { key: 'contracts',     label: 'Contratos'      },
  { key: 'sales',         label: 'Vendas'         }
] as const

/** Funil com conversao acumulada (vs. leads) e etapa a etapa. */
export function montarFunil(rows: EntryRow[]) {
  const base = soma(rows, 'leads')
  return ETAPAS_FUNIL_VIS.map((et, i) => {
    const valor = soma(rows, et.key as keyof EntryRow)
    const anterior = i === 0 ? valor : soma(rows, ETAPAS_FUNIL_VIS[i - 1].key as keyof EntryRow)
    return {
      ...et,
      valor,
      pctBase: pct(valor, base),
      pctEtapa: i === 0 ? 100 : pct(valor, anterior),
      largura: base > 0 ? Math.max(pct(valor, base), 2) : 0
    }
  })
}

/** Ranking por corretor, ordenado por vendas e depois por taxa de conversao. */
export function porCorretor(rows: EntryRow[]) {
  const mapa = new Map<string, EntryRow[]>()
  for (const r of rows) {
    const arr = mapa.get(r.broker_id) ?? []
    arr.push(r)
    mapa.set(r.broker_id, arr)
  }
  return [...mapa.entries()]
    .map(([id, rs]) => {
      const leads = soma(rs, 'leads')
      const sales = soma(rs, 'sales')
      return {
        id,
        nome: rs[0].broker_name,
        equipe: rs[0].team_name,
        leads,
        agendamentos: soma(rs, 'appointments'),
        propostas: soma(rs, 'proposals'),
        contratos: soma(rs, 'contracts'),
        vendas: sales,
        conversao: pct(sales, leads),
        dias: new Set(rs.map(r => r.entry_date)).size
      }
    })
    .sort((a, b) => b.vendas - a.vendas || b.conversao - a.conversao)
}

/** Motivos de objecao somados e agrupados por sentimento. */
export function porMotivo(rows: EntryRow[]) {
  const sent = [
    { key: 'hot',  label: 'Quente', cor: 'var(--danger)' },
    { key: 'warm', label: 'Morno',  cor: 'var(--yellow)' },
    { key: 'cold', label: 'Frio',   cor: 'var(--blue)'   }
  ] as const
  const motivos = [
    { suf: 'product',  label: 'Produto' },
    { suf: 'location', label: 'Local'   },
    { suf: 'price',    label: 'Preço'   }
  ] as const

  const totalGeral = sent.reduce(
    (t, s) => t + motivos.reduce((x, m) => x + soma(rows, `${s.key}_${m.suf}` as keyof EntryRow), 0), 0
  )

  return {
    totalGeral,
    grupos: sent.map(s => ({
      ...s,
      total: soma(rows, s.key as keyof EntryRow),
      itens: motivos.map(m => {
        const v = soma(rows, `${s.key}_${m.suf}` as keyof EntryRow)
        return { label: m.label, valor: v, pct: pct(v, totalGeral) }
      })
    }))
  }
}

/** Serie diaria para o grafico de linha (leads x vendas). */
export function serieDiaria(rows: EntryRow[], de: string, ate: string) {
  const mapa = new Map<string, { leads: number; vendas: number }>()
  for (const r of rows) {
    const cur = mapa.get(r.entry_date) ?? { leads: 0, vendas: 0 }
    cur.leads += r.leads
    cur.vendas += r.sales
    mapa.set(r.entry_date, cur)
  }
  const out: { data: string; leads: number; vendas: number }[] = []
  const cursor = new Date(de + 'T12:00:00')
  const fim = new Date(ate + 'T12:00:00')
  while (cursor <= fim) {
    const iso = cursor.toISOString().slice(0, 10)
    const v = mapa.get(iso) ?? { leads: 0, vendas: 0 }
    out.push({ data: iso, ...v })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export const diaCurto = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

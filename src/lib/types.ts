export type Team = {
  id: string
  org_id: string
  name: string
  is_active: boolean
}

export type Broker = {
  id: string
  org_id: string
  team_id: string
  profile_id: string | null
  name: string
  is_active: boolean
}

export type TeamMate = {
  id: string
  full_name: string
  email: string
  role: 'gestor' | 'corretor'
}

/** Traduz erros do Postgres/Supabase para linguagem de negócio. */
export function traduzErro(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  if (/duplicate key|23505/i.test(raw)) return 'Já existe um registro com esse nome.'
  if (/violates foreign key|23503/i.test(raw)) return 'Existem registros vinculados. Remova-os primeiro.'
  if (/row-level security|42501/i.test(raw)) return 'Você não tem permissão para esta ação. Fale com o gestor.'
  if (/char_length|23514/i.test(raw)) return 'O nome deve ter entre 2 e 120 caracteres.'
  if (/Failed to fetch|NetworkError/i.test(raw)) return 'Sem conexão. Verifique sua internet e tente de novo.'
  return raw || 'Falha inesperada.'
}

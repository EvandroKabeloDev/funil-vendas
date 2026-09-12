export default function EmBreve({ etapa, tela }: { etapa: number; tela: string }) {
  return (
    <div className="panel card">
      <div className="card-head">
        <h2>{tela}</h2>
        <span className="pill">ETAPA {etapa}</span>
      </div>
      <p className="hint-block">
        Esta tela entra na Etapa {etapa}. A Etapa 2 entregou os <strong>Cadastros</strong> de
        equipes e corretores, que são a base para os lançamentos.
      </p>
    </div>
  )
}

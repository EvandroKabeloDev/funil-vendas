import type { KeyboardEvent } from 'react'

type Props = {
  id?: string
  value: number
  onChange: (v: number) => void
  className?: string
  ariaLabel?: string
  max?: number
  invalid?: boolean
}

/**
 * Campo numérico com setas de incremento/decremento.
 * Também aceita as setas do teclado (cima/baixo).
 */
export default function NumberInput({
  id, value, onChange, className = '', ariaLabel, max = 99999, invalid
}: Props) {
  const clamp = (n: number) => Math.max(0, Math.min(n, max))
  const passo = (dir: 1 | -1) => onChange(clamp(value + dir))

  function teclado(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp') { e.preventDefault(); passo(1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); passo(-1) }
  }

  return (
    <div className={`num-wrap ${invalid ? 'invalid' : ''}`}>
      <input
        id={id}
        inputMode="numeric"
        className={`num-input ${className}`}
        aria-label={ariaLabel}
        value={value}
        onKeyDown={teclado}
        onChange={e => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
          onChange(Number.isFinite(n) ? clamp(n) : 0)
        }}
      />
      <div className="num-steps">
        <button type="button" tabIndex={-1} aria-label="Aumentar" onClick={() => passo(1)}>▴</button>
        <button type="button" tabIndex={-1} aria-label="Diminuir" onClick={() => passo(-1)}>▾</button>
      </div>
    </div>
  )
}

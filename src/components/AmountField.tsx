import { type KeyboardEvent, type Ref } from 'react'
import { formatNokPlain, parseAmount } from '../format'

type Props = {
  id?: string
  value: string
  onChange: (raw: string) => void
  autoFocus?: boolean
  large?: boolean
  placeholder?: string
  inputRef?: Ref<HTMLInputElement>
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}

export function AmountField({
  id,
  value,
  onChange,
  autoFocus,
  large,
  placeholder = '0',
  inputRef,
  onKeyDown,
}: Props) {
  return (
    <label className={`amount-field ${large ? 'amount-field-large' : ''}`}>
      <input
        id={id}
        ref={inputRef}
        inputMode="numeric"
        enterKeyHint="done"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        onKeyDown={onKeyDown}
        onBlur={() => {
          const parsed = parseAmount(value)
          onChange(parsed === null ? '' : formatNokPlain(parsed))
        }}
        aria-label="Beløp i kroner"
      />
      <span className="amount-suffix">kr</span>
    </label>
  )
}

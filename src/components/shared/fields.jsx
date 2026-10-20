import { useId, useState } from 'react'
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { CheckIcon, ChevronDownIcon, CircleAlertIcon, EyeIcon, EyeOffIcon, PencilIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { thousands } from '@/lib/format'

const shell = 'flex h-[54px] items-center gap-2 rounded-lg border bg-field px-[18px] transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/15'
const tone = (error, highlight) => (error ? 'border-danger-border' : highlight ? 'border-warning-border bg-warning-bg' : 'border-input')

// `required` adds the visual * only; each control sets aria-required itself, so labels keep their accessible names.
export function FieldShell({ id, label, hint, error, optional, required, span, className, children, labelFor = true }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', span && 'sm:col-span-2', className)}>
      {label && (
        <div className="flex items-baseline gap-2 text-sm leading-5 font-semibold text-foreground">
          {labelFor ? <label htmlFor={id}>{label}</label> : <span id={`${id}-label`}>{label}</span>}
          {required && (
            <span className="-ml-1.5 text-danger" aria-hidden>
              *
            </span>
          )}
          {optional && <span className="text-xs font-medium text-muted-foreground">Opsional</span>}
        </div>
      )}
      {children}
      {hint && (
        <span id={`${id}-hint`} className="text-xs leading-[18px] text-muted-foreground">
          {hint}
        </span>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ id, children }) {
  return (
    <span id={id} role="alert" className="flex items-center gap-1.5 text-xs leading-[18px] font-semibold text-danger">
      <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  )
}

const describedBy = (id, hint, error) => [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

export function TextField({ label, name, value, onChange, onBlur, error, hint, optional, required, span, placeholder, type = 'text', inputMode, autoComplete, prefix, suffix, trailing, highlight, max, min, maxLength, className, disabled }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} required={required} span={span} className={className}>
      <div className={cn(shell, tone(error, highlight), disabled && 'opacity-60')}>
        {prefix && <span className="text-[15px] font-bold text-muted-foreground" aria-hidden>{prefix}</span>}
        <input
          id={id}
          name={name}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          max={max}
          min={min}
          maxLength={maxLength}
          disabled={disabled}
          aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-placeholder"
        />
        {suffix && <span className="text-sm font-semibold whitespace-nowrap text-muted-foreground">{suffix}</span>}
        {trailing}
      </div>
    </FieldShell>
  )
}

// A toggle button, not a changing label: aria-pressed tells whether the password is shown.
export function PasswordField(props) {
  const [shown, setShown] = useState(false)
  const Icon = shown ? EyeOffIcon : EyeIcon
  return (
    <TextField
      {...props}
      type={shown ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-label={`Tampilkan ${props.label.toLowerCase()}`}
          className="-mr-3.5 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
        >
          <Icon className="size-5" aria-hidden />
        </button>
      }
    />
  )
}

// Keeps the raw digit string in state; shows Indonesian thousands separators.
export function MoneyField({ onChange, value, ...props }) {
  return <TextField {...props} value={thousands(value)} onChange={(v) => onChange(v.replace(/\D/g, ''))} prefix="Rp" inputMode="numeric" />
}

export function NumberField({ onChange, ...props }) {
  return <TextField {...props} onChange={(v) => onChange(v.replace(/\D/g, ''))} inputMode="numeric" />
}

export function RateField({ onChange, ...props }) {
  return <TextField suffix="% per tahun" placeholder="5,50" {...props} onChange={(v) => onChange(v.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, ''))} inputMode="decimal" />
}

export function DateField(props) {
  return <TextField {...props} type="date" />
}

export function TextAreaField({ label, name, value, onChange, onBlur, error, hint, optional, required, span, placeholder, rows = 2, highlight }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} required={required} span={span}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn('w-full resize-y rounded-lg border bg-field px-[18px] py-3.5 text-[15px] leading-[22px] font-medium outline-none placeholder:text-placeholder focus:border-primary focus:ring-3 focus:ring-ring/15', tone(error, highlight))}
      />
    </FieldShell>
  )
}

export function SelectField({ label, name, value, onChange, onBlur, error, hint, optional, required, span, placeholder = 'Pilih…', options, highlight }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} required={required} span={span}>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn('h-[54px] w-full cursor-pointer appearance-none rounded-lg border bg-field pr-11 pl-[18px] text-[15px] font-medium outline-none focus:border-primary focus:ring-3 focus:ring-ring/15', tone(error, highlight), !value && 'text-placeholder')}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </FieldShell>
  )
}

const SHOWN = 50

// Type-to-search select (ARIA 1.2 combobox) for long lists such as the 514 kota/kabupaten. Only an option can become
// the value: typed text that matches none goes back to the saved value on blur. `o.hint` shows on the right.
export function ComboboxField({ label, name, value, onChange, onBlur, error, hint, optional, required, span, placeholder = 'Ketik untuk mencari…', options, highlight }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(null) // null until the user types; the field shows the value meanwhile
  const [active, setActive] = useState(0)
  const q = (query ?? '').trim().toLowerCase()
  const matches = open ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : []
  const shown = matches.slice(0, SHOWN)
  const optId = (i) => `${id}-opt-${i}`
  const close = () => {
    setOpen(false)
    setQuery(null)
  }
  const pick = (o) => {
    onChange(o.value)
    close()
  }
  const move = (step) => {
    const next = Math.max(0, Math.min(shown.length - 1, active + step))
    setActive(next)
    document.getElementById(optId(next))?.scrollIntoView?.({ block: 'nearest' })
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (open) move(e.key === 'ArrowDown' ? 1 : -1)
      else setOpen(true)
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      if (shown[active]) pick(shown[active])
    } else if (e.key === 'Escape' && open) {
      close() // FormDialog keeps the dialog open while the list is (aria-expanded)
    }
  }
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} required={required} span={span}>
      <div className="relative">
        <input
          id={id}
          name={name}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && shown[active] ? optId(active) : undefined}
          aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, hint, error)}
          autoComplete="off"
          value={query ?? options.find((o) => o.value === value)?.label ?? value ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          // Whole value selected until typing starts, so typing replaces it instead of appending.
          onClick={(e) => {
            setOpen(true)
            if (query === null) e.target.select()
          }}
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            close()
            onBlur?.()
          }}
          onKeyDown={onKeyDown}
          className={cn('h-[54px] w-full rounded-lg border bg-field pr-11 pl-[18px] text-[15px] font-medium outline-none placeholder:text-placeholder focus:border-primary focus:ring-3 focus:ring-ring/15', tone(error, highlight))}
        />
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
        {open && (
          // mousedown would blur the input (closing the list) before the click lands on an option.
          <div onMouseDown={(e) => e.preventDefault()} className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-pop">
            <ul id={`${id}-list`} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto py-1">
              {shown.map((o, i) => (
                <li
                  key={o.value}
                  id={optId(i)}
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => pick(o)}
                  onMouseMove={() => i !== active && setActive(i)}
                  className={cn('flex min-h-11 cursor-pointer items-center justify-between gap-3 px-[18px] py-2 text-[15px]', i === active && 'bg-muted', o.value === value && 'font-bold text-primary')}
                >
                  <span className="min-w-0">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-[13px] font-medium text-muted-foreground">{o.hint}</span>}
                </li>
              ))}
            </ul>
            {!shown.length && <p className="px-[18px] py-3 text-sm text-muted-foreground">Tidak ditemukan. Coba kata lain.</p>}
            {matches.length > SHOWN && <p className="border-t border-border px-[18px] py-2.5 text-xs text-muted-foreground">Ketik untuk mempersempit pilihan.</p>}
          </div>
        )}
      </div>
    </FieldShell>
  )
}

const OTHER = '__other'

// Radio options rendered as cards (artifact "radio" pattern) with Radix keyboard semantics.
// `other` adds a last card (its label) that swaps in a free-text input; the typed text becomes the value.
export function RadioCards({ label, name, value, onChange, onBlur, error, hint, required, span, options, layout = 'row', variant = 'card', other }) {
  const id = useId()
  const [picked, setPicked] = useState(false)
  const custom = !!other && (value ? !options.some((o) => o.value === value) : picked)
  const invalid = error ? 'true' : undefined
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} span={span} labelFor={false}>
      <RadioGroupPrimitive.Root
        value={custom ? OTHER : value ?? ''}
        onValueChange={(v) => {
          setPicked(v === OTHER)
          onChange(v === OTHER ? '' : v)
        }}
        onBlur={custom ? undefined : onBlur}
        name={custom ? undefined : name}
        aria-labelledby={label ? `${id}-label` : undefined}
        required={required}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={custom ? undefined : invalid}
        className={cn('flex gap-2.5', layout === 'column' ? 'flex-col' : 'flex-wrap')}
      >
        {(other ? [...options, { value: OTHER, label: other }] : options).map((o) => (
          <RadioGroupPrimitive.Item
            key={o.value}
            value={o.value}
            className={cn(
              'group flex text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
              variant === 'pill'
                ? 'h-12 min-w-[120px] items-center justify-center rounded-full border px-5 text-sm font-bold data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white'
                : 'min-h-[54px] items-start gap-3 rounded-lg border px-4 py-3.5 text-[15px] font-semibold data-[state=checked]:border-primary data-[state=checked]:bg-secondary data-[state=checked]:text-primary',
              // basis sets width in a row but height in a column, so only rows share the line
              variant !== 'pill' && layout !== 'column' && 'flex-1 basis-[150px]',
              error && !custom ? 'border-danger-border' : 'border-input bg-card',
            )}
          >
            {variant !== 'pill' && (
              <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-border-strong group-data-[state=checked]:border-primary">
                <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
              </span>
            )}
            <span className="flex flex-col gap-1">
              <span>{o.label}</span>
              {o.description && <span className="text-[13px] leading-[19px] font-medium text-muted-foreground">{o.description}</span>}
            </span>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
      {custom && (
        <div className={cn(shell, tone(error))}>
          {/* Typing keeps the box open even when the text is cleared back to empty. */}
          <input
            name={name}
            value={value ?? ''}
            onChange={(e) => {
              setPicked(true)
              onChange(e.target.value)
            }}
            onBlur={onBlur}
            placeholder="Tulis di sini"
            maxLength={50}
            autoFocus={picked}
            aria-label={`${label} lainnya`}
            aria-required={required || undefined}
            aria-invalid={invalid}
            aria-describedby={describedBy(id, hint, error)}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-placeholder"
          />
        </div>
      )}
    </FieldShell>
  )
}

export function CheckboxField({ label, checked, onChange, error, hint, boxed = false, span, name, disabled, tag }) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-2', span && 'sm:col-span-2')}>
      <label
        htmlFor={id}
        className={cn('flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-[21px] font-semibold text-foreground', boxed && 'items-center rounded-lg border border-input bg-card px-4 py-3.5', boxed && checked && 'border-primary', disabled && 'cursor-not-allowed text-muted-foreground')}
      >
        <CheckboxPrimitive.Root
          id={id}
          name={name}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onChange(v === true)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn('mt-px flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 border-border-strong bg-card text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:bg-muted', error && 'border-danger-border')}
        >
          <CheckboxPrimitive.Indicator>
            <CheckIcon className="size-3.5" strokeWidth={3} />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        <span className="flex flex-wrap items-center gap-2">
          {label}
          {tag && <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{tag}</span>}
        </span>
      </label>
      {hint && <span id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</span>}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

export function ReadonlyField({ label, value, sub, onEdit, span }) {
  return (
    <div className={cn('flex flex-col gap-2', span && 'sm:col-span-2')}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <div className="flex min-h-[54px] items-center justify-between gap-3 rounded-lg border border-dashed border-input px-[18px] py-2">
        <span className="flex flex-col">
          <span className="text-[15px] font-bold">{value}</span>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-primary">
            <PencilIcon className="size-3.5" aria-hidden />
            Ubah
          </button>
        )}
      </div>
    </div>
  )
}

export function FormGrid({ children, className }) {
  return <div className={cn('grid grid-cols-1 gap-[18px] sm:grid-cols-2', className)}>{children}</div>
}

export function ErrorSummary({ show, count }) {
  if (!show) return null
  return (
    <div role="alert" className="flex items-center gap-2.5 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
      <CircleAlertIcon className="size-4 shrink-0" aria-hidden />
      Periksa kembali {count} field yang ditandai.
    </div>
  )
}

import { useId, useState } from 'react'
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { CheckIcon, ChevronDownIcon, CircleAlertIcon, PencilIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { thousands } from '@/lib/format'

const shell = 'flex h-[54px] items-center gap-2 rounded-lg border bg-field px-[18px] transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/15'
const tone = (error, highlight) => (error ? 'border-brand-red' : highlight ? 'border-warning-accent bg-warning-soft' : 'border-input')

// `required` adds the visual * only; each control sets aria-required itself, so labels keep their accessible names.
export function FieldShell({ id, label, hint, error, optional, required, span, className, children, labelFor = true }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', span && 'sm:col-span-2', className)}>
      {label && (
        <div className="flex items-baseline gap-2 text-sm leading-5 font-semibold text-ink-2">
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

export function TextField({ label, name, value, onChange, onBlur, error, hint, optional, required, span, placeholder, type = 'text', inputMode, autoComplete, prefix, suffix, highlight, max, min, maxLength, className, disabled }) {
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
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-[#8a93a3]"
        />
        {suffix && <span className="text-sm font-semibold whitespace-nowrap text-muted-foreground">{suffix}</span>}
      </div>
    </FieldShell>
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
        className={cn('w-full resize-y rounded-lg border bg-field px-[18px] py-3.5 text-[15px] leading-[22px] font-medium outline-none placeholder:text-[#8a93a3] focus:border-primary focus:ring-3 focus:ring-ring/15', tone(error, highlight))}
      />
    </FieldShell>
  )
}

const OTHER = '__other'

// `other` adds a "Lainnya" option that swaps in a free-text input (its placeholder); the typed text becomes the value.
export function SelectField({ label, name, value, onChange, onBlur, error, hint, optional, required, span, placeholder = 'Pilih…', options, highlight, other }) {
  const id = useId()
  const [picked, setPicked] = useState(false)
  const custom = !!other && (value ? !options.some((o) => o.value === value) : picked)
  const invalid = error ? 'true' : undefined
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} required={required} span={span}>
      <div className="relative">
        <select
          id={id}
          name={custom ? undefined : name}
          value={custom ? OTHER : value ?? ''}
          onChange={(e) => {
            setPicked(e.target.value === OTHER)
            onChange(e.target.value === OTHER ? '' : e.target.value)
          }}
          onBlur={custom ? undefined : onBlur}
          aria-required={required || undefined}
          aria-invalid={custom ? undefined : invalid}
          aria-describedby={describedBy(id, hint, error)}
          className={cn('h-[54px] w-full cursor-pointer appearance-none rounded-lg border bg-field pr-11 pl-[18px] text-[15px] font-medium outline-none focus:border-primary focus:ring-3 focus:ring-ring/15', custom ? 'border-input' : tone(error, highlight), !value && !custom && 'text-[#6b7587]')}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {other && <option value={OTHER}>Lainnya</option>}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
      {custom && (
        <div className={cn(shell, tone(error, highlight))}>
          <input
            name={name}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={other}
            maxLength={50}
            autoFocus={picked}
            aria-label={`${label} lainnya`}
            aria-required={required || undefined}
            aria-invalid={invalid}
            aria-describedby={describedBy(id, hint, error)}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-[#8a93a3]"
          />
        </div>
      )}
    </FieldShell>
  )
}

// Radio options rendered as cards (artifact "radio" pattern) with Radix keyboard semantics.
export function RadioCards({ label, name, value, onChange, onBlur, error, hint, required, span, options, layout = 'row', variant = 'card' }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} span={span} labelFor={false}>
      <RadioGroupPrimitive.Root
        value={value ?? ''}
        onValueChange={onChange}
        onBlur={onBlur}
        name={name}
        aria-labelledby={label ? `${id}-label` : undefined}
        required={required}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? 'true' : undefined}
        className={cn('flex gap-2.5', layout === 'column' ? 'flex-col' : 'flex-wrap')}
      >
        {options.map((o) => (
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
              error ? 'border-brand-red' : 'border-input bg-card',
            )}
          >
            {variant !== 'pill' && (
              <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[#b8c2d3] group-data-[state=checked]:border-primary">
                <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
              </span>
            )}
            <span className="flex flex-col gap-1">
              <span>{o.label}</span>
              {o.description && <span className="text-[13px] leading-[19px] font-medium text-muted-foreground group-data-[state=checked]:text-ink-3">{o.description}</span>}
            </span>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </FieldShell>
  )
}

export function CheckboxField({ label, checked, onChange, error, hint, boxed = false, span, name, disabled, tag }) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-2', span && 'sm:col-span-2')}>
      <label
        htmlFor={id}
        className={cn('flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-[21px] font-semibold text-ink-2', boxed && 'items-center rounded-lg border border-input bg-card px-4 py-3.5', boxed && checked && 'border-primary', disabled && 'cursor-not-allowed text-muted-foreground')}
      >
        <CheckboxPrimitive.Root
          id={id}
          name={name}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onChange(v === true)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn('mt-px flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 border-[#b8c2d3] bg-card text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:bg-muted', error && 'border-brand-red')}
        >
          <CheckboxPrimitive.Indicator>
            <CheckIcon className="size-3.5" strokeWidth={3} />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        <span className="flex flex-wrap items-center gap-2">
          {label}
          {tag && <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-bold text-ink-3">{tag}</span>}
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
      <span className="text-sm font-semibold text-ink-2">{label}</span>
      <div className="flex min-h-[54px] items-center justify-between gap-3 rounded-lg border border-dashed border-[#d5dbe6] px-[18px] py-2">
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
    <div role="alert" className="flex items-center gap-2.5 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-strong">
      <CircleAlertIcon className="size-4 shrink-0" aria-hidden />
      Periksa kembali {count} field yang ditandai.
    </div>
  )
}

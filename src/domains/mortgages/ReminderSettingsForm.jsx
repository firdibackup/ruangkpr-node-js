import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateLong } from '@/lib/format'
import { FieldError } from '@/components/shared/fields'

const PAYMENT = [
  [7, 'H-7'],
  [3, 'H-3'],
  [1, 'H-1'],
  [0, 'Hari-H'],
]
const FIXED = [90, 60, 30, 14, 7]

function Chip({ label, checked, onChange, disabled, tag }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'flex min-h-11 items-center gap-2.5 rounded-lg border px-4 text-sm font-semibold',
        disabled ? 'cursor-not-allowed border-border bg-muted text-muted-foreground' : checked ? 'border-primary bg-secondary' : 'border-input bg-card',
      )}
    >
      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md border-2 text-white', checked ? 'border-primary bg-primary' : disabled ? 'border-[#d5dbe6] bg-card' : 'border-[#b8c2d3] bg-card')} aria-hidden>
        {checked && <CheckIcon className="size-3" strokeWidth={3} />}
      </span>
      {label}
      {tag && <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-bold text-ink-3">{tag}</span>}
    </button>
  )
}

function Group({ title, sub, children, note, error }) {
  return (
    <fieldset className="flex flex-col gap-3.5 rounded-[18px] border border-border p-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-extrabold">{title}</span>
        {sub && <span className="text-[13px] text-muted-foreground">{sub}</span>}
      </div>
      {note && <div className="rounded-xl bg-muted px-4 py-3.5 text-[13px] leading-5 text-ink-3">{note}</div>}
      {children && <div className="flex flex-wrap gap-2.5">{children}</div>}
      {error && <FieldError>{error}</FieldError>}
    </fieldset>
  )
}

// Reminder preferences (doc 02 MON-05): payment H-7/H-3/H-1 default, fixed expiry H-90…H-7 while fixed,
// in-app + email channels; WhatsApp stays disabled until a provider exists.
export function ReminderSettingsForm({ value, onChange, dueDay, isFixed, fixedUntil, errors = {} }) {
  const toggle = (key, n) => (on) => onChange({ ...value, [key]: on ? [...value[key], n].sort((a, b) => b - a) : value[key].filter((x) => x !== n) })
  const channel = (k) => (on) => onChange({ ...value, channels: { ...value.channels, [k]: on } })
  return (
    <div className="flex flex-col gap-4">
      <Group title="Pembayaran bulanan" sub={dueDay && `Jatuh tempo setiap tanggal ${dueDay}${dueDay > 28 ? ' (di bulan tanpa tanggal itu, jatuh pada hari terakhir bulan)' : ''}`} error={errors.payment}>
        {PAYMENT.map(([n, label]) => (
          <Chip key={n} label={label} checked={value.payment.includes(n)} onChange={toggle('payment', n)} />
        ))}
      </Group>
      {isFixed ? (
        <Group title="Masa fixed berakhir" sub={fixedUntil && dateLong(fixedUntil)}>
          {FIXED.map((n) => (
            <Chip key={n} label={`H-${n}`} checked={value.fixedExpiry.includes(n)} onChange={toggle('fixedExpiry', n)} />
          ))}
        </Group>
      ) : (
        <Group title="Masa fixed berakhir" note="KPR kamu sudah menggunakan bunga floating. Reminder berakhirnya fixed tidak diperlukan. Kami tetap mengingatkan jadwal pembayaran dan peluang yang relevan." />
      )}
      <Group title="Kirim melalui" error={errors.channels} note="Notifikasi aplikasi masuk ke Activity. Izin notifikasi browser tidak diminta otomatis.">
        <Chip label="Notifikasi aplikasi" checked={value.channels.inApp} onChange={channel('inApp')} />
        <Chip label="Email" checked={value.channels.email} onChange={channel('email')} />
        <Chip label="WhatsApp" checked={false} disabled tag="Segera hadir" onChange={() => {}} />
      </Group>
    </div>
  )
}

export function reminderSummary(r, isFixed) {
  const pay = [7, 3, 1, 0].filter((n) => r.payment.includes(n)).map((n) => (n ? `H-${n}` : 'Hari-H')).join(', ') || 'Tidak aktif'
  const fixed = !isFixed ? 'Tidak diperlukan (floating)' : r.fixedExpiry.map((n) => `H-${n}`).join(', ') || 'Tidak aktif'
  const ch = [r.channels.inApp && 'In-app', r.channels.email && 'Email'].filter(Boolean).join(', ') || 'Belum ada kanal'
  return { pay, fixed, ch }
}

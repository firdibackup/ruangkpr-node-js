import { useRef, useState } from 'react'
import { CircleAlertIcon, FileCheckIcon, FileXIcon, LoaderCircleIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_UPLOAD, acceptOf, uploadProblem } from '@/data/documentRules'
import { ProgressBar } from './ui'

const VIEW = {
  pending: { icon: UploadIcon, box: 'bg-muted text-ink-3', chip: 'bg-muted text-ink-3', text: 'Belum diunggah', border: 'border-border' },
  uploading: { icon: LoaderCircleIcon, box: 'bg-secondary text-primary', chip: 'bg-secondary text-primary', text: 'Mengunggah', border: 'border-border' },
  uploaded: { icon: FileCheckIcon, box: 'bg-success-bg text-success', chip: 'bg-success-bg text-success', text: '✓ Terunggah', border: 'border-border' },
  verified: { icon: FileCheckIcon, box: 'bg-success-bg text-success', chip: 'bg-success-bg text-success', text: '✓ Terverifikasi', border: 'border-border' },
  needs_update: { icon: TriangleAlertIcon, box: 'bg-warning-bg text-warning-text', chip: 'bg-warning-bg text-warning', text: '⚠ Perlu diperbarui', border: 'border-[#f3d9a4]' },
  error: { icon: FileXIcon, box: 'bg-danger-bg text-danger', chip: 'bg-danger-bg text-danger', text: '✕ Gagal', border: 'border-danger-border' },
}

// Document checklist row (artifact C23): pending → uploading → uploaded / error, retry per item.
// Only metadata leaves this component; file bytes are never persisted. `rules`: the snapshot's `config.upload`.
export function UploadRow({ doc, state, onUpload, readOnly = false, compact = false, rules = DEFAULT_UPLOAD }) {
  const input = useRef(null)
  const [local, setLocal] = useState(null) // { status: 'uploading'|'error', pct, message }
  const status = local?.status ?? state?.status ?? 'pending'
  const v = VIEW[status] ?? VIEW.pending
  const canAct = !readOnly && status !== 'uploading'
  const Icon = v.icon

  const pick = () => input.current?.click()
  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = uploadProblem(file, rules)
    if (problem) return setLocal({ status: 'error', message: problem.message })
    setLocal({ status: 'uploading', pct: 5 })
    try {
      await onUpload({ name: file.name, size: file.size, type: file.type }, (pct) => setLocal((l) => (l?.status === 'uploading' ? { ...l, pct } : l)))
      setLocal(null)
    } catch (err) {
      setLocal({ status: 'error', message: err?.message ?? 'Upload gagal. Periksa koneksi lalu coba lagi.' })
    }
  }

  const buttonLabel = status === 'error' ? 'Coba Lagi' : ['uploaded', 'verified'].includes(status) ? 'Ganti' : status === 'needs_update' ? 'Upload ulang' : 'Upload'
  const sub = ['uploaded', 'verified', 'needs_update'].includes(status) && state?.fileName ? `${state.fileName}${state.fromProfile ? ' · dari Profil' : ''}` : doc.hint

  return (
    <div className={cn('flex flex-col gap-2.5 rounded-2xl border bg-card', compact ? 'p-3.5' : 'p-4', v.border)}>
      <div className="flex flex-wrap items-center gap-3.5">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', v.box)} aria-hidden>
          <Icon className={cn('size-5', status === 'uploading' && 'animate-spin')} />
        </span>
        <div className="flex min-w-[160px] flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold">{doc.label}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', doc.required ? 'bg-danger-bg text-danger-strong' : 'bg-muted text-ink-3')}>{doc.required ? 'Wajib' : 'Opsional'}</span>
          </span>
          {sub && <span className="text-[13px] [overflow-wrap:anywhere] text-muted-foreground">{sub}</span>}
          {status === 'needs_update' && state?.invalidReason && <span className="text-[13px] font-semibold text-warning-text">{state.invalidReason}</span>}
        </div>
        <span className={cn('rounded-full px-2.5 py-1.5 text-xs font-bold whitespace-nowrap', v.chip)} role="status">
          {status === 'uploading' ? `Mengunggah ${local?.pct ?? 0}%` : v.text}
        </span>
        {canAct && (
          <button type="button" onClick={pick} className="h-10 rounded-full bg-secondary px-[18px] text-[13px] font-bold text-primary hover:bg-[#dbe6f8]" aria-label={`${buttonLabel} ${doc.label}`}>
            {buttonLabel}
          </button>
        )}
        <input ref={input} type="file" accept={acceptOf(rules)} className="sr-only" tabIndex={-1} onChange={onFile} aria-hidden />
      </div>
      {status === 'uploading' && <ProgressBar value={local?.pct ?? 0} size="sm" label={`Progres unggah ${doc.label}`} />}
      {status === 'error' && local?.message && (
        <span role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-danger">
          <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
          {local.message.startsWith('Upload gagal') ? local.message : `Upload gagal. ${local.message}`}
        </span>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { AlertDialog as AlertDialogPrimitive, Dialog as DialogPrimitive } from 'radix-ui'
import { CircleCheckIcon, Trash2Icon, XIcon } from 'lucide-react'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from './ui'

const overlay = 'fixed inset-0 z-50 bg-[#0b1b3380] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
const content =
  'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-card bg-card p-7 text-foreground shadow-pop outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'

// Destructive/important confirmation. Stays open while `onConfirm` runs; errors are shown inline.
export function ConfirmDialog({ open, onOpenChange, title, body, note, children, confirmLabel = 'Ya, Hapus', cancelLabel = 'Batal', confirmDisabled = false, destructive = true, icon: Icon = Trash2Icon, onConfirm }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const confirm = async () => {
    setPending(true)
    setError('')
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (e) {
      setError(e?.message ?? 'Gagal memproses. Coba lagi.')
    } finally {
      setPending(false)
    }
  }
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={overlay} />
        <AlertDialogPrimitive.Content className={cn(content, 'max-w-[440px]')} onEscapeKeyDown={(e) => pending && e.preventDefault()}>
          {destructive && (
            <span className="flex size-[52px] items-center justify-center rounded-full bg-danger-bg text-danger" aria-hidden>
              <Icon className="size-[22px]" />
            </span>
          )}
          <div className="flex flex-col gap-2">
            <AlertDialogPrimitive.Title className="text-xl font-extrabold">{title}</AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm leading-[21px] text-ink-3">{body}</AlertDialogPrimitive.Description>
            {note && <p className="text-sm font-semibold text-success">{note}</p>}
          </div>
          {children}
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-danger">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="neutral" size="md" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button variant={destructive ? 'destructive' : 'default'} size="md" onClick={confirm} disabled={pending || confirmDisabled} aria-busy={pending}>
              {pending && <Spinner />}
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export function FormDialog({ open, onOpenChange, title, description, children, className }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content className={cn(content, 'max-w-[480px]', className)} {...(!description && { 'aria-describedby': undefined })}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <DialogPrimitive.Title className="text-xl font-extrabold">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="text-sm leading-[21px] text-ink-3">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-foreground hover:bg-muted" aria-label="Tutup">
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// Celebration pop-up after a flow completes; fires confetti once on mount (skipped for reduced motion).
export function SuccessDialog({ title, body, children, onClose }) {
  useEffect(() => {
    const burst = (x, angle) => confetti({ particleCount: 140, spread: 75, startVelocity: 60, angle, origin: { x, y: 0.75 }, disableForReducedMotion: true })
    burst(0, 60)
    burst(1, 120)
    const t = setTimeout(() => confetti({ particleCount: 160, spread: 120, origin: { y: 0.4 }, disableForReducedMotion: true }), 350)
    return () => {
      clearTimeout(t)
      confetti.reset()
    }
  }, [])
  return (
    <DialogPrimitive.Root open onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content className={cn(content, 'max-w-[440px] items-center text-center')}>
          <span className="flex size-[72px] items-center justify-center rounded-full bg-success-bg text-success-strong" aria-hidden>
            <CircleCheckIcon className="size-9" />
          </span>
          <div className="flex flex-col gap-2">
            <DialogPrimitive.Title className="text-2xl font-extrabold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-[15px] leading-[22px] text-ink-3">{body}</DialogPrimitive.Description>
          </div>
          {children}
          <DialogPrimitive.Close asChild>
            <Button className="mt-1 w-full">Lihat Dashboard</Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// Blocks in-app navigation while there are unsaved edits (doc 02 §14 "Unsaved changes").
export function UnsavedChangesGuard({ when }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname)
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => !open && blocker.state === 'blocked' && blocker.reset()}
      title="Perubahan belum disimpan."
      body="Keluar tanpa menyimpan perubahan? Data yang baru kamu isi di halaman ini akan hilang."
      cancelLabel="Tetap di Halaman"
      confirmLabel="Keluar Tanpa Menyimpan"
      onConfirm={async () => blocker.proceed()}
    />
  )
}

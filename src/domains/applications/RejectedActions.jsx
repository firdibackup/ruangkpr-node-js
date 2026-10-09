import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/data/api'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/shared/ui'
import { resumePath } from './meta'

// Two recovery paths (PRD §9.13): clone to another bank (old row stays as history) or fix & resubmit same row.
export function RejectedActions({ app }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState(null)
  const run = async (kind) => {
    setPending(kind)
    try {
      if (kind === 'clone') {
        const next = await api.applications.cloneToBank(app.id)
        toast('Data & dokumen valid disalin ke pengajuan baru. Pilih bank lain.')
        navigate(next.productType === 'primary' ? '/apply/primary/6' : '/optimize/baseline')
      } else {
        const same = await api.applications.retrySameBank(app.id)
        toast('Perbaiki data yang ditandai, lalu ajukan ulang.')
        navigate(resumePath(same))
      }
    } catch (e) {
      toast.error(e.message)
      setPending(null)
    }
  }
  return (
    <div className="flex flex-wrap gap-3">
      <Button size="md" onClick={() => run('clone')} disabled={!!pending} aria-busy={pending === 'clone'}>
        {pending === 'clone' && <Spinner />}
        Ajukan ke Bank Lain
      </Button>
      <Button size="md" variant="outline" onClick={() => run('fix')} disabled={!!pending} aria-busy={pending === 'fix'}>
        {pending === 'fix' && <Spinner />}
        Perbaiki &amp; Ajukan Ulang
      </Button>
    </div>
  )
}

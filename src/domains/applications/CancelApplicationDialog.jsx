import { useState } from 'react'
import { api } from '@/data/api'
import { ConfirmDialog } from '@/components/shared/dialogs'
import { CheckboxField } from '@/components/shared/fields'

// Deleting a draft or withdrawing an application keeps what was typed and uploaded for the next draft
// (applications.cancel), unless the user asks to forget it.
export function CancelApplicationDialog({ app, open, onOpenChange, onDone, ...dialog }) {
  const [forget, setForget] = useState(false)
  return (
    <ConfirmDialog
      {...dialog}
      open={open}
      onOpenChange={(o) => {
        if (!o) setForget(false)
        onOpenChange(o)
      }}
      note={forget ? undefined : 'Data dan dokumen yang sudah kamu isi tetap tersimpan, jadi pengajuan berikutnya langsung terisi.'}
      onConfirm={async () => {
        await api.applications.cancel(app.id, { keepData: !forget })
        onDone()
      }}
    >
      <CheckboxField name="forgetKept" label="Hapus juga data & dokumen yang tersimpan" hint="Data pribadi & pekerjaan di Profil tidak ikut terhapus." checked={forget} onChange={setForget} />
    </ConfirmDialog>
  )
}

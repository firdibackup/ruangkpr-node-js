// Common archive shape for the demo and the server adapter. Never fed into active accounts.
export function archiveSummary(a) {
  return { id: a.id, name: a.name, contact: a.contact, closedAt: a.closedAt, status: a.status,
    applicationCount: a.snapshot.applications?.length ?? 0, mortgageCount: a.snapshot.mortgages?.length ?? 0, fileCount: a.files.length }
}

export function archiveFiles(account) {
  const files = new Map()
  const add = (bucket, file) => {
    if (file?.path) files.set(`${bucket}/${file.path}`, { bucket, path: file.path, name: file.fileName ?? file.name, size: file.size })
  }
  for (const a of account.applications ?? []) for (const f of Object.values(a.documents ?? {})) add('application-documents', f)
  for (const m of account.mortgages ?? []) for (const p of m.payments ?? []) add('payment-proofs', p.proof)
  return [...files.values()]
}

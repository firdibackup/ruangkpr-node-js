// The real backend: the same operations as the demo (mockApi.js) over supabaseStore, plus what only a server has —
// sign-in, files in Storage, account deletion (spec 2026-10-09, Amandemen).
import { ApiError } from '../apiError'
import { DEFAULT_UPLOAD, LOGO_UPLOAD, uploadProblem } from '../documentRules'
import { createMockApi } from '../mockApi'
import { authApi } from './auth'
import { supabase } from './client'
import { must } from './errors'
import { DOCS_BUCKET, LOGOS_BUCKET, PROOFS_BUCKET, currentSession, filePath, ownsFolder, publicUrl, removeFiles, signedUrl, uploadFile } from './storage'
import { createSupabaseStore } from './store'

const fileMeta = (file) => ({ name: file.name, size: file.size, type: file.type })

// Upload limits the admin configured (DEFAULT_UPLOAD until the first save).
async function uploadRules() {
  const config = await must(supabase().from('app_config').select('doc').maybeSingle())
  return config?.doc?.upload ?? DEFAULT_UPLOAD
}

// Logo to Storage first, then the bank; a failed save takes the new file out, a successful one the file it replaced
// (spec 2026-10-19 §3).
async function saveBankLogo(values, previous, write) {
  const file = values?.logo instanceof Blob ? values.logo : null
  let path = null
  if (file) {
    const problem = uploadProblem(file, LOGO_UPLOAD)
    if (problem) throw new ApiError({ code: problem.code, message: problem.message }, { status: problem.status })
    path = filePath([], file)
    await uploadFile(LOGOS_BUCKET, path, file)
  }
  let bank
  try {
    bank = await write(file ? { ...values, logo: { path, url: publicUrl(LOGOS_BUCKET, path) } } : values)
  } catch (e) {
    await removeFiles(LOGOS_BUCKET, [path])
    throw e
  }
  if (values?.logo !== undefined && previous !== path) await removeFiles(LOGOS_BUCKET, [previous])
  return bank
}

export function createSupabaseApi() {
  const base = createMockApi({ latencyMs: 0, store: createSupabaseStore() })

  const applications = {
    ...base.applications,
    // File to Storage first (the policy only lets it into a draft, or a document the bank asked again), then record it.
    // The file it replaces leaves Storage, unless it belongs to the application this one was copied from.
    async uploadDocument(id, { documentType, file }, { onProgress } = {}) {
      const problem = uploadProblem(file, await uploadRules())
      if (problem) throw new ApiError({ code: problem.code, message: problem.message }, { status: problem.status })
      const previous = (await base.applications.get(id)).documents[documentType]?.path
      const session = await currentSession()
      const path = filePath([session.user.id, id, documentType], file)
      await uploadFile(DOCS_BUCKET, path, file, onProgress)
      let app
      try {
        app = await base.applications.attachDocument(id, { documentType, file: fileMeta(file), path })
      } catch (e) {
        await removeFiles(DOCS_BUCKET, [path])
        throw e
      }
      await removeFiles(DOCS_BUCKET, [previous].filter((p) => ownsFolder(p, id)))
      onProgress?.(100)
      return app
    },
    async removeDocument(id, documentType) {
      const before = await base.applications.get(id)
      const app = await base.applications.removeDocument(id, documentType)
      await removeFiles(DOCS_BUCKET, [before.documents[documentType]?.path].filter((p) => ownsFolder(p, id)))
      return app
    },
    // Files kept for the next draft stay in Storage; only the ones nothing points to any more go.
    async cancel(id, input) {
      const result = await base.applications.cancel(id, input)
      await removeFiles(DOCS_BUCKET, result.unusedFiles)
      return result
    },
  }

  const mortgages = {
    ...base.mortgages,
    async markPaid(id, { proof, ...payment }) {
      if (!proof) return base.mortgages.markPaid(id, payment)
      const problem = uploadProblem(proof, await uploadRules())
      if (problem) throw new ApiError({ code: problem.code, message: problem.message }, { status: problem.status })
      const session = await currentSession()
      const path = filePath([session.user.id, id], proof)
      await uploadFile(PROOFS_BUCKET, path, proof)
      try {
        return await base.mortgages.markPaid(id, { ...payment, proof: { ...fileMeta(proof), path } })
      } catch (e) {
        await removeFiles(PROOFS_BUCKET, [path])
        throw e
      }
    },
    async removePayment(id, paymentId) {
      const snapshot = await base.dashboard.getSnapshot()
      const path = snapshot.mortgages.find((m) => m.id === id)?.payments?.find((p) => p.id === paymentId)?.proof?.path
      const result = await base.mortgages.removePayment(id, paymentId)
      await removeFiles(PROOFS_BUCKET, [path])
      return result
    },
  }

  const admin = {
    ...base.admin,
    applications: {
      ...base.admin.applications,
      // A 5-minute signed link that downloads the stored file under its original name (admin: verify the document).
      async documentUrl(id, documentType) {
        const detail = await base.admin.applications.get(id)
        const file = detail.application.documents.find((d) => d.type === documentType)?.file
        if (!file?.path) throw new ApiError({ code: 'RESOURCE_NOT_FOUND', message: 'File dokumen tidak ditemukan.' }, { status: 404 })
        return signedUrl(DOCS_BUCKET, file.path, file.fileName || true)
      },
    },
    banks: {
      ...base.admin.banks,
      create: ({ values, reason } = {}) => saveBankLogo(values, null, (v) => base.admin.banks.create({ values: v, reason })),
      async update(id, { values, ...rest } = {}) {
        const previous = values?.logo === undefined ? null : (await base.admin.banks.list()).find((b) => b.id === id)?.logo?.path
        return saveBankLogo(values, previous, (v) => base.admin.banks.update(id, { ...rest, values: v }))
      },
    },
  }

  return { ...base, auth: authApi, applications, mortgages, admin }
}

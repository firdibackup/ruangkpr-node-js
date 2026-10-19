// Files in Supabase Storage: application documents, payment proofs (spec 2026-10-09 §4.3) and bank logos (spec 2026-10-19).
import { ApiError } from '../apiError'
import { supabase } from './client'
import { toApiError } from './errors'

export const DOCS_BUCKET = 'application-documents'
export const PROOFS_BUCKET = 'payment-proofs'
export const LOGOS_BUCKET = 'bank-logos'

const make = (code, message, status, extra = {}) => new ApiError({ code, message, ...extra }, { status })

// {user}/{record}[/{type}]/{uuid}.{ext}: the first folder is what the Storage policies check against auth.uid().
export function filePath(folders, file) {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name ?? '')?.[1]?.toLowerCase() ?? 'bin'
  return [...folders, `${crypto.randomUUID()}.${ext}`].join('/')
}

// A copied application points at the files of the one it came from; only a record's own folder is ever removed.
export const ownsFolder = (path, recordId) => typeof path === 'string' && path.split('/')[1] === recordId

export function storageError(status, body) {
  if (status === 413) return make('FILE_TOO_LARGE', 'Ukuran file terlalu besar. Kompres dulu, lalu coba lagi.', 413)
  if (status === 415) return make('FILE_TYPE_UNSUPPORTED', 'Format tidak didukung. Gunakan JPG, PNG, atau PDF.', 415)
  if (status === 401) return make('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
  if (status === 400 || status === 403) {
    if (/row-level security|unauthorized/i.test(body)) return make('INVALID_STATE_TRANSITION', 'Dokumen ini tidak bisa diunggah sekarang.', 403)
    if (/mime|type/i.test(body)) return make('FILE_TYPE_UNSUPPORTED', 'Format tidak didukung. Gunakan JPG, PNG, atau PDF.', 415)
    if (/size|large/i.test(body)) return make('FILE_TOO_LARGE', 'Ukuran file terlalu besar. Kompres dulu, lalu coba lagi.', 413)
  }
  return make('SERVICE_UNAVAILABLE', 'Upload gagal. Periksa koneksi lalu coba lagi.', 503, { retryable: true })
}

export async function currentSession() {
  const { data, error } = await supabase().auth.getSession()
  if (error) throw toApiError(error)
  if (!data.session) throw make('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
  return data.session
}

// supabase-js uploads with fetch, which reports no progress; XMLHttpRequest does, so the progress bar stays real.
export async function uploadFile(bucket, path, file, onProgress) {
  const session = await currentSession()
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.min(95, Math.round((e.loaded / e.total) * 100)))
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(storageError(xhr.status, xhr.responseText)))
    xhr.onerror = () => reject(storageError(0, ''))
    xhr.send(file)
  })
}

// Best effort: a file left behind is only storage, never data shown to anyone.
export async function removeFiles(bucket, paths) {
  const list = paths.filter(Boolean)
  if (list.length) await supabase().storage.from(bucket).remove(list).catch(() => {})
}

// Public bucket (bank logos): a plain, permanent URL.
export const publicUrl = (bucket, path) => supabase().storage.from(bucket).getPublicUrl(path).data.publicUrl

// `download` (a file name, or true) makes Storage answer with Content-Disposition: attachment.
export async function signedUrl(bucket, path, download) {
  const { data, error } = await supabase().storage.from(bucket).createSignedUrl(path, 300, download ? { download } : undefined)
  if (error) throw make('RESOURCE_NOT_FOUND', 'Dokumen tidak ditemukan.', 404)
  return data.signedUrl
}

// Every file under {user}/ in a bucket (folders are listed level by level).
export async function listOwnFiles(bucket, prefix) {
  const { data, error } = await supabase().storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) return []
  const files = []
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`
    if (entry.id) files.push(path)
    else files.push(...(await listOwnFiles(bucket, path)))
  }
  return files
}

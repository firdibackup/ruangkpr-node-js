import { supabase } from './client'
import { must } from './errors'
import { signedUrl } from './storage'
import { ApiError } from '../apiError'

export function createArchiveApi() {
  return {
    list: ({ query = '', offset = 0 } = {}) => must(supabase().rpc('list_account_archives', { p_query: query.trim(), p_offset: offset })),
    get: (id) => must(supabase().rpc('get_account_archive', { p_id: id })),
    async documentUrl(id, bucket, path) {
      const archive = await this.get(id)
      const file = archive.files.find((f) => f.bucket === bucket && f.path === path)
      if (!file) throw new ApiError({ code: 'RESOURCE_NOT_FOUND', message: 'Berkas arsip tidak ditemukan.' }, { status: 404 })
      return signedUrl(bucket, path, file.name || true)
    },
    async remove(id, { reason }) {
      const files = await must(supabase().rpc('begin_delete_account_archive', { p_id: id, p_reason: reason }))
      // Strict removal: keep the archive in a retryable state if any batch fails.
      for (const bucket of new Set(files.map((f) => f.bucket))) {
        const paths = files.filter((f) => f.bucket === bucket).map((f) => f.path)
        for (let i = 0; i < paths.length; i += 100) await must(supabase().storage.from(bucket).remove(paths.slice(i, i + 100)))
      }
      await must(supabase().rpc('finish_delete_account_archive', { p_id: id }))
      return { deleted: true }
    },
  }
}

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PlusIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { dateShort, intInput, toInt } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from '@/components/shared/fields'
import { ConfirmDialog } from '@/components/shared/dialogs'
import { Chip, Disclaimer, ErrorPanel, Notice, PageSkeleton, Panel, PanelTitle, Spinner } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminHeader } from './shared'

const head = 'text-xs font-bold text-ink-3'
// Keys of ARTICLE_ICONS on Home; a new icon starts there.
const ICON_LABEL = { percent: 'Persen (bunga)', wallet: 'Dompet (uang muka)', receipt: 'Struk (biaya)', repeat: 'Panah putar (take over)', 'hand-coins': 'Uang (dana tambahan)' }
const ARTICLE_STATUS = { draft: ['Draft', 'mute'], published: ['Terbit', 'ok'], archived: ['Diarsipkan', 'mute'] }

function ArticleStatus({ status }) {
  const [label, tone] = ARTICLE_STATUS[status] ?? [status, 'mute']
  return (
    <Chip tone={tone} className="shrink-0 whitespace-nowrap">
      {label}
    </Chip>
  )
}

export function ArticleListPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const { data, error, reload } = useResource(() => api.admin.articles.list({ query, status: status || undefined }), [query, status])
  return (
    <>
      <AdminHeader
        title="Articles"
        subtitle="Artikel edukasi di Explore dan Home. Hanya yang terbit tampil ke user."
        actions={
          <Button asChild size="sm">
            <Link to="/admin/articles/new">
              <PlusIcon aria-hidden />
              Artikel baru
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TextField label="Cari artikel" type="search" placeholder="Judul atau tag" value={query} onChange={setQuery} />
        <SelectField label="Status" placeholder="Semua" value={status} onChange={setStatus} options={Object.entries(ARTICLE_STATUS).map(([value, [label]]) => ({ value, label }))} />
      </div>
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <Panel>
          <p className="text-sm font-semibold text-ink-3">{data.length} artikel</p>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada artikel yang cocok.</p>
          ) : (
            <Table aria-label="Daftar artikel">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={head}>Judul</TableHead>
                  <TableHead className={head}>Tag</TableHead>
                  <TableHead className={head}>Status</TableHead>
                  <TableHead className={head}>Diperbarui</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="min-w-56 py-3 whitespace-normal">
                      <span className="flex flex-col">
                        <Link to={`/admin/articles/${a.id}`} className="w-fit font-bold text-primary underline-offset-4 hover:underline">
                          {a.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          /{a.slug}
                          {a.minutes && ` · ${a.minutes} menit baca`}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-ink-2">{a.tag || '—'}</TableCell>
                    <TableCell className="py-3">
                      <ArticleStatus status={a.status} />
                    </TableCell>
                    <TableCell className="py-3 text-ink-2 tabular">{dateShort(a.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      )}
    </>
  )
}

// The body stays plain-text paragraphs (rendered as text, so no HTML sanitizer is needed); a blank line splits them.
const toForm = (c = {}) => ({ title: c.title ?? '', slug: c.slug ?? '', tag: c.tag ?? '', icon: c.icon ?? 'percent', summary: c.summary ?? '', minutes: intInput(c.minutes), body: (c.body ?? []).join('\n\n') })
const fromForm = (f) => ({
  title: f.title.trim(),
  slug: f.slug.trim(),
  tag: f.tag.trim(),
  icon: f.icon,
  summary: f.summary.trim(),
  minutes: toInt(f.minutes),
  body: f.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean),
})

export function ArticleFormPage() {
  const { articleId } = useParams()
  const { data, error, reload, setData } = useResource(() => (articleId ? api.admin.articles.get(articleId) : Promise.resolve({ content: {} })), [articleId])
  if (!data) {
    return (
      <>
        <AdminHeader title={articleId ? 'Detail artikel' : 'Artikel baru'} back="/admin/articles" />
        {error ? <ErrorPanel onRetry={reload} title={error.code === 'RESOURCE_NOT_FOUND' ? 'Artikel tidak ditemukan.' : undefined} /> : <PageSkeleton />}
      </>
    )
  }
  // Keyed by the loaded article: while a new id loads, the previous data is still on screen.
  return <ArticleForm key={data.article?.id ?? 'new'} data={data} setData={setData} />
}

const STATUS_LINE = { draft: 'Draft · belum tampil ke user', published: 'Terbit · tampil di Explore', archived: 'Diarsipkan · tidak tampil ke user' }

function ArticleForm({ data, setData }) {
  const navigate = useNavigate()
  const a = data.article
  const [saved, setSaved] = useState(() => toForm(data.content))
  const [f, setF] = useState(saved)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [reason, setReason] = useState('')
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(saved)
  const published = a?.status === 'published'
  const archived = a?.status === 'archived'
  const err = (k) => fieldErrors[k]
  const preview = fromForm(f)

  const apply = (d) => {
    setData(d)
    const next = toForm(d.content)
    setSaved(next)
    setF(next)
    setFieldErrors({})
    return d
  }
  const asErrors = (e) => Object.fromEntries((e.fieldErrors ?? []).map((x) => [x.field, x.message]))
  const saveDraft = async () => {
    setSaving(true)
    try {
      if (!a) {
        const d = await api.admin.articles.create({ values: fromForm(f) })
        toast('Draft artikel tersimpan.')
        navigate(`/admin/articles/${d.article.id}`, { replace: true })
        return
      }
      apply(await api.admin.articles.update(a.id, { values: fromForm(f), expectedVersion: a.rev }))
      toast('Draft artikel tersimpan.')
    } catch (e) {
      setFieldErrors(asErrors(e))
      if (!e.fieldErrors?.length) toast(e.message)
    } finally {
      setSaving(false)
    }
  }
  const guarded = (fn) => async () => {
    try {
      await fn()
    } catch (e) {
      setFieldErrors(asErrors(e))
      throw e
    }
  }
  // A published article is live: its edits are confirmed with a reason, like publishing.
  const saveLive = guarded(async () => {
    apply(await api.admin.articles.update(a.id, { values: fromForm(f), reason, expectedVersion: a.rev }))
    toast('Perubahan langsung tampil di Explore.')
  })
  const publish = guarded(async () => {
    let d = data
    if (dirty) d = apply(await api.admin.articles.update(a.id, { values: fromForm(f), expectedVersion: a.rev }))
    apply(await api.admin.articles.publish(a.id, { reason, expectedVersion: d.article.rev }))
    toast('Artikel terbit di Explore.')
  })
  const archive = guarded(async () => {
    apply(await api.admin.articles.archive(a.id, { reason, expectedVersion: a.rev }))
    toast('Artikel diarsipkan.')
  })
  const DIALOG = {
    save: { title: 'Simpan perubahan artikel?', body: 'Artikel ini sedang tampil; perubahan langsung terlihat oleh user.', confirmLabel: 'Ya, simpan', run: saveLive },
    publish: { title: 'Terbitkan artikel ini?', body: 'Artikel langsung tampil di Explore dan bisa muncul di Home user.', confirmLabel: 'Ya, terbitkan', run: publish },
    archive: { title: 'Arsipkan artikel ini?', body: 'Artikel berhenti tampil ke user. Slug-nya tetap dipesan agar tautan lama tidak tertukar.', confirmLabel: 'Ya, arsipkan', run: archive },
  }[confirm]

  return (
    <>
      <AdminHeader title={a ? data.content.title : 'Artikel baru'} subtitle={a ? STATUS_LINE[a.status] : 'Draft belum tampil ke user.'} back="/admin/articles" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (published) setConfirm('save')
            else saveDraft()
          }}
          className="flex min-w-0 flex-col gap-6"
        >
          <fieldset disabled={archived} className="min-w-0">
            <Panel>
              <PanelTitle>Isi artikel</PanelTitle>
              <FormGrid>
                <TextField label="Judul" required span value={f.title} onChange={set('title')} error={err('title')} />
                <TextField
                  label="Slug"
                  required
                  disabled={published}
                  hint={published ? 'Terkunci setelah terbit agar tautan lama tetap jalan.' : 'Huruf kecil, angka, dan tanda hubung. Jadi alamat /education/…'}
                  value={f.slug}
                  onChange={(x) => set('slug')(x.toLowerCase())}
                  error={err('slug')}
                />
                <TextField label="Tag" required placeholder="Bunga, Biaya, …" value={f.tag} onChange={set('tag')} error={err('tag')} />
                <SelectField label="Ikon" value={f.icon} onChange={set('icon')} options={Object.entries(ICON_LABEL).map(([value, label]) => ({ value, label }))} error={err('icon')} />
                <NumberField label="Menit baca" suffix="menit" value={f.minutes} onChange={set('minutes')} error={err('minutes')} />
                <TextAreaField label="Ringkasan" required span rows={2} value={f.summary} onChange={set('summary')} error={err('summary')} hint="Tampil di kartu artikel." />
                <TextAreaField label="Isi artikel" required span rows={12} value={f.body} onChange={set('body')} error={err('body')} hint="Pisahkan paragraf dengan satu baris kosong." />
              </FormGrid>
            </Panel>
          </fieldset>
          {!archived && (
            <Button type="submit" className="w-fit" disabled={saving || (a && !dirty)} aria-busy={saving}>
              {saving && <Spinner />}
              {published ? 'Simpan perubahan' : 'Simpan draft'}
            </Button>
          )}
        </form>

        <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
          {a && !archived && (
            <Panel>
              <PanelTitle>Status</PanelTitle>
              {!published && Object.keys(data.issues).length > 0 && (
                <Notice tone="warn" title="Belum bisa diterbitkan">
                  {Object.keys(data.issues).length} bagian masih perlu dilengkapi. Simpan, lalu cek pesan di form.
                </Notice>
              )}
              <div className="flex flex-wrap gap-3">
                {!published && (
                  <Button size="sm" onClick={() => setConfirm('publish')}>
                    Terbitkan
                  </Button>
                )}
                <Button size="sm" variant="destructive-soft" onClick={() => setConfirm('archive')}>
                  Arsipkan
                </Button>
              </div>
            </Panel>
          )}
          {archived && <Notice tone="muted">Artikel diarsipkan dan tidak tampil ke user.</Notice>}
          <Panel aria-label="Pratinjau">
            <PanelTitle sub="Seperti yang dibaca user di halaman edukasi.">Pratinjau</PanelTitle>
            <article className="flex flex-col gap-3 text-[15px] leading-[26px] text-ink-2">
              <span className="flex flex-col gap-1">
                <span className="text-xl leading-tight font-extrabold text-foreground">{preview.title || 'Judul artikel'}</span>
                <span className="text-sm text-muted-foreground">
                  {preview.tag || 'Tag'} · {preview.minutes ?? '–'} menit baca
                </span>
              </span>
              {preview.body.length ? preview.body.map((p, i) => <p key={i}>{p}</p>) : <p className="text-muted-foreground">Isi artikel tampil di sini.</p>}
              <Disclaimer>Konten edukasi umum, bukan saran keuangan personal.</Disclaimer>
            </article>
          </Panel>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null)
            setReason('')
          }
        }}
        destructive={confirm === 'archive'}
        title={DIALOG?.title}
        body={DIALOG?.body}
        confirmLabel={DIALOG?.confirmLabel}
        confirmDisabled={reason.trim().length < 5}
        onConfirm={() => DIALOG.run()}
      >
        <TextAreaField label="Alasan" required rows={2} value={reason} onChange={setReason} hint="Masuk ke audit log (minimal 5 karakter)." />
      </ConfirmDialog>
    </>
  )
}

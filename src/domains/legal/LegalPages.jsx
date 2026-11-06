import { Link, useParams } from 'react-router-dom'
import { ShieldCheckIcon } from 'lucide-react'
import { brand } from '@/brand/brand'
import { BrandIdentity } from '@/brand/BrandIdentity'
import { logoOf, useLiveBrand } from '@/brand/live'
import { useRouteFocus } from '@/lib/hooks'
import { LEGAL_VERSION, legalDocuments, RETENTION_NOTICE } from './content'

export function LegalLinks() {
  return <nav aria-label="Legalitas dan privasi" className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
    {Object.entries(legalDocuments).map(([slug, doc]) => <Link key={slug} to={`/legal/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">{doc.title}<span className="sr-only"> (tab baru)</span></Link>)}
  </nav>
}

export function PrivacyNotice({ documents = false }) {
  return <aside className="flex items-start gap-3 rounded-xl border border-border bg-secondary p-4 text-sm leading-6">
    <ShieldCheckIcon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
    <div><p className="font-bold">{documents ? 'Penggunaan dokumen kamu' : 'Kenali penggunaan data kamu'}</p>
      <p className="text-muted-foreground">{documents ? `Dokumen diperlukan untuk verifikasi identitas dan pengajuan yang kamu pilih. ${RETENTION_NOTICE}` : 'Persetujuan akun tidak otomatis mengirim pengajuan ke bank. Pelajari tujuan pemrosesan serta hak atas data kamu.'}</p>
      <Link to="/legal/kebijakan-privasi" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-primary underline">Baca Kebijakan Privasi<span className="sr-only"> (tab baru)</span></Link>
    </div>
  </aside>
}

export function LegalPage() {
  const logo = logoOf(useLiveBrand())
  const { doc: slug } = useParams()
  const doc = Object.hasOwn(legalDocuments, slug) ? legalDocuments[slug] : null
  useRouteFocus(slug)
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-b border-border px-5 py-6"><BrandIdentity logo={logo} /><Link to="/" className="inline-flex min-h-11 items-center font-semibold text-primary underline">Ke aplikasi</Link></header>
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-10 outline-none lg:py-16">
      {!doc ? <><h1 className="text-3xl font-extrabold">Dokumen tidak ditemukan</h1><LegalLinks /></> : <>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">{doc.title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{brand.name} · Versi {LEGAL_VERSION} · Diperbarui 6 November 2026</p>
        <p className="mt-6 max-w-3xl text-lg leading-8">{doc.summary}</p>
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="Daftar isi" className="flex flex-col border-y border-border py-3 lg:sticky lg:top-6">{doc.sections.map(([title], i) => <a key={title} href={`#bagian-${i + 1}`} className="flex min-h-11 items-center py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">{title}</a>)}</nav>
          <article className="max-w-[70ch] space-y-9">{doc.sections.map(([title, text], i) => <section key={title} id={`bagian-${i + 1}`} className="scroll-mt-6"><h2 className="mb-3 text-xl font-bold">{title}</h2><p className="text-base leading-8 text-muted-foreground">{text}</p></section>)}</article>
        </div>
      </>}
    </main>
    <footer className="mx-auto max-w-6xl px-5 pb-8"><LegalLinks /></footer>
  </div>
}

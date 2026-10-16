import { Link } from 'react-router-dom'
import { CalendarDaysIcon, ExternalLinkIcon } from 'lucide-react'
import { api } from '@/data/api'
import { calendarEmbedLink } from '@/data/support'
import { useResource } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorPanel, PageSkeleton, Panel } from '@/components/shared/ui'
import { AdminHeader } from './shared'

// Live-consultation bookings: cal.com writes them into the team's Google Calendar, embedded here. cal.com's own
// dashboard refuses to be framed (X-Frame-Options: DENY), so it only gets a link.
export function SchedulePage() {
  const { data, error, reload } = useResource(() => api.admin.config.get())
  const embed = data && calendarEmbedLink(data.config.support?.calendarId)
  return (
    <>
      <AdminHeader title="Jadwal Konsultasi" subtitle="Booking konsultasi live dari cal.com, lewat Google Calendar tim." />
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && !embed && (
        <EmptyState
          icon={CalendarDaysIcon}
          title="Kalender belum diatur"
          action={
            <Button asChild size="md">
              <Link to="/admin/configuration">Atur di Configuration</Link>
            </Button>
          }
        >
          Isi Calendar ID Google yang tersambung ke cal.com di Configuration → Layanan CS.
        </EmptyState>
      )}
      {embed && (
        <Panel>
          <iframe title="Kalender konsultasi" src={embed} loading="lazy" className="h-[min(720px,75dvh)] w-full rounded-card border-0" />
          <p className="text-sm text-ink-3">Kalender tampil untuk akun Google yang diberi akses. Kalau kosong atau diminta login, masuk ke Google dengan akun itu, atau buka di tab baru.</p>
          <div className="flex flex-wrap gap-2.5">
            <Button asChild variant="outline" size="md">
              <a href={embed} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon aria-hidden />
                Buka di tab baru
              </a>
            </Button>
            <Button asChild variant="neutral" size="md">
              <a href="https://app.cal.com/bookings/upcoming" target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon aria-hidden />
                Kelola booking di cal.com
              </a>
            </Button>
          </div>
        </Panel>
      )}
    </>
  )
}

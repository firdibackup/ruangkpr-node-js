import { Link } from "react-router-dom";
import { ArrowRightIcon, BellIcon } from "lucide-react";
import { api } from "@/data/api";
import { useResource } from "@/lib/hooks";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip, Panel, Skeleton } from "@/components/shared/ui";
import { reminderSummary } from "@/domains/mortgages/ReminderSettingsForm";
import {
  pickArticles,
  upcomingReminders,
} from "./widgetData";

// Reminder and activity widgets. Aktivitas and Bacaan load their own data and show loading, error, and
// empty states in place.

const LINK =
  "flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary";

function Loading({ rows }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 rounded-xl" />
      ))}
    </div>
  );
}

function LoadError({ what, onRetry }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-ink-3">{what} gagal dimuat.</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Coba lagi
      </Button>
    </div>
  );
}

export function RemindersWidget({ m, d, clock }) {
  const items = upcomingReminders(m, d, clock);
  const channels = m.reminders
    ? reminderSummary(m.reminders, d.mode === "normal" || d.mode === "warning")
        .ch
    : "Belum ada kanal";
  return (
    <Panel className="gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Pengingat Aktif</h2>
        <BellIcon className="size-5" aria-hidden />
      </div>
      {items.length ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((x) => (
            <li
              key={`${x.date}-${x.label}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2"
            >
              <span className="text-sm font-bold">{x.label}</span>
              <span className="text-[13px] text-ink-3 tabular">
                {dateShort(x.date)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-[21px] text-ink-3">
          Belum ada pengingat aktif dalam waktu dekat.
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3">
        <span className="text-[13px] text-muted-foreground">
          Kanal: {channels}
        </span>
        <Link to="/profile/reminders" className={LINK}>
          Atur pengingat
        </Link>
      </div>
    </Panel>
  );
}

export function RecentActivityWidget() {
  const { data, error, loading, reload } = useResource(() =>
    api.activities.list(),
  );
  const unread = data?.filter((a) => !a.readAt).length ?? 0;
  return (
    <Panel className="gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Aktivitas Terbaru</h2>
        {unread > 0 && <Chip tone="info">{unread} belum dibaca</Chip>}
      </div>
      {loading && !data ? (
        <Loading rows={3} />
      ) : error && !data ? (
        <LoadError what="Aktivitas" onRetry={reload} />
      ) : data.length ? (
        <ul className="flex flex-col">
          {data.slice(0, 3).map((a) => (
            <li key={a.id}>
              <Link
                to={a.action?.route ?? "/activity"}
                className="-mx-2 flex min-h-11 items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-muted"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    a.readAt ? "bg-border" : "bg-brand-red",
                  )}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold">{a.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {dateShort(a.occurredAt.slice(0, 10))}
                    {!a.readAt && (
                      <span className="sr-only"> · belum dibaca</span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">Belum ada aktivitas.</p>
      )}
      <Link to="/activity" className={cn(LINK, "mt-auto")}>
        Lihat semua
        <ArrowRightIcon className="size-[15px]" aria-hidden />
      </Link>
    </Panel>
  );
}

export function ReadingWidget({ m, d }) {
  const { data, error, loading, reload } = useResource(
    () => api.explore.get(),
    [m.id, m.version],
  );
  return (
    <Panel className="gap-3">
      <h2 className="text-lg font-extrabold">Bacaan Untukmu</h2>
      {loading && !data ? (
        <Loading rows={2} />
      ) : error && !data ? (
        <LoadError what="Artikel" onRetry={reload} />
      ) : (
        <ul className="flex flex-col gap-2">
          {pickArticles(data.education, d).map((a) => (
            <li key={a.slug}>
              <Link
                to={`/education/${a.slug}`}
                className="flex min-h-14 flex-col gap-0.5 rounded-xl border border-border px-3 py-2.5 hover:border-primary"
              >
                <span className="text-xs font-bold text-primary">
                  {a.tag} · {a.minutes} menit
                </span>
                <span className="text-sm font-extrabold">{a.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

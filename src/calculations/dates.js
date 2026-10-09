// Pure calendar helpers for date-only ISO strings (YYYY-MM-DD).
// Never parse date-only strings with `new Date('YYYY-MM-DD')` elsewhere: that is UTC and shifts in WIB.

export function parseIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

export function toIsoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// Due day 29–31 falls on the last day of shorter months.
export function resolveMonthlyDueDate({ year, month, dueDay }) {
  return toIsoDate(year, month, Math.min(dueDay, daysInMonth(year, month)))
}

// Adds `months` to an ISO date keeping `dueDay` (clamped per month).
export function addMonths(iso, months, dueDay) {
  const d = parseIsoDate(iso)
  const index = d.year * 12 + (d.month - 1) + months
  return resolveMonthlyDueDate({ year: Math.floor(index / 12), month: (index % 12) + 1, dueDay: dueDay ?? d.day })
}

export function daysUntil({ fromDate, targetDate }) {
  const a = parseIsoDate(fromDate)
  const b = parseIsoDate(targetDate)
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000)
}

export function addDays(iso, days) {
  const d = parseIsoDate(iso)
  return new Date(Date.UTC(d.year, d.month - 1, d.day + days)).toISOString().slice(0, 10)
}

// First due date on or after `today`.
export function nextDueDate({ today, dueDay }) {
  const t = parseIsoDate(today)
  const thisMonth = resolveMonthlyDueDate({ year: t.year, month: t.month, dueDay })
  return thisMonth >= today ? thisMonth : addMonths(thisMonth, 1, dueDay)
}

// Number of due dates strictly after `startDate` and on/before `today` (payments already due).
export function countDueDatesBetween({ startDate, today, dueDay }) {
  if (!(today > startDate)) return 0
  let count = 0
  let due = nextDueDate({ today: addDays(startDate, 1), dueDay })
  while (due <= today) {
    count += 1
    due = addMonths(due, 1, dueDay)
  }
  return count
}

export function monthsBetweenDueDates(fromDue, toDue) {
  const a = parseIsoDate(fromDue)
  const b = parseIsoDate(toDue)
  return (b.year - a.year) * 12 + (b.month - a.month)
}

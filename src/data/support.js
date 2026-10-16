// Customer service contact (admin configuration `support`): one WhatsApp number and one booking page for every
// user. The booking page shows only the slots the marketing team's calendar has free. `calendarId` is that Google
// Calendar (cal.com writes bookings into it), shown to admins on /admin/schedule.
export const DEFAULT_SUPPORT = { whatsapp: '', bookingUrl: 'https://cal.com/creative-karsindo-wr7vhx/konsultasi-kpr', calendarId: '' }

// 0812…, +62 812…, 62-812… all become 62812…
const waDigits = (s) => String(s ?? '').replace(/\D/g, '').replace(/^0/, '62')
const isWhatsapp = (digits) => /^62\d{8,13}$/.test(digits)
const isHttps = (s) => {
  try {
    return new URL(s).protocol === 'https:'
  } catch {
    return false
  }
}
// Google Calendar IDs look like an email: name@gmail.com, …@group.calendar.google.com.
const isCalendarId = (s) => /^[^\s@/?#&]+@[^\s@/?#&]+\.[a-z]{2,}$/i.test(s)

// Any field may stay empty: its button (or the admin calendar) is then hidden.
export const supportInput = (v = {}) => ({ whatsapp: waDigits(v.whatsapp), bookingUrl: String(v.bookingUrl ?? '').trim(), calendarId: String(v.calendarId ?? '').trim() })
export const supportIssues = (v) => ({
  ...(v.whatsapp && !isWhatsapp(v.whatsapp) && { whatsapp: 'Isi nomor WhatsApp Indonesia, mis. 0812 3456 7890.' }),
  ...(v.bookingUrl && !isHttps(v.bookingUrl) && { bookingUrl: 'Isi link yang diawali https://.' }),
  ...(v.calendarId && !isCalendarId(v.calendarId) && { calendarId: 'Isi Calendar ID Google, mis. nama@gmail.com.' }),
})

// Links are rebuilt from digits / a parsed https URL, so a stored value can never become another kind of link.
export const whatsappLink = (number, text) => {
  const digits = waDigits(number)
  return isWhatsapp(digits) ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null
}
// cal.com fills its booking form from these query parameters.
export function bookingLink(url, prefill) {
  if (!isHttps(url)) return null
  const u = new URL(url)
  for (const [k, v] of Object.entries(prefill)) if (v) u.searchParams.set(k, v)
  return u.href
}

// Google's embeddable view of that calendar; Google shows the events only to accounts the calendar is shared with.
export const calendarEmbedLink = (id) =>
  isCalendarId(id)
    ? `https://calendar.google.com/calendar/embed?${new URLSearchParams({ src: id, ctz: 'Asia/Jakarta', mode: 'WEEK', hl: 'id', showPrint: 0, showTitle: 0, showCalendars: 0 })}`
    : null

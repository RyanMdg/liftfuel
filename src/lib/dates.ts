/**
 * Date helpers. A "day" in LiftFuel is a calendar date string (YYYY-MM-DD) in the
 * user's profile time zone. Date strings are manipulated as UTC calendar dates so
 * the browser's own time zone never shifts them.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Today's calendar date in the given IANA time zone. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000)
}

/** Monday of the ISO week containing the date. */
export function startOfWeek(date: string): string {
  const day = toUtc(date).getUTCDay() // 0 = Sunday
  return addDays(date, -((day + 6) % 7))
}

const longFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})
const shortFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const mediumFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
})

/** "Tuesday 14 October 2026" */
export function formatDateLong(date: string): string {
  return longFormat.format(toUtc(date)).replace(',', '')
}

/** "14 Oct" */
export function formatDateShort(date: string): string {
  return shortFormat.format(toUtc(date))
}

/** "14 Oct 2026" */
export function formatDateMedium(date: string): string {
  return mediumFormat.format(toUtc(date))
}

/** Relative label for diary navigation: Today, Yesterday, Tomorrow, or the long date. */
export function relativeDayLabel(date: string, today: string): string {
  const diff = diffDays(today, date)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return formatDateLong(date)
}

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  const zones = intl.supportedValuesOf?.('timeZone') ?? []
  return zones.includes('UTC') ? zones : ['UTC', ...zones]
}

/** Duration between two ISO timestamps as "1 h 12 min" or "48 min". */
export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

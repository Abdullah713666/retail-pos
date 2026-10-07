function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/**
 * Formats a Date object into local date 'YYYY-MM-DD' using local time getters.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  return `${year}-${month}-${day}`
}

/**
 * Formats a Date object into local date-time 'YYYY-MM-DD HH:mm:ss' using local time getters.
 */
export function formatLocalDateTime(date: Date = new Date()): string {
  const datePart = formatLocalDate(date)
  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())
  const seconds = pad2(date.getSeconds())
  return `${datePart} ${hours}:${minutes}:${seconds}`
}

/**
 * Returns current local timestamp as 'YYYY-MM-DD HH:mm:ss'.
 */
export function nowLocal(): string {
  return formatLocalDateTime(new Date())
}

/**
 * Returns current local date as 'YYYY-MM-DD'.
 */
export function todayLocal(): string {
  return formatLocalDate(new Date())
}

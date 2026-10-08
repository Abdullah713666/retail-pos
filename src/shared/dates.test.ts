import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nowLocal, todayLocal, formatLocalDate, formatLocalDateTime, addDaysLocal } from './dates'

describe('dates helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('nowLocal formats current local timestamp as YYYY-MM-DD HH:mm:ss', () => {
    // 2026-10-08 at 20:15:30 local time
    const fixedDate = new Date(2026, 9, 8, 20, 15, 30)
    vi.setSystemTime(fixedDate)

    expect(nowLocal()).toBe('2026-10-08 20:15:30')
  })

  it('todayLocal formats current local date as YYYY-MM-DD', () => {
    const fixedDate = new Date(2026, 9, 8, 20, 15, 30)
    vi.setSystemTime(fixedDate)

    expect(todayLocal()).toBe('2026-10-08')
  })

  it('pads single-digit months, days, hours, minutes, and seconds', () => {
    // 2026-03-05 at 04:07:09 local time
    const fixedDate = new Date(2026, 2, 5, 4, 7, 9)
    vi.setSystemTime(fixedDate)

    expect(nowLocal()).toBe('2026-03-05 04:07:09')
    expect(todayLocal()).toBe('2026-03-05')
  })

  it('formats arbitrary given date correctly', () => {
    const d = new Date(2025, 0, 1, 0, 0, 0)
    expect(formatLocalDate(d)).toBe('2025-01-01')
    expect(formatLocalDateTime(d)).toBe('2025-01-01 00:00:00')
  })
})

describe('addDaysLocal', () => {
  it('adds and subtracts days across month and year ends', () => {
    expect(addDaysLocal('2026-10-08', 30)).toBe('2026-11-07')
    expect(addDaysLocal('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysLocal('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysLocal('2028-02-28', 1)).toBe('2028-02-29')
  })
})

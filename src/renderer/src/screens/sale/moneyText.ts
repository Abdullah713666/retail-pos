import { fromPaisa, toPaisa } from '@shared/money'

/** "12.5" -> 1250; empty -> 0; garbage -> null. */
export function parseMoney(text: string): number | null {
  const s = text.trim()
  if (!s) return 0
  try {
    const v = toPaisa(s)
    return v < 0 ? null : v
  } catch {
    return null
  }
}

export function moneyText(paisa: number): string {
  return fromPaisa(paisa).toFixed(2)
}

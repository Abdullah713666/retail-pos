// Money helpers (integer paisa)

export function toPaisa(rupees: number): number {
  return Math.round(rupees * 100)
}

export function fromPaisa(paisa: number): number {
  return paisa / 100
}

export function formatPKR(paisa: number): string {
  const rupees = paisa / 100
  return `Rs ${rupees.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

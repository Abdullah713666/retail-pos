import { notifications } from '@mantine/notifications'
import type { PrintMode } from '@shared/types'
import i18n from '../i18n'

export async function getPrintMode(): Promise<PrintMode> {
  try {
    const res = await window.api.settings.get('print_mode')
    if (res.ok && (res.data === 'ask' || res.data === 'off')) return res.data
  } catch {
    /* fall through to the default */
  }
  return 'auto'
}

function warn(message: string): void {
  notifications.show({ color: 'orange', title: i18n.t('print.failedTitle'), message, autoClose: 8000 })
}

/**
 * Prints a saved sale. NEVER throws and never touches the sale: a printer problem only shows an
 * orange, non-blocking toast. Returns true when the printer accepted the job.
 */
export async function printSaleSafe(saleId: number, cashReceived?: number): Promise<boolean> {
  try {
    const res = await window.api.printing.printSale({ saleId, cashReceived })
    if (!res.ok) {
      warn(res.error.message)
      return false
    }
    return true
  } catch (e) {
    warn((e as Error).message)
    return false
  }
}

export async function printZReportSafe(shiftId: number): Promise<boolean> {
  try {
    const res = await window.api.printing.printZReport(shiftId)
    if (!res.ok) {
      warn(res.error.message)
      return false
    }
    return true
  } catch (e) {
    warn((e as Error).message)
    return false
  }
}

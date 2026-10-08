import { notifications } from '@mantine/notifications'

/** Copies text to the clipboard and tells the user. Falls back to a hidden textarea if the clipboard API is blocked. */
export async function copyText(text: string, doneMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
  notifications.show({ color: 'green', message: doneMessage })
}

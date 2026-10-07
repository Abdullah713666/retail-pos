import { notifications } from '@mantine/notifications'
import type { Result } from '@shared/result'

export async function callApi<T>(
  apiCall: () => Promise<Result<T>>,
  errorMessage?: string
): Promise<T | null> {
  try {
    const result = await apiCall()
    if (!result.ok) {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: result.error?.message || errorMessage || 'Operation failed'
      })
      return null
    }
    return result.data
  } catch (error) {
    notifications.show({
      color: 'red',
      title: 'Error',
      message: (error as Error).message || errorMessage || 'Unexpected error'
    })
    return null
  }
}

export const api = typeof window !== 'undefined' ? window.api : undefined

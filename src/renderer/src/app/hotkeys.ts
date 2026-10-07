// Global hotkeys hook placeholder (to be wired to Sale actions in M7)
import { useEffect } from 'react'

export function useGlobalHotkeys(): void {
  useEffect(() => {
    const handleKeyDown = (_e: KeyboardEvent): void => {
      // Global shortcut handling will be expanded in M7
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}

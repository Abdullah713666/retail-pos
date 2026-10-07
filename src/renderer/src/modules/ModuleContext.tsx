import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import type { UiModule } from './types'
import { getActiveUiModules } from './registry'

export interface ModulesContextValue {
  enabledModules: string[]
  activeUiModules: UiModule[]
  loading: boolean
  refresh: () => Promise<void>
}

const ModulesContext = createContext<ModulesContextValue>({
  enabledModules: [],
  activeUiModules: [],
  loading: true,
  refresh: async () => {}
})

export const ModulesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      if (window.api?.modules?.getEnabled) {
        const res = await window.api.modules.getEnabled()
        if (res.ok) {
          setEnabledModules(res.data)
        }
      }
    } catch (err) {
      console.error('Failed to load enabled modules:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const activeUiModules = useMemo(
    () => getActiveUiModules(enabledModules),
    [enabledModules]
  )

  const value = useMemo(
    () => ({ enabledModules, activeUiModules, loading, refresh }),
    [enabledModules, activeUiModules, loading, refresh]
  )

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>
}

export function useModules(): ModulesContextValue {
  return useContext(ModulesContext)
}

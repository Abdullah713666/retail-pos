import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { User, LoginInput } from '@shared/types'

interface AuthContextValue {
  user: User | null
  hasUsers: boolean
  loading: boolean
  login: (input: LoginInput) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  hasUsers: false,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  refreshAuth: async () => {}
})

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [hasUsers, setHasUsers] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  const refreshAuth = useCallback(async (): Promise<void> => {
    try {
      if (window.api?.auth) {
        const usersCheck = await window.api.auth.hasUsers()
        if (usersCheck.ok) {
          setHasUsers(usersCheck.data)
        }

        const currentRes = await window.api.auth.getCurrentUser()
        if (currentRes.ok) {
          setUser(currentRes.data)
        }
      }
    } catch (err) {
      console.error('Failed to refresh auth state:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshAuth()
  }, [refreshAuth])

  const handleLogin = useCallback(
    async (input: LoginInput): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!window.api?.auth?.login) {
          return { success: false, error: 'Auth API unavailable' }
        }
        const res = await window.api.auth.login(input)
        if (res.ok) {
          setUser(res.data)
          setHasUsers(true)
          return { success: true }
        }
        return { success: false, error: res.error.message }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    },
    []
  )

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      if (window.api?.auth?.logout) {
        await window.api.auth.logout()
      }
      setUser(null)
    } catch (err) {
      console.error('Failed to logout:', err)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      hasUsers,
      loading,
      login: handleLogin,
      logout: handleLogout,
      refreshAuth
    }),
    [user, hasUsers, loading, handleLogin, handleLogout, refreshAuth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

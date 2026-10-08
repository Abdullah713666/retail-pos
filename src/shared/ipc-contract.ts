import type { Result } from './result'
import type { User, CreateUserInput, LoginInput, SetupCompleteInput } from './types'

export interface MigrationStatus {
  success: boolean
  error: string | null
}

export interface IpcApi {
  ping: () => Promise<Result<string>>
  app: {
    getVersion: () => Promise<Result<string>>
  }
  db: {
    getMigrationStatus: () => Promise<Result<MigrationStatus>>
  }
  setup: {
    complete: (input: SetupCompleteInput) => Promise<Result<User>>
  }
  modules: {
    getEnabled: () => Promise<Result<string[]>>
    setEnabled: (moduleIds: string[]) => Promise<Result<void>>
  }
  settings: {
    getAll: () => Promise<Result<Record<string, string>>>
    get: (key: string) => Promise<Result<string | null>>
    set: (input: { key: string; value: string }) => Promise<Result<void>>
    setMany: (settings: Record<string, string>) => Promise<Result<void>>
  }
  users: {
    list: () => Promise<Result<User[]>>
    create: (input: CreateUserInput) => Promise<Result<User>>
    deactivate: (id: number) => Promise<Result<void>>
  }
  auth: {
    login: (input: LoginInput) => Promise<Result<User>>
    logout: () => Promise<Result<void>>
    getCurrentUser: () => Promise<Result<User | null>>
    hasUsers: () => Promise<Result<boolean>>
  }
}

import type { Result } from './result'

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
}

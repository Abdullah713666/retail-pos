import type { Result } from './result'

export interface IpcApi {
  ping: () => Promise<Result<string>>
  app: {
    getVersion: () => Promise<Result<string>>
  }
}

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { Result, validateAndHandle, safeExecute } from '@shared/result'

/**
 * Registers a validated IPC handler with ipcMain.
 * If a Zod schema is provided, validates raw input before calling handler.
 * Catches all errors and returns Result without throwing across IPC.
 */
export function handleIpc<TSchema extends z.ZodTypeAny, TOutput>(
  channel: string,
  schema: TSchema,
  handler: (validated: z.infer<TSchema>, event: IpcMainInvokeEvent) => Promise<Result<TOutput>> | Result<TOutput>
): void
export function handleIpc<TOutput>(
  channel: string,
  handler: (event: IpcMainInvokeEvent) => Promise<Result<TOutput>> | Result<TOutput>
): void
export function handleIpc(
  channel: string,
  schemaOrHandler: unknown,
  maybeHandler?: unknown
): void {
  if (typeof schemaOrHandler === 'function') {
    const handler = schemaOrHandler as (event: IpcMainInvokeEvent) => Promise<Result<unknown>>
    ipcMain.handle(channel, async (event) => {
      return safeExecute(() => handler(event))
    })
  } else {
    const schema = schemaOrHandler as z.ZodTypeAny
    const handler = maybeHandler as (validated: unknown, event: IpcMainInvokeEvent) => Promise<Result<unknown>>
    ipcMain.handle(channel, async (event, rawInput) => {
      return validateAndHandle(schema, rawInput, (validated) => handler(validated, event))
    })
  }
}

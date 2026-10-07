import { z } from 'zod'

export interface ResultError {
  code: string
  message: string
}

export type Result<T, E = ResultError> =
  | { ok: true; data: T }
  | { ok: false; error: E }

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data }
}

export function err<E = ResultError>(error: E): Result<never, E> {
  return { ok: false, error }
}

/**
 * Validates raw input with a Zod schema and calls the handler with validated data.
 * Catches validation errors and unexpected thrown exceptions, returning an err result.
 * Never throws.
 */
export async function validateAndHandle<TSchema extends z.ZodTypeAny, TOutput>(
  schema: TSchema,
  input: unknown,
  handler: (validated: z.infer<TSchema>) => Promise<Result<TOutput>> | Result<TOutput>
): Promise<Result<TOutput>> {
  try {
    const parseResult = schema.safeParse(input)
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]
      const pathPrefix = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return err({
        code: 'VALIDATION_ERROR',
        message: `${pathPrefix}${issue.message}`
      })
    }
    return await handler(parseResult.data)
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unknown internal error'
    return err({
      code: 'INTERNAL_ERROR',
      message
    })
  }
}

/**
 * Safely executes a function and returns a Result. Catches any thrown exceptions.
 * Never throws.
 */
export async function safeExecute<TOutput>(
  fn: () => Promise<Result<TOutput>> | Result<TOutput>
): Promise<Result<TOutput>> {
  try {
    return await fn()
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unknown internal error'
    return err({
      code: 'INTERNAL_ERROR',
      message
    })
  }
}

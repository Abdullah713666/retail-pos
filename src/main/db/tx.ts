import { err, type Result, type ResultError } from '@shared/result'

/** Thrown inside db.transaction() to roll everything back and return a clean error. */
export class TxAbort extends Error {
  constructor(public readonly error: ResultError) {
    super(error.message)
  }
}

/** Unwraps a Result inside a transaction: an error aborts (rolls back) the whole thing. */
export function must<T>(res: Result<T>): T {
  if (!res.ok) throw new TxAbort(res.error)
  return res.data
}

export function abort(code: string, message: string): never {
  throw new TxAbort({ code, message })
}

/** Runs a transaction function, turning TxAbort into an err Result. */
export function runAtomic<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    if (e instanceof TxAbort) return err(e.error)
    throw e
  }
}

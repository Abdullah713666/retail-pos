export type Result<T, E = { code: string; message: string }> =
  | { ok: true; data: T }
  | { ok: false; error: E }

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data }
}

export function err<E = { code: string; message: string }>(error: E): Result<never, E> {
  return { ok: false, error }
}

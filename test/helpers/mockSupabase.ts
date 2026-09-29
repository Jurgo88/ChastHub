import { vi } from 'vitest'

export interface RecordedCall {
  table: string
  method: string
  args: unknown[]
}

export interface MockSupabase {
  client: { from: (table: string) => unknown }
  /** Every builder method call, in order, tagged with its `.from()` table. */
  calls: RecordedCall[]
  /** Calls filtered to a single table + method (e.g. loqs/update). */
  callsFor: (table: string, method: string) => RecordedCall[]
  from: ReturnType<typeof vi.fn>
}

/**
 * Minimal chainable stand-in for a Supabase query builder. Every method returns
 * the same builder (so `.from().update().eq().in()` chains) and the builder is
 * awaitable, resolving to `{ data, error }`. `maybeSingle`/`single` resolve to a
 * configurable row. All method calls are recorded for assertions.
 *
 * @param rows - lookup rows returned by `maybeSingle`/`single`, in call order.
 *               A single value (or omitted) is reused for every lookup.
 * @param list - what an awaited chain without `single`/`maybeSingle` resolves
 *               to as `data` (a list query). Defaults to null.
 */
export function createSupabaseMock(rows: unknown | unknown[] = null, list: unknown[] | null = null): MockSupabase {
  const calls: RecordedCall[] = []
  const lookups = Array.isArray(rows) ? [...rows] : null
  let currentTable = ''

  const builder: Record<string, unknown> = {}
  const chainMethods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'or', 'ilike', 'order', 'range', 'limit', 'gt', 'gte', 'lt', 'lte', 'is', 'not']

  for (const method of chainMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ table: currentTable, method, args })
      return builder
    })
  }

  const nextRow = () => (lookups ? lookups.shift() ?? null : rows)
  builder.maybeSingle = vi.fn(async () => ({ data: nextRow(), error: null }))
  builder.single = vi.fn(async () => ({ data: nextRow(), error: null }))
  // Make the builder awaitable for terminal chains like `.update().eq().in()`.
  builder.then = (resolve: (v: { data: unknown[] | null, error: null }) => unknown) => resolve({ data: list, error: null })

  const from = vi.fn((table: string) => {
    currentTable = table
    return builder
  })

  return {
    client: { from },
    calls,
    callsFor: (table, method) => calls.filter(c => c.table === table && c.method === method),
    from,
  }
}

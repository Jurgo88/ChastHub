export async function broadcastLoqUpdate(loqId: string, payload: object): Promise<void> {
  const config = useRuntimeConfig()
  const url = `${config.public.supabaseUrl}/realtime/v1/api/broadcast`

  try {
    await $fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.supabaseServiceKey}`,
        'apikey': config.supabaseServiceKey as string,
        'Content-Type': 'application/json',
      },
      body: {
        messages: [{
          topic: `realtime:loq:${loqId}`,
          event: 'loq_updated',
          payload,
        }],
      },
    })
  }
  catch {
    // Non-fatal — realtime broadcast is best-effort
  }
}

/**
 * Issue #24 — tells both dashboards that a verification or task of this lock
 * changed, so they reload its signals and the keyholder's "Needs you now".
 */
export function broadcastSignals(loqId: string): Promise<void> {
  return broadcastLoqUpdate(loqId, { loq: { id: loqId }, signals: true })
}

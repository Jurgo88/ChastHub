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

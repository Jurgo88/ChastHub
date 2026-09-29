# 04 – Real-time Synchronization

## Approach: Supabase Broadcast

All loq event synchronization uses **Supabase Broadcast channels**, not `postgres_changes`.

**Why Broadcast over postgres_changes:**  
`postgres_changes` requires the Realtime server to evaluate RLS policies using the client JWT. In supabase-js v2, `realtime.accessToken` is an async function — `setAuth(string)` does not reliably override it. As a result, `auth.uid()` returns NULL during Realtime RLS checks, causing all row-level policies to fail and `payload.new` to come back as `{}`. Broadcast has no RLS complications: the sender broadcasts directly after a successful API call.

---

## Channel Architecture

### Per-loq channel: `loq:{loqId}`

One channel per active loq, shared by both loqee and loqholder.

| Event | Sender | Receiver | Payload |
|-------|--------|----------|---------|
| `loq_updated` | loqholder | loqee | `{ loq: Partial<Loq>, loqholder?: Profile }` |
| `loq_updated` | loqee | loqholder | `{ loq: { emotion: string } }` |
| `new_message` | loqee OR loqholder | the other party | `LoqMessage` |

**When loqholder broadcasts `loq_updated`:**
- After `acceptRequest` → includes full loq + loqholder profile (so loqee can show who accepted)
- After `togglePause` → includes updated loq fields (`status`, `paused_at`, `loqed_until`)
- After `adjustTime` → includes updated `loqed_until`
- After `endLoq` → includes `{ id, status: 'ended' }`

**When loqee broadcasts `loq_updated`:**
- After `EmotionPicker` pick → includes `{ emotion: string }`

### Requests channel: `lh:requests:{userId}`

Loqholder only. Uses `postgres_changes` on `loq_requests` table (no RLS complications here — filter is on `loqholder_id` which is public to the authenticated user).

```javascript
$supabase
  .channel(`lh:requests:${userId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'loq_requests',
    filter: `loqholder_id=eq.${userId}`,
  }, async () => { await fetchRequests() })
  .subscribe()
```

---

## Frontend Implementation

### Loqee (`src/pages/dashboard/loqee.vue`)

```javascript
function subscribeToLoq(loqId: string) {
  loqChannel = $supabase
    .channel(`loq:${loqId}`)
    .on('broadcast', { event: 'loq_updated' }, async (payload) => {
      const { loq: updated, loqholder } = payload.payload
      loq.value = { ...loq.value, ...updated, loqholder: loqholder ?? loq.value?.loqholder }
      if (updated.emotion) currentEmotion.value = updated.emotion
      if ((updated.status === 'active' || updated.status === 'paused') && messages.value.length === 0) {
        await loadMessages()
      }
    })
    .on('broadcast', { event: 'new_message' }, (payload) => {
      const msg = payload.payload
      if (!messages.value.find(m => m.id === msg.id)) {
        messages.value.push(msg)
        scrollToBottom()
      }
    })
    .subscribe()
}

// Called from sendMessage() after API success:
loqChannel?.send({ type: 'broadcast', event: 'new_message', payload: msg })

// Called from onEmotionPicked() after EmotionPicker API success:
loqChannel?.send({ type: 'broadcast', event: 'loq_updated', payload: { loq: { emotion } } })
```

### Loqholder (`src/pages/dashboard/loqholder.vue`)

```javascript
function subscribeToLoq(loqId: string) {
  if (loqChannels.has(loqId)) return
  const ch = $supabase
    .channel(`loq:${loqId}`)
    .on('broadcast', { event: 'loq_updated' }, (payload) => {
      const { loq: updated } = payload.payload
      const idx = activeLoqs.value.findIndex(l => l.id === loqId)
      if (idx !== -1) activeLoqs.value[idx] = { ...activeLoqs.value[idx], ...updated }
    })
    .on('broadcast', { event: 'new_message' }, (payload) => {
      if (openChatId.value !== loqId) return
      const msg = payload.payload
      if (!chatMessages.value.find(m => m.id === msg.id)) {
        chatMessages.value.push(msg)
        nextTick(() => { messagesEl.value?.scrollTo(...) })
      }
    })
    .subscribe()
  loqChannels.set(loqId, ch)
}

function broadcastLoqUpdate(loqId, loqData, loqholder?) {
  loqChannels.get(loqId)?.send({
    type: 'broadcast',
    event: 'loq_updated',
    payload: { loq: loqData, loqholder },
  })
}
```

---

## Auth Setup (`src/plugins/auth.ts`)

The Realtime connection must be authenticated with the user's JWT explicitly:

```javascript
// On app load (after getSession):
$supabase.realtime.setAuth(session.access_token)

// On auth state change:
$supabase.auth.onAuthStateChange((event, session) => {
  if (session) $supabase.realtime.setAuth(session.access_token)
  else if (event === 'SIGNED_OUT') $supabase.realtime.setAuth(null)
})
```

Without this, channels created in `onMounted` run under the anon key, causing RLS to see `auth.uid() = NULL`.

---

## Deduplication

Both sides check for duplicate messages before pushing:
```javascript
if (!messages.value.find(m => m.id === msg.id)) {
  messages.value.push(msg)
}
```
This prevents the sender from seeing their own message twice (once from the API response, once from the broadcast they receive back).

---

## Offline / Reconnect

```javascript
window.addEventListener('online', handleReconnect)

async function handleReconnect() {
  loqChannels.forEach(ch => ch.unsubscribe())
  loqChannels.clear()
  subscribeToAll()
}
```

---

## Latency Targets

- Messages: <500ms
- Loq state updates (pause, time adjust): <1s

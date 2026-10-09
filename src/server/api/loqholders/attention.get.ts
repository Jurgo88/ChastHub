import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { VERIFICATION_BUCKET } from '~/server/utils/verification'
import { sortAttention, type AttentionItem, type AttentionPerson } from '~/server/utils/lockSignals'

const SIGNED_URL_SECONDS = 300

type One<T> = T | T[] | null
const one = <T>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v)

// GET /api/loqholders/attention (issue #24): everything waiting on this
// keyholder across all their locks, oldest first: verification photos and
// tasks the wearer handed in, and private requests to take a lock. Photos come
// back as short-lived signed URLs so they can be judged right from the list.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can see what needs them' })

  const supabase = useSupabaseAdmin()

  const [{ data: loqs }, { data: requests }] = await Promise.all([
    supabase
      .from('loqs')
      .select('id, loqee:profiles!loqee_id(id, display_name, avatar_url)')
      .eq('loqholder_id', user.id)
      .in('status', ['active', 'paused']),
    // Same filter as incoming.get.ts: a public lock's pending request is this
    // keyholder's own request to join, nothing for them to decide.
    supabase
      .from('loq_requests')
      .select('id, created_at, loq:loqs!inner(id, duration_minutes, reason, is_public, loqee:profiles!loqee_id(id, display_name, avatar_url))')
      .eq('loqholder_id', user.id)
      .eq('status', 'pending')
      .eq('loq.is_public', false),
  ])

  const people = new Map<string, AttentionPerson | null>(
    (loqs ?? []).map(l => [l.id as string, one(l.loqee as One<AttentionPerson>)]),
  )
  const ids = [...people.keys()]

  const [{ data: verifications }, { data: tasks }] = ids.length
    ? await Promise.all([
        supabase.from('loq_verifications').select('id, loq_id, code, penalty_minutes, photo_path, submitted_at').in('loq_id', ids).eq('status', 'submitted'),
        supabase.from('loq_tasks').select('id, loq_id, text, proof, proof_text, proof_photo_path, reward_minutes, penalty_minutes, submitted_at').in('loq_id', ids).eq('status', 'submitted'),
      ])
    : [{ data: [] }, { data: [] }]

  const sign = async (path: string | null) => {
    if (!path) return null
    const { data } = await supabase.storage.from(VERIFICATION_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
    return data?.signedUrl ?? null
  }

  const items: AttentionItem[] = [
    ...await Promise.all((verifications ?? []).map(async v => ({
      kind: 'verification' as const,
      id: v.id,
      loq_id: v.loq_id,
      loqee: people.get(v.loq_id) ?? null,
      at: v.submitted_at,
      code: v.code,
      penalty_minutes: v.penalty_minutes,
      photo_url: await sign(v.photo_path),
    }))),
    ...await Promise.all((tasks ?? []).map(async t => ({
      kind: 'task' as const,
      id: t.id,
      loq_id: t.loq_id,
      loqee: people.get(t.loq_id) ?? null,
      at: t.submitted_at,
      text: t.text,
      proof: t.proof,
      proof_text: t.proof_text,
      reward_minutes: t.reward_minutes,
      penalty_minutes: t.penalty_minutes,
      photo_url: await sign(t.proof_photo_path),
    }))),
    ...(requests ?? []).flatMap((r) => {
      const loq = one(r.loq as One<{ id: string; duration_minutes: number; reason: string | null; loqee: One<AttentionPerson> }>)
      if (!loq) return []
      return [{
        kind: 'request' as const,
        id: r.id,
        loq_id: loq.id,
        loqee: one(loq.loqee),
        at: r.created_at,
        duration_minutes: loq.duration_minutes,
        reason: loq.reason,
      }]
    }),
  ]

  const sorted = sortAttention(items.filter(i => !!i.at))
  return { items: sorted, total: sorted.length }
})

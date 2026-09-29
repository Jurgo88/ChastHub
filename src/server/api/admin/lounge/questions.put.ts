import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const body = await readBody<{ questions?: { day: number; text: string }[] }>(event)
  const list = body?.questions
  if (!Array.isArray(list) || list.length > 31) throw createError({ statusCode: 400, message: 'questions must be a list' })

  const rows = list.map(q => ({ day: Number(q.day), text: String(q.text ?? '').trim() }))
  if (rows.some(r => !Number.isInteger(r.day) || r.day < 1 || r.day > 31)) throw createError({ statusCode: 400, message: 'Days go from 1 to 31' })

  const supabase = useSupabaseAdmin()
  const keep = rows.filter(r => r.text.length >= 3)
  const drop = rows.filter(r => r.text.length < 3).map(r => r.day)
  if (keep.some(r => r.text.length > 200)) throw createError({ statusCode: 400, message: 'A question is longer than 200 characters' })

  if (keep.length) {
    const { error } = await supabase.from('lounge_questions').upsert(keep, { onConflict: 'day' })
    if (error) throw createError({ statusCode: 500, message: 'Could not save questions' })
  }
  if (drop.length) await supabase.from('lounge_questions').delete().in('day', drop)

  const { data } = await supabase.from('lounge_questions').select('day, text').order('day')
  return { questions: data ?? [] }
})

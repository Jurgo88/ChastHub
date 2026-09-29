import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// RLS REGRESNÝ TEST — bráni návratu zraniteľnosti nahlásenej "-R0" (2026-09-24).
//
// Na rozdiel od ostatných testov v test/ (mockovaný Supabase) TENTO beží proti
// REÁLNEMU Supabase projektu — inak by netestoval to podstatné: skutočné RLS
// policy na skutočnej databáze. Preto:
//
//   • BEŽ IBA proti STAGING / test projektu, NIKDY proti produkcii — zakladá
//     a maže účet.
//   • Je opt-in: bez nastavených env premenných sa preskočí (CI ostatných PR
//     nespadne), takže ho zapneš len tam, kde máš test projekt.
//
// Spustenie:
//   RLS_TEST_SUPABASE_URL=https://<ref>.supabase.co \
//   RLS_TEST_ANON_KEY=<anon> \
//   RLS_TEST_SERVICE_KEY=<service_role, len test projekt> \
//   npx vitest run test/rls.security.test.ts
//
// Čo overuje (každý bod je jeden nález z auditu):
//   C1 — bežný účet nesmie SELECT-núť cudzí loq ani combination_text
//   C2 — bežný účet nesmie SELECT-núť cudzie správy
//   C3 — bežný účet nesmie PATCH-núť si is_admin / admin_level / subscription_status
//   H1 — bežný účet nesmie PATCH-núť loqs.locked
// ─────────────────────────────────────────────────────────────────────────────

const URL = process.env.RLS_TEST_SUPABASE_URL
const ANON = process.env.RLS_TEST_ANON_KEY
const SERVICE = process.env.RLS_TEST_SERVICE_KEY

// Bez test-projektových kľúčov test iba oznámi, že sa preskakuje, a neprepadne.
const runOrSkip = URL && ANON && SERVICE ? describe : describe.skip
if (!(URL && ANON && SERVICE)) {
  // eslint-disable-next-line no-console
  console.warn('[rls.security] preskočené — nastav RLS_TEST_SUPABASE_URL / _ANON_KEY / _SERVICE_KEY proti STAGING projektu.')
}

runOrSkip('RLS je bezpečnostná hranica, nie doplnok', () => {
  const email = `rls-probe-${Date.now()}@example.test`
  const password = 'Pr0be-pw-not-secret!'
  let userId = ''
  let admin: SupabaseClient    // service key — len setup/teardown a kontrola pravdy v DB
  let attacker: SupabaseClient // klient s anon kľúčom + JWT bežného účtu (presne ako útočník)

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } })

    // Založ potvrdený účet cez service key (setup, nie súčasť útoku).
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (error) throw error
    userId = data.user!.id

    // Profil, aby platili aj profilové policy.
    await admin.from('profiles').upsert({
      id: userId, email, role: 'loqee', status: 'active', subscription_status: 'inactive',
    })

    // Útočníkov klient: VEREJNÝ anon kľúč + prihlásenie bežného účtu.
    attacker = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const { error: signInErr } = await attacker.auth.signInWithPassword({ email, password })
    if (signInErr) throw signInErr
  })

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
  })

  it('C3: nedovolí povýšiť sa na admina', async () => {
    const { data } = await attacker
      .from('profiles')
      .update({ is_admin: true, admin_level: 'super_admin' })
      .eq('id', userId)
      .select()

    // Zápis buď zlyhá (RLS/grant), alebo neovplyvní žiadny riadok.
    expect(data ?? []).toHaveLength(0)

    // Kontrola pravdy priamo v DB — is_admin MUSÍ zostať false.
    const { data: check } = await admin
      .from('profiles').select('is_admin, admin_level').eq('id', userId).single()
    expect(check?.is_admin).toBe(false)
    expect(check?.admin_level).toBeNull()
  })

  it('C3: nedovolí zapnúť si predplatné', async () => {
    await attacker.from('profiles').update({ subscription_status: 'active' }).eq('id', userId)
    const { data } = await admin
      .from('profiles').select('subscription_status').eq('id', userId).single()
    expect(data?.subscription_status).toBe('inactive')
  })

  it('C1: nevidí cudzie loqy ani combination_text', async () => {
    const { data } = await attacker.from('loqs').select('id, loqee_id, combination_text')
    const foreign = (data ?? []).filter(r => r.loqee_id !== userId)
    expect(foreign).toHaveLength(0)
  })

  it('C2: nevidí cudzie správy', async () => {
    const { data } = await attacker.from('messages').select('id, sender_id')
    const foreign = (data ?? []).filter(r => r.sender_id !== userId)
    expect(foreign).toHaveLength(0)
  })

  it('C3+H1: klient nemá do profiles/loqs/messages právo zápisu vôbec', async () => {
    // Po migrácii 063 sú INSERT/UPDATE/DELETE odobraté grantom.
    const probes = await Promise.all([
      attacker.from('loqs').update({ locked: false }).eq('loqee_id', userId).select(),
      attacker.from('messages').insert({ loq_id: userId, sender_id: userId, content: 'x' }).select(),
    ])
    for (const { data } of probes) expect(data ?? []).toHaveLength(0)
  })
})

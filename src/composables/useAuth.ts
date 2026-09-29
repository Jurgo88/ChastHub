import type { UserRole, Profile } from '~/types'

export function useAuth() {
  const { $supabase } = useNuxtApp()
  const authStore = useAuthStore()

  async function fetchProfile(userId: string): Promise<Profile> {
    const { data, error } = await $supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<Profile>()

    if (error || !data) throw new Error('Failed to fetch profile')
    return data
  }

  async function signup(email: string, password: string, role: UserRole, termsAccepted: boolean) {
    const result = await $fetch<{ userId: string; confirmationRequired: boolean; confirmationSent: boolean }>(
      '/api/auth/signup',
      // TASK-164 — where they came from; null when nothing was captured.
      { method: 'POST', body: { email, password, role, termsAccepted, source: useSignupSource().get() } },
    )

    // TASK-123 — with confirmation on there is no session to establish yet;
    // the caller shows the "check your inbox" step instead.
    if (result.confirmationRequired) {
      return { confirmationRequired: true, confirmationSent: result.confirmationSent }
    }

    // Get a session after the server created the account
    const { data, error } = await $supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) throw new Error('Account created but login failed. Please log in manually.')

    authStore.setSession(data.session)
    authStore.setProfile(await fetchProfile(data.user.id))

    await navigateTo('/dashboard')
    return { confirmationRequired: false, confirmationSent: false }
  }

  async function resendConfirmation(email: string) {
    await $fetch('/api/auth/resend-confirmation', { method: 'POST', body: { email } })
  }

  async function login(email: string, password: string) {
    const result = await $fetch<{ session: { access_token: string; refresh_token: string }; user: { id: string } }>(
      '/api/auth/login',
      { method: 'POST', body: { email, password } },
    )

    const { error } = await $supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    })
    if (error) throw new Error('Failed to establish session')

    const { data: { session } } = await $supabase.auth.getSession()
    if (session) authStore.setSession(session)

    authStore.setProfile(await fetchProfile(result.user.id))

    return navigateTo('/dashboard')
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await $supabase.auth.signOut()
    authStore.clear()
    return navigateTo('/auth/login')
  }

  async function resetPassword(email: string) {
    const { error } = await $supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) throw error
  }

  async function updatePassword(newPassword: string) {
    const { error } = await $supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  // TASK-164 — `carrySource` (the signup page only) appends where the visitor
  // came from to the return URL, because leaving for Google loses it. Plain
  // login, and a signup with no source, keep the return URL exactly as before.
  // Supabase accepts any return URL on the Site URL's own host, query included.
  async function loginWithGoogle(opts: { carrySource?: boolean } = {}) {
    const query = opts.carrySource ? useSignupSource().oauthReturnQuery() : ''
    const { error } = await $supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback${query}` },
    })
    if (error) throw error
  }

  return { signup, login, logout, resetPassword, updatePassword, fetchProfile, loginWithGoogle, resendConfirmation }
}

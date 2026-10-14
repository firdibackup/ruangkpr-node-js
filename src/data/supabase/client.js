import { createClient } from '@supabase/supabase-js'

let client = null
// A reset link opens /reset-password already signed in (event PASSWORD_RECOVERY); until the new password is saved that
// session only serves that page (auth.js). Memory only: a refresh just keeps the user signed in.
export const recovery = { active: false }

// Created on first use so mock mode never needs the env. PKCE: the Google redirect and the reset link return a one-time
// code, never tokens in the URL. supabase-js keeps its session under its own localStorage key (spec §1).
export function supabase() {
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
    // Subscribed at once: supabase-js reports the reset link while it starts up, before getSession resolves.
    client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') recovery.active = true
    })
  }
  return client
}

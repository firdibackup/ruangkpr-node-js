import { createClient } from '@supabase/supabase-js'

let client = null

// Created on first use so mock mode never needs the env. PKCE: the Google redirect returns a one-time code,
// never tokens in the URL. supabase-js keeps its session under its own localStorage key (spec §1).
export function supabase() {
  client ??= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}

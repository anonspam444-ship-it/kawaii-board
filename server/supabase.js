import { createClient } from '@supabase/supabase-js'

// The dashboard shows the REST endpoint (…supabase.co/rest/v1/) more
// prominently than the bare project URL, and supabase-js wants the latter — it
// appends /rest/v1 itself, so pasting the REST form sends every query to
// /rest/v1/rest/v1/... and 404s. Accept either.
const url = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
// SUPABASE_SECRET_KEY is the current name (an `sb_secret_...` key). Supabase
// renamed these: the old service_role JWT is now a "Secret key", and anon is
// now "Publishable". The legacy variable still works so existing .env files
// and deploys don't break.
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error(
    '\n[kawaii-board] Missing Supabase config.\n' +
      'Copy server/.env.example to server/.env, then fill in:\n' +
      '  SUPABASE_URL         Dashboard → Project Settings → Data API → Project URL\n' +
      '  SUPABASE_SECRET_KEY  Dashboard → Project Settings → API Keys → Secret keys\n' +
      '                       (an sb_secret_... value; NOT the publishable key)\n',
  )
  process.exit(1)
}

// Service-role client: bypasses RLS and stays server-side only. Never ship this
// key to the browser. Sessions are disabled — this is a stateless server.
export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error(
    '\n[kawaii-board] Missing Supabase config.\n' +
      'Copy server/.env.example to server/.env and fill in SUPABASE_URL and\n' +
      'SUPABASE_SERVICE_ROLE_KEY (Dashboard → Project Settings → API).\n',
  )
  process.exit(1)
}

// Service-role client: bypasses RLS and stays server-side only. Never ship this
// key to the browser. Sessions are disabled — this is a stateless server.
export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

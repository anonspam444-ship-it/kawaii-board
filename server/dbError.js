// Turns a Supabase/Postgres error into something a person can act on.
//
// By far the most common failure on this project is "the migration hasn't been
// run yet", and the bare driver message for it ("Could not find the table
// 'public.posts' in the schema cache") tells you what broke but not what to do.
// Everything that touches a table routes its errors through here.
const MIGRATION_HINT = 'run the SQL in migrations/'

export function dbError(error) {
  // PGRST205 = unknown table, PGRST204 = unknown column, 42703 = Postgres's
  // own "column does not exist". The message test catches the rest, since
  // PostgREST words it as "Could not find the 'author' column of 'entries'".
  const missingSchema =
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    /Could not find the\b[^]*\b(table|column)\b/i.test(error?.message ?? '')

  return missingSchema ? `${error.message} — ${MIGRATION_HINT}` : error?.message
}

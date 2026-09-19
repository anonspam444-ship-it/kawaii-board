// Seed/example copy. PLACEHOLDERS drive the input hint + empty-state examples
// for each list. mockEntries/mockStreak back the in-memory mock API
// (VITE_USE_MOCK=true), so the UI can be built and reviewed before any backend
// exists.

export const PLACEHOLDERS = {
  worth: [
    'a magical little creature',
    'someone who gives good hugs',
    'certified angel',
  ],
  worst: [
    'creature found beneath the floorboards',
    'tax accountant of the underworld',
    'absolutely rancid goblin',
  ],
}

export const mockEntries = [
  { id: 'm1', text: 'a magical little creature', list: 'worth', author: 'josh', created_at: '2026-01-01T09:00:00Z' },
  { id: 'm2', text: 'someone who gives good hugs', list: 'worth', author: 'mika', created_at: '2026-01-02T09:00:00Z' },
  // No author: stands in for rows created before the column existed, so the
  // byline-less rendering stays on screen during development.
  { id: 'm3', text: 'creature found beneath the floorboards', list: 'worst', author: null, created_at: '2026-01-01T23:00:00Z' },
  { id: 'm4', text: 'absolutely rancid goblin', list: 'worst', author: 'mika', created_at: '2026-01-02T23:00:00Z' },
]

export const mockStreak = {
  count: 12,
  best: 31,
  last_check_in: null, // null so the check-in button is live in mock mode
  updated_at: '2026-01-02T23:00:00Z',
}

// Seed/example copy. PLACEHOLDERS drive the input hint + empty-state examples
// for each list. mockEntries backs the in-memory mock API (VITE_USE_MOCK=true),
// so the UI can be built and reviewed before any backend exists.

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
  { id: 'm1', text: 'a magical little creature', list: 'worth', created_at: '2026-01-01T09:00:00Z' },
  { id: 'm2', text: 'someone who gives good hugs', list: 'worth', created_at: '2026-01-02T09:00:00Z' },
  { id: 'm3', text: 'creature found beneath the floorboards', list: 'worst', created_at: '2026-01-01T23:00:00Z' },
  { id: 'm4', text: 'absolutely rancid goblin', list: 'worst', created_at: '2026-01-02T23:00:00Z' },
]

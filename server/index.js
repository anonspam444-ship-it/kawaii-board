import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { supabase } from './supabase.js'

const app = express()
app.use(cors())
app.use(express.json())

const LISTS = ['worth', 'worst']

// Health check — handy for deploys / uptime pings.
app.get('/api/health', (req, res) => res.json({ ok: true }))

// GET /api/entries — all entries, oldest first.
app.get('/api/entries', async (req, res) => {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/entries — { text, list } → created row.
app.post('/api/entries', async (req, res) => {
  const { text, list } = req.body ?? {}

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }
  if (!LISTS.includes(list)) {
    return res.status(400).json({ error: `list must be one of: ${LISTS.join(', ')}` })
  }

  const { data, error } = await supabase
    .from('entries')
    .insert({ text: text.trim(), list })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// DELETE /api/entries/:id
app.delete('/api/entries/:id', async (req, res) => {
  const { error } = await supabase.from('entries').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).end()
})

const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`[kawaii-board] API listening on http://localhost:${port}`)
})

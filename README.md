# 🪧 kawaii-board — The Quest Board

A wooden quest board split into two themed lists:

- **Worth List** — a kawaii/cute wall of soft pastel pins and stickers.
- **Worst List** — a charred horror board of blood-red, nailed-up wanted-poster scraps.

Add and delete entries in either list; everything is persisted to Supabase
(Postgres) through an Express API that holds the service-role key server-side.

```
kawaii-board/
├── client/        React frontend (Vite)
├── server/        Node/Express backend
├── supabase.sql   entries table + RLS
└── package.json   root convenience scripts (npm workspaces)
```

## Tech stack

| Layer     | Choice                                    |
| --------- | ----------------------------------------- |
| Frontend  | React 19 + Vite                           |
| Backend   | Node.js + Express 5                        |
| Database  | Supabase (Postgres)                       |
| Styling   | Plain CSS (custom, no framework)          |
| Fonts     | Baloo 2 / Nunito (worth) · Eater / IM Fell English (worst) |

---

## Quick start

> **Requires Node.js ≥ 22** (Vite 8 and `@supabase/supabase-js` need it).
> An `.nvmrc` is included — run `nvm use` to switch.

### 1. Install

From the repo root (npm workspaces installs `client` + `server` together):

```bash
npm install
```

### 2. Try the UI immediately (optional, no backend)

You can review the whole design against in-memory mock data before setting up
Supabase:

```bash
cp client/.env.example client/.env      # then set VITE_USE_MOCK=true
npm run dev:client
```

Open http://localhost:5173. Adds/deletes work in-memory (they reset on reload).

### 3. Set up Supabase

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase.sql`](./supabase.sql), and **Run**. This creates the `entries`
   table and enables Row Level Security.
3. Grab your credentials from **Project Settings → API**:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Configure the server

```bash
cp server/.env.example server/.env
```

Fill in `server/.env`:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
```

> ⚠️ The service-role key bypasses RLS. It stays in `server/.env` (gitignored)
> and is **never** sent to the browser. If `VITE_USE_MOCK` was set to `true`
> earlier, set it back to `false` (or remove `client/.env`) so the client talks
> to the real API.

### 5. Run everything

```bash
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001

Vite proxies `/api` → the Express server, so the browser only ever makes
same-origin requests during development.

---

## How it works

- The browser calls the Express API (`/api/entries`); it never touches Supabase
  directly.
- Express uses the Supabase **service-role** client for all reads/writes.
- RLS is enabled with **no public policies**, so the anon/public key can't
  read or write the table — the server is the only way in.

### API

| Method   | Route               | Body              | Returns             |
| -------- | ------------------- | ----------------- | ------------------- |
| `GET`    | `/api/entries`      | —                 | `Entry[]`           |
| `POST`   | `/api/entries`      | `{ text, list }`  | created `Entry`     |
| `DELETE` | `/api/entries/:id`  | —                 | `204 No Content`    |
| `GET`    | `/api/health`       | —                 | `{ ok: true }`      |

`list` must be `"worth"` or `"worst"`.

```jsonc
// Entry
{ "id": "uuid", "text": "certified angel", "list": "worth", "created_at": "..." }
```

---

## Scripts (root)

| Script               | Does                                             |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Run server + client together (hot reload)        |
| `npm run dev:client` | Client only                                      |
| `npm run dev:server` | Server only (`node --watch`)                     |
| `npm run build`      | Production build of the client → `client/dist/`  |
| `npm run start`      | Run the API server (production)                  |

---

## Deploying later

- **Client**: `npm run build` produces static assets in `client/dist/`. Host on
  any static host (Netlify, Vercel, Cloudflare Pages, S3…). Set `VITE_API_BASE`
  to the deployed API origin at build time, or reverse-proxy `/api` to it.
- **Server**: a standard Node app — `npm run start` (respects `PORT`). Deploy to
  Render, Railway, Fly, a VM, etc. Set `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` as environment variables.

---

## Extending

The code is intentionally small and data-driven:

- **Add a list**: add an entry to `LISTS` in `client/src/App.jsx`, add its
  placeholders in `client/src/mockData.js`, add a `.column--<theme>` block in
  `client/src/styles/column.css`, and update the `list` check in `supabase.sql`
  and the `LISTS` array in `server/index.js`.
- **Edit entries**: add a `PATCH /api/entries/:id` route and an edit affordance
  in `Entry.jsx`.

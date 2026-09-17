# 🪧 kawaii-board — The Quest Board

A wooden quest board split into two themed lists:

- **Worth List** — a kawaii/cute wall of soft pastel pins and stickers.
- **Worst List** — a charred horror board of blood-red, nailed-up wanted-poster scraps.

Add and delete entries in either list; everything is persisted to Supabase
(Postgres) through an Express API that holds the service-role key server-side.
Anyone can read the board, but pinning and removing require a shared board
passphrase.

```
kawaii-board/
├── client/        React frontend (Vite)
├── server/        Node/Express backend
├── supabase.sql   entries table + RLS
├── render.yaml    one-service deploy blueprint
└── package.json   root convenience scripts (npm workspaces)
```

## Tech stack

| Layer     | Choice                                    |
| --------- | ----------------------------------------- |
| Frontend  | React 19 + Vite                           |
| Backend   | Node.js + Express 5                        |
| Database  | Supabase (Postgres)                       |
| Auth      | Shared board passphrase (bearer token)    |
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
cp client/.env.example client/.env.development   # then set VITE_USE_MOCK=true
npm run dev:client
```

> Use `.env.development`, **not** `.env`. Vite loads `.env` for `vite build`
> too, so a mock flag there would quietly ship a board full of fake data to
> production. `.env.development` only applies to the dev server.

Open http://localhost:5173. Adds/deletes work in-memory (they reset on reload).
Mock mode has no server to authenticate against, so the board is always
editable and the unlock box is hidden.

### 3. Set up Supabase

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase.sql`](./supabase.sql), and **Run**. This creates the `entries`
   table and enables Row Level Security.
3. Grab two credentials. They live on **different** settings pages:
   - **Project Settings → Data API → Project URL** → `SUPABASE_URL`
     (it's `https://<project-ref>.supabase.co`, and the ref is also in the
     dashboard's own address bar)
   - **Project Settings → API Keys → "Secret keys"** → `SUPABASE_SECRET_KEY`
     — an `sb_secret_...` value. Reveal or create one.

   > Supabase renamed these: the old **`service_role`** JWT is now a **Secret
   > key**, and **`anon`** is now **Publishable**. Take the *secret* one — it
   > bypasses RLS, which is what this server needs. The publishable key is
   > never used here. Older `service_role` keys under "Legacy API keys" work
   > too, and `SUPABASE_SERVICE_ROLE_KEY` is still accepted as a variable name.

### 4. Configure the server

```bash
cp server/.env.example server/.env
```

Fill in `server/.env`:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your-secret-key
BOARD_PASSWORD=a-long-random-passphrase
PORT=3001
```

Generate a passphrase with:

```bash
openssl rand -base64 24
```

`BOARD_PASSWORD` is **required** — the server refuses to start without it, so a
deploy can't end up with open write routes by accident.

> ⚠️ The secret key bypasses RLS. It stays in `server/.env` (gitignored)
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
- Express uses the Supabase **secret key** for all reads/writes, so it can
  bypass RLS.
- RLS is enabled with **no public policies**, so the anon/public key can't
  read or write the table — the server is the only way in.
- Writes require the board passphrase; reads are public by default.

### Auth

There are no user accounts — one passphrase guards the board.

- It lives **only** in `server/.env` as `BOARD_PASSWORD`. It is never baked into
  the client bundle: a `VITE_*` value would be readable by anyone who views
  source, which is obscurity rather than auth.
- Click **Unlock** on the board, type the passphrase, and the client stores it in
  `localStorage` and sends it as `Authorization: Bearer <passphrase>`. While
  locked, the board is read-only — no add form, no delete buttons.
- The server compares SHA-256 digests with `crypto.timingSafeEqual`, so the
  check is constant-time.
- Wrong guesses are throttled per IP: 10 failures in 15 minutes, then `429`
  with a `Retry-After`. The counter is in-memory, so it's per-process and
  resets on restart — fine at this size, but put a real limiter in front if the
  board ever gets popular.
- A rejected passphrase is dropped from `localStorage`, so the UI falls back to
  locked instead of retrying with a dead credential.

| Env var                  | Default | Effect                                        |
| ------------------------ | ------- | --------------------------------------------- |
| `BOARD_PASSWORD`         | —       | Required. The passphrase; no default.         |
| `REQUIRE_AUTH_FOR_READS` | `false` | `true` also gates `GET`, for a private board. |
| `TRUST_PROXY`            | unset   | Set behind a reverse proxy (see below).       |

> ⚠️ `cors()` is wide open. That's intentional and harmless here — a bearer
> token isn't a cookie, so a browser won't attach it to another site's requests
> and CORS wouldn't be the thing protecting you either way. Set an allowlist if
> you'd rather not have other origins reading the public board.

### API

| Method   | Route               | Body              | Returns             | Auth                        |
| -------- | ------------------- | ----------------- | ------------------- | --------------------------- |
| `GET`    | `/api/entries`      | —                 | `Entry[]`           | none¹                       |
| `POST`   | `/api/entries`      | `{ text, list }`  | created `Entry`     | **passphrase**              |
| `DELETE` | `/api/entries/:id`  | —                 | `204 No Content`    | **passphrase**              |
| `POST`   | `/api/session`      | —                 | `{ ok: true }`      | **passphrase**              |
| `GET`    | `/api/health`       | —                 | `{ ok: true }`      | none                        |

¹ Unless `REQUIRE_AUTH_FOR_READS=true`.

`POST /api/session` just validates a passphrase so the unlock box can report a
bad one immediately rather than failing on the next pin. There is no
server-side session; every request carries the token.

`list` must be `"worth"` or `"worst"`, and `text` is capped at 200 characters.

Authenticated requests look like:

```bash
curl -X POST http://localhost:3001/api/entries \
  -H "Authorization: Bearer $BOARD_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{"text":"certified angel","list":"worth"}'
```

Failures: `401` with `WWW-Authenticate: Bearer` for a missing or wrong
passphrase, `429` once throttled, `400` for invalid input.

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

## Deploying

`npm run start` serves **both** the API and the built client from one Node
process, so the whole board is a single deploy on a single origin. No CORS to
configure, and `VITE_API_BASE` stays blank because `/api` is same-origin.

Locally, that production shape is:

```bash
npm run build
npm run start            # http://localhost:3001 serves the board *and* the API
```

### Free hosting (Render + Supabase)

Both have free tiers that fit this app. Free-tier terms change, so check the
current limits rather than trusting this file.

1. Set up Supabase as in **Quick start** above — the same project works for
   production.
2. Push this repo to GitHub.
3. Render dashboard → **New → Blueprint** → pick the repo. [`render.yaml`](./render.yaml)
   sets the build, the start command, `NODE_VERSION=22` and `TRUST_PROXY=1`.
4. Render prompts for the three secrets it deliberately does not store in the
   repo: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BOARD_PASSWORD`.
5. Deploy. The board is at `https://<name>.onrender.com`; click **Unlock** and
   enter the passphrase.

Two free-tier behaviours worth knowing:

- **Render free services sleep** after ~15 minutes of no traffic. The first
  request afterwards takes tens of seconds while it wakes. Fine for a personal
  board; upgrade, or split the client onto Cloudflare Pages / Netlify (so the
  UI loads instantly and only writes wait), if it bothers you.
- **Supabase free projects pause** after a stretch of inactivity, and need a
  click in the dashboard to come back. A board you actually use stays awake.

### Deploying anywhere else

Any Node host works: build, then run `npm run start` with `SUPABASE_URL`,
`SUPABASE_SECRET_KEY` and `BOARD_PASSWORD` set, plus `TRUST_PROXY=1` if
there's a proxy in front (without it every request appears to come from the
proxy and one bad guesser throttles everybody). Serve it over HTTPS — the
passphrase travels in a request header.

To host the client separately instead, `npm run build` with `VITE_API_BASE` set
to the API's origin, upload `client/dist/` to any static host, and tighten
`cors()` on the server to that origin.

---

## Extending

The code is intentionally small and data-driven:

- **Add a list**: add an entry to `LISTS` in `client/src/App.jsx`, add its
  placeholders in `client/src/mockData.js`, add a `.column--<theme>` block in
  `client/src/styles/column.css`, and update the `list` check in `supabase.sql`
  and the `LISTS` array in `server/index.js`.
- **Edit entries**: add a `PATCH /api/entries/:id` route (behind `requireAuth`)
  and an edit affordance in `Entry.jsx`.
- **Real accounts**: swap `server/auth.js` for Supabase Auth JWT verification
  and add a `user_id` column plus RLS policies. Only `requireAuth` and
  `client/src/auth.js` would need to change.

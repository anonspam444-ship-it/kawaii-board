# 🪧 kawaii-board — WORTHLESS or NOXIST

A wooden quest board split into two themed lists:

- **Worth List** — a kawaii/cute wall of soft pastel pins and stickers.
- **Worst List** — a charred horror board of blood-red, nailed-up wanted-poster scraps.

Add, edit and delete entries in either list; everything is persisted to Supabase
(Postgres) through an Express API that holds the service-role key server-side.
Anyone can read the board, but pinning and removing require a shared board
passphrase.

Above the lists sit two more things:

- **A MapleStory Classic countdown** to midnight on 6 October, local time —
  pixel sprites, drifting clouds, falling maple leaves and an EXP bar, all drawn
  in CSS and SVG rather than fetched from anywhere.
- **A no-contact streak counter** — one person's daily "did you?" check-in,
  behind its own passphrase.
- **The Feed** — one shared timeline under the lists. Anyone can post text and
  pictures, like, and reply. No sign-up.

Every entry and post is signed. There are still no accounts: the browser asks
for a name and (optionally) a picture once, and remembers who it is.

Visits are logged with their IP address, readable only by whoever holds
`ADMIN_PASSWORD`, at `/#admin`.

```
kawaii-board/
├── client/        React frontend (Vite)
├── server/        Node/Express backend
├── migrations/    incremental SQL for databases that already exist
├── scripts/       one-off setup (the Storage bucket)
├── supabase.sql   full schema: entries + streak + RLS
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
| Fonts     | Baloo 2 / Pacifico / Nunito (worth) · Eater / IM Fell English (worst) |

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
   and `streak` tables and enables Row Level Security. Every statement is
   idempotent, so it's safe to re-run.

   > **Upgrading a database that already has `entries`?** Run
   > [`migrations/002_authors_and_streak.sql`](./migrations/002_authors_and_streak.sql)
   > instead — it's the same changes as the smaller diff. Without it the board
   > still loads, but pinning fails with *column entries.author does not exist*
   > and the streak panel reports a missing table.
3. Grab two credentials. They live on **different** settings pages:
   - **Project Settings → Data API → Project URL** → `SUPABASE_URL`
     (it's `https://<project-ref>.supabase.co`, and the ref is also in the
     dashboard's own address bar). If you copy the REST endpoint
     (`…supabase.co/rest/v1/`) instead, that's fine — the server trims it.
   - **Project Settings → API Keys → "Secret keys"** → `SUPABASE_SECRET_KEY`
     — an `sb_secret_...` value. Reveal or create one.

   > Supabase renamed these: the old **`service_role`** JWT is now a **Secret
   > key**, and **`anon`** is now **Publishable**. Take the *secret* one — it
   > bypasses RLS, which is what this server needs. The publishable key is
   > never used here. Older `service_role` keys under "Legacy API keys" work
   > too, and `SUPABASE_SERVICE_ROLE_KEY` is still accepted as a variable name.

### 3b. Create the Storage bucket

Post images and avatars go to Supabase Storage, which can't be set up from the
SQL editor. Once `server/.env` exists (next step), run:

```bash
cd server && node ../scripts/setup-storage.mjs
```

It creates a public-read `uploads` bucket, or updates it if it's already there.
Idempotent, so re-running is fine. Skip it and image uploads fail with
*"image storage is not set up"* while everything else keeps working.

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

### Signatures

Every entry carries the name of whoever pinned it. There is no login: the
browser asks for a name on first visit, keeps it in `localStorage`, and sends it
along with each `POST`. Change it any time from the header.

This is a **signature, not an identity claim** — anyone can type any name, and
clearing site data makes you a stranger again. For a board shared between
friends that's the right amount of ceremony; accounts would be more machinery
than the thing is worth. Entries created before this existed have no author and
render without a byline — the inline editor has a second field for the name, so
they can be signed after the fact.

`localStorage` rather than a cookie: the name is only ever read by this app's
own JavaScript to put in a request body, so there's no reason to attach it to
every request the browser makes.

### The streak counter

A single-row `streak` table holding `count`, `best` and `last_check_in`. The
panel asks one question a day; answering *no* adds a day, answering *yes* sets
the count to zero. `best` survives a reset, so losing the streak doesn't erase
how far it got.

Days are counted by hand rather than derived from a start date — the daily
check-in is the point of it. The server allows one per calendar day and refuses
a second, using a compare-and-swap on `last_check_in` so a double-tap or a
retried request can't award two days for one press. Resetting takes two
deliberate clicks in the UI.

### The feed

One shared timeline under the two lists. **Anyone can post** — there is no
credential for writing here, only a `client_id` the browser generated about
itself and keeps in `localStorage`. That is what "one big feed anyone can post
to" means, and it is worth being explicit about the consequences:

- The **rate limits** in `server/rateLimit.js` are the only thing between this
  and a spam cannon: 8 posts, 30 comments and 200 likes per IP per 10 minutes.
  They are in-memory and per-process, so they reset on restart and don't
  coordinate across replicas. Put something real in front if this gets popular.
- `client_id` is **not** authentication. Anyone can send someone else's and
  thereby delete their post or like as them. It exists so that "one like per
  person" and "delete your own post" have something to key on, not to prove
  anything. Whoever holds the board passphrase can delete anything, which is
  the actual moderation story.
- Posts are capped at 500 characters, comments at 300, images at 6MB decoded.

One like per person per post is enforced by the composite primary key on
`post_likes`, not by an application check — a double-tap is a key conflict, so
no amount of retrying inflates a count. The like endpoint returns the
authoritative count rather than letting the client add one, since other people
are liking the same post at the same time.

Pictures are downscaled in the browser before upload (`client/src/lib/image.js`)
and sent as base64 data URLs rather than multipart form data — that costs ~33%
in transfer and saves a dependency, and everything goes through a canvas, so
EXIF and embedded colour profiles don't survive the re-encode. Only the two
routes that accept an image install a 9MB body parser; the global one stays at
128kb so a large body can't be aimed anywhere else.

### Custom emoji

The composer has a toolbar with an emoji picker; the 23 images live in
`client/public/emojis/` and are served as static assets at `/emojis/<file>`.

A post stores the **shortcode** (`:dog:`) as plain text — never HTML. Rendering
resolves it to an `<img>` at display time (`RichText.jsx`), building React nodes
from parsed parts rather than assembling a markup string. On a feed anyone can
write to, that is the difference between a toy and an XSS hole.

The match pattern is built from the known names in `client/src/emoji.js`, so an
ordinary colon can't become an image: `12:00:30` has no emoji called `00` and is
left alone. Names are the only human-readable handle (the filenames are opaque
export ids) — rename them freely in that one file, and any post using an old
shortcode simply shows it as text again.

Clicking an emoji inserts it **at the caret**, not at the end, and leaves the
caret after the token. The picker fires on `mousedown` rather than `click`
because the textarea would lose its selection to the focus change first, and
the insertion point would be gone by the time a click landed.

### Profiles and avatars

The name prompt takes a picture as well as a name. Unlike entry bylines — which
snapshot the name at pin time — feed posts reference the profile **live**, so
changing your picture updates every post you've made.

The avatar URL is cached in `localStorage`, but the `profiles` row is the source
of truth: a browser that kept its `client_id` and lost the cache recovers both
name and picture from `GET /api/profile/:clientId` on load.

Same honour system as everything else here: sending someone else's `client_id`
overwrites their profile.

### The visit log

Every page load records IP, user agent, path, referrer, and whatever identity
the browser is carrying. Readable at **`/#admin`** — not linked from anywhere,
though the guard is the passphrase and not the obscurity. The admin key is held
in memory only, never in `localStorage`, so closing the tab forgets it.

`GET /api/admin/visits.log` returns the same data as a plain-text log:

```bash
curl -H "X-Admin-Key: $ADMIN_PASSWORD" \
  https://your-app.onrender.com/api/admin/visits.log > visits.log
```

Two deliberate choices:

- **Stored in Postgres, not a file.** A file on Render is wiped on every deploy
  and restart, which for an append-only log is the one thing it must not do.
  The plain-text endpoint gives you a file whenever you want one.
- **Written from a beacon the client fires**, not from middleware on the HTML
  response. That works identically behind Vite in development (where Express
  never serves the page) and lets the browser say who it thinks it is. The
  trade is that a visitor with JavaScript off leaves no trace — which also
  means the log is mostly real people rather than crawlers.

**Which IP gets recorded** is its own small trap. `req.ip` is wrong here: with
`trust proxy` set to a hop count, Express counts from the *right* of
`X-Forwarded-For` and returns the first address outside the trusted hops, which
is an intermediate proxy whenever more hops sit in front than the count allows.
`req.ips` is no better — on Express 5 it contains only the addresses inside the
trust boundary, so for `203.0.113.42, 10.0.0.1` with `trust proxy = 1` it
returns `["10.0.0.1"]` and the real client never appears.

So the log reads the leftmost `X-Forwarded-For` entry directly, and only when
the app has been told a proxy is in front. That entry is forgeable, which is
fine for a log and not fine anywhere else: the passphrase throttle and the feed
rate limiters still key on `req.ip`, so a fabricated header can lie in the log
but can't slip past a limit.

IPv4-mapped addresses (`::ffff:127.0.0.1`) are flattened to `127.0.0.1` on the
way in — otherwise one visitor arriving over IPv4 and IPv6 on different
requests gets counted as two unique IPs.

On localhost every visit logs as `127.0.0.1` or `::1`, because it genuinely is
loopback — the request never leaves the machine. Real addresses only appear
once it's deployed behind a proxy.

Refreshes within 60 seconds from the same IP are deduplicated. Logged IPs are
personal data; fine for a board among friends, but worth a line in a privacy
notice if this ever gets a real audience.

### The countdown

Counts down to `new Date(2026, 9, 6, 0, 0, 0)` — midnight opening 6 October, in
whatever timezone the browser is in. "October 6th, 12am" was specified without a
zone, and local is the reading that matches the clock on the wall; change the
`RELEASE` constant in `client/src/components/Countdown.jsx` to pin it to a fixed
instant instead.

The sprites are hand-drawn pixel art in `PixelSprite.jsx` — an array of strings
plus a colour legend, rendered as run-length `<rect>`s. They're homemade
lookalikes rather than Nexon's artwork: hotlinked assets break the moment the
host blocks them, and this repo is public. The only external dependency is the
**Press Start 2P** webfont from Google Fonts.

Everything animated respects `prefers-reduced-motion`.

### Auth

There are no user accounts — two passphrases guard the two writable things.

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

| Env var                  | Default      | Effect                                          |
| ------------------------ | ------------ | ----------------------------------------------- |
| `BOARD_PASSWORD`         | —            | Required. The board passphrase; no default.     |
| `STREAK_PASSWORD`        | in `auth.js` | The streak counter's own passphrase.            |
| `ADMIN_PASSWORD`         | —            | The visit log. Unset disables it entirely.      |
| `REQUIRE_AUTH_FOR_READS` | `false`      | `true` also gates `GET`, for a private board.   |
| `TRUST_PROXY`            | unset        | Set behind a reverse proxy (see below).         |

The three passphrases are deliberately independent, and are throttled
independently too — a wrong streak guess can't lock anyone out of pinning
entries. `STREAK_PASSWORD` is the one credential with a fallback baked into
`server/auth.js`; that default is public, so override it on any real deploy.
The server prints a warning at startup when it's still using it.

`ADMIN_PASSWORD` gets no fallback on purpose. Guessing the streak passphrase
lets someone spoil a counter; guessing this one exposes other people's IP
addresses, so an unset value disables the routes rather than falling back to
anything publishable.

> ⚠️ `cors()` is wide open. That's intentional and harmless here — a bearer
> token isn't a cookie, so a browser won't attach it to another site's requests
> and CORS wouldn't be the thing protecting you either way. Set an allowlist if
> you'd rather not have other origins reading the public board.

### API

| Method   | Route                   | Body                       | Returns            | Auth                |
| -------- | ----------------------- | -------------------------- | ------------------ | ------------------- |
| `GET`    | `/api/entries`          | —                          | `Entry[]`          | none¹               |
| `POST`   | `/api/entries`          | `{ text, list, author? }`  | created `Entry`    | **board**           |
| `PATCH`  | `/api/entries/:id`      | `{ text?, author? }`       | updated `Entry`    | **board**           |
| `DELETE` | `/api/entries/:id`      | —                          | `204 No Content`   | **board**           |
| `POST`   | `/api/session`          | —                          | `{ ok: true }`     | **board**           |
| `GET`    | `/api/streak`           | —                          | `Streak`           | none¹               |
| `POST`   | `/api/streak/check-in`  | `{ today }`                | updated `Streak`   | **streak**          |
| `POST`   | `/api/streak/reset`     | `{ today }`                | updated `Streak`   | **streak**          |
| `POST`   | `/api/streak/session`   | —                          | `{ ok: true }`     | **streak**          |
| `GET`    | `/api/health`           | —                          | `{ ok: true }`     | none                |
| `GET`    | `/api/feed`             | —                          | `Post[]`           | none                |
| `POST`   | `/api/feed`             | `{ client_id, body, image? }` | created `Post`  | none                |
| `DELETE` | `/api/feed/:id`         | —                          | `204 No Content`   | own² or **board**   |
| `POST`   | `/api/feed/:id/like`    | `{ client_id }`            | `{ likes, liked_by_me }` | none          |
| `POST`   | `/api/feed/:id/comments` | `{ client_id, body }`     | created `Comment`  | none                |
| `DELETE` | `/api/feed/:id/comments/:cid` | —                    | `204 No Content`   | own² or **board**   |
| `GET`    | `/api/profile/:clientId` | —                         | `Profile`          | none                |
| `PUT`    | `/api/profile`          | `{ client_id, name, avatar? }` | `Profile`      | none                |
| `POST`   | `/api/visit`            | `{ client_id?, name?, path? }` | `204`          | none                |
| `GET`    | `/api/admin/visits`     | —                          | summary + rows     | **admin**           |
| `GET`    | `/api/admin/visits.log` | —                          | `text/plain` log   | **admin**           |

¹ Unless `REQUIRE_AUTH_FOR_READS=true`.
² "own" means the request's `X-Client-Id` matches the row's `client_id`. On the
honour system — see *The feed* below.

**admin** = `X-Admin-Key: <ADMIN_PASSWORD>`. With `ADMIN_PASSWORD` unset those
two routes return `503` and nothing else.

**board** = `Authorization: Bearer <BOARD_PASSWORD>`.
**streak** = `X-Streak-Key: <STREAK_PASSWORD>`. Two different headers so a
browser holding both can send both without them colliding on `Authorization`.

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

`PATCH` takes either field or both, and writes only the keys actually present
— so renaming an entry leaves its signature alone, and re-signing one leaves
its text alone. Sending `author: null` or `""` clears the byline. An empty body
is a `400` rather than a silent no-op. Moving an entry between lists is still a
different gesture from renaming it, and nothing in the UI asks for it.

Failures: `401` with `WWW-Authenticate: Bearer` for a missing or wrong
passphrase, `429` once throttled, `400` for invalid input, `404` from `PATCH`
and `DELETE` for an id that doesn't exist (including a malformed uuid, which
Postgres rejects outright).

`today` is the **browser's** local calendar date as `YYYY-MM-DD`, not the
server's. A UTC date would roll over at the wrong moment for everyone outside
UTC — an evening check-in could land on tomorrow and burn two days at once. The
server sanity-checks that it's within one day of its own UTC date, so a client
can't stake out the whole calendar, but otherwise trusts it.

`check-in` returns `409` if that date has already been counted. `reset` is
always allowed, and never touches `best`.

```jsonc
// Entry
{ "id": "uuid", "text": "certified angel", "list": "worth",
  "author": "josh", "created_at": "..." }

// Streak
{ "id": 1, "count": 12, "best": 31, "last_check_in": "2026-09-19",
  "updated_at": "..." }
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

- **Retheme a column heading**: the kawaii heading is one `font-family` in
  `column.css` (`Pacifico`) plus a matching family in the Google Fonts `<link>`
  in `index.html`. Swap both to change it.
- **Add a list**: add an entry to `LISTS` in `client/src/App.jsx`, add its
  placeholders in `client/src/mockData.js`, add a `.column--<theme>` block in
  `client/src/styles/column.css`, and update the `list` check in `supabase.sql`
  and the `LISTS` array in `server/index.js`.
- **Real accounts**: swap `server/auth.js` for Supabase Auth JWT verification
  and add a `user_id` column plus RLS policies. Only `requireAuth` and
  `client/src/auth.js` would need to change.

# Self-hosted cPanel deployment (SQLite + local media)

This is the primary deployment guide for the live site `https://shaffaqmodestwear.pk`. It
describes how to run SHAFFAQ on a cPanel **Setup Node.js App** host (which uses Phusion
Passenger) with the **SQLite database + local-filesystem media** profile, enabled in
production by the `SELF_HOSTED_SQLITE=1` opt-in.

It is written to be followed step by step without prior Node.js hosting experience. Do each
section in order. The Supabase/PostgreSQL + Vercel path in [`DEPLOYMENT.md`](DEPLOYMENT.md) is
no longer used for this site; it remains supported in code only.

> **Plan reality check — 1 GB disk / 10 GB bandwidth is tight.** The server's `node_modules`
> alone is a few hundred MB. Read the [Disk and bandwidth budget](#13-disk-and-bandwidth-budget)
> section before you start and keep product images small.

---

## 1. Choose the Node.js version

- In cPanel **Setup Node.js App**, pick **Node.js 24.x**. The project pins `engines.node` to
  `24.x` in `package.json`, and the native modules ship prebuilt binaries for current Node
  releases.
- The absolute minimum for Next.js 16 is Node **20.9+**, but use **24.x** to match the project.

## 2. Build locally with the production origin

You build on your own machine (Windows is fine) and upload the result. You do **not** build on
the server.

1. In the project, create the standalone production build with the **production** environment so
   the public origin is baked in correctly. `NEXT_PUBLIC_APP_ORIGIN` is embedded at **build
   time** (it is used by `src/app/layout.tsx` metadata, `src/app/sitemap.ts`, `src/app/robots.ts`,
   and the product-page JSON-LD), so it must already be the live origin when you build.

   PowerShell:

   ```powershell
   $env:DATABASE_PROVIDER='sqlite'
   $env:MEDIA_PROVIDER='local'
   $env:APP_ORIGIN='https://shaffaqmodestwear.pk'
   $env:NEXT_PUBLIC_APP_ORIGIN='https://shaffaqmodestwear.pk'
   npm run build
   ```

   Setting `DATABASE_PROVIDER=sqlite` and `MEDIA_PROVIDER=local` at build time also activates the
   file-trace trim in `next.config.ts`, which keeps the `postgres` and `@supabase/supabase-js`
   drivers out of `.next/standalone/node_modules` (the SQLite runtime never loads them).

2. Confirm the build produced `.next/standalone/server.js`. `output: "standalone"` in
   `next.config.ts` makes Next emit a self-contained server there.

   > **Build with a clean environment.** The build reads `.env.local` if present. Any
   > `NEXT_PUBLIC_*` value in it (for example a leftover Supabase URL) is baked into the bundle.
   > For the live build, make sure `.env.local` does not contain stale values, or build in a shell
   > where the four variables above are set (shell variables override `.env.local`).

## 3. What to upload (and what not to)

`output: "standalone"` does **not** copy `.next/static` or `public/` into the standalone folder —
you place them yourself. The standalone `package.json` is a full copy of the project manifest, so
it already contains the `db:migrate` / `db:seed` / `bootstrap:admin` / `backup:sqlite` scripts and
the full dependency list.

Upload the following into the cPanel **application root** (call it `<approot>`):

| From your machine | To on the server | Why |
|---|---|---|
| contents of `.next/standalone/` (incl. `server.js`, its `.next/`, `package.json`) | `<approot>/` | the production server + the project manifest |
| `.next/static/` | `<approot>/.next/static/` | browser JS/CSS assets (not auto-copied) |
| `public/` | `<approot>/public/` | logo, seeded media, static files |
| `drizzle/` | `<approot>/drizzle/` | SQLite migrations run by `db:migrate` |
| `scripts/` | `<approot>/scripts/` | migrate / seed / bootstrap / backup commands |
| `src/` | `<approot>/src/` | the scripts import app modules via `@/…` |
| `tsconfig.json` | `<approot>/tsconfig.json` | resolves the `@/*` path aliases for `tsx` |
| `Logo.jpg`, `Pictures/`, `Versatile for Every Occasion/` | `<approot>/` | **one-time:** `db:seed` re-verifies and copies these source images into `public/` (`scripts/seed-shared.ts`). You may delete them after seeding. |

Simplest reliable alternative: upload your whole project folder **excluding** `node_modules/`,
`.data/`, `.git/`, and `.env*`, then add the locally built `.next/standalone` contents and
`.next/static` on top. That guarantees every file the scripts and seed need is present.

**Do NOT upload:**

- Any `node_modules/` — not the project root's and not `.next/standalone/node_modules`. Windows
  native binaries will not run on the Linux server, and Windows standalone symlinks can arrive as
  broken junctions. You install fresh on the server (next step).
- `.env.local` or any `.env*` file — set environment variables in the cPanel UI instead
  (step 6). Never upload secrets.
- The rest of `.next/` (the build cache). Only the standalone output and `.next/static` are needed.
- `.data/` — the server keeps its own database and media (step 8).

## 4. Install native modules on the server (Linux binaries)

Three dependencies are compiled/native and need **Linux** binaries: `sharp` (image processing),
`better-sqlite3` (the database driver), and `@node-rs/argon2` (admin password hashing in
`bootstrap:admin`). Because you did not upload `node_modules`, install them on the server:

1. Open the app's terminal (cPanel **Setup Node.js App** → your app → **Run NPM Install**, or
   enter the virtual environment shown by cPanel and run `npm install` in `<approot>`).
2. This fetches prebuilt Linux binaries (or rebuilds them) for the three native packages and
   installs the rest of the dependency tree next to the uploaded manifest.

> **Include dev dependencies for initialization.** The database commands run through `tsx`, which
> is a **devDependency**. If you set `NODE_ENV=production` before installing, `npm install` skips
> devDependencies and `tsx` will be missing. For the initialization run either install before
> setting `NODE_ENV`, or run:
>
> ```bash
> npm install --include=dev
> ```

Installing on the server is also what lets Next's standalone `server.js` resolve its runtime
modules: the full install at `<approot>/node_modules` supersedes the trimmed set the build would
have shipped.

## 5. cPanel Node App settings and the Passenger port model

In **Setup Node.js App**, configure:

- **Application root:** `<approot>` (the directory you uploaded into).
- **Application URL:** `shaffaqmodestwear.pk` (map the domain — see step 9).
- **Application startup file:** `server.js` (the standalone entry at `<approot>/server.js`).
- **Node.js version:** 24.x.

**Port model:** Passenger assigns the port and passes it to the app as `process.env.PORT`. The
standalone `server.js` listens on `process.env.PORT` (and `HOSTNAME`, defaulting to `0.0.0.0`).
Do **not** hardcode a port and do **not** set `PORT` in the cPanel environment variables — let
Passenger inject it. After changing settings or files, use **Restart** so Passenger reloads.

## 6. Production environment variables (set in the cPanel UI)

Add these in the app's **Environment variables** panel. Set **names and values here only** — never
commit them.

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SELF_HOSTED_SQLITE` | `1` |
| `DATABASE_PROVIDER` | `sqlite` |
| `MEDIA_PROVIDER` | `local` |
| `APP_ORIGIN` | `https://shaffaqmodestwear.pk` |
| `NEXT_PUBLIC_APP_ORIGIN` | `https://shaffaqmodestwear.pk` |
| `SQLITE_PATH` | absolute persistent path, e.g. `/home/USER/shaffaq-data/db/shaffaq.sqlite` (step 8) |
| `MEDIA_ROOT` | absolute persistent path, e.g. `/home/USER/shaffaq-data/media` (step 8) |
| `SESSION_SECRET` | freshly generated, ≥32 bytes (see below) |
| `CSRF_SECRET` | a **different** freshly generated value, ≥32 bytes |

`SELF_HOSTED_SQLITE=1` is what permits the sqlite + local-media profile in production. The runtime
validator (`src/config/runtime.ts`) still enforces, on this path:

- `APP_ORIGIN` is an **exact HTTPS origin** — `https://`, no trailing slash, path, query, fragment,
  or embedded credentials — and `NEXT_PUBLIC_APP_ORIGIN` equals it;
- `SESSION_SECRET` and `CSRF_SECRET` are each **≥32 bytes** and **different** from each other;
- the online-payments fail-closed checks (if any `SAFEPAY_*` variable is set, all must be).

Generate each secret separately and paste the output as the value (do not reuse one for both):

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
```

`NEXT_PUBLIC_APP_ORIGIN` must match the value you built with in step 2 **and** be set here at
runtime; the validator rejects a mismatch between `APP_ORIGIN` and `NEXT_PUBLIC_APP_ORIGIN`.

## 7. Initialize the database on the server

Run these once, in the app's terminal, from `<approot>`. The migrate/seed/bootstrap scripts are
hardwired to SQLite and never contact PostgreSQL.

The scripts load `.env.local` only if it exists (it does not here), so **export the persistent
paths in the shell** before running them — the cPanel UI environment variables are injected into
the running app by Passenger but are not guaranteed to be present in an interactive terminal:

```bash
cd <approot>
export DATABASE_PROVIDER=sqlite
export MEDIA_PROVIDER=local
export SQLITE_PATH=/home/USER/shaffaq-data/db/shaffaq.sqlite
export MEDIA_ROOT=/home/USER/shaffaq-data/media

npm run db:migrate     # create/upgrade the schema; runs an integrity check
npm run db:seed        # idempotent sample catalogue + supplied assets into public/

# Create the first administrator (choose a unique 14+ character password):
export ADMIN_EMAIL=admin@shaffaqmodestwear.com
export ADMIN_INITIAL_PASSWORD='<a-strong-unique-password>'
npm run bootstrap:admin
unset ADMIN_INITIAL_PASSWORD    # clear it immediately after success
```

`db:seed` reads the source images under `<approot>/Logo.jpg`, `Pictures/`, and
`Versatile for Every Occasion/`, verifies their checksums, and copies them into `public/`. If you
chose the minimal upload list and removed those folders, re-upload them for this step. After a
successful seed you may delete them again to save disk.

## 8. Where the database and media must live (persistence)

The SQLite file and the media directory **must** live at an **absolute path outside the
application root and outside `.next`** so that a redeploy — which overwrites `<approot>` — never
destroys them.

- Create a data directory once, e.g. `~/shaffaq-data/db` and `~/shaffaq-data/media`.
- Point `SQLITE_PATH` and `MEDIA_ROOT` (step 6, and the exports in step 7) at it.

Do **not** use the default relative paths (`.data/db/shaffaq.sqlite`, `.data/media`) in
production: the standalone server changes its working directory to `<approot>`, so a relative path
would place your live database **inside the deploy directory**, where the next upload wipes it.

## 9. Map the domain and enable HTTPS

1. Point `shaffaqmodestwear.pk` at this hosting account (addon/primary domain) and set it as the
   app's **Application URL**.
2. Enable **AutoSSL** (cPanel → SSL/TLS Status) so the domain serves over HTTPS with a valid
   certificate, and confirm `https://shaffaqmodestwear.pk` loads.

`APP_ORIGIN` must be exactly `https://shaffaqmodestwear.pk` because security depends on it at
runtime:

- **Exact-origin CSRF:** `src/server/protection.ts` compares each mutating request's `Origin`
  header to `APP_ORIGIN`; a wrong or non-exact value rejects legitimate admin/checkout actions.
- **Secure cookies:** cookies are marked `Secure` only when `APP_ORIGIN` starts with `https://`.

The per-request Content-Security-Policy (nonce + `strict-dynamic`) is emitted by `src/proxy.ts`,
and `upgrade-insecure-requests` is added automatically once requests arrive over HTTPS.

## 10. Local HTTP testing vs. the real HTTPS host

There are **two different** allowances, and the live host uses only the first:

- **`SELF_HOSTED_SQLITE=1` (live host):** permits sqlite + local media in production but **requires
  HTTPS** — it does not allow an `http://` origin, even on loopback. This is what you set on
  cPanel.
- **`SHAFFAQ_ALLOW_LOCAL_PRODUCTION_PROFILE=1` (local smoke only):** allows a production build to
  run on `http://127.0.0.1:3000` for local testing. Use it **only** on your own machine, never on
  the server.

To smoke-test the standalone build locally over http, after building:

```powershell
Copy-Item -Recurse -Force public .next/standalone/public
Copy-Item -Recurse -Force .next/static .next/standalone/.next/static
$env:DATABASE_PROVIDER='sqlite'; $env:MEDIA_PROVIDER='local'
$env:APP_ORIGIN='http://127.0.0.1:3000'; $env:NEXT_PUBLIC_APP_ORIGIN='http://127.0.0.1:3000'
$env:SQLITE_PATH="$PWD\.data\db\shaffaq.sqlite"; $env:MEDIA_ROOT="$PWD\.data\media"
$env:NODE_ENV='production'; $env:SHAFFAQ_ALLOW_LOCAL_PRODUCTION_PROFILE='1'; $env:PORT='3000'
$env:SESSION_SECRET=('s'*48); $env:CSRF_SECRET=('x'*48)
node .next/standalone/server.js
```

Then `http://127.0.0.1:3000/` should return 200 and `http://127.0.0.1:3000/api/health/ready`
should return `{"status":"ready","database":"sqlite"}`. Use **absolute** `SQLITE_PATH`/`MEDIA_ROOT`
because the server changes its working directory into `.next/standalone`.

## 11. Redeploy while preserving the database and media

1. Rebuild locally (step 2) with the production origin.
2. Upload the new `.next/standalone` contents, `.next/static`, `public/`, and — if they changed —
   `src/`, `scripts/`, `drizzle/`, `tsconfig.json`, over `<approot>`. **Never** touch the external
   `~/shaffaq-data` directory.
3. If dependencies changed, re-run `npm install` (with `--include=dev` if you will run migrations).
4. If there are new migrations, run `npm run db:migrate` (with the `SQLITE_PATH` export from step 7).
5. **Restart** the app in cPanel.

Your database and media are untouched because they live outside `<approot>`.

## 12. Backups

The SQLite file is in WAL mode, so copy it with the consistent backup command rather than a plain
file copy while the app is running:

```bash
cd <approot>
export SQLITE_PATH=/home/USER/shaffaq-data/db/shaffaq.sqlite
npm run backup:sqlite      # writes a verified copy under .data/backups
```

Then copy the backup **and** the whole `MEDIA_ROOT` directory off-server on a schedule (they must
be restored together, because product records reference media files). Periodically do a restore
drill: copy both back, run `npm run db:migrate`, and smoke-test before trusting the restore.

## 13. Disk and bandwidth budget

A 1 GB disk / 10 GB-month plan is workable but tight. Approximate footprint on the server:

| Item | Size |
|---|---|
| `node_modules` after `npm install` (Linux, incl. native binaries) | a few hundred MB — the largest item |
| Standalone server + its `.next` + `.next/static` | ~30–50 MB |
| `public/` (logo + seeded sample media) | ~12 MB |
| `src/` + `scripts/` + `drizzle/` | ~2 MB |
| Seed source images (`Pictures/` etc., one-time) | ~48 MB — delete after seeding |
| SQLite database + uploaded media | small at first, **grows with every product image** |

Keep within budget:

- **Compress product images before upload.** Sharp already re-encodes and caps uploads at 10 MiB,
  but practical sizes should be far smaller (tens to low-hundreds of KB). Watch the size of
  `MEDIA_ROOT`.
- **Delete the seed source folders** (`Logo.jpg`, `Pictures/`, `Versatile for Every Occasion/`)
  after the one-time seed.
- **Optionally prune dev dependencies after initialization** to reclaim space:

  ```bash
  npm prune --omit=dev
  ```

  Caveat: this removes `tsx`, so before any future `db:migrate`/`db:seed` you must reinstall dev
  deps (`npm install --include=dev`).

**Upgrade the plan when** the combined `node_modules` + standalone/`.next` + `public` + media + DB
approaches roughly **700–800 MB**, or monthly bandwidth approaches **10 GB**. Product imagery and
media growth are what push both limits first.

## 14. Troubleshooting

- **Page reloads in a loop / assets 404:** `.next/static` was not placed at `<approot>/.next/static`,
  or `public/` is missing. Re-copy both (step 3) and restart.
- **`/api/health/ready` returns 503:** the database was not migrated, or `SQLITE_PATH` points
  somewhere empty. Re-run `npm run db:migrate` with `SQLITE_PATH` exported (step 7) and confirm the
  path matches the cPanel environment variable.
- **`Cannot find module` for a native package (`sharp`, `better-sqlite3`, `@node-rs/argon2`):**
  `npm install` did not run on the server or ran on the wrong Node version. Re-run it in the app's
  virtual environment on Node 24.x.
- **`tsx: not found` when running `db:*`:** dev dependencies were skipped. Run
  `npm install --include=dev`.
- **Admin actions or checkout rejected with an origin/CSRF error:** `APP_ORIGIN` is not the exact
  `https://shaffaqmodestwear.pk` origin. Fix the value (no trailing slash/path) and restart.

> `.vercel/` (if present in your local checkout) is local-only and can be deleted; it is not part
> of this deployment. The committed `vercel.json` has been removed because Vercel is no longer the
> target.

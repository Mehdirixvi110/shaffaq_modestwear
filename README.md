# SHAFFAQ Commerce

SHAFFAQ is a Next.js 16 App Router storefront and administration application for Pakistan PKR cash-on-delivery commerce. It supports two explicit data and media profiles:

| Profile | Database | New admin uploads | Intended use |
|---|---|---|---|
| Local | SQLite | Local persistent filesystem | One Node process on one durable host |
| Hosted | Supabase PostgreSQL | Public Supabase Storage bucket | Vercel Node.js functions |

The hosted profile uses asynchronous repositories, PostgreSQL transactions and conditional updates, the Supabase transaction pooler at runtime, and the session pooler only for controlled migration, seed, reconciliation, and administrator bootstrap commands.

## Implemented application

- Responsive storefront, catalogue search/filter/sort, variants, anonymous database-backed cart, wishlist, and Pakistan COD checkout.
- Checkout idempotency, coupon limits, conditional stock allocation/release, immutable stock movements, and legal order/return transitions.
- Protected administration with Argon2 passwords, database sessions, exact-origin and signed-CSRF mutation checks, optimistic versions, and audit logs.
- Product, taxonomy, homepage, policy, settings, shipping, media, order, inventory, coupon, return, review, newsletter, customer-summary, CSV export, and preview-first product import operations.
- Reviews require a delivered-order capability and moderation. Newsletter records capture explicit consent and support capability-link unsubscribe. No email delivery is configured.
- JPEG/PNG/WebP uploads are decoded with Sharp, bounded to 10 MiB, 12,000 pixels per side, and 40 megapixels, then rotated, metadata-stripped, re-encoded, and stored under immutable random keys.
- Media replacement creates a new object and transactionally repoints live references. The previous object remains available for audit/history.

PKR and Pakistan COD are the only enabled market and payment path. The application never accepts a client-supplied payment status. Online payments, email delivery, courier APIs, currency conversion, analytics execution, and WhatsApp Business API automation remain disabled.

## Project structure

```text
src/app/                    Storefront, admin pages, and Node.js API routes
src/config/runtime.ts       Fail-closed production configuration validation
src/db/provider.ts          Async SQLite/PostgreSQL provider boundary
src/db/schema.ts            SQLite Drizzle schema
src/db/pg-schema.ts         Equivalent PostgreSQL Drizzle schema
src/server/                 Commerce, auth, inventory, data, and media services
drizzle/                    Forward-only SQLite migrations
drizzle-pg/                 Forward-only PostgreSQL migrations
scripts/                    Migration, seed, bootstrap, reconcile, and smoke tools
public/brand + public/media Git-backed copies of verified supplied seed assets
tests/                      Focused commerce, auth, provider, and config tests
.data/                      Ignored local database/media/backups/smoke data
```

## Local SQLite setup

1. Copy `.env.example` to `.env.local`.
2. Generate independent secrets:

   ```powershell
   node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   Set different values for `SESSION_SECRET` and `CSRF_SECRET`.
3. Select the local profile:

   ```dotenv
   DATABASE_PROVIDER=sqlite
   MEDIA_PROVIDER=local
   APP_ORIGIN=http://localhost:3000
   NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
   ```

4. Install and initialize:

   ```powershell
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

The SQLite commands remain provider-specific even if `.env.local` currently selects PostgreSQL. `npm run smoke:browser` creates its own disposable SQLite database and process-only administrator credentials, exercises desktop and 390px Chrome, then removes the disposable data.

## Administrator bootstrap

`.env.local` is the ignored local file where command-only administrator bootstrap values can be set:

```dotenv
ADMIN_EMAIL=admin@shaffaqmodestwear.com
ADMIN_INITIAL_PASSWORD=a-unique-password-manager-generated-value
```

Use a unique password of at least 14 characters. Run one command, then immediately clear `ADMIN_INITIAL_PASSWORD`:

```powershell
npm run bootstrap:admin       # SQLite
npm run bootstrap:admin:pg    # Supabase PostgreSQL through MIGRATION_DATABASE_URL
```

The command refuses to overwrite an existing administrator and never prints the password. No permanent PostgreSQL administrator is seeded automatically.

## Hosted Supabase and Vercel profile

The hosted runtime requires:

```dotenv
DATABASE_PROVIDER=postgres
MEDIA_PROVIDER=supabase
DATABASE_URL=                 # Supabase transaction pooler, port 6543
MIGRATION_DATABASE_URL=       # Supabase session pooler, port 5432; release commands only
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=
SUPABASE_STORAGE_BUCKET=shaffaq-media
APP_ORIGIN=https://your-exact-domain.example
NEXT_PUBLIC_APP_ORIGIN=https://your-exact-domain.example
SESSION_SECRET=
CSRF_SECRET=
```

Production validation rejects SQLite, local media, HTTP/noncanonical origins, missing provider values, short or reused signing secrets, and a runtime database URL not using port 6543. The Supabase secret key is referenced only by server modules and must never use a `NEXT_PUBLIC_` name.

Run PostgreSQL migrations separately from normal application startup:

```powershell
npm run db:pg:migrate
npm run db:pg:seed
npm run db:pg:reconcile
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for GitHub-to-Vercel setup, environment scope, Storage requirements, backups, rollback, and operational caveats. See [`docs/SUPABASE_MIGRATION.md`](docs/SUPABASE_MIGRATION.md) for the verified migration record and remaining administrator action.

## Commands

- `npm run dev` — run the selected profile on loopback in development mode
- `npm run build` / `npm start` — build and start the production application
- `npm run start:local` — start a completed build on loopback; explicitly permits SQLite/local media only for this local command
- `npm run lint` / `npm run typecheck` / `npm test` — static and focused single-run checks
- `npm run db:generate` — generate a forward SQLite migration after an intentional SQLite schema change
- `npm run db:migrate` / `npm run db:seed` — migrate and idempotently seed SQLite
- `npm run db:pg:generate` — generate a forward PostgreSQL migration after an intentional PostgreSQL schema change
- `npm run db:pg:migrate` / `npm run db:pg:seed` — controlled PostgreSQL migration and truthful sample seed
- `npm run db:pg:reconcile` — report all application table counts and verify critical store settings
- `npm run bootstrap:admin` / `npm run bootstrap:admin:pg` — one-time administrator creation
- `npm run backup:sqlite` — consistent local SQLite backup
- `npm run test:pg` — create, migrate, seed, test, and drop an isolated Supabase schema; also upload, retrieve, and remove one uniquely prefixed Storage object
- `npm run smoke:browser` — disposable built-app SQLite desktop/mobile smoke
- `npm run smoke:pg` — disposable built-app PostgreSQL/Supabase desktop/mobile smoke with process-only credentials and object/schema cleanup

## Data and backup boundaries

The seed contains six clearly labelled editable sample products, baseline taxonomies/homepage/policy templates, verified Git-backed supplied images, Pakistan shipping at PKR 250, free shipping from PKR 6,000, COD enabled, and the supplied contact details. It creates no customer, order, sale, coupon, review, newsletter, wishlist, or administrator records.

For SQLite, back up the database and `.data/media` together. For the hosted profile, database backups and Storage object protection are separate responsibilities. PostgreSQL dumps do not contain Supabase Storage objects. Supabase free-tier quotas, inactivity behavior, backup/point-in-time-recovery availability, egress, connection limits, and support terms must be reviewed before accepting business traffic. Complete a restore drill and arrange independent exports appropriate to the business before launch.

# Vercel and Supabase deployment

## Supported profiles

SHAFFAQ supports two explicit profiles:

- `DATABASE_PROVIDER=sqlite` and `MEDIA_PROVIDER=local` for one Node process with durable local storage.
- `DATABASE_PROVIDER=postgres` and `MEDIA_PROVIDER=supabase` for Vercel Node.js functions backed by Supabase PostgreSQL and the public `shaffaq-media` Storage bucket.

Never deploy the SQLite/local-media profile to Vercel. The production validator rejects it. The local production-profile override exists only for the disposable loopback smoke command and is rejected when `VERCEL=1`.

## Supabase prerequisites

The selected project is `https://ktzlxfuwcsppqjmcvatd.supabase.co`.

### PostgreSQL connections

Copy both connection strings from the Supabase dashboard and keep them URL-encoded:

- `DATABASE_URL`: transaction pooler URL on port **6543**. Vercel request handlers use this URL with TLS, `prepare:false`, and one connection per function instance.
- `MIGRATION_DATABASE_URL`: session pooler URL on port **5432**. Only controlled migration, seed, reconciliation, and administrator-bootstrap commands use this URL.

Supabase pooler usernames commonly include the project reference. Use the exact role and URL shown by the dashboard. Do not substitute the direct database host, expose either URL to browser code, or run schema migration during request startup.

### Storage

The public bucket `shaffaq-media` must exist before deployment. Keep its bucket-level restrictions at:

- accepted MIME types: JPEG, PNG, and WebP;
- maximum object size: 10 MiB;
- public read access for stable catalogue image URLs.

The application validates and re-encodes images with Sharp before upload. It writes immutable random object keys. Replacement repoints database references but retains the prior object for history. The Supabase secret key stays server-only and must not have a `NEXT_PUBLIC_` prefix.

## Controlled database release

Run release commands from a trusted workstation or protected CI job that has `MIGRATION_DATABASE_URL`. Do not add these commands to Vercel build or runtime startup.

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run test:pg
npm run build
npm run smoke:pg
npm run db:pg:migrate
npm run db:pg:seed
npm run db:pg:reconcile
```

`db:pg:migrate` takes an advisory lock, verifies the SHA-256 of previously applied migration files, and applies each new forward migration in a transaction. `db:pg:seed` is idempotent. It creates the six labelled sample products and baseline content, and reconciles the supplied contact/shipping/COD values. It does not create business orders, customers, sales, coupons, reviews, or administrators.

`test:pg` and `smoke:pg` create uniquely named temporary schemas, run against the real Supabase project, and drop only those schemas in `finally`. Their Storage checks remove only objects whose metadata exists in the isolated test schema.

## GitHub to Vercel

1. Confirm the intended changes in the local repository and push them to `main` at `https://github.com/Mehdirixvi110/shaffaq_modestwear.git`.
2. In Vercel, choose **Add New → Project**, import that GitHub repository, and keep the framework preset as **Next.js**.
3. Use the repository root as the Vercel root directory. Keep the install command as `npm install` or `npm ci` and the build command as `npm run build`.
4. Do not configure a migration command as part of Vercel build. Complete the controlled database release first.
5. Add the environment variables below. Mark credential values as sensitive. Apply production values to **Production**. Use separate database schemas/projects and separate secrets for Preview when preview writes are permitted.
6. Deploy a preview only after its data isolation is defined. Verify `/api/health/live`, `/api/health/ready`, storefront/cart/checkout, protected admin, media upload/public retrieval, and the canonical metadata origin.
7. Promote to production only after business content, legal policy templates, image rights, stock, prices, tax treatment, return rules, and contact details have owner approval.

## Vercel environment variables

| Name | Production value/purpose |
|---|---|
| `APP_ORIGIN` | Exact canonical HTTPS origin, with no trailing slash or path |
| `NEXT_PUBLIC_APP_ORIGIN` | Same exact value as `APP_ORIGIN` |
| `DATABASE_PROVIDER` | `postgres` |
| `DATABASE_URL` | Supabase transaction pooler, port 6543 |
| `MEDIA_PROVIDER` | `supabase` |
| `SUPABASE_URL` | Project HTTPS URL |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key |
| `SUPABASE_STORAGE_BUCKET` | `shaffaq-media` |
| `SESSION_SECRET` | Independent random value containing at least 32 bytes |
| `CSRF_SECRET` | Different independent random value containing at least 32 bytes |

Do not configure `MIGRATION_DATABASE_URL` in the Vercel runtime unless a separate, tightly scoped release job needs it. Do not set `ADMIN_INITIAL_PASSWORD` in Vercel application environments. `SQLITE_PATH`, `MEDIA_ROOT`, and local-profile override variables do not belong in Vercel.

The root layout pins application routes to the Node.js runtime. No PostgreSQL or Sharp route uses Edge runtime.

## Initial administrator

No hosted administrator is seeded. After choosing a unique password of at least 14 characters in a password manager, set `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` only in the trusted command environment and run:

```powershell
npm run bootstrap:admin:pg
```

The command uses `MIGRATION_DATABASE_URL`, refuses to replace an existing account, stores only an Argon2 hash, and writes an audit event. Clear `ADMIN_INITIAL_PASSWORD` immediately after success. Never put the password in Git, Vercel build logs, shell history, tickets, or migration reports.

## Health and launch checks

- `/api/health/live` proves the Node function responds.
- `/api/health/ready` verifies database connectivity and the `settings` table.
- `npm run db:pg:reconcile` reports counts for the 32 application tables and validates the supplied email, phone/WhatsApp, shipping charge, free-shipping threshold, and COD state.
- `npm run smoke:pg` verifies desktop and 390px storefront flows, product option selection, wishlist, newsletter consent/unsubscribe, cart/coupon, COD checkout, WhatsApp inquiry, protected admin, inventory adjustment/reversal, reversible homepage/settings edits, and Sharp-to-Supabase media upload/public retrieval/cleanup.

Configure Vercel monitoring and alerting for readiness failures, 5xx responses, checkout conflicts, database/pool exhaustion, and Storage failures. Keep application logs free of credentials and customer address data unless an approved protected logging policy requires it.

## Backups and exports

SQLite backups do not apply to the hosted profile. Supabase PostgreSQL backups do not include Storage objects.

Before accepting real orders:

1. Review the current Supabase plan's database backup and point-in-time-recovery availability.
2. Schedule independent encrypted PostgreSQL exports and verify a restore into an isolated project/schema.
3. Inventory and protect Storage objects separately. Preserve old objects referenced by replacement history.
4. Define retention and access rules for order PII, sessions, consent, reviews, anonymous tokens, stock history, and audits.
5. Monitor database size, Storage, egress, connection, and inactivity limits.

Supabase and Vercel free tiers are useful for development and evaluation, but quotas, pausing/inactivity behavior, backup coverage, support, and availability may be unsuitable for a trading business. Select paid plans and independent backups based on the owner's recovery and continuity requirements.

## Rollback

Application rollback and schema rollback are different:

- Redeploy a previous Git commit only when it is compatible with every migration already applied.
- PostgreSQL migrations are forward-only. Do not edit an applied migration or automatically drop columns/tables. Correct a schema issue with a reviewed forward migration and a backup/restore plan.
- If a release fails before traffic switches, leave the current production deployment active, repair forward, rerun checks, and redeploy.
- If media upload fails before metadata commits, the route removes only the newly uploaded object. Replacement never deletes the prior object.
- Do not switch a Vercel deployment back to SQLite/local media as a rollback. That profile cannot safely use Vercel's ephemeral filesystem.

## Local SQLite backup and restore

For the local profile, run `npm run backup:sqlite` and copy the resulting database plus `.data/media` to encrypted off-machine storage. Restore both together, run SQLite integrity and foreign-key checks, apply `npm run db:migrate`, and smoke test on loopback before resuming writes.

# Supabase migration report

## Scope and safety boundary

This pass implemented and verified the dual-provider SHAFFAQ application. No deployment, Git push, permanent administrator creation, or business-data import was performed.

The local SQLite database remains an independent development profile. Its editable sample/setup rows were not represented as real business history. The hosted seed created only the checked-in labelled sample catalogue and baseline settings/content. It created no customer, order, sale, coupon, review, newsletter, wishlist, or administrator records.

Source image originals were not modified. The verified copies under `public/` remain Git-backed. Hosted admin uploads now use Supabase Storage and do not depend on the Vercel filesystem.

## Implemented architecture

- `src/db/provider.ts` provides one asynchronous query/transaction boundary for SQLite and PostgreSQL.
- PostgreSQL runtime connections use `postgres@3.4.9`, TLS, `prepare:false`, a single conservative connection per serverless instance, and the transaction-pooler URL.
- PostgreSQL migration, seed, reconciliation, and bootstrap scripts use only `MIGRATION_DATABASE_URL` through the session pooler.
- PostgreSQL writes preserve optimistic versions and conditional stock updates. Checkout and order operations run in transactions with PostgreSQL row/advisory locking where needed.
- `src/db/pg-schema.ts` defines 32 application tables with foreign keys, unique indexes, integer PKR values, millisecond timestamps, version fields, status/flag checks, stock movement balance checks, and nonnegative amount/stock checks.
- `drizzle-pg/0000_blushing_storm.sql` creates the PostgreSQL schema.
- `drizzle-pg/0001_whole_masked_marvel.sql` adds legal enum/status checks.
- The migration runner records migration names and SHA-256 values in `__shaffaq_migrations`, takes an advisory lock, and never runs during a request.
- The Supabase media adapter stores Sharp-reencoded images under immutable random object keys and persists the key, public URL, MIME type, byte count, dimensions, and SHA-256. Replacement retains the previous object.
- `src/config/runtime.ts` and `src/instrumentation.ts` fail closed at production Node startup when the origin, secrets, database provider/URL, or media provider/Storage settings are unsafe or missing.

## Verification commands and final results

All commands ran from the repository root. Credential values were loaded from the ignored `.env.local` and were not printed or copied into this report.

```powershell
npm run lint
```

Result: passed with no lint findings.

```powershell
npm run typecheck
```

Result: passed.

```powershell
npm test
```

Result: 9 test files passed, 28 tests passed. This includes the existing commerce/auth tests plus production-config and SQL-provider translation tests.

```powershell
npm run build
```

Result: Next.js 16.4.3 production build passed. All application routes compiled for the Node.js profile; the final build emitted no filesystem tracing warnings.

```powershell
npm run test:pg
```

Result: passed against a uniquely named temporary Supabase schema. The command migrated and seeded the schema; verified auth isolation, concurrent storefront reads, catalogue and option reads, cart/coupon behavior, checkout idempotency, stock oversell denial, order transitions, inventory version races, audits, reversible CMS/settings writes, newsletter/wishlist/review constraints, and Storage upload/public retrieval/removal; then dropped the temporary schema.

The first concurrency stress run exposed that parallel root-level Postgres.js queries could wait indefinitely through this transaction pooler. The provider was changed to queue operations through one conservative connection per serverless instance. The complete isolated integration command then passed. Cross-instance safety remains enforced by database transactions, row locks, advisory idempotency locks, unique constraints, and conditional version/stock updates.

```powershell
npm run smoke:pg
```

Final result: passed against a disposable PostgreSQL schema with a process-only random administrator credential. Desktop and 390px Chrome exercised storefront, collection, PDP option selection, wishlist, newsletter consent/unsubscribe, cart, coupon, COD checkout, WhatsApp inquiry, protected admin, inventory adjustment/reversal, reversible homepage/settings edits, and Sharp image upload/public retrieval. The command removed the one isolated Storage object and dropped the temporary schema.

```powershell
npm run smoke:browser
```

Final result: passed against a fresh disposable SQLite database and local media directory. The command removed its database, media, signing secrets, and process-only administrator credential afterward.

## Supabase public schema state

After temporary-schema verification and both browser profiles passed, these commands ran against the intended `public` schema:

```powershell
npm run db:pg:migrate
npm run db:pg:seed
npm run db:pg:reconcile
```

Results:

- Forward PostgreSQL migration files applied/verified: 2.
- Application tables: 32.
- Settings rows: 1.
- Categories: 3.
- Collections: 2.
- Published labelled sample products: 6.
- Product images: 6.
- Product options: 6.
- Option values: 18.
- Variants: 18.
- Variant/option links: 18.
- Homepage sections: 6.
- Policy templates/pages: 8.
- Git-backed media metadata rows: 10.
- Initial stock movements: 18.
- Pakistan shipping regions: 1.
- Users, sessions, carts, orders, checkout requests, coupons/redemptions, returns, wishlists, newsletter subscriptions, reviews, and business audit rows: 0.

Critical hosted settings were reconciled and verified:

- Contact email: `admin@shaffaqmodestwear.com`
- Contact phone and WhatsApp: `923233367659`
- Pakistan shipping: PKR 250
- Free shipping threshold: PKR 6,000
- Cash on delivery: enabled

The permanent administrator was deliberately not bootstrapped. `ADMIN_INITIAL_PASSWORD` is empty in the ignored local configuration.

## Current provider selection

Only after migrations, seed, reconciliation, integration, build, and both browser profiles passed, the ignored `.env.local` switches were changed to:

```dotenv
DATABASE_PROVIDER=postgres
MEDIA_PROVIDER=supabase
ADMIN_INITIAL_PASSWORD=
```

The SQLite commands and disposable SQLite smoke explicitly select their local provider, so local parity remains available by switching those two provider values back to `sqlite` and `local` for development.

## Remaining administrator action

1. Generate a unique password of at least 14 characters with a password manager.
2. In a trusted command environment only, set `ADMIN_EMAIL=admin@shaffaqmodestwear.com` and set `ADMIN_INITIAL_PASSWORD` to that new value.
3. Run:

   ```powershell
   npm run bootstrap:admin:pg
   ```

4. Confirm the success message, sign in through a protected environment, and immediately clear `ADMIN_INITIAL_PASSWORD`.

Do not place the password in Git, Vercel, documentation, terminal transcripts, issue trackers, or chat.

## Vercel release steps

1. Review and commit this working tree, then push it to the GitHub repository. This pass did not push.
2. Import the repository into Vercel as a Next.js project.
3. Configure Production environment values for `APP_ORIGIN`, `NEXT_PUBLIC_APP_ORIGIN`, `DATABASE_PROVIDER=postgres`, `DATABASE_URL`, `MEDIA_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET=shaffaq-media`, `SESSION_SECRET`, and `CSRF_SECRET`.
4. Set `APP_ORIGIN` and `NEXT_PUBLIC_APP_ORIGIN` to the same exact HTTPS production origin without a trailing slash. The current local loopback value is not valid for Vercel production.
5. Keep `MIGRATION_DATABASE_URL` out of the normal application runtime. Use it only in a protected release environment for explicit migration/seed/reconciliation/bootstrap commands.
6. Do not set `ADMIN_INITIAL_PASSWORD` in Vercel.
7. Deploy only after reviewing every sample product, price, stock level, image right, policy template, tax setting, return rule, and contact detail.
8. Verify live and ready health routes, then rerun an appropriately isolated acceptance check before routing customers.

## Limitations and operating requirements

- The six products and all policy text are explicitly sample/template content and require owner and legal review before trading.
- No custom domain was available during this pass. Vercel production cannot be configured until the exact HTTPS origin is known.
- COD is the only payment method. No online payment, email sender, courier API, analytics runtime, currency conversion, or WhatsApp Business API is implemented.
- The public Storage bucket intentionally exposes catalogue media by URL. Never upload private customer documents to it.
- Old replacement objects are retained by design. Define lifecycle, audit retention, and deletion procedures before storage grows materially.
- PostgreSQL backups do not include Storage objects. Arrange and test separate database exports and Storage protection.
- Supabase/Vercel free tiers have quota, connection, inactivity, backup, availability, egress, and support limits. They should be treated as evaluation/low-risk infrastructure until the owner chooses service levels and recovery controls suitable for a production business.
- Applied migrations are forward-only. Roll application code back only to a commit compatible with the deployed schema; correct schema problems with reviewed forward migrations or a tested restore.

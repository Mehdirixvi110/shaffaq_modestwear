# SHAFFAQ Commerce

A local-first SHAFFAQ storefront and administration application built with Next.js, TypeScript, Drizzle ORM, SQLite, Zod, Argon2, and Sharp.

## Implemented application

- Responsive storefront, catalogue search/filter/sort, product variants, anonymous database-backed cart, and Pakistan COD checkout.
- Protected administration with database sessions, same-origin and signed-CSRF mutation checks, validation, optimistic version checks, and audit logs.
- Product, category, collection, homepage, policy, settings, shipping-region, media, order, inventory, coupon, customer-summary, return/exchange, review, and newsletter operations.
- Variant low-stock thresholds, reasoned conditional adjustments, immutable stock movements, dashboard alerts, and CSV export.
- Percentage, fixed-PKR, and free-shipping coupons with dates, minimums, scopes, global/contact limits, server recalculation, and atomic order redemption.
- Order search/filter/export, immutable-snapshot invoice and packing slip, courier/tracking recording, cancellation reasons, legal return/exchange transitions, and activity history.
- Anonymous wishlist tied to an opaque HttpOnly cookie. Full customer accounts remain deferred; guest checkout is preserved.
- Explicit newsletter consent timestamp/source and capability-link unsubscribe. No newsletter or transactional email sending is configured.
- Reviews accepted only through a delivered-order capability, held for moderation, and rendered publicly only after approval. Seed data contains no reviews, customers, orders, or sales.
- Product CSV export and preview-first, explicitly confirmed atomic import with row errors and stale-preview protection. Spreadsheet exports prefix formula-like cells.
- JPEG/PNG/WebP uploads are fully decoded, bounded to 10 MiB, 12,000 pixels per side, and 40 megapixels, then metadata-stripped and re-encoded under random immutable names. Replacement creates a new file, repoints live references transactionally, and retains the old file.

PKR and Pakistan COD are the only live market and payment path. International shipping rows are disabled architecture only. Online payments, email delivery, courier APIs, external object storage, analytics execution, currency conversion, and WhatsApp Business API automation are not enabled.

## Project structure

```text
src/app/                 Storefront, checkout, order capability, admin, and API routes
src/components/          Responsive storefront/admin client components
src/db/                  Drizzle schema and persistent SQLite connection
src/lib/                 Pricing, coupons, CSV, inventory, security, and validation rules
src/server/              Catalogue, cart, checkout, auth, import, inventory, and audit services
scripts/                 Migration, seed, bootstrap, backup, local-start, and smoke commands
drizzle/                 Generated forward-only SQLite migrations
public/brand + media/    Copies of selected supplied assets; source originals stay untouched
tests/                   Focused pricing, coupons, CSV, idempotency, stock, and authorization tests
.data/                   Local database, uploaded media, backups, and disposable smoke data (ignored)
```

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Generate independent secrets with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"` and set `SESSION_SECRET` and `CSRF_SECRET`.
3. Install and initialize:

   ```powershell
   npm install
   npm run db:migrate
   npm run db:seed
   ```

   `db:migrate` applies the checked-in forward-only migrations. Run `npm run db:generate` only after intentionally changing `src/db/schema.ts`.

4. Choose a unique admin password of at least 14 characters and keep it in a password manager. The private, Git-ignored `.env.local` file is the local administrator setup file. Set:

   ```dotenv
   ADMIN_EMAIL=admin@shaffaqmodestwear.com
   ADMIN_INITIAL_PASSWORD=your-password-manager-generated-value
   ```

   Then create the administrator and immediately clear the password value from `.env.local`:

   ```powershell
   npm run bootstrap:admin
   ```

   `bootstrap:admin`, migration, seed, backup, and `start:local` load `.env.local` when it exists. You can instead provide process environment variables in deployment environments. Never commit `.env.local` or retain `ADMIN_INITIAL_PASSWORD` after bootstrap.

5. Run `npm run dev` and open `http://localhost:3000`. Admin login is `/admin/login`.

For the built local profile, run `npm run build` followed by `npm run start:local`.

## Administration paths

- `/admin/products`, `/admin/categories`, `/admin/collections`
- `/admin/inventory`, `/admin/coupons`
- `/admin/orders`, `/admin/returns`, `/admin/customers`
- `/admin/reviews`, `/admin/newsletter`
- `/admin/homepage`, `/admin/media`, `/admin/policies`, `/admin/settings`

Customer order actions remain under `/orders/{reference}` and require the path-scoped order capability cookie issued by checkout. The cookie cannot access any other order.

## Commands

- `npm run dev` — local development server on loopback
- `npm run build` — production-mode build
- `npm run start:local` — serve the completed build on `127.0.0.1`
- `npm run lint` / `npm run typecheck` / `npm test` — single-run verification
- `npm run db:generate` / `npm run db:migrate` / `npm run db:seed` — schema generation, migration, and idempotent defaults
- `npm run bootstrap:admin` — environment-backed first-admin creation
- `npm run backup:sqlite` — consistent SQLite backup under `.data/backups`
- `npm run smoke:browser` — after `npm run build`, create a fresh disposable database, generate process-local secrets/admin credentials, configure a disposable WhatsApp test number, run desktop/mobile Chrome checks, stop the server, and delete disposable data

The smoke wrapper never reads or writes reusable admin credentials. Its credentials and signing secrets exist only in child-process environments, and its database lives under a random `.data/smoke` directory until cleanup.

## Data, privacy, and asset safety

`Logo.jpg` is the authoritative supplied logo. Seeding verifies its SHA-256 and copies it to `public/brand/logo.jpg`; it never changes the source. Selected supplied catalogue images are handled the same way. Uploaded media stays under `.data/media` and is served through the application.

Guest contact/address snapshots, coupon redemptions, stock movements, consent records, reviews, anonymous wishlists, and return requests are persisted in SQLite. Customer contact data appears only on authorized admin pages and the matching path-capability order page. Public approved-review names are abbreviated.

The SQLite database defaults to `.data/db/shaffaq.sqlite`. Back up both `.data/db` and `.data/media`. To restore, stop the app, preserve the current `.data` directory, restore both paths together, run `PRAGMA integrity_check` and `PRAGMA foreign_key_check`, apply migrations, and then restart. `npm run backup:sqlite` creates and checks a database backup, but off-machine retention remains an operator responsibility. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Deployment boundaries

This repository supports one local/single-host Node process with persistent SQLite. It has not been deployed and is not a production-readiness claim. Before public deployment, configure HTTPS, independent managed secrets, a durable volume, off-machine tested backups, monitoring, proxy/origin rules, resource limits, and one application writer. Review every sample product, price, stock value, image right, policy, tax setting, return rule, contact detail, and shipping region. Do not deploy this SQLite profile to an ephemeral or multi-writer platform.

This workspace is not a standalone Git repository and sits below a broader ancestor repository. Do not stage or commit from the ancestor root. Initialize a standalone repository here only with the owner's approval.

# Deployment and backup boundaries

## Supported profile

The verified profile is one Node.js process on one host. It stores SQLite at `.data/db/shaffaq.sqlite` and re-encoded uploaded media at `.data/media`. Both locations must persist and be backed up together.

This work has not deployed SHAFFAQ and does not certify production readiness. Do not use an ephemeral/serverless filesystem or multiple application writers with this SQLite profile.

PKR and Pakistan cash on delivery are the only live market/payment configuration. International shipping-region records must remain disabled until real pricing, payment, fulfilment, tax, and policy work is completed. No fake currency conversion exists.

## Before any public launch

- Put the application behind reviewed HTTPS termination and set `APP_ORIGIN` to the exact canonical origin.
- Generate independent 32-byte-or-longer `SESSION_SECRET` and `CSRF_SECRET` values in a secret manager.
- Provision one durable volume for the database and uploaded media. Keep one application writer and verify SQLite locking.
- Schedule forward-only migrations during maintenance. Back up before every migration.
- Configure encrypted off-machine backups and complete a restore drill for both database and media.
- Add monitoring, log retention, resource limits, and tested proxy/origin handling.
- Review every sample product, image right, price, stock level/threshold, coupon, shipping rate, social link, SEO default, contact detail, and policy template.
- Obtain local legal/tax review before enabling tax or accepting real orders, returns, exchanges, reviews, or newsletter consent.
- Define retention and access rules for order PII, consent records, anonymous wishlist tokens, reviews, stock history, and audit logs.
- Configure and test a real WhatsApp number only if the user-initiated `wa.me` inquiry flow is wanted.

Online payments, transactional/newsletter email delivery, courier APIs, external object storage, analytics execution, international pricing/conversion, and WhatsApp Business API delivery remain disabled. Stored settings and courier/tracking text fields do not enable those providers.

## Migration procedure

1. Stop application writes.
2. Run `npm run backup:sqlite` and copy the backup plus `.data/media` off-host.
3. Run `npm run db:migrate` once against the intended `SQLITE_PATH`.
4. Run `npm run db:seed`; it is idempotent and adds only defaults/baseline operational records. It does not fabricate customers, orders, sales, coupons, or reviews.
5. Require both checks to pass:

   ```powershell
   sqlite3 .data/db/shaffaq.sqlite "PRAGMA integrity_check; PRAGMA foreign_key_check;"
   ```

6. Build and smoke test on loopback before routing traffic.

Never edit a migration that has already been applied. Add a new forward-only migration for later schema changes.

## Backup

Stop writes when practical, then run:

```powershell
npm run backup:sqlite
```

The command uses SQLite's backup API and verifies the resulting database with `PRAGMA integrity_check`. Copy the resulting `.data/backups/*.sqlite` file and `.data/media` to encrypted off-machine storage. A database-only backup is incomplete when uploaded media is in use. Retain old media files referenced by replacement/audit history.

## Restore rehearsal

1. Stop the application.
2. Preserve the current `.data` directory rather than overwriting it.
3. Restore the chosen SQLite file as `.data/db/shaffaq.sqlite` and restore its matching `.data/media` tree.
4. Run `PRAGMA integrity_check` and require `ok`; run `PRAGMA foreign_key_check` and require no rows.
5. Run `npm run db:migrate` against the restored copy.
6. Start on loopback and verify homepage/media, product and collection pages, anonymous wishlist, cart/coupon totals, COD checkout, the path-capability order page, admin login, inventory history, exports, invoice/packing slip, returns, review moderation, newsletter consent state, and settings.

## Disposable browser smoke

After a successful production build, run:

```powershell
npm run smoke:browser
```

The wrapper creates a random database/media directory under `.data/smoke`, generates signing secrets and an admin password in process memory, migrates/seeds/bootstraps that database, sets a disposable WhatsApp test number, starts the built app on loopback, runs desktop and 390px Chrome checks, then stops the app and deletes the disposable directory. It does not require a reusable `.env` admin password or an existing `whatsapp_number` setting.

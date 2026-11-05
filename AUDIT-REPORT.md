# Alpha Dental Management — Code Audit & Repair Notes

## Scope
This audit used the supplied `Alpha-Dental-Management-Staff-Admin-Update.zip`. The original root project files were retained. The duplicate `alpha_work2/` copy and bundled `node_modules/` were excluded from the repaired delivery to remove ambiguity and avoid shipping platform-specific dependencies. No production database or Supabase project was accessed or modified.

## Repairs implemented
- Landing/login brand panel now uses the supplied pediatric dental-care image as a responsive background with a readable overlay; login form and authentication handlers remain unchanged.
- Landing feature/icon grid now includes a Clinic tile displaying the configured `clinic_name` from public settings, with a Settings hint when it is not configured. Clinic name is editable through the existing Settings page.
- Staff directory API now returns only staff-directory fields and does not expose the Supabase Auth `user_id` linkage identifier.
- Email-based linking of a staff profile to an Auth user now requires a confirmed Auth email.
- Dentist patient listing and patient detail/update/archive access are limited to patients linked through that dentist's appointments or clinical activity.
- Dentist appointment list/detail/update access is scoped to their own appointments; dentists cannot reassign an appointment to another dentist or change its patient through the update endpoint.
- Dentist clinical record, treatment, and prescription reads are scoped to records assigned to that dentist; new clinical entries use the authenticated dentist ID rather than a client-supplied dentist ID.
- Permanent patient deletion is blocked when linked clinical, appointment, document, or financial records exist; archiving remains available. This avoids cascading deletion of important patient history.
- Patient search input is length-limited and sanitized before constructing a PostgREST OR filter.
- Added `.env.example` documenting browser-safe and server-only Supabase configuration.

## Verification actually performed
- JavaScript syntax checks (`node --check`) passed for all `api/*.js` and `netlify/functions/*.mjs` files after edits.
- Production build was attempted with `npm run build` and did **not** complete. TypeScript reported missing `node` and `vite/client` type definitions because the extracted `node_modules` directory is incomplete.
- Dependency installation (`npm ci --ignore-scripts --no-audit --no-fund`) was attempted but timed out in this environment.
- Lint was attempted (`npm run lint`) but could not start because the ESLint executable is not installed in the extracted dependency tree.
- No live API, Supabase, authentication, payment RPC, storage, or browser end-to-end tests were run.

## Important outstanding risks / manual verification
1. Dentist authorization was tightened for the patient, appointment, dental-record, treatment, and prescription routes. Review every other route that can return patient-linked data (documents, invoices, payments, dashboard, reports, exports) before production use. In particular, accountant and receptionist data scope must be tested against actual clinic policy.
2. Supabase service-role/secret keys bypass RLS. Every server API route must enforce role and record-level access before using the privileged client. Keep `SUPABASE_SECRET_KEY` server-side only.
3. Confirm the deployed database has the consent columns added by `supabase/alpha-dental-enhancements.sql`; the patient registration API writes consent fields. Do not run the seed-containing `supabase/migration.sql` against production without reviewing its `ON CONFLICT DO UPDATE` seed statements and comparing schema first.
4. Confirm the `record_payment` PostgreSQL function and unique `payments.idempotency_key` index exist in the live project before accepting production payments.
5. The current archive includes SQL migrations and seed data; none were executed. No patient or financial records were changed.
6. Review CORS `APP_ORIGIN`, Supabase Auth invite/redirect URLs, password reset URLs, storage bucket policies, and file size/type limits in the deployed environment.
7. A full functional audit still requires a non-production Supabase test project and test accounts for each role.

## Netlify deployment settings for this cleaned archive
The project root contains `package.json` and `netlify.toml`:
- Base directory: blank (repository root)
- Package directory: blank
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions` (already configured in `netlify.toml`)
- Node version: 22 (already configured)

Set environment variables in Netlify:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (server-only; never use a `VITE_` prefix)
- `APP_ORIGIN` (optional; deployed site origin)

## Readiness assessment
**Not production-certified.** The archive has targeted code repairs and syntax checks, but build, lint, integration, security, and live workflow verification remain incomplete because dependency installation was unavailable and no test Supabase environment was supplied. Deploy only to a preview/staging site after a successful clean dependency install and production build; do not run SQL migrations against the live database without a schema backup and review.

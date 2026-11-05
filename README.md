# SifaDent / DentalCare Clinic Management

Production-ready Vite + React + Supabase application configured for Netlify.

## Stack
- React 19 + TypeScript
- Vite 7
- Supabase Auth + PostgreSQL
- Netlify Functions for the protected server API
- Tailwind CSS

## Required environment variables

### Browser-safe (Netlify site variables)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Server-only (Netlify Functions variables)
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `APP_ORIGIN`

Never commit a Supabase secret key and never prefix a server secret with `VITE_`.

## Local development
1. Copy `.env.example` to `.env.local`.
2. Fill in the Supabase URL, publishable key and server secret key.
3. Run `npm ci`.
4. Run `npm run dev`.

For local API testing, use Netlify CLI or deploy to a Netlify preview because the production API is implemented as a Netlify Function.

## Production deployment
1. Run `supabase/migration.sql` in the Supabase SQL Editor.
2. In Netlify, import the Git repository.
3. Netlify configuration is already defined in `netlify.toml`: build `npm run build`, publish `dist`, functions `netlify/functions`.
4. Add the required environment variables in Netlify.
5. Deploy.
6. In Supabase Auth, configure the production site URL and Google provider if Google login is required.
7. Create the first Supabase Auth user, then make sure the matching email exists as an active `clinic_staff` row.

## Security notes
- The browser receives only the Supabase publishable key.
- The Netlify function uses the Supabase secret key only after authentication and role checks.
- Patient document storage is private and uses time-limited signed URLs.
- Netlify API uploads are limited to 4 MB per file because buffered function requests have a 6 MB payload limit and base64 encoding adds overhead.

## Important
The original Design Arena/Vercel package contained a server secret in `vercel.json`. That file has been removed from this production package. If the old secret was ever committed or deployed, rotate/revoke it in Supabase before production use.


## Feature upgrade migration
For an already-deployed SifaDent database, run `supabase/feature-upgrade.sql` once in the Supabase SQL Editor after deploying this version. It adds patient type, branding settings and the public clinic-assets bucket. Do not rerun the full migration against a populated production database unless you have reviewed it.

### Receptionist financial access
Receptionists use **Today's Payments** rather than the full Billing page. The API enforces the restriction server-side: receptionist payment reads are limited to the Nairobi calendar day, invoice browsing is denied, and receptionist payment dates are forced to today.

### Google authentication
Google sign-in/sign-up remains implemented through Supabase Auth. In Supabase Auth, enable Google and add the deployed site's `/login` URL to the provider's redirect configuration.

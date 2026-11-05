# SifaDent — New GitHub + Netlify Project Setup

This package is the updated SifaDent production project. It is intended to be pushed to a **new GitHub repository** and connected to a **new Netlify site**.

## 1. Files you should push

Push the entire contents of this folder to GitHub. Important files include:

- `src/` — application UI and pages
- `api/` — protected API handlers
- `netlify/functions/` — Netlify API function
- `supabase/migration.sql` — database schema for a fresh database
- `supabase/feature-upgrade.sql` — upgrade for an existing SifaDent database
- `supabase/seed.sql` — optional seed data
- `.env.example` — environment variable template
- `netlify.toml` — Netlify build/function/redirect configuration
- `package.json` and `package-lock.json` — dependencies
- `vite.config.ts`, `tsconfig*.json` — build configuration

Do **not** upload `.env.local`, real Supabase secret keys, `node_modules`, or `dist`.

## 2. Create the new GitHub repository

Create a new empty repository, for example:

`SifaDent-Clinic-Management`

Then from this project folder:

```bash
git init
git add .
git commit -m "Initial SifaDent production release"
git branch -M main
git remote add origin YOUR_NEW_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_NEW_GITHUB_REPOSITORY_URL` with the URL of the new repository.

## 3. Install and test locally

Open the project in VS Code, then run:

```bash
npm ci
npm run build
```

For the frontend:

```bash
npm run dev
```

For Netlify Functions/API testing locally, install Netlify CLI if needed and use:

```bash
netlify dev
```

## 4. Supabase

### If this new project should use the EXISTING SifaDent Supabase project

Run only:

```text
supabase/feature-upgrade.sql
```

Do not run `supabase/migration.sql` on the populated production database unless you have reviewed it carefully.

### If this is a COMPLETELY NEW Supabase project

Run:

```text
supabase/migration.sql
```

Then optionally:

```text
supabase/seed.sql
```

After that, configure Supabase Auth and create/link the first active clinic staff account.

## 5. Netlify

Import the new GitHub repository into Netlify.

The included `netlify.toml` already configures:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- `/api/*` → Netlify Function routing
- SPA fallback to `index.html`

Set these environment variables in Netlify:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
APP_ORIGIN=https://YOUR-NEW-SITE.netlify.app
```

Never put `SUPABASE_SECRET_KEY` behind a `VITE_` prefix.

## 6. Google Login

In Supabase Authentication:

- Enable Google provider.
- Configure the Google OAuth credentials.
- Add the new Netlify site's authentication redirect URL as required by the Supabase project.
- Update the Google OAuth authorized redirect URI to the Supabase callback URL shown by Supabase.

## 7. First admin account

Create the administrator in Supabase Auth first. Then create/link the corresponding active `clinic_staff` record using the actual schema:

- `user_id`
- `full_name`
- `email`
- `role` = `Admin`
- `status` = `Active`

The authenticated user's Supabase UUID must match `clinic_staff.user_id`.

## 8. Before production

Test at minimum:

- Admin login
- Google login
- Patient creation and Patient Type
- Patient overview
- New Treatment
- Invoice creation
- Unpaid/Partial/Paid status
- Record Payment
- Invoice printing
- Receptionist login
- Receptionist Today's Payments
- Receptionist inability to access full Billing
- Settings themes
- Software name
- Logo upload/replacement
- Mobile/tablet layout

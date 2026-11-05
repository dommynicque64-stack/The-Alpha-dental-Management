# SifaDent Feature Upgrade

## Deploying the updated application

1. Replace the currently deployed project with this updated project in your Git repository.
2. Commit and push to the deployment branch.
3. Deploy/redeploy on Netlify.
4. In Supabase SQL Editor, run `supabase/feature-upgrade.sql` once against the existing production database.
5. Verify these environment variables remain configured in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `APP_ORIGIN`

## Google Login

Google authentication is already implemented in the application. In Supabase:
- Authentication → Providers → Google: enable Google.
- Configure the Google OAuth client with the Supabase callback URL shown by Supabase.
- Add the production site's `/login` URL to the Supabase URL configuration / Google redirect configuration as required by your Supabase setup.

A Google user still needs an active `clinic_staff` row before they can access the clinic application.

## Existing staff database compatibility

The application now reads the deployed `clinic_staff` schema using:
- `user_id`
- `full_name`
- `email`
- `role`
- `status`

Staff status and role comparisons are normalized so existing rows using `Active` / `Admin` are still recognized.

## Receptionist restrictions

Receptionists:
- See `Today's Payments` instead of the full Billing navigation.
- Can record payments against an invoice number.
- Can see only payments for the current Nairobi calendar day.
- Cannot browse invoices or outstanding balances.
- Cannot access the full Billing route even by typing its URL.
- Payment dates are forced to the current Nairobi calendar day server-side.

Admins and accountants retain the full Billing workflow.

## Patient type

Existing patients are assigned `outpatient` by the migration if they do not already have a value. New patients can be registered as:
- Outpatient
- Inpatient

The type is displayed in patient lists and patient details.

## Branding

The administrator can set:
- Theme
- Software name
- Clinic name
- Clinic address/phone/email
- Logo

The logo is stored in the public `clinic-assets` bucket and appears in the login screen, application branding and printed invoices.

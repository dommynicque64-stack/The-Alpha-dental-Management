# Alpha Dental Management – Upgrade Package

This is an incremental update to the supplied React + TypeScript + Vite + Supabase application. It preserves the existing project structure and adds the changes listed below.

## Included in this update

- Alpha Dental Management branding and supplied logo used in the login/sidebar, favicon and PWA icons.
- PWA manifest, service worker, and an install button when Chrome reports that the application is installable.
- Patient registration now labels the existing `address` field as **Residence** and captures a consent acknowledgement and touch-friendly digital signature.
- Signature and consent metadata are stored on the patient row and displayed on the patient overview.
- Staff creation now sends a Supabase Auth invitation and links the resulting Auth user to `clinic_staff`. Deactivation/reactivation also updates the Auth ban state.
- Staff password reset email action and signed-in administrator password change.
- Editable prescriptions with server-side clinical-write permission checks.
- Adult and primary-child FDI odontogram selection.
- Appointment dentist dropdown now lists active staff with the Dentist role only; the API independently validates the selected dentist.
- Patient record print/export view includes patient details, clinical records, treatments, prescriptions, consent/signature and invoice details when the current role is permitted to access billing. Chrome's print dialog can save this view as PDF.

## Required deployment steps

1. Back up the production Supabase database and current deployed source before replacing files.
2. Merge these source changes into the existing GitHub branch; do not replace production environment variables.
3. In Supabase SQL Editor, run `supabase/alpha-dental-enhancements.sql` once.
4. Confirm the Netlify/Vercel server environment has `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or the existing `SUPABASE_SERVICE_ROLE_KEY`) configured. Never expose this key in a `VITE_` variable.
5. Confirm Supabase Auth email invitations and password-reset emails are configured, and add the deployed application URL to Supabase Auth redirect URL allow-lists.
6. Deploy over HTTPS. Open the site in Chrome; use the **Install app** control when it appears, or Chrome's install icon/menu.
7. Test in a staging project first, especially staff invitation/deactivation, patient registration, signature persistence, appointment assignment, prescription editing and record export.

## Important verification notes

- The patient signature is stored as a PNG data URL in the `patients` row. For a high-volume production clinic, moving signatures to a private Supabase Storage bucket with short-lived signed URLs is preferable to storing image data in a text column.
- The patient record export opens a print-ready report; choose **Save as PDF** in Chrome's print destination. It is not a server-generated PDF attachment.
- The children's odontogram currently charts the 20 primary teeth (FDI 51–55, 61–65, 71–75 and 81–85). Mixed-dentition workflows that show retained primary and erupted permanent teeth simultaneously need a further clinical UX pass.
- A full production build and live Supabase integration test could not be completed in this environment because project dependencies could not be installed. Run `npm ci`, `npm run check`, and test against a non-production Supabase project before deployment.

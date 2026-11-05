import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2 } from 'lucide-react';
import { Card } from '../components/ui';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Authentication and access control',
    body: [
      'Sign in with email/password or Google through Supabase Auth; sessions persist securely in the browser.',
      'After login, every API request verifies the Supabase access token and requires an active clinic_staff row matched by user ID or email.',
      'No active role means HTTP 403 and no application access. Role permissions are enforced server-side.',
      'Passwords live only in Supabase Auth. Server secrets are kept in Netlify environment variables and are never bundled into the browser.',
    ],
  },
  {
    title: '2. Key workflows',
    body: [
      'Patients → Register Patient → patient file → Overview, Appointments, Dental Records, Treatments, Prescriptions and Documents.',
      'Appointments → booking validates time ranges and prevents dentist overlaps in both the API and PostgreSQL.',
      'Patient file → Odontogram supports FDI tooth charting and clinical records.',
      'Billing → invoices and payments update balances on the server.',
      'Reports → date-range revenue, appointments, payment-method and procedure reporting.',
      'Staff (admin) → add a clinic_staff role using the person’s Supabase Auth email; first login automatically links the account.',
    ],
  },
  {
    title: '3. Netlify deployment',
    body: [
      'Run supabase/migration.sql in the Supabase SQL Editor before using the application.',
      'In Netlify, connect the Git repository. Build command: npm run build. Publish directory: dist. Functions directory: netlify/functions.',
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as browser-safe variables.',
      'Set SUPABASE_URL, SUPABASE_SECRET_KEY and APP_ORIGIN as server-side variables. Never prefix server secrets with VITE_.',
      'For Google sign-in, enable Google in Supabase Authentication → Providers and add your Netlify site URL to the allowed redirect URLs.',
    ],
  },
  {
    title: '4. Storage and production safety',
    body: [
      'Patient documents use the patient-documents Supabase Storage bucket. Keep this bucket private in production and serve documents through authenticated server-generated access URLs.',
      'The Netlify API uses the Supabase secret key only on the server after authentication and authorization checks.',
      'Back up the Supabase database regularly and test restore procedures before production use.',
    ],
  },
  {
    title: '5. Future modules',
    body: [
      'M-Pesa Daraja integration can be added as a separate authenticated server function.',
      'SMS reminders can be implemented with a scheduled Netlify function or external job.',
      'Multi-branch support should add branch_id and server-side branch scoping to every clinic-owned table.',
    ],
  },
];

export default function Docs() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/login" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
      <Card className="p-5 sm:p-8">
        <div className="mb-5 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-teal-700" />
          <h1 className="text-xl font-extrabold text-slate-900">Setup & Deployment Guide</h1>
        </div>
        <div className="space-y-6">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="mb-2 text-sm font-bold text-slate-900">{s.title}</h2>
              <ul className="space-y-1.5">
                {s.body.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

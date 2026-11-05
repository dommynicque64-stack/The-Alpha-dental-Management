import supabase from './db-client.js';

export const ROLE_PERMS = {
  admin: ['*'],
  dentist: ['dashboard.read','patients.read','patients.write','appointments.read','appointments.write','clinical.read','clinical.write'],
  receptionist: ['dashboard.read','patients.read','patients.write','appointments.read','appointments.write','payments.today','payments.write','clinical.read'],
  accountant: ['dashboard.read','patients.read','appointments.read','billing.read','billing.write','reports.read'],
};

export function hasPerm(staff, perm) {
  if (!staff) return false;
  if (staff.role === 'admin') return true;
  return (ROLE_PERMS[staff.role] || []).includes(perm);
}

export function sendCors(req, res) {
  const origin = process.env.APP_ORIGIN || req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export async function requireAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized: missing session token' }); return null; }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) { res.status(401).json({ error: 'Unauthorized: invalid or expired session' }); return null; }
  let staff = null;
  const byId = await supabase.from('clinic_staff').select('*').eq('user_id', user.id).maybeSingle();
  if (byId.error) {
    console.error('Staff lookup by user id failed:', byId.error);
    res.status(500).json({ error: 'Unable to verify clinic staff role.' });
    return null;
  }
  staff = byId.data;
  if (staff && String(staff.status).toLowerCase() !== 'active') staff = null;

  if (!staff && user.email && user.email_confirmed_at) {
    const byEmail = await supabase.from('clinic_staff').select('*').ilike('email', String(user.email).toLowerCase()).maybeSingle();
    if (byEmail.error) {
      console.error('Staff lookup by email failed:', byEmail.error);
      res.status(500).json({ error: 'Unable to verify clinic staff role.' });
      return null;
    }
    staff = byEmail.data;
    if (staff && String(staff.status).toLowerCase() !== 'active') staff = null;
    if (staff && !staff.user_id) {
      await supabase.from('clinic_staff').update({ user_id: user.id }).eq('id', staff.id);
      staff.user_id = user.id;
    }
  }
  if (!staff) { res.status(403).json({ error: 'Access denied: no active staff role. Contact your administrator.' }); return null; }
  staff.role = String(staff.role || '').toLowerCase();
  staff.status = String(staff.status || '').toLowerCase();
  return { user, staff };
}


export function todayNairobi() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function toMinutes(t) {
  if (!t) return 0;
  const parts = String(t).split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}


// Return the patient IDs linked to a dentist through their own appointments
// or clinical activity. The server uses this because its service-role client
// bypasses Supabase RLS.
export async function getDentistPatientIds(staff) {
  if (!staff || staff.role !== 'dentist') return null;
  const [appointments, records, treatments] = await Promise.all([
    supabase.from('appointments').select('patient_id').eq('dentist_id', staff.id),
    supabase.from('dental_records').select('patient_id').eq('dentist_id', staff.id),
    supabase.from('treatments').select('patient_id').eq('dentist_id', staff.id),
  ]);
  for (const result of [appointments, records, treatments]) {
    if (result.error) throw result.error;
  }
  return [...new Set([
    ...(appointments.data || []), ...(records.data || []), ...(treatments.data || []),
  ].map((row) => Number(row.patient_id)).filter(Number.isFinite))];
}

export async function dentistCanAccessPatient(staff, patientId) {
  if (!staff || staff.role !== 'dentist') return true;
  const ids = await getDentistPatientIds(staff);
  return ids.includes(Number(patientId));
}

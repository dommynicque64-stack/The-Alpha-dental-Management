import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm, rangesOverlap } from './auth-helper.js';

async function enrich(rows) {
  if (!rows.length) return [];
  const patientIds = [...new Set(rows.map((r) => r.patient_id).filter(Boolean))];
  const dentistIds = [...new Set(rows.map((r) => r.dentist_id).filter(Boolean))];
  let patients = [];
  let dentists = [];
  if (patientIds.length) {
    const { data } = await supabase.from('patients').select('id, first_name, last_name, phone').in('id', patientIds);
    patients = data || [];
  }
  if (dentistIds.length) {
    const { data } = await supabase.from('clinic_staff').select('id, full_name').in('id', dentistIds);
    dentists = data || [];
  }
  const pMap = Object.fromEntries(patients.map((p) => [p.id, p]));
  const dMap = Object.fromEntries(dentists.map((d) => [d.id, d]));
  return rows.map((r) => ({
    ...r,
    patient_name: pMap[r.patient_id] ? `${pMap[r.patient_id].first_name} ${pMap[r.patient_id].last_name}` : '—',
    patient_phone: pMap[r.patient_id]?.phone || '',
    dentist_name: dMap[r.dentist_id]?.full_name || '—',
  }));
}

// Server-side overlap guard: no two non-cancelled appointments for the same
// dentist on the same day may overlap in time. (A DB trigger in
// supabase/migration.sql enforces the same rule at the database level.)
async function findOverlap(dentist_id, appointment_date, start_time, end_time, excludeId) {
  let q = supabase.from('appointments').select('id, start_time, end_time').eq('dentist_id', dentist_id).eq('appointment_date', appointment_date).neq('status', 'cancelled');
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).find((a) => rangesOverlap(start_time, end_time, a.start_time, a.end_time)) || null;
}

export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff, user } = auth;

    if (req.method === 'GET') {
      if (!hasPerm(staff, 'appointments.read')) return res.status(403).json({ error: 'Forbidden.' });
      const { id, date, from, to, dentist_id, patient_id, status } = req.query;
      if (id) {
        let singleQuery = supabase.from('appointments').select('*').eq('id', id);
        if (staff.role === 'dentist') singleQuery = singleQuery.eq('dentist_id', staff.id);
        const { data, error } = await singleQuery.single();
        if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.code === 'PGRST116' ? 'Appointment not found.' : error.message });
        if (!data) return res.status(404).json({ error: 'Appointment not found.' });
        const [row] = await enrich([data]);
        return res.status(200).json(row);
      }
      let q = supabase.from('appointments').select('*').order('appointment_date', { ascending: true }).order('start_time', { ascending: true });
      if (date) q = q.eq('appointment_date', date);
      if (from) q = q.gte('appointment_date', from);
      if (to) q = q.lte('appointment_date', to);
      if (staff.role === 'dentist') q = q.eq('dentist_id', staff.id);
      else if (dentist_id) q = q.eq('dentist_id', dentist_id);
      if (patient_id) q = q.eq('patient_id', patient_id);
      if (status) q = q.eq('status', status);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return res.status(200).json(await enrich(data || []));
    }

    if (req.method === 'POST') {
      if (!hasPerm(staff, 'appointments.write')) return res.status(403).json({ error: 'Forbidden: your role cannot book appointments.' });
      const b = req.body || {};
      const { patient_id, appointment_date, start_time, end_time } = b;
      const dentist_id = staff.role === 'dentist' ? staff.id : b.dentist_id;
      if (!patient_id || !dentist_id || !appointment_date || !start_time || !end_time) {
        return res.status(400).json({ error: 'Patient, dentist, date, start and end time are required.' });
      }
      if (start_time >= end_time) return res.status(400).json({ error: 'End time must be after start time.' });
      const { data: patient, error: patientError } = await supabase.from('patients').select('id,status').eq('id', patient_id).maybeSingle();
      if (patientError) throw patientError;
      if (!patient || patient.status === 'archived') return res.status(404).json({ error: 'Patient not found or archived.' });
      const { data: assignedDentist, error: dentistError } = await supabase.from('clinic_staff').select('id').eq('id', dentist_id).eq('role', 'dentist').eq('status', 'active').maybeSingle();
      if (dentistError) throw dentistError;
      if (!assignedDentist) return res.status(400).json({ error: 'Select an active staff member with the Dentist role.' });
      const clash = await findOverlap(dentist_id, appointment_date, start_time, end_time, null);
      if (clash) return res.status(409).json({ error: `Overlapping appointment: this dentist already has a booking ${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)} on ${appointment_date}.` });
      const { data, error } = await supabase.from('appointments').insert({
        patient_id, dentist_id, appointment_date, start_time, end_time,
        reason: b.reason || null, status: b.status || 'scheduled',
        notes: b.notes || null, created_by: user.email,
      }).select().single();
      if (error) throw error;
      await supabase.from('notifications').insert({ title: 'Appointment booked', message: `Appointment on ${appointment_date} at ${String(start_time).slice(0, 5)} booked by ${staff.full_name}.`, type: 'appointment', related_id: `appointment:${data.id}`, is_read: false });
      const [row] = await enrich([data]);
      return res.status(201).json(row);
    }

    if (req.method === 'PUT') {
      if (!hasPerm(staff, 'appointments.write')) return res.status(403).json({ error: 'Forbidden.' });
      const { id, ...patch } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required.' });
      let currentQuery = supabase.from('appointments').select('*').eq('id', id);
      if (staff.role === 'dentist') currentQuery = currentQuery.eq('dentist_id', staff.id);
      const { data: current, error: curErr } = await currentQuery.single();
      if (curErr) return res.status(curErr.code === 'PGRST116' ? 404 : 500).json({ error: curErr.code === 'PGRST116' ? 'Appointment not found.' : curErr.message });
      if (staff.role === 'dentist') {
        delete patch.dentist_id;
        delete patch.patient_id;
      }
      const allowedFields = new Set(['dentist_id', 'patient_id', 'appointment_date', 'start_time', 'end_time', 'reason', 'status', 'notes']);
      for (const key of Object.keys(patch)) {
        if (!allowedFields.has(key) && key !== 'updated_at') delete patch[key];
      }
      const next = { ...current, ...patch };
      if (patch.dentist_id !== undefined) {
        const { data: assignedDentist, error: dentistError } = await supabase.from('clinic_staff').select('id').eq('id', next.dentist_id).eq('role', 'dentist').eq('status', 'active').maybeSingle();
        if (dentistError) throw dentistError;
        if (!assignedDentist) return res.status(400).json({ error: 'Select an active staff member with the Dentist role.' });
      }
      if (next.status !== 'cancelled' && next.start_time >= next.end_time) {
        return res.status(400).json({ error: 'End time must be after start time.' });
      }
      if (next.status !== 'cancelled') {
        const clash = await findOverlap(next.dentist_id, next.appointment_date, next.start_time, next.end_time, id);
        if (clash) return res.status(409).json({ error: `Overlapping appointment: this dentist already has a booking ${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)} on ${next.appointment_date}.` });
      }
      patch.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('appointments').update(patch).eq('id', id).select().single();
      if (error) throw error;
      const [row] = await enrich([data]);
      return res.status(200).json(row);
    }

    if (req.method === 'DELETE') {
      if (!hasPerm(staff, 'appointments.write')) return res.status(403).json({ error: 'Forbidden.' });
      const id = req.body?.id || req.query.id;
      const hard = req.query.hard === '1';
      if (!id) return res.status(400).json({ error: 'id is required.' });
      if (staff.role === 'dentist') {
        const { data: owned, error: ownedError } = await supabase.from('appointments').select('id').eq('id', id).eq('dentist_id', staff.id).maybeSingle();
        if (ownedError) throw ownedError;
        if (!owned) return res.status(404).json({ error: 'Appointment not found.' });
      }
      if (hard && staff.role !== 'admin') return res.status(403).json({ error: 'Only admins can permanently delete.' });
      if (hard) {
        const { error } = await supabase.from('appointments').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      const { data, error } = await supabase.from('appointments').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/appointments error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

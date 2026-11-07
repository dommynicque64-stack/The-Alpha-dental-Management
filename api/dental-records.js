import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm, getDentistPatientIds, dentistCanAccessPatient } from './auth-helper.js';

// Dental records (clinical notes + odontogram entries).
// Write: admin, dentist only. Read: clinical.read roles.
export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff, user } = auth;
    if (req.method === 'GET') {
      if (!hasPerm(staff, 'clinical.read')) return res.status(403).json({ error: 'Forbidden.' });
      let q = supabase.from('dental_records').select('*').order('record_date', { ascending: false }).limit(200);
      if (req.query.patient_id) {
        if (!(await dentistCanAccessPatient(staff, req.query.patient_id))) return res.status(404).json({ error: 'Patient not found.' });
        q = q.eq('patient_id', req.query.patient_id);
      } else if (staff.role === 'dentist') {
        const ids = await getDentistPatientIds(staff);
        if (!ids.length) return res.status(200).json([]);
        q = q.in('patient_id', ids);
      }
      if (req.query.id) q = q.eq('id', req.query.id);
      const { data, error } = await q;
      if (error) throw error;
      const dentistIds = [...new Set((data || []).map(r => r.dentist_id).filter(Boolean))];
      let dentistMap = {};
      if (dentistIds.length) {
        const { data: dentists } = await supabase.from('clinic_staff').select('id, full_name, email, phone, specialty').in('id', dentistIds);
        dentistMap = Object.fromEntries((dentists || []).map(d => [d.id, d]));
      }
      return res.status(200).json((data || []).map(r => ({
        ...r,
        dentist_name: dentistMap[r.dentist_id]?.full_name || null,
        dentist_email: dentistMap[r.dentist_id]?.email || null,
        dentist_phone: dentistMap[r.dentist_id]?.phone || null,
        dentist_specialty: dentistMap[r.dentist_id]?.specialty || null,
      })));
    }
    if (req.method === 'POST') {
      if (!hasPerm(staff, 'clinical.write')) return res.status(403).json({ error: 'Forbidden: your role cannot modify clinical records.' });
      const b = req.body || {};
      if (staff.role === 'dentist' && !(await dentistCanAccessPatient(staff, b.patient_id))) return res.status(403).json({ error: 'You can only document patients assigned to you.' });
      if (!b.patient_id || !b.diagnosis) return res.status(400).json({ error: 'patient_id and diagnosis are required.' });
      const patientId = Number(b.patient_id);
      if (!Number.isInteger(patientId) || patientId <= 0) return res.status(400).json({ error: 'A valid patient is required.' });
      const patient = await supabase.from('patients').select('id').eq('id', patientId).maybeSingle();
      if (patient.error) throw patient.error;
      if (!patient.data) return res.status(404).json({ error: 'Patient not found.' });

      let dentistId;
      if (staff.role === 'dentist') dentistId = staff.id;
      else if (b.dentist_id != null && b.dentist_id !== '') dentistId = Number(b.dentist_id);
      else dentistId = staff.id;
      if (!Number.isInteger(dentistId) || dentistId <= 0) return res.status(400).json({ error: 'A valid treating dentist is required.' });
      const dentist = await supabase.from('clinic_staff').select('id, role, status').eq('id', dentistId).maybeSingle();
      if (dentist.error) throw dentist.error;
      if (!dentist.data || dentist.data.status !== 'active' || !['dentist', 'admin'].includes(dentist.data.role)) {
        return res.status(400).json({ error: 'The selected treating dentist is not an active clinic staff member.' });
      }
      const allowedStatuses = ['open', 'in_progress', 'closed'];
      const recordStatus = String(b.status || 'open').toLowerCase();
      if (!allowedStatuses.includes(recordStatus)) return res.status(400).json({ error: 'Invalid dental record status.' });
      const { data, error } = await supabase.from('dental_records').insert({
        patient_id: patientId, dentist_id: dentistId,
        record_date: b.record_date || new Date().toISOString().slice(0, 10),
        tooth_number: b.tooth_number || null, diagnosis: b.diagnosis,
        treatment_plan: b.treatment_plan || null, notes: b.notes || null,
        status: recordStatus, created_by: user.email,
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      if (!hasPerm(staff, 'clinical.write')) return res.status(403).json({ error: 'Forbidden: your role cannot modify clinical records.' });
      const { id, ...patch } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const existing = await supabase.from('dental_records').select('*').eq('id', id).single();
      if (existing.error || !existing.data) return res.status(404).json({ error: 'Dental record not found.' });
      if (!(await dentistCanAccessPatient(staff, existing.data.patient_id))) return res.status(404).json({ error: 'Dental record not found.' });
      const allowed = ['dentist_id', 'record_date', 'tooth_number', 'diagnosis', 'treatment_plan', 'notes', 'status'];
      const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key)));
      if (staff.role === 'dentist') safePatch.dentist_id = existing.data.dentist_id || staff.id;
      if (safePatch.diagnosis != null && !String(safePatch.diagnosis).trim()) return res.status(400).json({ error: 'Diagnosis is required.' });
      patch.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('dental_records').update({ ...safePatch, updated_at: patch.updated_at }).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (staff.role !== 'admin' && !(staff.role === 'dentist' && hasPerm(staff, 'clinical.write'))) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const existing = await supabase.from('dental_records').select('patient_id').eq('id', id).single();
      if (existing.error || !existing.data) return res.status(404).json({ error: 'Dental record not found.' });
      if (!(await dentistCanAccessPatient(staff, existing.data.patient_id))) return res.status(404).json({ error: 'Dental record not found.' });
      const { error } = await supabase.from('dental_records').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/dental-records error:', err);
    const message = err instanceof Error ? err.message : String(err || 'Internal server error');
    const status = /violat|invalid|duplicate|foreign key|not-null/i.test(message) ? 400 : 500;
    res.status(status).json({ error: status === 400 ? message : 'Unable to save the dental record. Please verify the patient and dentist, then try again.' });
  }
}

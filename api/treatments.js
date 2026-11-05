import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm, getDentistPatientIds, dentistCanAccessPatient } from './auth-helper.js';

// Treatments (procedures). Write: admin/dentist. Accountants/receptionists read-only.
export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff, user } = auth;
    if (req.method === 'GET') {
      if (!hasPerm(staff, 'clinical.read') && !hasPerm(staff, 'billing.read') && !hasPerm(staff, 'patients.read')) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      let q = supabase.from('treatments').select('*').order('treatment_date', { ascending: false }).limit(300);
      if (staff.role === 'dentist') q = q.eq('dentist_id', staff.id);
      if (req.query.patient_id) q = q.eq('patient_id', req.query.patient_id);
      if (req.query.status) q = q.eq('status', req.query.status);
      if (req.query.id) q = q.eq('id', req.query.id);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      if (!hasPerm(staff, 'clinical.write')) return res.status(403).json({ error: 'Forbidden: your role cannot modify clinical records.' });
      const b = req.body || {};
      if (staff.role === 'dentist' && !(await dentistCanAccessPatient(staff, b.patient_id))) return res.status(403).json({ error: 'You can only document patients assigned to you.' });
      if (!b.patient_id || !b.procedure_name) return res.status(400).json({ error: 'patient_id and procedure_name are required.' });
      const { data, error } = await supabase.from('treatments').insert({
        patient_id: b.patient_id, dentist_id: staff.role === 'dentist' ? staff.id : (b.dentist_id || staff.id),
        appointment_id: b.appointment_id || null,
        procedure_name: b.procedure_name, tooth_number: b.tooth_number || null,
        treatment_date: b.treatment_date || new Date().toISOString().slice(0, 10),
        cost: b.cost != null ? Number(b.cost) : 0, status: b.status || 'planned',
        notes: b.notes || null, created_by: user.email,
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      if (!hasPerm(staff, 'clinical.write')) return res.status(403).json({ error: 'Forbidden: your role cannot modify clinical records.' });
      const { id, ...patch } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required.' });
      if (patch.cost != null) patch.cost = Number(patch.cost);
      patch.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('treatments').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!hasPerm(staff, 'clinical.write')) return res.status(403).json({ error: 'Forbidden.' });
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const { error } = await supabase.from('treatments').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/treatments error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

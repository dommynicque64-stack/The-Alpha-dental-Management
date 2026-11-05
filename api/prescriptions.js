import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm, getDentistPatientIds, dentistCanAccessPatient } from './auth-helper.js';

// Prescriptions. Write: admin/dentist only.
export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff, user } = auth;
    if (req.method === 'GET') {
      if (!hasPerm(staff, 'clinical.read')) return res.status(403).json({ error: 'Forbidden.' });
      let q = supabase.from('prescriptions').select('*').order('prescribed_date', { ascending: false }).limit(300);
      if (staff.role === 'dentist') q = q.eq('dentist_id', staff.id);
      if (req.query.patient_id) q = q.eq('patient_id', req.query.patient_id);
      if (req.query.id) q = q.eq('id', req.query.id);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      if (!hasPerm(staff, 'clinical.write')) return res.status(403).json({ error: 'Forbidden: your role cannot modify clinical records.' });
      const b = req.body || {};
      if (staff.role === 'dentist' && !(await dentistCanAccessPatient(staff, b.patient_id))) return res.status(403).json({ error: 'You can only prescribe for patients assigned to you.' });
      if (!b.patient_id || !b.medication) return res.status(400).json({ error: 'patient_id and medication are required.' });
      const { data, error } = await supabase.from('prescriptions').insert({
        patient_id: b.patient_id, dentist_id: staff.role === 'dentist' ? staff.id : (b.dentist_id || staff.id),
        medication: b.medication, dosage: b.dosage || null, frequency: b.frequency || null,
        duration: b.duration || null, instructions: b.instructions || null,
        prescribed_date: b.prescribed_date || new Date().toISOString().slice(0, 10),
        created_by: user.email,
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      if (!hasPerm(staff, 'clinical.write')) return res.status(403).json({ error: 'Forbidden.' });
      const { id, ...input } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const allowed = ['medication', 'dosage', 'frequency', 'duration', 'instructions', 'prescribed_date', 'dentist_id'];
      const patch = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)));
      if (!patch.medication || !String(patch.medication).trim()) return res.status(400).json({ error: 'Medication is required.' });
      const { data, error } = await supabase.from('prescriptions').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!hasPerm(staff, 'clinical.write')) return res.status(403).json({ error: 'Forbidden.' });
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const { error } = await supabase.from('prescriptions').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/prescriptions error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

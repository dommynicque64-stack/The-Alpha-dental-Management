import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm, getDentistPatientIds, dentistCanAccessPatient } from './auth-helper.js';

export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff, user } = auth;
    if (req.method === 'GET') {
      if (!hasPerm(staff, 'patients.read')) return res.status(403).json({ error: 'Forbidden.' });
      const { id, search, status = 'active', sort = 'created_at', order = 'desc', page = '1', limit = '10' } = req.query;
      if (id) {
        if (!(await dentistCanAccessPatient(staff, id))) return res.status(404).json({ error: 'Patient not found.' });
        const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
      const from = (pageNum - 1) * pageSize;
      const to = from + pageSize - 1;
      const sortable = ['created_at', 'first_name', 'last_name', 'date_of_birth', 'updated_at'];
      const sortCol = sortable.includes(String(sort)) ? String(sort) : 'created_at';
      let q = supabase.from('patients').select('*', { count: 'exact' });
      if (staff.role === 'dentist') {
        const assignedIds = await getDentistPatientIds(staff);
        if (!assignedIds.length) return res.status(200).json({ rows: [], total: 0, page: pageNum, limit: pageSize });
        q = q.in('id', assignedIds);
      }
      if (status && status !== 'all') q = q.eq('status', status);
      if (search) {
        const s = String(search).slice(0, 100).replace(/[^a-zA-Z0-9@+._\-\s]/g, '').trim();
        if (s) q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
      }
      q = q.order(sortCol, { ascending: order === 'asc' }).range(from, to);
      const { data, error, count } = await q;
      if (error) throw error;
      return res.status(200).json({ rows: data, total: count ?? data.length, page: pageNum, limit: pageSize });
    }
    if (req.method === 'POST') {
      if (!hasPerm(staff, 'patients.write')) return res.status(403).json({ error: 'Forbidden: your role cannot register patients.' });
      const b = req.body || {};
      if (!b.first_name || !b.last_name || !b.phone) return res.status(400).json({ error: 'First name, last name and phone are required.' });
      if (b.consent_acknowledged !== true || typeof b.consent_signature !== 'string' || b.consent_signature.length > 3000000 || !b.consent_signature.startsWith('data:image/png;base64,')) {
        return res.status(400).json({ error: 'Patient consent acknowledgement and a valid digital signature are required.' });
      }
      const { data, error } = await supabase.from('patients').insert({
        first_name: b.first_name, last_name: b.last_name,
        date_of_birth: b.date_of_birth || null, gender: b.gender || null,
        phone: b.phone, email: b.email || null, address: b.address || null,
        emergency_contact_name: b.emergency_contact_name || null,
        emergency_contact_phone: b.emergency_contact_phone || null,
        emergency_contact_relationship: b.emergency_contact_relationship || null,
        blood_type: b.blood_type || null, allergies: b.allergies || null,
        medical_history: b.medical_history || null,
        insurance_provider: b.insurance_provider || null,
        insurance_number: b.insurance_number || null,
        patient_type: b.patient_type === 'inpatient' ? 'inpatient' : 'outpatient',
        consent_acknowledged: b.consent_acknowledged === true,
        consent_text: b.consent_acknowledged === true ? 'I certify that the above information is accurate and complete to the best of my knowledge. I understand that providing incorrect information can be dangerous to my health. I authorize the dental staff to perform the necessary dental services.' : null,
        consent_signature: b.consent_signature || null,
        consent_signed_at: b.consent_signature ? new Date().toISOString() : null,
        status: 'active', created_by: user.email,
      }).select().single();
      if (error) throw error;
      await supabase.from('notifications').insert({ title: 'New patient registered', message: `${data.first_name} ${data.last_name} was registered by ${staff.full_name}.`, type: 'patient', related_id: `patient:${data.id}`, is_read: false });
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, ...patch } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required.' });
      if (!hasPerm(staff, 'patients.write')) return res.status(403).json({ error: 'Forbidden.' });
      if (staff.role === 'receptionist') {
        const allowed = ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'email', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship', 'insurance_provider', 'insurance_number', 'patient_type', 'status'];
        for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      }
      if (!(await dentistCanAccessPatient(staff, id))) return res.status(404).json({ error: 'Patient not found.' });
      patch.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('patients').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!hasPerm(staff, 'patients.write')) return res.status(403).json({ error: 'Forbidden.' });
      const id = req.body?.id || req.query.id;
      const hard = req.query.hard === '1';
      if (!id) return res.status(400).json({ error: 'id is required.' });
      if (hard && staff.role !== 'admin') return res.status(403).json({ error: 'Only admins can permanently delete.' });
      if (!(await dentistCanAccessPatient(staff, id))) return res.status(404).json({ error: 'Patient not found.' });
      if (hard) {
        // Avoid cascading deletion of clinical and financial history.
        const linkedTables = ['appointments', 'dental_records', 'treatments', 'prescriptions', 'invoices', 'payments', 'documents'];
        for (const table of linkedTables) {
          const { count, error: countError } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('patient_id', id);
          if (countError) throw countError;
          if ((count || 0) > 0) return res.status(409).json({ error: 'This patient has linked clinical or financial records. Archive the patient instead of permanently deleting the record.' });
        }
        const { error } = await supabase.from('patients').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      const { data, error } = await supabase.from('patients').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/patients error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm } from './auth-helper.js';

// Documents metadata. Binary upload goes to the Supabase Storage bucket
// `patient-documents` via /api/upload; this route stores the metadata row.
export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff, user } = auth;
    if (req.method === 'GET') {
      if (!hasPerm(staff, 'patients.read')) return res.status(403).json({ error: 'Forbidden.' });
      let q = supabase.from('documents').select('*').order('uploaded_at', { ascending: false }).limit(200);
      if (req.query.patient_id) q = q.eq('patient_id', req.query.patient_id);
      const { data, error } = await q;
      if (error) throw error;
      const rows = await Promise.all((data || []).map(async (doc) => {
        if (!doc.storage_path) return doc;
        const { data: signed, error: signedErr } = await supabase.storage
          .from('patient-documents')
          .createSignedUrl(doc.storage_path, 60 * 60);
        if (signedErr) return { ...doc, file_url: null };
        return { ...doc, file_url: signed.signedUrl };
      }));
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      if (staff.role === 'accountant') return res.status(403).json({ error: 'Forbidden.' });
      const b = req.body || {};
      if (!b.patient_id || !b.file_name || !b.file_url) return res.status(400).json({ error: 'patient_id, file_name and file_url are required.' });
      const { data, error } = await supabase.from('documents').insert({
        patient_id: b.patient_id, file_name: b.file_name, file_url: b.file_url,
        file_type: b.file_type || null, file_size: b.file_size || null,
        document_type: b.document_type || 'other', uploaded_by: user.email,
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'DELETE') {
      if (staff.role !== 'admin' && staff.role !== 'dentist') return res.status(403).json({ error: 'Forbidden.' });
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const { data: doc } = await supabase.from('documents').select('*').eq('id', id).single();
      if (doc?.storage_path) {
        await supabase.storage.from('patient-documents').remove([doc.storage_path]);
      }
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/documents error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm, dentistCanAccessPatient } from './auth-helper.js';

// Storage upload proxy: receives base64, writes to `patient-documents`
// bucket with the service-role key (never exposed to browser), returns URL.
export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff } = auth;
    if (staff.role === 'accountant') return res.status(403).json({ error: 'Forbidden.' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { fileName, fileBase64, contentType, patientId, assetType } = req.body || {};
    if (!fileName || !fileBase64) return res.status(400).json({ error: 'fileName and fileBase64 are required.' });
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(fileBase64) || fileBase64.length % 4 !== 0) {
      return res.status(400).json({ error: 'Invalid file data.' });
    }
    if (assetType === 'clinic-logo') {
      if (staff.role !== 'admin') return res.status(403).json({ error: 'Only admins can change the clinic logo.' });
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(String(contentType))) {
        return res.status(400).json({ error: 'Logo must be PNG, JPG, WEBP or SVG.' });
      }
      const safe = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `branding/${Date.now()}-${safe}`;
      const buffer = Buffer.from(fileBase64, 'base64');
      if (buffer.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Logo too large. Maximum size is 2 MB.' });
      const { error: upErr } = await supabase.storage.from('clinic-assets').upload(path, buffer, { contentType: contentType || 'image/png', upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('clinic-assets').getPublicUrl(path);
      return res.status(200).json({ url: pub.publicUrl, storage_path: path });
    }
    const numericPatientId = Number(patientId);
    if (!Number.isInteger(numericPatientId) || numericPatientId <= 0) {
      return res.status(400).json({ error: 'A valid patient is required for document uploads.' });
    }
    const patient = await supabase.from('patients').select('id').eq('id', numericPatientId).maybeSingle();
    if (patient.error) throw patient.error;
    if (!patient.data) return res.status(404).json({ error: 'Patient not found.' });
    if (!(await dentistCanAccessPatient(staff, numericPatientId))) return res.status(404).json({ error: 'Patient not found.' });
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/dicom', 'text/plain'];
    if (contentType && !allowedTypes.includes(String(contentType))) {
      return res.status(400).json({ error: 'Unsupported patient document file type.' });
    }
    const safe = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${numericPatientId}/${Date.now()}-${safe}`;
    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'File too large. Netlify API uploads are limited to 4MB per file.' });
    const { error: upErr } = await supabase.storage.from('patient-documents').upload(path, buffer, { contentType: contentType || 'application/octet-stream', upsert: false });
    if (upErr) throw upErr;
    const { data: signed, error: signedErr } = await supabase.storage.from('patient-documents').createSignedUrl(path, 60 * 60);
    if (signedErr) throw signedErr;
    return res.status(200).json({ url: signed.signedUrl, storage_path: path });
  } catch (err) {
    console.error('API /api/upload error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

import supabase from './db-client.js';
import { sendCors, requireAuth } from './auth-helper.js';

// Clinic settings key/value store. Read: any active staff. Write: admin only.
export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('clinic_settings').select('*').order('key');
      if (error) throw error;
      return res.status(200).json(Object.fromEntries((data || []).map((r) => [r.key, r.value])));
    }
    if (req.method === 'PUT') {
      if (auth.staff.role !== 'admin') return res.status(403).json({ error: 'Only admins can change settings.' });
      const entries = Object.entries(req.body || {});
      for (const [key, value] of entries) {
        let savedValue = String(value ?? '').trim();
        if (key === 'clinic_website' && savedValue) {
          if (!/^https?:\/\//i.test(savedValue)) savedValue = `https://${savedValue}`;
          try { new URL(savedValue); } catch { return res.status(400).json({ error: 'Enter a valid clinic website URL.' }); }
        }
        const { error } = await supabase.from('clinic_settings').upsert({ key, value: savedValue, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
      }
      const { data } = await supabase.from('clinic_settings').select('*').order('key');
      return res.status(200).json(Object.fromEntries((data || []).map((r) => [r.key, r.value])));
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/settings error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

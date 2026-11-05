import supabase from './db-client.js';
import { sendCors } from './auth-helper.js';

export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { data, error } = await supabase.from('clinic_settings').select('key,value')
      .in('key', ['clinic_name','software_name','theme','logo_url']);
    if (error) throw error;
    return res.status(200).json(Object.fromEntries((data || []).map(r => [r.key, r.value])));
  } catch (err) {
    console.error('API /api/public-settings error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

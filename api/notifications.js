import supabase from './db-client.js';
import { sendCors, requireAuth } from './auth-helper.js';

// Notifications feed (latest 50) + mark read. All active staff can read.
export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      const unread = (data || []).filter((n) => !n.is_read).length;
      return res.status(200).json({ rows: data, unread });
    }
    if (req.method === 'PUT') {
      const { id, markAll } = req.body || {};
      if (markAll) {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/notifications error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

import supabase from './db-client.js';
import { sendCors, requireAuth } from './auth-helper.js';

export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    if (req.method === 'GET') {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const { staff, user } = auth;
      return res.status(200).json({
        user: { id: user.id, email: user.email },
        staff: { id: staff.id, full_name: staff.full_name, email: staff.email, role: staff.role, status: staff.status, specialty: staff.specialty, phone: staff.phone },
      });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/auth error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

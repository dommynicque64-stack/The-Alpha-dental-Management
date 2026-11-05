import supabase from './db-client.js';
import { sendCors, requireAuth } from './auth-helper.js';

export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff: me } = auth;
    if (req.method === 'GET') {
      // Return only staff-directory fields; never expose Auth linkage IDs.
      let q = supabase.from('clinic_staff').select('id, full_name, email, role, phone, specialty, status, created_at').order('full_name', { ascending: true });
      if (req.query.role) q = q.ilike('role', req.query.role);
      if (req.query.status) q = q.ilike('status', req.query.status);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (me.role !== 'admin') return res.status(403).json({ error: 'Forbidden: only admins can manage staff.' });
    if (req.method === 'POST') {
      const { full_name, email, role, phone, specialty } = req.body || {};
      if (!full_name || !email || !role) return res.status(400).json({ error: 'full_name, email and role are required.' });
      if (!['admin', 'dentist', 'receptionist', 'accountant'].includes(String(role).toLowerCase())) return res.status(400).json({ error: 'Invalid role.' });
      const normalizedEmail = String(email).trim().toLowerCase();
      const { data: existing } = await supabase.from('clinic_staff').select('id').ilike('email', normalizedEmail).maybeSingle();
      if (existing) return res.status(409).json({ error: 'A staff profile with this email already exists.' });

      // Invite through Supabase Auth so the staff member sets their own password.
      const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail);
      if (inviteError) throw inviteError;
      const { data, error } = await supabase.from('clinic_staff').insert({
        user_id: invited.user.id, full_name: String(full_name).trim(), email: normalizedEmail,
        role: String(role).toLowerCase(), phone: phone || null, specialty: specialty || null, status: 'active'
      }).select().single();
      if (error) {
        await supabase.auth.admin.deleteUser(invited.user.id);
        throw error;
      }
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { action, id, password, ...input } = req.body || {};
      // Admin-initiated password changes must run on the server with the
      // Supabase service-role client; never expose that key to the browser.
      if (action === 'set_password') {
        if (!id || typeof password !== 'string' || password.length < 10) {
          return res.status(400).json({ error: 'Choose a staff member and provide a password of at least 10 characters.' });
        }
        if (Number(id) === me.id) {
          return res.status(400).json({ error: 'Use your own account security settings to change your password.' });
        }
        const { data: target, error: targetError } = await supabase
          .from('clinic_staff').select('id,user_id').eq('id', id).single();
        if (targetError) throw targetError;
        if (!target.user_id) {
          return res.status(409).json({ error: 'This staff profile is not linked to a Supabase Auth account yet. Ask the staff member to accept their invitation first.' });
        }
        const { error: passwordError } = await supabase.auth.admin.updateUserById(target.user_id, { password });
        if (passwordError) throw passwordError;
        return res.status(200).json({ message: 'Staff password updated successfully.' });
      }
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const allowed = ['full_name', 'role', 'phone', 'specialty', 'status'];
      const patch = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)));
      if (patch.role && !['admin', 'dentist', 'receptionist', 'accountant'].includes(String(patch.role).toLowerCase())) return res.status(400).json({ error: 'Invalid role.' });
      if (patch.role) patch.role = String(patch.role).toLowerCase();
      if (patch.email) patch.email = String(patch.email).trim().toLowerCase();
      if (patch.status && !['active', 'inactive'].includes(String(patch.status).toLowerCase())) return res.status(400).json({ error: 'Invalid status.' });
      const { data: target, error: targetError } = await supabase.from('clinic_staff').select('id,user_id').eq('id', id).single();
      if (targetError) throw targetError;
      const { data, error } = await supabase.from('clinic_staff').update(patch).eq('id', id).select().single();
      if (error) throw error;
      if (target.user_id && patch.status) {
        const { error: authError } = await supabase.auth.admin.updateUserById(target.user_id, {
          ban_duration: String(patch.status).toLowerCase() === 'inactive' ? '876000h' : 'none'
        });
        if (authError) throw authError;
      }
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required.' });
      if (Number(id) === me.id) return res.status(400).json({ error: 'You cannot deactivate your own account.' });
      const { data: target, error: targetError } = await supabase.from('clinic_staff').select('id,user_id').eq('id', id).single();
      if (targetError) throw targetError;
      const { data, error } = await supabase.from('clinic_staff').update({ status: 'inactive' }).eq('id', id).select().single();
      if (error) throw error;
      if (target.user_id) {
        const { error: authError } = await supabase.auth.admin.updateUserById(target.user_id, { ban_duration: '876000h' });
        if (authError) throw authError;
      }
      return res.status(200).json(data);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/staff error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

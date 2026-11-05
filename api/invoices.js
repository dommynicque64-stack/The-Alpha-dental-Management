import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm } from './auth-helper.js';

// Invoices. Read: billing.read+ roles; write: billing.write (admin, receptionist, accountant).
export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff, user } = auth;
    if (req.method === 'GET') {
      if (staff.role === 'receptionist') return res.status(403).json({ error: 'Receptionists can only access today\'s payment records.' });
      if (!hasPerm(staff, 'billing.read')) return res.status(403).json({ error: 'Forbidden.' });
      const { id, patient_id, status, limit = '200' } = req.query;
      let q = supabase.from('invoices').select('*').order('issue_date', { ascending: false }).limit(Math.min(500, parseInt(limit, 10) || 200));
      if (id) q = q.eq('id', id);
      if (patient_id) q = q.eq('patient_id', patient_id);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      if (!hasPerm(staff, 'billing.write')) return res.status(403).json({ error: 'Forbidden: your role cannot manage billing.' });
      const b = req.body || {};
      if (!b.patient_id || b.total_amount == null) return res.status(400).json({ error: 'patient_id and total_amount are required.' });
      const original = Number(b.original_amount ?? b.total_amount);
      const discount = Math.max(0, Number(b.discount_amount || 0));
      const total = Math.max(0, original - discount);
      const invNo = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const { data, error } = await supabase.from('invoices').insert({
        invoice_number: b.invoice_number || invNo,
        patient_id: b.patient_id, treatment_id: b.treatment_id || null,
        original_amount: original, discount_amount: discount, total_amount: total, amount_paid: 0, balance: total,
        status: b.status || 'unpaid',
        issue_date: b.issue_date || new Date().toISOString().slice(0, 10),
        due_date: b.due_date || null, notes: b.notes || null, created_by: user.email,
      }).select().single();
      if (error) throw error;
      await supabase.from('notifications').insert({ title: 'New invoice issued', message: `Invoice ${data.invoice_number} (${total.toFixed(2)}) created by ${staff.full_name}.`, type: 'billing', related_id: `invoice:${data.id}`, is_read: false });
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      if (!hasPerm(staff, 'billing.write')) return res.status(403).json({ error: 'Forbidden.' });
      const { id, ...patch } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const { data: cur, error: curErr } = await supabase.from('invoices').select('*').eq('id', id).single();
      if (curErr) throw curErr;
      if (patch.original_amount != null) patch.original_amount = Number(patch.original_amount);
      if (patch.discount_amount != null) patch.discount_amount = Math.max(0, Number(patch.discount_amount));
      if (patch.original_amount != null || patch.discount_amount != null) {
        const original = Number(patch.original_amount ?? cur.original_amount ?? cur.total_amount);
        const discount = Number(patch.discount_amount ?? cur.discount_amount ?? 0);
        if (!Number.isFinite(original) || original < 0) return res.status(400).json({ error: 'Original amount must be a valid non-negative number.' });
        if (!Number.isFinite(discount) || discount < 0) return res.status(400).json({ error: 'Discount amount must be a valid non-negative number.' });
        if (discount > original) return res.status(400).json({ error: 'Discount cannot exceed the original amount.' });
        patch.total_amount = Math.max(0, original - discount);
      }
      if (patch.total_amount != null) {
        patch.total_amount = Number(patch.total_amount);
        if (!Number.isFinite(patch.total_amount) || patch.total_amount < 0) return res.status(400).json({ error: 'Total amount must be a valid non-negative number.' });
      }
      if (patch.amount_paid != null) {
        patch.amount_paid = Number(patch.amount_paid);
        if (!Number.isFinite(patch.amount_paid) || patch.amount_paid < 0) return res.status(400).json({ error: 'Amount paid must be a valid non-negative number.' });
      }
      if (curErr) throw curErr;
      const next = { ...cur, ...patch };
      const balance = Number(next.total_amount) - Number(next.amount_paid || 0);
      patch.balance = balance;
      patch.status = balance <= 0 ? 'paid' : (Number(next.amount_paid || 0) > 0 ? 'partially_paid' : (patch.status && patch.status !== 'paid' && patch.status !== 'partially_paid' ? patch.status : 'unpaid'));
      patch.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('invoices').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (staff.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete invoices.' });
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/invoices error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm, todayNairobi } from './auth-helper.js';

async function addInvoiceNumbers(payments) {
  if (!payments.length) return payments;
  const ids = [...new Set(payments.map(p => p.invoice_id).filter(Boolean))];
  if (!ids.length) return payments;
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number')
    .in('id', ids);
  if (error) throw error;
  const numbers = Object.fromEntries((invoices || []).map(i => [i.id, i.invoice_number]));
  return payments.map(p => ({ ...p, invoice_number: numbers[p.invoice_id] || null }));
}

export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff, user } = auth;

    if (req.method === 'GET') {
      if (String(req.query.available_invoices || '') === '1' &&
          (hasPerm(staff, 'payments.today') || hasPerm(staff, 'billing.read'))) {
        const { data: invoices, error: invErr } = await supabase.from('invoices')
          .select('id, invoice_number, patient_id, total_amount, amount_paid, balance, issue_date, status')
          .gt('balance', 0).order('issue_date', { ascending: false }).order('id', { ascending: false }).limit(500);
        if (invErr) throw invErr;
        const ids = [...new Set((invoices || []).map(i => i.patient_id))];
        const { data: patients, error: patErr } = ids.length ? await supabase.from('patients').select('id, first_name, last_name').in('id', ids) : { data: [], error: null };
        if (patErr) throw patErr;
        const names = Object.fromEntries((patients || []).map(p => [p.id, `${p.first_name} ${p.last_name}`]));
        return res.status(200).json((invoices || []).map(i => ({ ...i, patient_name: names[i.patient_id] || `#${i.patient_id}` })));
      }
      if (staff.role === 'receptionist') {
        const today = todayNairobi();
        let q = supabase.from('payments').select('id, invoice_id, patient_id, amount, payment_method, payment_date, reference_number, notes, received_by, created_at')
          .eq('payment_date', today).order('created_at', { ascending: false }).limit(200);
        if (req.query.patient_id) q = q.eq('patient_id', req.query.patient_id);
        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json(await addInvoiceNumbers(data || []));
      }
      if (!hasPerm(staff, 'billing.read')) return res.status(403).json({ error: 'Forbidden.' });
      let q = supabase.from('payments').select('*').order('payment_date', { ascending: false }).order('created_at', { ascending: false }).limit(500);
      if (req.query.invoice_id) q = q.eq('invoice_id', req.query.invoice_id);
      if (req.query.patient_id) q = q.eq('patient_id', req.query.patient_id);
      if (req.query.date) q = q.eq('payment_date', String(req.query.date));
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(await addInvoiceNumbers(data || []));
    }

    if (req.method === 'POST') {
      if (!hasPerm(staff, 'billing.write') && !hasPerm(staff, 'payments.write')) return res.status(403).json({ error: 'Forbidden: your role cannot record payments.' });
      const b = req.body || {};
      if (b.amount == null) return res.status(400).json({ error: 'amount is required.' });
      let invoiceId = b.invoice_id;
      let patientId = b.patient_id;
      if (!invoiceId && b.invoice_number) {
        const { data: found, error: findErr } = await supabase.from('invoices').select('id, patient_id, invoice_number, total_amount, amount_paid, balance').eq('invoice_number', String(b.invoice_number).trim()).maybeSingle();
        if (findErr) throw findErr;
        if (!found) return res.status(404).json({ error: 'Invoice not found. Check the invoice number.' });
        invoiceId = found.id; patientId = found.patient_id;
      }
      if (!invoiceId || !patientId) return res.status(400).json({ error: 'Invoice number or invoice ID is required.' });
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || !(amount > 0)) return res.status(400).json({ error: 'Amount must be greater than zero.' });
      const paymentDate = staff.role === 'receptionist' ? todayNairobi() : (b.payment_date || todayNairobi());
      const idempotencyKey = String(b.idempotency_key || '').trim();
      if (idempotencyKey) {
        const { data: existing, error: existingErr } = await supabase.from('payments').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
        if (existingErr) throw existingErr;
        if (existing) return res.status(200).json(existing);
      }

      const { data: payment, error: rpcErr } = await supabase.rpc('record_payment', {
        p_invoice_id: Number(invoiceId),
        p_patient_id: Number(patientId),
        p_amount: amount,
        p_payment_method: b.payment_method || 'cash',
        p_payment_date: paymentDate,
        p_reference_number: b.reference_number || null,
        p_notes: b.notes || null,
        p_received_by: user.email,
        p_idempotency_key: idempotencyKey || null,
      });
      if (rpcErr) {
        if (idempotencyKey && /duplicate|unique/i.test(rpcErr.message || '')) {
          const { data: existing } = await supabase.from('payments').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
          if (existing) return res.status(200).json(existing);
        }
        throw rpcErr;
      }
      const paymentRow = Array.isArray(payment) ? payment[0] : payment;
      if (!paymentRow) throw new Error('Payment was not returned after recording.');
      const { data: invoiceForNotice } = await supabase.from('invoices').select('id, invoice_number').eq('id', invoiceId).single();
      await supabase.from('notifications').insert({ title: 'Payment received', message: `Payment of ${amount.toFixed(2)} recorded for invoice ${invoiceForNotice?.invoice_number || invoiceId} by ${staff.full_name}.`, type: 'payment', related_id: `invoice:${invoiceForNotice?.id || invoiceId}`, is_read: false });
      return res.status(201).json(paymentRow);
    }

    if (req.method === 'DELETE') {
      if (staff.role !== 'admin') return res.status(403).json({ error: 'Only admins can void payments.' });
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const { data: pay, error: fErr } = await supabase.from('payments').select('*').eq('id', id).single();
      if (fErr) throw fErr;
      const { error: dErr } = await supabase.from('payments').delete().eq('id', id);
      if (dErr) throw dErr;
      const { data: inv } = await supabase.from('invoices').select('*').eq('id', pay.invoice_id).single();
      if (inv) {
        const amountPaid = Math.max(0, Number(inv.amount_paid || 0) - Number(pay.amount));
        const balance = Number(inv.total_amount) - amountPaid;
        await supabase.from('invoices').update({ amount_paid: amountPaid, balance, status: balance <= 0 ? 'paid' : (amountPaid > 0 ? 'partially_paid' : 'unpaid') }).eq('id', inv.id);
      }
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/payments error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

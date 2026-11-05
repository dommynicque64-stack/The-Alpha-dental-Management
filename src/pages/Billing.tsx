import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, CreditCard, Printer } from 'lucide-react';
import { apiFetch, formatKES, canWriteBilling } from '../lib/helpers';
import { useAuth } from '../contexts/AuthContext';
import { Card, PageHeader, Btn, Badge, Input, Select, Empty, Spinner, Modal, Field } from '../components/ui';

interface Invoice {
  id: number; invoice_number: string; patient_id: number; treatment_id?: number | null; treatment_name?: string; original_amount?: number; discount_amount?: number; total_amount: number;
  amount_paid: number; balance: number; status: string; issue_date: string; due_date: string | null;
}
interface Payment {
  id: number; invoice_id: number; patient_id: number; amount: number;
  payment_method: string; payment_date: string; reference_number: string | null;
}

export default function Billing() {
  const { staff } = useAuth();
  const [invoices, setInvoices] = useState<(Invoice & { patient_name?: string })[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [invModal, setInvModal] = useState(false);
  const [payModal, setPayModal] = useState<Invoice | null>(null);
  const [branding, setBranding] = useState<Record<string, string>>({});

  const canWrite = canWriteBilling(staff?.role);

  const fetchAll = async () => {
    setLoading(true); setError('');
    try {
      const [inv, pay, settings, treatmentList] = await Promise.all([
        apiFetch(`/api/invoices${status ? `?status=${status}` : ''}`),
        apiFetch('/api/payments'),
        apiFetch('/api/settings').catch(() => ({})),
        apiFetch('/api/treatments').catch(() => []),
      ]);
      setBranding((settings as Record<string, string>) || {});
      const treatmentMap = Object.fromEntries(((treatmentList as Record<string, unknown>[]) || []).map(t => [Number(t.id), String(t.procedure_name || '')]));

      const list = (inv as Invoice[]) || [];
      const pMap: Record<number, string> = {};
      const missing = [...new Set(list.map((x) => x.patient_id))];
      for (const mid of missing.slice(0, 30)) {
        try {
          const one = await apiFetch(`/api/patients?id=${mid}`) as { first_name: string; last_name: string };
          pMap[mid] = `${one.first_name} ${one.last_name}`;
        } catch { pMap[mid] = `#${mid}`; }
      }
      setInvoices(list.map((x) => ({ ...x, patient_name: pMap[x.patient_id] || `#${x.patient_id}`, treatment_name: x.treatment_id ? treatmentMap[Number(x.treatment_id)] || '' : '' })));
      setPayments((pay as Payment[]) || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load billing'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [status]);

  const filtered = invoices.filter((i) =>
    !search.trim() || i.invoice_number.toLowerCase().includes(search.toLowerCase()) || (i.patient_name || '').toLowerCase().includes(search.toLowerCase())
  );
  const outstanding = invoices.reduce((s, i) => s + Math.max(0, Number(i.balance || 0)), 0);
  const collected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const statusLabel = (v: string) => v === 'partially_paid' ? 'Partial' : v === 'paid' ? 'Paid' : 'Unpaid';

  return (
    <div>
      <PageHeader
        title="Billing & Payments"
        subtitle={`${formatKES(outstanding)} outstanding · ${formatKES(collected)} collected`}
        actions={canWrite ? <Btn onClick={() => setInvModal(true)}><Plus className="h-4 w-4" /> New Invoice</Btn> : undefined}
      />
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice no. or patient…" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </Select>
        </div>
      </Card>

      {loading ? <Spinner label="Loading billing…" /> : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="p-4 xl:col-span-2">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Invoices</h2>
            {filtered.length === 0 ? <Empty title="No invoices" /> : (
              <div className="divide-y divide-slate-100">
                {filtered.map((i) => (
                  <div key={i.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{i.invoice_number}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${i.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : i.status === 'partially_paid' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>{statusLabel(i.status)}</span>
                      <span className="ml-auto text-sm font-extrabold text-slate-900">{formatKES(i.balance)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {i.treatment_name ? <><span className="font-semibold text-slate-700">{i.treatment_name}</span>{' · '}</> : null}
                      <Link to={`/patients/${i.patient_id}`} className="font-semibold text-teal-700 hover:underline">{i.patient_name}</Link>
                      {' '}· issued {i.issue_date} · total {formatKES(i.total_amount)} · paid {formatKES(i.amount_paid)}
                    </p>
                    {canWrite && i.balance > 0 && (
                      <button onClick={() => setPayModal(i)} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700">
                        <CreditCard className="h-3.5 w-3.5" /> Pay
                      </button>
                    )}
                    <button onClick={() => printInvoice(i, branding)} className="ml-1 mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Printer className="h-3.5 w-3.5" /> Print Invoice
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Recent payments</h2>
            {payments.length === 0 ? <Empty title="No payments yet" /> : (
              <div className="divide-y divide-slate-100">
                {payments.slice(0, 15).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{formatKES(p.amount)}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">{p.payment_method} · {p.payment_date}{p.reference_number ? ` · ${p.reference_number}` : ''}</p>
                    </div>
                    <span className="text-[11px] text-slate-400">#{p.invoice_id}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
      {invModal && <InvoiceModal onClose={() => setInvModal(false)} onSaved={() => { setInvModal(false); fetchAll(); }} />}
      {payModal && <PaymentModal invoice={payModal} onClose={() => setPayModal(null)} onSaved={() => { setPayModal(null); fetchAll(); }} />}
    </div>
  );
}

function printInvoice(invoice: Invoice & { patient_name?: string }, branding: Record<string, string>) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!win) { alert('Please allow pop-ups to print the invoice.'); return; }
  const clinic = branding.clinic_name || branding.software_name || 'DentalCare Clinic';
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c] || c));
  win.document.write(`<!doctype html><html><head><title>${esc(invoice.invoice_number)}</title><style>
  body{font-family:Arial,sans-serif;color:#172033;margin:40px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #6d28d9;padding-bottom:18px}.brand{font-size:22px;font-weight:800}.muted{color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:30px}th,td{padding:12px;border-bottom:1px solid #e2e8f0;text-align:left}.num{text-align:right}.total{font-size:18px;font-weight:800}.status{display:inline-block;padding:6px 10px;border-radius:999px;background:#f1f5f9}.foot{margin-top:45px;color:#64748b;font-size:12px}@media print{body{margin:20px}}
  </style></head><body><div class="head"><div>${branding.logo_url ? `<img src="${esc(branding.logo_url)}" style="max-height:70px;max-width:180px;object-fit:contain;margin-bottom:8px" />` : ''}<div class="brand">${esc(clinic)}</div><div class="muted">${esc(branding.clinic_address || '')}</div><div class="muted">${esc(branding.clinic_phone || '')} · ${esc(branding.clinic_email || '')}</div></div><div style="text-align:right"><h1>INVOICE</h1><div class="muted">${esc(invoice.invoice_number)}</div><div class="muted">Issued: ${esc(invoice.issue_date)}</div></div></div>
  <p><strong>Patient:</strong> ${esc(invoice.patient_name || `#${invoice.patient_id}`)}</p>${invoice.treatment_name ? `<p><strong>Service:</strong> ${esc(invoice.treatment_name)}</p>` : ''}
  <table><thead><tr><th>Invoice / Service</th><th class="num">Amount</th></tr></thead><tbody><tr><td>${esc(invoice.invoice_number)}</td><td class="num">${formatKES(invoice.original_amount ?? invoice.total_amount)}</td></tr>${Number(invoice.discount_amount || 0) > 0 ? `<tr><td>Discount</td><td class="num">-${formatKES(invoice.discount_amount)}</td></tr>` : ''}<tr><td><strong>Payable</strong></td><td class="num"><strong>${formatKES(invoice.total_amount)}</strong></td></tr></tbody><tfoot><tr><td class="total">Paid</td><td class="num">${formatKES(invoice.amount_paid)}</td></tr><tr><td class="total">Balance</td><td class="num">${formatKES(invoice.balance)}</td></tr></tfoot></table>
  <p><span class="status">${esc(invoice.status === 'paid' ? 'Paid' : invoice.status === 'partially_paid' ? 'Partial' : 'Unpaid')}</span></p>
  <div class="foot">Thank you for choosing ${esc(clinic)}. This invoice was generated by the clinic management system.</div><script>window.onload=()=>window.print();</script></body></html>`);
  win.document.close();
}

function InvoiceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [patients, setPatients] = useState<{ id: number; first_name: string; last_name: string }[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ patient_id: '', original_amount: '', discount_amount: '', due_date: '', notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const d = await apiFetch(`/api/patients?search=${encodeURIComponent(q)}&limit=20&status=active`) as { rows: typeof patients };
        setPatients(d.rows || []);
      } catch { /* noop */ }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const save = async () => {
    if (!form.patient_id || !form.original_amount) { setError('Patient and original amount are required.'); return; }
    const original = Number(form.original_amount);
    const discount = Math.max(0, Number(form.discount_amount || 0));
    if (!(original > 0)) { setError('Original amount must be greater than zero.'); return; }
    if (discount > original) { setError('Discount cannot exceed the original amount.'); return; }
    setBusy(true); setError('');
    try {
      await apiFetch('/api/invoices', { method: 'POST', body: JSON.stringify({ patient_id: Number(form.patient_id), original_amount: original, discount_amount: discount, total_amount: original - discount, due_date: form.due_date || null, notes: form.notes || null }) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  return (
    <Modal title="New invoice" onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}
        <Field label="Find patient"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" /></Field>
        <Field label="Patient *">
          <Select value={form.patient_id} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}>
            <option value="">Select…</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Original amount (KES) *"><Input type="number" min="0" step="0.01" value={form.original_amount} onChange={(e) => setForm((f) => ({ ...f, original_amount: e.target.value }))} /></Field>
          <Field label="Discount amount (KES)"><Input type="number" min="0" step="0.01" value={form.discount_amount} onChange={(e) => setForm((f) => ({ ...f, discount_amount: e.target.value }))} /></Field>
          <Field label="Payable amount"><Input readOnly value={formatKES(Math.max(0, Number(form.original_amount || 0) - Number(form.discount_amount || 0)))} /></Field>
          <Field label="Due date"><Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} /></Field>
        </div>
        <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} loading={busy}>Create invoice</Btn>
        </div>
      </div>
    </Modal>
  );
}

function PaymentModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ amount: String(invoice.balance), payment_method: 'mpesa', payment_date: new Date().toISOString().slice(0, 10), reference_number: '', notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!(Number(form.amount) > 0)) { setError('Amount must be greater than zero.'); return; }
    if (Number(form.amount) > Number(invoice.balance)) { setError(`Amount exceeds balance of ${formatKES(invoice.balance)}.`); return; }
    setBusy(true); setError('');
    try {
      await apiFetch('/api/payments', { method: 'POST', body: JSON.stringify({ invoice_id: invoice.id, patient_id: invoice.patient_id, amount: Number(form.amount), payment_method: form.payment_method, payment_date: form.payment_date, reference_number: form.reference_number || null, notes: form.notes || null }) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Payment · ${invoice.invoice_number}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Balance due: <b className="text-slate-900">{formatKES(invoice.balance)}</b> (total {formatKES(invoice.total_amount)}, paid {formatKES(invoice.amount_paid)})</p>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (KES) *"><Input type="number" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Method">
            <Select value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="card">Card</option>
              <option value="bank">Bank transfer</option>
              <option value="insurance">Insurance</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.payment_date} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} /></Field>
          <Field label="Reference"><Input value={form.reference_number} onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))} placeholder="MPESA code…" /></Field>
        </div>
        <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} loading={busy}>Record payment</Btn>
        </div>
      </div>
    </Modal>
  );
}

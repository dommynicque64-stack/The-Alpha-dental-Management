import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, RotateCcw, Plus, Trash2, Upload, FileText, Download } from 'lucide-react';
import { apiFetch, calcAge, formatKES, canWriteClinical, canWriteBilling } from '../lib/helpers';
import { useAuth } from '../contexts/AuthContext';
import { Card, Btn, Badge, Empty, Spinner, Modal, Field, Input, Select, Textarea } from '../components/ui';
import { Odontogram, RecordModal, TreatmentModal, PrescriptionModal } from '../components/Odontogram';

type Tab = 'overview' | 'appointments' | 'records' | 'treatments' | 'prescriptions' | 'documents';

export default function PatientDetail() {
  const { id } = useParams();
  const { staff } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [dentition, setDentition] = useState<'adult' | 'paediatric'>('adult');
  const [patient, setPatient] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appts, setAppts] = useState<Record<string, unknown>[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [treatments, setTreatments] = useState<Record<string, unknown>[]>([]);
  const [prescriptions, setPrescriptions] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [dentists, setDentists] = useState<{ id: number; full_name: string }[]>([]);
  const [clinicSettings, setClinicSettings] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [recordModal, setRecordModal] = useState<{ open: boolean; existing?: Record<string, unknown> | null; tooth?: string | null }>({ open: false });
  const [treatModal, setTreatModal] = useState<{ open: boolean; existing?: Record<string, unknown> | null }>({ open: false });
  const [rxModal, setRxModal] = useState(false);
  const [rxEditing, setRxEditing] = useState<Record<string, unknown> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('xray');

  const canClinical = canWriteClinical(staff?.role);
  const canBill = canWriteBilling(staff?.role);
  const canEditPatient = staff?.role === 'admin' || staff?.role === 'dentist' || staff?.role === 'receptionist';
  const canDownloadRecord = staff?.role === 'admin' || staff?.role === 'dentist' || staff?.role === 'accountant';

  const fetchAll = async () => {
    setLoading(true); setError('');
    try {
      const [p, a, r, t, rx, d, inv, st, settings] = await Promise.all([
        apiFetch(`/api/patients?id=${id}`),
        apiFetch(`/api/appointments?patient_id=${id}`).catch(() => []),
        apiFetch(`/api/dental-records?patient_id=${id}`).catch(() => []),
        apiFetch(`/api/treatments?patient_id=${id}`).catch(() => []),
        apiFetch(`/api/prescriptions?patient_id=${id}`).catch(() => []),
        apiFetch(`/api/documents?patient_id=${id}`).catch(() => []),
        (staff?.role === 'receptionist' ? Promise.resolve([]) : apiFetch(`/api/invoices?patient_id=${id}`).catch(() => [])),
        apiFetch('/api/staff?role=dentist').catch(() => []),
        apiFetch('/api/settings').catch(() => ({})),
      ]);
      setPatient(p as Record<string, unknown>);
      setAppts((a as Record<string, unknown>[]) || []);
      setRecords((r as Record<string, unknown>[]) || []);
      setTreatments((t as Record<string, unknown>[]) || []);
      setPrescriptions((rx as Record<string, unknown>[]) || []);
      setDocuments((d as Record<string, unknown>[]) || []);
      setInvoices((inv as Record<string, unknown>[]) || []);
      setClinicSettings((settings as Record<string, string>) || {});
      const dentList = (st as { id: number; full_name: string; status: string }[]).filter((s) => String(s.status).toLowerCase() === 'active').map((s) => ({ id: s.id, full_name: s.full_name }));
      const admins = await apiFetch('/api/staff').catch(() => []) as { id: number; full_name: string; role: string; status: string }[];
      const adminList = (Array.isArray(admins) ? admins : []).filter((s) => String(s.role).toLowerCase() === 'admin' && String(s.status).toLowerCase() === 'active').map((s) => ({ id: s.id, full_name: s.full_name }));
      setDentists([...adminList, ...dentList]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load patient');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [id]);

  if (loading) return <Spinner label="Loading patient…" />;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>;
  if (!patient) return <Empty title="Patient not found" />;

  const conditions: Record<string, string> = {};
  for (const r of records) {
    const tooth = r.tooth_number as string;
    if (!tooth) continue;
    const diag = `${r.diagnosis || ''} ${r.treatment_plan || ''}`.toLowerCase();
    let cond = 'decay';
    if (diag.includes('crown')) cond = 'crown';
    else if (diag.includes('implant')) cond = 'implant';
    else if (diag.includes('missing') || diag.includes('extract')) cond = 'extraction';
    else if (diag.includes('root canal')) cond = 'root_canal';
    else if (diag.includes('filling')) cond = 'filling';
    else if (diag.includes('healthy') || diag.includes('clean')) cond = 'healthy';
    conditions[tooth] = cond;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'appointments', label: `Appointments (${appts.length})` },
    { key: 'records', label: `Dental Records (${records.length})` },
    { key: 'treatments', label: `Treatments (${treatments.length})` },
    { key: 'prescriptions', label: `Prescriptions (${prescriptions.length})` },
    { key: 'documents', label: `Documents (${documents.length})` },
  ];

  const archive = async () => {
    const to = patient.status === 'archived' ? 'active' : 'archived';
    if (!confirm(to === 'archived' ? 'Archive this patient?' : 'Restore this patient?')) return;
    await apiFetch('/api/patients', { method: 'PUT', body: JSON.stringify({ id: patient.id, status: to }) });
    fetchAll();
  };

  const delRecord = async (rid: number) => {
    if (!confirm('Delete this clinical record?')) return;
    try { await apiFetch(`/api/dental-records?id=${rid}`, { method: 'DELETE' }); fetchAll(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };
  const delTreatment = async (tid: number) => {
    if (!confirm('Delete this treatment?')) return;
    try { await apiFetch(`/api/treatments?id=${tid}`, { method: 'DELETE' }); fetchAll(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };
  const delRx = async (rid: number) => {
    if (!confirm('Delete this prescription?')) return;
    try { await apiFetch(`/api/prescriptions?id=${rid}`, { method: 'DELETE' }); fetchAll(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const up = await apiFetch('/api/upload', { method: 'POST', body: JSON.stringify({ fileName: file.name, fileBase64: b64, contentType: file.type, patientId: patient.id }) }) as { url: string; storage_path: string };
      await apiFetch('/api/documents', { method: 'POST', body: JSON.stringify({ patient_id: patient.id, file_name: file.name, file_url: up.url, storage_path: up.storage_path, file_type: file.type, file_size: file.size, document_type: docType }) });
      fetchAll();
    } catch (e) { alert(e instanceof Error ? e.message : 'Upload failed'); } finally { setUploading(false); }
  };

  const delDoc = async (docId: number) => {
    if (!confirm('Delete this document?')) return;
    try { await apiFetch(`/api/documents?id=${docId}`, { method: 'DELETE' }); fetchAll(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const downloadPatientRecord = () => {
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups for this site to generate the patient record.'); return; }
    const esc = (v: unknown) => String(v ?? '—').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] || c));
    const rows = (items: Record<string, unknown>[], cols: string[]) => items.map(item => `<tr>${cols.map(c => `<td>${esc(item[c])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}">No records</td></tr>`;
    const signature = typeof patient.consent_signature === 'string' ? `<img class="signature" src="${patient.consent_signature}" alt="Patient signature">` : '<p>Not recorded</p>';
    const clinic = clinicSettings.clinic_name || 'DentalCare Clinic';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Patient record - ${esc(patient.first_name)} ${esc(patient.last_name)}</title><style>
      body{font:12px Arial,sans-serif;color:#17212b;margin:28px}h1{font-size:22px;margin:0}h2{font-size:15px;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-top:24px}p{line-height:1.5}.meta{color:#526171;margin:5px 0 18px}table{border-collapse:collapse;width:100%;margin:8px 0 16px}td,th{border:1px solid #d5dce3;padding:7px;text-align:left}th{background:#f1f5f9}.signature{max-width:360px;max-height:100px;border:1px solid #ddd}.muted{color:#64748b}.header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f766e;padding-bottom:14px}.clinic{text-align:right;font-size:11px}.clinic strong{font-size:20px;color:#17212b}.logo{height:82px;width:190px;object-fit:contain}.signature-space{height:70px;border-bottom:1px solid #64748b;margin-top:6px;width:280px}@media print{body{margin:15mm}button{display:none}}</style></head><body>
      <div class="header"><div>${clinicSettings.logo_url ? `<img class="logo" src="${esc(clinicSettings.logo_url)}" alt="${esc(clinic)} logo">` : ''}</div><div class="clinic"><strong>${esc(clinic)}</strong><br>${esc(clinicSettings.clinic_address)}<br>${esc(clinicSettings.clinic_phone)} · ${esc(clinicSettings.clinic_email)}<br>${esc(clinicSettings.clinic_website)}</div></div>
      <p class="meta">Confidential patient medical record · Generated ${new Date().toLocaleString()}</p>
      <h2>Patient details</h2><table><tbody>${[['Patient ID',patient.id],['Name',`${patient.first_name} ${patient.last_name}`],['Date of birth',patient.date_of_birth],['Gender',patient.gender],['Phone',patient.phone],['Email',patient.email],['Residence',patient.address],['Patient type',patient.patient_type],['Blood type',patient.blood_type],['Allergies',patient.allergies],['Medical history',patient.medical_history]].map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
      <h2>Dental records and clinical notes</h2><table><thead><tr><th>Date</th><th>Tooth</th><th>Diagnosis</th><th>Treatment plan</th><th>Notes</th><th>Treating dentist</th></tr></thead><tbody>${records.map(r => `<tr><td>${esc(r.record_date)}</td><td>${esc(r.tooth_number)}</td><td>${esc(r.diagnosis)}</td><td>${esc(r.treatment_plan)}</td><td>${esc(r.notes)}</td><td>${esc(r.dentist_name || dentists.find(d => d.id === Number(r.dentist_id))?.full_name || 'Not recorded')}</td></tr>`).join('') || '<tr><td colspan="6">No records</td></tr>'}</tbody></table>
      <h2>Treatments</h2><table><thead><tr><th>Date</th><th>Procedure</th><th>Tooth</th><th>Status</th><th>Notes</th></tr></thead><tbody>${rows(treatments,['treatment_date','procedure_name','tooth_number','status','notes'])}</tbody></table>
      <h2>Prescriptions</h2><table><thead><tr><th>Date</th><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${rows(prescriptions,['prescribed_date','medication','dosage','frequency','duration','instructions'])}</tbody></table>
      ${canBill ? `<h2>Invoices and balances</h2><table><thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${rows(invoices,['invoice_number','invoice_date','total_amount','amount_paid','balance'])}</tbody></table>` : ''}
      <h2>Consent and acknowledgement</h2><p>${esc(patient.consent_text)}</p><p>Consent acknowledged: ${esc(patient.consent_acknowledged ? 'Yes' : 'No')} · Signed: ${esc(patient.consent_signed_at)}</p>${signature}
      <h2>Clinician acknowledgement</h2><table><tbody><tr><th>Treating dentist</th><td>${esc(records.map(r => String(r.dentist_name || dentists.find(d => d.id === Number(r.dentist_id))?.full_name || '')).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Not recorded')}</td></tr></tbody></table><div class="signature-space"></div><p><strong>Dentist signature</strong></p>
      <p class="muted">This document contains confidential health information. Handle and store it securely.</p><script>window.onload=()=>window.print();</script></body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  };

  const balance = invoices.reduce((s, i) => s + Number(i.balance || 0), 0);

  return (
    <div>
      <Link to="/patients" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to patients</Link>
      <Card className="mb-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 text-xl font-extrabold text-white">
            {String(patient.first_name)[0]}{String(patient.last_name)[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">{String(patient.first_name)} {String(patient.last_name)}</h1>
              <Badge value={String(patient.status)} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{String(patient.phone)} · {String(patient.email || 'No email')} · {calcAge(patient.date_of_birth as string)} · <span className="capitalize">{String(patient.gender || '—')}</span> · <span className="font-semibold capitalize">{String(patient.patient_type || 'outpatient')}</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditPatient && <Btn variant="secondary" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Btn>}
            {canEditPatient && (
              <Btn variant="secondary" onClick={archive}>
                {patient.status === 'archived' ? <><RotateCcw className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}
              </Btn>
            )}
            {canDownloadRecord && <Btn variant="secondary" onClick={downloadPatientRecord}><Download className="h-4 w-4" /> Download Patient Record</Btn>}
            <Link to={`/appointments/new?patient=${patient.id}`}><Btn><Plus className="h-4 w-4" /> Book Visit</Btn></Link>
          </div>
        </div>
      </Card>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 slim-scroll">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${tab === t.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Contact & personal</h3>
            <dl className="space-y-2 text-sm">
              {([['Phone', patient.phone], ['Email', patient.email || '—'], ['Residence', patient.address || '—'], ['Date of birth', patient.date_of_birth || '—'], ['Blood type', patient.blood_type || '—']] as [string, unknown][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-800">{String(v)}</dd></div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Medical</h3>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-slate-500">Allergies</dt><dd className="font-medium text-slate-800">{String(patient.allergies || 'None recorded')}</dd></div>
              <div><dt className="text-slate-500">Medical history</dt><dd className="font-medium text-slate-800">{String(patient.medical_history || '—')}</dd></div>
              <div><dt className="text-slate-500">Emergency contact</dt><dd className="font-medium text-slate-800">{String(patient.emergency_contact_name || '—')} · {String(patient.emergency_contact_phone || '')}{patient.emergency_contact_relationship ? ` · ${String(patient.emergency_contact_relationship)}` : ''}</dd></div>
              <div><dt className="text-slate-500">Insurance</dt><dd className="font-medium text-slate-800">{String(patient.insurance_provider || '—')} {typeof patient.insurance_number === 'string' && patient.insurance_number ? `· ${patient.insurance_number}` : typeof patient.insurance_number === 'number' ? `· ${patient.insurance_number}` : ''}</dd></div>
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Consent and Acknowledgement</h3>
            <p className="text-xs leading-5 text-slate-600">{String(patient.consent_text || 'No consent declaration recorded.')}</p>
            <p className="mt-2 text-xs font-semibold text-slate-700">Status: {patient.consent_acknowledged ? 'Acknowledged' : 'Not recorded'}</p>
            {typeof patient.consent_signature === 'string' && <img src={patient.consent_signature} alt="Patient digital signature" className="mt-3 max-h-20 max-w-full border-b border-slate-300 object-contain" />}
            {typeof patient.consent_signed_at === 'string' && patient.consent_signed_at && <p className="mt-1 text-xs text-slate-400">Signed {new Date(patient.consent_signed_at).toLocaleString()}</p>}
          </Card>
          {staff?.role !== 'receptionist' && <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Account summary</h3>
            {canClinical && <Btn className="mb-3" onClick={() => setTreatModal({ open: true })}><Plus className="h-4 w-4" /> New Treatment</Btn>}
            <p className="text-2xl font-extrabold text-slate-900">{formatKES(balance)}</p>
            <p className="text-xs text-slate-500">outstanding balance across {invoices.length} invoice(s)</p>
            <div className="mt-3 space-y-1.5">
              {invoices.slice(0, 4).map((i) => (
                <div key={i.id as number} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{String(i.invoice_number)}</span><Badge value={String(i.status)} />
                </div>
              ))}
              {invoices.length === 0 && <p className="text-sm text-slate-500">No invoices yet.</p>}
            </div>
            {canBill && <Link to="/billing" className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline">Open billing →</Link>}
          </Card>}
          <Card className="p-5 lg:col-span-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Odontogram (FDI) — click a tooth to add a record</h3>
              <select value={dentition} onChange={(e) => setDentition(e.target.value as 'adult' | 'paediatric')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="adult">Adult dentition (32 teeth)</option>
                <option value="paediatric">Children's primary dentition (20 teeth)</option>
              </select>
            </div>
            <Odontogram dentition={dentition} conditions={conditions} onSelect={canClinical ? (t) => setRecordModal({ open: true, tooth: t }) : undefined} />
          </Card>
        </div>
      )}

      {tab === 'appointments' && (
        <Card className="p-4">
          {appts.length === 0 ? <Empty title="No appointments" subtitle="Book the first visit for this patient." /> : (
            <div className="divide-y divide-slate-100">
              {appts.map((a) => (
                <div key={a.id as number} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{String(a.appointment_date)} · {String(a.start_time).slice(0, 5)}–{String(a.end_time).slice(0, 5)}</p>
                    <p className="text-xs text-slate-500">{String(a.reason || '')} · {String(a.dentist_name || '')}</p>
                  </div>
                  <Badge value={String(a.status)} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'records' && (
        <div>
          {canClinical && <div className="mb-3"><Btn onClick={() => setRecordModal({ open: true })}><Plus className="h-4 w-4" /> New record</Btn></div>}
          <Card className="p-4">
            {records.length === 0 ? <Empty title="No dental records" /> : (
              <div className="space-y-3">
                {records.map((r) => (
                  <div key={r.id as number} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{String(r.diagnosis)}</p>
                      {r.tooth_number ? <span className="rounded-md bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800">Tooth {String(r.tooth_number)}</span> : null}
                      <Badge value={String(r.status)} />
                      <span className="ml-auto text-xs text-slate-400">{String(r.record_date)}</span>
                    </div>
                    {r.treatment_plan ? <p className="mt-1.5 text-sm text-slate-600"><b>Plan:</b> {String(r.treatment_plan)}</p> : null}
                    {r.notes ? <p className="mt-1 text-sm text-slate-500">{String(r.notes)}</p> : null}
                    <p className="mt-1 text-xs text-slate-500"><b>Treating dentist:</b> {String(r.dentist_name || dentists.find(d => d.id === Number(r.dentist_id))?.full_name || 'Not recorded')}</p>
                    {canClinical && (
                      <div className="mt-2 flex gap-1">
                        <button onClick={() => setRecordModal({ open: true, existing: r })} className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50">Edit</button>
                        <button onClick={() => delRecord(r.id as number)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'treatments' && (
        <div>
          {canClinical && <div className="mb-3"><Btn onClick={() => setTreatModal({ open: true })}><Plus className="h-4 w-4" /> New treatment</Btn></div>}
          <Card className="p-4">
            {treatments.length === 0 ? <Empty title="No treatments" /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="px-2 py-2">Procedure</th><th className="px-2 py-2">Tooth</th><th className="px-2 py-2">Date</th><th className="px-2 py-2">Cost</th><th className="px-2 py-2">Status</th>{canClinical && <th className="px-2 py-2 text-right">Actions</th>}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {treatments.map((t) => (
                      <tr key={t.id as number}>
                        <td className="px-2 py-2.5 font-semibold text-slate-800">{String(t.procedure_name)}</td>
                        <td className="px-2 py-2.5">{String(t.tooth_number || '—')}</td>
                        <td className="px-2 py-2.5">{String(t.treatment_date)}</td>
                        <td className="px-2 py-2.5 font-semibold">{formatKES(t.cost as number)}</td>
                        <td className="px-2 py-2.5"><Badge value={String(t.status)} /></td>
                        {canClinical && (
                          <td className="px-2 py-2.5 text-right">
                            <button onClick={() => setTreatModal({ open: true, existing: t })} className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50">Edit</button>
                            <button onClick={() => delTreatment(t.id as number)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'prescriptions' && (
        <div>
          {canClinical && <div className="mb-3"><Btn onClick={() => setRxModal(true)}><Plus className="h-4 w-4" /> New prescription</Btn></div>}
          <Card className="p-4">
            {prescriptions.length === 0 ? <Empty title="No prescriptions" /> : (
              <div className="space-y-3">
                {prescriptions.map((p) => (
                  <div key={p.id as number} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{String(p.medication)} {p.dosage ? `· ${p.dosage}` : ''}</p>
                      <span className="ml-auto text-xs text-slate-400">{String(p.prescribed_date)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{String(p.frequency || '')} {p.duration ? `· ${p.duration}` : ''}</p>
                    {p.instructions ? <p className="mt-0.5 text-xs text-slate-500">{String(p.instructions)}</p> : null}
                    {canClinical && <div className="mt-2 flex gap-2"><button onClick={() => setRxEditing(p)} className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50">Edit</button><button onClick={() => delRx(p.id as number)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button></div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'documents' && (
        <Card className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-44">
              <option value="xray">X-Ray</option>
              <option value="photo">Photo</option>
              <option value="report">Report</option>
              <option value="consent">Consent form</option>
              <option value="other">Other</option>
            </Select>
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-700 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload file'}
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
            </label>
          </div>
          {documents.length === 0 ? <Empty title="No documents" subtitle="Upload X-rays, photos, consent forms…" /> : (
            <div className="divide-y divide-slate-100">
              {documents.map((d) => (
                <div key={d.id as number} className="flex items-center gap-3 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><FileText className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{String(d.file_name)}</p>
                    <p className="text-xs capitalize text-slate-500">{String(d.document_type)} · {d.uploaded_at ? new Date(d.uploaded_at as string).toLocaleDateString() : ''}</p>
                  </div>
                  <a href={String(d.file_url)} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-teal-700 hover:bg-teal-50"><Download className="h-4 w-4" /></a>
                  {(staff?.role === 'admin' || staff?.role === 'dentist') && (
                    <button onClick={() => delDoc(d.id as number)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {editOpen && <EditPatientModal patient={patient} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); fetchAll(); }} />}
      {recordModal.open && <RecordModal patientId={Number(id)} dentists={dentists} existing={recordModal.existing} tooth={recordModal.tooth} onClose={() => setRecordModal({ open: false })} onSaved={() => { setRecordModal({ open: false }); fetchAll(); }} />}
      {treatModal.open && <TreatmentModal patientId={Number(id)} dentists={dentists} existing={treatModal.existing} onClose={() => setTreatModal({ open: false })} onSaved={() => { setTreatModal({ open: false }); fetchAll(); }} />}
      {rxModal && <PrescriptionModal patientId={Number(id)} dentists={dentists} onClose={() => setRxModal(false)} onSaved={() => { setRxModal(false); fetchAll(); }} />}
      {rxEditing && <PrescriptionModal patientId={Number(id)} dentists={dentists} existing={rxEditing} onClose={() => setRxEditing(null)} onSaved={() => { setRxEditing(null); fetchAll(); }} />}
    </div>
  );
}

function EditPatientModal({ patient, onClose, onSaved }: { patient: Record<string, unknown>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({
    first_name: String(patient.first_name || ''), last_name: String(patient.last_name || ''),
    phone: String(patient.phone || ''), email: String(patient.email || ''),
    date_of_birth: String(patient.date_of_birth || ''), gender: String(patient.gender || ''),
    address: String(patient.address || ''), emergency_contact_name: String(patient.emergency_contact_name || ''),
    emergency_contact_phone: String(patient.emergency_contact_phone || ''),
    emergency_contact_relationship: String(patient.emergency_contact_relationship || ''),
    blood_type: String(patient.blood_type || ''), allergies: String(patient.allergies || ''),
    medical_history: String(patient.medical_history || ''), insurance_provider: String(patient.insurance_provider || ''),
    insurance_number: String(patient.insurance_number || ''),
    patient_type: String(patient.patient_type || 'outpatient'),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) { setError('First name, last name and phone are required.'); return; }
    setBusy(true); setError('');
    try {
      await apiFetch('/api/patients', { method: 'PUT', body: JSON.stringify({ id: patient.id, ...form }) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); } finally { setBusy(false); }
  };
  const F = ({ k, label, ...rest }: { k: string; label: string; type?: string }) => (
    <Field label={label}><Input value={form[k] || ''} onChange={(e) => set(k, e.target.value)} type={rest.type} /></Field>
  );
  return (
    <Modal title="Edit patient" onClose={onClose} wide>
      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <F k="first_name" label="First name *" />
          <F k="last_name" label="Last name *" />
          <F k="phone" label="Phone *" />
          <F k="email" label="Email" />
          <F k="date_of_birth" label="Date of birth" type="date" />
          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Patient type">
            <Select value={form.patient_type} onChange={(e) => set('patient_type', e.target.value)}>
              <option value="outpatient">Outpatient</option>
              <option value="inpatient">Inpatient</option>
            </Select>
          </Field>
          <div className="sm:col-span-2"><F k="address" label="Address" /></div>
          <F k="emergency_contact_name" label="Emergency contact" />
          <F k="emergency_contact_phone" label="Emergency phone" />
          <F k="emergency_contact_relationship" label="Emergency contact relationship" />
          <F k="blood_type" label="Blood type" />
          <F k="allergies" label="Allergies" />
          <div className="sm:col-span-2"><Field label="Medical history"><Textarea rows={2} value={form.medical_history} onChange={(e) => set('medical_history', e.target.value)} /></Field></div>
          <F k="insurance_provider" label="Insurance provider" />
          <F k="insurance_number" label="Insurance number" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} loading={busy}>Save changes</Btn>
        </div>
      </div>
    </Modal>
  );
}

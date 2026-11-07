import { useState } from 'react';
import { apiFetch } from '../lib/helpers';
import { useAuth } from '../contexts/AuthContext';
import { Btn, Field, Input, Select, Textarea, Modal } from '../components/ui';

export const TOOTH_CONDITIONS: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: '#d7f1f1' },
  decay: { label: 'Decay', color: '#fca5a5' },
  filling: { label: 'Filling', color: '#93c5fd' },
  crown: { label: 'Crown', color: '#fcd34d' },
  implant: { label: 'Implant', color: '#c4b5fd' },
  missing: { label: 'Missing', color: '#e2e8f0' },
  root_canal: { label: 'Root canal', color: '#fdba74' },
  extraction: { label: 'To extract', color: '#f87171' },
};

export function fdiTeeth(): string[] {
  const quads = [['1', '2'], ['3', '4']];
  const top: string[] = [];
  for (let i = 8; i >= 1; i--) top.push(`1${i}`);
  for (let i = 1; i <= 8; i++) top.push(`2${i}`);
  const bottom: string[] = [];
  for (let i = 8; i >= 1; i--) bottom.push(`4${i}`);
  for (let i = 1; i <= 8; i++) bottom.push(`3${i}`);
  void quads;
  return [...top, ...bottom];
}

export function fdiPrimaryTeeth(): string[] {
  return ['55','54','53','52','51','61','62','63','64','65','85','84','83','82','81','71','72','73','74','75'];
}

// Interactive FDI odontogram. Conditions map tooth->condition key.
// onSelect(tooth) lets a clinical form attach records to a tooth.
export function Odontogram({ conditions = {}, onSelect, selected, dentition = 'adult' }: {
  conditions?: Record<string, string>;
  onSelect?: (tooth: string) => void;
  selected?: string | null;
  dentition?: 'adult' | 'paediatric';
}) {
  const teeth = dentition === 'paediatric' ? fdiPrimaryTeeth() : fdiTeeth();
  const rowSize = dentition === 'paediatric' ? 10 : 16;
  const top = teeth.slice(0, rowSize);
  const bottom = teeth.slice(rowSize);
  const renderRow = (row: string[]) => (
    <div className={row.length === 10 ? "grid grid-cols-5 sm:grid-cols-10 gap-1 sm:gap-1.5" : "grid grid-cols-8 gap-1 sm:gap-1.5"}>
      {row.map((t) => {
        const cond = conditions[t];
        const fill = cond ? TOOTH_CONDITIONS[cond]?.color || '#d7f1f1' : '#f1f8f8';
        const isSel = selected === t;
        return (
          <button
            key={t}
            type="button"
            title={`Tooth ${t}${cond ? ` — ${TOOTH_CONDITIONS[cond]?.label}` : ''}`}
            onClick={() => onSelect?.(t)}
            className={`flex flex-col items-center rounded-lg border p-1 transition ${isSel ? 'border-teal-600 ring-2 ring-teal-200' : 'border-slate-200 hover:border-teal-400'} ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ background: fill }}
          >
            <svg viewBox="0 0 24 28" className="h-6 w-5 sm:h-8 sm:w-6">
              <path d="M12 2C7 2 4 6 4 10c0 3 1.5 5 2.5 8 .7 2.2 1 6 2.5 6 1.8 0 1.2-5 3-5s1.2 5 3 5c1.5 0 1.8-3.8 2.5-6 1-3 2.5-5 2.5-8 0-4-3-8-8-8z" fill="#fff" stroke="#0f2a33" strokeWidth="1.4" />
              {cond === 'missing' && <line x1="5" y1="4" x2="19" y2="24" stroke="#dc2626" strokeWidth="2" />}
              {cond === 'extraction' && <line x1="5" y1="4" x2="19" y2="24" stroke="#dc2626" strokeWidth="2" />}
              {cond === 'decay' && <circle cx="12" cy="14" r="3.4" fill="#dc2626" opacity="0.85" />}
              {cond === 'filling' && <rect x="8.4" y="10.5" width="7.2" height="7.2" rx="1.5" fill="#2563eb" opacity="0.85" />}
              {cond === 'crown' && <rect x="7" y="6" width="10" height="13" rx="3" fill="none" stroke="#b45309" strokeWidth="2" />}
              {cond === 'implant' && <line x1="12" y1="6" x2="12" y2="23" stroke="#7c3aed" strokeWidth="2.4" />}
              {cond === 'root_canal' && <line x1="12" y1="8" x2="12" y2="21" stroke="#ea580c" strokeWidth="2" />}
            </svg>
            <span className="mt-0.5 text-[10px] font-bold text-slate-700">{t}</span>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="space-y-2">
      {renderRow(top)}
      <div className="flex items-center gap-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <div className="h-px flex-1 bg-slate-200" /> upper / lower <div className="h-px flex-1 bg-slate-200" />
      </div>
      {renderRow(bottom)}
      <div className="flex flex-wrap gap-2 pt-1">
        {Object.entries(TOOTH_CONDITIONS).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <span className="inline-block h-3 w-3 rounded-sm border border-slate-300" style={{ background: v.color }} /> {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Add/edit dental record modal (dentist/admin only enforced server-side too).
export function RecordModal({ patientId, dentists, existing, tooth, onClose, onSaved }: {
  patientId: number; dentists: { id: number; full_name: string }[];
  existing?: Record<string, unknown> | null; tooth?: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const { staff } = useAuth();
  const [form, setForm] = useState({
    diagnosis: (existing?.diagnosis as string) || '',
    treatment_plan: (existing?.treatment_plan as string) || '',
    notes: (existing?.notes as string) || '',
    tooth_number: ((existing?.tooth_number as string) || tooth || ''),
    dentist_id: String((existing?.dentist_id as number) || staff?.id || ''),
    record_date: ((existing?.record_date as string) || new Date().toISOString().slice(0, 10)),
    status: ((existing?.status as string) || 'open'),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form.diagnosis.trim()) { setError('Diagnosis is required.'); return; }
    if (!form.dentist_id) { setError('Please select the treating dentist.'); return; }
    setBusy(true); setError('');
    try {
      if (existing) {
        await apiFetch('/api/dental-records', { method: 'PUT', body: JSON.stringify({ id: existing.id, ...form, dentist_id: Number(form.dentist_id) || null }) });
      } else {
        await apiFetch('/api/dental-records', { method: 'POST', body: JSON.stringify({ patient_id: patientId, ...form, dentist_id: Number(form.dentist_id) || null }) });
      }
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); } finally { setBusy(false); }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title={existing ? 'Edit dental record' : 'New dental record'} onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tooth (FDI)"><Input value={form.tooth_number} onChange={(e) => set('tooth_number', e.target.value)} placeholder="e.g. 36" /></Field>
          <Field label="Date"><Input type="date" value={form.record_date} onChange={(e) => set('record_date', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dentist">
            <Select value={form.dentist_id} onChange={(e) => set('dentist_id', e.target.value)}>
              <option value="">Select…</option>
              {dentists.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
        </div>
        <Field label="Diagnosis *"><Textarea rows={2} value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} placeholder="e.g. Deep caries, tooth 36" /></Field>
        <Field label="Treatment plan"><Textarea rows={2} value={form.treatment_plan} onChange={(e) => set('treatment_plan', e.target.value)} placeholder="Planned treatment…" /></Field>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} loading={busy}>Save record</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function TreatmentModal({ patientId, dentists, existing, onClose, onSaved }: {
  patientId: number; dentists: { id: number; full_name: string }[];
  existing?: Record<string, unknown> | null;
  onClose: () => void; onSaved: () => void;
}) {
  const { staff } = useAuth();
  const [form, setForm] = useState({
    procedure_name: (existing?.procedure_name as string) || '',
    tooth_number: ((existing?.tooth_number as string) || ''),
    treatment_date: ((existing?.treatment_date as string) || new Date().toISOString().slice(0, 10)),
    cost: String((existing?.cost as number) ?? ''),
    status: ((existing?.status as string) || 'planned'),
    dentist_id: String((existing?.dentist_id as number) || staff?.id || ''),
    notes: (existing?.notes as string) || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.procedure_name.trim()) { setError('Procedure name is required.'); return; }
    setBusy(true); setError('');
    try {
      const payload = { ...form, cost: Number(form.cost) || 0, dentist_id: Number(form.dentist_id) || null };
      if (existing) await apiFetch('/api/treatments', { method: 'PUT', body: JSON.stringify({ id: existing.id, ...payload }) });
      else await apiFetch('/api/treatments', { method: 'POST', body: JSON.stringify({ patient_id: patientId, ...payload }) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); } finally { setBusy(false); }
  };
  return (
    <Modal title={existing ? 'Edit treatment' : 'New treatment'} onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}
        <Field label="Procedure *">
          <Input value={form.procedure_name} onChange={(e) => set('procedure_name', e.target.value)} placeholder="e.g. Root Canal Treatment" list="proc-list" />
          <datalist id="proc-list">
            {['Scaling & Polishing', 'Composite Filling', 'Root Canal Treatment', 'Porcelain Crown', 'Surgical Extraction', 'Orthodontic Braces', 'Teeth Whitening', 'Dental Implant', 'Denture Fitting', 'Pediatric Checkup'].map((p) => <option key={p} value={p} />)}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tooth (FDI)"><Input value={form.tooth_number} onChange={(e) => set('tooth_number', e.target.value)} placeholder="e.g. 26" /></Field>
          <Field label="Date"><Input type="date" value={form.treatment_date} onChange={(e) => set('treatment_date', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost (KES)"><Input type="number" min="0" value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="0" /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </div>
        <Field label="Dentist">
          <Select value={form.dentist_id} onChange={(e) => set('dentist_id', e.target.value)}>
            <option value="">Select…</option>
            {dentists.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} loading={busy}>Save treatment</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function PrescriptionModal({ patientId, dentists, existing, onClose, onSaved }: {
  patientId: number; dentists: { id: number; full_name: string }[];
  existing?: Record<string, unknown> | null;
  onClose: () => void; onSaved: () => void;
}) {
  const { staff } = useAuth();
  const [form, setForm] = useState({
    medication: (existing?.medication as string) || '', dosage: (existing?.dosage as string) || '',
    frequency: (existing?.frequency as string) || '', duration: (existing?.duration as string) || '',
    instructions: (existing?.instructions as string) || '',
    prescribed_date: (existing?.prescribed_date as string) || new Date().toISOString().slice(0, 10),
    dentist_id: String((existing?.dentist_id as number) || staff?.id || ''),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.medication.trim()) { setError('Medication is required.'); return; }
    setBusy(true); setError('');
    try {
      if (existing) await apiFetch('/api/prescriptions', { method: 'PUT', body: JSON.stringify({ id: existing.id, ...form, dentist_id: Number(form.dentist_id) || null }) });
      else await apiFetch('/api/prescriptions', { method: 'POST', body: JSON.stringify({ patient_id: patientId, ...form, dentist_id: Number(form.dentist_id) || null }) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); } finally { setBusy(false); }
  };
  return (
    <Modal title={existing ? "Edit prescription" : "New prescription"} onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}
        <Field label="Medication *"><Input value={form.medication} onChange={(e) => set('medication', e.target.value)} placeholder="e.g. Amoxicillin" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dosage"><Input value={form.dosage} onChange={(e) => set('dosage', e.target.value)} placeholder="500mg" /></Field>
          <Field label="Frequency"><Input value={form.frequency} onChange={(e) => set('frequency', e.target.value)} placeholder="3x daily" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration"><Input value={form.duration} onChange={(e) => set('duration', e.target.value)} placeholder="5 days" /></Field>
          <Field label="Date"><Input type="date" value={form.prescribed_date} onChange={(e) => set('prescribed_date', e.target.value)} /></Field>
        </div>
        <Field label="Dentist">
          <Select value={form.dentist_id} onChange={(e) => set('dentist_id', e.target.value)}>
            <option value="">Select…</option>
            {dentists.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Instructions"><Textarea rows={2} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="Take after meals…" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} loading={busy}>{existing ? "Update prescription" : "Save prescription"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { apiFetch, formatKES, canWriteClinical } from '../lib/helpers';
import { useAuth } from '../contexts/AuthContext';
import { Card, PageHeader, Btn, Badge, Input, Select, Empty, Spinner } from '../components/ui';
import { TreatmentModal } from '../components/Odontogram';

interface T {
  id: number; patient_id: number; procedure_name: string; tooth_number: string | null;
  treatment_date: string; cost: number; status: string; notes: string | null;
}

export default function Treatments() {
  const { staff } = useAuth();
  const [rows, setRows] = useState<(T & { patient_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<{ open: boolean; existing?: Record<string, unknown> | null; patientId?: number }>({ open: false });
  const [dentists, setDentists] = useState<{ id: number; full_name: string }[]>([]);
  const [patients, setPatients] = useState<{ id: number; first_name: string; last_name: string }[]>([]);

  const canWrite = canWriteClinical(staff?.role);

  const fetchAll = async () => {
    setLoading(true); setError('');
    try {
      const [t, st, ps] = await Promise.all([
        apiFetch(`/api/treatments${status ? `?status=${status}` : ''}`),
        apiFetch('/api/staff').catch(() => []),
        apiFetch('/api/patients?limit=100&status=active').catch(() => ({ rows: [] })),
      ]);
      const list = (t as T[]) || [];
      const pMap = Object.fromEntries((((ps as { rows: typeof patients }).rows) || []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
      // fetch names for any patient not in first 100
      const missing = [...new Set(list.map((x) => x.patient_id))].filter((id) => !pMap[id]);
      for (const mid of missing.slice(0, 20)) {
        try {
          const one = await apiFetch(`/api/patients?id=${mid}`) as { first_name: string; last_name: string };
          pMap[mid] = `${one.first_name} ${one.last_name}`;
        } catch { pMap[mid] = `#${mid}`; }
      }
      setRows(list.map((x) => ({ ...x, patient_name: pMap[x.patient_id] || `#${x.patient_id}` })));
      const arr = (st as { id: number; full_name: string; role: string; status: string }[]).filter((s) => s.status === 'active' && (s.role === 'dentist' || s.role === 'admin'));
      setDentists(arr.map((s) => ({ id: s.id, full_name: s.full_name })));
      setPatients(((ps as { rows: typeof patients }).rows) || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [status]);

  const filtered = rows.filter((r) =>
    !search.trim() || r.procedure_name.toLowerCase().includes(search.toLowerCase()) || (r.patient_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const del = async (id: number) => {
    if (!confirm('Delete this treatment?')) return;
    try { await apiFetch(`/api/treatments?id=${id}`, { method: 'DELETE' }); fetchAll(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const createForPatient = async (patientId: number) => {
    setModal({ open: true, patientId });
  };

  return (
    <div>
      <PageHeader title="Treatments" subtitle={`${filtered.length} procedure(s)`} />
      <Card className="p-4">
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search procedure or patient…" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        {canWrite && (
          <div className="mb-4 rounded-xl bg-teal-50 p-3 text-sm">
            <span className="font-semibold text-teal-900">New treatment? </span>
            <span className="text-teal-700">Pick a patient, then record the procedure — or open the patient file for the full odontogram workflow.</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {patients.slice(0, 6).map((p) => (
                <button key={p.id} onClick={() => createForPatient(p.id)} className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100">
                  <Plus className="mr-1 inline h-3 w-3" />{p.first_name} {p.last_name}
                </button>
              ))}
            </div>
          </div>
        )}
        {loading ? <Spinner /> : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
        ) : filtered.length === 0 ? <Empty title="No treatments found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b text-xs uppercase text-slate-500">
                <th className="px-3 py-2.5">Patient</th><th className="px-3 py-2.5">Procedure</th><th className="px-3 py-2.5">Tooth</th>
                <th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Cost</th><th className="px-3 py-2.5">Status</th>
                {canWrite && <th className="px-3 py-2.5 text-right">Actions</th>}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3"><Link to={`/patients/${t.patient_id}`} className="font-bold text-teal-700 hover:underline">{t.patient_name}</Link></td>
                    <td className="px-3 py-3 font-medium text-slate-800">{t.procedure_name}</td>
                    <td className="px-3 py-3">{t.tooth_number || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{t.treatment_date}</td>
                    <td className="px-3 py-3 font-semibold">{formatKES(t.cost)}</td>
                    <td className="px-3 py-3"><Badge value={t.status} /></td>
                    {canWrite && (
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => setModal({ open: true, existing: t as unknown as Record<string, unknown>, patientId: t.patient_id })} className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50">Edit</button>
                        <button onClick={() => del(t.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {modal.open && (
        <TreatmentModal
          patientId={modal.patientId ?? (modal.existing?.patient_id as number) ?? 0}
          dentists={dentists}
          existing={modal.existing}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); fetchAll(); }}
        />
      )}
      {!canWrite && <p className="mt-3 text-xs text-slate-500">Your role has read-only access to treatments. Clinical edits require a dentist or admin account.</p>}
    </div>
  );
}

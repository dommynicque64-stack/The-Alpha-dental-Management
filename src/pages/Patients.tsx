import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Archive, RotateCcw, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { apiFetch, calcAge } from '../lib/helpers';
import { useAuth } from '../contexts/AuthContext';
import { Card, PageHeader, Btn, Badge, Input, Select, Empty, Spinner } from '../components/ui';

interface Patient {
  id: number; first_name: string; last_name: string; phone: string; email: string | null;
  date_of_birth: string | null; gender: string | null; patient_type?: string | null; status: string; created_at: string | null;
}

export default function Patients() {
  const { staff } = useAuth();
  const [rows, setRows] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ search: debounced, status, sort, order, page: String(page), limit: String(limit) });
      const d = await apiFetch(`/api/patients?${params}`) as { rows: Patient[]; total: number };
      setRows(d.rows || []); setTotal(d.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load patients');
    } finally { setLoading(false); }
  }, [debounced, status, sort, order, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const archive = async (id: number, to: string) => {
    if (!confirm(to === 'archived' ? 'Archive this patient? They will be hidden from active lists.' : 'Restore this patient to active?')) return;
    try {
      await apiFetch('/api/patients', { method: 'PUT', body: JSON.stringify({ id, status: to }) });
      fetchRows();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const hardDelete = async (id: number) => {
    if (!confirm('Permanently delete this patient and ALL their records? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/patients?id=${id}&hard=1`, { method: 'DELETE' });
      fetchRows();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const pages = Math.max(1, Math.ceil(total / limit));
  const canWrite = staff?.role === 'admin' || staff?.role === 'dentist' || staff?.role === 'receptionist';

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={`${total} patient${total === 1 ? '' : 's'} ${status === 'all' ? 'total' : status}`}
        actions={canWrite ? <Link to="/patients/new"><Btn><Plus className="h-4 w-4" /> Register Patient</Btn></Link> : undefined}
      />
      <Card className="p-4">
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email…" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
          <Select value={`${sort}:${order}`} onChange={(e) => { const [s, o] = e.target.value.split(':'); setSort(s); setOrder(o); setPage(1); }}>
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="first_name:asc">First name A–Z</option>
            <option value="last_name:asc">Last name A–Z</option>
          </Select>
          <div className="flex items-center justify-end gap-2 text-sm">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-semibold text-slate-700">{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {loading ? <Spinner label="Loading patients…" /> : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
        ) : rows.length === 0 ? (
          <Empty title="No patients found" subtitle="Try a different search or register a new patient." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Contact</th>
                  <th className="px-3 py-2.5">Age / Gender</th>
                  <th className="px-3 py-2.5">Patient Type</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <Link to={`/patients/${p.id}`} className="font-bold text-teal-700 hover:underline">{p.first_name} {p.last_name}</Link>
                      <p className="text-xs text-slate-400">#{p.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-700">{p.phone}</p>
                      <p className="text-xs text-slate-400">{p.email || '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{calcAge(p.date_of_birth)} · <span className="capitalize">{p.gender || '—'}</span></td>
                    <td className="px-3 py-3"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold capitalize text-sky-700">{p.patient_type || 'outpatient'}</span></td>
                    <td className="px-3 py-3"><Badge value={p.status} /></td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/patients/${p.id}`} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50">View</Link>
                        {canWrite && p.status === 'active' && (
                          <button onClick={() => archive(p.id, 'archived')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"><Archive className="h-3.5 w-3.5" /> Archive</button>
                        )}
                        {canWrite && p.status === 'archived' && (
                          <button onClick={() => archive(p.id, 'active')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                        )}
                        {staff?.role === 'admin' && (
                          <button onClick={() => hardDelete(p.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

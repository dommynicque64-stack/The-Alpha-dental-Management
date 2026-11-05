import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { apiFetch } from '../lib/helpers';
import { Card, PageHeader, Btn, Badge, Select, Empty, Spinner } from '../components/ui';

interface Appt {
  id: number; patient_id: number; dentist_id: number; appointment_date: string;
  start_time: string; end_time: string; reason: string | null; status: string;
  patient_name: string; dentist_name: string; notes: string | null;
}

type View = 'calendar' | 'day' | 'week' | 'list';

const STATUSES = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

export default function Appointments() {
  const [view, setView] = useState<View>('day');
  const [rows, setRows] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(new Date().toISOString().slice(0, 10));
  const [dentistFilter, setDentistFilter] = useState('');
  const [staffList, setStaffList] = useState<{ id: number; full_name: string }[]>([]);

  const fetchRows = async () => {
    setLoading(true); setError('');
    try {
      let url = '/api/appointments?';
      if (view === 'day') url += `date=${cursor}`;
      else if (view === 'week') {
        const d = new Date(cursor);
        const dow = (d.getDay() + 6) % 7;
        const mon = new Date(d); mon.setDate(d.getDate() - dow);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        url += `from=${mon.toISOString().slice(0, 10)}&to=${sun.toISOString().slice(0, 10)}`;
      } else if (view === 'calendar') {
        const [y, m] = cursor.split('-').map(Number);
        const from = `${y}-${String(m).padStart(2, '0')}-01`;
        const last = new Date(y, m, 0).getDate();
        url += `from=${from}&to=${y}-${String(m).padStart(2, '0')}-${last}`;
      }
      if (dentistFilter) url += `&dentist_id=${dentistFilter}`;
      const d = await apiFetch(url) as Appt[];
      setRows(d);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    apiFetch('/api/staff').then((d) => {
      const arr = (d as { id: number; full_name: string; role: string; status: string }[]).filter((s) => (s.role === 'dentist' || s.role === 'admin') && s.status === 'active');
      setStaffList(arr.map((s) => ({ id: s.id, full_name: s.full_name })));
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchRows(); }, [view, cursor, dentistFilter]);

  const setStatus = async (a: Appt, status: string) => {
    try {
      await apiFetch('/api/appointments', { method: 'PUT', body: JSON.stringify({ id: a.id, status }) });
      fetchRows();
    } catch (e) { alert(e instanceof Error ? e.message : 'Update failed'); }
  };

  const cancelAppt = async (a: Appt) => {
    if (!confirm(`Cancel appointment for ${a.patient_name} on ${a.appointment_date}?`)) return;
    await setStatus(a, 'cancelled');
  };

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (view === 'calendar') d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCursor(d.toISOString().slice(0, 10));
  };

  const weekDays = useMemo(() => {
    const d = new Date(cursor);
    const dow = (d.getDay() + 6) % 7;
    const mon = new Date(d); mon.setDate(d.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(mon); day.setDate(mon.getDate() + i);
      return day.toISOString().slice(0, 10);
    });
  }, [cursor]);

  const title = view === 'calendar'
    ? new Date(cursor).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `Week of ${weekDays[0]} → ${weekDays[6]}`
      : new Date(cursor + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const listRows = view === 'list' ? [...rows].reverse().slice(0, 100) : rows;

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle={title}
        actions={<Link to="/appointments/new"><Btn><Plus className="h-4 w-4" /> New Appointment</Btn></Link>}
      />
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['day', 'week', 'calendar', 'list'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${view === v ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{v}</button>
            ))}
          </div>
          {view !== 'list' && (
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setCursor(new Date().toISOString().slice(0, 10))} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Today</button>
              <button onClick={() => shift(1)} className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
          <Select value={dentistFilter} onChange={(e) => setDentistFilter(e.target.value)} className="w-48">
            <option value="">All dentists</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? <Spinner label="Loading appointments…" /> : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      ) : view === 'calendar' ? (
        <MonthGrid cursor={cursor} rows={rows} />
      ) : view === 'week' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {weekDays.map((day) => (
            <Card key={day} className="p-2.5">
              <p className={`text-xs font-bold ${day === new Date().toISOString().slice(0, 10) ? 'text-teal-700' : 'text-slate-600'}`}>
                {new Date(day + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
              </p>
              <div className="mt-2 space-y-1.5">
                {rows.filter((r) => r.appointment_date === day).length === 0 && <p className="text-[11px] text-slate-400">—</p>}
                {rows.filter((r) => r.appointment_date === day).map((a) => (
                  <ApptChip key={a.id} a={a} onCancel={() => cancelAppt(a)} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-4">
          {listRows.length === 0 ? <Empty title={view === 'list' ? 'No appointments yet' : 'No appointments on this day'} subtitle="Bookings are overlap-checked per dentist." /> : (
            <div className="divide-y divide-slate-100">
              {listRows.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-14 shrink-0 rounded-lg bg-slate-100 px-1.5 py-1 text-center text-xs font-bold text-slate-700">{a.start_time.slice(0, 5)}</span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/patients/${a.patient_id}`} className="text-sm font-bold text-teal-700 hover:underline">{a.patient_name}</Link>
                    <p className="truncate text-xs text-slate-500">{a.appointment_date} · {a.end_time.slice(0, 5)} · {a.dentist_name} · {a.reason || '—'}</p>
                  </div>
                  <Badge value={a.status} />
                  <select value={a.status} onChange={(e) => setStatus(a, e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700">
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
                  </select>
                  {a.status !== 'cancelled' && (
                    <button onClick={() => cancelAppt(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Cancel"><X className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ApptChip({ a, onCancel }: { a: { id: number; start_time: string; patient_name: string; status: string }; onCancel: () => void }) {
  return (
    <div className="group rounded-lg border border-slate-200 bg-white p-1.5 text-[11px]">
      <p className="font-bold text-slate-700">{a.start_time.slice(0, 5)}</p>
      <p className="truncate text-slate-600">{a.patient_name}</p>
      <div className="mt-1 flex items-center justify-between">
        <Badge value={a.status} />
        {a.status !== 'cancelled' && <button onClick={onCancel} className="text-slate-300 hover:text-red-500"><X className="h-3 w-3" /></button>}
      </div>
    </div>
  );
}

function MonthGrid({ cursor, rows }: { cursor: string; rows: { appointment_date: string; status: string; start_time: string; patient_name: string }[] }) {
  const [y, m] = cursor.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7 !== 0) cells.push(null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="px-2 py-2 text-center text-xs font-bold uppercase text-slate-500">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const dayRows = day ? rows.filter((r) => r.appointment_date === day) : [];
          return (
            <div key={i} className={`cal-cell border-b border-r border-slate-100 p-1 sm:p-1.5 ${day === today ? 'bg-teal-50/60' : ''}`}>
              {day && (
                <>
                  <p className={`text-[11px] font-bold sm:text-xs ${day === today ? 'text-teal-700' : 'text-slate-500'}`}>{Number(day.slice(8))}</p>
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {dayRows.slice(0, 3).map((a, j) => (
                      <div key={j} className="truncate rounded bg-teal-100 px-1 py-0.5 text-[10px] font-semibold text-teal-800">{a.start_time.slice(0, 5)} {a.patient_name}</div>
                    ))}
                    {dayRows.length > 3 && <p className="text-[10px] font-semibold text-slate-400">+{dayRows.length - 3} more</p>}
                  </div>
                  {dayRows.length > 0 && (
                    <div className="mt-0.5 flex gap-0.5 sm:hidden">
                      {dayRows.slice(0, 4).map((a, j) => <span key={j} className={`h-1.5 w-1.5 rounded-full ${a.status === 'cancelled' ? 'bg-slate-300' : 'bg-teal-500'}`} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

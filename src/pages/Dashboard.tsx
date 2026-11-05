import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, CalendarDays, CheckCircle2, Wallet, Banknote, Plus, ArrowRight } from 'lucide-react';
import { apiFetch, formatKES } from '../lib/helpers';
import { useAuth } from '../contexts/AuthContext';
import { Card, Spinner, Badge } from '../components/ui';

interface Dash {
  totalPatients: number; todayAppointments: number; completedAppointments: number;
  outstandingBalance: number | null; todayRevenue: number;
  todayList: { id: number; start_time: string; status: string; patient_name: string; dentist_name: string }[];
}

export default function Dashboard() {
  const { staff } = useAuth();
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/dashboard')
      .then((d) => setData(d as Dash))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>;
  if (!data) return null;

  const cards = [
    { label: 'Total Patients', value: String(data.totalPatients), icon: Users, bg: 'bg-teal-500', link: '/patients' },
    { label: "Today's Appointments", value: String(data.todayAppointments), icon: CalendarDays, bg: 'bg-blue-500', link: '/appointments' },
    { label: 'Completed (Today)', value: String(data.completedAppointments), icon: CheckCircle2, bg: 'bg-emerald-500', link: '/appointments' },
    ...(staff?.role === 'receptionist'
      ? [{ label: "Today's Payments", value: formatKES(data.todayRevenue), icon: Banknote, bg: 'bg-violet-500', link: '/payments' }]
      : [
          { label: 'Outstanding Balance', value: formatKES(data.outstandingBalance), icon: Wallet, bg: 'bg-amber-500', link: '/billing' },
          { label: "Today's Revenue", value: formatKES(data.todayRevenue), icon: Banknote, bg: 'bg-violet-500', link: '/billing' },
        ]),
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Clinic overview</p>
        </div>
        <div className="flex gap-2">
          <Link to="/patients/new" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-700"><Plus className="h-4 w-4" /> New Patient</Link>
          <Link to="/appointments/new" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" /> Book Visit</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} to={c.link}>
            <Card className="flex items-center gap-3 p-4 transition hover:shadow-md">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${c.bg}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
                <p className="truncate text-lg font-extrabold text-slate-900">{c.value}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Today's schedule</h2>
            <Link to="/appointments" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          {data.todayList.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No appointments scheduled for today.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.todayList.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-12 shrink-0 rounded-lg bg-slate-100 px-1.5 py-1 text-center text-xs font-bold text-slate-700">{a.start_time.slice(0, 5)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{a.patient_name}</p>
                    <p className="truncate text-xs text-slate-500">{a.dentist_name}</p>
                  </div>
                  <Badge value={a.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Quick actions</h2>
          <div className="space-y-2">
            {[
              ['Register patient', 'Add a new patient record', '/patients/new'],
              ['Book appointment', 'Schedule a visit (overlap-checked)', '/appointments/new'],
              ['Record payment', 'Post M-Pesa, cash or card', staff?.role === 'receptionist' ? '/payments' : '/billing'],
              ['Clinical notes', 'Records, odontogram & Rx', '/treatments'],
            ].map(([t, s, link]) => (
              <Link key={t} to={link} className="block rounded-xl border border-slate-200 p-3 transition hover:border-teal-300 hover:bg-teal-50/50">
                <p className="text-sm font-bold text-slate-800">{t}</p>
                <p className="text-xs text-slate-500">{s}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

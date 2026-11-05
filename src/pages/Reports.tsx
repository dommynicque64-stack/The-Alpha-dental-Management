import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Download } from 'lucide-react';
import { apiFetch, formatKES } from '../lib/helpers';
import { Card, PageHeader, Btn, Input, Spinner } from '../components/ui';

const COLORS = ['#0d9488', '#2563eb', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#06b6d4', '#84cc16'];

interface ReportData {
  daily: { date: string; label: string; revenue: number; appointments: number }[];
  byMethod: { name: string; value: number }[];
  byProcedure: { name: string; value: number }[];
  byApptStatus: { name: string; value: number }[];
  totals: { revenue: number; billed: number; outstanding: number; appointments: number; treatments: number };
  from: string; to: string;
}

export default function Reports() {
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    setLoading(true); setError('');
    try {
      const d = await apiFetch(`/api/dashboard?view=reports&from=${from}&to=${to}`) as ReportData;
      setData(d);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []);

  const exportCSV = () => {
    if (!data) return;
    const lines = ['date,revenue,appointments', ...data.daily.map((d) => `${d.date},${d.revenue},${d.appointments}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dentalcare-report-${from}-to-${to}.csv`;
    a.click();
  };

  return (
    <div>
      <PageHeader
        title="Financial & Clinical Reports"
        subtitle="Revenue, appointments and treatments over time"
        actions={<Btn variant="secondary" onClick={exportCSV} disabled={!data}><Download className="h-4 w-4" /> Export CSV</Btn>}
      />
      <Card className="mb-4 flex flex-wrap items-end gap-2 p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Btn onClick={fetchReports} loading={loading}>Apply</Btn>
      </Card>

      {loading ? <Spinner label=" crunching numbers…" /> : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['Revenue', formatKES(data.totals.revenue)],
              ['Billed', formatKES(data.totals.billed)],
              ['Outstanding', formatKES(data.totals.outstanding)],
              ['Appointments', String(data.totals.appointments)],
              ['Treatments', String(data.totals.treatments)],
            ].map(([k, v]) => (
              <Card key={k} className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</p>
                <p className="mt-1 truncate text-lg font-extrabold text-slate-900">{v}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-bold text-slate-900">Revenue & appointments per day</h3>
            <p className="mb-3 text-xs text-slate-500">{data.from} → {data.to}</p>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: unknown, name: unknown) => (name === 'revenue' ? formatKES(Number(v)) : String(v ?? ''))} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="Revenue (KES)" stroke="#0d9488" fill="#99f6e4" strokeWidth={2} />
                  <Area type="monotone" dataKey="appointments" name="Appointments" stroke="#2563eb" fill="#bfdbfe" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Revenue by payment method</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.byMethod} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3} label={{ fontSize: 11 }}>
                      {data.byMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatKES(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Appointments by status</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byApptStatus} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" name="Count" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Top procedures by revenue</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byProcedure} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: unknown) => formatKES(Number(v))} />
                  <Bar dataKey="value" name="Revenue (KES)" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

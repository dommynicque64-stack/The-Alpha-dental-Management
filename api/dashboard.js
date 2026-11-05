import supabase from './db-client.js';
import { sendCors, requireAuth, hasPerm, todayNairobi } from './auth-helper.js';

// Dashboard KPIs + reports aggregates (computed server-side from real data).
// GET /api/dashboard           -> KPI cards for today
// GET /api/dashboard?view=reports&from=YYYY-MM-DD&to=YYYY-MM-DD -> charts data
export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff } = auth;
    if (!hasPerm(staff, 'dashboard.read')) return res.status(403).json({ error: 'Forbidden.' });
    const today = todayNairobi();

    if (req.query.view === 'reports') {
      if (staff.role !== 'admin' && !hasPerm(staff, 'reports.read') && !hasPerm(staff, 'billing.read')) {
        return res.status(403).json({ error: 'Forbidden: reports require admin or accountant role.' });
      }
      const from = req.query.from || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const to = req.query.to || today;
      const [{ data: payments }, { data: invoices }, { data: appointments }, { data: treatments }] = await Promise.all([
        supabase.from('payments').select('payment_date, amount, payment_method').gte('payment_date', from).lte('payment_date', to).limit(2000),
        supabase.from('invoices').select('issue_date, total_amount, amount_paid, status').gte('issue_date', from).lte('issue_date', to).limit(2000),
        supabase.from('appointments').select('appointment_date, status').gte('appointment_date', from).lte('appointment_date', to).limit(2000),
        supabase.from('treatments').select('treatment_date, procedure_name, cost, status').gte('treatment_date', from).lte('treatment_date', to).limit(2000),
      ]);
      const days = [];
      const cursor = new Date(from);
      const end = new Date(to);
      while (cursor <= end && days.length < 92) {
        const key = cursor.toISOString().slice(0, 10);
        const rev = (payments || []).filter((p) => p.payment_date === key).reduce((s, p) => s + Number(p.amount || 0), 0);
        const appts = (appointments || []).filter((a) => a.appointment_date === key).length;
        days.push({ date: key, label: key.slice(5), revenue: rev, appointments: appts });
        cursor.setDate(cursor.getDate() + 1);
      }
      const methodMap = {};
      for (const p of payments || []) methodMap[p.payment_method || 'cash'] = (methodMap[p.payment_method || 'cash'] || 0) + Number(p.amount || 0);
      const byMethod = Object.entries(methodMap).map(([name, value]) => ({ name, value }));
      const procMap = {};
      for (const t of treatments || []) procMap[t.procedure_name] = (procMap[t.procedure_name] || 0) + Number(t.cost || 0);
      const byProcedure = Object.entries(procMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
      const apptStatusMap = {};
      for (const a of appointments || []) apptStatusMap[a.status] = (apptStatusMap[a.status] || 0) + 1;
      const byApptStatus = Object.entries(apptStatusMap).map(([name, value]) => ({ name, value }));
      const totalRevenue = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      const totalBilled = (invoices || []).reduce((s, i) => s + Number(i.total_amount || 0), 0);
      return res.status(200).json({
        daily: days,
        byMethod, byProcedure, byApptStatus,
        totals: {
          revenue: totalRevenue, billed: totalBilled,
          outstanding: totalBilled - (invoices || []).reduce((s, i) => s + Number(i.amount_paid || 0), 0),
          appointments: (appointments || []).length, treatments: (treatments || []).length,
        },
        from, to,
      });
    }

    const [{ count: totalPatients }, { data: todayAppts }, { data: invoices }, { data: todayPayments }] = await Promise.all([
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('appointments').select('id, status, appointment_date, start_time, patient_id, dentist_id').eq('appointment_date', today).order('start_time'),
      supabase.from('invoices').select('balance, status, total_amount, amount_paid'),
      supabase.from('payments').select('amount').eq('payment_date', today),
    ]);
    const enriched = todayAppts || [];
    let patientNames = {};
    let dentistNames = {};
    if (enriched.length) {
      const pIds = [...new Set(enriched.map((a) => a.patient_id))];
      const dIds = [...new Set(enriched.map((a) => a.dentist_id))];
      const [{ data: ps }, { data: ds }] = await Promise.all([
        supabase.from('patients').select('id, first_name, last_name').in('id', pIds),
        supabase.from('clinic_staff').select('id, full_name').in('id', dIds),
      ]);
      patientNames = Object.fromEntries((ps || []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
      dentistNames = Object.fromEntries((ds || []).map((d) => [d.id, d.full_name]));
    }
    const outstanding = (invoices || []).reduce((s, i) => s + Math.max(0, Number(i.balance || 0)), 0);
    const todayRevenue = (todayPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const completed = (todayAppts || []).filter((a) => a.status === 'completed').length;
    return res.status(200).json({
      totalPatients: totalPatients ?? 0,
      todayAppointments: (todayAppts || []).length,
      completedAppointments: completed,
      outstandingBalance: staff.role === 'receptionist' ? null : outstanding,
      todayRevenue,
      todayList: enriched.slice(0, 8).map((a) => ({ ...a, patient_name: patientNames[a.patient_id] || '—', dentist_name: dentistNames[a.dentist_id] || '—' })),
    });
  } catch (err) {
    console.error('API /api/dashboard error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

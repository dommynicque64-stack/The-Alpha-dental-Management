import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/helpers';
import { Card, Btn, Field, Input, Select, Textarea } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

const schema = z.object({
  patient_id: z.string().min(1, 'Select a patient'),
  dentist_id: z.string().min(1, 'Select a dentist'),
  appointment_date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).refine((d) => d.start_time < d.end_time, { message: 'End time must be after start time', path: ['end_time'] });

type FormData = z.infer<typeof schema>;

export default function AppointmentNew() {
  const navigate = useNavigate();
  const { staff: currentStaff } = useAuth();
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState('');
  const [patients, setPatients] = useState<{ id: number; first_name: string; last_name: string; phone: string }[]>([]);
  const [dentists, setDentists] = useState<{ id: number; full_name: string }[]>([]);
  const [patSearch, setPatSearch] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { patient_id: params.get('patient') || '', appointment_date: new Date().toISOString().slice(0, 10), start_time: '09:00', end_time: '09:30' },
  });
  const patientId = watch('patient_id');

  useEffect(() => {
    apiFetch('/api/staff').then((d) => {
      const arr = (d as { id: number; full_name: string; role: string; status: string }[]).filter((s) => String(s.role).toLowerCase() === 'dentist' && String(s.status).toLowerCase() === 'active');
      setDentists(arr.map((s) => ({ id: s.id, full_name: s.full_name })));
      if (currentStaff?.role === 'dentist' && arr.some((s) => s.id === currentStaff.id)) setValue('dentist_id', String(currentStaff.id));
    }).catch(() => {});
  }, [currentStaff, setValue]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const d = await apiFetch(`/api/patients?search=${encodeURIComponent(patSearch)}&limit=30&status=active`) as { rows: typeof patients };
        setPatients(d.rows || []);
        if (params.get('patient') && !patSearch) {
          const one = await apiFetch(`/api/patients?id=${params.get('patient')}`).catch(() => null) as { id: number; first_name: string; last_name: string; phone: string } | null;
          if (one && !(d.rows || []).some((p) => p.id === one.id)) setPatients((prev) => [one, ...prev]);
        }
      } catch { /* noop */ }
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await apiFetch('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...data, patient_id: Number(data.patient_id), dentist_id: Number(data.dentist_id) }),
      });
      navigate('/appointments');
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Booking failed');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/appointments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to appointments</Link>
      <h1 className="mb-1 text-xl font-bold text-slate-900 sm:text-2xl">Book Appointment</h1>
      <p className="mb-5 text-sm text-slate-500">Overlaps for the same dentist are rejected automatically.</p>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4 p-5 sm:p-6">
          {serverError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{serverError}</div>}
          <Field label="Find patient">
            <Input value={patSearch} onChange={(e) => setPatSearch(e.target.value)} placeholder="Type to search…" />
          </Field>
          <Field label="Patient *" error={errors.patient_id?.message}>
            <Select {...register('patient_id')} value={patientId} onChange={(e) => setValue('patient_id', e.target.value)}>
              <option value="">Select patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} · {p.phone}</option>)}
            </Select>
          </Field>
          <Field label="Select Dentist *" error={errors.dentist_id?.message}>
            <Select {...register('dentist_id')} >
              <option value="">Select dentist…</option>
              {dentists.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Date *" error={errors.appointment_date?.message}><Input {...register('appointment_date')} type="date" /></Field>
            <Field label="Start *" error={errors.start_time?.message}><Input {...register('start_time')} type="time" /></Field>
            <Field label="End *" error={errors.end_time?.message}><Input {...register('end_time')} type="time" /></Field>
          </div>
          <Field label="Reason"><Input {...register('reason')} placeholder="e.g. Routine checkup & cleaning" /></Field>
          <Field label="Notes"><Textarea {...register('notes')} rows={3} /></Field>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Btn type="button" variant="secondary" onClick={() => navigate('/appointments')}>Cancel</Btn>
            <Btn type="submit" loading={isSubmitting}>Book appointment</Btn>
          </div>
        </Card>
      </form>
    </div>
  );
}

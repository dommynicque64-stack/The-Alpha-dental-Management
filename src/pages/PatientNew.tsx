import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import { apiFetch } from '../lib/helpers';
import { Card, Btn, Field, Input, Select, Textarea } from '../components/ui';

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  date_of_birth: z.string().optional(), gender: z.string().optional(), address: z.string().optional(),
  emergency_contact_name: z.string().optional(), emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  blood_type: z.string().optional(), allergies: z.string().optional(), medical_history: z.string().optional(),
  insurance_provider: z.string().optional(), insurance_number: z.string().optional(),
  patient_type: z.enum(['outpatient', 'inpatient']),
  consent_acknowledged: z.boolean().refine(v => v, 'Patient acknowledgement is required'),
  consent_signature: z.string().min(100, 'Patient signature is required'),
});

type FormData = z.infer<typeof schema>;

export default function PatientNew() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { patient_type: 'outpatient', consent_acknowledged: false, consent_signature: '' } });
  const signature = watch('consent_signature');

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const created = await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(data) }) as { id: number };
      navigate(`/patients/${created.id}`);
    } catch (e) { setServerError(e instanceof Error ? e.message : 'Registration failed'); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/patients" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to patients</Link>
      <h1 className="mb-1 text-xl font-bold text-slate-900 sm:text-2xl">Register Patient</h1>
      <p className="mb-5 text-sm text-slate-500">All fields marked * are required.</p>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-5 p-5 sm:p-6">
          {serverError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{serverError}</div>}
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-900">Personal details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" required error={errors.first_name?.message}><Input {...register('first_name')} placeholder="Wanjiru" /></Field>
              <Field label="Last name" required error={errors.last_name?.message}><Input {...register('last_name')} placeholder="Njoroge" /></Field>
              <Field label="Phone" required error={errors.phone?.message}><Input {...register('phone')} placeholder="+2547…" /></Field>
              <Field label="Email" error={errors.email?.message}><Input {...register('email')} type="email" placeholder="patient@example.com" /></Field>
              <Field label="Date of birth"><Input {...register('date_of_birth')} type="date" /></Field>
              <Field label="Gender"><Select {...register('gender')} defaultValue=""><option value="">Select…</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select></Field>
              <Field label="Patient type" required error={errors.patient_type?.message}><Select {...register('patient_type')}><option value="outpatient">Outpatient</option><option value="inpatient">Inpatient</option></Select></Field>
              <div className="sm:col-span-2"><Field label="Residence"><Input {...register('address')} placeholder="Street, City" /></Field></div>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-900">Emergency contact</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Contact name"><Input {...register('emergency_contact_name')} placeholder="Full name" /></Field>
              <Field label="Contact phone"><Input {...register('emergency_contact_phone')} placeholder="+2547…" /></Field>
              <Field label="Relationship"><Select {...register('emergency_contact_relationship')} defaultValue=""><option value="">Select relationship…</option><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="spouse">Spouse</option><option value="sibling">Sibling</option><option value="child">Child</option><option value="relative">Other relative</option><option value="friend">Friend</option><option value="other">Other</option></Select></Field>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-900">Medical & insurance</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Blood type"><Select {...register('blood_type')} defaultValue=""><option value="">Select…</option>{['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => <option key={b} value={b}>{b}</option>)}</Select></Field>
              <Field label="Allergies"><Input {...register('allergies')} placeholder="e.g. Penicillin" /></Field>
              <div className="sm:col-span-2"><Field label="Medical history"><Textarea {...register('medical_history')} rows={3} placeholder="Conditions, medications, notes…" /></Field></div>
              <Field label="Insurance provider"><Input {...register('insurance_provider')} placeholder="NHIF, Jubilee…" /></Field>
              <Field label="Insurance number"><Input {...register('insurance_number')} /></Field>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Consent and Acknowledgement</h3>
            <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">I certify that the above information is accurate and complete to the best of my knowledge. I understand that providing incorrect information can be dangerous to my health. I authorize the dental staff to perform the necessary dental services.</p>
            <label className="mb-4 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" {...register('consent_acknowledged')} /> I have read and agree to the declaration above. <span className="text-red-600">*</span></label>
            {errors.consent_acknowledged && <p className="mb-2 text-xs text-red-600">{errors.consent_acknowledged.message}</p>}
            <Field label="Patient digital signature" required error={errors.consent_signature?.message}>
              <SignaturePad value={signature || ''} onChange={(v) => setValue('consent_signature', v, { shouldValidate: true, shouldDirty: true })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Btn type="button" variant="secondary" onClick={() => navigate('/patients')}>Cancel</Btn><Btn type="submit" loading={isSubmitting}>Register patient</Btn></div>
        </Card>
      </form>
    </div>
  );
}

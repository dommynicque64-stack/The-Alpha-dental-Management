import { useState, useEffect } from 'react';
import { Save, Upload, Palette, Image as ImageIcon } from 'lucide-react';
import { apiFetch } from '../lib/helpers';
import supabase from '../lib/supabase';
import { Card, PageHeader, Btn, Field, Input, Textarea, Spinner } from '../components/ui';

const FIELDS: { key: string; label: string; type?: string; textarea?: boolean; hint?: string }[] = [
  { key: 'clinic_name', label: 'Clinic name' },
  { key: 'software_name', label: 'Software name', hint: 'Shown in the login screen, header and sidebar.' },
  { key: 'clinic_address', label: 'Address', textarea: true },
  { key: 'clinic_phone', label: 'Phone' },
  { key: 'clinic_email', label: 'Email', type: 'email' },
  { key: 'working_hours', label: 'Working hours' },
  { key: 'currency', label: 'Currency' },
  { key: 'appointment_slot_minutes', label: 'Default slot (minutes)', type: 'number' },
  { key: 'mpesa_paybill', label: 'M-Pesa Paybill / configuration' },
  { key: 'sms_reminders', label: 'SMS reminders', hint: 'Module hook for future SMS provider integration.' },
];

const THEMES = [
  { id: 'original', name: 'Theme 1 – Original', description: 'Keep the current DentalCare teal and blue design.' },
  { id: 'purple-pink', name: 'Theme 2 – Purple and Pink', description: 'Purple navigation, white content and pink accents. No gradients.' },
  { id: 'pink-white', name: 'Theme 3 – Pink and White', description: 'Clean pink and white interface with strong contrast.' },
  { id: 'purple-sky', name: 'Theme 4 – Purple and Sky Blue', description: 'Professional purple and sky-blue interface.' },
];

function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme || 'purple-pink';
}

export default function Settings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    apiFetch('/api/settings')
      .then((d) => {
        const next = (d as Record<string, string>) || {};
        setValues(next);
        applyTheme(next.theme || 'purple-pink');
      })
      .catch((e) => setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Failed to load' }))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const d = await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(values) });
      const next = (d as Record<string, string>) || {};
      setValues(next); applyTheme(next.theme || 'purple-pink');
      setMsg({ type: 'ok', text: 'Settings saved successfully.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally { setSaving(false); }
  };

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) { setMsg({ type: 'err', text: 'Please select an image file.' }); return; }
    if (file.size > 2 * 1024 * 1024) { setMsg({ type: 'err', text: 'Logo must be 2 MB or smaller.' }); return; }
    setUploading(true); setMsg(null);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(file);
      });
      const up = await apiFetch('/api/upload', { method: 'POST', body: JSON.stringify({ fileName: file.name, fileBase64: b64, contentType: file.type, assetType: 'clinic-logo' }) }) as { url: string };
      const next = { ...values, logo_url: up.url };
      setValues(next);
      await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ logo_url: up.url }) });
      setMsg({ type: 'ok', text: 'Logo uploaded. Save changes to keep the rest of your settings.' });
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Logo upload failed' }); }
    finally { setUploading(false); }
  };

  if (loading) return <Spinner label="Loading settings…" />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Clinic Settings" subtitle="Admin only · applies clinic-wide" actions={<Btn onClick={save} loading={saving}><Save className="h-4 w-4" /> Save changes</Btn>} />
      {msg && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{msg.text}</div>}

      <Card className="mb-4 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2"><Palette className="h-5 w-5 text-violet-600" /><div><h2 className="text-sm font-bold text-slate-900">Theme / Appearance</h2><p className="text-xs text-slate-500">Applies across the dashboard, navigation, forms, cards and buttons.</p></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {THEMES.map(t => (
            <button key={t.id} type="button" onClick={() => { setValues(v => ({ ...v, theme: t.id })); applyTheme(t.id); }} className={`rounded-xl border-2 p-4 text-left transition ${values.theme === t.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-slate-900">{t.name}</span>{values.theme === t.id && <span className="text-xs font-bold text-violet-700">Selected</span>}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.description}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4 space-y-4 p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2"><ImageIcon className="h-5 w-5 text-teal-600" /><div><h2 className="text-sm font-bold text-slate-900">Custom software name & logo</h2><p className="text-xs text-slate-500">Brand the system without changing its clinical functionality.</p></div></div>
        <Field label="Software name"><Input value={values.software_name || ''} onChange={e => setValues(v => ({ ...v, software_name: e.target.value }))} placeholder="Alpha Dental Management" /></Field>
        <div>
          <Field label="Custom logo"><Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.currentTarget.value = ''; }} /></Field>
          <p className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP or SVG · maximum 2 MB.</p>
          {values.logo_url && <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3"><img src={values.logo_url} alt="Clinic logo" className="h-16 w-16 rounded-lg bg-slate-50 object-contain" /><span className="text-xs text-slate-500">Current logo</span></div>}
        </div>
      </Card>

      <Card className="mb-4 space-y-3 p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-900">Change your administrator password</h2>
        <p className="text-xs text-slate-500">Update the password for your currently signed-in Supabase account.</p>
        <Field label="New password"><Input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></Field>
        <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></Field>
        <div><Btn loading={passwordBusy} onClick={async () => {
          if (newPassword.length < 8) { setMsg({ type: 'err', text: 'Use at least 8 characters for the new password.' }); return; }
          if (newPassword !== confirmPassword) { setMsg({ type: 'err', text: 'The passwords do not match.' }); return; }
          setPasswordBusy(true);
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          setPasswordBusy(false);
          if (error) setMsg({ type: 'err', text: error.message });
          else { setNewPassword(''); setConfirmPassword(''); setMsg({ type: 'ok', text: 'Your password has been updated.' }); }
        }}>Update password</Btn></div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        {FIELDS.filter(f => f.key !== 'software_name').map((f) => (
          <div key={f.key}>
            <Field label={f.label}>
              {f.textarea ? <Textarea rows={2} value={values[f.key] || ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} /> :
                <Input type={f.type || 'text'} value={values[f.key] || ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />}
            </Field>
            {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
          </div>
        ))}
      </Card>
    </div>
  );
}

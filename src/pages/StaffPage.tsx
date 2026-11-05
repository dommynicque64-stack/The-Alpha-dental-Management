import { useState, useEffect } from 'react';
import { Plus, UserX, UserCheck, KeyRound, Mail } from 'lucide-react';
import { apiFetch } from '../lib/helpers';
import supabase from '../lib/supabase';
import { Card, PageHeader, Btn, Badge, Empty, Spinner, Modal, Field, Input, Select } from '../components/ui';

interface Staff {
  id: number; full_name: string; email: string; role: string;
  phone: string | null; specialty: string | null; status: string;
}

export default function Staff() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ open: boolean; existing?: Staff | null }>({ open: false });
  const [passwordTarget, setPasswordTarget] = useState<Staff | null>(null);

  const fetchRows = async () => {
    setLoading(true); setError('');
    try {
      const d = await apiFetch('/api/staff') as Staff[];
      setRows(d || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRows(); }, []);

  const resetPassword = async (s: Staff) => {
    if (!confirm(`Send a password reset link to ${s.email}?`)) return;
    const { error } = await supabase.auth.resetPasswordForEmail(s.email, { redirectTo: `${window.location.origin}/login` });
    if (error) alert(error.message); else alert(`Password reset email sent to ${s.email}.`);
  };

  const toggle = async (s: Staff) => {
    const to = s.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`${to === 'inactive' ? 'Deactivate' : 'Reactivate'} ${s.full_name}?`)) return;
    try {
      await apiFetch('/api/staff', { method: 'PUT', body: JSON.stringify({ id: s.id, status: to }) });
      fetchRows();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div>
      <PageHeader
        title="Staff Management"
        subtitle="Admin only · roles gate every API route, not just the UI"
        actions={<Btn onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" /> Add Staff</Btn>}
      />
      <Card className="p-4">
        <div className="mb-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <b>How access works:</b> each person signs in with Supabase Auth (email/password or Google). On every API call the server
          verifies the session and requires an <b>Active</b> row in <code className="rounded bg-slate-200 px-1">clinic_staff</code> matched by user id or email.
          Users with no active role get HTTP 403 and cannot use the app.
        </div>
        {loading ? <Spinner /> : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
        ) : rows.length === 0 ? <Empty title="No staff yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="border-b text-xs uppercase text-slate-500">
                <th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Role</th><th className="px-3 py-2.5">Specialty</th>
                <th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold text-slate-800">{s.full_name}<p className="text-xs font-normal text-slate-400">{s.phone || ''}</p></td>
                    <td className="px-3 py-3 text-slate-600">{s.email}</td>
                    <td className="px-3 py-3"><Badge value={s.role} /></td>
                    <td className="px-3 py-3 text-slate-600">{s.specialty || '—'}</td>
                    <td className="px-3 py-3"><Badge value={s.status} /></td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => resetPassword(s)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"><Mail className="h-3.5 w-3.5" /> Reset email</button>
                      <button onClick={() => setPasswordTarget(s)} disabled={s.status !== 'active'} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-40"><KeyRound className="h-3.5 w-3.5" /> Set password</button>
                      <button onClick={() => setModal({ open: true, existing: s })} className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50">Edit</button>
                      <button onClick={() => toggle(s)} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${s.status === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`}>
                        {s.status === 'active' ? <><UserX className="h-3.5 w-3.5" /> Deactivate</> : <><UserCheck className="h-3.5 w-3.5" /> Reactivate</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {modal.open && <StaffModal existing={modal.existing} onClose={() => setModal({ open: false })} onSaved={() => { setModal({ open: false }); fetchRows(); }} />}
      {passwordTarget && <PasswordModal staff={passwordTarget} onClose={() => setPasswordTarget(null)} onSaved={() => setPasswordTarget(null)} />}
    </div>
  );
}

function StaffModal({ existing, onClose, onSaved }: { existing?: Staff | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: existing?.full_name || '', email: existing?.email || '',
    role: existing?.role || 'receptionist', phone: existing?.phone || '',
    specialty: existing?.specialty || '', status: existing?.status || 'active',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim()) { setError('Name and email are required.'); return; }
    setBusy(true); setError('');
    try {
      if (existing) await apiFetch('/api/staff', { method: 'PUT', body: JSON.stringify({ id: existing.id, ...form }) });
      else await apiFetch('/api/staff', { method: 'POST', body: JSON.stringify(form) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); } finally { setBusy(false); }
  };

  return (
    <Modal title={existing ? 'Edit staff member' : 'Add staff member'} onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}
        {!existing && (
          <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800">
Creates the staff profile and sends a Supabase invitation email. The staff member follows the secure link to set their password.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name *"><Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
          <Field label="Email *"><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={!!existing} /></Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="admin">Admin — full access</option>
              <option value="dentist">Dentist — clinical</option>
              <option value="receptionist">Receptionist — front desk + billing</option>
              <option value="accountant">Accountant — billing & reports</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Specialty"><Input value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="e.g. Orthodontics" /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} loading={busy}>Save</Btn>
        </div>
      </div>
    </Modal>
  );
}


function PasswordModal({ staff, onClose, onSaved }: { staff: Staff; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setError('');
    if (password.length < 10) { setError('Use at least 10 characters.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    if (!confirm(`Change the sign-in password for ${staff.full_name}? They should be informed securely.`)) return;
    setBusy(true);
    try {
      await apiFetch('/api/staff', { method: 'PUT', body: JSON.stringify({ action: 'set_password', id: staff.id, password }) });
      alert(`Password updated for ${staff.full_name}.`);
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Password update failed.'); }
    finally { setBusy(false); }
  };
  return <Modal title={`Set password — ${staff.full_name}`} onClose={onClose}>
    <div className="space-y-3">
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">This immediately changes the staff member’s Supabase Auth password. Share the new password through a secure channel, not email or chat.</p>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <Field label="New password (minimum 10 characters)"><Input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></Field>
      <Field label="Confirm new password"><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" /></Field>
      <div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={save} loading={busy}>Update password</Btn></div>
    </div>
  </Modal>;
}

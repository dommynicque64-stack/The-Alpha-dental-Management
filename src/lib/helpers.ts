import supabase from './supabase';

export type Role = 'admin' | 'dentist' | 'receptionist' | 'accountant';

export interface StaffProfile {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  status: string;
  specialty: string | null;
  phone: string | null;
}

const PERMS: Record<Role, string[]> = {
  admin: ['*'],
  dentist: ['dashboard', 'patients', 'appointments', 'clinical', 'treatments'],
  receptionist: ['dashboard', 'patients', 'appointments', 'payments', 'clinical-read'],
  accountant: ['dashboard', 'patients-read', 'appointments-read', 'billing', 'reports'],
};

export function canAccess(role: Role | null | undefined, key: string): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  const perms = PERMS[role] || [];
  if (perms.includes(key)) return true;
  // Route-level aliases: read-only roles may still open list/detail routes.
  if (key === 'patients' && perms.includes('patients-read')) return true;
  if (key === 'appointments' && perms.includes('appointments-read')) return true;
  if (key === 'treatments' && (perms.includes('clinical-read') || perms.includes('clinical'))) return true;
  if (key === 'clinical' && perms.includes('clinical-read')) return true;
  return false;
}

export function canWriteClinical(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'dentist';
}

export function canWriteBilling(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'accountant';
}

export function canRecordPayments(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'accountant' || role === 'receptionist';
}

export function canManageStaff(role: Role | null | undefined): boolean {
  return role === 'admin';
}

export function canViewReports(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'accountant';
}

/** Authenticated fetch helper: attaches the Supabase session token. */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((options.headers as Record<string, string>) || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export function formatKES(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  return `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function calcAge(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return `${age} yrs`;
}

export const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-sky-100 text-sky-800',
  confirmed: 'bg-teal-100 text-teal-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-600',
  no_show: 'bg-orange-100 text-orange-800',
  active: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-200 text-slate-600',
  inactive: 'bg-slate-200 text-slate-600',
  paid: 'bg-emerald-100 text-emerald-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  unpaid: 'bg-red-100 text-red-700',
  overdue: 'bg-red-100 text-red-700',
  open: 'bg-sky-100 text-sky-800',
  closed: 'bg-emerald-100 text-emerald-800',
  planned: 'bg-slate-100 text-slate-700',
};

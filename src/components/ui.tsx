import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,46,52,0.05)] ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean };

export function Btn({ variant = 'primary', loading, children, className = '', disabled, ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none';
  const styles: Record<string, string> = {
    primary: 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ value }: { value?: string | null }) {
  const v = value || '—';
  const map: Record<string, string> = {
    scheduled: 'bg-sky-100 text-sky-800', confirmed: 'bg-teal-100 text-teal-800',
    in_progress: 'bg-amber-100 text-amber-800', completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-slate-200 text-slate-600', no_show: 'bg-orange-100 text-orange-800',
    active: 'bg-emerald-100 text-emerald-800', archived: 'bg-slate-200 text-slate-600', inactive: 'bg-slate-200 text-slate-600',
    paid: 'bg-emerald-100 text-emerald-800', partially_paid: 'bg-amber-100 text-amber-800',
    unpaid: 'bg-red-100 text-red-700', overdue: 'bg-red-100 text-red-700',
    open: 'bg-sky-100 text-sky-800', closed: 'bg-emerald-100 text-emerald-800', planned: 'bg-slate-100 text-slate-700',
    admin: 'bg-violet-100 text-violet-800', dentist: 'bg-teal-100 text-teal-800',
    receptionist: 'bg-sky-100 text-sky-800', accountant: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[v] || 'bg-slate-100 text-slate-700'}`}>
      {v.replaceAll('_', ' ')}
    </span>
  );
}

export function Field({ label, error, children, required }: { label: string; error?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className || ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className || ''}`} />;
}

export function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-teal-700">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6 slim-scroll`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

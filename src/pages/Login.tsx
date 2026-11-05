import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Stethoscope, Loader2, Eye, EyeOff } from 'lucide-react';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/helpers';

const schema = z.object({
  email: z.string().email('Enter a valid email address').or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'update'>('signin');
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState('');
  const [serverInfo, setServerInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [branding, setBranding] = useState<Record<string, string>>({});

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    apiFetch('/api/public-settings').then((d) => {
      const b = (d as Record<string, string>) || {};
      setBranding(b);
      document.documentElement.dataset.theme = b.theme || 'original';
    }).catch(() => {});
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (mounted && event === 'PASSWORD_RECOVERY') {
        setMode('update');
        setServerError('');
        setServerInfo('Choose a new password for your account.');
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (data: FormData) => {
    setServerError(''); setServerInfo(''); setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: data.email, password: data.password });
        if (error) throw error;
        setServerInfo('Account created. If email confirmation is enabled, check your inbox — otherwise you can sign in now. An administrator must assign you an active staff role before you can use the app.');
      } else if (mode === 'update') {
        const { error } = await supabase.auth.updateUser({ password: data.password });
        if (error) throw error;
        await supabase.auth.signOut();
        setMode('signin');
        setServerInfo('Password updated successfully. Sign in with your new password.');
      } else {
        if (!data.email) throw new Error('Enter your email address.');
        const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
        if (error) throw error;
        await refresh();
        navigate('/');
      }
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    const email = getValues('email');
    if (!email) { setServerError('Enter your email address first, then click “Send reset link”.'); return; }
    setServerError(''); setServerInfo(''); setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
      if (error) throw error;
      setServerInfo('Password reset link sent. Check your inbox.');
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  const onGoogleSignIn = async () => {
    setServerError('');
    setServerInfo('');
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Google sign-in failed');
      setGoogleBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f6f9fb]">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-teal-900 p-10 text-white lg:flex">
        <img src="/alpha-dental-landing.jpg" alt="Dental care professional with a young patient" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-teal-950/65" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/15"><img src={branding.logo_url || "/alpha-dental-logo.png"} alt="Alpha Dental Management" className="h-full w-full object-contain bg-white" /></div>
          <div>
            <p className="text-xl font-extrabold">{branding.software_name || 'Alpha Dental Management'}</p>
            <p className="text-xs text-teal-100">Dental Clinic Management</p>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="max-w-md text-4xl font-extrabold leading-tight">Modern dental care, beautifully managed.</h1>
          <p className="mt-4 max-w-md text-teal-100">Patients, appointments, odontograms, treatments, billing and reports — one secure workspace for your whole clinic team.</p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3 text-center">
            {[
              ['RBAC', '4 staff roles'],
              ['RLS', 'Row security'],
              ['Audit', 'Full trail'],
              ['Clinic', branding.clinic_name || 'Add clinic name in Settings'],
            ].map(([a, b]) => (
              <div key={a} className="rounded-xl bg-white/10 p-3">
                <p className="text-lg font-extrabold">{a}</p>
                <p className="text-xs text-teal-100">{b}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-teal-100">© 2026 Alpha Dental Management · Secure clinic workflows</p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-teal-600 text-white"><img src={branding.logo_url || "/alpha-dental-logo.png"} alt="Alpha Dental Management" className="h-full w-full object-contain bg-white" /></div>
            <p className="text-lg font-extrabold text-slate-900">{branding.software_name || 'Alpha Dental Management'}</p>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {mode === 'signin' && 'Welcome back'}
            {mode === 'signup' && 'Create staff account'}
            {mode === 'reset' && 'Reset password'}
            {mode === 'update' && 'Choose a new password'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'signin' && 'Sign in to access your clinic workspace.'}
            {mode === 'signup' && 'New here? Create an account, then ask your admin for a role.'}
            {mode === 'reset' && 'We’ll email you a secure reset link.'}
            {mode === 'update' && 'Set a new password to regain access to your account.'}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {mode !== 'update' && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
                <input {...register('email')} type="email" placeholder="you@clinic.com" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" />
                {errors.email && <p className="mt-1 text-xs font-medium text-red-600">{errors.email.message}</p>}
              </div>
            )}
            {mode !== 'reset' && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
                <div className="relative">
                  <input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="••••••••" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs font-medium text-red-600">{errors.password.message}</p>}
              </div>
            )}
            {serverError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{serverError}</div>}
            {serverInfo && <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm font-medium text-teal-800">{serverInfo}</div>}

            {mode === 'reset' ? (
              <button type="button" onClick={onReset} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link
              </button>
            ) : (
              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'update' ? 'Update password' : 'Create account'}
              </button>
            )}
          </form>

          {mode !== 'update' && (
            <>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
          </div>
          <button onClick={onGoogleSignIn} disabled={googleBusy} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" /><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.5 24 12 24z" /><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.2 0 12s.5 3.3 1.4 4.7l3.8-2.3z" /><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.7l3.8 2.9c1-2.8 3.7-4.9 6.8-4.9z" /></svg>
            {googleBusy ? 'Opening Google…' : 'Sign in / sign up with Google'}
          </button>
            </>
          )}

          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            {mode === 'signin' ? (
              <>
                <button onClick={() => setMode('signup')} className="font-semibold text-teal-700 hover:underline">Create account</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setMode('reset')} className="font-semibold text-teal-700 hover:underline">Forgot password?</button>
              </>
            ) : mode === 'update' ? null : (
              <button onClick={() => { setMode('signin'); setServerError(''); setServerInfo(''); }} className="font-semibold text-teal-700 hover:underline">Back to sign in</button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

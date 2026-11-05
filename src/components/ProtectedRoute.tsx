import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from '../lib/helpers';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function ProtectedRoute({ children, perm }: { children: ReactNode; perm?: string }) {
  const { user, staff, loading, authError } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9fb]">
        <div className="flex flex-col items-center gap-3 text-teal-700">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Loading Alpha Dental Management…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  // Authenticated but no active role in clinic_staff -> blocked screen (not app access)
  if (!staff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9fb] p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <ShieldAlert className="h-6 w-6 text-amber-700" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Access pending</h1>
          <p className="mt-2 text-sm text-slate-600">
            {authError || 'Your account has no active staff role. Please contact your clinic administrator to assign you a role.'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Signed in as {user.email}</p>
          <a href="/login" onClick={(e) => { e.preventDefault(); window.location.href = '/login'; }} className="mt-6 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }
  if (perm && !canAccess(staff.role, perm)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

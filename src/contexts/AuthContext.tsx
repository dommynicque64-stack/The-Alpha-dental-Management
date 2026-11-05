import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import supabase from '../lib/supabase';
import { apiFetch, type StaffProfile } from '../lib/helpers';

interface AuthCtx {
  user: { id: string; email?: string } | null;
  staff: StaffProfile | null;
  session: unknown;
  loading: boolean;
  authError: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, staff: null, session: null, loading: true, authError: null, refresh: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthCtx['user']>(null);
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [session, setSession] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      if (!s?.user) { setUser(null); setStaff(null); return; }
      setUser({ id: s.user.id, email: s.user.email });
      try {
        const data = await apiFetch('/api/auth') as { staff: StaffProfile };
        setStaff(data.staff);
      } catch (e) {
        setStaff(null);
        setAuthError(e instanceof Error ? e.message : 'Access denied');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s?.user) { setUser(null); setStaff(null); setLoading(false); return; }
      setUser({ id: s.user.id, email: s.user.email });
      apiFetch('/api/auth')
        .then((d) => { setStaff((d as { staff: StaffProfile }).staff); setAuthError(null); })
        .catch((e) => { setStaff(null); setAuthError(e instanceof Error ? e.message : 'Access denied'); })
        .finally(() => setLoading(false));
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setStaff(null); setSession(null); setAuthError(null);
  };

  return <Ctx.Provider value={{ user, staff, session, loading, authError, refresh: loadProfile, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

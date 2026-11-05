import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, Receipt, BarChart3,
  UsersRound, Settings as SettingsIcon, Menu, X, Bell, Search, LogOut, Stethoscope as LogoIcon, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, canAccess } from '../lib/helpers';
import supabase from '../lib/supabase';
import InstallAppButton from './InstallAppButton';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard', end: true },
  { to: '/patients', label: 'Patients', icon: Users, perm: 'patients' },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, perm: 'appointments' },
  { to: '/treatments', label: 'Treatments', icon: Stethoscope, perm: 'treatments' },
  { to: '/billing', label: 'Billing', icon: Receipt, perm: 'billing' },
  { to: '/payments', label: "Today's Payments", icon: Receipt, perm: 'payments' },
  { to: '/reports', label: 'Reports', icon: BarChart3, perm: 'reports' },
  { to: '/staff', label: 'Staff', icon: UsersRound, perm: '__admin__' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, perm: '__admin__' },
];

interface Notif { id: number; title: string; message: string; type: string; is_read: boolean; created_at: string; }

export default function Layout() {
  const { staff, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: number; first_name: string; last_name: string; phone: string }[]>([]);
  const [searchFocus, setSearchFocus] = useState(false);
  const [branding, setBranding] = useState<Record<string, string>>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const role = staff?.role || null;
  const isAdmin = role === 'admin';

  const visibleNav = NAV.filter((n) => {
    if (n.perm === '__admin__') return isAdmin;
    return canAccess(role, n.perm);
  });

  const fetchNotifs = async () => {
    try {
      const d = await apiFetch('/api/notifications') as { rows: Notif[]; unread: number };
      setNotifs(d.rows || []);
      setUnread(d.unread || 0);
    } catch { /* silent */ }
  };

  useEffect(() => {
    apiFetch('/api/public-settings').then((d) => setBranding((d as Record<string, string>) || {})).catch(() => {});
    fetchNotifs();
    const t = setInterval(fetchNotifs, 60000);
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => { clearInterval(t); document.removeEventListener('mousedown', onClick); };
  }, []);

  const onSearch = (v: string) => {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!v.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const d = await apiFetch(`/api/patients?search=${encodeURIComponent(v)}&limit=6&status=all`) as { rows: typeof results };
        setResults(d.rows || []);
      } catch { setResults([]); }
    }, 300);
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications', { method: 'PUT', body: JSON.stringify({ markAll: true }) });
      fetchNotifs();
    } catch { /* noop */ }
  };

  const doSignOut = async () => {
    await supabase.auth.signOut();
    await signOut();
    navigate('/login');
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${isActive ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800'}`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-teal-600 text-white shadow-sm">
          <img src={branding.logo_url || '/alpha-dental-logo.png'} alt="Alpha Dental Management" className="h-full w-full object-contain bg-white" />
        </div>
        <div>
          <p className="text-base font-extrabold tracking-tight text-slate-900">{branding.software_name || 'Alpha Dental Management'}</p>
          <p className="text-[11px] font-medium text-slate-500">Clinic Management</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 slim-scroll">
        {visibleNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={linkCls} onClick={() => setMobileOpen(false)}>
            <n.icon className="h-[18px] w-[18px]" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="rounded-xl bg-teal-50 p-3">
          <p className="truncate text-sm font-bold text-slate-900">{staff?.full_name}</p>
          <p className="text-xs capitalize text-teal-700">{staff?.role} · {staff?.specialty || 'Staff'}</p>
        </div>
        <button onClick={doSignOut} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f9fb]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top navigation */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">
            <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            {/* Global patient search */}
            <div className="relative flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
                placeholder="Search patients by name, phone, email…"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              {searchFocus && query.trim() && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {results.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500">No patients found.</p>
                  ) : (
                    results.map((r) => (
                      <button
                        key={r.id}
                        onMouseDown={() => { setQuery(''); setResults([]); navigate(`/patients/${r.id}`); }}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-teal-50"
                      >
                        <span className="font-semibold text-slate-800">{r.first_name} {r.last_name}</span>
                        <span className="text-xs text-slate-500">{r.phone}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <InstallAppButton />
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button onClick={() => setShowNotifs((s) => !s)} className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-bold text-slate-900">Notifications</p>
                      <button onClick={markAllRead} className="text-xs font-semibold text-teal-700 hover:underline">Mark all read</button>
                    </div>
                    <div className="max-h-80 overflow-y-auto slim-scroll">
                      {notifs.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications.</p>}
                      {notifs.map((n) => (
                        <div key={n.id} className={`border-b border-slate-50 px-4 py-3 ${n.is_read ? '' : 'bg-teal-50/50'}`}>
                          <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                          <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* User */}
              <div className="relative">
                <button onClick={() => setShowUser((s) => !s)} onBlur={() => setTimeout(() => setShowUser(false), 200)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-teal-600 text-xs font-bold text-white">
                    {branding.logo_url ? <img src={branding.logo_url} alt="" className="h-full w-full object-contain bg-white" /> : (staff?.full_name || user?.email || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="hidden text-left md:block">
                    <p className="max-w-[140px] truncate text-xs font-bold text-slate-900">{staff?.full_name}</p>
                    <p className="text-[11px] capitalize text-slate-500">{staff?.role}</p>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
                </button>
                {showUser && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    <div className="border-b border-slate-100 px-4 py-2.5">
                      <p className="truncate text-sm font-bold text-slate-900">{staff?.full_name}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email}</p>
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700">{staff?.role}</p>
                    </div>
                    {isAdmin && (
                      <button onMouseDown={() => navigate('/settings')} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Clinic settings</button>
                    )}
                    <button onMouseDown={doSignOut} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Mobile nav quick links */}
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 lg:hidden slim-scroll">
            {visibleNav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${isActive ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                <n.icon className="h-3.5 w-3.5" />{n.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
      {mobileOpen && <button className="fixed right-4 top-4 z-50 rounded-full bg-white p-2 shadow-lg lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>}
    </div>
  );
}

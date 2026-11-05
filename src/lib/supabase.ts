import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
) || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

if (!url || !publishableKey) {
  throw new Error(
    'Missing Supabase browser configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Netlify.'
  );
}

const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;

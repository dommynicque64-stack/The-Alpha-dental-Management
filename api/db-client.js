import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  throw new Error('Missing server Supabase configuration. Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
}

// This client is server-only. The secret key bypasses RLS, so every request
// must pass through requireAuth() and the role checks before data access.
const supabase = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

export default supabase;

import supabase from './supabase';

export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/login`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
}

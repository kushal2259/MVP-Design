import { createClient } from '@supabase/supabase-js';

// The anon (public) key is safe to expose in the browser — Row Level Security
// policies on the database protect the actual data.
// Exported so server-side API routes can reuse the same values (they fall back
// to these literals when the NEXT_PUBLIC_* env vars aren't set on the server).
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rorzdrwngbixncqzuzue.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcnpkcnduZ2JpeG5jcXp1enVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzM4NDYsImV4cCI6MjA5NjM0OTg0Nn0.TAB4RTheSE0SbjP_j1czHNLD8MYCiQgnY9Bh58kLlRk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

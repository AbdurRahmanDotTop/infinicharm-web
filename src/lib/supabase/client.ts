import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ziafauuodnmktzmsjpka.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_8Up2lFm0QMVuqdc5PLRhTQ_oUB3ccJK';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}


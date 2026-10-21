import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

/** Client Supabase tạo lười từ biến môi trường; null nếu thiếu cấu hình. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  } catch {
    client = null;
  }
  return client;
}

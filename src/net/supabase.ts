import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Khóa localStorage của phiên đăng nhập (riêng cho game, không đụng app khác). */
export const AUTH_STORAGE_KEY = 'ps.auth';

let client: SupabaseClient | null | undefined;

/** Client Supabase tạo lười từ biến môi trường; null nếu thiếu cấu hình. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    // Phiên đăng nhập gắn vào chính client này nên các RPC ps_* chạy với role `authenticated`.
    // Nếu localStorage bị chặn, supabase-js tự dùng bộ nhớ tạm (đăng nhập chỉ sống trong phiên).
    client =
      url && key
        ? createClient(url, key, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: AUTH_STORAGE_KEY },
          })
        : null;
  } catch {
    client = null;
  }
  return client;
}

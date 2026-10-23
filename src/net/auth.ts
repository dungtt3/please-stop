import { sanitizeName } from '../settings/sanitizeName';
import { withTimeout } from './cloud';
import { getSupabase } from './supabase';

export type Provider = 'google';
/** Danh sách nhà cung cấp đăng nhập ở một chỗ; thêm 'facebook' sau chỉ là thêm một phần tử. */
export const PROVIDERS: readonly Provider[] = ['google'];
export const PROVIDER_LABEL: Record<Provider, string> = { google: 'Đăng nhập bằng Google' };

export interface Account {
  userId: string;
  name: string;
}

const FALLBACK_NAME = 'Người chơi';

function cleanName(v: unknown): string {
  return typeof v === 'string' ? sanitizeName(v) : '';
}

/** Tên hiển thị: full_name, rồi name, rồi phần trước @ của email, cuối cùng 'Người chơi'. */
export function accountFromUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }): Account {
  const meta = u.user_metadata ?? {};
  const name =
    cleanName(meta.full_name) ||
    cleanName(meta.name) ||
    cleanName(typeof u.email === 'string' ? u.email.split('@')[0] : '') ||
    FALLBACK_NAME;
  return { userId: u.id, name };
}

export function authAvailable(): boolean {
  return getSupabase() !== null;
}

/** Tài khoản đang đăng nhập (đọc từ phiên đã lưu); không có hoặc lỗi thì null. */
export async function currentAccount(): Promise<Account | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await withTimeout(() => sb.auth.getSession());
    if (error || !data.session) return null;
    return accountFromUser(data.session.user);
  } catch {
    return null;
  }
}

/** Bắt đầu đăng nhập OAuth (trình duyệt chuyển trang). false nếu không bắt đầu được. */
export async function signIn(p: Provider): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await withTimeout(() =>
      sb.auth.signInWithOAuth({
        provider: p,
        options: { redirectTo: window.location.origin + window.location.pathname },
      }),
    );
    return !error;
  } catch {
    return false;
  }
}

/** Đăng xuất khỏi trình duyệt này (không đăng xuất các thiết bị khác); lỗi bỏ qua. */
export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await withTimeout(() => sb.auth.signOut({ scope: 'local' }));
  } catch {
    /* bỏ qua: phiên cục bộ vẫn bị xóa ở lần tải sau nếu hết hạn */
  }
}

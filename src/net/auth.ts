import { browserStore, type KeyValueStore } from '../settings/configStore';
import { sanitizeName } from '../settings/sanitizeName';
import { withTimeout } from './cloud';
import { AUTH_STORAGE_KEY, getSupabase } from './supabase';

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

/** Tài khoản của lần mở game gần nhất có phiên, để vẫn nhận ra người chơi khi offline. */
export const LAST_ACCOUNT_KEY = 'ps.lastAccount';

function rememberAccount(store: KeyValueStore | null, a: Account): void {
  try {
    store?.setItem(LAST_ACCOUNT_KEY, JSON.stringify(a));
  } catch {
    /* bỏ qua */
  }
}

export function forgetAccount(store: KeyValueStore | null): void {
  try {
    store?.removeItem(LAST_ACCOUNT_KEY);
  } catch {
    /* bỏ qua */
  }
}

/** Tài khoản đã nhớ, chỉ khi phiên đăng nhập vẫn còn lưu trong máy (và không thuộc người khác). */
function storedAccount(store: KeyValueStore | null): Account | null {
  try {
    const session = store?.getItem(AUTH_STORAGE_KEY);
    const raw = store?.getItem(LAST_ACCOUNT_KEY);
    if (!session || !raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { userId, name } = v as Record<string, unknown>;
    if (typeof userId !== 'string' || !userId || typeof name !== 'string') return null;
    let sessionUser: unknown;
    try {
      sessionUser = (JSON.parse(session) as { user?: { id?: unknown } } | null)?.user?.id;
    } catch {
      sessionUser = undefined;
    }
    if (typeof sessionUser === 'string' && sessionUser !== userId) return null;
    return { userId, name: cleanName(name) || FALLBACK_NAME };
  } catch {
    return null;
  }
}

/**
 * Kết quả getSession → tài khoản. `'error'` = lỗi hoặc hết giờ (vd offline nên không làm mới được token
 * hết hạn): nếu phiên vẫn còn trong máy thì dùng tài khoản đã nhớ, để chơi bằng bản lưu trên máy.
 */
export function resolveAccount(
  res: { user: Parameters<typeof accountFromUser>[0] } | null | 'error',
  store: KeyValueStore | null,
): Account | null {
  if (res === 'error') return storedAccount(store);
  if (!res) {
    forgetAccount(store);
    return null;
  }
  const a = accountFromUser(res.user);
  rememberAccount(store, a);
  return a;
}

/** Tài khoản đang đăng nhập (đọc từ phiên đã lưu); không có thì null (xem `resolveAccount` khi lỗi). */
export async function currentAccount(): Promise<Account | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const store = browserStore();
  try {
    const { data, error } = await withTimeout(() => sb.auth.getSession());
    return resolveAccount(error ? 'error' : data.session, store);
  } catch {
    return resolveAccount('error', store);
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
  forgetAccount(browserStore());
  try {
    await withTimeout(() => sb.auth.signOut({ scope: 'local' }));
  } catch {
    /* bỏ qua: phiên cục bộ vẫn bị xóa ở lần tải sau nếu hết hạn */
  }
}

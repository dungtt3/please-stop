import { LAST_ACCOUNT_KEY, accountFromUser, forgetAccount, resolveAccount } from '../../src/net/auth';
import { AUTH_STORAGE_KEY } from '../../src/net/supabase';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map<string, string>(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const bad = {
  getItem: (): string | null => { throw new Error('blocked'); },
  setItem: (): void => { throw new Error('blocked'); },
  removeItem: (): void => { throw new Error('blocked'); },
};

test.each([
  [{ id: 'u', user_metadata: { full_name: '  Nguyễn   Văn A ' } }, 'Nguyễn Văn A'],
  [{ id: 'u', user_metadata: { name: 'Bee' } }, 'Bee'],
  [{ id: 'u', email: 'dung@x.vn', user_metadata: {} }, 'dung'],
  [{ id: 'u', user_metadata: { full_name: 42 } }, 'Người chơi'],
  [{ id: 'u', user_metadata: { full_name: 'x'.repeat(40) } }, 'x'.repeat(20)],
  [{ id: 'u', user_metadata: { full_name: '   ', name: 'Bee' } }, 'Bee'],
  [{ id: 'u', email: null, user_metadata: null }, 'Người chơi'],
])('accountFromUser %#', (u, name) => expect(accountFromUser(u)).toEqual({ userId: 'u', name }));

describe('resolveAccount (mở game khi đã đăng nhập, có thể offline)', () => {
  const session = { user: { id: 'u1', user_metadata: { full_name: 'Bee' } } };
  const stored = JSON.stringify({ access_token: 'x', user: { id: 'u1' } });

  test('khóa lưu trữ dùng tiền tố ps.', () => {
    expect(LAST_ACCOUNT_KEY).toBe('ps.lastAccount');
    expect(AUTH_STORAGE_KEY).toBe('ps.auth');
  });

  test('có phiên → tài khoản, và nhớ lại tài khoản đó', () => {
    const store = mem();
    expect(resolveAccount(session, store)).toEqual({ userId: 'u1', name: 'Bee' });
    expect(JSON.parse(store.getItem(LAST_ACCOUNT_KEY) ?? 'null')).toEqual({ userId: 'u1', name: 'Bee' });
  });

  test('getSession lỗi/hết giờ nhưng phiên vẫn lưu trong máy → tài khoản đã nhớ', () => {
    const store = mem({ [AUTH_STORAGE_KEY]: stored });
    resolveAccount(session, store);
    expect(resolveAccount('error', store)).toEqual({ userId: 'u1', name: 'Bee' });
  });

  test('lỗi mà không còn phiên trong máy → khách', () => {
    const store = mem();
    resolveAccount(session, store);
    expect(resolveAccount('error', store)).toBeNull();
  });

  test('lỗi, còn phiên nhưng chưa từng nhớ tài khoản → khách', () => {
    expect(resolveAccount('error', mem({ [AUTH_STORAGE_KEY]: stored }))).toBeNull();
  });

  test('phiên trong máy thuộc người khác → khách', () => {
    const store = mem({ [AUTH_STORAGE_KEY]: JSON.stringify({ user: { id: 'other' } }) });
    resolveAccount(session, store);
    expect(resolveAccount('error', store)).toBeNull();
  });

  test('tài khoản đã nhớ bị hỏng → khách', () => {
    for (const v of ['{oops', '{"userId":5,"name":"a"}', '{"userId":"","name":"a"}', '{"userId":"u1"}', '[]']) {
      expect(resolveAccount('error', mem({ [AUTH_STORAGE_KEY]: stored, [LAST_ACCOUNT_KEY]: v }))).toBeNull();
    }
  });

  test('không có phiên (không lỗi) → khách và quên tài khoản cũ', () => {
    const store = mem({ [AUTH_STORAGE_KEY]: stored });
    resolveAccount(session, store);
    expect(resolveAccount(null, store)).toBeNull();
    expect(store.getItem(LAST_ACCOUNT_KEY)).toBeNull();
  });

  test('đăng xuất quên tài khoản đã nhớ', () => {
    const store = mem({ [AUTH_STORAGE_KEY]: stored });
    resolveAccount(session, store);
    forgetAccount(store);
    expect(resolveAccount('error', store)).toBeNull();
  });

  test('store bị chặn hoặc không có → không ném', () => {
    for (const store of [bad, null]) {
      expect(resolveAccount(session, store)).toEqual({ userId: 'u1', name: 'Bee' });
      expect(resolveAccount('error', store)).toBeNull();
      expect(() => forgetAccount(store)).not.toThrow();
    }
  });
});

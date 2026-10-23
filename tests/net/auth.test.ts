import { accountFromUser } from '../../src/net/auth';

test.each([
  [{ id: 'u', user_metadata: { full_name: '  Nguyễn   Văn A ' } }, 'Nguyễn Văn A'],
  [{ id: 'u', user_metadata: { name: 'Bee' } }, 'Bee'],
  [{ id: 'u', email: 'dung@x.vn', user_metadata: {} }, 'dung'],
  [{ id: 'u', user_metadata: { full_name: 42 } }, 'Người chơi'],
  [{ id: 'u', user_metadata: { full_name: 'x'.repeat(40) } }, 'x'.repeat(20)],
  [{ id: 'u', user_metadata: { full_name: '   ', name: 'Bee' } }, 'Bee'],
  [{ id: 'u', email: null, user_metadata: null }, 'Người chơi'],
])('accountFromUser %#', (u, name) => expect(accountFromUser(u)).toEqual({ userId: 'u', name }));

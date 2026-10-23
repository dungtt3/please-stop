import { DEFAULT_CONFIG, type GameConfig } from '../config';
import type { CloudConfigFetch } from '../net/cloud';
import { resolveConfig } from '../settings/resolveConfig';

export type AdminView =
  | { kind: 'gate'; error: null | 'wrong' | 'offline' }
  | { kind: 'loadError' }
  | { kind: 'menu'; config: GameConfig; cloudConfig: GameConfig | null; updatedAt: string | null; note: string | null };

export const EMPTY_NOTE = 'Cloud chưa có cấu hình — đang hiện giá trị mặc định';

function viewFromFetch(f: CloudConfigFetch): AdminView {
  if (f.kind === 'error') return { kind: 'loadError' };
  if (f.kind === 'empty') {
    return { kind: 'menu', config: structuredClone(DEFAULT_CONFIG), cloudConfig: null, updatedAt: null, note: EMPTY_NOTE };
  }
  const r = resolveConfig({ cloud: f.config });
  const note = r.errors.length
    ? `Cấu hình cloud có ${r.errors.length} trường lỗi — đã dùng giá trị mặc định cho các trường đó: ${r.errors.join('; ')}`
    : null;
  return { kind: 'menu', config: r.config, cloudConfig: structuredClone(r.config), updatedAt: f.updatedAt, note };
}

/** Kiểm mã rồi tải cấu hình cloud. Không có menu nếu chưa tải được cấu hình. */
export async function unlockAdmin(
  code: string,
  deps: { check(code: string): Promise<'ok' | 'wrong' | 'offline'>; fetch(): Promise<CloudConfigFetch> },
): Promise<AdminView> {
  const c = await deps.check(code);
  if (c !== 'ok') return { kind: 'gate', error: c };
  return viewFromFetch(await deps.fetch());
}

export async function reloadAdmin(deps: { fetch(): Promise<CloudConfigFetch> }): Promise<AdminView> {
  return viewFromFetch(await deps.fetch());
}

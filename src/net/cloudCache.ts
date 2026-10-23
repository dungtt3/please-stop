import { fetchActiveConfig } from './cloud';

export interface CloudSnapshot {
  config: unknown;
  updatedAt: string;
}

let cached: CloudSnapshot | null = null;

export const getCloudCache = (): CloudSnapshot | null => cached;

/** Tải cấu hình cloud mới nhất vào cache; lỗi mạng thì giữ cache cũ. Không bao giờ ném. */
export async function refreshCloudCache(): Promise<CloudSnapshot | null> {
  const r = await fetchActiveConfig();
  if (r.kind === 'ok') cached = { config: r.config, updatedAt: r.updatedAt };
  else if (r.kind === 'empty') cached = null; // cloud đã gỡ cấu hình: về mặc định
  return cached;
}

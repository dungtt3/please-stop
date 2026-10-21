import { fetchActiveConfig } from './cloud';

export interface CloudSnapshot {
  config: unknown;
  updatedAt: string;
}

let cached: CloudSnapshot | null = null;

export const getCloudCache = (): CloudSnapshot | null => cached;

/** Tải cấu hình cloud mới nhất vào cache; lỗi thì giữ cache cũ. Không bao giờ ném. */
export async function refreshCloudCache(): Promise<CloudSnapshot | null> {
  const r = await fetchActiveConfig();
  if (r) cached = r;
  return cached;
}

/** Xóa cache (sau khi gỡ cấu hình cloud) để ván sau về mặc định ngay. */
export function clearCloudCache(): void {
  cached = null;
}

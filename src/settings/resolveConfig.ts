import { DEFAULT_CONFIG, type GameConfig } from '../config';
import { mergeConfig } from './configStore';

export type ConfigSource = 'local' | 'cloud' | 'default';

/** Ưu tiên: bản lưu trong trình duyệt > cấu hình cloud > mặc định. */
export function resolveConfig(opts: { local: GameConfig | null; cloud: unknown | null }): {
  config: GameConfig;
  source: ConfigSource;
  errors: string[];
} {
  if (opts.local) return { config: structuredClone(opts.local), source: 'local', errors: [] };
  if (opts.cloud !== null && opts.cloud !== undefined) {
    const r = mergeConfig(DEFAULT_CONFIG, opts.cloud);
    return { config: r.config, source: 'cloud', errors: r.errors };
  }
  return { config: structuredClone(DEFAULT_CONFIG), source: 'default', errors: [] };
}

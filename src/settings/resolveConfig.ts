import { DEFAULT_CONFIG, type GameConfig } from '../config';
import { mergeConfig } from './configStore';

export type ConfigSource = 'cloud' | 'default';

/** Người chơi luôn dùng cấu hình cloud; cloud trống/lỗi thì dùng mặc định. */
export function resolveConfig(opts: { cloud: unknown | null }): {
  config: GameConfig;
  source: ConfigSource;
  errors: string[];
} {
  if (opts.cloud !== null && opts.cloud !== undefined) {
    try {
      const r = mergeConfig(DEFAULT_CONFIG, opts.cloud);
      return { config: r.config, source: 'cloud', errors: r.errors };
    } catch (e) {
      return { config: structuredClone(DEFAULT_CONFIG), source: 'default', errors: [`cloud: cấu hình không đọc được (${String(e)})`] };
    }
  }
  return { config: structuredClone(DEFAULT_CONFIG), source: 'default', errors: [] };
}

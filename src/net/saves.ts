import type { RunSave } from '../sim/save';
import { withTimeout } from './cloud';
import { getSupabase } from './supabase';

export interface CloudRow {
  runId: string;
  rev: number;
  save: unknown;
  inWave: boolean;
  deviceId: string;
  /** Tuổi của dòng (ms), server tính bằng đồng hồ của nó: không phụ thuộc đồng hồ máy. */
  ageMs: number;
}

export type PutResult = { ok: true; rev: number } | { ok: false; error: 'conflict' | 'network' };

export interface CloudSaves {
  /** Bản lưu của người dùng hiện tại: dòng, `null` nếu chưa có, `'error'` nếu lỗi mạng/hết giờ. */
  fetch(): Promise<CloudRow | null | 'error'>;
  /** Ghi có điều kiện theo rev (`baseRev` 0 = chưa có bản nào); rev lệch → `'conflict'`. */
  put(runId: string, baseRev: number, save: RunSave): Promise<PutResult>;
  /**
   * Xóa bản lưu của ván đã kết thúc; trả có xóa được dòng nào không. Chỉ xóa khi dòng do `deviceId`
   * ghi, hoặc chưa ai ghi tiếp sau `knownRev` (để lệnh end gửi muộn không xóa tiến độ của máy khác).
   */
  end(runId: string, deviceId: string, knownRev: number): Promise<boolean | 'error'>;
}

/** SQLSTATE do ps_put_save ném khi rev/run_id không khớp. */
const CONFLICT_CODE = 'PS409';

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

/** Dòng ps_get_save → CloudRow; rev/age_ms không phải số hữu hạn thì coi như lỗi. */
export function parseCloudRow(data: Record<string, unknown>): CloudRow | 'error' {
  const rev = num(data.rev);
  const ageMs = num(data.age_ms);
  if (!Number.isFinite(rev) || !Number.isFinite(ageMs)) return 'error';
  return {
    runId: String(data.run_id),
    rev,
    save: data.save,
    inWave: Boolean(data.in_wave),
    deviceId: String(data.device_id),
    ageMs,
  };
}

export function supabaseSaves(): CloudSaves | null {
  const sb = getSupabase();
  if (!sb) return null;
  return {
    async fetch() {
      try {
        const { data, error } = await withTimeout((signal) =>
          sb.rpc('ps_get_save').abortSignal(signal).maybeSingle<Record<string, unknown>>(),
        );
        if (error) return 'error';
        if (!data) return null;
        return parseCloudRow(data);
      } catch {
        return 'error';
      }
    },
    async put(runId, baseRev, save) {
      try {
        const { data, error } = await withTimeout((signal) =>
          sb
            .rpc('ps_put_save', {
              p_run_id: runId,
              p_base_rev: baseRev,
              p_save: save,
              p_in_wave: save.inWave,
              p_device_id: save.deviceId,
            })
            .abortSignal(signal),
        );
        if (error) return { ok: false, error: error.code === CONFLICT_CODE ? 'conflict' : 'network' };
        const rev = num(data);
        return Number.isFinite(rev) ? { ok: true, rev } : { ok: false, error: 'network' };
      } catch {
        return { ok: false, error: 'network' };
      }
    },
    async end(runId, deviceId, knownRev) {
      try {
        const { data, error } = await withTimeout((signal) =>
          sb.rpc('ps_end_save', { p_run_id: runId, p_device_id: deviceId, p_known_rev: knownRev }).abortSignal(signal),
        );
        return error ? 'error' : data === true;
      } catch {
        return 'error';
      }
    },
  };
}

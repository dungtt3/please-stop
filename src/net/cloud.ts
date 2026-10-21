import type { GameConfig } from '../config';
import { getSupabase } from './supabase';

export const TIMEOUT_MS = 4000;

export interface ScoreRow {
  name: string;
  wave_reached: number;
  kills: number;
  won: boolean;
}

export type CloudWrite = { ok: true; updatedAt: string } | { ok: false; error: 'code' | 'network' | 'offline' };
export type CloudClear = { ok: true } | { ok: false; error: 'code' | 'network' | 'offline' };

class TimeoutError extends Error {}

/** Chạy `fn` với giới hạn thời gian; hết giờ thì hủy request và ném TimeoutError. */
async function withTimeout<T>(fn: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => {
      ac.abort();
      rej(new TimeoutError('timeout'));
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve(fn(ac.signal)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchActiveConfig(): Promise<{ config: unknown; updatedAt: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await withTimeout((signal) =>
      sb.from('ps_configs').select('config, updated_at').eq('slot', 'active').abortSignal(signal).maybeSingle(),
    );
    if (error || !data) return null;
    return { config: data.config as unknown, updatedAt: String(data.updated_at) };
  } catch {
    return null;
  }
}

export async function saveActiveConfig(code: string, cfg: GameConfig): Promise<CloudWrite> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'offline' };
  try {
    const { data, error } = await withTimeout((signal) =>
      sb.rpc('ps_save_config', { p_code: code, p_config: cfg }).abortSignal(signal),
    );
    if (error) return { ok: false, error: error.code === '28000' ? 'code' : 'network' };
    return { ok: true, updatedAt: typeof data === 'string' ? data : new Date().toISOString() };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function clearActiveConfig(code: string): Promise<CloudClear> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'offline' };
  try {
    const { error } = await withTimeout((signal) => sb.rpc('ps_clear_config', { p_code: code }).abortSignal(signal));
    if (error) return { ok: false, error: error.code === '28000' ? 'code' : 'network' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function submitScore(s: { name: string; waveReached: number; kills: number; won: boolean }): Promise<{ ok: boolean }> {
  const sb = getSupabase();
  if (!sb) return { ok: false };
  try {
    const { error } = await withTimeout((signal) =>
      sb.from('ps_scores').insert({ name: s.name, wave_reached: s.waveReached, kills: s.kills, won: s.won }).abortSignal(signal),
    );
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export async function fetchTopScores(limit = 20): Promise<ScoreRow[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await withTimeout((signal) =>
      sb
        .from('ps_scores')
        .select('name, wave_reached, kills, won')
        .order('wave_reached', { ascending: false })
        .order('kills', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit)
        .abortSignal(signal),
    );
    if (error || !data) return null;
    return data as ScoreRow[];
  } catch {
    return null;
  }
}

export async function recordRun(r: { waveReached: number; won: boolean; kills: number; durationS: number; configHash: string }): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await withTimeout((signal) =>
      sb
        .from('ps_runs')
        .insert({
          wave_reached: Math.max(0, Math.min(100, Math.round(r.waveReached) || 0)),
          won: r.won,
          kills: Math.max(0, Math.min(1_000_000, Math.round(r.kills) || 0)),
          duration_s: Math.max(0, Math.min(86399, r.durationS)),
          config_hash: r.configHash,
        })
        .abortSignal(signal),
    );
  } catch {
    /* im lặng: thống kê không được làm hỏng game */
  }
}

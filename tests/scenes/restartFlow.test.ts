import { describe, expect, it } from 'vitest';
import { runRestart, type RestartDeps } from '../../src/scenes/restartFlow';

/** Mô phỏng GameScene: recordResult chống ghi lại bằng cờ runRecorded; restart() đặt lại cờ. */
function harness(over: { halted?: boolean; live?: boolean } = {}) {
  const log: string[] = [];
  let recorded = false;
  let live = over.live ?? true;
  const deps: RestartDeps = {
    halted: () => over.halted ?? false,
    live: () => live,
    recordLoss: () => {
      if (recorded) return;
      recorded = true;
      log.push('record');
      live = false; // saver.end()
    },
    restart: () => {
      log.push('restart');
      recorded = false;
      live = true; // beginNew
    },
    closePopup: () => log.push('close'),
  };
  return { deps, log };
}

describe('runRestart', () => {
  it('records the loss once, then restarts and closes the popup', () => {
    const h = harness();
    expect(runRestart(h.deps)).toBe(true);
    expect(h.log).toEqual(['record', 'restart', 'close']);
  });
  it('does not record when the run is no longer live, but still starts a new run', () => {
    const h = harness({ live: false });
    expect(runRestart(h.deps)).toBe(true);
    expect(h.log).toEqual(['restart', 'close']);
  });
  it('does nothing when the run is halted by a save conflict', () => {
    const h = harness({ halted: true });
    expect(runRestart(h.deps)).toBe(false);
    expect(h.log).toEqual([]);
  });
  it('a second restart records the new run once more, never the old one twice', () => {
    const h = harness();
    runRestart(h.deps);
    runRestart(h.deps);
    expect(h.log.filter((x) => x === 'record')).toHaveLength(2);
    expect(h.log).toEqual(['record', 'restart', 'close', 'record', 'restart', 'close']);
  });
});

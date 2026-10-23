import type { GameConfig } from '../config';
import {
  MAX_NAME_LEN,
  applyPreset,
  findPreset,
  formatSavedAt,
  planSave,
  presetErrorMessage,
  removePreset,
  upsertPreset,
  validateName,
  type PresetRow,
} from '../admin/presets';
import type { PresetsApi } from '../net/cloud';

/** Phần "Lưu thành bộ cấu hình" + "Bộ đã lưu" của menu /admin. Toàn bộ chữ gán bằng textContent. */
export interface PresetsSectionDeps {
  api: PresetsApi;
  getDraft(): GameConfig;
  /** Bản nháp đang có ô sai/lỗi gộp: không cho lưu thành bộ. */
  isBlocked(): boolean;
  /** Bản nháp khác mốc lần nạp/lưu gần nhất. */
  isDirty(): boolean;
  /** Bản nháp (đúng bản đã gửi) vừa được lưu thành bộ: menu đặt lại mốc. */
  onSaved(snapshot: GameConfig): void;
  /** Thay bản nháp bằng bộ đã nạp (đã gộp với mặc định). */
  onLoad(cfg: GameConfig): void;
  setStatus(msg: string, kind?: '' | 'ok' | 'bad'): void;
}

const CSS = `
.cfgp{margin:0 0 10px;padding:8px 10px;border:1px solid #2f3650;border-radius:6px;background:#161a24}
.cfgp-title{margin:8px 0 4px;font-size:14px;font-weight:600;color:#c9cfe3}
.cfgp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:3px 0}
.cfgp-in{flex:1 1 160px;min-width:0;min-height:40px;box-sizing:border-box;padding:0 8px;border:1px solid #3a4157;border-radius:6px;background:#0d0f16;color:#e8ebf5;font:inherit}
.cfgp-list{max-height:240px;overflow-y:auto;overscroll-behavior:contain}
.cfgp-name{flex:1 1 140px;min-width:0;overflow-wrap:anywhere;color:#e8ebf5}
.cfgp-time{font-size:12px;color:#9aa3bd}
.cfgp-msg{margin:0;font-size:14px;color:#c9cfe3}
.cfgp-msg.bad{color:#ff8a80}
`;

let styleInjected = false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', `cfgm-btn ${cls}`.trim(), text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

type Confirm = { kind: 'overwrite' | 'load' | 'delete'; name: string };

export function createPresetsSection(deps: PresetsSectionDeps): { root: HTMLElement; reload(): Promise<void> } {
  if (!styleInjected) {
    const st = el('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    styleInjected = true;
  }

  let presets: PresetRow[] = [];
  let state: 'loading' | 'ok' | 'error' = 'loading';
  let loadError = '';
  let busy = false;
  let confirm: Confirm | null = null;
  let seq = 0;

  const root = el('div', 'cfgp');
  const saveRow = el('div', 'cfgp-row');
  const nameIn = el('input', 'cfgp-in');
  nameIn.type = 'text';
  nameIn.maxLength = MAX_NAME_LEN * 2;
  nameIn.placeholder = 'Tên';
  nameIn.setAttribute('aria-label', 'Tên');
  nameIn.autocomplete = 'off';
  const saveBtn = el('button', 'cfgm-btn primary', 'Lưu');
  saveBtn.type = 'button';
  saveRow.append(el('span', 'cfgp-name', 'Lưu thành bộ cấu hình'), nameIn, saveBtn);
  const askBox = el('div', 'cfgp-row');
  const title = el('p', 'cfgp-title', 'Bộ đã lưu');
  const listBox = el('div', 'cfgp-list');
  root.append(saveRow, askBox, title, listBox);

  const sync = (): void => {
    saveBtn.disabled = busy || state !== 'ok' || confirm?.kind === 'overwrite';
  };

  const ask = (c: Confirm | null): void => {
    confirm = c;
    renderAsk();
    renderList();
    sync();
  };

  function renderAsk(): void {
    askBox.replaceChildren();
    if (confirm?.kind !== 'overwrite') return;
    const name = confirm.name;
    askBox.append(
      el('p', 'cfgp-msg', `Ghi đè bộ «${name}»?`),
      btn('Có', () => void doSave(name), 'danger'),
      btn('Không', () => ask(null)),
    );
  }

  function renderList(): void {
    if (state === 'loading') {
      listBox.replaceChildren(el('p', 'cfgp-msg', 'Đang tải…'));
      return;
    }
    if (state === 'error') {
      listBox.replaceChildren(el('p', 'cfgp-msg bad', loadError), btn('Thử lại', () => void reload()));
      return;
    }
    if (!presets.length) {
      listBox.replaceChildren(el('p', 'cfgp-msg', 'Chưa có bộ nào'));
      return;
    }
    listBox.replaceChildren(
      ...presets.map((p) => {
        const row = el('div', 'cfgp-row');
        row.appendChild(el('span', 'cfgp-name', p.name));
        const t = formatSavedAt(p.savedAt);
        if (t) row.appendChild(el('span', 'cfgp-time', t));
        if (confirm && confirm.kind !== 'overwrite' && confirm.name === p.name) {
          const isLoad = confirm.kind === 'load';
          const msg = isLoad ? `Bỏ các thay đổi chưa lưu và nạp bộ «${p.name}»?` : `Xóa bộ «${p.name}»?`;
          row.append(
            el('p', 'cfgp-msg', msg),
            btn('Có', () => void (isLoad ? doLoad(p.name) : doDelete(p.name)), 'danger'),
            btn('Không', () => ask(null)),
          );
        } else {
          const load = btn('Nạp vào menu', () => onLoadClick(p.name));
          const del = btn('Xóa', () => {
            if (!busy) ask({ kind: 'delete', name: p.name });
          });
          load.disabled = busy;
          del.disabled = busy;
          row.append(load, del);
        }
        return row;
      }),
    );
  }

  async function reload(): Promise<void> {
    const mine = ++seq;
    state = 'loading';
    renderList();
    sync();
    let r: Awaited<ReturnType<PresetsApi['list']>>;
    try {
      r = await deps.api.list();
    } catch {
      r = { ok: false, error: 'network' };
    }
    if (mine !== seq) return;
    if (r.ok) {
      state = 'ok';
      presets = r.presets;
    } else {
      state = 'error';
      loadError = presetErrorMessage(r.error);
    }
    renderList();
    sync();
  }

  const setBusy = (b: boolean): void => {
    busy = b;
    renderList();
    sync();
  };

  const BLOCKED_MSG = 'Bản nháp đang có lỗi — sửa xong mới lưu thành bộ được';

  async function doSave(name: string): Promise<void> {
    if (busy) return;
    ask(null);
    // Kiểm lại ở đây: bản nháp có thể bị sửa sai trong lúc hộp "Ghi đè" đang mở.
    if (deps.isBlocked()) {
      deps.setStatus(BLOCKED_MSG, 'bad');
      return;
    }
    setBusy(true);
    deps.setStatus('Đang lưu bộ…');
    // Chụp bản gửi đi: bản nháp có thể bị sửa trong lúc chờ, nhưng bộ chỉ có bản này.
    const sent = structuredClone(deps.getDraft());
    let r: Awaited<ReturnType<PresetsApi['save']>>;
    try {
      r = await deps.api.save(name, sent);
    } catch {
      r = { ok: false, error: 'network' };
    }
    if (r.ok) {
      presets = upsertPreset(presets, { name, config: sent, savedAt: r.savedAt });
      nameIn.value = '';
      deps.onSaved(sent);
      deps.setStatus(`Đã lưu bộ «${name}»`, 'ok');
    } else {
      deps.setStatus(presetErrorMessage(r.error), 'bad');
    }
    setBusy(false);
  }

  function onSaveClick(): void {
    if (busy || state !== 'ok' || confirm?.kind === 'overwrite') return;
    const v = validateName(nameIn.value);
    if (!v.ok) {
      deps.setStatus(`Tên bộ phải có từ 1 đến ${MAX_NAME_LEN} ký tự`, 'bad');
      return;
    }
    if (deps.isBlocked()) {
      deps.setStatus(BLOCKED_MSG, 'bad');
      return;
    }
    const plan = planSave(presets, v.name);
    if (plan === 'full') deps.setStatus(presetErrorMessage('full'), 'bad');
    else if (plan === 'overwrite') ask({ kind: 'overwrite', name: findPreset(presets, v.name)?.name ?? v.name });
    else void doSave(v.name);
  }

  function onLoadClick(name: string): void {
    if (busy) return;
    if (deps.isDirty()) ask({ kind: 'load', name });
    else doLoad(name);
  }

  function doLoad(name: string): void {
    ask(null);
    const p = findPreset(presets, name);
    if (!p) return;
    const r = applyPreset(p.config);
    deps.onLoad(r.config);
    if (r.errors.length) {
      deps.setStatus(`Đã nạp bộ «${p.name}» với ${r.errors.length} trường lỗi (các trường đó dùng giá trị mặc định). Chưa lưu lên cloud.`, 'bad');
    } else {
      deps.setStatus(`Đã nạp bộ «${p.name}» vào menu. Chưa lưu lên cloud.`, 'ok');
    }
  }

  async function doDelete(name: string): Promise<void> {
    if (busy) return;
    ask(null);
    setBusy(true);
    deps.setStatus('Đang xóa bộ…');
    let r: Awaited<ReturnType<PresetsApi['remove']>>;
    try {
      r = await deps.api.remove(name);
    } catch {
      r = { ok: false, error: 'network' };
    }
    if (r.ok) {
      presets = removePreset(presets, name);
      deps.setStatus(`Đã xóa bộ «${name}»`, 'ok');
    } else {
      deps.setStatus(presetErrorMessage(r.error), 'bad');
    }
    setBusy(false);
  }

  saveBtn.addEventListener('click', onSaveClick);
  nameIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSaveClick();
    }
  });
  nameIn.addEventListener('input', () => {
    if (confirm?.kind === 'overwrite') ask(null);
  });

  renderList();
  sync();
  void reload();
  return { root, reload };
}

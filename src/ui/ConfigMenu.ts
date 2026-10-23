import { DEFAULT_CONFIG, type GameConfig } from '../config';
import { enumOptions, exportConfig, importConfig, isFixedArray, mergeConfig, stripIndices } from '../settings/configStore';
import { labelFor } from '../settings/labels';
import type { CloudClear, CloudWrite } from '../net/cloud';

export interface ConfigMenuOptions {
  current: GameConfig;
  /** Cấu hình đang lưu trên cloud; null nếu cloud chưa có. */
  cloudConfig: GameConfig | null;
  /** ISO time cập nhật cấu hình cloud (nếu có). */
  cloudUpdatedAt: string | null;
  /** Ghi chú hiện đầu hộp cloud (vd. cloud chưa có cấu hình, hoặc trường lỗi). */
  note: string | null;
  onCloudSave(cfg: GameConfig): Promise<CloudWrite>;
  onCloudClear(): Promise<CloudClear>;
  /** Có thì menu là một lớp phủ đóng được; không có thì menu chiếm cả trang (trang /admin). */
  onClose?(): void;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
function sourceLine(updatedAt: string | null): string {
  if (!updatedAt) return 'Cấu hình cloud: chưa có';
  const d = new Date(updatedAt);
  const t = !Number.isNaN(d.getTime()) ? ` (cập nhật ${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)})` : '';
  return `Cấu hình cloud${t}`;
}

type Obj = Record<string, unknown>;

/** Thứ tự và gom nhóm cấp cao. Khóa nằm ngoài bảng này tự rơi vào nhóm "Khác". */
const SECTIONS: { title: string; keys: string[] }[] = [
  { title: 'Kinh tế', keys: ['economy.startHp', 'economy.startGold', 'economy.prepSeconds', 'economy.totalWaves', 'economy.maxLevel', 'economy.handLimit', 'economy.rangeCardCap', 'economy.summonCost', 'economy.drawCost', 'economy.attackSpeedPerLevel', 'economy.waveReward'] },
  { title: 'Độ hiếm & Luck', keys: ['economy.baseRarityWeights', 'economy.luckStep', 'economy.maxLuck', 'economy.luckCost', 'economy.rarityBonus'] },
  { title: 'Thẻ', keys: ['cards'] },
  { title: 'Nhân vật', keys: ['classes', 'levelDamage'] },
  { title: 'Skill', keys: ['skills', 'skillCooldownPerLevel'] },
  { title: 'Quái', keys: ['enemies', 'enemyScaling'] },
  { title: 'Wave', keys: ['waves'] },
  { title: 'Modifier', keys: ['modifiers', 'modifierRules'] },
  { title: 'Quiz', keys: ['quiz'] },
  { title: 'Map', keys: ['map'] },
];

const RESET_LABEL = 'Về cấu hình cloud';

const CSS = `
.cfgm-overlay{position:fixed;inset:0;z-index:1000;background:rgba(8,10,16,.82);display:flex;justify-content:center;align-items:stretch;font:15px/1.35 system-ui,"Segoe UI",Roboto,Arial,sans-serif;color:#e8ebf5}
.cfgm-panel{display:flex;flex-direction:column;width:100%;max-width:820px;background:#12141c;border:1px solid #2f3650;box-sizing:border-box;min-height:0}
.cfgm-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;background:#1b1f2b;border-bottom:1px solid #2f3650}
.cfgm-head h2{margin:0;font-size:18px}
.cfgm-body{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;padding:10px 14px;min-height:0;-webkit-overflow-scrolling:touch}
.cfgm-foot{padding:10px 14px;background:#1b1f2b;border-top:1px solid #2f3650}
.cfgm-btns{display:flex;flex-wrap:wrap;gap:8px}
.cfgm-btn{min-height:44px;min-width:44px;padding:0 14px;border:1px solid #3a4157;border-radius:6px;background:#2f3650;color:#e8ebf5;font:inherit;cursor:pointer}
.cfgm-btn:hover:not(:disabled){background:#3b4466}
.cfgm-btn:disabled{opacity:.4;cursor:not-allowed}
.cfgm-btn.primary{background:#2e7d32;border-color:#2e7d32}
.cfgm-btn.primary:hover:not(:disabled){background:#388e3c}
.cfgm-btn.danger{background:#b71c1c;border-color:#b71c1c}
.cfgm-status{min-height:20px;margin:0 0 8px;font-size:14px;color:#9aa3bd}
.cfgm-status.ok{color:#81c784}
.cfgm-status.bad{color:#ff8a80}
.cfgm-errors{margin:0 0 10px;padding:8px 10px 8px 26px;border:1px solid #b71c1c;border-radius:6px;background:rgba(183,28,28,.15);color:#ffab91;font-size:13px;max-height:160px;overflow:auto}
.cfgm-cloud{margin:0 0 10px;padding:8px 10px;border:1px solid #2f3650;border-radius:6px;background:#161a24}
.cfgm-cloud-src{margin:0 0 6px;font-size:14px;color:#c9cfe3}
.cfgm-cloud-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.cfgm-cloud-note{margin:6px 0 0;font-size:12px;color:#9aa3bd}
.cfgm-errors:empty{display:none}
details.cfgm-group{margin:4px 0;border:1px solid #2a3042;border-radius:6px;background:#161a24}
details.cfgm-group>summary{cursor:pointer;padding:10px 12px;min-height:24px;font-weight:600;list-style:revert}
details.cfgm-group.top>summary{font-size:16px;background:#1b1f2b;border-radius:6px}
details.cfgm-group>.cfgm-inner{padding:2px 10px 8px 12px}
.cfgm-row{display:flex;align-items:center;gap:8px;padding:3px 0;flex-wrap:wrap}
.cfgm-label{flex:1 1 180px;min-width:0;color:#c9cfe3}
.cfgm-dot{width:10px;height:10px;border-radius:50%;background:transparent;flex:none}
.cfgm-row.dirty .cfgm-dot{background:#ffb300}
.cfgm-in{width:130px;min-height:40px;box-sizing:border-box;padding:0 8px;border:1px solid #3a4157;border-radius:6px;background:#0d0f16;color:#e8ebf5;font:inherit}
.cfgm-in.wide{width:min(100%,260px)}
.cfgm-in.invalid{border-color:#ff5252;box-shadow:0 0 0 1px #ff5252}
.cfgm-mini{min-width:44px;min-height:40px;border:1px solid #3a4157;border-radius:6px;background:#232838;color:#e8ebf5;font:inherit;cursor:pointer}
.cfgm-mini:disabled{opacity:.25;cursor:default}
.cfgm-item-head{display:flex;align-items:center;gap:6px}
.cfgm-item-head>summary{flex:1}
.cfgm-add{margin:6px 0 2px}
@media (max-width:520px){.cfgm-in{width:100%}.cfgm-label{flex-basis:100%}.cfgm-head h2{font-size:16px}}
`;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const jsonEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const join = (p: string, k: string | number): string => (p ? `${p}.${k}` : String(k));

function getAt(root: unknown, path: string): unknown {
  let cur: unknown = root;
  if (!path) return cur;
  for (const k of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Obj)[k];
  }
  return cur;
}

function setAt(root: unknown, path: string, value: unknown): void {
  const ks = path.split('.');
  let cur = root as Obj;
  for (let i = 0; i < ks.length - 1; i++) cur = cur[ks[i]] as Obj;
  cur[ks[ks.length - 1]] = value;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let styleInjected = false;
let openMenu: HTMLElement | null = null;

export function openConfigMenu(opts: ConfigMenuOptions): void {
  if (openMenu) return;
  if (!styleInjected) {
    const st = el('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    styleInjected = true;
  }

  let draft: GameConfig = structuredClone(opts.current);
  /** Bản đang lưu trên cloud (cập nhật sau khi Lưu/Gỡ thành công). */
  let cloudCfg: GameConfig | null = opts.cloudConfig;
  const invalid = new Set<string>();
  const openPaths = new Set<string>(['@Kinh tế']);

  const overlay = el('div', 'cfgm-overlay');
  const panel = el('div', 'cfgm-panel');
  overlay.appendChild(panel);
  const head = el('div', 'cfgm-head');
  head.appendChild(el('h2', undefined, '⚙ Cấu hình cân bằng'));
  const closeX = el('button', 'cfgm-btn', '✕');
  closeX.setAttribute('aria-label', 'Đóng');
  head.appendChild(closeX);
  const body = el('div', 'cfgm-body');
  const foot = el('div', 'cfgm-foot');
  const status = el('p', 'cfgm-status');
  const errBox = el('ul', 'cfgm-errors');
  const btns = el('div', 'cfgm-btns');
  const cloudBox = el('div', 'cfgm-cloud');
  const cloudSrc = el('p', 'cfgm-cloud-src', sourceLine(opts.cloudUpdatedAt));
  cloudBox.appendChild(cloudSrc);
  const cloudRow = el('div', 'cfgm-cloud-row');
  const cloudSaveBtn = el('button', 'cfgm-btn', 'Lưu lên cloud (áp dụng cho mọi người)');
  cloudSaveBtn.type = 'button';
  const cloudClearBtn = el('button', 'cfgm-btn', 'Gỡ cấu hình cloud (về mặc định)');
  cloudClearBtn.type = 'button';
  const cloudClearNo = el('button', 'cfgm-btn', 'Hủy');
  cloudClearNo.type = 'button';
  cloudClearNo.style.display = 'none';
  cloudRow.append(cloudSaveBtn, cloudClearBtn, cloudClearNo);
  cloudBox.append(cloudRow, el('p', 'cfgm-cloud-note', 'Cấu hình cloud áp dụng cho mọi người chơi (từ ván sau).'));
  if (opts.note) {
    const note = el('p', 'cfgm-cloud-note', opts.note);
    note.style.color = '#ffb300';
    note.style.fontSize = '13px';
    cloudBox.insertBefore(note, cloudRow);
  }
  foot.append(cloudBox, status, btns);
  panel.append(head, body, foot);

  const mkBtn = (text: string, cls = ''): HTMLButtonElement => {
    const b = el('button', `cfgm-btn ${cls}`.trim(), text);
    b.type = 'button';
    btns.appendChild(b);
    return b;
  };
  const resetBtn = mkBtn(RESET_LABEL);
  const resetNo = mkBtn('Hủy');
  resetNo.style.display = 'none';
  const exportBtn = mkBtn('Xuất JSON');
  const importBtn = mkBtn('Nhập JSON');
  const closeBtn = mkBtn('Đóng');
  if (!opts.onClose) {
    closeBtn.style.display = 'none';
    closeX.style.display = 'none';
  }
  const file = el('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.style.display = 'none';
  panel.appendChild(file);

  const setStatus = (msg: string, kind: '' | 'ok' | 'bad' = ''): void => {
    status.textContent = msg;
    status.className = `cfgm-status ${kind}`.trim();
  };

  /** Lỗi gộp (ràng buộc chéo, số âm...) của bản nháp hiện tại. */
  const draftErrors = (): string[] => mergeConfig(DEFAULT_CONFIG, draft).errors;
  /** Bản nháp đang có lỗi: không cho lưu lên cloud / xuất. */
  let saveBlocked = false;
  let refreshSave = (): void => {
    const errs = draftErrors();
    const blocked = invalid.size > 0 || errs.length > 0;
    saveBlocked = blocked;
    exportBtn.disabled = blocked;
    if (blocked) {
      const lines = [...[...invalid].map((p) => `${labelFor(p)} (${p}): giá trị không hợp lệ`), ...errs];
      showErrors(lines);
    } else if (errBox.dataset.import !== '1') {
      showErrors([]);
    }
  };
  function showErrors(lines: string[]): void {
    errBox.replaceChildren(...lines.map((l) => el('li', undefined, l)));
  }

  // ---------- Form ----------
  function isDirty(path: string, value: unknown): boolean {
    return !jsonEq(value, getAt(DEFAULT_CONFIG, path));
  }

  function renderLeaf(parent: HTMLElement, path: string, value: unknown, labelText: string, onStructure: () => void): void {
    const row = el('div', 'cfgm-row');
    row.appendChild(el('span', 'cfgm-dot'));
    const lab = el('label', 'cfgm-label', labelText);
    row.appendChild(lab);
    let input: HTMLInputElement | HTMLSelectElement;
    const opts2 = typeof value === 'string' ? enumOptions(path) : undefined;
    if (opts2) {
      const sel = el('select', 'cfgm-in');
      for (const o of opts2) {
        const op = el('option', undefined, o);
        op.value = o;
        sel.appendChild(op);
      }
      sel.value = value as string;
      input = sel;
    } else if (typeof value === 'number') {
      const inp = el('input', 'cfgm-in');
      inp.type = 'number';
      inp.step = 'any';
      inp.value = String(value);
      input = inp;
    } else {
      const inp = el('input', 'cfgm-in wide');
      inp.type = 'text';
      inp.value = String(value);
      input = inp;
    }
    const reset = el('button', 'cfgm-mini', '↺');
    reset.type = 'button';
    reset.title = 'Trả về mặc định';
    reset.setAttribute('aria-label', 'Trả về mặc định');

    const syncMarks = (): void => {
      const cur = getAt(draft, path);
      const dirty = isDirty(path, cur);
      row.classList.toggle('dirty', dirty);
      reset.disabled = !dirty || getAt(DEFAULT_CONFIG, path) === undefined;
      input.classList.toggle('invalid', invalid.has(path));
    };
    const commit = (): void => {
      errBox.dataset.import = '';
      if (typeof value === 'number') {
        const raw = (input as HTMLInputElement).value.trim();
        const n = raw === '' ? NaN : Number(raw);
        if (!Number.isFinite(n)) {
          invalid.add(path);
          syncMarks();
          refreshSave();
          return;
        }
        invalid.delete(path);
        setAt(draft, path, n);
      } else {
        setAt(draft, path, input.value);
      }
      syncMarks();
      refreshSave();
    };
    input.addEventListener('input', commit);
    input.addEventListener('change', commit);
    reset.addEventListener('click', () => {
      const def = getAt(DEFAULT_CONFIG, path);
      if (def === undefined) return;
      invalid.delete(path);
      setAt(draft, path, structuredClone(def));
      input.value = String(def);
      syncMarks();
      refreshSave();
    });
    row.append(input, reset);
    parent.appendChild(row);
    syncMarks();
  }

  function renderNode(parent: HTMLElement, path: string, value: unknown, depth: number, onStructure: () => void, titleOverride?: string): void {
    if (Array.isArray(value)) {
      const primitive = value.every((x) => typeof x !== 'object' || x === null);
      const fixed = isFixedArray(path);
      const title = titleOverride ?? labelFor(path);
      const g = group(path, title, depth);
      parent.appendChild(g.root);
      if (primitive && fixed) {
        value.forEach((v, i) => {
          const ip = join(path, i);
          const lbl = labelFor(ip);
          renderLeaf(g.inner, ip, v, lbl === String(i) ? `${i + 1}` : lbl, onStructure);
        });
        return;
      }
      value.forEach((v, i) => {
        const ip = join(path, i);
        if (primitive) {
          const row = el('div', 'cfgm-row');
          const holder = el('div');
          holder.style.flex = '1 1 auto';
          renderLeaf(holder, ip, v, `${labelFor(path)} ${i + 1}`, onStructure);
          const del = el('button', 'cfgm-mini', '×');
          del.type = 'button';
          del.title = 'Xóa';
          del.setAttribute('aria-label', 'Xóa');
          del.addEventListener('click', () => {
            (getAt(draft, path) as unknown[]).splice(i, 1);
            onStructure();
          });
          row.append(holder, del);
          g.inner.appendChild(row);
        } else {
          const d = group(ip, `${labelFor(path)} ${i + 1}`, depth + 1, true);
          const del = el('button', 'cfgm-mini', '×');
          del.type = 'button';
          del.title = 'Xóa';
          del.setAttribute('aria-label', 'Xóa');
          del.addEventListener('click', () => {
            (getAt(draft, path) as unknown[]).splice(i, 1);
            onStructure();
          });
          d.summary.appendChild(del);
          g.inner.appendChild(d.root);
          renderObjectBody(d.inner, ip, v, depth + 1, onStructure);
        }
      });
      const add = el('button', 'cfgm-btn cfgm-add', '+ Thêm');
      add.type = 'button';
      add.addEventListener('click', () => {
        const arr = getAt(draft, path) as unknown[];
        const tmpl = arr.length ? arr[arr.length - 1] : getAt(DEFAULT_CONFIG, join(path, 0));
        arr.push(tmpl === undefined ? (primitive ? '+' : {}) : structuredClone(tmpl));
        onStructure();
      });
      g.inner.appendChild(add);
      return;
    }
    if (isObj(value)) {
      const g = group(path, titleOverride ?? labelFor(path), depth);
      parent.appendChild(g.root);
      renderObjectBody(g.inner, path, value, depth, onStructure);
      return;
    }
    renderLeaf(parent, path, value, titleOverride ?? labelFor(path), onStructure);
  }

  function renderObjectBody(inner: HTMLElement, path: string, value: unknown, depth: number, onStructure: () => void): void {
    for (const [k, v] of Object.entries(value as Obj)) renderNode(inner, join(path, k), v, depth + 1, onStructure);
  }

  function group(path: string, title: string, depth: number, itemMode = false): { root: HTMLDetailsElement; summary: HTMLElement; inner: HTMLElement } {
    const root = el('details', `cfgm-group${depth === 0 ? ' top' : ''}`);
    const key = path || title;
    root.open = openPaths.has(key);
    root.addEventListener('toggle', () => {
      if (root.open) openPaths.add(key);
      else openPaths.delete(key);
    });
    const summary = el('summary', undefined, title);
    if (itemMode) {
      summary.style.display = 'flex';
      summary.style.alignItems = 'center';
      summary.style.justifyContent = 'space-between';
      summary.style.gap = '8px';
    }
    const inner = el('div', 'cfgm-inner');
    root.append(summary, inner);
    return { root, summary, inner };
  }

  function renderForm(): void {
    const scroll = body.scrollTop;
    body.replaceChildren(errBox);
    const used = new Set<string>();
    const topKeys = Object.keys(draft);
    const mk = (title: string, keys: string[]): void => {
      const sec = group('', title, 0);
      // Khóa mở nhóm cấp cao dùng tiền tố '@' để không trùng đường dẫn dữ liệu.
      const secKey = `@${title}`;
      sec.root.open = openPaths.has(secKey);
      sec.root.addEventListener('toggle', () => {
        if (sec.root.open) openPaths.add(secKey);
        else openPaths.delete(secKey);
      });
      body.appendChild(sec.root);
      for (const k of keys) {
        const v = getAt(draft, k);
        if (v === undefined) continue;
        used.add(k);
        renderNode(sec.inner, k, v, 1, renderForm);
      }
    };
    for (const s of SECTIONS) mk(s.title, s.keys);
    const leftover = topKeys.filter((k) => !SECTIONS.some((s) => s.keys.some((x) => x === k || x.startsWith(`${k}.`))));
    const leftoverEco = Object.keys(draft.economy).map((k) => `economy.${k}`).filter((k) => !used.has(k));
    if (leftover.length || leftoverEco.length) mk('Khác', [...leftover, ...leftoverEco]);
    body.scrollTop = scroll;
    refreshSave();
  }

  // ---------- Hành động ----------
  const close = (): void => {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    openMenu = null;
    opts.onClose?.();
  };
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && opts.onClose) close();
  }
  document.addEventListener('keydown', onKey, true);

  const cancelResetConfirm = (): void => {
    resetBtn.textContent = RESET_LABEL;
    resetBtn.classList.remove('danger');
    resetNo.style.display = 'none';
  };

  resetBtn.addEventListener('click', () => {
    if (resetBtn.classList.contains('danger')) {
      cancelResetConfirm();
      draft = structuredClone(cloudCfg ?? DEFAULT_CONFIG);
      invalid.clear();
      errBox.dataset.import = '';
      renderForm();
      setStatus('Đã bỏ mọi chỉnh sửa chưa lưu — đang hiện cấu hình cloud.', 'ok');
    } else {
      resetBtn.textContent = 'Bấm lần nữa để xác nhận';
      resetBtn.classList.add('danger');
      resetNo.style.display = '';
    }
  });
  resetNo.addEventListener('click', cancelResetConfirm);

  // ---------- Cloud ----------
  const cloudErr = (e: 'code' | 'network' | 'offline'): string => (e === 'code' ? 'Sai mã quản trị' : 'Không kết nối được Supabase');
  const cancelClearConfirm = (): void => {
    cloudClearBtn.textContent = 'Gỡ cấu hình cloud (về mặc định)';
    cloudClearBtn.classList.remove('danger');
    cloudClearNo.style.display = 'none';
  };
  let cloudBusy = false;
  const setCloudBusy = (b: boolean): void => {
    cloudBusy = b;
    cloudSaveBtn.disabled = b || saveBlocked;
    cloudClearBtn.disabled = b;
  };
  const syncCloudSave = (): void => {
    cloudSaveBtn.disabled = cloudBusy || saveBlocked;
  };
  const baseRefresh = refreshSave;
  refreshSave = (): void => {
    baseRefresh();
    syncCloudSave();
  };
  cloudSaveBtn.addEventListener('click', async () => {
    if (cloudBusy || saveBlocked) return;
    cancelClearConfirm();
    setCloudBusy(true);
    setStatus('Đang lưu lên cloud...');
    let r: CloudWrite;
    try {
      r = await opts.onCloudSave(structuredClone(draft));
    } catch {
      r = { ok: false, error: 'network' };
    } finally {
      setCloudBusy(false);
    }
    if (r.ok) {
      cloudCfg = structuredClone(draft);
      cloudSrc.textContent = sourceLine(r.updatedAt);
      setStatus('Đã lưu lên cloud — người chơi nhận bộ số mới ở ván sau', 'ok');
    }
    else setStatus(cloudErr(r.error), 'bad');
  });
  cloudClearBtn.addEventListener('click', async () => {
    if (cloudBusy) return;
    if (!cloudClearBtn.classList.contains('danger')) {
      cloudClearBtn.textContent = 'Bấm lần nữa để gỡ cho mọi người';
      cloudClearBtn.classList.add('danger');
      cloudClearNo.style.display = '';
      return;
    }
    cancelClearConfirm();
    setCloudBusy(true);
    setStatus('Đang gỡ cấu hình cloud...');
    let r: CloudClear;
    try {
      r = await opts.onCloudClear();
    } catch {
      r = { ok: false, error: 'network' };
    } finally {
      setCloudBusy(false);
    }
    if (r.ok) {
      cloudCfg = null;
      cloudSrc.textContent = sourceLine(null);
      setStatus('Đã gỡ cấu hình cloud — người chơi về mặc định ở ván sau', 'ok');
    }
    else setStatus(cloudErr(r.error), 'bad');
  });
  cloudClearNo.addEventListener('click', cancelClearConfirm);
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([exportConfig(draft)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = 'merge-defense-config.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Đã xuất merge-defense-config.json', 'ok');
  });
  importBtn.addEventListener('click', () => {
    cancelResetConfirm();
    file.value = '';
    file.click();
  });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    let text = '';
    try {
      text = await f.text();
    } catch {
      setStatus('Không đọc được file.', 'bad');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      showErrors(['File không phải JSON hợp lệ']);
      errBox.dataset.import = '1';
      setStatus('Nhập thất bại, giá trị giữ nguyên.', 'bad');
      return;
    }
    if (!isObj(parsed)) {
      showErrors(['File phải chứa một object cấu hình']);
      errBox.dataset.import = '1';
      setStatus('Nhập thất bại, giá trị giữ nguyên.', 'bad');
      return;
    }
    const r = importConfig(text, draft);
    draft = r.config;
    invalid.clear();
    renderForm();
    showErrors(r.errors);
    errBox.dataset.import = r.errors.length ? '1' : '';
    if (r.errors.length) setStatus(`Đã nạp với ${r.errors.length} lỗi (giá trị sai giữ giá trị cũ). Bấm Lưu lên cloud để lưu.`, 'bad');
    else setStatus('Đã nạp file. Bấm Lưu lên cloud để lưu.', 'ok');
  });
  closeBtn.addEventListener('click', close);
  closeX.addEventListener('click', close);

  renderForm();
  setStatus('Ô có chấm cam là khác mặc định; ↺ để trả về mặc định.');
  document.body.appendChild(overlay);
  openMenu = overlay;
}

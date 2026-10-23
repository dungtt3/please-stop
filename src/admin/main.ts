import { checkAdminCode, clearActiveConfig, fetchActiveConfig, saveActiveConfig } from '../net/cloud';
import { openConfigMenu } from '../ui/ConfigMenu';
import { reloadAdmin, unlockAdmin, type AdminView } from './adminFlow';

const CSS = `
.adm-box{max-width:360px;margin:15vh auto 0;padding:20px;border:1px solid #2f3650;border-radius:8px;background:#1b1f2b;display:flex;flex-direction:column;gap:12px}
.adm-box h1{margin:0;font-size:20px}
.adm-in{min-height:44px;box-sizing:border-box;padding:0 10px;border:1px solid #3a4157;border-radius:6px;background:#0d0f16;color:#e8ebf5;font:inherit}
.adm-btn{min-height:44px;padding:0 14px;border:1px solid #2e7d32;border-radius:6px;background:#2e7d32;color:#e8ebf5;font:inherit;cursor:pointer}
.adm-btn:disabled{opacity:.5;cursor:default}
.adm-err{min-height:20px;margin:0;color:#ff8a80;font-size:14px}
`;

const root = document.getElementById('admin') as HTMLElement;
const st = document.createElement('style');
st.textContent = CSS;
document.head.appendChild(st);

/** Mã quản trị chỉ nằm trong biến này (không lưu vào trình duyệt, không nằm trong mã nguồn). */
let adminCode = '';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderGate(error: null | 'wrong' | 'offline'): void {
  const box = el('form', 'adm-box');
  const input = el('input', 'adm-in');
  input.type = 'password';
  input.autocomplete = 'off';
  input.placeholder = 'Mã quản trị';
  input.setAttribute('aria-label', 'Mã quản trị');
  const btn = el('button', 'adm-btn', 'Mở');
  btn.type = 'submit';
  const err = el('p', 'adm-err', error === 'wrong' ? 'Sai mã quản trị' : error === 'offline' ? 'Không kết nối được' : '');
  err.setAttribute('role', 'alert');
  box.append(el('h1', undefined, 'Quản trị'), input, btn, err);
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true;
    err.textContent = 'Đang kiểm tra...';
    const code = input.value;
    const view = await unlockAdmin(code, { check: checkAdminCode, fetch: fetchActiveConfig });
    if (view.kind !== 'gate') adminCode = code;
    show(view);
  });
  root.replaceChildren(box);
  input.focus();
}

function renderLoadError(): void {
  const box = el('div', 'adm-box');
  const btn = el('button', 'adm-btn', 'Thử lại');
  btn.type = 'button';
  const msg = el('p', 'adm-err', 'Không tải được cấu hình cloud');
  msg.setAttribute('role', 'alert');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    msg.textContent = 'Đang tải...';
    show(await reloadAdmin({ fetch: fetchActiveConfig }));
  });
  box.append(msg, btn);
  root.replaceChildren(box);
}

function show(view: AdminView): void {
  if (view.kind === 'gate') {
    adminCode = '';
    renderGate(view.error);
  } else if (view.kind === 'loadError') {
    renderLoadError();
  } else {
    root.replaceChildren();
    openConfigMenu({
      current: view.config,
      cloudConfig: view.cloudConfig,
      cloudUpdatedAt: view.updatedAt,
      note: view.note,
      onCloudSave: (cfg) => saveActiveConfig(adminCode, cfg),
      onCloudClear: () => clearActiveConfig(adminCode),
    });
  }
}

show({ kind: 'gate', error: null });

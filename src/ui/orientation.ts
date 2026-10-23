/**
 * Nhắc xoay ngang trên điện thoại cầm dọc. Không phụ thuộc Phaser; an toàn khi chạy không có `window` (test node).
 * Lớp phủ chỉ gắn ở `src/main.ts` (trang game), không bao giờ ở `/admin`.
 */

/** Dưới ngưỡng này (CSS px) theo chiều nhỏ nhất thì coi là điện thoại; máy tính bảng không bị nhắc. */
export const PHONE_MAX_SIDE = 600;
export const ROTATE_TEXT = 'Xoay ngang điện thoại để chơi';

export interface Viewport {
  w: number;
  h: number;
  /** `pointer: coarse` */
  coarse: boolean;
}

/** Chỉ chặn khi cảm ứng, khung dọc và chiều nhỏ nhất < 600 CSS px. */
export function shouldBlock(v: Viewport): boolean {
  return v.coarse && v.h > v.w && Math.min(v.w, v.h) < PHONE_MAX_SIDE;
}

export interface OrientationCtx {
  popupOpen: boolean;
  quizOpen: boolean;
  resultOpen: boolean;
  halted: boolean;
}

export interface OrientationActions {
  /** Giá trị mới của cờ `orientationBlocked` (chặn tick, kể cả đồng hồ quiz). */
  blocked: boolean;
  /** Hủy kéo thả/nhấn đang dở (bàn chơi và thẻ bài). */
  cancelInput: boolean;
  /** Xoay lại: mở popup Tạm dừng (chỉ khi mở được; ngược lại chỉ bỏ cờ). */
  openPopup: boolean;
}

/** Chuyển trạng thái của GameScene khi hướng thay đổi. Thuần, để test. */
export function onOrientation(blocked: boolean, ctx: OrientationCtx): OrientationActions {
  if (blocked) return { blocked: true, cancelInput: true, openPopup: false };
  const canPause = !ctx.popupOpen && !ctx.quizOpen && !ctx.resultOpen && !ctx.halted;
  return { blocked: false, cancelInput: false, openPopup: canPause };
}

/** Âm thanh tạm ngưng khi popup mở, lớp phủ xoay đang chặn hoặc tab ẩn. */
export function soundSuspended(s: { popupOpen: boolean; orientationBlocked: boolean; hidden: boolean }): boolean {
  return s.popupOpen || s.orientationBlocked || s.hidden;
}

export interface OrientationController {
  blocked(): boolean;
  /** Đăng ký nghe thay đổi (chỉ gọi khi trạng thái đổi); trả hàm hủy đăng ký. */
  onChange(cb: (blocked: boolean) => void): () => void;
  /** Gỡ lớp phủ và listener. */
  dispose(): void;
}

const NOOP: OrientationController = {
  blocked: () => false,
  onChange: () => () => undefined,
  dispose: () => undefined,
};

let current: OrientationController = NOOP;

/** Bộ điều khiển đã cài ở main.ts; nếu chưa cài (test, /admin) thì không bao giờ chặn. */
export function getOrientation(): OrientationController {
  return current;
}

const OVERLAY_ID = 'orientation-overlay';
const OVERLAY_Z = 2000; // trên ô nhập tên (900) và menu cấu hình (1000)
const CSS = `
#${OVERLAY_ID}{position:fixed;inset:0;z-index:${OVERLAY_Z};display:none;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:#12141c;color:#e8ebf5;font:600 22px/1.3 system-ui,"Segoe UI",Roboto,Arial,sans-serif;text-align:center;padding:24px;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#${OVERLAY_ID}[data-on="1"]{display:flex}
#${OVERLAY_ID} svg{width:96px;height:96px;transform-origin:50% 50%;animation:orient-rotate 2.4s ease-in-out infinite}
@keyframes orient-rotate{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}
@media (prefers-reduced-motion: reduce){#${OVERLAY_ID} svg{animation:none;transform:rotate(-90deg)}}
`;
const ICON =
  '<svg viewBox="0 0 64 64" fill="none" stroke="#e8ebf5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="20" y="6" width="24" height="44" rx="4"/><line x1="29" y1="44" x2="35" y2="44"/>' +
  '<path d="M12 58 A24 24 0 0 0 52 58"/><polyline points="48 54 52 58 56 54"/></svg>';

function readViewport(win: Window): Viewport {
  let coarse = false;
  try {
    coarse = win.matchMedia('(pointer: coarse)').matches;
  } catch {
    /* không có matchMedia: coi như không cảm ứng */
  }
  return { w: win.innerWidth, h: win.innerHeight, coarse };
}

/** Gắn lớp phủ DOM "Xoay ngang điện thoại để chơi" và theo dõi hướng màn hình. */
export function installOrientationOverlay(
  win: Window | undefined = typeof window === 'undefined' ? undefined : window,
): OrientationController {
  const doc = win?.document;
  if (!win || !doc || !doc.body) return NOOP;
  current.dispose();

  const style = doc.createElement('style');
  style.textContent = CSS;
  const el = doc.createElement('div');
  el.id = OVERLAY_ID;
  el.setAttribute('role', 'alert');
  el.innerHTML = `${ICON}<div>${ROTATE_TEXT}</div>`;
  doc.head.appendChild(style);
  doc.body.appendChild(el);

  const listeners = new Set<(b: boolean) => void>();
  let state = shouldBlock(readViewport(win));
  el.dataset.on = state ? '1' : '0';

  const refresh = (): void => {
    const next = shouldBlock(readViewport(win));
    if (next === state) return;
    state = next;
    el.dataset.on = next ? '1' : '0';
    for (const cb of [...listeners]) cb(next);
  };

  let mq: MediaQueryList | null = null;
  try {
    mq = win.matchMedia('(pointer: coarse)');
  } catch {
    mq = null;
  }
  win.addEventListener('resize', refresh);
  win.addEventListener('orientationchange', refresh);
  mq?.addEventListener?.('change', refresh);

  const ctl: OrientationController = {
    blocked: () => state,
    onChange: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    dispose: () => {
      win.removeEventListener('resize', refresh);
      win.removeEventListener('orientationchange', refresh);
      mq?.removeEventListener?.('change', refresh);
      listeners.clear();
      el.remove();
      style.remove();
      if (current === ctl) current = NOOP;
    },
  };
  current = ctl;
  return ctl;
}

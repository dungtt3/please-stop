// Phím tắt của ván chơi. Thuần: không import Phaser/DOM để test được.

export type KeyAction = 'open' | 'close' | 'cancelConfirm';

export interface KeyState {
  /** Popup tạm dừng đang mở. */
  popupOpen: boolean;
  /** Hộp xác nhận (Thoát / Chơi lại) đang mở trên popup. */
  confirmOpen: boolean;
  /** Quiz, màn kết quả hoặc ván bị đóng băng (xung đột): không mở được popup. */
  blocked: boolean;
  /** Phím đến từ ô nhập liệu (input/textarea/contenteditable). */
  targetEditable: boolean;
  /** Đang giữ Ctrl/Alt/Meta (vd Ctrl+P là lệnh in của trình duyệt). */
  modifier?: boolean;
  /** Phím lặp do giữ phím. */
  repeat?: boolean;
}

/** Phần tử nhận phím có phải ô nhập liệu không (chấp nhận mọi đối tượng có `tagName`/`isContentEditable`). */
export function isEditableTarget(t: unknown): boolean {
  if (typeof t !== 'object' || t === null) return false;
  const { tagName, isContentEditable } = t as { tagName?: unknown; isContentEditable?: unknown };
  if (isContentEditable === true) return true;
  if (typeof tagName !== 'string') return false;
  const tag = tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export const isSpace = (key: string): boolean => key === ' ' || key === 'Spacebar';

/**
 * Esc/P mở hoặc đóng popup; Space = Tiếp tục khi popup mở; Esc trong hộp xác nhận = Không.
 * `null`: không làm gì (và không nuốt phím).
 */
export function keyAction(key: string, st: KeyState): KeyAction | null {
  if (st.targetEditable || st.modifier || st.repeat) return null;
  const esc = key === 'Escape' || key === 'Esc';
  const p = key === 'p' || key === 'P';
  const space = isSpace(key);
  if (!esc && !p && !space) return null;
  if (st.confirmOpen) return esc ? 'cancelConfirm' : null;
  if (st.popupOpen) return 'close';
  if (space || st.blocked) return null;
  return 'open';
}

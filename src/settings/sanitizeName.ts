export const MAX_NAME = 20;

/** Cắt khoảng trắng, gộp khoảng trắng liên tiếp, tối đa 20 ký tự. */
export function sanitizeName(raw: string): string {
  return Array.from(raw.replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME).join('').trim();
}

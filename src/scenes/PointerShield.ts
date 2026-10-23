/**
 * Phaser gọi pointerdown của đối tượng trước, rồi mới tới pointerdown của scene cho cùng một lần chạm.
 * Khi lần chạm đó đã đổi trạng thái UI (đóng/mở popup), scene không được coi nó là chạm vào bàn chơi.
 * `arm()` ở chỗ đổi trạng thái; `consume()` ở pointerdown của scene; `reset()` mỗi khung hình.
 */
export class PointerShield {
  private armed = false;

  arm(): void {
    this.armed = true;
  }

  /** true nếu lần chạm này phải bị bỏ qua (và hạ cờ). */
  consume(): boolean {
    const was = this.armed;
    this.armed = false;
    return was;
  }

  reset(): void {
    this.armed = false;
  }
}

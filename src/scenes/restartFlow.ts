// Chơi lại giữa ván (không phụ thuộc Phaser để test được).

export interface RestartDeps {
  /** Ván đã bị đóng băng do xung đột với máy khác: không làm gì. */
  halted(): boolean;
  /** Ván còn quyền ghi (chưa kết thúc/bị bỏ/xung đột). */
  live(): boolean;
  /** Ghi thua + kỷ lục + xóa bản lưu; bản thật tự chống ghi lần hai. */
  recordLoss(): void;
  /** Bắt đầu ván mới (đồng thời xóa mọi trạng thái ván cũ). */
  restart(): void;
  /** Đóng popup. */
  closePopup(): void;
}

/** Ván này bị tính thua đúng một lần rồi bắt đầu ván mới. Trả `false` nếu không làm gì. */
export function runRestart(d: RestartDeps): boolean {
  if (d.halted()) return false;
  if (d.live()) d.recordLoss();
  d.restart();
  d.closePopup();
  return true;
}

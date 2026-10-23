# Thiết kế: Áp dụng hướng dẫn UI/UX (bản rút gọn cho thủ thành, ưu tiên màn hình ngang)

Ngày: 2026-10-24. Nguồn: `docs/arcade-game-ui-ux-agent-guide.md` (viết cho match-3 React+Canvas).
Người dùng đã chọn: **áp dụng cho please-stop, chỉ lấy nguyên tắc chung dùng được cho thủ thành**, và
**ưu tiên màn hình ngang** (cầm dọc thì nhắc xoay, không làm bố cục dọc riêng).

## 1. Phạm vi

**Lấy từ hướng dẫn:** thứ tự ưu tiên (đúng gameplay > rõ thao tác > dùng được trên mobile/desktop >
đọc được/accessibility/hiệu năng > trang trí); không chỉ dùng màu để phân biệt; vùng chạm ≥ 44 CSS px;
popup tạm dừng chuẩn (Tiếp tục nổi bật, Chơi lại có xác nhận, Cài đặt, Màn hình chính); giảm chuyển
động; không rung/nháy mạnh; màn kết quả không phán xét, có kỷ lục thật; màn hình bắt đầu một thao tác;
safe area; chữ rõ trên màn hình DPR cao; phím tắt cho tạm dừng.

**Bỏ (riêng match-3, không áp dụng):** swap/invalid swap/match/cascade/gravity/spawn, hint nước đi,
React/DOM hóa HUD (game dùng Phaser — giữ kiến trúc hiện có, hướng dẫn mục 12 "ưu tiên sửa cấu trúc
hiện có"), telemetry mới, tutorial nhiều bước.

**Không đổi:** luật chơi, cân bằng, lưu ván/tài khoản, /admin.

## 2. Điện thoại cầm dọc

- Khi khung hiển thị dọc (`innerHeight > innerWidth`) **và** là thiết bị cảm ứng (`pointer: coarse`):
  hiện lớp phủ DOM toàn màn hình: biểu tượng xoay + "Xoay ngang điện thoại để chơi". Đang trong ván
  thì ván **tự tạm dừng** (như mở popup), xoay ngang lại thì lớp phủ biến mất và **popup tạm dừng
  vẫn mở** (người chơi tự bấm Tiếp tục — tránh ván chạy tiếp bất ngờ). *(Người thiết kế quyết định.)*
- Desktop cửa sổ hẹp/dọc không hiện lớp phủ (không phải thiết bị cảm ứng).
- Thử khóa hướng ngang bằng `screen.orientation.lock('landscape')` khi vào toàn màn hình nếu trình
  duyệt cho phép; không được thì chỉ dùng lớp phủ. Không bắt buộc toàn màn hình.

## 3. Vùng chạm và bố cục ngang

- Khung game giữ 1280×720 (Phaser FIT). Mục tiêu đo ở **điện thoại ngang 844×390 CSS px** (hệ số ~0,54):
  - mọi nút (thanh dưới, ⚙, tốc độ, nút popup, nút màn hình bắt đầu/kết quả, thẻ bài) có **vùng chạm**
    ≥ 82 px khung game theo chiều nhỏ nhất (≈ 44 CSS px). Vùng chạm được phép lớn hơn hình vẽ.
  - ô bàn chơi không nhỏ hơn hiện tại; nếu phải đổi chiều cao thanh trên/dưới thì ô ≥ 50 px khung game.
- Khoảng cách giữa hai nút cạnh nhau ≥ 8 px khung game; vùng chạm không chồng nhau.
- Safe area: `viewport-fit=cover` + padding `env(safe-area-inset-*)` cho phần tử chứa canvas.
- Chặn cuộn/zoom/chọn chữ chỉ trong vùng game (`touch-action: none`, `user-select: none` cho canvas và
  lớp phủ game), không khóa cả trang /admin.

## 4. Phân biệt bằng hình, không chỉ bằng màu

- Nhân vật (khi không có sprite): mỗi lớp một hình — Kiếm sĩ **vuông**, Cung thủ **tam giác**,
  Pháp sư **thoi**, Triệu hồi sư **lục giác** — vẫn giữ màu lớp. *(Người thiết kế quyết định.)*
- Độ hiếm: ngoài màu viền, thêm **chấm** ở góc ô: Thường 0, Hiếm 1, Sử thi 2 chấm. *(Người thiết kế
  quyết định; giữ nguyên với cả khi có sprite.)*
- Quái (khi không có sprite): thường **tròn**, nhanh **tam giác chĩa theo hướng đi**, trâu **vuông bo
  góc**, boss **bát giác** lớn. *(Người thiết kế quyết định.)*
- Bảng chi tiết nhân vật và thẻ bài đã có chữ — giữ nguyên.

## 5. Giảm chuyển động

- Cài đặt **"Giảm chuyển động"** (bật/tắt) trong popup, lưu `ps.motion` = `{ reduced: boolean }`.
  Mặc định theo `prefers-reduced-motion` của máy; người chơi đổi thì theo lựa chọn của người chơi.
- Khi bật: **không rung màn hình** khi quái lọt (thay bằng viền đỏ mờ ở mép bàn ≤ 200 ms + số máu
  nhấp một lần); hiệu ứng skill/trúng đích rút còn ≤ 200 ms, không xoay/không văng; chữ bay sát thương
  không bay lên (hiện tại chỗ rồi mờ); banner wave hiện/ẩn không phóng to. Đạn vẫn hiện (là tín hiệu
  trạng thái) nhưng không có vệt kéo dài.
- Khi tắt: rung màn hình khi quái lọt vẫn giảm biên độ còn một nửa và không rung lại trong 300 ms
  (hướng dẫn: "tránh rung camera thường xuyên"). *(Người thiết kế quyết định.)*

## 6. Popup tạm dừng theo chuẩn

Thứ tự: tiêu đề **Tạm dừng** → **Tiếp tục** (nổi bật nhất) → **Chơi lại** → hàng **Âm thanh**
(bật/tắt + âm lượng) → hàng **Giảm chuyển động** → **Màn hình chính**.
- **Chơi lại**: luôn hỏi "Chơi lại từ đầu? Ván này sẽ bị tính thua." (Có/Không). Có → ghi thua một lần
  (như "Ván mới" ở màn hình bắt đầu), kết thúc bản lưu, bắt đầu ván mới ngay.
- Phím: **Esc** hoặc **P** mở/đóng popup (đóng = Tiếp tục) khi không có quiz/màn kết quả/hộp xác nhận;
  trong hộp xác nhận Esc = Không. Phím **Space** = Tiếp tục khi popup mở.
- Vào/ra popup ≤ 200 ms (mờ dần), giảm chuyển động thì hiện ngay.

## 7. Màn kết quả và kỷ lục

- Tiêu đề trung tính: thắng **"Chiến thắng!"** (vàng); thua **"Kết thúc"** (màu chữ thường, không đỏ),
  dòng phụ "Bạn đã đến wave N". *(Người thiết kế quyết định.)*
- **Kỷ lục cá nhân** lưu ở máy: `ps.best` = `{ wave, kills, won }` (so sánh: wave cao hơn, bằng wave
  thì nhiều quái hơn). Phá kỷ lục → nhãn nhỏ **"Kỷ lục mới!"** cạnh dòng wave (không lấn át). Dữ liệu
  hỏng/thiếu → coi như chưa có kỷ lục, không hiện số giả.
- Nút chính **Chơi lại** nổi bật, **Màn hình chính** là nút phụ (đã có).

## 8. Màn hình bắt đầu

- Dưới nút chính hiện **"Kỷ lục: Wave N"** nếu có `ps.best` hợp lệ; không có thì không hiện gì.
- Không thêm tutorial bắt buộc. *(Người thiết kế quyết định: lần đầu chơi (chưa có `ps.best` và chưa có
  ván dở) hiện một dòng gợi ý ngắn dưới nút Chơi: "Triệu hồi nhân vật, kéo hai nhân vật giống nhau để
  gộp, chặn quái đến cửa Ra.")*

## 9. Chữ rõ trên màn hình DPR cao

- Mọi `Text` của Phaser dùng `resolution = min(devicePixelRatio, 2)` (một helper chung tạo style).
- Số lớn định dạng theo locale vi-VN (`12.450`) ở HUD vàng, máu boss, bảng xếp hạng. *(Đã có dấu cách
  ở thanh boss — thống nhất một cách.)*

## 10. Kiểm thử

- Đơn vị: lưu/đọc `ps.best` và so sánh kỷ lục; `ps.motion` + mặc định theo media query; quyết định
  hiện lớp phủ xoay (hàm thuần nhận kích thước + coarse); bố cục vùng chạm (hàm thuần tính hit area ≥ 82
  và không chồng nhau từ hằng số bố cục); định dạng số.
- Thủ công (trình duyệt, chế độ thiết bị của Chrome): 844×390 ngang, 390×844 dọc (lớp phủ + tự dừng),
  1280×720 desktop, 768 tablet; Esc/P/Space; giảm chuyển động bật/tắt; kỷ lục mới; chữ rõ ở DPR 2–3.

## 11. Để người làm tự quyết

- Hình cụ thể của biểu tượng xoay, kích thước chấm độ hiếm, màu viền cảnh báo khi quái lọt.
- Cách đạt vùng chạm (phóng to nút hay chỉ mở rộng hit area), miễn đạt số đo ở mục 3.

## 12. Làm rõ sau khi rà soát (người thiết kế quyết định — ghi đè các mục trên nếu mâu thuẫn)

1. **Cỡ chữ tối thiểu** (khung game 1280×720): chữ thiết yếu (HUD: máu, vàng, wave, đồng hồ; nhãn nút;
   popup; màn bắt đầu/kết quả; toast) ≥ **22 px**; chữ trong bảng chi tiết nhân vật ≥ **18 px** (được
   giãn bảng nếu cần); nhãn gắn trên bàn (số máu quái, sao cấp, nhãn Vào/Ra) ≥ **14 px**.
2. **Ô nhập tên ở màn kết quả** (DOM): cao ≥ 44 CSS px, cỡ chữ ≥ 16 CSS px (tránh iOS tự phóng to), nút
   "Gửi điểm" ≥ 44 CSS px; ô này **không** bị áp `user-select:none`. Được dời bố cục màn kết quả.
3. **Lớp phủ xoay ngang**: dùng một cờ dừng riêng (`orientationBlocked`) chặn `tick` giống `menuOpen`,
   áp dụng cả khi quiz/màn kết quả đang mở (đồng hồ quiz cũng dừng). Xoay ngang lại: nếu ván đang chạy và
   popup mở được (không quiz, không kết quả, không `halted`) thì mở popup Tạm dừng; nếu không thì chỉ bỏ
   cờ dừng. Ở màn hình bắt đầu và `/admin`: chỉ hiện lớp phủ (màn bắt đầu), không có logic dừng; `/admin`
   không có lớp phủ. Lớp phủ nằm trên mọi DOM của game (z-index cao hơn ô nhập tên).
4. **Máy tính bảng không bị nhắc xoay**: chỉ hiện lớp phủ khi `pointer: coarse` **và** khung dọc **và**
   `min(innerWidth, innerHeight) < 600` CSS px.
5. **Kỷ lục `ps.best`** cập nhật ở **mọi** lần một ván kết thúc và được ghi `ps_runs` (thắng/thua tự
   nhiên, thoát giữa wave, Chơi lại giữa ván, "Ván mới" ở màn bắt đầu, ván bị bỏ được phát hiện lúc mở
   game). So sánh: thắng hơn thua → wave cao hơn → nhiều quái hơn. "Kỷ lục mới!" chỉ hiện trên màn kết
   quả của ván vừa xong; đọc kỷ lục cũ **trước** khi ghi.
6. **Vùng chạm** đạt bằng mở rộng hit area và/hoặc dời bố cục. Gom các hằng số bố cục của thanh trên,
   thanh dưới, thẻ bài, popup, màn bắt đầu, màn kết quả vào `src/ui/layout.ts`; test thuần kiểm tra mỗi
   vùng chạm ≥ 82 px theo chiều nhỏ nhất, không chồng nhau, nằm trong khung. Ô bàn chơi ≥ 50 px (hiện 53);
   được bớt chiều cao thanh trên/dưới hoặc thu hẹp bảng chi tiết để giữ ô.
7. **Không khóa hướng màn hình / không thêm toàn màn hình** (bỏ ý `screen.orientation.lock` ở mục 2).
8. **Giảm chuyển động — thời lượng**: mỗi hiệu ứng skill/trúng đích tổng ≤ **200 ms** (kể cả sprite: cắt
   ở 200 ms); thẻ bài nhấp nháy khi vừa nhận đổi thành viền sáng tĩnh 600 ms; rung khi quái lọt khi
   **không** giảm chuyển động: `shake(150, 0.002)`, cách lần trước ≥ 300 ms. Bỏ các ý "không có vệt kéo
   dài" và "banner không phóng to" ở mục 5 (code hiện không có).
9. **Popup**: giữ nguyên hành vi hiện có của **Màn hình chính** (chuẩn bị: lưu rồi thoát; đang wave: hỏi
   tính thua) và của **Ván mới** ở màn bắt đầu (chỉ hỏi khi có ván dở). Chỉ thêm **Chơi lại** và hàng
   **Giảm chuyển động**, và chuyển hàng Âm thanh xuống dưới Chơi lại.
10. **Màn kết quả**: dòng phụ "Bạn đã đến wave N/15 · Quái đã giết K" (giữ số quái).
11. **Màn bắt đầu**: được dời vị trí các nút để có chỗ cho dòng kỷ lục và dòng gợi ý lần đầu.
12. **Chữ**: tạo helper chung `textStyle(...)` trong `src/ui/theme.ts` (gồm `resolution`) và chuyển mọi
    `Text` của game sang dùng nó. **Định dạng số giữ kiểu hiện có** (`viewMath.formatNum`, nhóm bằng dấu
    cách: `12 450`) và áp thêm cho vàng ở HUD và số quái ở bảng xếp hạng (giữ căn cột). Thay mục 9 về
    vi-VN dấu chấm.

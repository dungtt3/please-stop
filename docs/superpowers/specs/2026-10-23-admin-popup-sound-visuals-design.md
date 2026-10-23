# Thiết kế: Trang /admin, popup trong màn chơi, âm thanh, hiệu ứng chiến đấu

Ngày: 2026-10-23. Bổ sung cho `2026-10-20-merge-defense-design.md` và
`2026-10-23-accounts-and-save-design.md`.

## 1. Ý tưởng và lý do

- Chỉ người dùng (chủ game, "admin") được chỉnh cân bằng. Người chơi không còn thấy
  menu cân bằng trong màn chơi.
- Nút ⚙ trong màn chơi trở thành popup tạm dừng cho người chơi: tiếp tục, âm thanh,
  về màn hình chính.
- Game hiện im lặng, chiến đấu khó đọc: đòn đánh trúng tức thì không có đạn, skill chỉ
  là một vòng tròn trắng chung, thanh máu quái không có số. Đợt này làm cho trận đấu
  dễ nhìn và có tiếng.

## 2. Mục tiêu / Không làm / Tuyệt đối tránh

**Mục tiêu**
- `/admin` + mật khẩu → menu cân bằng (người dùng đã xác nhận).
- Popup ⚙ trong màn chơi: Tiếp tục, Âm thanh, Màn hình chính (người dùng đã xác nhận).
- Hiệu ứng âm thanh ngắn tạo bằng code, có bật/tắt + âm lượng (người dùng đã xác nhận).
- Thanh máu có số cho quái và boss; đường đạn; hiệu ứng skill riêng từng lớp; thời gian
  hồi skill hiện trên bàn chơi (người dùng đã xác nhận).

**Không làm (đợt này)**
- Nhạc nền, file âm thanh.
- Tự vẽ ảnh/sprite cho nhân vật, đạn, skill: đợt này vẽ bằng hình khối Phaser, kèm khung
  để ghép asset người dùng gửi sau (mục 6.5).
- Thay đổi luật tính sát thương hay cân bằng.
- Nhiều tài khoản admin, phân quyền.

**Tuyệt đối tránh**
- Mật khẩu admin nằm trong code trang web (ai xem mã nguồn cũng đọc được).
- Hiệu ứng làm game giật trên máy yếu (giới hạn số hiệu ứng cùng lúc).
- Làm hỏng luật lưu ván đã có (popup/đi ra màn hình chính phải theo luật "thoát giữa
  wave = thua").

## 3. Trang /admin

- Địa chỉ `/admin` (cả `localhost:5173/admin` lúc dev và trên Vercel). Trang riêng,
  không chạy game.
- Vào trang → ô nhập **mã quản trị** + nút "Mở". Mã được kiểm tra ở **server**: hàm mới
  `ps_admin_check(p_code text) returns boolean` (security definer, `search_path = ''`,
  gọi lại logic bcrypt của `ps_check_admin` có sẵn, grant cho `anon, authenticated`),
  trong migration mới `supabase/migrations/<timestamp>_ps_admin_check.sql`. Sai mã →
  "Sai mã quản trị". Không có Supabase → "Không kết nối được".
  *(Người thiết kế quyết định: dùng lại mã quản trị đã có trên Supabase thay cho mật khẩu
  mới — người dùng chưa xác nhận.)*
- Đúng mã → tải cấu hình cloud rồi hiện menu cân bằng (dùng lại `ConfigMenu` hiện có)
  với các chức năng: sửa giá trị, **Lưu lên cloud** (áp dụng cho mọi người, ván sau),
  **Gỡ cấu hình cloud** (về mặc định), **Xuất/Nhập JSON**, nút **Về cấu hình cloud**
  (bỏ mọi chỉnh sửa chưa lưu) và nút ↺ từng ô (về mặc định) như cũ.
- **Tải cấu hình cloud phải phân biệt "lỗi mạng" với "cloud chưa có cấu hình"**
  *(người thiết kế quyết định, để không ghi đè cấu hình thật bằng giá trị mặc định)*:
  - chưa có cấu hình → menu bắt đầu từ mặc định, ghi rõ "Cloud chưa có cấu hình — đang
    hiện giá trị mặc định";
  - lỗi mạng/hết giờ → **không hiện menu**, chỉ hiện "Không tải được cấu hình cloud" và
    nút **Thử lại**. Không bao giờ cho Lưu khi chưa tải được.
- Mã đã nhập ở cổng `/admin` được dùng luôn cho Lưu/Gỡ: bỏ ô nhập mã trong hộp cloud của
  `ConfigMenu` và bỏ việc lưu mã vào `sessionStorage['ps.adminCode']`; mã chỉ giữ trong bộ
  nhớ trang. Sửa luôn các dòng chú thích nhắc tới "bản riêng trong trình duyệt" trong menu.
- Bỏ khỏi menu: "Áp dụng & chơi lại", "Lưu" cục bộ, "Bỏ cấu hình riêng của trình duyệt"
  — vì menu không còn gắn với một ván đang chơi.
- **Bỏ cấu hình riêng của trình duyệt** (`merge-defense.config.v1`): người chơi luôn dùng
  cấu hình cloud (hoặc mặc định nếu cloud trống/lỗi). Bản riêng cũ còn trong trình duyệt
  bị bỏ qua (không cần xóa). *(Người thiết kế quyết định.)*
- Không có link tới `/admin` trong game.

## 4. Popup ⚙ trong màn chơi

- Nút ⚙ ở thanh trên mở popup giữa màn hình; ván **tạm dừng** khi popup mở (như menu
  cũ). Chạm ra ngoài popup không đóng nó (tránh bấm nhầm) — đóng bằng **Tiếp tục**.
- Nội dung:
  - **Tiếp tục** — đóng popup, chạy tiếp.
  - **Âm thanh**: nút bật/tắt và thanh âm lượng (0–100%).
  - **Màn hình chính**:
    - Lúc chuẩn bị: lưu ván, **chờ lần lưu đó xong** (tối đa `TIMEOUT_MS`, hiện "Đang
      lưu…") rồi mới về màn hình bắt đầu (ở đó có "Chơi tiếp"). Hết giờ vẫn đi tiếp — bản
      sao trên máy đã có và sẽ được đẩy lên ở lần tải sau. *(Người thiết kế quyết định.)*
    - Lúc wave đang chạy: hỏi "Thoát bây giờ sẽ bị tính thua. Thoát?" (Có/Không). Có →
      ghi thua như ván thua bình thường (`recordRun`, `end` bản lưu), về màn hình bắt đầu
      — không hiện màn kết quả. *(Người thiết kế quyết định: không hiện màn kết quả.)*
    - Ván đã thắng/thua: màn kết quả đã có nút riêng; popup không mở được khi màn kết quả
      đang hiện.
- Popup không mở được khi quiz đang mở hoặc ván đang dừng vì xung đột lưu.

## 5. Âm thanh

- Tạo bằng Web Audio (oscillator + envelope), không file. Một module `src/audio/sfx.ts`
  (không import Phaser) với các tiếng:
  triệu hồi, gộp, đánh thường (rất nhỏ), chí mạng, giết quái, boss chết, quái lọt qua,
  bắt đầu wave, hết wave, quiz đúng, quiz sai, skill (mỗi lớp một tiếng), thắng, thua,
  bấm nút.
- Giới hạn: cùng một loại tiếng tối đa 1 lần mỗi 60 ms (đánh thường nhiều quái không
  thành tiếng ồn); tổng tối đa 8 tiếng phát cùng lúc.
- Trình duyệt chỉ cho phát âm thanh sau lần chạm/bấm đầu tiên: tạo `AudioContext` lười
  ở lần bấm đầu tiên (nút Chơi), không báo lỗi nếu không tạo được.
- Cài đặt lưu ở localStorage khóa `ps.sound` = `{ on: boolean, volume: number }`, mặc
  định bật, âm lượng 60%. Bị chặn lưu trữ → dùng mặc định, không báo lỗi.
- Âm thanh dừng khi popup mở hoặc tab bị ẩn (`AudioContext.suspend`).

## 6. Hiệu ứng chiến đấu

Chỉ là phần vẽ: **luật sim giữ nguyên**, cân bằng không đổi. Sim phát thêm event để phần
vẽ biết vẽ gì; `src/sim/**` vẫn không import Phaser.

### 6.1 Thanh máu có số
- Mọi quái: thanh máu rộng bằng ~70% ô, cao 6 px, phía trên quái; số máu còn lại (làm
  tròn lên) nằm trên thanh, chữ nhỏ có viền đen.
- Boss: thêm **thanh máu lớn** ngay dưới thanh trên cùng, ghi `Trùm  1 234 / 2 500`,
  hiện khi có boss còn sống (nhiều boss → thanh của boss đi xa nhất).
  *(Người thiết kế quyết định: thanh lớn riêng cho boss — người dùng chưa xác nhận.)*

### 6.2 Đường đạn
- Sim phát event mới `attack { unitId, from: Vec, to: Vec, classId, crit }` mỗi đòn đánh
  thường (và lính triệu hồi: `classId: 'minion'`).
- Vẽ: Cung thủ — mũi tên bay; Pháp sư — quả cầu lửa bay, trúng thì vòng nổ theo
  `splashRadius`; Kiếm sĩ — vệt chém ngắn trên mục tiêu (không bay); lính — vệt nhỏ.
  Thời gian bay ~0,15 s; chí mạng to hơn/màu khác.
- Số sát thương vẫn hiện tại thời điểm sim tính (không trễ theo đạn).
  *(Người thiết kế quyết định: đạn chỉ để nhìn, không đổi thời điểm trúng.)*
- Giới hạn tối đa 60 đạn đang bay; vượt thì bỏ hiệu ứng mới (sát thương vẫn tính).

### 6.3 Skill từng lớp
- Event `skill` có sẵn được bổ sung dữ liệu đủ để vẽ: vị trí nhân vật, các vị trí trúng
  (cung thủ, pháp sư), bán kính (pháp sư `meteorRadius`).
- Kiếm sĩ: vòng chém xoay quanh nhân vật theo tầm. Cung thủ: mũi tên rơi xuống từng quái
  bị trúng. Pháp sư: thiên thạch rơi rồi nổ theo bán kính. Triệu hồi sư: vòng triệu hồi
  tại chỗ lính xuất hiện. Mỗi hiệu ứng ≤ 0,6 s.

### 6.4 Hồi skill trên bàn chơi
- Mỗi nhân vật trên bàn có thanh hồi skill mảnh (3 px) ở cạnh dưới ô, đầy dần theo
  thời gian hồi; khi skill sẵn sàng thanh sáng màu khác. Bảng chi tiết bên phải giữ nguyên.
- Hồi skill chỉ chạy trong wave (luật sim hiện có), nên lúc chuẩn bị thanh đứng yên — đúng
  như vậy là chấp nhận được. "Sẵn sàng" nghĩa là hồi xong; skill sẽ dùng khi có quái trong tầm.

### 6.3b Dữ liệu event skill
- Người làm tự bổ sung các trường cần để vẽ: vị trí nhân vật, tầm (kiếm sĩ), các điểm
  trúng (cung thủ), tâm và bán kính thiên thạch (pháp sư), các vị trí lính xuất hiện
  (triệu hồi sư — `spawnMinion` cần trả về vị trí thay vì boolean).

### 6.5 Khung ghép hiệu ứng và hoạt ảnh (người dùng sẽ gửi asset sau)

Người dùng sẽ gửi sau các hiệu ứng và hoạt ảnh nhân vật; đợt này dựng sẵn khung để khi đó
**chỉ cần thả file vào và khai báo**, không phải sửa code vẽ (người dùng đã yêu cầu).

- **Mỗi thứ được vẽ có một "khóa hình"** (visual key), ví dụ:
  - nhân vật: `unit.<lớp>.idle`, `unit.<lớp>.attack`, `unit.<lớp>.skill`
    (`<lớp>` = `swordsman | archer | mage | summoner`), lính: `minion.idle`, `minion.attack`;
  - quái: `enemy.<loại>.walk`, `enemy.<loại>.die` (`normal | fast | tank | boss`);
  - đạn: `projectile.<lớp>`, `projectile.minion`; trúng đích: `impact.<lớp>`;
  - skill: `skill.<lớp>` (và `skill.mage.meteor`, `skill.archer.arrow` cho phần rơi xuống);
  - chí mạng: `impact.crit`.
- **Bản khai báo asset** (`public/sprites/manifest.json`): mỗi khóa trỏ tới một file và
  cách cắt khung. Hỗ trợ hai dạng phổ biến *(người thiết kế quyết định)*:
  - spritesheet PNG lưới đều: `{ "type": "sheet", "file": "...png", "frameWidth", "frameHeight", "frames"?, "fps", "loop" }`;
  - texture atlas JSON kiểu Phaser/TexturePacker/Aseprite (JSON hash):
    `{ "type": "atlas", "file": "...png", "data": "...json", "prefix"?, "fps", "loop" }`;
  - tùy chọn chung: `scale`, `originX`, `originY`, `tint`, `rotateToTarget` (cho đạn).
- **Không có khóa trong manifest (hoặc file lỗi) → dùng hình khối mặc định** của mục
  6.1–6.4. Game luôn chạy được khi chưa có asset nào; lỗi tải một file chỉ ghi cảnh báo
  console và rơi về hình khối cho khóa đó.
- Tải manifest và asset ở màn hình bắt đầu (trước khi vào ván), có giới hạn thời gian;
  quá giờ thì vào game bằng hình khối.
- Cách vẽ trong GameScene chuyển từ vẽ lại toàn bộ bằng một `Graphics` mỗi khung hình sang
  **mỗi nhân vật/quái/lính có một đối tượng hiển thị riêng** (view) giữ theo id, để gắn
  được sprite và hoạt ảnh (idle ↔ attack ↔ skill; walk ↔ die). Hoạt ảnh `attack` chạy khi
  có event `attack` của nhân vật đó, `skill` khi có event `skill`, `die` khi quái chết
  (view tự hủy khi hết hoạt ảnh).
- Viết một tài liệu ngắn `docs/assets.md`: danh sách khóa hình, định dạng manifest, kích
  thước khuyến nghị (theo ô 64 px), ví dụ một mục cho mỗi dạng — để người dùng chuẩn bị
  asset đúng chuẩn.
- Kèm 1–2 asset mẫu tự tạo đơn giản (hoặc chỉ manifest mẫu trỏ tới file không tồn tại để
  chứng minh đường rơi về hình khối) — người làm chọn, miễn có test/kiểm tra thủ công cho
  cả hai đường "có asset" và "không có asset".

## 7. Kiểm thử

- Đơn vị: event `attack` và dữ liệu event `skill` mới (sim); giới hạn tần suất và lưu cài
  đặt âm thanh (`sfx.ts` với AudioContext giả); `resolveConfig` bỏ qua bản riêng; luật nút
  Màn hình chính (lưu khi chuẩn bị / thua khi đang wave) ở phần logic không có Phaser.
- Thủ công: `/admin` sai/đúng mã, lưu cloud; popup trong từng giai đoạn; âm thanh bật/tắt;
  nhìn đạn, skill, thanh máu, thanh hồi skill; không giật khi wave đông.

## 8. Để người làm tự quyết

- Cấu trúc file, hình dáng và màu cụ thể của hiệu ứng, âm sắc từng tiếng.
- Cách làm trang `/admin` (trang HTML thứ hai của Vite hoặc định tuyến trong một trang),
  miễn `/admin` mở được cả khi dev và trên Vercel.

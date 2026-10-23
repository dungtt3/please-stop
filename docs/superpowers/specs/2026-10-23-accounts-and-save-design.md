# Thiết kế: Màn hình bắt đầu, lưu ván dở và đăng nhập Google

Ngày: 2026-10-23. Bổ sung cho `2026-10-20-merge-defense-design.md`.

## 1. Ý tưởng và lý do

Người chơi muốn **chơi tiếp ván đang dở ở thiết bị khác hoặc phiên khác mà không bị
bắt đầu lại từ đầu**. Hiện tại game vào thẳng màn chơi, không lưu gì về ván đang
chơi (F5 là mất ván), chỉ nhớ tên người chơi cho bảng xếp hạng.

Để làm được điều đó cần ba thứ:

1. **Màn hình bắt đầu** có nút Chơi / Chơi tiếp và nút đăng nhập.
2. **Lưu ván dở** giữa các wave.
3. **Tài khoản (đăng nhập Google)** để mang ván dở sang máy khác.

## 2. Mục tiêu / Không làm / Tuyệt đối tránh

**Mục tiêu**
- Thoát lúc đang chuẩn bị giữa hai wave → lần sau vào lại đúng trạng thái đó.
- Đã đăng nhập Google → vào lại được ở bất kỳ máy/trình duyệt nào.
- Khách (không đăng nhập) vẫn chơi đầy đủ, ván dở lưu trên trình duyệt đó.

**Không làm (đợt này)**
- Đăng nhập Facebook: để đợt sau. Code chừa chỗ để thêm provider mà không phải sửa
  luồng (người dùng đã xác nhận).
- Đăng ký bằng email/mật khẩu.
- Chống gian lận cho bản lưu (bảng xếp hạng hiện tại vốn đã cho ghi tự do).
- Lưu/khôi phục giữa lúc wave đang chạy.
- Hồ sơ người chơi, lịch sử ván, thành tích.

**Tuyệt đối tránh**
- Làm hỏng app kia đang dùng chung dự án Supabase (xem mục 7).
- Khách bị chặn không cho chơi, hoặc bị ép đăng nhập.
- Mất mạng làm hỏng hoặc treo game: mọi lệnh mạng đều có giới hạn thời gian và
  game vẫn chơi được khi offline (giống `src/net/cloud.ts` hiện tại).

## 3. Luật lưu ván (người dùng đã xác nhận)

- Chỉ lưu khi đang ở **giai đoạn chuẩn bị** (`phase === 'prep'`). Bản lưu giữ
  nguyên **đội hình nhân vật, cấp, thẻ và vàng** như lúc thoát.
- **Thoát giữa lúc wave đang chạy = thua.** Bản lưu bị xóa, ván được tính như một
  ván thua bình thường.
- Thắng hoặc thua: bản lưu bị xóa.
- Mỗi người chơi (mỗi tài khoản, hoặc mỗi trình duyệt nếu là khách) có tối đa
  **một** ván dở.

### 3.1 Cách làm cụ thể (người thiết kế quyết định, người dùng chưa xác nhận)

- **Lưu gì:** toàn bộ `GameState` cần để chơi tiếp: `wave`, `hp`, `gold`,
  `prepTimer`, `slots`, `units` (**toàn bộ object `Unit`**, kể cả `classId`, `slot`,
  `skillCooldown`, `passiveTimer`, `attackCount`, vì `endWave` chỉ đặt lại
  `attackCooldown`), `hand`, `summonCount`, `drawCount`, `luckLevel`, `modifier`,
  `quizUsedThisPrep`, `kills`, `nextId`, **trạng thái RNG** và **bản cấu hình
  (`config`) của ván đó**. `map` và `pathLen` dựng lại từ `config`. Không lưu
  `enemies`, `minions`, `spawnQueue`, `events` (lúc chuẩn bị chúng rỗng). Thêm
  `version` của định dạng lưu, `runId` (uuid, tạo khi bắt đầu ván), `deviceId`
  (uuid cố định của trình duyệt, lưu trong localStorage) và số giây đã chơi
  (`runSeconds`) để thống kê `ps_runs` vẫn đúng.
- **RNG lưu cùng:** `createRng` trong `src/sim/rng.ts` cần cho đọc/khôi phục
  trạng thái nội bộ. Nhờ vậy thoát ra vào lại không "quay" lại được modifier, kết
  quả triệu hồi hay câu quiz.
- **Cấu hình lưu cùng:** nếu admin đổi cấu hình cân bằng giữa hai lần chơi, ván dở
  vẫn chạy bằng cấu hình lúc bắt đầu ván. Khi khôi phục vẫn chạy kiểm tra hợp lệ
  cấu hình hiện có; bản lưu không hợp lệ hoặc sai `version` thì bỏ qua (coi như
  không có ván dở) và báo ngắn cho người chơi.
- **Khi nào ghi:** ngay khi bước vào giai đoạn chuẩn bị (sau `waveEnd`), và sau
  mỗi thao tác trong lúc chuẩn bị (triệu hồi, gộp, bán, gắn thẻ, rút thẻ, nâng may
  mắn, trả lời quiz), gộp lại để không ghi dồn dập (khoảng 1 giây). Ghi thêm khi
  tab bị ẩn (`visibilitychange`).
- **Đồng hồ chuẩn bị:** khôi phục đúng số giây còn lại lúc lưu, nhưng tối thiểu
  10 giây để người chơi kịp nhìn lại bàn.
- **Quiz đang mở lúc thoát:** coi như đã dùng lượt quiz của lần chuẩn bị này, không
  thưởng (khôi phục với `quiz = null`, `quizUsedThisPrep = true`).
- **Phát hiện "thoát giữa wave":** khi wave bắt đầu, ghi ngay bản lưu với cờ
  `inWave: true` (giữ trạng thái lúc vừa bắt đầu wave). Hết wave thì ghi đè bằng
  bản lưu chuẩn bị mới. Lần sau mở game mà thấy `inWave: true` → ván đó **thua**:
  ghi `ps_runs` (thua, wave đang đánh), xóa bản lưu, rồi hiện màn kết quả "Thua"
  cho ván đó để người chơi vẫn gửi điểm lên bảng xếp hạng như thua bình thường.
  - Ngoại lệ: bản lưu `inWave` có `deviceId` **khác** máy đang mở **và** mới ghi
    trong vòng 10 phút → có thể ván đang được chơi thật ở máy khác. Không tính thua
    ngay; màn hình bắt đầu ghi "Ván đang được chơi ở thiết bị khác (wave N)" và chỉ
    cho **Ván mới** (bấm thì ván kia tính thua, như mục dưới). Quá 10 phút, hoặc
    cùng `deviceId` → tính thua ngay như trên. *(người thiết kế quyết định)*
  - Chỉ ghi `ps_runs` cho ván thua khi chính lần gọi đó xóa được bản lưu (xem
    6.2), để một ván không bị tính thua hai lần.
- **Ván mới khi đang có ván dở:** màn hình bắt đầu hỏi xác nhận "Bỏ ván đang chơi
  dở?". Đồng ý → ván cũ tính thua (ghi `ps_runs`, không hiện màn kết quả), rồi
  bắt đầu ván mới. Áp dụng cả khi admin đổi cấu hình trong menu cân bằng rồi khởi
  động lại ván.

## 4. Màn hình bắt đầu (nút Play)

Hiện ra khi mở game, trước khi vào bàn chơi. Vẽ bằng Phaser cùng phong cách với
`ResultScreen` (dùng `Button` trong `src/ui/BottomBar.ts`, `COLORS`, `FONT` trong
`src/ui/theme.ts`).

- Tên game.
- **Chơi tiếp — Wave N** (nút chính) khi có ván dở; kèm nút **Ván mới**.
  Không có ván dở → chỉ một nút **Chơi**.
- Chưa đăng nhập: nút **Đăng nhập bằng Google** và dòng nhỏ "Đăng nhập để chơi tiếp
  trên thiết bị khác".
- Đã đăng nhập: hiện tên tài khoản và nút **Đăng xuất**.
- Khi đang tải bản lưu trên cloud: hiện "Đang tải…", tối đa theo `TIMEOUT_MS`;
  quá giờ thì dùng bản lưu cục bộ (nếu có) và báo "Không kết nối được, đang dùng
  bản lưu trên máy này".
- Không có Supabase (thiếu biến môi trường) → ẩn nút đăng nhập, game vẫn chạy như
  khách.

Đăng nhập/đăng xuất **chỉ có ở màn hình bắt đầu** (người thiết kế quyết định) vì
đăng nhập Google chuyển trang, rời khỏi game rồi quay lại.

Nút "Chơi lại" ở màn kết quả giữ như cũ (vào ván mới luôn). *Người thiết kế quyết
định:* thêm nút nhỏ "Màn hình chính" ở màn kết quả để quay về màn hình bắt đầu.

## 5. Tài khoản

- Chỉ **Google** đợt này, qua Supabase Auth (`signInWithOAuth({ provider: 'google' })`,
  chuyển trang, `redirectTo` là địa chỉ trang hiện tại).
- Client Supabase trong `src/net/supabase.ts` phải bật `persistSession` và
  `autoRefreshToken`, với `storageKey` riêng (vd `ps.auth`) để không đụng app khác.
  Chạy được khi người chơi chặn localStorage (khi đó đăng nhập chỉ sống trong phiên).
- Danh sách provider đặt ở một chỗ (vd mảng `['google']`) để đợt sau thêm
  `'facebook'` chỉ là thêm một phần tử và một nút.
- Tên hiển thị: lấy từ `user_metadata` của Google (`full_name` hoặc `name`), qua
  `sanitizeName`.
- *Người thiết kế quyết định:* khi đã đăng nhập, ô tên ở màn kết quả điền sẵn tên
  tài khoản nếu người chơi chưa từng nhập tên; người chơi vẫn sửa được. Điểm trên
  bảng xếp hạng **không** gắn với tài khoản (bảng `ps_scores` giữ nguyên).

## 6. Lưu ở đâu và đồng bộ

### 6.1 Khách
- `localStorage`, khóa `ps.save.guest`. Bọc try/catch như `configStore.ts`; bị chặn
  thì chơi bình thường nhưng không lưu được (báo một lần).

### 6.2 Đã đăng nhập
- Bảng mới `public.ps_saves` trên Supabase (migration mới trong `supabase/migrations/`):
  - `user_id uuid primary key references auth.users(id) on delete cascade`
  - `run_id uuid not null`
  - `rev bigint not null` (do **server** tăng, xem dưới)
  - `save jsonb not null` (CHECK là object **và** CHECK `pg_column_size(save) <= 200000`
    ngay trên bảng; `ps_configs` chỉ giới hạn trong hàm nên không chép được)
  - `in_wave boolean not null`, `device_id uuid not null`
  - `updated_at timestamptz not null default now()`
  - RLS bật; `anon` và `authenticated` **chỉ được select** dòng của mình
    (`user_id = auth.uid()`). Mọi ghi/xóa đi qua hai hàm `security definer`,
    `search_path = ''`, dùng `auth.uid()` (không nhận user id từ client):
    - `ps_put_save(p_run_id, p_base_rev, p_save, p_in_wave, p_device_id) returns bigint`:
      chưa có dòng → chèn với `rev = 1` (chỉ khi `p_base_rev = 0`); có dòng cùng
      `run_id` và `rev = p_base_rev` → cập nhật, `rev = rev + 1`; còn lại → báo lỗi
      xung đột (errcode riêng). Trả về `rev` mới.
    - `ps_end_save(p_run_id, p_device_id, p_known_rev) returns boolean`: xóa dòng
      nếu `run_id` khớp **và** (`device_id = p_device_id` hoặc `rev <= p_known_rev`),
      trả về có xóa được hay không. Nhờ vậy một lệnh kết thúc gửi muộn (máy offline)
      không xóa được tiến độ mới hơn mà máy khác đã chơi tiếp. `ps.ended` lưu
      `{ runId, rev }`.
    - `ps_get_save()`: đọc dòng của người chơi kèm `age_ms` tính bằng đồng hồ server
      (dùng cho luật "đang chơi ở thiết bị khác < 10 phút"), chưa đăng nhập → lỗi
      `28000`.
    *(Hai điểm trên được thêm sau lượt rà soát toàn nhánh.)*
  - Vì mỗi ván có `run_id` riêng, `rev` bắt đầu lại từ 1 cho ván mới cũng không gây
    nhầm: máy cũ ghi với `run_id` cũ sẽ bị từ chối.
- **Bản sao cục bộ** khóa `ps.save.<user_id>`: `{ save, runId, baseRev, dirty }`
  (`baseRev` = `rev` server đã xác nhận gần nhất; `dirty` = có thay đổi chưa đẩy
  lên). Thêm danh sách `ps.ended.<user_id>` các `runId` đã kết thúc nhưng chưa xóa
  được trên cloud (mất mạng).
- **Khi mở game (đã đăng nhập):**
  1. Gửi lại các lệnh `ps_end_save` còn treo trong `ps.ended`; bỏ khỏi danh sách khi
     server trả lời (xóa được hay không đều được).
  2. Lấy dòng trên cloud. Dòng có `run_id` nằm trong `ps.ended` → coi như không có.
  3. Bản cục bộ cùng `runId` với cloud, `dirty` và `baseRev` = `rev` cloud → đẩy bản
     cục bộ lên rồi dùng. `baseRev` khác → cloud thắng (máy khác đã chơi tiếp), bỏ
     bản cục bộ.
  4. Bản cục bộ khác `runId` với cloud → dùng bản cloud, bỏ bản cục bộ.
  5. Cloud không có dòng, bản cục bộ `dirty` với `baseRev = 0` (ván mới tạo lúc
     offline) → đẩy lên. `baseRev > 0` → ván đã kết thúc ở nơi khác, bỏ bản cục bộ.
  6. Không kết nối được cloud → dùng bản cục bộ, ghi `dirty` như bình thường.
- **Đang chơi:** mỗi lần lưu ghi cục bộ trước (`dirty = true`), rồi gọi
  `ps_put_save` với `baseRev`. Thành công → `baseRev = rev mới`, `dirty = false`.
  Lỗi xung đột → dừng ván ở máy này, báo "Ván này đã được chơi ở thiết bị khác",
  về màn hình bắt đầu. Lỗi mạng → giữ `dirty`, thử lại ở lần lưu sau; không báo lỗi
  dồn dập.
- **Kết thúc ván** (thắng, thua, bỏ ván): xóa bản cục bộ, gọi `ps_end_save`; mất
  mạng thì thêm `runId` vào `ps.ended`. `ps_runs` ghi ngay ở máy kết thúc ván (như
  hiện tại); với ván thua phát hiện lúc mở game (`inWave`) thì chỉ ghi khi
  `ps_end_save` trả `true`, hoặc khi đó là bản cục bộ của chính máy này lúc offline.
- Giới hạn đã chấp nhận: nếu bản lưu `inWave` chỉ ghi được cục bộ (mất mạng) mà người
  chơi mở máy khác, máy kia vẫn thấy bản chuẩn bị cũ và chơi tiếp được. Không chống
  trường hợp này (không làm chống gian lận).

### 6.3 Khách đăng nhập khi đang có ván dở
*(người thiết kế quyết định)*
- Tài khoản chưa có ván dở → chuyển ván của khách sang tài khoản, xóa
  `ps.save.guest`.
- Cả hai đều có → hỏi người chơi giữ ván nào (hiện số wave của mỗi bên). Ván bị bỏ
  tính thua (ghi `ps_runs`).
- Đăng xuất → quay về chế độ khách; ván của tài khoản vẫn nằm trên cloud, không
  chép về `ps.save.guest`.

## 7. Supabase dùng chung với app khác

Người dùng đã xác nhận: **bật đăng nhập Google trên dự án Supabase dùng chung**.
Đây là thay đổi cài đặt cấp dự án, khác với nguyên tắc "không đổi cài đặt dự án"
của migration trước, nên phải làm thận trọng:

- Các bước làm tay (ghi vào README hoặc `docs/`, không tự động hóa):
  1. Google Cloud Console: tạo OAuth client loại Web; Authorized redirect URI là
     `https://<project-ref>.supabase.co/auth/v1/callback`.
  2. Supabase → Authentication → Providers → Google: bật, dán Client ID/Secret.
     Nếu Google đã bật sẵn cho app kia thì dùng chung, không sửa.
  3. Supabase → Authentication → URL Configuration: **chỉ thêm** vào *Redirect URLs*
     (không đổi Site URL):
     - `http://localhost:5173/**` (vite dev)
     - `https://please-stop-*-<team-slug>.vercel.app/**` cho link preview Vercel
       (game hiện chỉ chạy ở link preview; `<team-slug>` lấy trong Vercel dashboard
       của team `team_PVowfLDQupx3RFsOazvYAbzE`). **Không** dùng
       `https://*.vercel.app/**` hay `please-stop-*.vercel.app` không kèm team slug:
       project Vercel của người khác cũng khớp được và lấy được token đăng nhập.
     - Khi có domain thật thì thêm domain đó.
- `redirectTo` = `window.location.origin + window.location.pathname` để mỗi link
  preview quay về đúng chính nó. Nếu địa chỉ không nằm trong danh sách, Supabase sẽ
  chuyển về Site URL, nên làm bước 3 trước khi phát hành.
- **Đã kiểm tra app kia** (`Create-animation`, cùng project `isakeypiyonhxfhxfmtt`):
  không dùng Supabase Auth, chỉ có bảng `public.scores` cho `anon` và `authenticated`
  cùng quyền select/insert. Không có trigger trên `auth.users`, không có auth hook,
  `supabase/config.toml` cục bộ không bật Google và cho đăng ký mới. Vì vậy người
  chơi game có role `authenticated` cũng không có thêm quyền gì với dữ liệu app kia.
  Người làm vẫn nên xem nhanh dashboard (Auth → Providers, Sign In / Up) để chắc
  cấu hình trên server khớp với file cục bộ.
- Mọi bảng/hàm mới vẫn dùng tiền tố `ps_`.

## 8. Kiểm thử

- Đơn vị (vitest): lưu → khôi phục ra `GameState` tương đương; RNG sau khi khôi
  phục cho cùng dãy số; bản lưu hỏng/sai version bị bỏ qua; `inWave` → thua; quy
  tắc gộp khách/tài khoản; xung đột `rev`.
- Thủ công: khách F5 lúc chuẩn bị → chơi tiếp đúng; F5 giữa wave → thua; đăng nhập
  Google trên hai trình duyệt → chơi tiếp được qua lại; offline → vẫn chơi như
  khách/bản cục bộ.

## 9. Việc cần người dùng làm / còn mở

- Tạo OAuth client Google, bật provider và thêm Redirect URLs (mục 7). Code tự
  chạy được trước khi xong bước này (nút đăng nhập chỉ báo lỗi, khách vẫn chơi).
- Domain thật: chưa có, hiện dùng link preview Vercel (người dùng đã xác nhận).

## 10. Để người làm tự quyết

- Cấu trúc file (vd `src/sim/save.ts` cho đóng gói/khôi phục, `src/net/auth.ts`,
  `src/net/saves.ts`, `src/scenes/StartScene.ts` hoặc một overlay trong
  `GameScene`).
- Bố cục chi tiết màn hình bắt đầu, miễn cùng phong cách hiện tại.
- Thời gian gộp lần ghi, cách hiện thông báo (dùng `Toast` sẵn có).

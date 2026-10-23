# Thiết lập đăng nhập Google (làm tay, một lần)

Game dùng Supabase Auth để đăng nhập Google. Dự án Supabase này **dùng chung với app khác**
(`Create-animation`), nên các bước dưới đây là thay đổi cài đặt cấp dự án và phải làm thận trọng.
Không có bước nào được tự động hóa bằng code hay Supabase CLI.

Code chạy được trước khi làm xong các bước này: nút đăng nhập chỉ báo lỗi, người chơi khách vẫn chơi
bình thường.

## Bước 1. Google Cloud Console: tạo OAuth client

1. Vào Google Cloud Console, tạo **OAuth client ID** loại **Web application**.
2. Ở *Authorized redirect URIs*, thêm:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   (`<project-ref>` là mã dự án Supabase, lấy trong Supabase → Project Settings.)
3. Lưu lại **Client ID** và **Client Secret**.

## Bước 2. Supabase: bật provider Google

Supabase → Authentication → Providers → **Google**: bật, dán Client ID và Client Secret.

Nếu Google đã được bật sẵn cho app kia thì dùng chung, **không sửa** gì.

## Bước 3. Supabase: thêm Redirect URLs

Supabase → Authentication → URL Configuration. Chỉ **thêm** vào *Redirect URLs*:

- `http://localhost:5173/**` (vite dev)
- `https://please-stop-*-<team-slug>.vercel.app/**` cho link preview Vercel. Game hiện chỉ chạy ở
  link preview. `<team-slug>` lấy trong Vercel dashboard của team
  `team_PVowfLDQupx3RFsOazvYAbzE`.
- Khi có domain thật thì thêm domain đó.

### Cảnh báo

- **Không** dùng `https://*.vercel.app/**`, và **không** dùng `https://please-stop-*.vercel.app/**`
  mà thiếu team slug. Project Vercel của người khác cũng khớp mẫu đó và lấy được token đăng nhập
  của người chơi.
- **Không đổi Site URL.** App kia đang dùng nó. Chỉ thêm Redirect URLs.
- Làm bước 3 **trước khi phát hành**: nếu địa chỉ trang không nằm trong danh sách, Supabase sẽ
  chuyển người chơi về Site URL thay vì về game.

## Cách thử

`redirectTo` của game là `window.location.origin + window.location.pathname`, nên mỗi link preview
quay về đúng chính nó.

1. Chạy `npm run dev`, mở `http://localhost:5173`, bấm **Đăng nhập bằng Google**.
2. Nếu chưa bật provider (bước 2), Supabase trả lỗi (vd `provider is not enabled`) và nút báo lỗi;
   game vẫn chơi được như khách.
3. Nếu đã bật: trình duyệt chuyển sang Google, chọn tài khoản, rồi quay về game với tên tài khoản
   hiện trên màn bắt đầu. Thử thêm trên một trình duyệt khác để kiểm tra chơi tiếp qua lại giữa hai
   thiết bị.
4. Nếu bị chuyển về một trang khác thay vì game, địa chỉ hiện tại chưa nằm trong Redirect URLs
   (bước 3).

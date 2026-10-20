# Thiết kế: Web game Merge Defense (bản chơi thử đầu tiên)

Ngày: 2026-10-20

## 1. Ý tưởng và lý do

Web game thủ thành kiểu **merge defense** (tham khảo cảm giác của Random Dice / Lucky Defense):
quái đi theo một con đường từ điểm Start đến điểm End, người chơi đặt nhân vật ở các ô
cạnh đường để tiêu diệt quái. Quái lọt đến End sẽ trừ HP tổng của người chơi.

Điểm cốt lõi người dùng muốn:

- **Người chơi rảnh tay tối đa.** Không ngắm, không bấm skill, không cần phản xạ trong
  lúc đánh. Sức chơi nằm ở *quyết định*: triệu hồi, đặt vị trí, gộp, nâng chỉ số.
- **Nhiều may rủi.** Triệu hồi ngẫu nhiên, chỉ số cộng thêm ngẫu nhiên, chí mạng/proc,
  modifier ngẫu nhiên mỗi wave.
- **Quiz toán nhanh** giữa các wave để kiếm thêm thưởng — phần duy nhất cần phản xạ, và
  là tùy chọn.

Bản đầu tiên là **bản chơi thử** để cảm nhận vòng lặp gameplay, chưa phải game hoàn chỉnh.

## 2. Mục tiêu / Không làm / Tuyệt đối tránh

**Mục tiêu (bản chơi thử):**
- Chơi được trọn một ván 15 wave trên trình duyệt PC, có thắng/thua.
- Vòng lặp "kiếm vàng → triệu hồi / nâng cấp → gộp → mạnh hơn" cảm thấy thỏa mãn.
- Mọi con số cân bằng nằm ở file cấu hình, chỉnh không cần sửa logic.

**Không làm ở bản này (để bước sau):**
- Cây kỹ năng, nâng cấp vĩnh viễn giữa các ván (meta), rương/vòng quay.
- Chế độ vô tận + bảng xếp hạng, chế độ 30 wave đầy đủ.
- Pixel art thật (dùng hình khối/màu tạm), âm thanh.
- Tối ưu giao diện cho điện thoại (nhưng không được làm gì cản trở việc này — xem mục 9).
- Lưu game, tài khoản, backend.

**Tuyệt đối tránh:**
- Bắt người chơi thao tác nhanh trong lúc chiến đấu để không thua.
- Gộp nhân vật khó hiểu: người chơi phải nhìn là biết 2 con nào gộp được.
- Thua vì may rủi thuần túy mà không có quyết định nào cứu được.

## 3. Vòng lặp một ván

1. Bắt đầu: HP tổng = 20, vàng khởi đầu = 100, map trống.
2. **Giai đoạn chuẩn bị** (trước wave 1 và giữa các wave, ~15 giây, có nút "Bắt đầu ngay"):
   triệu hồi, gộp, nâng chỉ số, làm quiz toán (tùy chọn). Hiển thị modifier của wave sắp tới.
3. **Wave**: quái sinh ra ở Start theo nhịp, đi về End. Nhân vật tự đánh, skill tự kích hoạt.
   Người chơi *vẫn có thể* triệu hồi / gộp / bán / nâng cấp trong lúc wave diễn ra (người dùng đã xác nhận).
4. Wave kết thúc khi mọi quái của wave đã chết hoặc đã lọt. Thưởng vàng qua wave.
5. Thua khi HP tổng về 0. Thắng khi qua wave 15. Màn hình kết quả: wave đạt được, quái đã
   giết, nút chơi lại.

## 4. Map

- Một map cố định, lưới ô vuông. Đường đi là một chuỗi ô liên tiếp từ Start đến End (có
  vài khúc cua). Khoảng **15 ô đặt nhân vật** nằm cạnh đường.
- Map định nghĩa bằng dữ liệu (mảng ô) để thêm map mới sau này không phải sửa code.
- Quái đi theo các điểm mốc (waypoint) dọc đường, không cần tìm đường.

## 5. Nhân vật

### 5.1 Triệu hồi
- Nút **Triệu hồi** tốn vàng, giá khởi đầu 20, **tăng 5 sau mỗi lần triệu hồi** trong ván.
- Kết quả: một loại nhân vật ngẫu nhiên (tỉ lệ đều) ở **cấp 1**, đặt vào một ô trống ngẫu
  nhiên. Hết ô trống thì nút bị khóa.
- Mỗi lần triệu hồi cũng quay ra **độ hiếm**: Thường / Hiếm / Sử thi (xem 5.4).

### 5.2 Gộp
- Kéo một nhân vật thả lên một nhân vật **cùng loại và cùng cấp** → hai con thành một con
  cấp +1 tại ô được thả lên; ô kia trống. Cấp tối đa **5**.
- Khi đang kéo, các nhân vật gộp được phải được làm nổi bật.
- Kéo thả lên ô trống = di chuyển nhân vật. Thả lên nhân vật không gộp được = hoán đổi vị trí.
- Cấp hiển thị rõ trên nhân vật (số hoặc số sao).

### 5.2b Bán nhân vật
- Người chơi bán được bất kỳ nhân vật nào, bất cứ lúc nào (kể cả trong wave), ô trở nên trống.
- Hoàn lại **50% số vàng đã bỏ ra cho con đó**, làm tròn xuống. Mỗi nhân vật lưu tổng vàng
  đầu tư: con triệu hồi = giá triệu hồi lúc đó; con gộp = tổng của hai con đem gộp.
- Vàng nâng cấp theo loại (5.5) không được hoàn khi bán.
- Lý do: tránh bàn cờ kín những con không gộp được khiến người chơi hết nước đi.

### 5.3 Chỉ số và cấp
Chỉ số mỗi nhân vật: **Sát thương, Tốc đánh (đòn/giây), Tầm đánh (ô), Tỉ lệ chí mạng,
Sát thương chí mạng** (mặc định ×2).

Công thức (quyết định của người thiết kế):
- **Sát thương** = gốc × hệ số cấp × (1 + nâng cấp %) × (1 + cộng ngẫu nhiên %).
  Hệ số cấp gợi ý ×1.0 / 2.2 / 4.8 / 10 / 21 cho cấp 1–5.
- **Tốc đánh** = gốc × (1 + 0.1 × (cấp − 1)) × (1 + nâng cấp %) × (1 + cộng ngẫu nhiên %).
- **Tầm đánh** = gốc + nâng cấp (cộng thẳng ô). Không tăng theo cấp.
- **Chí mạng** = gốc + nâng cấp (cộng thẳng điểm %), tối đa 100%. Không tăng theo cấp.
- Các nâng cấp % cộng dồn tuyến tính theo bậc (bậc 3 sát thương = +30%), không nhân lũy thừa.
- Skill mạnh dần theo cấp (thời gian hồi ngắn hơn hoặc hiệu ứng lớn hơn, định nghĩa riêng từng skill).

### 5.4 Cộng ngẫu nhiên (độ hiếm)
- Khi triệu hồi, mỗi nhân vật quay một khoản cộng % ngẫu nhiên cho Sát thương và Tốc đánh,
  theo độ hiếm:
  - Thường (70%): +0–10%
  - Hiếm (25%): +10–25%
  - Sử thi (5%): +25–50%
- Độ hiếm hiển thị bằng màu viền nhân vật.
- **Khi gộp:** con mới lấy độ hiếm cao hơn trong hai con, và với mỗi chỉ số lấy khoản cộng
  cao hơn trong hai con. *(Quyết định của người thiết kế — có thể đổi thành quay lại ngẫu nhiên.)*

### 5.5 Nâng cấp chỉ số (người chơi tự điều chỉnh)
- Nâng cấp **theo loại nhân vật**, áp dụng cho mọi con thuộc loại đó (kể cả con triệu hồi sau).
  Lý do: nâng từng con riêng sẽ rối khi gộp.
- Mỗi loại có 4 dòng nâng cấp: Sát thương (+10%/bậc), Tốc đánh (+6%/bậc),
  Tầm đánh (+0.25 ô/bậc, tối đa 4 bậc), Chí mạng (+3%/bậc).
- Giá: 30 vàng bậc 1, nhân 1.5 mỗi bậc tiếp theo.
- Thêm một nâng cấp chung **May mắn (Luck)**: mỗi bậc dời tỉ lệ độ hiếm khi triệu hồi về
  phía Hiếm/Sử thi (ví dụ −4% Thường, +3% Hiếm, +1% Sử thi), tối đa 5 bậc.

### 5.6 Năm loại nhân vật (bản chơi thử)
Mỗi loại có 1 skill **bị động** và 1 skill **tự kích hoạt theo thời gian hồi**.

| Loại | Tầm | Kiểu đánh | Bị động | Tự kích hoạt (hồi chiêu) |
|---|---|---|---|---|
| Kiếm sĩ | 1.5 | Cận chiến, đánh mạnh | Đòn thứ 3 liên tiếp gây ×2 sát thương | Chém xoáy: sát thương mọi quái trong tầm (8s) |
| Cung thủ | 4 | Bắn đơn mục tiêu, nhanh | +15% chí mạng | Mưa tên: 5 mũi tên vào 5 quái ngẫu nhiên trong tầm (7s) |
| Pháp sư | 3 | Cầu lửa nổ diện nhỏ | Đòn đánh để lại cháy (sát thương theo thời gian) | Thiên thạch: nổ diện lớn tại quái đông nhất (12s) |
| Băng sư | 3 | Bắn đơn, sát thương thấp | Đòn đánh làm chậm 30% trong 1.5s | Đóng băng mọi quái trong tầm 1.5s (10s) |
| Lôi sư | 3.5 | Sét đánh lan | 10% cơ hội đòn đánh lan sang 3 quái gần | Gọi sét vào quái máu cao nhất (9s) |

Mục tiêu mặc định: quái **đi xa nhất** trong tầm.

## 6. Quái và wave

### 6.1 Loại quái
| Loại | Máu | Tốc độ | Trừ HP khi lọt | Ghi chú |
|---|---|---|---|---|
| Thường | trung bình | trung bình | 1 | |
| Nhanh | thấp | cao | 1 | |
| Trâu | cao | thấp | 2 | Giáp: giảm 30% sát thương nhận |
| Boss (wave 10, wave 15) | rất cao | thấp | 10 | Miễn nhiễm đóng băng, chỉ bị chậm một nửa |

Máu quái tăng theo wave (gợi ý ×1.15 mỗi wave). Mỗi quái chết cho vàng (Thường 3, Nhanh 3,
Trâu 6, Boss 50).

### 6.2 Cấu trúc wave
- 15 wave, định nghĩa bằng dữ liệu: danh sách (loại quái, số lượng, nhịp sinh).
- Wave 10 và 15 có Boss. Thưởng qua wave: 20 + 5 × số wave.

### 6.3 Modifier ngẫu nhiên mỗi wave
Từ wave 2, mỗi wave có 50% cơ hội nhận một modifier, hiển thị trong giai đoạn chuẩn bị:
- **Cuồng nộ:** quái +30% tốc độ, vàng rơi +50%.
- **Mưa vàng:** vàng rơi ×2.
- **Bầy đàn:** số quái +50%, máu mỗi con −30%.
- **Giáp sắt:** mọi quái giảm 20% sát thương nhận, thưởng qua wave ×2.
- **Bóng đêm:** tầm đánh mọi nhân vật −20%, thưởng qua wave ×2.

## 7. Chí mạng và proc
- Mỗi đòn đánh quay chí mạng theo Tỉ lệ chí mạng → sát thương × Sát thương chí mạng.
- Số sát thương bay lên khi đánh; chí mạng hiển thị khác màu/to hơn.
- Các skill có tỉ lệ kích hoạt (như của Lôi sư) dùng chung một bộ quay ngẫu nhiên có thể
  đặt seed (để test và tái hiện lỗi).

## 8. Quiz toán
- Trong giai đoạn chuẩn bị, nút **"Thử thách toán"** (mỗi giai đoạn tối đa 1 lần, không bắt buộc).
- Một phép tính + − × ÷ với số nguyên, 4 đáp án (1 đúng, 3 nhiễu gần đúng), đếm ngược **8 giây**.
- Độ khó tăng theo wave: wave 1–5 cộng/trừ trong phạm vi 20; wave 6–10 thêm nhân/chia
  (bảng cửu chương, phép chia luôn chia hết); wave 11–15 số lớn hơn (đến 100, nhân đến 12×12).
- Thưởng khi đúng: vàng = 10 + 3 × số wave, **nhân thêm theo tốc độ** (trả lời trong 3 giây
  đầu ×2, sau đó giảm dần về ×1). Sai hoặc hết giờ: không thưởng, không phạt.
- Đếm ngược của quiz không làm dừng đồng hồ giai đoạn chuẩn bị.

## 9. Công nghệ và kiến trúc

- **Phaser 3 + TypeScript**, build bằng **Vite**. Chạy hoàn toàn phía trình duyệt.
- **Tách logic khỏi hiển thị:** phần mô phỏng (kinh tế, gộp, chỉ số, quay ngẫu nhiên, wave,
  sát thương, quiz) viết bằng TypeScript thuần, không phụ thuộc Phaser, để test được bằng
  **Vitest**. Phaser chỉ đọc trạng thái và vẽ, chuyển thao tác người chơi thành lệnh.
- **Dữ liệu cân bằng** (nhân vật, quái, wave, giá, tỉ lệ) nằm trong các file cấu hình riêng.
- **Sẵn sàng cho điện thoại:** dùng pointer events (chuột và cảm ứng như nhau), Phaser Scale
  Manager chế độ FIT, khung hình ngang cố định (gợi ý 1280×720). Nút và ô đủ lớn để chạm.
- Hình ảnh tạm: hình khối có màu theo loại nhân vật / quái; cấu trúc sao cho thay bằng
  sprite pixel art sau mà không đổi logic.

## 10. Giao diện bản chơi thử
- Thanh trên: HP tổng, vàng, wave hiện tại / 15, modifier của wave.
- Giữa: map, đường đi, các ô, nhân vật, quái (có thanh máu).
- Thanh dưới: nút Triệu hồi (kèm giá), nút Thử thách toán, nút Bắt đầu ngay (khi đang chuẩn bị).
- Bảng nâng cấp: chọn một loại nhân vật → thấy 4 dòng nâng cấp và giá; nâng cấp Luck riêng.
- Chạm/nhấp vào một nhân vật: xem chỉ số cuối, độ hiếm, khoản cộng ngẫu nhiên, 2 skill, vòng tầm đánh.
- Tốc độ game ×1 / ×2.

## 11. Để người làm tự quyết
- Bố cục cụ thể của map và vị trí các ô, miễn đúng ~15 ô và đường có khúc cua.
- Mọi con số cân bằng ở trên là điểm khởi đầu — được chỉnh để ván chơi có độ khó hợp lý
  (người chơi trung bình qua được wave 10, wave 15 cần build tốt).
- Thành phần wave cụ thể, hiệu ứng hình ảnh, cách bố trí giao diện chi tiết.
- Cấu trúc thư mục và cách tổ chức code.

## 12. Những quyết định do người thiết kế đưa ra (người dùng chưa xác nhận)
- Công thức chỉ số ở 5.3 (cấp chỉ tăng sát thương và một ít tốc đánh; tầm và chí mạng cộng thẳng).
- Gộp: giữ độ hiếm và khoản cộng cao hơn.
- Bỏ hệ thống "lên cấp chọn 1/3 thẻ" và shop riêng ở bản chơi thử; vai trò này do triệu hồi + nâng cấp đảm nhận.
- Danh sách 5 nhân vật, 3 quái + boss, các modifier, và mọi con số.
- Cách tính "vàng đã bỏ ra" khi bán con đã gộp, và không hoàn vàng nâng cấp.

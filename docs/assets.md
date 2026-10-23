# Hướng dẫn chuẩn bị sprite và hiệu ứng

Tài liệu này dành cho người vẽ/làm hoạt ảnh. Game luôn chạy được khi chưa có asset nào (dùng hình khối mặc định).
Khi bạn thả file vào và khai báo, game sẽ tự dùng sprite thay cho hình khối, **không cần sửa code**.

## Tóm tắt nhanh

1. Xuất ảnh (PNG) vào thư mục `public/sprites/` (có thể tạo thư mục con, ví dụ `public/sprites/units/`).
2. Mở `public/sprites/manifest.json` và thêm một mục cho mỗi "khóa hình" (xem bảng bên dưới).
3. Lưu file, tải lại trang (F5). Mở console (F12) để xem cảnh báo nếu có mục sai.

Mọi đường dẫn trong manifest là **đường dẫn tương đối bên trong `sprites/`**. Ví dụ file nằm ở
`public/sprites/units/archer_idle.png` thì ghi `"units/archer_idle.png"`.
Tên file và đường dẫn **chỉ được gồm chữ cái không dấu (a-z, A-Z), chữ số, `_`, `-`, `.` và `/`** (phân cách thư mục).
Không dùng khoảng trắng, chữ có dấu, `%`, `:`, `?`, `#`, `\`. Không dùng `..` hoặc `.` làm tên thư mục, không bắt đầu bằng `/`,
không dùng đường dẫn tuyệt đối (`C:\...`) hay URL/scheme (`http://...`, `data:...`, `blob:...`).
Mục vi phạm sẽ bị bỏ qua (kèm cảnh báo ở console).

## Danh sách khóa hình

`<lớp>` là một trong `swordsman` (kiếm sĩ), `archer` (cung thủ), `mage` (pháp sư), `summoner` (triệu hồi sư).
`<loại>` là một trong `normal`, `fast`, `tank`, `boss`.

| Khóa | Ý nghĩa / khi nào chạy | Lặp mặc định |
| --- | --- | --- |
| `unit.<lớp>.idle` | Nhân vật đứng yên trên bàn | có |
| `unit.<lớp>.attack` | Nhân vật ra đòn, chạy mỗi khi nhân vật đó tấn công | không |
| `unit.<lớp>.skill` | Nhân vật tung skill, chạy khi có skill của lớp đó | không |
| `minion.idle` | Lính của triệu hồi sư đứng yên | có |
| `minion.attack` | Lính tấn công | không |
| `enemy.<loại>.walk` | Quái đi trên đường | có |
| `enemy.<loại>.die` | Quái chết; chạy một lần rồi quái biến mất | không |
| `projectile.<lớp>` | Đạn bay của lớp đó (mũi tên, quả cầu lửa...) | không |
| `projectile.minion` | Đạn/đòn bay của lính | không |
| `impact.<lớp>` | Hiệu ứng nổ ra tại điểm đạn của lớp đó trúng đích | không |
| `impact.minion` | Hiệu ứng trúng đích của lính | không |
| `impact.crit` | Hiệu ứng thêm khi đòn chí mạng | không |
| `skill.<lớp>` | Hiệu ứng skill của lớp đó (vẽ tại nhân vật hoặc vùng tác dụng) | không |
| `skill.mage.meteor` | Thiên thạch của pháp sư, rơi xuống tại vùng nổ | không |
| `skill.archer.arrow` | Mũi tên rơi xuống của skill cung thủ, tại mỗi điểm trúng | không |

Danh sách đầy đủ (mọi khóa hợp lệ), `<lớp>` và `<loại>` được thay bằng giá trị cụ thể:

- `unit.swordsman|archer|mage|summoner` + `.idle|.attack|.skill` (12 khóa)
- `minion.idle`, `minion.attack`
- `enemy.normal|fast|tank|boss` + `.walk|.die` (8 khóa)
- `projectile.swordsman|archer|mage|summoner|minion`
- `impact.swordsman|archer|mage|summoner|minion|crit`
- `skill.swordsman|archer|mage|summoner`, `skill.mage.meteor`, `skill.archer.arrow`

Khóa không có trong danh sách này sẽ bị bỏ qua (kèm cảnh báo ở console).
Khóa nào không có trong manifest thì game vẫn vẽ hình khối mặc định cho thứ đó, nên bạn có thể thêm từng cái một.

## Hai dạng mục trong manifest

Manifest là một object JSON: **khóa hình → mô tả**. Có hai dạng mô tả.

### Dạng 1: `sheet` (spritesheet lưới đều)

Một ảnh PNG, các khung bằng nhau xếp thành lưới, đọc từ trái sang phải, từ trên xuống dưới.

```json
{
  "unit.archer.attack": {
    "type": "sheet",
    "file": "units/archer_attack.png",
    "frameWidth": 64,
    "frameHeight": 64,
    "frames": 6,
    "fps": 12,
    "loop": false,
    "originX": 0.5,
    "originY": 0.5
  }
}
```

| Trường | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `type` | có | `"sheet"` |
| `file` | có | Đường dẫn PNG, tương đối trong `sprites/` |
| `frameWidth`, `frameHeight` | có | Kích thước mỗi khung (px), số nguyên > 0 |
| `frames` | không | Số khung dùng. Bỏ trống thì dùng hết các khung trong ảnh |

### Dạng 2: `atlas` (texture atlas JSON kiểu Phaser/TexturePacker/Aseprite, JSON hash)

Một ảnh PNG kèm một file JSON mô tả từng khung (cho phép khung kích thước khác nhau, đã cắt viền trong suốt).

```json
{
  "enemy.boss.die": {
    "type": "atlas",
    "file": "enemies/boss.png",
    "data": "enemies/boss.json",
    "prefix": "die_",
    "fps": 10,
    "loop": false
  }
}
```

| Trường | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `type` | có | `"atlas"` |
| `file` | có | Đường dẫn PNG |
| `data` | có | Đường dẫn file JSON atlas (cùng quy tắc đường dẫn) |
| `prefix` | không | Chỉ dùng các khung có tên bắt đầu bằng chuỗi này (vd `"die_"`), để một atlas chứa nhiều hoạt ảnh. Bỏ trống thì dùng mọi khung theo thứ tự |

### Tùy chọn chung (cả hai dạng)

| Trường | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `fps` | `10` | Số khung hình mỗi giây, số > 0 |
| `loop` | `true` cho `idle`/`walk`, `false` cho mọi khóa còn lại | `true` lặp mãi; `false` chạy một lần rồi dừng/biến mất |
| `scale` | `1` | Hệ số phóng/thu, số > 0 (vd `0.5` thu nhỏ một nửa) |
| `originX`, `originY` | `0.5`, `0.5` | Gốc tọa độ (xem dưới) |
| `tint` | không | Nhuộm màu, số nguyên như `16711680` (JSON không có dạng `0xff0000`; đổi sang thập phân) |
| `rotateToTarget` | `false` | Xoay sprite theo hướng bay (xem dưới) |

Trường sai kiểu hoặc sai giá trị (ví dụ `fps: 0`, `frameWidth: "64"`, thiếu `file`) làm **cả mục đó bị bỏ qua**,
game rơi về hình khối cho khóa này và ghi một cảnh báo ở console.

## Kích thước khuyến nghị

Bàn chơi chia ô **64 px**.

| Loại | Kích thước mỗi khung |
| --- | --- |
| Nhân vật (`unit.*`), lính (`minion.*`) | 64×64 |
| Quái thường (`enemy.normal.*`, `enemy.fast.*`, `enemy.tank.*`) | 64×64 |
| Boss (`enemy.boss.*`) | 128×128 |
| Đạn (`projectile.*`) | 16 đến 32 px |
| Hiệu ứng trúng/skill (`impact.*`, `skill.*`) | 64×64 đến 128×128 tùy độ lớn hiệu ứng |

Dùng nền trong suốt (PNG có alpha). Tất cả khung của cùng một mục phải cùng kích thước nếu dùng `sheet`.
Nên giữ chân nhân vật ở cùng một vị trí giữa các hoạt ảnh (idle/attack/skill) để không bị "nhảy" khi đổi hoạt ảnh.

## Gốc tọa độ (origin / anchor)

`originX` và `originY` là điểm của khung hình được đặt đúng vào vị trí logic của vật trong game.
Giá trị từ 0 đến 1 theo kích thước khung: `(0, 0)` là góc trên trái, `(0.5, 0.5)` là chính giữa (mặc định), `(0.5, 1)` là giữa mép dưới.

- Nhân vật/quái đứng trên đất: thường dùng `originY` khoảng `0.8` đến `1` để chân khớp vị trí.
- Đạn, hiệu ứng nổ: để mặc định `(0.5, 0.5)` để tâm hình trùng điểm trúng.

## Đạn xoay theo hướng bay: `rotateToTarget`

Với `projectile.*`, đặt `"rotateToTarget": true` thì sprite tự xoay theo hướng từ nơi bắn đến mục tiêu.
**Vẽ đạn quay sang phải** (đầu mũi tên chỉ về hướng +X) trong ảnh gốc. Các khóa khác thường để `false`.

```json
{
  "projectile.archer": {
    "type": "sheet",
    "file": "fx/arrow.png",
    "frameWidth": 32,
    "frameHeight": 16,
    "frames": 1,
    "fps": 1,
    "loop": true,
    "rotateToTarget": true
  }
}
```

## Cách thử

1. Thả PNG (và JSON nếu dùng atlas) vào `public/sprites/` (hoặc thư mục con của nó).
2. Thêm mục vào `public/sprites/manifest.json`.
3. Chạy `npm run dev` (nếu chưa chạy), mở game và nhấn **F5**. Manifest và asset được tải ở màn hình bắt đầu, trước khi vào ván.
4. Vào ván và kiểm tra: nhân vật đứng yên (idle), tấn công (attack), tung skill (skill); quái đi (walk) và chết (die).

## Khi file bị thiếu hoặc sai

- Khóa không có trong manifest: dùng hình khối mặc định, không báo gì.
- Mục trong manifest sai định dạng: mục đó bị bỏ qua, game dùng hình khối, **console ghi cảnh báo** nêu khóa và lỗi.
- File PNG/JSON không tải được (sai tên, sai đường dẫn): game dùng hình khối cho khóa đó và ghi cảnh báo ở console.
- Tải quá lâu (có giới hạn thời gian): game vào ván với hình khối.

Vì vậy một lỗi nhỏ không làm game hỏng; hãy xem console (F12) để biết cần sửa gì.

## Xuất file từ công cụ

### Aseprite

- Spritesheet lưới đều: `File > Export Sprite Sheet`, tab Layout chọn **By Rows** (hoặc Packed tắt), đặt kích thước ô trùng `frameWidth`/`frameHeight`, xuất PNG. Dùng dạng `sheet`.
- Atlas: cùng hộp thoại, tab Output tích **JSON Data** và chọn định dạng **Hash** (không chọn Array). Nếu muốn nhiều hoạt ảnh trong một atlas, đặt tên khung có tiền tố (vd `idle_`, `attack_`) trong mục *Item Filename* (`{tag}_{frame}`) và dùng `prefix`. Dùng dạng `atlas`.

### TexturePacker

- Chọn framework **Phaser 3** (hoặc "JSON (Hash)") để có file JSON dạng hash, tick **Trim** nếu muốn cắt viền trong suốt.
- Đặt tên khung theo mẫu `ten_00`, `ten_01`... để thứ tự khung đúng, và dùng `prefix` nếu gộp nhiều hoạt ảnh.
- Xuất ra PNG + JSON, thả cả hai vào `public/sprites/` rồi khai báo dạng `atlas`.

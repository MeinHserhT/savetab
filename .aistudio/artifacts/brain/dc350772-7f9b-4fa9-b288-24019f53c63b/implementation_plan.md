# Khung Preview Tab Chuẩn Google Chrome & Tinh Gọn Thẻ Tab

Loại bỏ biểu tượng nguồn (YouTube/favicon phụ) ở góc dưới bên phải mỗi thẻ tab và bổ sung khung **Tab Hover Card** theo phong cách Google Chrome hiển thị tiêu đề đầy đủ cùng tên miền ngay khi rê chuột vào tab.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Các quyết định thiết kế đã xác nhận từ người dùng:**
> - **Nội dung khung Preview**: Hiển thị **tiêu đề đầy đủ (Full Title)** và **tên miền (Domain/Host)** giống **Tab Hover Card cơ bản của Google Chrome**, đồng thời loại bỏ hoàn toàn biểu tượng nguồn nhỏ ở góc phải của từng tab để giao diện thoáng và sạch hơn.
> - **Cơ chế kích hoạt & Vị trí**: Xuất hiện ngay bên dưới hoặc bên cạnh thẻ tab khi người dùng rê chuột (hover) vào tab đó, tự động căn chỉnh để không bị che khuất bởi khung cuộn của cột Group hay tràn ra ngoài màn hình.

### 1. Overview & Core Concept
- **Loại bỏ biểu tượng nguồn trùng lặp bên phải mỗi tab**: Mỗi thẻ tab vốn đã có favicon nhận diện ở bên trái tiêu đề và được phân nhóm thông minh theo kênh YouTube hoặc tên miền. Việc gỡ bỏ icon nhỏ ở góc dưới bên phải giúp thẻ tab gọn gàng, dành trọn không gian bên phải cho nút đóng tab (`×`) khi rê chuột.
- **Trải nghiệm Chrome Tab Hover Card tức thì**: Khi tiêu đề trang web hoặc video dài bị cắt gọn (`truncate`) trong danh sách cột hẹp, người dùng chỉ cần di chuột qua bất kỳ tab nào để xem ngay một khung nổi sắc nét hiển thị trọn vẹn tiêu đề (hỗ trợ nhiều dòng) và tên miền gốc bên dưới, tương tự trải nghiệm duyệt tab trên Google Chrome.

### 2. User Experience & Visual Design
- **Cấu trúc thị giác chuẩn Chrome Tab Hover Card**:
  - **Bề mặt & Viền**: Sử dụng nền nổi đồng bộ với hệ thống giao diện hiện tại (`var(--tf-elevated)` kết hợp hiệu ứng đổ bóng sâu `shadow-xl` và viền mảnh `1px solid var(--tf-border)`), bo góc `10px` (`rounded-xl`) sắc sảo.
  - **Phân cấp Typography**:
    - **Tiêu đề đầy đủ (Full Title)**: Cỡ chữ `12.5px`, độ đậm `font-semibold`, màu chữ chính `var(--tf-text)`, cho phép xuống dòng tự nhiên (` whitespace-normal break-words leading-snug`) để đọc trọn vẹn các tiêu đề bài viết hoặc video dài.
    - **Tên miền (Domain Footer)**: Nằm ở phần chân của Hover Card, cỡ chữ `11px`, màu chữ phụ `var(--tf-text-muted)`, hiển thị tên miền sạch (bỏ `www.`) kèm biểu tượng favicon nhỏ hoặc tên kênh nếu là video YouTube để nhận diện tức thì.
- **Tương tác mượt mà**:
  - Gỡ bỏ thuộc tính `title` mặc định của trình duyệt trên thẻ tiêu đề để tooltip hệ thống không đè lên khung Chrome Tab Hover Card.
  - Tự động ẩn khung preview ngay khi người dùng bắt đầu kéo thả (drag) tab hoặc rê chuột vào nút xoá tab (`×`).

### 3. Key Product Decisions & Trade-Offs
- **Định vị thoát khỏi khung cuộn (Portal / Fixed Positioning)**:
  - *Quyết định*: Vì mỗi thẻ tab nằm trong danh sách cuộn dọc (`overflow-y-auto`) và bản thân thẻ có `overflow-hidden`, nếu đặt khung preview bên trong DOM của thẻ thì khung sẽ bị cắt khuất. Do đó, khung Chrome Tab Hover Card sẽ được render thông qua React Portal (`createPortal` vào `document.body`) với tọa độ `fixed` tính toán từ `getBoundingClientRect()` của tab đang được rê chuột.
  - *Lợi ích*: Khung preview luôn nổi hoàn toàn lên trên mọi cột Group, tự động ưu tiên hiển thị ngay sát bên dưới thẻ tab (hoặc lật lên trên / dịch sang cạnh nếu tab nằm sát đáy hoặc mép phải màn hình).
- **Tinh giản khu vực hành động bên phải**:
  - *Quyết định*: Xóa phần tử biểu tượng nguồn ở góc dưới bên phải của mỗi tab và căn chỉnh lại nút xoá (`×`) để thẻ tab cân đối theo trục ngang.

### 4. Technical Architecture & Data Strategy

```
+-----------------------------------------------------------------------+
|                           TabLinkRow (Hover)                          |
|  [Favicon]  Tiêu đề tab rút gọn...                              [×]   |
+-----------------------------------+-----------------------------------+
                                    |
                   onMouseEnter + getBoundingClientRect()
                                    v
+-----------------------------------------------------------------------+
|               ChromeTabHoverCard (Portal -> document.body)            |
|  +-----------------------------------------------------------------+  |
|  | Tiêu đề đầy đủ của trang web hoặc video YouTube hiển thị trọn   |  |
|  | vẹn nhiều dòng không bị cắt chữ                                 |  |
|  | --------------------------------------------------------------- |  |
|  | [Favicon 12px] youtube.com • Tên kênh (nếu có)                  |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

- **Quản lý trạng thái Hover & Tọa độ**:
  - Theo dõi trạng thái hover cùng tọa độ khung hình chữ nhật (`rect`) của thẻ tab đang được trỏ chuột.
  - Tự động đóng khung preview khi người dùng cuộn danh sách cột (`scroll`), bắt đầu thao tác kéo (`onDragStart`), hoặc rời chuột khỏi thẻ tab (`onMouseLeave`).
  - Tính toán vị trí `top` và `left` thông minh: mặc định đặt ngay bên dưới thẻ tab (`rect.bottom + 6px`), căn lề trái theo thẻ tab (`rect.left`), nhưng tự động lật lên trên (`rect.top - cardHeight - 6px`) nếu khoảng trống phía dưới màn hình nhỏ hơn chiều cao khung preview, và giới hạn `left` trong phạm vi `window.innerWidth` để không bao giờ bị tràn lề.

# Kế hoạch triển khai: Kéo-thả & Đồng bộ Google Chrome Tab Group tạo nhóm mới

## 1. Mục tiêu sản phẩm & Trải nghiệm người dùng (UX)
Hỗ trợ người dùng đưa toàn bộ một **Tab Group hiện có trên Google Chrome** (hoặc nhiều tab / thư mục bookmark / danh sách URL) vào **TabFlow** để tạo một **Tab Group mới** nhanh chóng với 3 luồng kết hợp:
1. **Vùng kéo-thả tạo Group mới (Drop Zone) trên Board & Sidebar**:
   - Thả 1 hoặc nhiều tab, thư mục Bookmark từ thanh dấu trang Chrome, hoặc đoạn văn bản chứa nhiều link vào vùng **"Thả để tạo Tab Group mới"** trên bảng Kanban hoặc dưới danh sách nhóm ở Sidebar.
   - Hệ thống **tự động tạo ngay nhóm mới với tên mặc định thông minh** (lấy tên thư mục Bookmark nếu có, hoặc tên miền / `"Nhóm tab mới"` kèm màu ngẫu nhiên/tuần tự), tự động thêm toàn bộ các URL vào nhóm mới đó và **tự động cuộn + focus bôi đen ô tên nhóm** để bạn gõ đổi tên ngay lập tức.
2. **Dán nhanh nhiều URL / Bookmark để tạo Group mới (Quick Paste & Import)**:
   - Hỗ trợ dán nhanh (`Ctrl+V` / `Cmd+V` trên bảng hoặc qua nút **"Nhập Tab Group / Dán nhiều URL"**) danh sách nhiều URL hoặc mã HTML Bookmark xuất từ Chrome để gom tất cả thành một Tab Group mới chỉ với 1 thao tác.
3. **Gói Tiện ích mở rộng Chrome (TabFlow Chrome Extension - Manifest V3)**:
   - Cung cấp sẵn bộ cài đặt Chrome Extension nhẹ tích hợp trực tiếp API `chrome.tabGroups` và `chrome.tabs` của Google Chrome.
   - Hiển thị danh sách các **Tab Group đang mở trên Chrome** (giữ nguyên **tên nhóm**, **màu sắc gốc của Chrome**, và **danh sách tất cả các tab** bên trong).
   - Cho phép **kéo-thả nguyên thẻ Tab Group từ popup/sidepanel của Extension sang trang TabFlow** hoặc bấm **1 nút "Đưa vào TabFlow"** để tạo ngay Tab Group mới với đúng tên, đúng màu và toàn bộ tab bên trong.

---

## 2. Thiết kế kiến trúc & Các thành phần cần xây dựng

### 2.1. Bộ giải mã dữ liệu kéo-thả & dán đa định dạng (`lib/tab-group-drop.ts`)
Xây dựng module phân tích `DataTransfer` (khi kéo-thả) và `ClipboardData` (khi dán) hỗ trợ trích xuất cả **thông tin nhóm (tên nhóm, màu sắc)** lẫn **danh sách nhiều tab**:
- **Định dạng gói TabFlow / Chrome Extension (`application/x-tabflow-tabgroup` hoặc JSON payload)**:
  - Đọc trực tiếp `{ name, color, tabs: [{ url, title, favIconUrl }] }` để giữ nguyên tên nhóm và ánh xạ bảng màu Chrome (`grey` -> `zinc`, `blue` -> `blue`, `red` -> `red`, `yellow` -> `amber`, `green` -> `emerald`, `pink` -> `rose`, `purple` -> `purple`, `cyan` -> `cyan`, `orange` -> `orange`).
- **Định dạng HTML (`text/html`) khi kéo thư mục Bookmark hoặc nhiều link**:
  - Phân tích cây DOM từ `text/html`: nhận diện thẻ tiêu đề thư mục (`<h3>`, `dl/dt`, hoặc thuộc tính `data-group-name`) làm tên nhóm gợi ý, đồng thời trích xuất toàn bộ các thẻ `<a href="https://...">Tiêu đề</a>` bên trong.
- **Định dạng `text/uri-list` & `text/plain` nhiều dòng**:
  - Tách tất cả các URL hợp lệ (`http://`, `https://`) trên nhiều dòng hoặc cách nhau bởi khoảng trắng, loại bỏ trùng lặp.
- **Tự động sinh tên nhóm mặc định thông minh**:
  - Nếu payload có tên nhóm (từ Extension hoặc thư mục Bookmark) -> dùng tên đó.
  - Nếu không có -> đặt tên mặc định theo ngôn ngữ hiện tại (ví dụ: `"Nhóm tab mới"` / `"New Tab Group"` hoặc theo tên miền chính nếu các tab cùng domain).

### 2.2. Nâng cấp Store quản lý tạo Group + Nhiều Link (`store/useLinkStore.ts`)
- Bổ sung action `createFolderWithLinks(payload: { name: string; color?: TabGroupColor; tabs: { url: string; title?: string }[] })`:
  - Tạo Tab Group mới qua `/api/folders` và đồng bộ Firestore (`createFolderInFirestore`).
  - Set `activeFolderId` về ID nhóm vừa tạo và đặt trạng thái ` newlyCreatedGroupId` để giao diện tự động cuộn tới cột nhóm mới và **focus + select toàn bộ chữ trong ô `<input>` tên nhóm** để người dùng sửa tên ngay nếu muốn.
  - Thêm tuần tự/song song các tab vào nhóm mới và tự động gọi scrape metadata (tiêu đề, thời lượng video YouTube, favicon) ở hậu cảnh.

### 2.3. Vùng kéo-thả tạo Group mới trên Bảng Kanban (`components/KanbanBoard.tsx`) & Sidebar (`components/Sidebar.tsx`)
- **Trên Bảng Kanban (`KanbanBoard.tsx`)**:
  - Thêm cột/vùng thả **"Thả Tab Group / Nhiều Link vào đây để tạo nhóm mới"** nằm ở cuối danh sách các cột Tab Group (và hiển thị nổi bật khi người dùng đang kéo link/file/tab từ ngoài trình duyệt vào trang).
  - Hỗ trợ thả nhiều URL vào vùng trống trên bảng hoặc vào cột "Tạo nhóm mới" -> lập tức tạo cột Tab Group mới, cuộn mượt tới cột đó và **auto-focus vào ô nhập tên nhóm trên tiêu đề cột**.
  - Hỗ trợ sự kiện `paste` (`Ctrl+V` / `Cmd+V`) khi người dùng không đứng trong ô input nào: nếu clipboard chứa danh sách URL hoặc dữ liệu Tab Group từ Extension, tự động tạo Tab Group mới và focus vào tên nhóm.
- **Trên Sidebar (`Sidebar.tsx`)**:
  - Thêm vùng thả nhanh **"+ Thả để tạo Tab Group mới"** ngay bên dưới danh sách nhóm ở Sidebar, đồng thời nếu người dùng kéo nhiều URL thả vào một nhóm đã có thì thêm toàn bộ các URL đó vào nhóm tương ứng.

### 2.4. Hộp thoại Nhập nhanh & Tải Chrome Extension (`components/ChromeTabGroupModal.tsx` + `/api/extension/download`)
- Thêm nút **"Nhập Tab Group Chrome"** trên thanh Header:
  - **Tab 1 — Dán nhanh danh sách URL / Bookmark**: Ô dán nhanh nhiều URL (hoặc dữ liệu copy từ Chrome / Extension) để tạo nhóm mới ngay lập tức, kèm phím tắt `Ctrl+V` trực tiếp ngoài bảng.
  - **Tab 2 — Tiện ích Chrome Extension đọc trực tiếp Tab Group**:
    - Cho phép tải về gói cài đặt sẵn (`/api/extension/download` trả về gói file hoặc bộ file cấu hình Manifest V3 `manifest.json`, `popup.html`, `popup.js` sử dụng `chrome.tabGroups.query({})` và `chrome.tabs.query({})`).
    - Trong Popup của Extension: liệt kê toàn bộ các Tab Group đang mở trong Chrome với đúng tên và màu sắc; người dùng có thể **kéo thẻ Group từ Extension thả thẳng vào trang TabFlow** hoặc bấm nút **"Gửi sang TabFlow"** (qua `window.postMessage` / URL bridge / Clipboard) để trang tự động tạo Group mới ngay lập tức.

### 2.5. Đa ngôn ngữ Anh - Việt (`lib/i18n.ts`)
- Bổ sung đầy đủ chuỗi ngôn ngữ tiếng Việt và tiếng Anh cho vùng kéo-thả tạo nhóm mới, thông báo trạng thái đang nhập nhiều tab, và hướng dẫn sử dụng Chrome Extension.

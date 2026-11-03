# Kiến trúc Cơ sở dữ liệu Firestore & Lộ trình Di chuyển Dữ liệu cho TabFlow

Tài liệu này phân tích chi tiết **điểm mạnh và điểm yếu của 3 mô hình cấu trúc dữ liệu Firestore** cho ứng dụng quản lý link dạng bảng Kanban (**TabFlow**), đồng thời đề xuất phương án tối ưu nhất kèm cơ chế **tự động di chuyển dữ liệu cũ (Auto-Migration)** không làm mất nhóm tab hay link hiện có.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Tóm tắt lựa chọn & Khuyến nghị kiến trúc:**
> - **Câu hỏi 1 (So sánh 3 mô hình Firestore)**: Xem bảng phân tích chi tiết Ưu/Nhược điểm của cả 3 cách ngay bên dưới. Khuyến nghị áp dụng **Cách 2: Subcollection ngang hàng dưới User (`/users/{uid}/folders` và `/users/{uid}/links`)** vì vừa gom toàn bộ dữ liệu vào bên trong từng `user` (tránh tuyệt đối xung đột ID giữa các tài khoản), vừa giữ nguyên tốc độ kéo-thả 1 thao tác ghi (`updateDoc`) của bảng Kanban.
> - **Câu hỏi 2 (Đã xác nhận)**: **Tự động di chuyển dữ liệu cũ sang cấu trúc mới** — Khi người dùng đăng nhập, hệ thống sẽ tự động kiểm tra các nhóm tab và link ở cấu trúc cũ, sao chép an toàn sang cấu trúc mới và dọn dẹp bản ghi cũ mà không làm gián đoạn trải nghiệm.

---

## 1. Phân tích Điểm mạnh & Điểm yếu của 3 Mô hình Firestore

### Cách 1: Top-level Collections tách biệt (`/users`, `/folders`, `/links`)
Cấu trúc: Ba collection nằm ngang hàng ở gốc database. Liên kết bằng trường `user_id` và `folder_id`.

```
Firestore Root
 ├── /users/{uid}
 ├── /folders/{folderId}   (chứa trường: user_id)
 └── /links/{linkId}       (chứa trường: user_id, folder_id)
```

- **Điểm mạnh (Pros)**:
  - **Kéo-thả Kanban cực nhanh (1 lệnh `updateDoc`)**: Khi kéo 1 link từ nhóm A sang nhóm B hoặc tự động gom nhóm cùng kênh YouTube/tên miền, chỉ cần cập nhật trường `folder_id` của document `/links/{linkId}` mà không đổi đường dẫn.
  - **Truy vấn toàn bảng đơn giản**: Lấy toàn bộ link của người dùng để tìm kiếm, lọc theo `#tag`, hoặc kiểm tra trùng URL chỉ cần 1 truy vấn `where('user_id', '==', uid)`.
  - **Dễ mở rộng tính năng chia sẻ (Collaboration)**: Nếu sau này muốn chia sẻ 1 folder hoặc 1 link cho nhiều user, không bị khóa cứng vào đường dẫn của 1 user duy nhất.
- **Điểm yếu (Cons)**:
  - **Nguy cơ đụng độ Document ID (ID Collision)**: Vì tất cả user dùng chung không gian tên `/folders/{folderId}` và `/links/{linkId}`, nếu ID tạo từ client hoặc dữ liệu mẫu (`fld-...`, `lnk-...`) trùng với ID đã tồn tại của user khác, Firestore Security Rules sẽ từ chối quyền ghi (`Missing or insufficient permissions`).
  - **Khó quan sát trên Firebase Console**: Dữ liệu của mọi user trộn lẫn trong 1 danh sách `/folders` và `/links` khổng lồ, khó kiểm tra dữ liệu của riêng 1 người dùng.
  - **Bắt buộc lọc `where('user_id', '==', uid)` ở mọi câu lệnh**: Nếu thiếu `where` ở client, toàn bộ truy vấn `list` sẽ bị chặn bởi Security Rules.

---

### Cách 2: Subcollection ngang hàng dưới User (`/users/{uid}/folders` và `/users/{uid}/links`) — **(Khuyến nghị Tối ưu nhất)**
Cấu trúc: Mỗi `user` là một vùng chứa độc lập (Tenant Container). Bên trong `/users/{uid}` có 2 subcollection ngang hàng nhau là `folders` và `links`.

```
Firestore Root
 └── /users/{uid}
      ├── /folders/{folderId}   (nhóm tab của riêng user này)
      └── /links/{linkId}       (link của riêng user này, chứa trường: folder_id)
```

- **Điểm mạnh (Pros)**:
  - **Cô lập dữ liệu tuyệt đối theo từng User (Zero ID Collision)**: Mỗi người dùng có không gian riêng dưới `/users/{uid}/...`. Hai người dùng có cùng ID `fld-default` hay `lnk-123` cũng không bao giờ xung đột quyền sở hữu.
  - **Giữ nguyên tốc độ Kéo-thả Kanban (1 lệnh `updateDoc`)**: Vì `links` nằm trực tiếp dưới `/users/{uid}/links/{linkId}` (không bị nhốt cứng trong đường dẫn của từng folder), khi kéo-thả tab sang nhóm khác chỉ cần cập nhật `folder_id` — nhanh và tiết kiệm chi phí đọc/ghi ngang Cách 1.
  - **Truy vấn & Kiểm tra trùng link toàn bảng dễ dàng**: Lắng nghe `/users/{uid}/links` là có ngay toàn bộ link của user mà không cần `where('user_id', '==', uid)` hay Composite Index phức tạp.
  - **Security Rules gọn nhẹ & an toàn**: Phân quyền trực tiếp qua biến đường dẫn `match /users/{userId}/... { allow ... if request.auth.uid == userId; }`.
  - **Quản lý trên Firebase Console trực quan**: Bấm vào 1 user trong `/users/{uid}` sẽ thấy ngay toàn bộ `folders` và `links` của đúng người đó.
- **Điểm yếu (Cons)**:
  - Đường dẫn code dài hơn một chút (`doc(db, 'users', uid, 'links', linkId)` thay vì `doc(db, 'links', linkId)`).

---

### Cách 3: Lồng sâu 3 cấp (`/users/{uid}/folders/{folderId}/links/{linkId}`)
Cấu trúc: `User` chứa `folders`, và mỗi `folder` lại chứa subcollection `links` bên trong nó.

```
Firestore Root
 └── /users/{uid}
      └── /folders/{folderId}
           └── /links/{linkId}   (bị khóa cứng vào đường dẫn của folderId)
```

- **Điểm mạnh (Pros)**:
  - Phản ánh đúng tư duy phân cấp thư mục truyền thống (mở 1 folder chỉ tải đúng các link nằm trong folder đó).
  - Phù hợp với ứng dụng lưu trữ tài liệu tĩnh ít khi di chuyển file giữa các thư mục.
- **Điểm yếu (Cons — Rất bất lợi cho bảng Kanban như TabFlow)**:
  - **Không thể đổi nhóm bằng `updateDoc` khi Kéo-thả**: Trong Firestore, không thể đổi đường dẫn của một document. Mỗi khi bạn kéo 1 tab từ Nhóm A sang Nhóm B (hoặc khi TabFlow tự động gom link cùng kênh YouTube về 1 nhóm), ứng dụng bắt buộc phải **Tạo document mới ở `/folders/{folderB}/links/{linkId}` + Xóa document cũ ở `/folders/{folderA}/links/{linkId}`**. Điều này làm **tốn gấp đôi chi phí ghi/xóa** và dễ gây nháy giao diện khi kéo-thả nhanh.
  - **Khó kiểm tra link trùng lặp & lọc `#tag` trên toàn bảng**: Để biết link mới thêm đã tồn tại ở nhóm nào chưa, hoặc để xem tất cả link có gắn thẻ `#research`, bạn phải mở `N` kết nối `onSnapshot` (1 cho mỗi nhóm tab) hoặc dùng `collectionGroup('links')` (đòi hỏi cấu hình Index riêng trên Firebase Console).
  - **Xóa Folder không tự xóa Link**: Trong Firestore, xóa document `/folders/{folderId}` không tự động xóa subcollection `/links` bên trong; nếu quên xóa từng link trước, các link đó sẽ trở thành "document mồ côi" (orphaned subdocuments) vẫn tồn tại ngầm.

---

### Bảng Tổng hợp So sánh 3 Mô hình

| Tiêu chí cho TabFlow | Cách 1: Top-level (`/users`, `/folders`, `/links`) | Cách 2: Subcollection dưới User (`/users/{uid}/folders` & `/links`) | Cách 3: Lồng 3 cấp (`/users/{uid}/folders/{fid}/links`) |
| :--- | :--- | :--- | :--- |
| **Kéo-thả link giữa các nhóm (`@dnd-kit`)** | Rất nhanh (1 lệnh `updateDoc`) | **Rất nhanh (1 lệnh `updateDoc`)** | Chậm & tốn kém (Phải Tạo mới + Xóa cũ) |
| **Kiểm tra trùng link & lọc `#tag` toàn bảng** | Dễ (1 listener + `where`) | **Rất dễ (1 listener trực tiếp)** | Phức tạp (`N` listeners hoặc `collectionGroup`) |
| **Chống xung đột ID giữa nhiều User** | Trung bình (dễ đụng ID nếu trùng key) | **Tuyệt đối (tách biệt theo `{uid}`)** | Tuyệt đối (tách biệt theo `{uid}`) |
| **Độ gọn gàng trên Firebase Console** | Kém (trộn lẫn mọi user) | **Rất gọn (gom theo từng user)** | Khá gọn nhưng phải bấm 3 tầng mới thấy link |
| **Độ phức tạp của `firestore.rules`** | Cao | **Thấp & Rõ ràng** | Trung bình |

---

## 2. User Experience & Visual Design

- **Trải nghiệm Người dùng & Đồng bộ Đám mây**:
  - Người dùng đăng nhập tài khoản Google sẽ thấy toàn bộ nhóm tab và các thẻ link hiện có được giữ nguyên 100%.
  - Quá trình chuyển đổi từ cấu trúc Top-level cũ (`/folders`, `/links`) sang Subcollection dưới User (`/users/{uid}/folders`, `/users/{uid}/links`) diễn ra hoàn toàn tự động ở tầng nền ngay khi khởi tạo phiên đăng nhập.
  - Khi thêm link mới (bao gồm link YouTube, bài viết học thuật, tài liệu kỹ thuật), kéo-thả giữa các cột Kanban, đổi màu nhóm tab (24 màu đối lập), hoặc xem ảnh preview website ở thẻ nổi phía dưới khi hover (`chrome-tab-hover-card`), mọi thao tác đều phản hồi tức thì (`<= 200ms` optimistic UI) và đồng bộ về `/users/{uid}/...`.
- **Giữ nguyên Ngôn ngữ Thiết kế Swiss Minimalist**:
  - Bố cục **Sidebar phân cấp (`240px–280px`)** + **Không gian bảng Kanban nhiều cột** trên nền tối trung tính (`#0F172A` / `--tf-canvas`), chữ `Plus Jakarta Sans` + `Be Vietnam Pro`, và số liệu/thời lượng hiển thị dạng `JetBrains Mono` (`tabular-nums`).

---

## 3. Key Product Decisions & Trade-Offs

- **Quyết định 1: Chuyển sang Mô hình Cách 2 (`/users/{userId}/folders/{folderId}` và `/users/{userId}/links/{linkId}`)**
  - *Phương án chọn*: Lưu `folders` và `links` làm 2 subcollection trực tiếp dưới document `/users/{userId}`.
  - *Lý do*: Giải quyết triệt để lỗi phân quyền do đụng độ ID giữa phiên khách (guest) và tài khoản thật, giúp quản lý dữ liệu theo từng user trên Firebase Console cực kỳ sạch sẽ, đồng thời bảo toàn hiệu năng kéo-thả 1 lệnh ghi của bảng Kanban.
- **Quyết định 2: Tự động Di chuyển Dữ liệu Cũ (Seamless Auto-Migration)**
  - *Phương án chọn*: Khi người dùng đăng nhập và kết nối Firestore, nếu `/users/{userId}/folders` và `/users/{userId}/links` chưa có dữ liệu nhưng tìm thấy dữ liệu của `userId` ở collection gốc `/folders` và `/links` cũ, hệ thống sẽ tự động sao chép toàn bộ nhóm tab và link sang `/users/{userId}/...` rồi dọn dẹp bản ghi cũ.
  - *Lý do*: Đảm bảo người dùng không bị mất bất kỳ nhóm tab hay link nào đã lưu trước đó.

---

## 4. Technical Architecture & Data Strategy

### Sơ đồ Kiến trúc & Luồng Đồng bộ Dữ liệu Mới

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Giao diện TabFlow (Client)                        │
│  ┌────────────────────┐  ┌─────────────────────────┐  ┌───────────────┐  │
│  │ Sidebar (Folders & │  │ KanbanBoard (@dnd-kit,  │  │ AddLinkModal  │  │
│  │   #Tag Filters)    │  │  Hover Preview Card)    │  │ (Duplicate    │  │
│  └─────────┬──────────┘  └────────────┬────────────┘  │  Check)       │  │
│            └──────────────────────────┼───────────────┴───────┬───────┘  │
│                                       ▼                       ▼          │
│                      Zustand Store (useLinkStore.ts)                     │
└───────────────────────────────────────┬──────────────────────────────────┘
                                        │
                    Đồng bộ thời gian thực & Auto-Migration
                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│               Firestore Database (/users/{userId} Scoped)                │
│                                                                          │
│  /users/{userId}                    (Hồ sơ người dùng)                   │
│     │                                                                    │
│     ├── /folders/{folderId}         (Subcollection Nhóm Tab)             │
│     │      • id, user_id, name, color, collapsed, order_index            │
│     │                                                                    │
│     └── /links/{linkId}             (Subcollection Thẻ Link)             │
│            • id, user_id, folder_id ──► Tham chiếu tới folders/{folderId}│
│            • url, domain, title, description, image_url, favicon, status │
└──────────────────────────────────────────────────────────────────────────┘
```

### Quy trình Tự động Di chuyển & Bảo mật (`firestore.rules` + `firebase-blueprint.json`)
1. **Cập nhật `firebase-blueprint.json` & `firestore.rules`**:
   - Định nghĩa đường dẫn chuẩn `/users/{userId}/folders/{folderId}` và `/users/{userId}/links/{linkId}` với kiểm tra `request.auth.uid == userId` và kiểm tra tính toàn vẹn `isParentFolderOwnedByCaller(userId, incoming().folder_id)` ngay trong phạm vi `/users/{userId}`.
   - Duy trì quyền đọc/xóa cho chủ sở hữu trên `/folders/{folderId}` và `/links/{linkId}` ở cấp gốc để trình tự động di chuyển (Auto-Migrator) có thể đọc dữ liệu cũ, chuyển sang `/users/{userId}/...` và dọn dẹp sạch bản ghi cũ.
2. **Triển khai `DeployRules` & Kiểm tra toàn diện**:
   - Kiểm tra quy tắc bảo mật bằng ESLint (`@firebase/eslint-plugin-security-rules`), triển khai lên Firestore qua `DeployRules`, và biên dịch kiểm tra ứng dụng (`compile_applet`).

import { TabGroupColor } from './types';

export type LanguageCode = 'vi' | 'en';

export interface Translations {
  header: {
    allGroupsAria: string;
    languageSelectorAria: string;
    langViLabel: string;
    langEnLabel: string;
    langViTitle: string;
    langEnTitle: string;
    importTabGroupBtn: string;
    importTabGroupMobile: string;
    importTabGroupTitle: string;
  };
  theme: {
    selectorAria: string;
    light: string;
    dark: string;
    lightTitle: string;
    darkTitle: string;
  };
  sidebar: {
    ariaLabel: string;
    expandSidebar: string;
    collapseSidebar: string;
    newGroup: string;
    groupNameLabel: string;
    groupNamePlaceholder: string;
    cancelNewGroup: string;
    addTabGroup: string;
    allSavedTabs: string;
    editGroupNameTitle: string;
    editGroupNameAria: (name: string) => string;
    deleteGroupTitle: string;
    deleteGroupAria: (name: string) => string;
    confirmDeleteTitle: string;
    closeConfirmAria: string;
    confirmDeletePromptPrefix: string;
    tabUnit: string;
    confirmDeleteWarning: (count: number) => string;
    cancel: string;
    confirmDeleteBtn: string;
    dropNewGroupLabel: string;
    dropNewGroupActive: string;
    dropNewGroupCollapsedTitle: string;
  };
  board: {
    dismissErrorAria: string;
    tabGroupAria: (name: string) => string;
    toggleGroupAria: (name: string) => string;
    expandGroupTitle: string;
    collapseGroupTitle: string;
    editGroupTitle: string;
    dragGroupTitle: string;
    changeColorAria: (name: string) => string;
    changeColorTitle: string;
    setColorAria: (colorLabel: string) => string;
    openAll: string;
    addLinkToGroupAria: (name: string) => string;
    addLinkToGroupTitle: (name: string) => string;
    dropToAdd: (name: string) => string;
    openInNewTabAria: (title: string) => string;
    deleteLinkAria: (title: string) => string;
    bottomNavAria: string;
    scrollLeftAria: string;
    scrollLeftTitle: string;
    scrollRightAria: string;
    scrollRightTitle: string;
    emptyBoardTitle: string;
    emptyBoardSubtext: string;
    emptyBoardAddBtn: string;
    emptyBoardImportBtn: string;
    dropNewGroupTitle: string;
    dropNewGroupSubtext: string;
    dropNewGroupActive: string;
    dropNewGroupPasteHint: string;
    defaultNewGroupName: string;
    creatingGroupStatus: string;
    colors: Record<TabGroupColor, string>;
  };
  chromeImport: {
    modalTitle: string;
    closeAria: string;
    tabPaste: string;
    groupNameOptionalLabel: string;
    groupNameOptionalPlaceholder: string;
    colorLabel: string;
    pasteInputLabel: string;
    pasteInputPlaceholder: string;
    pasteDropHint: string;
    pasteFromClipboardBtn: string;
    detectedTabsCount: (count: number) => string;
    detectedGroupName: (name: string) => string;
    createGroupSubmit: (count: number) => string;
    creatingBtn: string;
    errNoValidUrls: string;
    extBookmarkTipTitle: string;
    extBookmarkTipDesc: string;
  };
  emptyLane: {
    noLinksIn: (name: string) => string;
    subtext: string;
    pasteUrl: string;
    pasteUrlAria: (name: string) => string;
    addLink: string;
    addLinkAria: (name: string) => string;
    quickInputAria: (name: string) => string;
    quickInputPlaceholder: string;
    save: string;
    saveQuickAria: (name: string) => string;
    cancelQuickAria: string;
    errEmptyUrl: string;
    errSaveFailed: string;
  };
  addModal: {
    title: string;
    closeAria: string;
    urlPlaceholder: string;
    save: string;
    dropActiveHint: string;
    dropIdleHint: string;
    errEmptyUrl: string;
    errInvalidDrop: string;
  };
  auth: {
    loading: string;
    accountFallback: string;
    userFallback: string;
    accountSyncTitle: string;
    cloudSyncedTitle: string;
    accountSavedTitle: string;
    savedBadge: string;
    onlineSyncStatus: string;
    accountSavedStatus: string;
    signOut: string;
    signInBtn: string;
    signInBtnMobile: string;
    signInBtnTitle: string;
    guestBtn: string;
    guestBtnMobile: string;
    guestBtnTitle: string;
    guestModalBtn: string;
    guestDisplayName: string;
    guestAccountSubtext: string;
    switchAccountBtn: string;
    modalTitle: string;
    closeModalAria: string;
    tabLogin: string;
    tabRegister: string;
    googleLogin: string;
    googleRegister: string;
    orUseEmail: string;
    displayNameLabel: string;
    displayNamePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    confirmPasswordLabel: string;
    submitLogin: string;
    submitRegister: string;
    errPopupClosed: string;
    errPopupBlocked: string;
    errGoogleFailed: string;
    errGuestNotAllowed: string;
    errMissingEmailPass: string;
    errMissingName: string;
    errShortPassword: string;
    errPasswordMismatch: string;
    errOperationNotAllowed: string;
    errInvalidCredential: string;
    errEmailInUse: string;
    errInvalidEmail: string;
    errGenericAuth: string;
  };
}

export const TRANSLATIONS: Record<LanguageCode, Translations> = {
  vi: {
    header: {
      allGroupsAria: 'Xem tất cả nhóm tab',
      languageSelectorAria: 'Chọn ngôn ngữ giao diện',
      langViLabel: 'VI',
      langEnLabel: 'EN',
      langViTitle: 'Tiếng Việt',
      langEnTitle: 'English (Tiếng Anh)',
      importTabGroupBtn: 'Nhập Tab Group',
      importTabGroupMobile: 'Nhập Group',
      importTabGroupTitle:
        'Kéo thả tab/thư mục Bookmark hoặc dán nhanh nhiều URL để tạo Tab Group',
    },
    theme: {
      selectorAria: 'Chọn chế độ giao diện Sáng / Tối',
      light: 'Sáng',
      dark: 'Tối',
      lightTitle: 'Giao diện Sáng (#FFFAFF · #0A2463 · #3E92CC · #D8315B)',
      darkTitle:
        'Giao diện Tối (Đen #090A0D · Xám #12141A / #262A34 · Trắng ánh xanh #F0F7FF)',
    },
    sidebar: {
      ariaLabel: 'Danh sách nhóm tab',
      expandSidebar: 'Mở rộng thanh bên',
      collapseSidebar: 'Thu gọn thanh bên',
      newGroup: 'Nhóm mới',
      groupNameLabel: 'Tên nhóm',
      groupNamePlaceholder: 'VD: Tài liệu đọc thêm',
      cancelNewGroup: 'Huỷ tạo nhóm mới',
      addTabGroup: 'Tạo nhóm Tab',
      allSavedTabs: 'Tất cả tab đã lưu',
      editGroupNameTitle: 'Nhấn để đổi tên nhóm',
      editGroupNameAria: (name) => `Đổi tên nhóm ${name}`,
      deleteGroupTitle: 'Xoá nhóm này',
      deleteGroupAria: (name) => `Xoá nhóm ${name}`,
      confirmDeleteTitle: 'Xác nhận xoá nhóm',
      closeConfirmAria: 'Đóng hộp thoại xác nhận',
      confirmDeletePromptPrefix: 'Bạn có chắc chắn muốn xoá nhóm',
      tabUnit: 'tab',
      confirmDeleteWarning: (count) =>
        `Lưu ý: Toàn bộ ${count} tab đã lưu trong nhóm này cũng sẽ bị xoá vĩnh viễn.`,
      cancel: 'Huỷ',
      confirmDeleteBtn: 'Xoá nhóm',
      dropNewGroupLabel: 'Thả tab vào đây để tạo nhóm mới',
      dropNewGroupActive: 'Thả ngay để tạo Tab Group mới',
      dropNewGroupCollapsedTitle:
        'Kéo thả tab hoặc thư mục Bookmark vào đây để tạo Tab Group mới',
    },
    board: {
      dismissErrorAria: 'Đóng thông báo lỗi',
      tabGroupAria: (name) => `Nhóm tab ${name}`,
      toggleGroupAria: (name) => `Thu gọn hoặc mở rộng nhóm ${name}`,
      expandGroupTitle: 'Mở rộng nhóm',
      collapseGroupTitle: 'Thu gọn nhóm',
      editGroupTitle: 'Nhấn để sửa tên nhóm',
      dragGroupTitle: 'Giữ và kéo để đổi vị trí nhóm tab',
      changeColorAria: (name) => `Đổi màu cho nhóm ${name}`,
      changeColorTitle: 'Đổi màu nhóm',
      setColorAria: (colorLabel) => `Chọn màu ${colorLabel}`,
      openAll: 'Mở tất cả',
      addLinkToGroupAria: (name) => `Thêm liên kết vào nhóm ${name}`,
      addLinkToGroupTitle: (name) => `Thêm liên kết vào ${name}`,
      dropToAdd: (name) => `Thả tab hoặc URL để thêm vào ${name}`,
      openInNewTabAria: (title) => `Mở ${title} trong tab mới`,
      deleteLinkAria: (title) => `Xoá ${title}`,
      bottomNavAria: 'Thanh chọn nhanh nhóm tab',
      scrollLeftAria: 'Cuộn bảng sang trái',
      scrollLeftTitle: 'Cuộn trái',
      scrollRightAria: 'Cuộn bảng sang phải',
      scrollRightTitle: 'Cuộn phải',
      emptyBoardTitle: 'Chưa có liên kết nào',
      emptyBoardSubtext:
        'Kéo thả tab hoặc thư mục Bookmark từ Chrome vào đây, hoặc nhấn Ctrl+V để dán nhiều URL và tạo Tab Group mới.',
      emptyBoardAddBtn: 'Thêm liên kết',
      emptyBoardImportBtn: 'Nhập Tab Group',
      dropNewGroupTitle: 'Thả để tạo Tab Group mới',
      dropNewGroupSubtext:
        'Kéo thả tab từ Chrome hoặc thư mục Bookmark vào đây để tự tạo nhóm mới và sửa tên ngay.',
      dropNewGroupActive: 'Thả ngay để tạo Tab Group mới!',
      dropNewGroupPasteHint: 'Hoặc nhấn Nhập Tab Group / Ctrl+V',
      defaultNewGroupName: 'Nhóm tab mới',
      creatingGroupStatus: 'Đang tạo Tab Group mới...',
      colors: {
        blue: 'Xanh dương',
        cyan: 'Xanh lơ',
        emerald: 'Xanh lá',
        amber: 'Vàng',
        orange: 'Cam',
        red: 'Đỏ',
        rose: 'Hồng',
        purple: 'Tím',
        indigo: 'Chàm',
        zinc: 'Xám',
      },
    },
    chromeImport: {
      modalTitle: 'Nhập Tab Group vào TabFlow',
      closeAria: 'Đóng hộp thoại nhập Tab Group',
      tabPaste: 'Dán nhanh URL / Bookmark',
      groupNameOptionalLabel:
        'Tên nhóm (để trống để tự đặt tên & focus sửa ngay sau khi tạo)',
      groupNameOptionalPlaceholder: 'VD: Nghiên cứu UI/UX (tùy chọn)',
      colorLabel: 'Màu sắc nhóm',
      pasteInputLabel:
        'Dán danh sách URL hoặc dữ liệu thư mục Bookmark',
      pasteInputPlaceholder:
        'https://github.com/...\nhttps://figma.com/...\n(Hoặc kéo thả nhiều tab / thư mục Bookmark vào ô này)',
      pasteDropHint: 'Bạn có thể kéo thả trực tiếp các tab hoặc thư mục Bookmark vào ô trên.',
      pasteFromClipboardBtn: 'Dán từ Clipboard',
      detectedTabsCount: (count) => `Phát hiện ${count} tab hợp lệ`,
      detectedGroupName: (name) => `Tên nhóm nhận diện: ${name}`,
      createGroupSubmit: (count) =>
        count > 0 ? `Tạo Tab Group mới (${count} tab)` : 'Tạo Tab Group mới',
      creatingBtn: 'Đang tạo nhóm...',
      errNoValidUrls:
        'Chưa tìm thấy URL hợp lệ (http:// hoặc https://). Vui lòng dán ít nhất 1 liên kết.',
      extBookmarkTipTitle: 'Mẹo kéo thả nhanh từ Google Chrome:',
      extBookmarkTipDesc:
        'Nhấp chuột phải vào Tab Group trên Chrome → lưu vào thư mục Dấu trang (hoặc nhấn Ctrl+Shift+D), sau đó kéo thư mục đó từ Thanh dấu trang (Ctrl+Shift+B) thả thẳng vào vùng "Thả để tạo Tab Group mới" trên bảng!',
    },
    emptyLane: {
      noLinksIn: (name) => `Chưa có liên kết trong ${name}`,
      subtext: 'Thêm liên kết mới hoặc kéo thả tab vào nhóm này',
      pasteUrl: 'Dán URL',
      pasteUrlAria: (name) => `Dán URL vào ${name}`,
      addLink: 'Thêm link',
      addLinkAria: (name) => `Thêm liên kết mới vào ${name}`,
      quickInputAria: (name) => `Nhập nhanh URL cho ${name}`,
      quickInputPlaceholder: 'https://example.com/bai-viet...',
      save: 'Lưu',
      saveQuickAria: (name: string) => `Lưu nhanh liên kết vào ${name}`,
      cancelQuickAria: 'Huỷ dán nhanh',
      errEmptyUrl: 'Vui lòng nhập hoặc dán một URL hợp lệ.',
      errSaveFailed: 'Không thể lưu URL. Vui lòng kiểm tra lại định dạng.',
    },
    addModal: {
      title: 'Thêm liên kết',
      closeAria: 'Đóng hộp thoại',
      urlPlaceholder: 'Dán hoặc kéo thả URL vào đây...',
      save: 'Lưu',
      dropActiveHint: 'Thả URL ngay để lưu tức thì',
      dropIdleHint: 'Kéo & thả liên kết bất kỳ vào ô này hoặc nhấn Enter',
      errEmptyUrl: 'Vui lòng nhập hoặc kéo thả một URL hợp lệ.',
      errInvalidDrop: 'Không đọc được URL hợp lệ từ mục vừa thả.',
    },
    auth: {
      loading: 'Đang tải...',
      accountFallback: 'Tài khoản',
      userFallback: 'Người dùng TabFlow',
      accountSyncTitle: 'Tài khoản & đồng bộ Tab Group',
      cloudSyncedTitle: 'Đã đồng bộ đám mây (Firestore)',
      accountSavedTitle: 'Đã lưu theo tài khoản',
      savedBadge: 'Đã lưu',
      onlineSyncStatus: 'Đồng bộ Tab Group trực tuyến',
      accountSavedStatus: 'Đã lưu Tab Group theo tài khoản',
      signOut: 'Đăng xuất',
      signInBtn: 'Đăng nhập',
      signInBtnMobile: 'Đăng nhập',
      signInBtnTitle: 'Đăng nhập hoặc Đăng ký tài khoản để lưu Tab Group',
      guestBtn: 'Guest Login',
      guestBtnMobile: 'Guest',
      guestBtnTitle: 'Đăng nhập nhanh với tư cách Khách (Firebase Guest)',
      guestModalBtn: 'Tiếp tục với tư cách Khách (Guest Login)',
      guestDisplayName: 'Khách (Guest)',
      guestAccountSubtext: 'Phiên Khách liên kết Firebase',
      switchAccountBtn: 'Đăng nhập tài khoản chính thức',
      modalTitle: 'Tài khoản TabFlow — Lưu trữ Tab Group',
      closeModalAria: 'Đóng hộp thoại',
      tabLogin: 'Đăng nhập',
      tabRegister: 'Đăng ký',
      googleLogin: 'Tiếp tục với tài khoản Google',
      googleRegister: 'Đăng ký nhanh bằng Google',
      orUseEmail: 'hoặc dùng Email',
      displayNameLabel: 'Tên hiển thị',
      displayNamePlaceholder: 'Nguyễn Văn A',
      emailLabel: 'Email',
      emailPlaceholder: 'ban@example.com',
      passwordLabel: 'Mật khẩu',
      confirmPasswordLabel: 'Xác nhận mật khẩu',
      submitLogin: 'Đăng nhập',
      submitRegister: 'Tạo tài khoản',
      errPopupClosed: 'Bạn đã đóng cửa sổ đăng nhập Google.',
      errPopupBlocked:
        'Trình duyệt đã chặn cửa sổ bật lên (popup). Vui lòng cho phép popup và thử lại.',
      errGoogleFailed: 'Không thể đăng nhập bằng Google. Vui lòng thử lại.',
      errGuestNotAllowed:
        'Phương thức Anonymous (Guest Login) chưa được bật trong Firebase Console. Vui lòng vào Firebase Console → Authentication → Sign-in method → Anonymous → Enable, hoặc bấm "Tiếp tục với tài khoản Google" ở trên.',
      errMissingEmailPass: 'Vui lòng nhập đầy đủ email và mật khẩu.',
      errMissingName: 'Vui lòng nhập tên hiển thị của bạn.',
      errShortPassword: 'Mật khẩu phải có ít nhất 6 ký tự.',
      errPasswordMismatch: 'Mật khẩu xác nhận không khớp.',
      errOperationNotAllowed:
        'Phương thức Email/Mật khẩu chưa được bật trong Firebase Console. Bạn có thể bấm "Tiếp tục với tài khoản Google" ở trên để đăng nhập ngay, hoặc bật Email/Password trong Firebase Console (Authentication → Sign-in method → Email/Password).',
      errInvalidCredential: 'Email hoặc mật khẩu không chính xác.',
      errEmailInUse:
        'Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập.',
      errInvalidEmail: 'Địa chỉ email không hợp lệ.',
      errGenericAuth: 'Đã xảy ra lỗi khi xác thực. Vui lòng thử lại.',
    },
  },
  en: {
    header: {
      allGroupsAria: 'View all tab groups',
      languageSelectorAria: 'Select interface language',
      langViLabel: 'VI',
      langEnLabel: 'EN',
      langViTitle: 'Tiếng Việt (Vietnamese)',
      langEnTitle: 'English',
      importTabGroupBtn: 'Import Tab Group',
      importTabGroupMobile: 'Import',
      importTabGroupTitle:
        'Drag & drop tabs/Bookmark folders or paste multiple URLs to create a Tab Group',
    },
    theme: {
      selectorAria: 'Select Light or Dark theme mode',
      light: 'Light',
      dark: 'Dark',
      lightTitle: 'Light Theme (#FFFAFF · #0A2463 · #3E92CC · #D8315B)',
      darkTitle:
        'Dark Theme (Black #090A0D · Slate #12141A / #262A34 · Ice White #F0F7FF)',
    },
    sidebar: {
      ariaLabel: 'Tab Groups sidebar',
      expandSidebar: 'Expand sidebar',
      collapseSidebar: 'Collapse sidebar',
      newGroup: 'New Group',
      groupNameLabel: 'Group Name',
      groupNamePlaceholder: 'e.g. Reading List',
      cancelNewGroup: 'Cancel new group',
      addTabGroup: 'Add Tab Group',
      allSavedTabs: 'All Saved Tabs',
      editGroupNameTitle: 'Click to edit group name',
      editGroupNameAria: (name) => `Edit group name ${name}`,
      deleteGroupTitle: 'Delete this group',
      deleteGroupAria: (name) => `Delete group ${name}`,
      confirmDeleteTitle: 'Confirm Delete Group',
      closeConfirmAria: 'Close confirmation dialog',
      confirmDeletePromptPrefix: 'Are you sure you want to delete group',
      tabUnit: 'tabs',
      confirmDeleteWarning: (count) =>
        `Note: All ${count} saved tab(s) inside this group will also be permanently deleted.`,
      cancel: 'Cancel',
      confirmDeleteBtn: 'Delete Group',
      dropNewGroupLabel: 'Drop tab here to create new group',
      dropNewGroupActive: 'Drop now to create new Tab Group',
      dropNewGroupCollapsedTitle:
        'Drag & drop tabs or a Bookmark folder here to create a new Tab Group',
    },
    board: {
      dismissErrorAria: 'Dismiss error',
      tabGroupAria: (name) => `Tab group ${name}`,
      toggleGroupAria: (name) => `Toggle ${name} group`,
      expandGroupTitle: 'Expand group',
      collapseGroupTitle: 'Collapse group',
      editGroupTitle: 'Click to edit group name',
      dragGroupTitle: 'Hold and drag to reorder tab group',
      changeColorAria: (name) => `Change color for ${name}`,
      changeColorTitle: 'Change group color',
      setColorAria: (colorLabel) => `Set group color ${colorLabel}`,
      openAll: 'Open all',
      addLinkToGroupAria: (name) => `Add link to ${name}`,
      addLinkToGroupTitle: (name) => `Add link to ${name}`,
      dropToAdd: (name) => `Drop tab or URL to add to ${name}`,
      openInNewTabAria: (title) => `Open ${title} in new tab`,
      deleteLinkAria: (title) => `Delete ${title}`,
      bottomNavAria: 'Bottom tab group selection',
      scrollLeftAria: 'Scroll board left',
      scrollLeftTitle: 'Scroll left',
      scrollRightAria: 'Scroll board right',
      scrollRightTitle: 'Scroll right',
      emptyBoardTitle: 'No saved links yet',
      emptyBoardSubtext:
        'Drag & drop tabs or Bookmark folders from Chrome here, or press Ctrl+V to paste multiple URLs and create a new Tab Group.',
      emptyBoardAddBtn: 'Add Link',
      emptyBoardImportBtn: 'Import Tab Group',
      dropNewGroupTitle: 'Drop to create new Tab Group',
      dropNewGroupSubtext:
        'Drag & drop tabs from Chrome or Bookmark folders here to create a group and rename immediately.',
      dropNewGroupActive: 'Drop now to create new Tab Group!',
      dropNewGroupPasteHint: 'Or click Import Tab Group / Ctrl+V',
      defaultNewGroupName: 'New Tab Group',
      creatingGroupStatus: 'Creating new Tab Group...',
      colors: {
        blue: 'Blue',
        cyan: 'Cyan',
        emerald: 'Green',
        amber: 'Yellow',
        orange: 'Orange',
        red: 'Red',
        rose: 'Pink',
        purple: 'Purple',
        indigo: 'Indigo',
        zinc: 'Grey',
      },
    },
    chromeImport: {
      modalTitle: 'Import Tab Group into TabFlow',
      closeAria: 'Close Tab Group import modal',
      tabPaste: 'Quick Paste URLs / Bookmark',
      groupNameOptionalLabel:
        'Group Name (leave blank to auto-name & focus inline rename upon creation)',
      groupNameOptionalPlaceholder: 'e.g. Design Research (optional)',
      colorLabel: 'Group Color',
      pasteInputLabel:
        'Paste URLs or Bookmark folder HTML',
      pasteInputPlaceholder:
        'https://github.com/...\nhttps://figma.com/...\n(Or drag & drop multiple tabs / Bookmark folders into this box)',
      pasteDropHint:
        'You can drag & drop tabs or Bookmark folders directly into the box above.',
      pasteFromClipboardBtn: 'Paste from Clipboard',
      detectedTabsCount: (count) => `Detected ${count} valid tab(s)`,
      detectedGroupName: (name) => `Detected group name: ${name}`,
      createGroupSubmit: (count) =>
        count > 0 ? `Create New Tab Group (${count} tabs)` : 'Create New Tab Group',
      creatingBtn: 'Creating group...',
      errNoValidUrls:
        'No valid URLs (http:// or https://) found. Please paste at least one link.',
      extBookmarkTipTitle: 'Quick Drag & Drop Tip from Google Chrome:',
      extBookmarkTipDesc:
        'Bookmark your open tabs into a folder (Ctrl+Shift+D in Chrome), then drag that folder from the Chrome Bookmarks Bar (Ctrl+Shift+B) and drop it directly onto "Drop to create new Tab Group" on the board!',
    },
    emptyLane: {
      noLinksIn: (name) => `No links in ${name}`,
      subtext: 'Add a new link or drag a tab into this group',
      pasteUrl: 'Paste URL',
      pasteUrlAria: (name) => `Paste URL into ${name}`,
      addLink: 'Add Link',
      addLinkAria: (name) => `Add new link to ${name}`,
      quickInputAria: (name) => `Quick URL input for ${name}`,
      quickInputPlaceholder: 'https://example.com/article...',
      save: 'Save',
      saveQuickAria: (name: string) => `Save quick link to ${name}`,
      cancelQuickAria: 'Cancel quick paste',
      errEmptyUrl: 'Please enter or paste a valid URL.',
      errSaveFailed: 'Could not save URL. Check the domain format.',
    },
    addModal: {
      title: 'Add Link',
      closeAria: 'Close modal',
      urlPlaceholder: 'Paste or drag & drop URL here...',
      save: 'Save',
      dropActiveHint: 'Drop URL now to save immediately',
      dropIdleHint: 'Drag & drop any link into this box or press Enter',
      errEmptyUrl: 'Please enter or drop a valid URL.',
      errInvalidDrop: 'Could not read a valid URL from the dropped item.',
    },
    auth: {
      loading: 'Loading...',
      accountFallback: 'Account',
      userFallback: 'TabFlow User',
      accountSyncTitle: 'Account & Tab Group Sync',
      cloudSyncedTitle: 'Cloud synced (Firestore)',
      accountSavedTitle: 'Saved to account',
      savedBadge: 'Saved',
      onlineSyncStatus: 'Live Tab Group cloud sync',
      accountSavedStatus: 'Saved to your account',
      signOut: 'Sign out',
      signInBtn: 'Sign in',
      signInBtnMobile: 'Sign in',
      signInBtnTitle: 'Sign in or Sign up to save your Tab Groups',
      guestBtn: 'Guest Login',
      guestBtnMobile: 'Guest',
      guestBtnTitle: 'Quick sign in as Guest (Firebase Anonymous Auth)',
      guestModalBtn: 'Continue as Guest (Firebase Guest Login)',
      guestDisplayName: 'Guest User',
      guestAccountSubtext: 'Firebase-linked Guest session',
      switchAccountBtn: 'Sign in with Google / Email',
      modalTitle: 'TabFlow Account — Save Tab Groups',
      closeModalAria: 'Close dialog',
      tabLogin: 'Sign In',
      tabRegister: 'Sign Up',
      googleLogin: 'Continue with Google',
      googleRegister: 'Quick sign up with Google',
      orUseEmail: 'or use Email',
      displayNameLabel: 'Display name',
      displayNamePlaceholder: 'Alex Rivera',
      emailLabel: 'Email',
      emailPlaceholder: 'you@example.com',
      passwordLabel: 'Password',
      confirmPasswordLabel: 'Confirm password',
      submitLogin: 'Sign In',
      submitRegister: 'Create Account',
      errPopupClosed: 'Google sign-in popup was closed.',
      errPopupBlocked:
        'Browser blocked the sign-in popup. Please allow popups and try again.',
      errGoogleFailed: 'Could not sign in with Google. Please try again.',
      errGuestNotAllowed:
        'Anonymous (Guest) sign-in is not enabled in Firebase Console yet. Enable it in Firebase Console → Authentication → Sign-in method → Anonymous → Enable, or click "Continue with Google" above.',
      errMissingEmailPass: 'Please enter both your email and password.',
      errMissingName: 'Please enter your display name.',
      errShortPassword: 'Password must be at least 6 characters.',
      errPasswordMismatch: 'Confirmation password does not match.',
      errOperationNotAllowed:
        'Email/Password sign-in is not enabled in Firebase Console yet. Click "Continue with Google" above to sign in right away, or enable Email/Password in Firebase Console (Authentication → Sign-in method → Email/Password).',
      errInvalidCredential: 'Incorrect email or password.',
      errEmailInUse:
        'This email is already registered. Please switch to the Sign In tab.',
      errInvalidEmail: 'Invalid email address.',
      errGenericAuth: 'Authentication failed. Please try again.',
    },
  },
};

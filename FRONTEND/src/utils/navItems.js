/**
 * Danh sách mục menu của khung trang + các hàm thuần để lọc theo quyền và
 * chia "chính / Thêm". `icon` là tên biểu tượng trong components/ui/icons.jsx
 * (Layout tự đổi tên thành component).
 */

export const MAX_TABS = 5;
export const PRIMARY_TABS = 4;

export const NAV_ITEMS = [
  {
    key: "bills",
    label: "Bill cầu",
    icon: "receipt",
    // Trang chi tiết / sửa bill cũng tính là đang ở mục này.
    activePrefixes: ["/bills"],
    children: [
      {
        key: "bills-list",
        path: "/",
        label: "Danh sách bill cầu",
        icon: "receipt",
        permission: "bills.view",
      },
      {
        key: "bills-create",
        path: "/bills/create",
        label: "Tạo bill cầu mới",
        icon: "plus",
        permission: "bills.create",
      },
    ],
  },
  {
    key: "party-bills",
    label: "Bill tiệc",
    icon: "utensils",
    activePrefixes: ["/party-bills"],
    children: [
      {
        key: "party-bills-list",
        path: "/party-bills",
        label: "Danh sách bill tiệc",
        icon: "utensils",
        permission: "party_bills.view",
      },
      {
        key: "party-bills-create",
        path: "/party-bills/create",
        label: "Tạo bill tiệc mới",
        icon: "plus",
        permission: "party_bills.create",
      },
    ],
  },
  {
    key: "players",
    path: "/players",
    label: "Người chơi",
    icon: "users",
    permission: "users.view",
  },
  {
    key: "tournament",
    path: "/tournament-brackets",
    label: "Xếp bảng",
    icon: "trophy",
    permission: "tournament_brackets.view",
  },
  {
    key: "car-rental",
    path: "/car-rental",
    label: "Thuê xe",
    icon: "car",
    permission: "car_rentals.view",
  },
  {
    key: "master",
    path: "/master",
    label: "Master",
    icon: "settings",
    // Các đường dẫn master cũ vẫn chuyển hướng vào /master.
    extraPaths: ["/ratios", "/menus", "/shuttles", "/payment-accounts"],
    hasAnyPermission: [
      "ratios.view",
      "menus.view",
      "shuttles.view",
      "payment_accounts.view",
    ],
  },
  {
    key: "roles",
    path: "/roles",
    label: "Quyền",
    icon: "shield",
    permission: "roles.view",
  },
];

const canSee = (item, hasPermission) => {
  if (item.hasAnyPermission) {
    return item.hasAnyPermission.some((name) => hasPermission(name));
  }
  return !item.permission || hasPermission(item.permission);
};

/**
 * Lọc theo quyền. Với nhóm thì lọc từng mục con trước: không con nào được
 * phép thì bỏ cả nhóm, còn đúng 1 con thì hạ thành link đơn vì dropdown chỉ
 * có một lựa chọn chỉ tổ thêm một cú bấm.
 */
export function filterNavItems(items, hasPermission) {
  return items.flatMap((item) => {
    if (!item.children) {
      return canSee(item, hasPermission) ? [item] : [];
    }

    const children = item.children.filter((child) =>
      canSee(child, hasPermission),
    );

    if (children.length === 0) return [];
    if (children.length === 1) {
      // Giữ nhãn / biểu tượng của nhóm cho ngắn gọn (nhãn tab dưới đáy chỉ
      // vừa vài chữ) và để trang chi tiết bill vẫn tô sáng đúng mục.
      return [
        {
          ...children[0],
          label: item.label,
          icon: item.icon,
          activePrefixes: item.activePrefixes,
        },
      ];
    }

    return [{ ...item, children }];
  });
}

/** Tối đa 5 mục thì hiện hết; nhiều hơn thì 4 mục đầu + phần còn lại vào "Thêm". */
export function splitNavItems(items, max = MAX_TABS) {
  if (items.length <= max) return { primary: items, more: [] };

  return {
    primary: items.slice(0, max - 1),
    more: items.slice(max - 1),
  };
}

/** Thanh tab điện thoại: nhóm trỏ thẳng vào trang đầu tiên (trang danh sách). */
export function toTabItems(items) {
  return items.map((item) => {
    if (!item.children) return item;

    const { children, ...rest } = item;
    return { ...rest, path: children[0].path };
  });
}

const underPrefix = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export function isNavItemActive(item, pathname) {
  if (item.children) {
    return (
      item.children.some((child) => child.path === pathname) ||
      (item.activePrefixes ?? []).some((prefix) =>
        underPrefix(pathname, prefix),
      )
    );
  }

  if (item.path === pathname) return true;
  if ((item.extraPaths ?? []).includes(pathname)) return true;
  return (item.activePrefixes ?? []).some((prefix) =>
    underPrefix(pathname, prefix),
  );
}

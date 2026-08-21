import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import NavDropdown from "./NavDropdown";

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  const isActive = (path) => {
    if (path === "/master") {
      // Active if current path starts with /master or is one of the old master paths
      return (
        location.pathname === "/master" ||
        location.pathname === "/ratios" ||
        location.pathname === "/menus" ||
        location.pathname === "/shuttles" ||
        location.pathname === "/payment-accounts"
      );
    }
    return location.pathname === path;
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNavClick = () => {
    setIsDrawerOpen(false);
  };

  const allNavItems = [
    {
      key: "bills",
      label: "Bill cầu",
      icon: "📊",
      children: [
        {
          path: "/",
          label: "Danh sách bill cầu",
          icon: "📊",
          permission: "bills.view",
        },
        {
          path: "/bills/create",
          label: "Tạo bill cầu mới",
          icon: "➕",
          permission: "bills.create",
        },
      ],
    },
    {
      key: "party-bills",
      label: "Bill tiệc",
      icon: "🍽️",
      children: [
        {
          path: "/party-bills",
          label: "Danh sách bill tiệc",
          icon: "🍽️",
          permission: "party_bills.view",
        },
        {
          path: "/party-bills/create",
          label: "Tạo bill tiệc mới",
          icon: "🎉",
          permission: "party_bills.create",
        },
      ],
    },
    {
      path: "/players",
      label: "Người chơi",
      icon: "👥",
      permission: "users.view",
    },
    {
      path: "/tournament-brackets",
      label: "Xếp bảng",
      icon: "🏆",
      permission: "tournament_brackets.view",
    },
    {
      path: "/car-rental",
      label: "Thuê xe",
      icon: "🚗",
      permission: "car_rentals.view",
    },
    {
      path: "/master",
      label: "Master",
      icon: "⚙️",
      permission: null, // Will check if user has any of the master permissions
      hasAnyPermission: [
        "ratios.view",
        "menus.view",
        "shuttles.view",
        "payment_accounts.view",
      ],
    },
    { path: "/roles", label: "Quyền", icon: "🔐", permission: "roles.view" },
  ];

  const canSee = (item) => {
    if (item.hasAnyPermission) {
      // Show if user has any of the required permissions
      return item.hasAnyPermission.some((perm) => hasPermission(perm));
    }
    return !item.permission || hasPermission(item.permission);
  };

  // Lọc theo quyền. Với nhóm thì lọc từng mục con trước: không con nào được
  // phép thì bỏ cả nhóm, còn đúng 1 con thì hạ cấp thành link đơn vì dropdown
  // chỉ có một lựa chọn chỉ tổ thêm một cú bấm.
  const navItems = allNavItems.flatMap((item) => {
    if (!item.children) {
      return canSee(item) ? [item] : [];
    }

    const children = item.children.filter(canSee);

    if (children.length === 0) return [];
    if (children.length === 1) return [children[0]];

    return [{ ...item, children }];
  });

  const isGroupActive = (group) =>
    group.children.some((child) => isActive(child.path));

  // Chưa bấm lần nào thì nhóm đang active mở sẵn.
  const isGroupOpen = (group) => openGroups[group.key] ?? isGroupActive(group);

  const toggleGroup = (group) =>
    setOpenGroups((prev) => ({ ...prev, [group.key]: !isGroupOpen(group) }));

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="sm:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              {/* Desktop Navigation */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) =>
                  item.children ? (
                    <NavDropdown
                      key={item.key}
                      group={item}
                      isActive={isGroupActive(item)}
                      isItemActive={isActive}
                    />
                  ) : (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive(item.path)
                          ? "border-blue-500 text-gray-900"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <>
                  <div className="hidden sm:block text-sm text-gray-700">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-gray-500">
                      {user.roles?.map((r) => r.display_name).join(", ") ||
                        "Chưa có quyền"}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Đăng xuất
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
            onClick={() => setIsDrawerOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out sm:hidden">
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto">
                <nav className="p-4 space-y-1">
                  {navItems.map((item) =>
                    item.children ? (
                      <div key={item.key}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(item)}
                          aria-expanded={isGroupOpen(item)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-base font-medium transition-colors ${
                            isGroupActive(item)
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <span className="flex items-center">
                            <span className="mr-3 text-xl">{item.icon}</span>
                            {item.label}
                          </span>
                          <svg
                            className={`h-4 w-4 transition-transform ${
                              isGroupOpen(item) ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {isGroupOpen(item) && (
                          <div className="mt-1 ml-5 pl-2 space-y-1 border-l-2 border-slate-200">
                            {item.children.map((child) => (
                              <Link
                                key={child.path}
                                to={child.path}
                                onClick={handleNavClick}
                                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                                  isActive(child.path)
                                    ? "bg-blue-50 text-blue-700 border-l-4 border-blue-500"
                                    : "text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                <span className="mr-3 text-lg">{child.icon}</span>
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={handleNavClick}
                        className={`flex items-center px-4 py-3 rounded-md text-base font-medium transition-colors ${
                          isActive(item.path)
                            ? "bg-blue-50 text-blue-700 border-l-4 border-blue-500"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <span className="mr-3 text-xl">{item.icon}</span>
                        {item.label}
                      </Link>
                    )
                  )}
                </nav>
              </div>
              {/* Drawer Footer */}
              {user && (
                <div className="p-4 border-t border-gray-200">
                  <div className="text-sm text-gray-700 mb-2">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-gray-500">
                      {user.roles?.map((r) => r.display_name).join(", ") ||
                        "Chưa có quyền"}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

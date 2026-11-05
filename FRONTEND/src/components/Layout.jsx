import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import NavDropdown from "./NavDropdown";
import Modal from "./ui/Modal";
import { AppBarBackLink } from "./ui/AppBar";
import AppBarContext from "./ui/appBarContext";
import useDismiss from "./ui/useDismiss";
import useKeyboardInset from "./ui/useKeyboardInset";
import {
  Car,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  LogOut,
  Plus,
  Receipt,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  UtensilsCrossed,
} from "./ui/icons";
import {
  NAV_ITEMS,
  filterNavItems,
  isNavItemActive,
  pushedBackLink,
  screenTitle,
  splitNavItems,
  toTabItems,
} from "../utils/navItems";
import { KEYBOARD_OPEN_MIN } from "../utils/keyboardInset";

const NAV_ICONS = {
  receipt: Receipt,
  utensils: UtensilsCrossed,
  users: Users,
  trophy: Trophy,
  car: Car,
  settings: Settings,
  shield: ShieldCheck,
  plus: Plus,
};

const iconOf = (item) => NAV_ICONS[item.icon];

const roleText = (user) =>
  user.roles?.map((r) => r.display_name).join(", ") || "Chưa có quyền";

// Chữ cái đầu của tên gọi (từ cuối): "Võ Trường" -> "T"
const initialOf = (name) => {
  const words = (name || "").trim().split(/\s+/);
  return (words[words.length - 1]?.[0] || "?").toUpperCase();
};

function Avatar({ name, className = "h-8 w-8" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 ${className}`}
    >
      {initialOf(name)}
    </span>
  );
}

const pillClass = (active) =>
  `inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
    active
      ? "bg-slate-100 text-slate-900"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

function DesktopNavList({ items, pathname }) {
  return items.map((item) => {
    const active = isNavItemActive(item, pathname);
    const IconComponent = NAV_ICONS[item.icon];

    if (item.children) {
      return (
        <NavDropdown
          key={item.key}
          label={item.label}
          icon={IconComponent}
          items={item.children.map((child) => ({
            ...child,
            icon: iconOf(child),
          }))}
          isActive={active}
          isItemActive={(child) => child.path === pathname}
        />
      );
    }

    return (
      <Link
        key={item.key}
        to={item.path}
        aria-current={active ? "page" : undefined}
        className={pillClass(active)}
      >
        <IconComponent
          className={`hidden h-4 w-4 xl:block ${active ? "text-emerald-700" : ""}`}
        />
        {item.label}
      </Link>
    );
  });
}

function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  useDismiss(open, containerRef, close);

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Tài khoản"
        className="flex h-10 items-center gap-2 rounded-xl pl-1 pr-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
      >
        <Avatar name={user.name} />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 xl:block">
          {user.name}
        </span>
        <ChevronDown
          className={`hidden h-4 w-4 text-slate-400 transition-transform lg:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          <div className="px-3 py-2">
            <div className="break-words text-sm font-medium text-slate-900">
              {user.name}
            </div>
            <div className="break-words text-xs text-slate-500">
              {roleText(user)}
            </div>
          </div>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={onLogout}
            className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function TabLink({ item, active }) {
  const IconComponent = NAV_ICONS[item.icon];

  return (
    <Link
      to={item.path}
      aria-current={active ? "page" : undefined}
      data-active={active}
      className="tab-bar-item"
    >
      <span className="tab-bar-pill">
        <IconComponent className="h-[22px] w-[22px]" />
      </span>
      <span className="tab-bar-label">{item.label}</span>
    </Link>
  );
}

// Thẻ tài khoản đầu sheet "Thêm" / "Tài khoản": Đăng xuất là hàng chữ trong thẻ, xa chỗ ngón cái nghỉ.
function AccountCard({ user, onLogout }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-3 p-3">
        <Avatar name={user.name} className="h-10 w-10" />
        <div className="min-w-0">
          <div className="break-words text-[15px] font-semibold leading-5 text-slate-900">
            {user.name}
          </div>
          <div className="break-words text-[13px] leading-[18px] text-slate-500">
            {roleText(user)}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 p-1">
        <button
          type="button"
          onClick={onLogout}
          className="flex h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

// Bàn phím ảo đang mở: đặt data-keyboard="open" lên <html> để CSS ẩn tab / FAB.
function useKeyboardFlag() {
  const { inset } = useKeyboardInset();
  const open = inset > KEYBOARD_OPEN_MIN;

  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.keyboard = "open";
    else delete root.dataset.keyboard;
    return () => {
      delete root.dataset.keyboard;
    };
  }, [open]);
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Thanh trên điện thoại: màn đưa tiêu đề / ‹ / ⋯ vào `slot` (AppBar, PageHeader) và báo
  // loại màn qua `register` — màn không phải sửa Layout.
  const [slot, setSlot] = useState(null);
  const [page, setPage] = useState(null);
  const register = useCallback((config) => {
    setPage(config);
    return () => setPage((current) => (current === config ? null : current));
  }, []);
  const appBar = useMemo(() => ({ slot, register }), [slot, register]);
  useKeyboardFlag();

  const pathname = location.pathname;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = filterNavItems(NAV_ITEMS, hasPermission);

  // Desktop vừa (640–1023): 4 mục chính + "Thêm"; từ lg trở lên hiện đủ.
  const desktopSplit = splitNavItems(navItems);
  const desktopMore = desktopSplit.more.flatMap((item) =>
    item.children
      ? item.children.map((child) => ({ ...child, icon: iconOf(child) }))
      : [{ ...item, icon: iconOf(item) }],
  );

  // Điện thoại: thanh tab dưới đáy, nhóm trỏ thẳng vào trang danh sách.
  const tabItems = toTabItems(navItems);
  const tabSplit = splitNavItems(tabItems);
  const moreActive = tabSplit.more.some((item) =>
    isNavItemActive(item, pathname),
  );
  // Màn đẩy vào (tạo / sửa / chi tiết bill): nút ‹ thay biểu tượng app, không vòng tài khoản,
  // không tab. Màn chưa tự đặt nút quay lại (đang tải, lỗi) thì dùng nút dự phòng theo đường dẫn.
  const fallbackBack = pushedBackLink(pathname);
  const pushed = Boolean(fallbackBack) || Boolean(page?.pushed);
  const showTabBar = !pushed && !page?.hideTabBar;

  const closeSheet = () => setSheetOpen(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Điện thoại: một thanh 56 px. Màn gốc: biểu tượng + tiêu đề trang + tài khoản; màn đẩy vào: ‹ + tiêu đề + ⋯ */}
      <header className={`app-bar ${pushed ? "app-bar-pushed" : ""}`}>
        {!pushed && (
          <img src="/favicon.svg" alt="" className="mr-2 h-7 w-7 flex-none" />
        )}
        {pushed && !page?.pushed && fallbackBack && (
          <AppBarBackLink back={fallbackBack} />
        )}
        {!page && (
          <span className="app-bar-title">
            {screenTitle(tabItems, pathname)}
          </span>
        )}
        <div
          ref={setSlot}
          className={page ? "flex min-w-0 flex-1 items-center gap-0.5" : "hidden"}
        />
        {!pushed && user && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Tài khoản"
            aria-haspopup="dialog"
            className="app-bar-btn rounded-full"
          >
            <Avatar name={user.name} className="h-8 w-8" />
          </button>
        )}
      </header>

      <header className="sticky top-0 z-30 hidden border-b border-slate-200 bg-white/80 backdrop-blur sm:block">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="-ml-1 flex min-h-11 flex-shrink-0 items-center gap-2 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          >
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="font-semibold tracking-tight text-slate-900 sm:hidden md:inline">
              Sổ cầu lông
            </span>
          </Link>

          <nav
            aria-label="Điều hướng chính"
            className="ml-2 hidden min-w-0 flex-1 items-center gap-1 sm:flex"
          >
            <div className="hidden items-center gap-1 lg:flex">
              <DesktopNavList items={navItems} pathname={pathname} />
            </div>
            <div className="flex items-center gap-1 lg:hidden">
              <DesktopNavList items={desktopSplit.primary} pathname={pathname} />
              {desktopMore.length > 0 && (
                <NavDropdown
                  label="Thêm"
                  icon={Ellipsis}
                  items={desktopMore}
                  isActive={desktopSplit.more.some((item) =>
                    isNavItemActive(item, pathname),
                  )}
                  isItemActive={(item) => item.path === pathname}
                />
              )}
            </div>
          </nav>

          {user && (
            <div className="ml-auto flex items-center sm:ml-0">
              <AccountMenu user={user} onLogout={handleLogout} />
            </div>
          )}
        </div>
      </header>

      <main
        className={`app-main mx-auto max-w-7xl pt-3 sm:px-6 sm:py-6 lg:px-8 ${
          showTabBar
            ? "pb-[calc(var(--tab-bar-h)+env(safe-area-inset-bottom)+1rem)] sm:pb-6"
            : "pb-3 sm:pb-6"
        }`}
      >
        <AppBarContext.Provider value={appBar}>{children}</AppBarContext.Provider>
      </main>

      {showTabBar && (
        <nav aria-label="Điều hướng chính" className="tab-bar">
          {tabSplit.primary.map((item) => (
            <TabLink
              key={item.key}
              item={item}
              active={isNavItemActive(item, pathname)}
            />
          ))}
          {tabSplit.more.length > 0 && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              data-active={moreActive}
              className="tab-bar-item"
            >
              <span className="tab-bar-pill">
                <Ellipsis className="h-[22px] w-[22px]" />
              </span>
              <span className="tab-bar-label">Thêm</span>
            </button>
          )}
        </nav>
      )}

      <Modal
        isOpen={sheetOpen}
        onClose={closeSheet}
        title={tabSplit.more.length > 0 ? "Thêm" : "Tài khoản"}
        size="sm"
        initialFocus="panel"
      >
        {user && <AccountCard user={user} onLogout={handleLogout} />}
        {tabSplit.more.length > 0 && (
          <nav aria-label="Thêm" className="mt-3 flex flex-col gap-0.5">
            {tabSplit.more.map((item) => {
              const active = isNavItemActive(item, pathname);
              const IconComponent = NAV_ICONS[item.icon];
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  onClick={closeSheet}
                  aria-current={active ? "page" : undefined}
                  className="menu-row"
                >
                  <span className="menu-row-icon">
                    <IconComponent />
                  </span>
                  {item.label}
                  <ChevronRight className="menu-row-chevron" />
                </Link>
              );
            })}
          </nav>
        )}
      </Modal>
    </div>
  );
}

import { useRef, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import NavDropdown from "./NavDropdown";
import Modal from "./ui/Modal";
import useDismiss from "./ui/useDismiss";
import {
  Car,
  ChevronDown,
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
  hidesTabBar,
  isNavItemActive,
  splitNavItems,
  toTabItems,
} from "../utils/navItems";

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
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40 ${
        active ? "text-emerald-700" : "text-slate-500"
      }`}
    >
      <span
        className={`flex h-7 w-14 items-center justify-center rounded-full ${active ? "bg-emerald-50" : ""}`}
      >
        <IconComponent className="h-[22px] w-[22px]" />
      </span>
      <span className="max-w-full truncate px-1 text-[11px] font-medium leading-tight">
        {item.label}
      </span>
    </Link>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

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
  const tabSplit = splitNavItems(toTabItems(navItems));
  const moreActive = tabSplit.more.some((item) =>
    isNavItemActive(item, pathname),
  );
  const showTabBar = !hidesTabBar(pathname);

  const closeSheet = () => setSheetOpen(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="-ml-1 flex flex-shrink-0 items-center gap-2 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
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
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label="Tài khoản"
                className="-mr-1 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 sm:hidden"
              >
                <Avatar name={user.name} className="h-9 w-9" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main
        className={`mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8 ${
          showTabBar
            ? "pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 sm:pb-6"
            : "py-6"
        }`}
      >
        {children}
      </main>

      {showTabBar && (
        <nav
          aria-label="Điều hướng chính"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        >
          <div className="flex h-16">
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
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40 ${
                  moreActive ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                <span
                  className={`flex h-7 w-14 items-center justify-center rounded-full ${moreActive ? "bg-emerald-50" : ""}`}
                >
                  <Ellipsis className="h-[22px] w-[22px]" />
                </span>
                <span className="text-[11px] font-medium leading-tight">
                  Thêm
                </span>
              </button>
            )}
          </div>
        </nav>
      )}

      <Modal
        isOpen={sheetOpen}
        onClose={closeSheet}
        title={tabSplit.more.length > 0 ? "Thêm" : "Tài khoản"}
        size="sm"
      >
        {tabSplit.more.length > 0 && (
          <nav aria-label="Thêm" className="space-y-1">
            {tabSplit.more.map((item) => {
              const active = isNavItemActive(item, pathname);
              const IconComponent = NAV_ICONS[item.icon];
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  onClick={closeSheet}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <IconComponent
                    className={`h-5 w-5 ${active ? "text-emerald-700" : "text-slate-500"}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        {user && (
          <div
            className={
              tabSplit.more.length > 0 ? "mt-3 border-t border-slate-100 pt-4" : ""
            }
          >
            <div className="flex items-center gap-3">
              <Avatar name={user.name} className="h-10 w-10" />
              <div className="min-w-0">
                <div className="break-words text-sm font-medium text-slate-900">
                  {user.name}
                </div>
                <div className="break-words text-xs text-slate-500">
                  {roleText(user)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-secondary mb-1 mt-4 w-full"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

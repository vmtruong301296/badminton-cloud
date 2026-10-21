/**
 * Biểu tượng riêng cho màn bill tiệc, cùng kiểu với components/ui/icons.jsx
 * (đường vẽ chép từ Lucide, https://lucide.dev, giấy phép ISC). Chưa có trong
 * icons.jsx dùng chung; khi nào bổ sung ở đó thì chuyển sang dùng bản chung.
 */

function Icon({ className = "h-5 w-5", children, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export const Download = (props) => (
  <Icon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </Icon>
);

export const Send = (props) => (
  <Icon {...props}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </Icon>
);

export const Calendar = (props) => (
  <Icon {...props}>
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </Icon>
);

export const Check = (props) => (
  <Icon {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const Circle = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
  </Icon>
);

export const Clock = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
);

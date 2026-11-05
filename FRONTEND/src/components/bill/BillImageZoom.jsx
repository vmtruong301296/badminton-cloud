import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../ui/icons';

// Ảnh bill dựng ở pixelRatio 2 (BillDetail / PartyBillDetail) → cỡ thật trên màn = ảnh / 2.
const EXPORT_PIXEL_RATIO = 2;

/** Xem ảnh đúng cỡ thật, kéo ngang / dọc; ✕ hoặc Esc quay lại hộp. */
export default function BillImageZoom({ url, alt, onClose }) {
  const closeRef = useRef(null);
  const scrollerRef = useRef(null);
  const [width, setWidth] = useState(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Dừng phím ở đây để Modal bên dưới (nghe ở document) không đóng hộp / kéo focus về.
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      const next = document.activeElement === closeRef.current ? scrollerRef.current : closeRef.current;
      next?.focus();
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[60] flex flex-col bg-slate-900"
    >
      <div className="flex flex-none items-center justify-end px-1.5 pt-[env(safe-area-inset-top)]">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="flex h-14 w-14 items-center justify-center rounded-xl text-white active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <div
        ref={scrollerRef}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto overscroll-contain bg-white focus-visible:outline-none"
      >
        <img
          src={url}
          alt={alt}
          onLoad={(e) => setWidth(e.currentTarget.naturalWidth / EXPORT_PIXEL_RATIO)}
          style={width ? { width } : undefined}
          className="block max-w-none"
        />
      </div>
    </div>,
    document.body,
  );
}

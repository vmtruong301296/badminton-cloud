import { useCallback, useSyncExternalStore } from "react";
import { keyboardInset } from "../../utils/keyboardInset";

const readInset = () => {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return keyboardInset({
    innerHeight: window.innerHeight,
    height: vv.height,
    offsetTop: vv.offsetTop,
  });
};

const readViewportHeight = () =>
  Math.round(window.visualViewport?.height ?? window.innerHeight);

const serverZero = () => 0;

/**
 * Theo dõi bàn phím ảo qua window.visualViewport.
 * Trả { inset, viewportHeight }: inset = phần đáy bị bàn phím che (px, 0 khi không có
 * bàn phím hoặc trình duyệt không có visualViewport); viewportHeight = cao phần nhìn thấy.
 * enabled=false thì không nghe sự kiện (vd Modal đang đóng).
 */
export default function useKeyboardInset(enabled = true) {
  const subscribe = useCallback(
    (onChange) => {
      const vv = window.visualViewport;
      if (!enabled || !vv) return () => {};
      vv.addEventListener("resize", onChange);
      vv.addEventListener("scroll", onChange);
      return () => {
        vv.removeEventListener("resize", onChange);
        vv.removeEventListener("scroll", onChange);
      };
    },
    [enabled],
  );

  const inset = useSyncExternalStore(subscribe, readInset, serverZero);
  const viewportHeight = useSyncExternalStore(
    subscribe,
    readViewportHeight,
    serverZero,
  );

  return { inset: enabled ? inset : 0, viewportHeight };
}

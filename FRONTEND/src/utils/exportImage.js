import { toPng, toBlob } from "html-to-image";

/**
 * Detect Safari / WebKit (incl. iOS Safari and iPadOS-as-desktop).
 * Chrome, Edge, Firefox on iOS still use WebKit but report CriOS/EdgiOS/FxiOS,
 * so exclude those — and exclude desktop Chrome/Android which contain "Safari"
 * in their UA but render fine on the first pass.
 */
function isSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS =
    /iP(ad|hone|od)/.test(ua) ||
    // iPadOS 13+ reports as "MacIntel" with touch points
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isDesktopSafari =
    /^((?!chrome|android|crios|fxios|edgios|edg).)*safari/i.test(ua);
  const isIosNonSafari = /CriOS|FxiOS|EdgiOS/.test(ua);
  return (isIOS && !isIosNonSafari) || isDesktopSafari;
}

/**
 * Capture a node to PNG/Blob, working around the WebKit blank-image bug.
 *
 * html-to-image rasterizes the node by drawing an SVG <foreignObject> (which
 * embeds the QR as a nested data-URI <img>) onto a canvas. On Safari/WebKit
 * the nested image is not yet decoded on the first 1-2 rasterizations, so the
 * QR comes out blank. Re-running the capture warms WebKit's image cache; the
 * final pass renders correctly. Chrome/Firefox get the result on pass 1, so we
 * only pay the extra passes on Safari.
 *
 * @param {(node: HTMLElement, opts: object) => Promise<any>} fn - toPng / toBlob
 */
async function captureReliably(fn, node, options) {
  const passes = isSafari() ? 3 : 1;
  let result = null;
  for (let i = 0; i < passes; i++) {
    result = await fn(node, options);
  }
  return result;
}

export function nodeToPng(node, options) {
  return captureReliably(toPng, node, options);
}

export function nodeToBlob(node, options) {
  return captureReliably(toBlob, node, options);
}

/**
 * Wait for a collection of <img> elements to be fully ready for snapshotting
 * via html-to-image (or html2canvas).
 *
 * iOS Safari quirk: `img.complete && img.naturalHeight > 0` returns true
 * before the image is actually decoded for paint. The bitmap is queued but
 * not yet available to the render pipeline, so html-to-image's SVG
 * foreignObject snapshot captures a blank slot where the QR code should be.
 * Calling `img.decode()` resolves only after the bitmap is decoded and ready
 * to paint, which fixes the iPhone Safari blank-QR-image case while being a
 * no-op cost on Chrome/Firefox where decode() resolves immediately.
 */
export async function waitForImagesReady(images, timeoutMs = 5000) {
  await Promise.all(
    Array.from(images).map((img) => waitForImageReady(img, timeoutMs)),
  );
}

async function waitForImageReady(img, timeoutMs) {
  if (!img.complete) {
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        img.removeEventListener("load", finish);
        img.removeEventListener("error", finish);
        resolve();
      };
      img.addEventListener("load", finish);
      img.addEventListener("error", finish);
      setTimeout(finish, timeoutMs);
    });
  }

  if (typeof img.decode === "function") {
    try {
      await img.decode();
    } catch (e) {
      // decode() can reject for broken images. We've already done our best
      // effort with the load wait above — fall through and let the snapshot
      // render whatever it can.
    }
  }
}

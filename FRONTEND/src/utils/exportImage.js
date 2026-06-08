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

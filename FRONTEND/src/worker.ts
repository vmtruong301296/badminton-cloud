/**
 * Cloudflare Worker entry: serves the React SPA and proxies /api/* to backend.
 *
 * Why proxy: iOS Safari ITP drops cross-origin session cookies. By proxying
 * /api/* through the same Worker that serves the frontend, the browser sees
 * everything coming from one origin (*.workers.dev or *.pages.dev), so the
 * session cookie is 1st-party and Safari accepts it.
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  BACKEND_URL?: string;
}

const DEFAULT_BACKEND = "https://badminton-api-m8mo.onrender.com";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const backend = env.BACKEND_URL || DEFAULT_BACKEND;
      const target = backend + url.pathname + url.search;

      const headers = new Headers(request.headers);
      headers.set("Host", new URL(backend).host);
      const clientIp = request.headers.get("cf-connecting-ip");
      if (clientIp) headers.set("X-Forwarded-For", clientIp);

      const init: RequestInit = {
        method: request.method,
        headers,
        redirect: "manual",
      };
      if (!["GET", "HEAD"].includes(request.method)) {
        init.body = await request.arrayBuffer();
      }

      return fetch(target, init);
    }

    return env.ASSETS.fetch(request);
  },
};

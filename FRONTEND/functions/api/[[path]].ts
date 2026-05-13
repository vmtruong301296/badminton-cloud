/**
 * Reverse proxy for /api/* → Render backend.
 *
 * Why: iOS Safari's ITP blocks 3rd-party cookies. Frontend on *.pages.dev
 * and backend on *.onrender.com are different eTLD+1, so session cookies
 * from Render are treated as 3rd-party and dropped.
 *
 * By proxying through Pages Functions, the browser sees every API call
 * coming from the same origin (*.pages.dev), so cookies become 1st-party
 * and Safari/iOS accepts them.
 */

interface Env {
  BACKEND_URL?: string;
}

const DEFAULT_BACKEND = "https://badminton-api-m8mo.onrender.com";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const backend = env.BACKEND_URL || DEFAULT_BACKEND;
  const url = new URL(request.url);
  const targetUrl = backend + url.pathname + url.search;

  const headers = new Headers(request.headers);
  // Rewrite Host so Laravel sees the backend's hostname.
  headers.set("Host", new URL(backend).host);
  // Pass the original client IP for logging on the backend side.
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

  return fetch(targetUrl, init);
};

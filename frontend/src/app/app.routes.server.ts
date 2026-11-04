import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // The back office is private and session-bound: rendered in the browser only.
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  // Everything public is server-rendered per request (fresh content, per-request CSP nonce).
  { path: '**', renderMode: RenderMode.Server },
];

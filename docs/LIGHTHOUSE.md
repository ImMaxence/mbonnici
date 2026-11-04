# Lighthouse audit — v1.1.0

*Run on 2026-11-04 against the production build (`node dist/mbonnici/server/server.mjs`, API on
localhost) with Lighthouse (latest) through Playwright's Chromium, default throttling
(mobile: simulated Moto G Power, 4× CPU slowdown, slow 4G; desktop preset). Three runs where the
trace recording failed were retried. Scores are out of 100.*

## Scores

| Page | Mode | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/fr` (home) | mobile | **86** | 100 | 100 | 100 | 1.4 s | 1.4 s | 525 ms | 0.005 |
| `/fr/projets` | mobile | **85** | 100 | 100 | 100 | 1.3 s | 1.3 s | 560 ms | 0.003 |
| `/fr/projets/localatscv` | mobile | **92** | 100 | 100 | 100 | 1.2 s | 1.2 s | 345 ms | 0.001 |
| `/fr/a-propos` | mobile | **90** | 100 | 100 | 100 | 1.2 s | 1.2 s | 405 ms | 0.001 |
| `/en/contact` | mobile | **92** | 100 | 100 | 100 | 1.1 s | 1.1 s | 330 ms | 0 |
| `/fr` (home) | desktop | **100** | 100 | 100 | 100 | 0.3 s | 0.3 s | 75 ms | 0.001 |
| `/fr/projets` | desktop | **100** | 100 | 100 | 100 | 0.3 s | 0.3 s | 61 ms | 0.001 |
| `/fr/projets/localatscv` | desktop | **100** | 100 | 100 | 100 | 0.3 s | 0.3 s | 28 ms | 0.002 |
| `/fr/a-propos` | desktop | **100** | 100 | 100 | 100 | 0.3 s | 0.3 s | 27 ms | 0.001 |
| `/en/contact` | desktop | **100** | 100 | 100 | 100 | 0.3 s | 0.3 s | 25 ms | 0.042 |

Initial JavaScript: 447 kB raw / 124 kB transferred. Fonts: two self-hosted variable woff2 files
(48 kB + 40 kB). No render-blocking third party, no external request at all.

## What the first run found, and what changed

The first audit (before optimisation) gave mobile performance 71 / 59 / 86 for home / project /
about, with a 5.4 s LCP on the project page and 0.77 CLS on desktop. Three root causes:

1. **Scroll reveals hid server-rendered text until hydration.** The `js` class that arms the
   reveal animations was set by an inline script before Angular loaded, so on a throttled phone
   the hero text stayed invisible for ~3 s. The class is now added by the root component after
   hydration; elements already in the viewport animate only when hydration was fast
   (< 1.8 s), otherwise they are shown as-is. LCP = FCP on every page now.
2. **Data resources flashed a loading state during hydration.** `httpResource` values are
   undefined on the first client render, so templates briefly switched to skeletons and Angular
   re-created the DOM (the footer jumped from 0 to 400 px: CLS 0.77). Public pages now receive
   their data through **route resolvers** (served from the HTTP transfer cache on the client),
   so the first client render is byte-identical to the server HTML.
3. **The hero orb competed with hydration.** Autoplay scenes now start after `requestIdleCallback`
   plus a short delay (0.9 s desktop, 2.2 s mobile), run at 30 fps on phones and use a
   pre-computed colour palette instead of building `rgba()` strings per particle per frame.

Remaining mobile cost is Angular's bootstrap + hydration on a 4×-throttled CPU (≈ 0.3–0.5 s of
total blocking time); it is inherent to a hydrated SPA of this size.

## Reproduce

```bash
cd frontend && npm run build
node dist/mbonnici/server/server.mjs &                 # API_BASE_URL=http://localhost:8081
npx lighthouse http://localhost:4000/fr --output=html --output-path=./lh-mobile.html
npx lighthouse http://localhost:4000/fr --preset=desktop --output=html --output-path=./lh-desktop.html
```

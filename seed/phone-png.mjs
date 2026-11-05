// Turns a capture of seed/shots into the PNG that is uploaded (uploads accept PNG / JPEG only).
// Phone captures get an iOS status bar in the page's own top colour, like iOS draws it.
// Shared by build-starter.mjs and refresh-phones.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const shotsDir = join(dirname(fileURLToPath(import.meta.url)), 'shots');

/** WebP capture → PNG (uploads accept PNG / JPEG only); phone captures get an iOS status bar. */
export async function toPng(browser, page, file, statusBar) {
  const b64 = readFileSync(join(shotsDir, file)).toString('base64');
  if (!statusBar) {
    return Buffer.from(
      await page.evaluate(async (b64) => {
        const bmp = await createImageBitmap(await (await fetch('data:image/webp;base64,' + b64)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        c.getContext('2d').drawImage(bmp, 0, 0);
        const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return btoa(s);
      }, b64),
      'base64',
    );
  }
  // like iOS, the status bar takes the page's own top colour, with ink that reads on it (a black bar
  // would swallow the Dynamic Island of the phone frame)
  const { bg, fg } = await page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/webp;base64,' + b64)).blob());
    const c = new OffscreenCanvas(24, 4);
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0, bmp.width, Math.max(2, bmp.height * 0.01), 0, 0, 24, 4);
    const d = ctx.getImageData(0, 0, 24, 4).data;
    let [r, g, b] = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) [r, g, b] = [r + d[i], g + d[i + 1], b + d[i + 2]];
    const n = d.length / 4;
    [r, g, b] = [r / n, g / n, b / n].map(Math.round);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return { bg: `rgb(${r},${g},${b})`, fg: lum > 0.6 ? '#000' : '#fff' };
  }, b64);
  // iPhone screen: 402 × 874 pt at 3x = 1206 × 2622 px, status bar 54 pt around the Dynamic Island
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><html><body style="margin:0;background:${bg};width:402px;height:874px;overflow:hidden;font-family:-apple-system,'SF Pro Text','Inter',system-ui,sans-serif">
    <div style="height:54px;display:flex;align-items:center;justify-content:space-between;padding:4px 30px 0 44px;color:${fg};box-sizing:border-box">
      <b style="font-size:17px;font-weight:600;letter-spacing:-.2px">9:41</b>
      <span style="display:flex;align-items:center;gap:6px">
        <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 12 0 3.8a11.5 11.5 0 0 1 16 0z" fill="currentColor"/></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".45"/><rect x="2" y="2" width="19" height="9" rx="2" fill="currentColor"/><rect x="24.6" y="4.3" width="1.6" height="4.4" rx=".8" fill="currentColor" fill-opacity=".45"/></svg>
      </span>
    </div>
    <img src="data:image/webp;base64,${b64}" style="display:block;width:402px">
  </body></html>`);
  await p.waitForTimeout(150);
  const png = await p.screenshot({ type: 'png' });
  await ctx.close();
  return png;
}

// Draws the phone frame used by the mock-ups (public/img/devices/phone.svg): an original vector
// drawing in the proportions of a current 6.3" phone (1390 × 2760 canvas, transparent 1206 × 2622
// screen at 92,69, i.e. 402 × 874 pt at 3x; the phone itself is drawn at 20,0 so the side buttons
// stand out of its band), aluminium band, black border, side buttons (action,
// volume and side buttons are added in 3D by the site) and a Dynamic Island at its real size: 126 × 37 pt, 11 pt
// below the top of the screen, with the front camera in its right end. Apple's own device artwork
// is not used: its licence does not allow it in website content.
//   node scripts/device-svg.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'img', 'devices', 'phone.svg');
mkdirSync(dirname(out), { recursive: true });

/** rounded rectangle path with a "squircle-ish" corner (cubic, k = 0.62 instead of 0.55) */
const rr = (x, y, w, h, r) => {
  const k = 0.38 * r; // control distance from the corner
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `C${x + w - k} ${y} ${x + w} ${y + k} ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `C${x + w} ${y + h - k} ${x + w - k} ${y + h} ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `C${x + k} ${y + h} ${x} ${y + h - k} ${x} ${y + h - r}`,
    `V${y + r}`,
    `C${x} ${y + k} ${x + k} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
};

const screen = rr(72, 69, 1206, 2622, 172);
const body = rr(14, 10, 1322, 2740, 236);
const band = rr(24, 20, 1302, 2720, 228);
const bezel = rr(36, 32, 1278, 2696, 214);


const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1390 2760" width="1390" height="2760">
  <defs>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#9a9aa0"/>
      <stop offset="0.012" stop-color="#4a4a4f"/>
      <stop offset="0.03" stop-color="#232326"/>
      <stop offset="0.5" stop-color="#2c2c30"/>
      <stop offset="0.97" stop-color="#232326"/>
      <stop offset="0.988" stop-color="#4a4a4f"/>
      <stop offset="1" stop-color="#9a9aa0"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="0.04" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.96" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0.12"/>
    </linearGradient>
    <radialGradient id="lens" cx="0.38" cy="0.36" r="0.7">
      <stop offset="0" stop-color="#3b4a72"/>
      <stop offset="0.35" stop-color="#121a2e"/>
      <stop offset="0.75" stop-color="#05070c"/>
      <stop offset="1" stop-color="#000"/>
    </radialGradient>
  </defs>
  <!-- side buttons: action, volume up / down, side button -->
  <g transform="translate(20 0)">
  <!-- the side buttons are not drawn here: the site builds them in 3D on the phone's edge
       (showcase.component.ts, .key), where they belong when the phone turns -->
  <!-- aluminium band, with the screen cut out -->
  <path fill-rule="evenodd" fill="url(#band)" d="${body} ${screen}"/>
  <path fill-rule="evenodd" fill="url(#sheen)" d="${body} ${screen}"/>
  <path fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="3" d="${band}"/>
  <path fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="2" d="${body}"/>
  <!-- black border around the glass -->
  <path fill-rule="evenodd" fill="#050506" d="${bezel} ${screen}"/>
  <path fill="none" stroke="#fff" stroke-opacity="0.05" stroke-width="2" d="${bezel}"/>
  <!-- Dynamic Island (378 × 111 px = 126 × 37 pt) with the front camera at its right end; the faint
       rim keeps it visible over dark status bars, like a real screen catching the light -->
  <rect x="486" y="102" width="378" height="111" rx="55.5" fill="#000"/>
  <rect x="486.75" y="102.75" width="376.5" height="109.5" rx="54.75" fill="none" stroke="#2a2a2e" stroke-width="1.5"/>
  <circle cx="808" cy="157.5" r="23" fill="url(#lens)"/>
  <circle cx="808" cy="157.5" r="23" fill="none" stroke="#1d2233" stroke-width="2"/>
  <circle cx="800" cy="150" r="5.5" fill="#8aa0d8" fill-opacity="0.35"/>
  </g>
</svg>
`;
writeFileSync(out, svg);
console.log('written', out, svg.length, 'bytes');

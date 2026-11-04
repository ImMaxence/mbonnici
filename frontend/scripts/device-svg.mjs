// Draws the phone frame used by the mock-ups (public/img/devices/phone.svg): an original vector
// drawing in the proportions of a current 6.3" phone (1350 × 2760 canvas, transparent 1206 × 2622
// screen at 72,69), aluminium band, black border, island with a lens, side buttons.
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

const button = (x, y, w, h, side) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="url(#btn-${side})"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1350 2760" width="1350" height="2760">
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
    <linearGradient id="btn-l" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5c5c61"/>
      <stop offset="0.5" stop-color="#2e2e32"/>
      <stop offset="1" stop-color="#1b1b1e"/>
    </linearGradient>
    <linearGradient id="btn-r" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="#5c5c61"/>
      <stop offset="0.5" stop-color="#2e2e32"/>
      <stop offset="1" stop-color="#1b1b1e"/>
    </linearGradient>
    <radialGradient id="lens" cx="0.38" cy="0.36" r="0.7">
      <stop offset="0" stop-color="#3b4a72"/>
      <stop offset="0.35" stop-color="#121a2e"/>
      <stop offset="0.75" stop-color="#05070c"/>
      <stop offset="1" stop-color="#000"/>
    </radialGradient>
  </defs>
  <!-- side buttons: action, volume up / down, side button -->
  ${button(4, 580, 22, 124, 'l')}
  ${button(4, 796, 22, 200, 'l')}
  ${button(4, 1054, 22, 200, 'l')}
  ${button(1324, 866, 22, 322, 'r')}
  <!-- aluminium band, with the screen cut out -->
  <path fill-rule="evenodd" fill="url(#band)" d="${body} ${screen}"/>
  <path fill-rule="evenodd" fill="url(#sheen)" d="${body} ${screen}"/>
  <path fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="3" d="${band}"/>
  <path fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="2" d="${body}"/>
  <!-- black border around the glass -->
  <path fill-rule="evenodd" fill="#050506" d="${bezel} ${screen}"/>
  <path fill="none" stroke="#fff" stroke-opacity="0.05" stroke-width="2" d="${bezel}"/>
  <!-- island and front camera -->
  <rect x="535" y="112" width="280" height="104" rx="52" fill="#000"/>
  <circle cx="761" cy="164" r="21" fill="url(#lens)"/>
  <circle cx="754" cy="157" r="5" fill="#8aa0d8" fill-opacity="0.35"/>
</svg>
`;
writeFileSync(out, svg);
console.log('written', out, svg.length, 'bytes');

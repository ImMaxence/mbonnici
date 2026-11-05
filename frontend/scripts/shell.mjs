// Prepares what the very first frame needs, before every build / serve (the global stylesheet loads
// asynchronously, so the first paint only has the inline <style> of index.html):
//
// 1. the dark palette. The server renders <html data-theme="light"> (the visitor's choice lives in
//    their browser; the inline script switches the attribute before the first paint), and the
//    critical CSS Angular inlines in each page only keeps rules that match the rendered page, so a
//    dark visitor saw the light page for half a second. The :root[data-theme='dark'] block of
//    src/styles/tokens.css (the only place to edit it) is copied into index.html.
// 2. the two fonts of the intro sheet (Inter Tight, JetBrains Mono; Latin only), copied to
//    public/fonts under fixed names so index.html can preload them: the intro is painted at once
//    and must not start in the system font then switch. The site's stylesheet points the same Latin
//    faces at these files, so they are downloaded once.
//   node scripts/shell.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 1. dark palette ──
const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
const start = tokens.indexOf(":root[data-theme='dark'] {");
if (start < 0) throw new Error("tokens.css: the :root[data-theme='dark'] block is missing");
const end = tokens.indexOf('\n}', start);
const block = tokens
  .slice(start, end + 2)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*\n\s*/g, '')
  .replace(/:\s+/g, ':')
  .replace(/;}/g, '}')
  .replace(":root[data-theme='dark']", 'html[data-theme=dark]');

const file = join(root, 'src/index.html');
const html = readFileSync(file, 'utf8');
const re = /\/\* theme:dark \*\/.*\/\* \/theme:dark \*\//;
if (!re.test(html)) throw new Error('index.html: the /* theme:dark */ … /* /theme:dark */ markers are missing');
const next = html.replace(re, `/* theme:dark */${block}/* /theme:dark */`);
if (next !== html) writeFileSync(file, next);
console.log(`index.html ← dark palette (${block.length} bytes)`);

// ── 2. intro fonts ──
const fonts = join(root, 'public/fonts');
mkdirSync(fonts, { recursive: true });
for (const [pkg, name] of [
  ['inter-tight', 'inter-tight-latin-wght-normal.woff2'],
  ['jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2'],
]) {
  copyFileSync(join(root, 'node_modules/@fontsource-variable', pkg, 'files', name), join(fonts, name));
}
console.log('public/fonts ← intro fonts');

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { stripDot } from './text';
import { Token, highlight, slugify } from './highlight';

type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; v: Inline[] }
  | { t: 'em'; v: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; v: Inline[] };

type Block =
  | { t: 'p'; v: Inline[] }
  | { t: 'h'; level: 2 | 3; v: Inline[]; id: string; text: string }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][] }
  | { t: 'pre'; lang: string; code: string; tokens: Token[] }
  | { t: 'quote'; v: Inline[] };

/**
 * Renders a small Markdown subset (paragraphs, headings, lists, quotes, fenced code, bold, italic,
 * inline code, links) through Angular templates — never innerHTML — so content from the back
 * office cannot inject markup.
 */
@Component({
  selector: 'app-md',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: { class: 'prose' },
  template: `
    <ng-template #inline let-items>
      @for (n of items; track $index) {
        @switch (n.t) {
          @case ('text') {
            <!-- in a container: a bare interpolation on its own line would get a space on each side -->
            <ng-container>{{ n.v }}</ng-container>
          }
          @case ('strong') {
            <strong><ng-container *ngTemplateOutlet="inline; context: { $implicit: n.v }" /></strong>
          }
          @case ('em') {
            <em><ng-container *ngTemplateOutlet="inline; context: { $implicit: n.v }" /></em>
          }
          @case ('code') {
            <code>{{ n.v }}</code>
          }
          @case ('link') {
            <a [href]="n.href" target="_blank" rel="noopener noreferrer"
              ><ng-container *ngTemplateOutlet="inline; context: { $implicit: n.v }"
            /></a>
          }
        }
      }
    </ng-template>

    @for (b of blocks(); track $index) {
      @switch (b.t) {
        @case ('p') {
          <p><ng-container *ngTemplateOutlet="inline; context: { $implicit: b.v }" /></p>
        }
        @case ('h') {
          @if (b.level === 2) {
            <h2 [id]="b.id"><ng-container *ngTemplateOutlet="inline; context: { $implicit: b.v }" /></h2>
          } @else {
            <h3 [id]="b.id"><ng-container *ngTemplateOutlet="inline; context: { $implicit: b.v }" /></h3>
          }
        }
        @case ('ul') {
          <ul>
            @for (item of b.items; track $index) {
              <li><ng-container *ngTemplateOutlet="inline; context: { $implicit: item }" /></li>
            }
          </ul>
        }
        @case ('ol') {
          <ol>
            @for (item of b.items; track $index) {
              <li><ng-container *ngTemplateOutlet="inline; context: { $implicit: item }" /></li>
            }
          </ol>
        }
        @case ('quote') {
          <blockquote><ng-container *ngTemplateOutlet="inline; context: { $implicit: b.v }" /></blockquote>
        }
        @case ('pre') {
          <!-- one line: whitespace inside <pre> is kept -->
          <pre class="code" [attr.data-lang]="b.lang || null"><code>@for (tk of b.tokens; track $index) {<span [class]="tk.c ? 'tk-' + tk.c : null">{{ tk.v }}</span>}</code></pre>
        }
      }
    }
  `,
})
export class MarkdownComponent {
  readonly text = input.required<string>();
  /** house style: paragraphs and list items do not end with a full stop (off for legal text) */
  readonly noDot = input(true);
  readonly blocks = computed(() => {
    const blocks = parseMarkdown(this.text());
    if (this.noDot()) {
      for (const b of blocks) {
        if (b.t === 'p') dropFinalDot(b.v);
        else if (b.t === 'ul' || b.t === 'ol') b.items.forEach(dropFinalDot);
      }
    }
    return blocks;
  });
}

function dropFinalDot(items: Inline[]): void {
  const last = items[items.length - 1];
  if (last?.t === 'text') last.v = stripDot(last.v);
}

/**
 * Line-based: a heading is a block of its own even without blank lines around it, list items may
 * wrap on indented continuation lines, a blank line ends a paragraph or a list.
 */
export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { t: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];
  const ids = new Set<string>();
  let fence: { lang: string; lines: string[] } | null = null;
  const flushQuote = (): void => {
    if (quote.length) blocks.push({ t: 'quote', v: parseInline(quote.join(' ')) });
    quote = [];
  };
  const flushPara = (): void => {
    if (para.length) blocks.push({ t: 'p', v: parseInline(para.join(' ')) });
    para = [];
  };
  const flushList = (): void => {
    if (list) blocks.push({ t: list.t, items: list.items.map(parseInline) });
    list = null;
  };
  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    // fenced code: kept verbatim until the closing fence
    const fenceMark = /^\s{0,3}```\s*([\w+#-]*)\s*$/.exec(line);
    if (fence) {
      if (fenceMark && !fenceMark[1]) {
        blocks.push({ t: 'pre', lang: fence.lang, code: fence.lines.join('\n'), tokens: highlight(fence.lines.join('\n'), fence.lang) });
        fence = null;
      } else {
        fence.lines.push(raw);
      }
      continue;
    }
    if (fenceMark) {
      flushPara();
      flushList();
      flushQuote();
      fence = { lang: fenceMark[1], lines: [] };
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      flushQuote();
      continue;
    }
    const q = /^\s{0,3}>\s?(.*)$/.exec(line);
    if (q) {
      flushPara();
      flushList();
      quote.push(q[1].trim());
      continue;
    }
    flushQuote();
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      const text = heading[2].replace(/[*_`]/g, '');
      let id = slugify(text);
      for (let n = 2; ids.has(id); n++) id = slugify(text) + '-' + n;
      ids.add(id);
      blocks.push({ t: 'h', level: heading[1].length <= 2 ? 2 : 3, v: parseInline(heading[2]), id, text });
      continue;
    }
    const item = /^\s*(?:([-*•])|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      const t = item[1] ? 'ul' : 'ol';
      flushPara();
      if (list && list.t !== t) flushList();
      list ??= { t, items: [] };
      list.items.push(item[2]);
      continue;
    }
    if (list && /^\s/.test(raw)) {
      // wrapped list item
      list.items[list.items.length - 1] += ' ' + line.trim();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  if (fence) blocks.push({ t: 'pre', lang: fence.lang, code: fence.lines.join('\n'), tokens: highlight(fence.lines.join('\n'), fence.lang) });
  flushPara();
  flushList();
  flushQuote();
  return blocks;
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ t: 'text', v: s.slice(last, index) });
    const token = m[0];
    if (m[1]) {
      out.push({ t: 'code', v: token.slice(1, -1) });
    } else if (m[2]) {
      out.push({ t: 'strong', v: parseInline(token.slice(2, -2)) });
    } else if (m[3]) {
      out.push({ t: 'em', v: parseInline(token.slice(1, -1)) });
    } else if (m[4]) {
      const text = token.slice(1, token.indexOf(']'));
      out.push({ t: 'link', href: m[5], v: parseInline(text) });
    }
    last = index + token.length;
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
  return out;
}

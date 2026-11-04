import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { stripDot } from './text';

type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; v: Inline[] }
  | { t: 'em'; v: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; v: Inline[] };

type Block =
  | { t: 'p'; v: Inline[] }
  | { t: 'h'; level: 2 | 3; v: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][] };

/**
 * Renders a small Markdown subset (paragraphs, headings, lists, bold, italic, code, links) through
 * Angular templates — never innerHTML — so content from the back office cannot inject markup.
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
            <h2><ng-container *ngTemplateOutlet="inline; context: { $implicit: b.v }" /></h2>
          } @else {
            <h3><ng-container *ngTemplateOutlet="inline; context: { $implicit: b.v }" /></h3>
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
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ t: 'h', level: heading[1].length <= 2 ? 2 : 3, v: parseInline(heading[2]) });
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
  flushPara();
  flushList();
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

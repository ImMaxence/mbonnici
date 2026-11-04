import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

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
            {{ n.v }}
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
  readonly blocks = computed(() => parseMarkdown(this.text()));
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  const chunks = src.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim().length);
    if (!lines.length) continue;
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      blocks.push({ t: 'ul', items: lines.map((l) => parseInline(l.replace(/^\s*[-*•]\s+/, ''))) });
      continue;
    }
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      blocks.push({ t: 'ol', items: lines.map((l) => parseInline(l.replace(/^\s*\d+[.)]\s+/, ''))) });
      continue;
    }
    const heading = /^(#{2,3})\s+(.*)$/.exec(lines[0]);
    if (heading && lines.length === 1) {
      blocks.push({ t: 'h', level: heading[1].length === 2 ? 2 : 3, v: parseInline(heading[2]) });
      continue;
    }
    blocks.push({ t: 'p', v: parseInline(lines.join(' ')) });
  }
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

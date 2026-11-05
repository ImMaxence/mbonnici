import { Component, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { isVideo } from '../../shared/ui/shots';
import { ApiService } from '../../core/api/api.service';
import type { MediaDto } from '../../core/api/models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

/** Modal grid of the media library with multi-select and inline upload. */
@Component({
  selector: 'app-media-picker',
  imports: [TranslatePipe, IconComponent, TooltipDirective],
  template: `
    <div class="overlay" (click)="closed.emit()"></div>
    <div class="dialog panel" role="dialog" [attr.aria-label]="'admin.media.title' | t">
      <div class="panel-head">
        <h2 class="h3">{{ 'admin.media.title' | t }}</h2>
        <div class="row">
          <label class="btn btn-ghost">
            <app-icon name="upload" [size]="16" /> {{ 'admin.media.select' | t }}
            <input type="file" [attr.accept]="imagesOnly() ? '.png,.jpg,.jpeg,image/png,image/jpeg' : '.png,.jpg,.jpeg,.mp4,.webm,.mov,image/png,image/jpeg,video/mp4,video/webm,video/quicktime'" multiple hidden (change)="upload($event)" />
          </label>
          <button type="button" class="btn btn-accent" (click)="confirm()" [disabled]="!selected().size">
            {{ 'admin.media.done' | t }} ({{ selected().size }})
          </button>
          <button type="button" class="icon-btn" (click)="closed.emit()" [appTip]="'common.close' | t"><app-icon name="close" [size]="16" /></button>
        </div>
      </div>
      @if (uploading()) {
        <p class="small muted">{{ 'admin.media.uploading' | t: { n: uploading() } }}</p>
      }
      <div class="media-grid scroll">
        @for (m of shown(); track m.id) {
          <button type="button" class="media-item" [class.is-selected]="selected().has(m.id)" (click)="toggle(m)">
            @if (isVideo(m)) {
              <video [src]="m.url + '#t=0.1'" muted preload="metadata" playsinline aria-hidden="true" class="thumb-video"></video>
              <span class="visually-hidden">{{ m.alt.fr || m.originalFilename || '' }}</span>
            } @else {
              <img [src]="m.url" [attr.srcset]="m.srcset || null" sizes="220px" [alt]="m.alt.fr || m.originalFilename || ''" loading="lazy" />
            }
          </button>
        }
      </div>
      @if (!shown().length) {
        <p class="muted">{{ 'admin.media.empty' | t }}</p>
      }
    </div>
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(6px);
    }
    .dialog {
      position: fixed;
      z-index: 201;
      inset: 5vh 5vw;
      overflow: auto;
      display: grid;
      align-content: start;
      gap: 0.5rem;
    }
    .thumb-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .scroll {
      max-height: 70vh;
      overflow: auto;
    }
  `,
})
export class MediaPickerComponent {
  readonly multiple = input(false);
  /** a cover or an avatar: pictures only (share images and the header need one) */
  readonly imagesOnly = input(false);
  /** the browser-frame loop: videos only */
  readonly videosOnly = input(false);
  readonly isVideo = isVideo;
  readonly shown = computed(() =>
    this.imagesOnly() ? this.items().filter((m) => !isVideo(m)) : this.videosOnly() ? this.items().filter((m) => isVideo(m)) : this.items(),
  );
  readonly picked = output<MediaDto[]>();
  readonly closed = output<void>();

  private readonly api = inject(ApiService);
  readonly items = signal<MediaDto[]>([]);
  readonly selected = signal(new Set<string>());
  readonly uploading = signal(0);

  constructor() {
    afterNextRender(() => this.load());
  }

  private async load(): Promise<void> {
    const page = await this.api.media(0, 100);
    this.items.set(page.items);
  }

  toggle(m: MediaDto): void {
    this.selected.update((s) => {
      const next = new Set(this.multiple() ? s : []);
      if (s.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
  }

  confirm(): void {
    const ids = this.selected();
    this.picked.emit(this.items().filter((m) => ids.has(m.id)));
  }

  async upload(event: Event): Promise<void> {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.uploading.set(files.length);
    for (const file of files) {
      try {
        const m = await this.api.uploadMedia(file);
        this.items.update((list) => [m, ...list]);
        this.selected.update((s) => new Set(this.multiple() ? [...s, m.id] : [m.id]));
      } finally {
        this.uploading.update((n) => n - 1);
      }
    }
  }
}

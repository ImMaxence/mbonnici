import {
  DOCUMENT,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { SceneType } from '../../core/api/models';
import { MotionService } from '../../core/motion/motion.service';
import { damp, hashString, hexToRgb } from '../../core/motion/physics';
import { PointerService } from '../../core/motion/pointer.service';
import { RafService } from '../../core/motion/raf.service';
import { ThemeService } from '../../core/theme/theme.service';
import { HelixScene } from './helix.scene';
import { HeroScene } from './hero.scene';
import { OrbitScene } from './orbit.scene';
import { BaseScene, Rgb, SceneOptions, ScenePointer } from './scene';
import { TerrainScene } from './terrain.scene';

export type HostedSceneType = Exclude<SceneType, 'STACK' | 'DEVICE'> | 'HERO';

/**
 * Mounts a canvas scene, keeps it sized to the host (device-pixel aware), feeds it the pointer,
 * runs it only while visible and animated (hover / autoplay), and re-colours it when the theme changes.
 * Reduced-motion users get a single static frame.
 */
@Component({
  selector: 'app-scene',
  template: `<canvas #canvas></canvas>`,
  host: {
    role: 'img',
    '[attr.aria-label]': 'ariaLabel()',
    '[class.is-running]': 'running()',
  },
  styles: `
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      contain: layout paint;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class SceneHostComponent {
  readonly type = input<HostedSceneType>('ORBIT');
  /** empty = the current style's --accent */
  readonly accent = input('');
  readonly labels = input<string[]>([]);
  readonly seed = input('');
  /** animate while hovered / focused (cards) */
  readonly active = input(false);
  /** animate whenever visible (hero, project page) */
  readonly autoplay = input(false);
  readonly ariaLabel = input('');

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly raf = inject(RafService);
  private readonly pointer = inject(PointerService);
  private readonly motion = inject(MotionService);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  readonly running = signal(false);
  private readonly visible = signal(false);
  private readonly ready = signal(false);

  private scene: BaseScene | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stop: (() => void) | null = null;
  private width = 0;
  private height = 0;
  private start = 0;
  private intensity = 0;
  private rect: DOMRect | null = null;
  private readonly scenePointer: ScenePointer = { x: 0, y: 0, nx: 0, ny: 0, active: false };

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      this.ctx = canvas.getContext('2d', { alpha: true });
      if (!this.ctx) return;

      const ro = new ResizeObserver((entries) => {
        const box = entries[0]?.contentRect;
        if (!box) return;
        this.resize(box.width, box.height);
      });
      ro.observe(this.host.nativeElement);

      const io = new IntersectionObserver((entries) => this.visible.set(entries.some((e) => e.isIntersecting)), {
        rootMargin: '10% 0px',
      });
      io.observe(this.host.nativeElement);

      this.ready.set(true);
      destroyRef.onDestroy(() => {
        ro.disconnect();
        io.disconnect();
        this.stop?.();
        this.scene?.destroy();
      });
    });

    // (re)build the scene when type / colours / theme change
    effect(() => {
      if (!this.ready()) return;
      this.type();
      this.accent();
      this.labels();
      this.theme.style();
      this.theme.isDark();
      untracked(() => this.build());
    });

    // start / stop the loop (autoplay waits for the page to settle: cheaper load, stable LCP)
    effect(() => {
      if (!this.ready()) return;
      const shouldRun = this.visible() && (this.active() || (this.autoplay() && this.settled())) && !this.motion.reduced();
      untracked(() => (shouldRun ? this.run() : this.pause()));
    });

    afterNextRender(() => {
      const delay = this.motion.mobile() ? 2200 : 900;
      const arm = (): void => {
        setTimeout(() => this.settled.set(true), delay);
      };
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback(arm, { timeout: 2500 });
      } else {
        arm();
      }
    });
  }

  /** true once the page had a moment to breathe after hydration */
  private readonly settled = signal(false);
  private frameParity = 0;

  private build(): void {
    if (!this.ctx || !this.width) return;
    this.scene?.destroy();
    this.scene = this.create();
    this.scene.init(this.ctx, this.width, this.height, this.options());
    this.start = 0;
    this.drawStatic();
  }

  private create(): BaseScene {
    switch (this.type()) {
      case 'HERO':
        return new HeroScene();
      case 'TERRAIN':
        return new TerrainScene();
      case 'HELIX':
        return new HelixScene();
      default:
        return new OrbitScene();
    }
  }

  private options(): SceneOptions {
    const css = getComputedStyle(this.document.documentElement);
    const read = (name: string, fallback: string): Rgb => hexToRgb(css.getPropertyValue(name).trim() || fallback);
    return {
      colors: {
        accent: hexToRgb(this.accent() || css.getPropertyValue('--accent').trim() || '#5b9dff'),
        accent2: read('--accent-2', '#b48bff'),
        fg: read('--fg', '#f5f5f7'),
        bg: read('--bg', '#0a0a0c'),
        dark: this.theme.isDark(),
      },
      quality: this.motion.quality() || 0.5,
      seed: hashString(this.seed() || this.type()),
      labels: this.labels(),
      font: css.getPropertyValue('--font-mono').trim() || 'monospace',
    };
  }

  private resize(w: number, h: number): void {
    const canvas = this.canvasRef().nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, this.motion.mobile() ? 1.5 : 2);
    this.width = Math.max(1, Math.round(w));
    this.height = Math.max(1, Math.round(h));
    canvas.width = Math.round(this.width * dpr);
    canvas.height = Math.round(this.height * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.rect = null;
    if (!this.scene) {
      this.build();
    } else {
      this.scene.resize(this.width, this.height);
      if (!this.running()) this.drawStatic();
    }
  }

  /** One frame with a frozen clock: what reduced-motion users and idle cards see. */
  private drawStatic(): void {
    if (!this.scene) return;
    this.scenePointer.active = false;
    this.scene.frame(1 / 60, 0.6, this.scenePointer, 0);
  }

  private run(): void {
    if (this.stop || !this.scene) return;
    this.running.set(true);
    const halfRate = this.motion.quality() < 0.7; // phones and tablets: 30 fps is plenty
    let carried = 0;
    this.stop = this.raf.add((dt, time) => {
      if (!this.scene) return;
      if (!this.start) this.start = time;
      if (halfRate) {
        carried += dt;
        if ((this.frameParity ^= 1) === 1) return;
        dt = carried;
        carried = 0;
      }
      this.updatePointer();
      this.intensity = damp(this.intensity, this.active() || this.autoplay() ? 1 : 0, 4, dt);
      this.scene.frame(dt, time - this.start, this.scenePointer, this.intensity);
    });
  }

  private pause(): void {
    if (!this.stop) return;
    this.stop();
    this.stop = null;
    this.running.set(false);
    // ease out: leave a final calm frame
    this.intensity = 0;
    this.drawStatic();
  }

  private updatePointer(): void {
    if (!this.rect) this.rect = this.host.nativeElement.getBoundingClientRect();
    const r = this.rect;
    const x = this.pointer.sx - r.left;
    const y = this.pointer.sy - r.top;
    const inside = this.pointer.active && x > -80 && y > -80 && x < r.width + 80 && y < r.height + 80;
    this.scenePointer.active = inside || (this.autoplay() && this.pointer.active);
    this.scenePointer.x = x;
    this.scenePointer.y = y;
    this.scenePointer.nx = Math.max(-1, Math.min(1, (x / r.width) * 2 - 1));
    this.scenePointer.ny = Math.max(-1, Math.min(1, (y / r.height) * 2 - 1));
    // the rect moves with scroll: refresh it cheaply every frame when running
    this.rect = null;
  }
}

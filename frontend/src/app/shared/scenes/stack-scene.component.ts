import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, viewChild } from '@angular/core';
import type { MediaDto } from '../../core/api/models';
import { MotionService } from '../../core/motion/motion.service';
import { Spring2 } from '../../core/motion/physics';
import { RafService } from '../../core/motion/raf.service';
import { ImgComponent } from '../ui/img.component';

/**
 * CSS-3D "product shot": layered glass panels at different depths that tilt towards the pointer
 * with spring physics, a moving glare and the stack floating as chips in front.
 */
@Component({
  selector: 'app-stack-scene',
  imports: [ImgComponent],
  template: `
    <div class="stage" #stage [style.--accent]="accent()" (pointerenter)="enter()" (pointerleave)="leave()">
      <div class="world" #world>
        <div class="layer back">
          <div class="grid"></div>
        </div>
        <div class="layer mid">
          @if (image(); as img) {
            <app-img class="shot" [media]="img" sizes="(max-width: 720px) 90vw, 40vw" />
          } @else {
            <div class="mock" aria-hidden="true">
              <div class="bar"><i></i><i></i><i></i></div>
              <div class="lines">
                <b style="width: 62%"></b>
                <b style="width: 44%"></b>
                <b style="width: 78%"></b>
                <b style="width: 30%"></b>
              </div>
              <div class="blocks"><span></span><span></span><span></span></div>
            </div>
          }
        </div>
        <div class="layer front">
          @for (chip of labels().slice(0, 4); track chip; let i = $index) {
            <span class="chip" [style.--i]="i">{{ chip }}</span>
          }
        </div>
        <div class="glare" #glare></div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .stage {
      position: relative;
      width: 100%;
      height: 100%;
      perspective: 1200px;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .world {
      position: relative;
      width: min(78%, 520px);
      aspect-ratio: 16 / 10;
      transform-style: preserve-3d;
      will-change: transform;
    }
    .layer {
      position: absolute;
      inset: 0;
      border-radius: var(--radius-m);
      transform-style: preserve-3d;
    }
    .back {
      transform: translateZ(-90px) scale(1.12);
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 55%, transparent), color-mix(in srgb, var(--accent-2) 35%, transparent));
      opacity: 0.55;
      filter: blur(0.5px);
    }
    .back .grid {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background-image:
        linear-gradient(color-mix(in srgb, var(--fg) 14%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--fg) 14%, transparent) 1px, transparent 1px);
      background-size: 28px 28px;
      mask-image: radial-gradient(circle at 50% 50%, #000 30%, transparent 80%);
    }
    .mid {
      overflow: hidden;
      background: var(--glass-strong);
      border: 1px solid var(--glass-border);
      box-shadow:
        inset 0 1px 0 var(--glass-highlight),
        var(--shadow-3);
      transform: translateZ(0);
    }
    .shot {
      width: 100%;
      height: 100%;
    }
    .mock {
      position: absolute;
      inset: 0;
      padding: 7% 7%;
      display: grid;
      gap: 6%;
      grid-template-rows: auto 1fr auto;
    }
    .mock .bar {
      display: flex;
      gap: 6px;
    }
    .mock .bar i {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--fg) 20%, transparent);
    }
    .mock .bar i:first-child {
      background: var(--accent);
    }
    .mock .lines {
      display: grid;
      gap: 9%;
      align-content: start;
    }
    .mock .lines b {
      display: block;
      height: 7%;
      min-height: 6px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--fg) 14%, transparent);
    }
    .mock .lines b:first-child {
      background: color-mix(in srgb, var(--fg) 40%, transparent);
      height: 12%;
    }
    .mock .blocks {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4%;
      height: 26%;
    }
    .mock .blocks span {
      border-radius: 8px;
      background: color-mix(in srgb, var(--accent) 22%, transparent);
    }
    .front {
      pointer-events: none;
      transform: translateZ(70px);
    }
    .chip {
      position: absolute;
      padding: 0.45em 0.8em;
      border-radius: 999px;
      background: var(--fg);
      color: var(--bg);
      font: 600 11px/1 var(--font-mono);
      letter-spacing: 0.06em;
      box-shadow: var(--shadow-2);
      animation: float 5s ease-in-out infinite;
      animation-delay: calc(var(--i) * -1.2s);
    }
    .chip:nth-child(1) { left: -6%; top: 12%; }
    .chip:nth-child(2) { right: -8%; top: 30%; transform: translateZ(30px); }
    .chip:nth-child(3) { left: 8%; bottom: 4%; }
    .chip:nth-child(4) { right: 4%; bottom: -6%; transform: translateZ(50px); }
    .glare {
      position: absolute;
      inset: 0;
      border-radius: var(--radius-m);
      background: radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgba(255, 255, 255, 0.22), transparent 55%);
      mix-blend-mode: screen;
      transform: translateZ(1px);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.4s;
    }
    .stage:hover .glare {
      opacity: 1;
    }
  `,
})
export class StackSceneComponent {
  readonly accent = input('#5b9dff');
  readonly labels = input<string[]>([]);
  readonly image = input<MediaDto | null>(null);
  readonly autoplay = input(false);

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly world = viewChild.required<ElementRef<HTMLElement>>('world');
  private readonly glare = viewChild.required<ElementRef<HTMLElement>>('glare');
  private readonly raf = inject(RafService);
  private readonly motion = inject(MotionService);
  private readonly spring = new Spring2(120, 16);
  private stop: (() => void) | null = null;
  private hovering = false;
  private idleTime = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const stage = this.stage().nativeElement;
      const onMove = (e: PointerEvent): void => {
        const r = stage.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        this.spring.setTarget(-ny * 10, nx * 12);
        this.glare().nativeElement.style.setProperty('--gx', `${((nx + 1) / 2) * 100}%`);
        this.glare().nativeElement.style.setProperty('--gy', `${((ny + 1) / 2) * 100}%`);
      };
      stage.addEventListener('pointermove', onMove, { passive: true });
      if (this.autoplay() && !this.motion.reduced()) this.ensureLoop();
      destroyRef.onDestroy(() => {
        stage.removeEventListener('pointermove', onMove);
        this.stop?.();
      });
    });
  }

  enter(): void {
    if (this.motion.reduced()) return;
    this.hovering = true;
    this.ensureLoop();
  }

  leave(): void {
    this.hovering = false;
    this.spring.setTarget(0, 0);
    this.ensureLoop();
  }

  private ensureLoop(): void {
    if (this.stop) return;
    const world = this.world().nativeElement;
    this.stop = this.raf.add((dt, t) => {
      this.idleTime = t;
      if (!this.hovering && this.autoplay()) {
        this.spring.setTarget(Math.sin(t * 0.6) * 3, Math.cos(t * 0.45) * 4);
      }
      this.spring.update(dt);
      world.style.transform = `rotateX(${this.spring.x.value.toFixed(2)}deg) rotateY(${this.spring.y.value.toFixed(2)}deg)`;
      if (!this.hovering && !this.autoplay() && this.spring.settled()) {
        world.style.transform = '';
        this.stop?.();
        this.stop = null;
      }
    });
  }
}

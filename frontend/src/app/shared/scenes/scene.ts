/** Shared contract for the canvas scenes (hero orb, orbit, terrain, helix). */

export type Rgb = [number, number, number];

export interface SceneColors {
  accent: Rgb;
  accent2: Rgb;
  fg: Rgb;
  bg: Rgb;
  dark: boolean;
}

export interface SceneOptions {
  colors: SceneColors;
  /** 0 … 1 effects budget (particle counts scale with it) */
  quality: number;
  seed: number;
  labels: string[];
  font: string;
}

export interface ScenePointer {
  /** position in canvas CSS pixels */
  x: number;
  y: number;
  /** -1 … 1 relative to the canvas centre */
  nx: number;
  ny: number;
  active: boolean;
}

export abstract class BaseScene {
  protected ctx!: CanvasRenderingContext2D;
  protected w = 0;
  protected h = 0;
  protected opts!: SceneOptions;

  init(ctx: CanvasRenderingContext2D, w: number, h: number, opts: SceneOptions): void {
    this.ctx = ctx;
    this.opts = opts;
    this.w = w;
    this.h = h;
    this.setup();
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.onResize();
  }

  protected onResize(): void {}

  protected abstract setup(): void;

  /**
   * @param dt seconds since last frame
   * @param t seconds since the scene started
   * @param intensity 0 (idle, static) … 1 (hovered / in focus)
   */
  abstract frame(dt: number, t: number, pointer: ScenePointer, intensity: number): void;

  destroy(): void {}
}

export const TAU = Math.PI * 2;

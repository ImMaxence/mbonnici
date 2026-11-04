import { clamp, damp, fibonacciSphere, mix, mulberry32, rgba, rotateXY } from '../../core/motion/physics';
import { BaseScene, ScenePointer, TAU } from './scene';

/**
 * A small planet of particles with three tilted rings; satellites travel along the rings and
 * carry the project's stack as floating labels. Camera tilts with the pointer.
 */
export class OrbitScene extends BaseScene {
  private n = 0;
  private base!: Float32Array;
  private rot!: Float32Array;
  private rings: { tiltX: number; tiltY: number; radius: number; speed: number; phase: number }[] = [];
  private spin = 0;
  private tiltX = 0;
  private tiltY = 0;
  private readonly tmp = new Float32Array(3);
  private readonly src = new Float32Array(3);

  protected setup(): void {
    const rnd = mulberry32(this.opts.seed);
    this.n = Math.round(460 * clamp(this.opts.quality, 0.25, 1));
    this.base = fibonacciSphere(this.n, 1);
    this.rot = new Float32Array(this.n * 3);
    this.rings = [0, 1, 2].map((k) => ({
      tiltX: 0.5 + rnd() * 1.2,
      tiltY: rnd() * TAU,
      radius: 1.45 + k * 0.32 + rnd() * 0.1,
      speed: (0.25 + rnd() * 0.3) * (k % 2 ? -1 : 1),
      phase: rnd() * TAU,
    }));
  }

  frame(dt: number, t: number, p: ScenePointer, intensity: number): void {
    const { ctx, w, h } = this;
    const { accent, accent2, fg, bg } = this.opts.colors;
    const R = Math.min(w, h) * 0.2;
    const cx = w / 2;
    const cy = h / 2;
    const cameraZ = 3.4;
    const fov = R * cameraZ;

    this.tiltX = damp(this.tiltX, p.active ? p.ny * 0.5 : 0.25, 3, dt);
    this.tiltY = damp(this.tiltY, p.active ? p.nx * 0.7 : 0, 3, dt);
    this.spin += dt * (0.18 + 0.25 * intensity);
    const ax = this.tiltX;
    const ay = this.spin + this.tiltY;

    ctx.clearRect(0, 0, w, h);

    // planet glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
    glow.addColorStop(0, rgba(accent, 0.22));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // planet particles
    for (let i = 0; i < this.n; i++) {
      rotateXY(this.base, i * 3, ax * 0.4, ay, this.rot, i * 3);
      const z = this.rot[i * 3 + 2];
      const scale = fov / (cameraZ - z);
      const depth = (z + 1) / 2;
      const size = 0.7 + depth * 1.6;
      ctx.fillStyle = rgba(mix(fg, accent, depth), 0.15 + depth * 0.75);
      ctx.fillRect(cx + this.rot[i * 3] * scale, cy + this.rot[i * 3 + 1] * scale, size, size);
    }

    // rings, satellites and labels
    const labels = this.opts.labels.slice(0, 3);
    ctx.lineWidth = 1;
    ctx.font = `500 11px ${this.opts.font}`;
    ctx.textBaseline = 'middle';
    this.rings.forEach((ring, k) => {
      const steps = 72;
      let first = true;
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const a = (s / steps) * TAU;
        const pt = this.ringPoint(ring, a, ax, ay);
        const scale = fov / (cameraZ - pt[2]);
        const sx = cx + pt[0] * scale;
        const sy = cy + pt[1] * scale;
        if (first) {
          ctx.moveTo(sx, sy);
          first = false;
        } else {
          ctx.lineTo(sx, sy);
        }
      }
      ctx.strokeStyle = rgba(k === 0 ? accent : fg, 0.14 + 0.08 * intensity);
      ctx.stroke();

      // satellite
      const a = ring.phase + t * ring.speed;
      const pt = this.ringPoint(ring, a, ax, ay);
      const scale = fov / (cameraZ - pt[2]);
      const sx = cx + pt[0] * scale;
      const sy = cy + pt[1] * scale;
      const depth = (pt[2] / ring.radius + 1) / 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5 + depth * 3, 0, TAU);
      ctx.fillStyle = rgba(k === 1 ? accent2 : accent, 0.5 + depth * 0.5);
      ctx.fill();

      const label = labels[k];
      if (label) {
        const tw = ctx.measureText(label).width;
        const pw = tw + 16;
        const ph = 20;
        const lx = sx + 10;
        const ly = sy - 10;
        ctx.fillStyle = rgba(bg, 0.55 + depth * 0.35);
        ctx.strokeStyle = rgba(fg, 0.12 + depth * 0.2);
        ctx.beginPath();
        ctx.roundRect(lx, ly - ph / 2, pw, ph, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = rgba(fg, 0.45 + depth * 0.55);
        ctx.fillText(label, lx + 8, ly + 0.5);
      }
    });
  }

  private ringPoint(
    ring: { tiltX: number; tiltY: number; radius: number },
    a: number,
    ax: number,
    ay: number,
  ): Float32Array {
    this.src[0] = Math.cos(a) * ring.radius;
    this.src[1] = 0;
    this.src[2] = Math.sin(a) * ring.radius;
    rotateXY(this.src, 0, ring.tiltX, ring.tiltY, this.tmp, 0);
    rotateXY(this.tmp, 0, ax, ay, this.src, 0);
    return this.src;
  }
}

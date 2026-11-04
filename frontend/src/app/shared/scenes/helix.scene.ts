import { clamp, damp, mix, rgba, rotateXY } from '../../core/motion/physics';
import { BaseScene, ScenePointer, TAU } from './scene';

/** Two particle strands twisted around each other with glowing rungs; the pointer tilts and spins it. */
export class HelixScene extends BaseScene {
  private k = 0;
  private readonly src = new Float32Array(3);
  private readonly a = new Float32Array(3);
  private readonly b = new Float32Array(3);
  private spin = 0;
  private tiltX = 0;
  private tiltY = 0;

  protected setup(): void {
    this.k = Math.round(110 * clamp(this.opts.quality, 0.25, 1)) + 40;
  }

  frame(dt: number, t: number, p: ScenePointer, intensity: number): void {
    const { ctx, w, h } = this;
    const { accent, accent2, fg } = this.opts.colors;
    const cx = w / 2;
    const cy = h / 2;
    const cameraZ = 3.1;
    const fov = Math.min(w, h) * 0.95;
    const height = 2.3;
    const radius = 0.5 + 0.08 * intensity;

    this.tiltX = damp(this.tiltX, 0.32 + (p.active ? p.ny * 0.35 : 0), 3, dt);
    this.tiltY = damp(this.tiltY, p.active ? p.nx * 0.6 : 0, 3, dt);
    this.spin += dt * (0.5 + 0.7 * intensity);

    ctx.clearRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.6);
    glow.addColorStop(0, rgba(accent, 0.14));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1;
    for (let i = 0; i < this.k; i++) {
      const f = i / (this.k - 1);
      const angle = f * TAU * 3.3 + this.spin;
      const y = (f - 0.5) * height;

      this.src[0] = Math.cos(angle) * radius;
      this.src[1] = y;
      this.src[2] = Math.sin(angle) * radius;
      rotateXY(this.src, 0, this.tiltX, this.tiltY, this.a, 0);
      this.src[0] = Math.cos(angle + Math.PI) * radius;
      this.src[2] = Math.sin(angle + Math.PI) * radius;
      rotateXY(this.src, 0, this.tiltX, this.tiltY, this.b, 0);

      const sa = fov / (cameraZ - this.a[2]);
      const sb = fov / (cameraZ - this.b[2]);
      const ax = cx + this.a[0] * sa;
      const ay = cy + this.a[1] * sa;
      const bx = cx + this.b[0] * sb;
      const by = cy + this.b[1] * sb;
      const da = (this.a[2] / radius + 1) / 2;
      const db = (this.b[2] / radius + 1) / 2;

      if (i % 4 === 0) {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = rgba(fg, 0.05 + ((da + db) / 2) * 0.3);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(ax, ay, 1.2 + da * 2.6, 0, TAU);
      ctx.fillStyle = rgba(mix(fg, accent, 0.4 + da * 0.6), 0.2 + da * 0.8);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, 1.2 + db * 2.6, 0, TAU);
      ctx.fillStyle = rgba(mix(fg, accent2, 0.4 + db * 0.6), 0.2 + db * 0.8);
      ctx.fill();
    }
  }
}

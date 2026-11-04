import { clamp, damp, fibonacciSphere, mix, rgba, rotateXY } from '../../core/motion/physics';
import { BaseScene, ScenePointer, TAU } from './scene';

/**
 * Home hero: a breathing sphere of ~1500 particles with three tilted orbit rings.
 * The pointer tilts the camera and pushes particles away in screen space; each particle
 * carries its own velocity and springs back, so the swirl feels physical rather than scripted.
 */
export class HeroScene extends BaseScene {
  private n = 0;
  private base!: Float32Array;
  private rot!: Float32Array;
  private ox!: Float32Array;
  private oy!: Float32Array;
  private vx!: Float32Array;
  private vy!: Float32Array;
  private spin = 0;
  private tiltX = 0;
  private tiltY = 0;
  /** depth-bucketed fill styles: no string allocation per particle per frame */
  private palette: string[] = [];
  private static readonly BUCKETS = 24;

  protected setup(): void {
    this.n = Math.round(1500 * clamp(this.opts.quality, 0.25, 1));
    this.base = fibonacciSphere(this.n, 1);
    this.rot = new Float32Array(this.n * 3);
    this.ox = new Float32Array(this.n);
    this.oy = new Float32Array(this.n);
    this.vx = new Float32Array(this.n);
    this.vy = new Float32Array(this.n);
    const { accent, accent2, fg } = this.opts.colors;
    this.palette = [];
    for (let b = 0; b < HeroScene.BUCKETS; b++) {
      const depth = b / (HeroScene.BUCKETS - 1);
      this.palette.push(rgba(mix(fg, depth > 0.6 ? accent : accent2, depth * 0.85), 0.12 + depth * 0.88));
    }
  }

  frame(dt: number, t: number, p: ScenePointer, intensity: number): void {
    const { ctx, w, h } = this;
    const { accent, accent2, fg } = this.opts.colors;
    const R = Math.min(w, h) * 0.36 * (0.85 + 0.15 * intensity);
    const cx = w / 2;
    const cy = h / 2;
    const cameraZ = 3.2;
    const fov = R * cameraZ;

    this.tiltX = damp(this.tiltX, p.active ? p.ny * 0.45 : 0, 2.5, dt);
    this.tiltY = damp(this.tiltY, p.active ? p.nx * 0.6 : 0, 2.5, dt);
    this.spin += dt * (0.12 + 0.1 * intensity);
    const ax = this.tiltX + Math.sin(t * 0.25) * 0.1;
    const ay = this.spin + this.tiltY;
    const breathe = 1 + 0.03 * Math.sin(t * 0.8);

    ctx.clearRect(0, 0, w, h);

    // soft glow behind the orb
    const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.7);
    glow.addColorStop(0, rgba(accent, 0.12 + 0.1 * intensity));
    glow.addColorStop(0.55, rgba(accent2, 0.05));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // orbit rings
    ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(k * 1.05 + t * 0.04 * (k + 1) + this.tiltY * 0.5);
      ctx.scale(1, 0.28 + k * 0.14 + this.tiltX * 0.15);
      ctx.beginPath();
      ctx.arc(0, 0, R * (1.22 + k * 0.17), 0, TAU);
      ctx.strokeStyle = rgba(k === 1 ? accent : fg, 0.1 + 0.06 * intensity);
      ctx.stroke();
      ctx.restore();
    }

    // particles
    const repelRadius = 150;
    const repelForce = 1400 * dt;
    for (let i = 0; i < this.n; i++) {
      rotateXY(this.base, i * 3, ax, ay, this.rot, i * 3);
      const x = this.rot[i * 3] * breathe;
      const y = this.rot[i * 3 + 1] * breathe;
      const z = this.rot[i * 3 + 2] * breathe;
      const scale = fov / (cameraZ - z);
      const sx = cx + x * scale;
      const sy = cy + y * scale;
      const depth = (z + 1) / 2; // 0 far, 1 near

      if (p.active) {
        const dx = sx - p.x;
        const dy = sy - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < repelRadius * repelRadius) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / repelRadius) * repelForce;
          this.vx[i] += (dx / d) * f;
          this.vy[i] += (dy / d) * f;
        }
      }
      // spring back to the orbit position
      this.vx[i] += -this.ox[i] * 40 * dt;
      this.vy[i] += -this.oy[i] * 40 * dt;
      const decay = Math.exp(-4.5 * dt);
      this.vx[i] *= decay;
      this.vy[i] *= decay;
      this.ox[i] += this.vx[i] * dt;
      this.oy[i] += this.vy[i] * dt;

      const size = (0.8 + depth * 2.4) * (0.85 + 0.15 * intensity);
      ctx.fillStyle = this.palette[(depth * (HeroScene.BUCKETS - 1)) | 0];
      const px = sx + this.ox[i];
      const py = sy + this.oy[i];
      if (size < 1.8) {
        ctx.fillRect(px, py, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(px, py, size, 0, TAU);
        ctx.fill();
      }
    }
  }
}

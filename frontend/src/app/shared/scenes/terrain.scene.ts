import { clamp, damp, mix, noise2, rgba, rotateXY } from '../../core/motion/physics';
import { BaseScene, ScenePointer } from './scene';

/**
 * Wireframe terrain: a grid of vertices whose height is layered noise plus a wake that follows
 * the pointer. Rows fade with depth so the horizon dissolves into the background.
 */
export class TerrainScene extends BaseScene {
  private cols = 0;
  private rows = 0;
  private verts!: Float32Array;
  private out!: Float32Array;
  private readonly src = new Float32Array(3);
  private readonly tmp = new Float32Array(3);
  private wakeX = 0;
  private wakeZ = 0;
  private wake = 0;
  private tiltX = 0;
  private tiltY = 0;

  protected setup(): void {
    const q = clamp(this.opts.quality, 0.25, 1);
    this.cols = Math.round(36 * q) + 14;
    this.rows = Math.round(18 * q) + 10;
    this.verts = new Float32Array(this.cols * this.rows * 3);
    this.out = new Float32Array(this.cols * this.rows * 3);
  }

  frame(dt: number, t: number, p: ScenePointer, intensity: number): void {
    const { ctx, w, h } = this;
    const { accent, accent2, fg } = this.opts.colors;
    const cx = w / 2;
    const cy = h * 0.42;
    const cameraZ = 2.9;
    const fov = Math.min(w, h) * 1.35;
    const width = 2.6;
    const depth = 2.2;

    this.tiltX = damp(this.tiltX, -0.82 + (p.active ? p.ny * 0.12 : 0), 3, dt);
    this.tiltY = damp(this.tiltY, p.active ? p.nx * 0.22 : 0, 3, dt);
    this.wake = damp(this.wake, p.active ? 1 : 0, 4, dt);
    this.wakeX = damp(this.wakeX, p.nx * 1.1, 6, dt);
    this.wakeZ = damp(this.wakeZ, -p.ny * 0.9, 6, dt);

    const amp = 0.24 + 0.12 * intensity;
    const speed = t * (0.6 + 0.5 * intensity);

    // compute vertices (model → camera)
    for (let r = 0; r < this.rows; r++) {
      const z = (r / (this.rows - 1) - 0.5) * depth;
      for (let c = 0; c < this.cols; c++) {
        const x = (c / (this.cols - 1) - 0.5) * width;
        let y = noise2(x * 1.7, z * 1.9, speed) * amp;
        const dx = x - this.wakeX;
        const dz = z - this.wakeZ;
        y += Math.exp(-(dx * dx + dz * dz) / 0.14) * 0.38 * this.wake;
        this.src[0] = x;
        this.src[1] = -y;
        this.src[2] = z;
        rotateXY(this.src, 0, this.tiltX, this.tiltY, this.tmp, 0);
        const i = (r * this.cols + c) * 3;
        const scale = fov / (cameraZ - this.tmp[2]);
        this.out[i] = cx + this.tmp[0] * scale;
        this.out[i + 1] = cy + this.tmp[1] * scale;
        this.out[i + 2] = clamp((this.tmp[2] + 1.4) / 2.8, 0, 1); // 0 far … 1 near
      }
    }

    ctx.clearRect(0, 0, w, h);

    // horizon haze
    const haze = ctx.createLinearGradient(0, cy - h * 0.25, 0, cy + h * 0.1);
    haze.addColorStop(0, rgba(accent2, 0.12));
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    // rows (constant z)
    for (let r = 0; r < this.rows; r++) {
      const i0 = r * this.cols * 3;
      const d = this.out[i0 + 2];
      ctx.beginPath();
      for (let c = 0; c < this.cols; c++) {
        const i = i0 + c * 3;
        if (c === 0) ctx.moveTo(this.out[i], this.out[i + 1]);
        else ctx.lineTo(this.out[i], this.out[i + 1]);
      }
      ctx.strokeStyle = rgba(mix(fg, accent, 0.3 + d * 0.6), 0.06 + d * 0.7);
      ctx.stroke();
    }
    // columns (constant x), lighter
    for (let c = 0; c < this.cols; c += 2) {
      ctx.beginPath();
      let dsum = 0;
      for (let r = 0; r < this.rows; r++) {
        const i = (r * this.cols + c) * 3;
        dsum += this.out[i + 2];
        if (r === 0) ctx.moveTo(this.out[i], this.out[i + 1]);
        else ctx.lineTo(this.out[i], this.out[i + 1]);
      }
      const d = dsum / this.rows;
      ctx.strokeStyle = rgba(mix(fg, accent, 0.5), 0.04 + d * 0.25);
      ctx.stroke();
    }
    // vertex dots on the near rows
    for (let r = Math.floor(this.rows * 0.55); r < this.rows; r++) {
      for (let c = 0; c < this.cols; c += 2) {
        const i = (r * this.cols + c) * 3;
        const d = this.out[i + 2];
        ctx.fillStyle = rgba(accent, 0.1 + d * 0.6);
        ctx.fillRect(this.out[i] - 0.5, this.out[i + 1] - 0.5, 1 + d * 1.5, 1 + d * 1.5);
      }
    }
  }
}

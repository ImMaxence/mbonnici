/**
 * Tiny, dependency-free physics and 3D helpers shared by the cursor, dock, scenes and parallax.
 * Everything is frame-rate independent (uses dt in seconds).
 */

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** Exponential decay towards a target: identical feel at 30, 60 or 120 Hz. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const mapRange = (v: number, inMin: number, inMax: number, outMin: number, outMax: number): number =>
  outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Critically-ish damped spring, good for magnetic buttons and tilt effects. */
export class Spring {
  value: number;
  target: number;
  velocity = 0;

  constructor(
    initial = 0,
    public stiffness = 170,
    public damping = 22,
  ) {
    this.value = initial;
    this.target = initial;
  }

  update(dt: number): number {
    // sub-step for stability when the tab was in the background
    const steps = dt > 0.034 ? 2 : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  settled(epsilon = 0.01): boolean {
    return Math.abs(this.value - this.target) < epsilon && Math.abs(this.velocity) < epsilon;
  }

  set(v: number): void {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }
}

export class Spring2 {
  readonly x: Spring;
  readonly y: Spring;

  constructor(stiffness = 170, damping = 22) {
    this.x = new Spring(0, stiffness, damping);
    this.y = new Spring(0, stiffness, damping);
  }

  setTarget(x: number, y: number): void {
    this.x.target = x;
    this.y.target = y;
  }

  update(dt: number): void {
    this.x.update(dt);
    this.y.update(dt);
  }

  settled(): boolean {
    return this.x.settled() && this.y.settled();
  }
}

// ── 3D ────────────────────────────────────────────────────────────────────────

export interface Projected {
  x: number;
  y: number;
  scale: number;
  depth: number; // 0 (far) … 1 (near)
}

/** Rotates a point (in a Float32Array at offset i) around X then Y, writes into out. */
export function rotateXY(
  src: Float32Array,
  i: number,
  ax: number,
  ay: number,
  out: Float32Array,
  o: number,
): void {
  const x = src[i];
  const y = src[i + 1];
  const z = src[i + 2];
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  // around X
  const y1 = y * cx - z * sx;
  const z1 = y * sx + z * cx;
  // around Y
  const x2 = x * cy + z1 * sy;
  const z2 = -x * sy + z1 * cy;
  out[o] = x2;
  out[o + 1] = y1;
  out[o + 2] = z2;
}

/** Perspective projection of camera-space coordinates to screen pixels. */
export function project(x: number, y: number, z: number, fov: number, cx: number, cy: number, cameraZ: number): Projected {
  const dz = cameraZ - z;
  const scale = fov / Math.max(1, dz);
  return { x: cx + x * scale, y: cy + y * scale, scale, depth: clamp(1 - dz / (cameraZ * 2), 0, 1) };
}

/** Evenly distributed points on a sphere (Fibonacci lattice). */
export function fibonacciSphere(count: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    out[i * 3] = Math.cos(theta) * r * radius;
    out[i * 3 + 1] = y * radius;
    out[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return out;
}

/** Cheap, smooth, layered pseudo-noise in [-1, 1]. Good enough for terrain and breathing. */
export function noise2(x: number, y: number, t: number): number {
  return (
    (Math.sin(x * 1.3 + t * 0.9) * Math.cos(y * 1.7 - t * 0.6) +
      Math.sin((x + y) * 0.7 + t * 0.35) * 0.6 +
      Math.cos(x * 2.9 - y * 2.1 + t * 1.4) * 0.25) /
    1.85
  );
}

// ── colour ────────────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const n = parseInt(v.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(alpha, 0, 1).toFixed(3)})`;
}

/** Mix two rgb triplets. */
export function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
}

/** Deterministic pseudo random, so a scene looks the same on every render. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

import { angleOf, distance, dot, positiveAngle, sub } from './geometry';
import type { ArcGeometry, CircleGeometry, LineGeometry, Point } from './types';

export type DrawableGeometry = LineGeometry | CircleGeometry | ArcGeometry;
type Interval = [number, number];
const TAU = Math.PI * 2;

export function densifyStroke(points: Point[], spacing: number): Point[] {
  if (points.length < 2) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]; const b = points[i];
    const count = Math.max(1, Math.min(300, Math.ceil(distance(a, b) / spacing)));
    for (let j = 1; j <= count; j++) result.push({ x: a.x + (b.x - a.x) * j / count, y: a.y + (b.y - a.y) * j / count });
  }
  return result;
}

function remaining(max: number, removed: Interval[]): Interval[] | null {
  if (!removed.length) return null;
  const merged: Interval[] = [];
  for (const [rawA, rawB] of removed.sort((a, b) => a[0] - b[0])) {
    const a = Math.max(0, rawA); const b = Math.min(max, rawB);
    if (b <= a) continue;
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 1e-8) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  if (!merged.length) return null;
  const keep: Interval[] = []; let at = 0;
  for (const [a, b] of merged) { if (a - at > 1e-5) keep.push([at, a]); at = Math.max(at, b); }
  if (max - at > 1e-5) keep.push([at, max]);
  return keep;
}

export function eraseGeometry(geometry: DrawableGeometry, stroke: Point[], radius: number): DrawableGeometry[] | null {
  if (!stroke.length || !Number.isFinite(radius) || radius <= 0) return null;
  if (geometry.kind === 'line') {
    const vector = sub(geometry.b, geometry.a);
    const length = Math.hypot(vector.x, vector.y);
    if (length < 1e-8) return null;
    const unit = { x: vector.x / length, y: vector.y / length };
    const cuts: Interval[] = [];
    for (const p of stroke) {
      const fromStart = sub(p, geometry.a);
      const along = dot(fromStart, unit);
      const across = Math.abs(fromStart.x * unit.y - fromStart.y * unit.x);
      if (across > radius) continue;
      const half = Math.sqrt(Math.max(0, radius * radius - across * across));
      cuts.push([along - half, along + half]);
    }
    const keep = remaining(length, cuts);
    return keep?.map(([a, b]) => ({ kind: 'line', a: { x: geometry.a.x + unit.x * a, y: geometry.a.y + unit.y * a }, b: { x: geometry.a.x + unit.x * b, y: geometry.a.y + unit.y * b } })) ?? null;
  }
  const sweep = geometry.kind === 'circle' ? TAU : Math.abs(geometry.sweepAngle);
  const start = geometry.kind === 'circle' ? 0 : geometry.startAngle;
  const sign = geometry.kind === 'circle' || geometry.sweepAngle >= 0 ? 1 : -1;
  const cuts: Interval[] = [];
  for (const p of stroke) {
    const d = distance(p, geometry.center); const r = geometry.radius;
    if (d < 1e-8) { if (radius >= r) cuts.push([0, sweep]); continue; }
    if (Math.abs(d - r) > radius) continue;
    const cosine = Math.max(-1, Math.min(1, (r * r + d * d - radius * radius) / (2 * r * d)));
    const half = Math.acos(cosine);
    const angle = angleOf(geometry.center, p);
    const relative = positiveAngle(sign > 0 ? angle - start : start - angle);
    for (const turn of [-TAU, 0, TAU]) cuts.push([relative + turn - half, relative + turn + half]);
  }
  const keep = remaining(sweep, cuts);
  return keep?.map(([a, b]) => ({ kind: 'arc', center: geometry.center, radius: geometry.radius, startAngle: start + sign * a, sweepAngle: sign * (b - a) })) ?? null;
}

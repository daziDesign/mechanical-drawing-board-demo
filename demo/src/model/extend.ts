import { angleOf, arcEnds, distance, dot, positiveAngle, sub } from './geometry';
import type { ArcGeometry, CircleGeometry, LineGeometry, Point, Shape } from './types';

const TAU = Math.PI * 2;
export type ExtendEnd = 'a' | 'b' | 'start' | 'end';
export type ExtendTarget = { id: string; end: ExtendEnd; point: Point };

export function nearestExtendTarget(point: Point, shapes: Shape[], scale: number, thresholdPx = 12): ExtendTarget | null {
  let result: ExtendTarget | null = null;
  let best = thresholdPx;
  for (const shape of shapes) {
    const g = shape.geometry;
    const ends: Array<[ExtendEnd, Point]> = g.kind === 'line'
      ? [['a', g.a], ['b', g.b]]
      : g.kind === 'arc'
        ? [['start', arcEnds(g)[0]], ['end', arcEnds(g)[1]]]
        : [];
    for (const [end, candidate] of ends) {
      const px = distance(point, candidate) * scale;
      if (px < best) { best = px; result = { id: shape.id, end, point: candidate }; }
    }
  }
  return result;
}

export function extendGeometry(source: LineGeometry | ArcGeometry, end: ExtendEnd, pointer: Point, closePx = 12, scale = 6): LineGeometry | ArcGeometry | CircleGeometry | null {
  if (source.kind === 'line') {
    if (end !== 'a' && end !== 'b') return null;
    const fixed = end === 'a' ? source.b : source.a;
    const oldEnd = end === 'a' ? source.a : source.b;
    const axis = sub(oldEnd, fixed);
    const length2 = dot(axis, axis);
    if (length2 < 1e-12) return null;
    const t = dot(sub(pointer, fixed), axis) / length2;
    if (t <= 1 + 1e-6) return null;
    const next = { x: fixed.x + axis.x * t, y: fixed.y + axis.y * t };
    return end === 'a' ? { kind: 'line', a: next, b: fixed } : { kind: 'line', a: fixed, b: next };
  }
  if (end !== 'start' && end !== 'end') return null;
  const [startPoint, endPoint] = arcEnds(source);
  const opposite = end === 'start' ? endPoint : startPoint;
  if (distance(pointer, opposite) * scale <= closePx) return { kind: 'circle', center: source.center, radius: source.radius };
  const sign = Math.sign(source.sweepAngle);
  const currentAngle = end === 'start' ? source.startAngle : source.startAngle + source.sweepAngle;
  const pointerAngle = angleOf(source.center, pointer);
  const delta = positiveAngle((end === 'start' ? currentAngle - pointerAngle : pointerAngle - currentAngle) * sign);
  if (delta < 1e-5 || Math.abs(source.sweepAngle) + delta >= TAU - 1e-5) return null;
  return end === 'start'
    ? { ...source, startAngle: source.startAngle - sign * delta, sweepAngle: source.sweepAngle + sign * delta }
    : { ...source, sweepAngle: source.sweepAngle + sign * delta };
}

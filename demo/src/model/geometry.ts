import type { ArcGeometry, CircleGeometry, Geometry, LineGeometry, Point, Shape } from './types';

export const EPS = 1e-8;
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
export const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
export const midpoint = (a: Point, b: Point): Point => mul(add(a, b), 0.5);
export const polar = (c: Point, r: number, angle: number): Point => ({ x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) });
export const angleOf = (center: Point, point: Point) => Math.atan2(point.y - center.y, point.x - center.x);
const TAU = Math.PI * 2;
export const positiveAngle = (a: number) => ((a % TAU) + TAU) % TAU;
export const arcContains = (arc: ArcGeometry, point: Point) => {
  const angle = angleOf(arc.center, point);
  return arc.sweepAngle >= 0
    ? positiveAngle(angle - arc.startAngle) <= arc.sweepAngle + EPS
    : positiveAngle(arc.startAngle - angle) <= -arc.sweepAngle + EPS;
};
export const arcEnds = (arc: ArcGeometry): [Point, Point] => [
  polar(arc.center, arc.radius, arc.startAngle),
  polar(arc.center, arc.radius, arc.startAngle + arc.sweepAngle),
];

export function arcThroughThreePoints(a: Point, b: Point, c: Point): ArcGeometry | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < EPS) return null;
  const aa = a.x * a.x + a.y * a.y;
  const bb = b.x * b.x + b.y * b.y;
  const cc = c.x * c.x + c.y * c.y;
  const center = {
    x: (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d,
    y: (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d,
  };
  const startAngle = angleOf(center, a);
  const ccw = positiveAngle(angleOf(center, c) - startAngle);
  const midCcw = positiveAngle(angleOf(center, b) - startAngle);
  return { kind: 'arc', center, radius: distance(center, a), startAngle, sweepAngle: midCcw <= ccw ? ccw : ccw - TAU };
}

export function offsetLine(line: LineGeometry, amount: number, sidePoint: Point): LineGeometry | null {
  const delta = sub(line.b, line.a);
  const len = Math.hypot(delta.x, delta.y);
  if (len < EPS || !Number.isFinite(amount) || amount <= 0) return null;
  const side = cross(delta, sub(sidePoint, line.a)) < 0 ? -1 : 1;
  const normal = { x: -delta.y / len * amount * side, y: delta.x / len * amount * side };
  return { kind: 'line', a: add(line.a, normal), b: add(line.b, normal) };
}

export function nearestOnLine(p: Point, line: LineGeometry): Point {
  const d = sub(line.b, line.a);
  const l2 = dot(d, d);
  if (l2 < EPS) return line.a;
  const t = Math.max(0, Math.min(1, dot(sub(p, line.a), d) / l2));
  return add(line.a, mul(d, t));
}

/** A finite construction line through a point, perpendicular to the selected line. */
export function perpendicularThrough(line: LineGeometry, point: Point): LineGeometry | null {
  const direction = sub(line.b, line.a);
  const length = Math.hypot(direction.x, direction.y);
  if (length < EPS) return null;
  const half = Math.max(20, length / 2);
  const normal = { x: -direction.y / length * half, y: direction.x / length * half };
  return { kind: 'line', a: sub(point, normal), b: add(point, normal) };
}

/** Exact contact points of tangents drawn from a point to a circle or arc. */
export function tangentPointsFrom(point: Point, curve: CircleGeometry | ArcGeometry): Point[] {
  const vector = sub(point, curve.center);
  const d = Math.hypot(vector.x, vector.y);
  if (d < curve.radius - EPS || d < EPS) return [];
  const base = Math.atan2(vector.y, vector.x);
  const spread = Math.acos(Math.max(-1, Math.min(1, curve.radius / d)));
  const points = spread < EPS ? [polar(curve.center, curve.radius, base)] : [
    polar(curve.center, curve.radius, base + spread),
    polar(curve.center, curve.radius, base - spread),
  ];
  return curve.kind === 'arc' ? points.filter(p => arcContains(curve, p)) : points;
}

export function tangentLineFrom(point: Point, contact: Point, curve: CircleGeometry | ArcGeometry): LineGeometry {
  if (distance(point, contact) > EPS) return { kind: 'line', a: point, b: contact };
  const radius = sub(contact, curve.center);
  const length = Math.hypot(radius.x, radius.y);
  const normal = { x: -radius.y / length * 20, y: radius.x / length * 20 };
  return { kind: 'line', a: sub(contact, normal), b: add(contact, normal) };
}

function lineLine(a: LineGeometry, b: LineGeometry): Point[] {
  const r = sub(a.b, a.a); const s = sub(b.b, b.a);
  const d = cross(r, s);
  if (Math.abs(d) < EPS) return [];
  const q = sub(b.a, a.a);
  const t = cross(q, s) / d; const u = cross(q, r) / d;
  return t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS ? [add(a.a, mul(r, t))] : [];
}

function lineCircle(line: LineGeometry, circle: CircleGeometry): Point[] {
  const d = sub(line.b, line.a); const f = sub(line.a, circle.center);
  const a = dot(d, d); if (a < EPS) return [];
  const b = 2 * dot(f, d); const c = dot(f, f) - circle.radius * circle.radius;
  const disc = b * b - 4 * a * c;
  if (disc < -EPS) return [];
  const roots = Math.abs(disc) < EPS ? [-b / (2 * a)] : [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)];
  return roots.filter(t => t >= -EPS && t <= 1 + EPS).map(t => add(line.a, mul(d, t)));
}

function circleCircle(a: CircleGeometry, b: CircleGeometry): Point[] {
  const d = distance(a.center, b.center);
  if (d < EPS || d > a.radius + b.radius + EPS || d < Math.abs(a.radius - b.radius) - EPS) return [];
  const x = (a.radius ** 2 - b.radius ** 2 + d ** 2) / (2 * d);
  const h2 = a.radius ** 2 - x ** 2;
  if (h2 < -EPS) return [];
  const u = mul(sub(b.center, a.center), 1 / d);
  const base = add(a.center, mul(u, x));
  if (h2 < EPS) return [base];
  const h = Math.sqrt(h2);
  return [add(base, { x: -u.y * h, y: u.x * h }), add(base, { x: u.y * h, y: -u.x * h })];
}

export function intersections(a: Geometry, b: Geometry): Point[] {
  if (a.kind === 'marker' || b.kind === 'marker' || a.kind === 'callout' || b.kind === 'callout' || a.kind === 'dimension' || b.kind === 'dimension' || a.kind === 'ink' || b.kind === 'ink') return [];
  const aCircle: CircleGeometry | null = a.kind === 'arc' ? { kind: 'circle', center: a.center, radius: a.radius } : a.kind === 'circle' ? a : null;
  const bCircle: CircleGeometry | null = b.kind === 'arc' ? { kind: 'circle', center: b.center, radius: b.radius } : b.kind === 'circle' ? b : null;
  let points: Point[] = [];
  if (a.kind === 'line' && b.kind === 'line') points = lineLine(a, b);
  else if (a.kind === 'line' && bCircle) points = lineCircle(a, bCircle);
  else if (b.kind === 'line' && aCircle) points = lineCircle(b, aCircle);
  else if (aCircle && bCircle) points = circleCircle(aCircle, bCircle);
  return points.filter(p => (a.kind !== 'arc' || arcContains(a, p)) && (b.kind !== 'arc' || arcContains(b, p)));
}

export type SnapCandidate = { point: Point; label: string };
export type RelationCandidate = SnapCandidate & { kind: 'intersection' | 'tangent' };
export function relationCandidates(shapes: Shape[]): RelationCandidate[] {
  const result: RelationCandidate[] = [];
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const a = shapes[i].geometry; const b = shapes[j].geometry;
    for (const point of intersections(a, b)) {
      let tangent = false;
      const line = a.kind === 'line' ? a : b.kind === 'line' ? b : null;
      const curve = a.kind === 'circle' || a.kind === 'arc' ? a : b.kind === 'circle' || b.kind === 'arc' ? b : null;
      if (line && curve) {
        const direction = sub(line.b, line.a); const radius = sub(point, curve.center);
        tangent = Math.abs(dot(direction, radius)) <= 1e-6 * Math.hypot(direction.x, direction.y) * curve.radius;
      } else if ((a.kind === 'circle' || a.kind === 'arc') && (b.kind === 'circle' || b.kind === 'arc')) {
        const ra = sub(point, a.center); const rb = sub(point, b.center);
        tangent = Math.abs(cross(ra, rb)) <= 1e-6 * a.radius * b.radius;
      }
      const kind = tangent ? 'tangent' : 'intersection';
      if (!result.some(candidate => distance(candidate.point, point) < 1e-6 && candidate.kind === kind))
        result.push({ point, kind, label: tangent ? '切点' : '交点' });
    }
  }
  return result;
}
export function snapCandidates(shapes: Shape[]): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  for (const shape of shapes) {
    const g = shape.geometry;
    if (g.kind === 'line') result.push({ point: g.a, label: '端点' }, { point: g.b, label: '端点' }, { point: midpoint(g.a, g.b), label: '中点' });
    else if (g.kind === 'circle' || g.kind === 'arc') {
      result.push({ point: g.center, label: '圆心' });
      for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
        const p = polar(g.center, g.radius, angle);
        if (g.kind === 'circle' || arcContains(g, p)) result.push({ point: p, label: '象限点' });
      }
      if (g.kind === 'arc') for (const p of arcEnds(g)) result.push({ point: p, label: '端点' });
    } else if (g.kind === 'marker') result.push({ point: g.point, label: g.label });
  }
  result.push(...relationCandidates(shapes));
  return result;
}

/** Fixed points win near endpoints/midpoints; otherwise use any point on a finite segment. */
export function nearestDrawingSnap(pointer: Point, candidates: SnapCandidate[], shapes: Shape[], scale: number, thresholdPx = 10): SnapCandidate | null {
  const fixed = nearestSnap(pointer, candidates, scale, thresholdPx);
  if (fixed) return fixed;
  let best: SnapCandidate | null = null; let bestPx = thresholdPx;
  for (const shape of shapes) {
    if (shape.geometry.kind !== 'line') continue;
    const point = nearestOnLine(pointer, shape.geometry);
    const px = distance(pointer, point) * scale;
    if (px < bestPx) { best = { point, label: '线上点' }; bestPx = px; }
  }
  return best;
}

export function nearestSnap(pointer: Point, candidates: SnapCandidate[], scale: number, thresholdPx = 10): SnapCandidate | null {
  let best: SnapCandidate | null = null; let bestPx = thresholdPx;
  for (const candidate of candidates) {
    const px = distance(pointer, candidate.point) * scale;
    if (px < bestPx) { best = candidate; bestPx = px; }
  }
  return best;
}

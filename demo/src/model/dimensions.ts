import { angleOf, arcContains, arcEnds, cross, distance, polar, positiveAngle, sub } from './geometry';
import type { AngularDimension, ArcGeometry, CircleGeometry, DimensionGeometry, LineGeometry, Point } from './types';

const readable = (value: number) => Number(value.toFixed(2)).toString();

export function makeDimension(source: LineGeometry | CircleGeometry | ArcGeometry, placement: Point, diameter = false): DimensionGeometry | null {
  if (source.kind === 'line') {
    const length = distance(source.a, source.b);
    if (length < 1e-8) return null;
    const normal = { x: -(source.b.y - source.a.y) / length, y: (source.b.x - source.a.x) / length };
    const side = (placement.x - source.a.x) * normal.x + (placement.y - source.a.y) * normal.y;
    return { kind: 'dimension', mode: 'linear', a: source.a, b: source.b, offset: Math.abs(side) < 4 ? (side < 0 ? -8 : 8) : side };
  }
  const angle = distance(placement, source.center) < 1e-8 ? 0 : angleOf(source.center, placement);
  const candidate = polar(source.center, source.radius, angle);
  const edge = source.kind === 'arc' && !arcContains(source, candidate)
    ? arcEnds(source).sort((a, b) => distance(a, placement) - distance(b, placement))[0]
    : candidate;
  const labelAngle = angleOf(source.center, edge);
  const labelPoint = distance(placement, source.center) < source.radius + 6 ? polar(source.center, source.radius + 14, labelAngle) : placement;
  return { kind: 'dimension', mode: diameter && source.kind === 'circle' ? 'diameter' : 'radius', center: source.center, edge, labelPoint, value: diameter && source.kind === 'circle' ? source.radius * 2 : source.radius };
}

export function makeAngularDimension(first: LineGeometry, second: LineGeometry, placement: Point): AngularDimension | null {
  const a = sub(first.b, first.a); const b = sub(second.b, second.a);
  const lengthA = Math.hypot(a.x, a.y); const lengthB = Math.hypot(b.x, b.y);
  const denominator = cross(a, b);
  if (lengthA < 1e-8 || lengthB < 1e-8 || Math.abs(denominator) < 1e-8 * lengthA * lengthB) return null;
  const t = cross(sub(second.a, first.a), b) / denominator;
  const vertex = { x: first.a.x + a.x * t, y: first.a.y + a.y * t };
  const firstAngle = Math.atan2(a.y, a.x); const secondAngle = Math.atan2(b.y, b.x);
  const boundaries = [firstAngle, firstAngle + Math.PI, secondAngle, secondAngle + Math.PI].map(positiveAngle).sort((x, y) => x - y);
  const chosen = positiveAngle(angleOf(vertex, placement));
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]; const end = i === boundaries.length - 1 ? boundaries[0] + Math.PI * 2 : boundaries[i + 1];
    const placed = chosen < start ? chosen + Math.PI * 2 : chosen;
    if (placed >= start && placed < end) return { kind: 'dimension', mode: 'angle', vertex, startAngle: start, sweepAngle: end - start, radius: Math.max(8, distance(vertex, placement)) };
  }
  return null;
}

export type DimensionLayout = {
  lines: Array<[Point, Point]>;
  arcs: ArcGeometry[];
  arrow: { tip: Point; toward: Point }[];
  label: Point;
  text: string;
};

export function dimensionLayout(g: DimensionGeometry): DimensionLayout {
  if (g.mode === 'angle') {
    const start = polar(g.vertex, g.radius, g.startAngle);
    const end = polar(g.vertex, g.radius, g.startAngle + g.sweepAngle);
    const near = Math.min(0.12, g.sweepAngle / 3);
    return {
      lines: [
        [polar(g.vertex, Math.max(0, g.radius - 5), g.startAngle), polar(g.vertex, g.radius + 4, g.startAngle)],
        [polar(g.vertex, Math.max(0, g.radius - 5), g.startAngle + g.sweepAngle), polar(g.vertex, g.radius + 4, g.startAngle + g.sweepAngle)],
      ],
      arcs: [{ kind: 'arc', center: g.vertex, radius: g.radius, startAngle: g.startAngle, sweepAngle: g.sweepAngle }],
      arrow: [{ tip: start, toward: polar(g.vertex, g.radius, g.startAngle + near) }, { tip: end, toward: polar(g.vertex, g.radius, g.startAngle + g.sweepAngle - near) }],
      label: polar(g.vertex, g.radius + 5, g.startAngle + g.sweepAngle / 2),
      text: readable(g.sweepAngle * 180 / Math.PI) + '°',
    };
  }
  if (g.mode !== 'linear') {
    return { lines: [[g.labelPoint, g.edge]], arcs: [], arrow: [{ tip: g.edge, toward: g.labelPoint }], label: g.labelPoint, text: (g.mode === 'diameter' ? '⌀' : 'R') + readable(g.value) };
  }
  const len = distance(g.a, g.b);
  const normal = { x: -(g.b.y - g.a.y) / len, y: (g.b.x - g.a.x) / len };
  const a = { x: g.a.x + normal.x * g.offset, y: g.a.y + normal.y * g.offset };
  const b = { x: g.b.x + normal.x * g.offset, y: g.b.y + normal.y * g.offset };
  const side = Math.sign(g.offset) || 1;
  return {
    lines: [[g.a, a], [g.b, b], [a, b]],
    arcs: [],
    arrow: [{ tip: a, toward: b }, { tip: b, toward: a }],
    label: { x: (a.x + b.x) / 2 + normal.x * side * 3, y: (a.y + b.y) / 2 + normal.y * side * 3 },
    text: readable(len) + ' mm',
  };
}

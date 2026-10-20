import { angleOf, arcContains, arcEnds, distance, polar } from './geometry';
import type { ArcGeometry, CircleGeometry, DimensionGeometry, LineGeometry, Point } from './types';

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

export type DimensionLayout = {
  lines: Array<[Point, Point]>;
  arrow: { tip: Point; toward: Point }[];
  label: Point;
  text: string;
};

export function dimensionLayout(g: DimensionGeometry): DimensionLayout {
  if (g.mode !== 'linear') {
    return { lines: [[g.labelPoint, g.edge]], arrow: [{ tip: g.edge, toward: g.labelPoint }], label: g.labelPoint, text: (g.mode === 'diameter' ? '⌀' : 'R') + readable(g.value) };
  }
  const len = distance(g.a, g.b);
  const normal = { x: -(g.b.y - g.a.y) / len, y: (g.b.x - g.a.x) / len };
  const a = { x: g.a.x + normal.x * g.offset, y: g.a.y + normal.y * g.offset };
  const b = { x: g.b.x + normal.x * g.offset, y: g.b.y + normal.y * g.offset };
  const side = Math.sign(g.offset) || 1;
  return {
    lines: [[g.a, a], [g.b, b], [a, b]],
    arrow: [{ tip: a, toward: b }, { tip: b, toward: a }],
    label: { x: (a.x + b.x) / 2 + normal.x * side * 3, y: (a.y + b.y) / 2 + normal.y * side * 3 },
    text: readable(len) + ' mm',
  };
}

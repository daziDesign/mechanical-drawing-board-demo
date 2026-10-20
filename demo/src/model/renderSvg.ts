import { arcEnds, polar } from './geometry';
import { dimensionLayout } from './dimensions';
import { getLineStyle, printStrokeMm, screenStrokePx } from './lineStyles';
import type { Geometry, Point, Shape } from './types';

export type Mapper = (point: Point) => Point;
const fmt = (n: number) => Number(n.toFixed(4));
const pstr = (p: Point) => `${fmt(p.x)} ${fmt(p.y)}`;

function plainPath(g: Exclude<Geometry, { kind: 'marker' | 'callout' | 'dimension' }>, map: Mapper): string {
  if (g.kind === 'line') return `M ${pstr(map(g.a))} L ${pstr(map(g.b))}`;
  const r = Math.hypot(map(polar(g.center, g.radius, 0)).x - map(g.center).x, map(polar(g.center, g.radius, 0)).y - map(g.center).y);
  if (g.kind === 'circle') {
    const right = map(polar(g.center, g.radius, 0));
    const left = map(polar(g.center, g.radius, Math.PI));
    return `M ${pstr(right)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${pstr(left)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${pstr(right)}`;
  }
  if (Math.abs(g.sweepAngle) >= Math.PI * 2 - 1e-8) {
    return plainPath({ kind: 'circle', center: g.center, radius: g.radius }, map);
  }
  const [a, b] = arcEnds(g);
  return `M ${pstr(map(a))} A ${fmt(r)} ${fmt(r)} 0 ${Math.abs(g.sweepAngle) > Math.PI ? 1 : 0} ${g.sweepAngle >= 0 ? 0 : 1} ${pstr(map(b))}`;
}

function pathSamples(g: Exclude<Geometry, { kind: 'marker' | 'callout' | 'dimension' }>, map: Mapper, spacing: number): Point[] {
  let length = 0;
  if (g.kind === 'line') {
    const a = map(g.a); const b = map(g.b);
    length = Math.hypot(b.x - a.x, b.y - a.y);
  } else {
    const r = Math.hypot(map(polar(g.center, g.radius, 0)).x - map(g.center).x, map(polar(g.center, g.radius, 0)).y - map(g.center).y);
    length = r * (g.kind === 'circle' ? Math.PI * 2 : Math.abs(g.sweepAngle));
  }
  const n = Math.max(8, Math.ceil(length / spacing));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    if (g.kind === 'line') return map({ x: g.a.x + (g.b.x - g.a.x) * t, y: g.a.y + (g.b.y - g.a.y) * t });
    return map(polar(g.center, g.radius, (g.kind === 'circle' ? 0 : g.startAngle) + (g.kind === 'circle' ? Math.PI * 2 : g.sweepAngle) * t));
  });
}

function patternedPath(g: Exclude<Geometry, { kind: 'marker' | 'callout' | 'dimension' }>, map: Mapper, kind: 'wave' | 'zigzag', scale: 'screen' | 'print'): string {
  const amplitude = scale === 'screen' ? 2.4 : 1.1;
  const period = scale === 'screen' ? 22 : 11;
  const points = pathSamples(g, map, period / 9);
  let walked = 0;
  return points.map((p, i) => {
    if (i > 0) walked += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    const before = points[Math.max(i - 1, 0)]; const after = points[Math.min(i + 1, points.length - 1)];
    const dx = after.x - before.x; const dy = after.y - before.y;
    const d = Math.hypot(dx, dy) || 1;
    const phase = walked / period;
    const displacement = kind === 'wave' ? Math.sin(phase * Math.PI * 2) * amplitude : (1 - 4 * Math.abs((phase % 1) - 0.5)) * amplitude;
    const q = { x: p.x - dy / d * displacement, y: p.y + dx / d * displacement };
    return `${i === 0 ? 'M' : 'L'} ${pstr(q)}`;
  }).join(' ');
}

export function shapePath(shape: Shape, map: Mapper, scale: 'screen' | 'print'): string {
  if (shape.geometry.kind === 'marker' || shape.geometry.kind === 'callout' || shape.geometry.kind === 'dimension') return '';
  const style = getLineStyle(shape.style);
  return style.kind === 'wave' || style.kind === 'zigzag'
    ? patternedPath(shape.geometry, map, style.kind, scale)
    : plainPath(shape.geometry, map);
}

export function screenStyle(shape: Shape): { stroke: string; strokeWidth: number; strokeDasharray?: string } {
  const style = getLineStyle(shape.style);
  return {
    stroke: shape.role === 'construction' ? '#458de8' : '#151b23',
    strokeWidth: shape.role === 'construction' ? 1.35 : screenStrokePx(shape.style),
    ...(style.dashMm ? { strokeDasharray: style.dashMm.map(v => Math.max(1, v * 2)).join(' ') } : shape.role === 'construction' ? { strokeDasharray: '8 6' } : {}),
  };
}

export function shapeBounds(shapes: Shape[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!shapes.length) return { minX: -80, minY: -50, maxX: 80, maxY: 50 };
  const xs: number[] = []; const ys: number[] = [];
  const collect = (p: Point) => { xs.push(p.x); ys.push(p.y); };
  for (const s of shapes) {
    const g = s.geometry;
    if (g.kind === 'line') { collect(g.a); collect(g.b); }
    else if (g.kind === 'marker') collect(g.point);
    else if (g.kind === 'callout') { collect(g.target); collect(g.elbow); collect(g.end); }
    else if (g.kind === 'dimension') { const layout = dimensionLayout(g); layout.lines.forEach(([a, b]) => { collect(a); collect(b); }); collect(layout.label); }
    else { collect({ x: g.center.x - g.radius, y: g.center.y - g.radius }); collect({ x: g.center.x + g.radius, y: g.center.y + g.radius }); }
  }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const escapeXml = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
export function arrowTriangle(tip: Point, toward: Point, length: number, halfWidth: number): string {
  const dx = toward.x - tip.x; const dy = toward.y - tip.y; const d = Math.hypot(dx, dy) || 1;
  const bx = tip.x + dx / d * length; const by = tip.y + dy / d * length;
  const nx = -dy / d * halfWidth; const ny = dx / d * halfWidth;
  return `M ${pstr(tip)} L ${pstr({ x: bx + nx, y: by + ny })} L ${pstr({ x: bx - nx, y: by - ny })} Z`;
}
export type Viewport = { minX: number; minY: number; maxX: number; maxY: number };
export function generateSvg(shapes: Shape[], showConstruction: boolean, thickStrokeMm = 0.5, viewport?: Viewport): string {
  const visible = shapes.filter(s => s.role !== 'construction' || showConstruction);
  const bounds = viewport ?? shapeBounds(visible);
  const margin = viewport ? 0 : 10;
  const minX = bounds.minX - margin; const maxY = bounds.maxY + margin;
  const width = Math.max(viewport ? 0.01 : 40, bounds.maxX - bounds.minX + margin * 2);
  const height = Math.max(viewport ? 0.01 : 40, bounds.maxY - bounds.minY + margin * 2);
  const map: Mapper = p => ({ x: p.x - minX, y: maxY - p.y });
  const body = visible.map(s => {
    if (s.geometry.kind === 'marker') {
      const p = map(s.geometry.point);
      return `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="1" fill="#397bd0"/><text x="${fmt(p.x + 2)}" y="${fmt(p.y - 2)}" font-size="4" fill="#1b3556">${escapeXml(s.geometry.label)}</text>`;
    }
    if (s.geometry.kind === 'callout') {
      const target = map(s.geometry.target); const elbow = map(s.geometry.elbow); const end = map(s.geometry.end);
      const dx = target.x - elbow.x; const dy = target.y - elbow.y; const angle = Math.atan2(dy, dx);
      const wingA = { x: target.x - 3 * Math.cos(angle - 0.4), y: target.y - 3 * Math.sin(angle - 0.4) };
      const wingB = { x: target.x - 3 * Math.cos(angle + 0.4), y: target.y - 3 * Math.sin(angle + 0.4) };
      return `<path d="M ${pstr(end)} L ${pstr(elbow)} L ${pstr(target)}" fill="none" stroke="#151b23" stroke-width="${printStrokeMm(s.style, thickStrokeMm)}"/><path d="M ${pstr(target)} L ${pstr(wingA)} L ${pstr(wingB)} Z" fill="#151b23"/><text x="${fmt(elbow.x)}" y="${fmt(elbow.y - 1)}" font-size="5" fill="#151b23">${escapeXml(s.geometry.label)}</text>`;
    }
    if (s.geometry.kind === 'dimension') {
      const layout = dimensionLayout(s.geometry);
      const lines = layout.lines.map(([a, b]) => `<path d="M ${pstr(map(a))} L ${pstr(map(b))}" fill="none" stroke="#34455a" stroke-width="0.25"/>`).join('');
      const arrows = layout.arrow.map(({ tip, toward }) => `<path d="${arrowTriangle(map(tip), map(toward), 3, 0.9)}" fill="#34455a"/>`).join('');
      const label = map(layout.label);
      return `${lines}${arrows}<text x="${fmt(label.x)}" y="${fmt(label.y - 1)}" font-size="4" text-anchor="middle" fill="#26394d" stroke="white" stroke-width="1" paint-order="stroke">${escapeXml(layout.text)}</text>`;
    }
    const style = getLineStyle(s.style);
    const color = s.role === 'construction' ? '#458de8' : '#151b23';
    const dash = style.dashMm ? ` stroke-dasharray="${style.dashMm.join(' ')}"` : s.role === 'construction' ? ' stroke-dasharray="4 2"' : '';
    return `<path d="${shapePath(s, map, 'print')}" fill="none" stroke="${color}" stroke-width="${printStrokeMm(s.style, thickStrokeMm)}" stroke-linecap="butt"${dash}/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}mm" height="${fmt(height)}mm" viewBox="0 0 ${fmt(width)} ${fmt(height)}"><rect width="100%" height="100%" fill="white"/>${body}</svg>`;
}

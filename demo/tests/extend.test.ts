import { describe, expect, it } from 'vitest';
import { extendGeometry, nearestExtendTarget } from '../src/model/extend';
import type { Shape } from '../src/model/types';

describe('continuation and extension', () => {
  const line = { kind: 'line' as const, a: { x: 0, y: 0 }, b: { x: 20, y: 0 } };

  it('finds either line endpoint and extends only outward along its axis', () => {
    const shapes: Shape[] = [{ id: 'line', role: 'geometry', style: 'thin-solid', geometry: line }];
    expect(nearestExtendTarget({ x: 20.5, y: 0 }, shapes, 6)?.end).toBe('b');
    expect(nearestExtendTarget({ x: 0.5, y: 0 }, shapes, 6)?.end).toBe('a');
    expect(extendGeometry(line, 'b', { x: 30, y: 4 })).toEqual({ kind: 'line', a: line.a, b: { x: 30, y: 0 } });
    expect(extendGeometry(line, 'a', { x: -10, y: 4 })).toEqual({ kind: 'line', a: { x: -10, y: 0 }, b: line.b });
    expect(extendGeometry(line, 'b', { x: 10, y: 0 })).toBeNull();
  });

  it('extends either arc end through zero and closes into a circle', () => {
    const degrees = (n: number) => n * Math.PI / 180;
    const arc = { kind: 'arc' as const, center: { x: 0, y: 0 }, radius: 10, startAngle: degrees(350), sweepAngle: degrees(30) };
    const at = (n: number) => ({ x: 10 * Math.cos(degrees(n)), y: 10 * Math.sin(degrees(n)) });
    const end = extendGeometry(arc, 'end', at(40));
    expect(end?.kind).toBe('arc');
    if (end?.kind === 'arc') expect(end.sweepAngle * 180 / Math.PI).toBeCloseTo(50, 6);
    const start = extendGeometry(arc, 'start', at(330));
    expect(start?.kind).toBe('arc');
    if (start?.kind === 'arc') expect(start.startAngle * 180 / Math.PI).toBeCloseTo(330, 6);
    expect(extendGeometry(arc, 'end', at(350), 12, 6)?.kind).toBe('circle');
    expect(extendGeometry(arc, 'end', at(10))).toBeNull();
  });
});

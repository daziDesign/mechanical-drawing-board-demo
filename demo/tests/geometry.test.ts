import { describe, expect, it } from 'vitest';
import { arcContains, arcThroughThreePoints, distance, intersections, nearestSnap, offsetLine, snapCandidates } from '../src/model/geometry';
import type { Shape } from '../src/model/types';

describe('geometry', () => {
  it('constructs the R20 teaching arc from two offset lines', () => {
    const vertical = { kind: 'line' as const, a: { x: 0, y: -20 }, b: { x: 0, y: 80 } };
    const horizontal = { kind: 'line' as const, a: { x: -20, y: 0 }, b: { x: 80, y: 0 } };
    const v = offsetLine(vertical, 20, { x: 30, y: 20 })!;
    const h = offsetLine(horizontal, 20, { x: 20, y: 30 })!;
    expect(intersections(v, h)[0]).toEqual({ x: 20, y: 20 });
    expect(distance({ x: 20, y: 20 }, { x: 0, y: 20 })).toBe(20);
  });

  it('handles a three-point arc crossing zero degrees and rejects collinear points', () => {
    const p = (degrees: number) => ({ x: 10 * Math.cos(degrees * Math.PI / 180), y: 10 * Math.sin(degrees * Math.PI / 180) });
    const arc = arcThroughThreePoints(p(350), p(0), p(20))!;
    expect(arc.radius).toBeCloseTo(10, 6);
    expect(arc.sweepAngle * 180 / Math.PI).toBeCloseTo(30, 6);
    expect(arcContains(arc, p(0))).toBe(true);
    expect(arcThroughThreePoints({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('uses screen pixels for snap tolerance and exact candidate coordinates', () => {
    const shapes: Shape[] = [
      { id: 'a', role: 'geometry', style: 'thin-solid', geometry: { kind: 'line', a: { x: 0, y: 0 }, b: { x: 20, y: 20 } } },
      { id: 'b', role: 'geometry', style: 'thin-solid', geometry: { kind: 'line', a: { x: 0, y: 20 }, b: { x: 20, y: 0 } } },
    ];
    const candidates = snapCandidates(shapes);
    const snap = nearestSnap({ x: 10.2, y: 10.1 }, candidates, 20, 10);
    expect(snap?.point).toEqual({ x: 10, y: 10 });
    expect(nearestSnap({ x: 10.8, y: 10 }, candidates, 20, 10)).toBeNull();
  });
});

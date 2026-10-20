import { describe, expect, it } from 'vitest';
import { arcContains, arcThroughThreePoints, distance, intersections, nearestDrawingSnap, nearestSnap, offsetLine, perpendicularThrough, relationCandidates, snapCandidates, tangentLineFrom, tangentPointsFrom } from '../src/model/geometry';
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

  it('snaps anywhere on a segment while preferring fixed points nearby', () => {
    const shapes: Shape[] = [{ id: 'line', role: 'geometry', style: 'thin-solid', geometry: { kind: 'line', a: { x: 0, y: 0 }, b: { x: 20, y: 0 } } }];
    const candidates = snapCandidates(shapes);
    expect(nearestDrawingSnap({ x: 7, y: 0.2 }, candidates, shapes, 10)?.point).toEqual({ x: 7, y: 0 });
    expect(nearestDrawingSnap({ x: 9.4, y: 0 }, candidates, shapes, 10)?.label).toBe('中点');
    expect(nearestDrawingSnap({ x: 0.6, y: 0 }, candidates, shapes, 10)?.label).toBe('端点');
    expect(nearestDrawingSnap({ x: 7, y: 2 }, candidates, shapes, 10)).toBeNull();
  });

  it('distinguishes crossing points from real tangencies', () => {
    const make = (id: string, geometry: Shape['geometry']): Shape => ({ id, role: 'geometry', style: 'thin-solid', geometry });
    const circle = make('circle', { kind: 'circle', center: { x: 0, y: 0 }, radius: 10 });
    const tangent = make('tangent', { kind: 'line', a: { x: -20, y: 10 }, b: { x: 20, y: 10 } });
    const crossing = make('crossing', { kind: 'line', a: { x: -20, y: 0 }, b: { x: 20, y: 0 } });
    expect(relationCandidates([circle, tangent])).toEqual([{ point: { x: 0, y: 10 }, kind: 'tangent', label: '切点' }]);
    expect(relationCandidates([circle, crossing]).map(item => item.kind)).toEqual(['intersection', 'intersection']);
    const secondCircle = make('second', { kind: 'circle', center: { x: 20, y: 0 }, radius: 10 });
    expect(relationCandidates([circle, secondCircle])[0]).toEqual({ point: { x: 10, y: 0 }, kind: 'tangent', label: '切点' });
    const upperArc = make('arc', { kind: 'arc', center: { x: 0, y: 0 }, radius: 10, startAngle: 0, sweepAngle: Math.PI });
    expect(relationCandidates([upperArc, tangent])[0].kind).toBe('tangent');
    const lineA = make('a', { kind: 'line', a: { x: 0, y: 0 }, b: { x: 10, y: 10 } });
    const lineB = make('b', { kind: 'line', a: { x: 0, y: 10 }, b: { x: 10, y: 0 } });
    expect(relationCandidates([lineA, lineB])[0].point).toEqual({ x: 5, y: 5 });
  });

  it('constructs perpendiculars and both point-to-circle tangent branches', () => {
    const baseline = { kind: 'line' as const, a: { x: -20, y: 0 }, b: { x: 20, y: 0 } };
    const perpendicular = perpendicularThrough(baseline, { x: 7, y: 0 })!;
    expect(perpendicular.a.x).toBeCloseTo(7);
    expect(perpendicular.b.x).toBeCloseTo(7);
    expect(perpendicular.a.y).toBeLessThan(0);
    expect(perpendicular.b.y).toBeGreaterThan(0);
    const circle = { kind: 'circle' as const, center: { x: 0, y: 0 }, radius: 10 };
    const point = { x: 20, y: 0 };
    const contacts = tangentPointsFrom(point, circle);
    expect(contacts).toHaveLength(2);
    for (const contact of contacts) {
      expect(contact.x).toBeCloseTo(5);
      expect(Math.abs(contact.y)).toBeCloseTo(Math.sqrt(75));
      const line = tangentLineFrom(point, contact, circle);
      expect(intersections(line, circle)[0].x).toBeCloseTo(contact.x);
    }
    expect(tangentPointsFrom({ x: 0, y: 0 }, circle)).toEqual([]);
    expect(tangentPointsFrom({ x: 10, y: 0 }, circle)).toHaveLength(1);
    const upperArc = { kind: 'arc' as const, center: circle.center, radius: 10, startAngle: 0, sweepAngle: Math.PI };
    expect(tangentPointsFrom(point, upperArc)).toHaveLength(1);
  });
});

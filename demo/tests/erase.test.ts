import { describe, expect, it } from 'vitest';
import { densifyStroke, eraseGeometry } from '../src/model/erase';
import { addCommand, blankProject, moveCursor, parseProject } from '../src/model/history';
import type { Shape } from '../src/model/types';

describe('vector eraser', () => {
  it('cuts a local interval from a line and leaves two precise segments', () => {
    const line = { kind: 'line' as const, a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
    const parts = eraseGeometry(line, [{ x: 50, y: 0 }], 5);
    expect(parts).toHaveLength(2);
    expect(parts?.[0]).toEqual({ kind: 'line', a: { x: 0, y: 0 }, b: { x: 45, y: 0 } });
    expect(parts?.[1]).toEqual({ kind: 'line', a: { x: 55, y: 0 }, b: { x: 100, y: 0 } });
    expect(eraseGeometry(line, [{ x: 50, y: 30 }], 5)).toBeNull();
    expect(eraseGeometry(line, [{ x: 50, y: 0 }], 100)).toEqual([]);
  });

  it('keeps a drag continuous and splits circles and crossing-zero arcs', () => {
    const stroke = densifyStroke([{ x: 35, y: 0 }, { x: 65, y: 0 }], 2);
    const line = { kind: 'line' as const, a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
    const parts = eraseGeometry(line, stroke, 3);
    expect(parts).toHaveLength(2);
    if (parts?.[0]?.kind === 'line' && parts[1]?.kind === 'line') {
      expect(parts[0].b.x).toBeCloseTo(32, 8);
      expect(parts[1].a.x).toBeCloseTo(68, 8);
    }
    const circle = { kind: 'circle' as const, center: { x: 0, y: 0 }, radius: 20 };
    const circleParts = eraseGeometry(circle, [{ x: 20, y: 0 }], 4);
    expect(circleParts?.every(part => part.kind === 'arc')).toBe(true);
    expect(circleParts?.length).toBe(1);
    const arc = { kind: 'arc' as const, center: { x: 0, y: 0 }, radius: 20, startAngle: 350 * Math.PI / 180, sweepAngle: 40 * Math.PI / 180 };
    expect(eraseGeometry(arc, [{ x: 20, y: 0 }], 3)).toHaveLength(2);
    const clockwise = { ...arc, startAngle: 10 * Math.PI / 180, sweepAngle: -40 * Math.PI / 180 };
    const clockwiseParts = eraseGeometry(clockwise, [{ x: 20, y: 0 }], 3);
    expect(clockwiseParts).toHaveLength(2);
    expect(clockwiseParts?.every(part => part.kind === 'arc' && part.sweepAngle < 0)).toBe(true);
  });

  it('replays one replacement command and restores it through JSON', () => {
    const original: Shape = { id: 'whole', role: 'geometry', style: 'thick-solid', geometry: { kind: 'line', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } } };
    const parts = eraseGeometry(original.geometry as Extract<Shape['geometry'], { kind: 'line' }>, [{ x: 50, y: 0 }], 5)!;
    const project = addCommand(addCommand(blankProject(), { type: 'create', shape: original }, '画线'), {
      type: 'replace', removeIds: ['whole'], addShapes: parts.map((geometry, i) => ({ ...original, id: 'part-' + i, geometry })),
    }, '局部擦除');
    expect(project.shapes).toHaveLength(2);
    expect(moveCursor(project, 1).shapes).toEqual([original]);
    expect(parseProject(JSON.stringify(project)).shapes).toEqual(project.shapes);
  });
});

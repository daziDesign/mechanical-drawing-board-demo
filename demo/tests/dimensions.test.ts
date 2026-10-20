import { describe, expect, it } from 'vitest';
import { dimensionLayout, makeDimension } from '../src/model/dimensions';
import { arcContains } from '../src/model/geometry';
import { addCommand, blankProject, parseProject } from '../src/model/history';
import { generateSvg } from '../src/model/renderSvg';
import type { Shape } from '../src/model/types';

describe('dimension annotations', () => {
  it('measures a line from geometry and keeps the chosen side', () => {
    const g = makeDimension({ kind: 'line', a: { x: 0, y: 0 }, b: { x: 30, y: 40 } }, { x: -10, y: 10 });
    expect(g?.mode).toBe('linear');
    if (g?.mode === 'linear') {
      expect(g.offset).toBeGreaterThan(0);
      expect(dimensionLayout(g).text).toBe('50 mm');
      const shape: Shape = { id: 'd', role: 'annotation', style: 'thin-solid', geometry: g };
      expect(generateSvg([shape], true)).toContain('50 mm</text>');
      const project = addCommand(blankProject(), { type: 'create', shape }, '标注长度');
      expect(parseProject(JSON.stringify(project)).shapes).toEqual([shape]);
    }
  });

  it('labels circles and arcs with radius or diameter', () => {
    const circle = { kind: 'circle' as const, center: { x: 0, y: 0 }, radius: 25 };
    const radius = makeDimension(circle, { x: 40, y: 0 });
    const diameter = makeDimension(circle, { x: 40, y: 0 }, true);
    expect(radius && dimensionLayout(radius).text).toBe('R25');
    expect(diameter && dimensionLayout(diameter).text).toBe('⌀50');
    const arc = { kind: 'arc' as const, center: { x: 0, y: 0 }, radius: 20, startAngle: Math.PI, sweepAngle: Math.PI / 2 };
    const annotation = makeDimension(arc, { x: 35, y: 35 });
    expect(annotation?.mode).toBe('radius');
    if (annotation?.mode === 'radius') expect(arcContains(arc, annotation.edge)).toBe(true);
  });
});

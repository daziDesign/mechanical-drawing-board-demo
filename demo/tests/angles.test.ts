import { describe, expect, it } from 'vitest';
import { dimensionLayout, makeAngularDimension } from '../src/model/dimensions';
import { addCommand, blankProject, parseProject } from '../src/model/history';
import { generateSvg } from '../src/model/renderSvg';
import type { LineGeometry, Shape } from '../src/model/types';

const lineAt = (degrees: number): LineGeometry => ({ kind: 'line', a: { x: 0, y: 0 }, b: { x: 40 * Math.cos(degrees * Math.PI / 180), y: 40 * Math.sin(degrees * Math.PI / 180) } });

describe('angular dimensions', () => {
  it('uses placement to choose acute or obtuse sector between two lines', () => {
    const acute = makeAngularDimension(lineAt(0), lineAt(60), { x: 20, y: 10 });
    const obtuse = makeAngularDimension(lineAt(0), lineAt(60), { x: -10, y: 20 });
    expect(acute && dimensionLayout(acute).text).toBe('60°');
    expect(obtuse && dimensionLayout(obtuse).text).toBe('120°');
    expect(acute && dimensionLayout(acute).arcs).toHaveLength(1);
  });

  it('handles angles crossing zero and rejects parallel or coincident lines', () => {
    const acrossZero = makeAngularDimension(lineAt(350), lineAt(20), { x: 20, y: 0 });
    expect(acrossZero && dimensionLayout(acrossZero).text).toBe('30°');
    expect(makeAngularDimension(lineAt(0), { kind: 'line', a: { x: 0, y: 10 }, b: { x: 40, y: 10 } }, { x: 5, y: 5 })).toBeNull();
    expect(makeAngularDimension(lineAt(0), lineAt(180), { x: 5, y: 5 })).toBeNull();
  });

  it('round trips project JSON and draws an SVG angle arc and label', () => {
    const geometry = makeAngularDimension(lineAt(0), lineAt(90), { x: 10, y: 10 })!;
    const shape: Shape = { id: 'angle', role: 'annotation', style: 'thin-solid', geometry };
    const project = addCommand(blankProject(), { type: 'create', shape }, '标注角度');
    expect(parseProject(JSON.stringify(project)).shapes).toEqual([shape]);
    const svg = generateSvg(project.shapes, true);
    expect(svg).toContain('90°</text>');
    expect(svg).toContain(' A ');
  });
});

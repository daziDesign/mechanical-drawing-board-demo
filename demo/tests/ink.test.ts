import { describe, expect, it } from 'vitest';
import { eraseInk } from '../src/model/erase';
import { addCommand, blankProject, parseProject } from '../src/model/history';
import { generateSvg } from '../src/model/renderSvg';
import type { InkGeometry, Shape } from '../src/model/types';

describe('teacher ink', () => {
  const ink: InkGeometry = { kind: 'ink', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], color: '#d83b32', widthPx: 4 };

  it('splits a stroke locally and leaves each side editable', () => {
    const pieces = eraseInk(ink, [{ x: 10, y: 0 }], 2);
    expect(pieces).toHaveLength(2);
    expect(pieces![0].points.at(-1)!.x).toBeLessThan(10);
    expect(pieces![1].points[0].x).toBeGreaterThan(10);
    expect(eraseInk(ink, [{ x: 40, y: 0 }], 2)).toBeNull();
  });

  it('survives project JSON and exports as a round-ended colored SVG path', () => {
    const shape: Shape = { id: 'ink-1', role: 'annotation', style: 'thin-solid', geometry: ink };
    const project = addCommand(blankProject(), { type: 'create', shape }, '写字');
    expect(parseProject(JSON.stringify(project)).shapes).toEqual([shape]);
    const svg = generateSvg(project.shapes, true);
    expect(svg).toContain('stroke="#d83b32"');
    expect(svg).toContain('stroke-linecap="round"');
  });
});

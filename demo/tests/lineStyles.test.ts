import { describe, expect, it } from 'vitest';
import { lineStyles, printStrokeMm } from '../src/model/lineStyles';
import { demoProject } from '../src/model/history';
import { generateSvg, shapePath } from '../src/model/renderSvg';

describe('line styles and vector export', () => {
  it('offers nine unique named presets with 2:1 width relation', () => {
    expect(lineStyles).toHaveLength(9);
    expect(new Set(lineStyles.map(s => s.id)).size).toBe(9);
    expect(printStrokeMm('thick-solid', 0.5)).toBe(0.5);
    expect(printStrokeMm('thin-solid', 0.5)).toBe(0.25);
  });

  it('exports the visible stage and preserves vector arc commands', () => {
    const project = demoProject();
    const withGuides = generateSvg(project.shapes, true);
    const withoutGuides = generateSvg(project.shapes, false);
    expect(withGuides).toContain('#458de8');
    expect(withoutGuides).not.toContain('#458de8');
    expect(withoutGuides).toContain(' A ');
    expect(withoutGuides).toContain('stroke-width="0.5"');
  });

  it('renders wave and zigzag as vector paths', () => {
    const shape = demoProject().shapes[0];
    expect(shapePath({ ...shape, style: 'wavy' }, p => p, 'print').match(/ L /g)?.length).toBeGreaterThan(5);
    expect(shapePath({ ...shape, style: 'zigzag' }, p => p, 'print').match(/ L /g)?.length).toBeGreaterThan(5);
  });
});

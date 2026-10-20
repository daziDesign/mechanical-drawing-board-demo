import { describe, expect, it } from 'vitest';
import { addCommand, blankProject, demoProject, materialize, moveCursor, parseProject } from '../src/model/history';
import type { Shape } from '../src/model/types';

const line: Shape = { id: 'line-1', role: 'construction', style: 'thin-solid', geometry: { kind: 'line', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } } };

describe('project history', () => {
  it('replays steps, restores visibility and truncates redo after a new command', () => {
    let project = addCommand(blankProject(), { type: 'create', shape: line }, '作辅助线');
    project = addCommand(project, { type: 'constructionVisibility', visible: false }, '隐藏辅助线');
    expect(materialize(project.steps, 1).showConstruction).toBe(true);
    expect(materialize(project.steps, 2).showConstruction).toBe(false);
    project = moveCursor(project, 1);
    expect(project.settings.showConstruction).toBe(true);
    project = addCommand(project, { type: 'style', id: 'line-1', style: 'thick-solid' }, '更改线型');
    expect(project.steps).toHaveLength(2);
    expect(project.shapes[0].style).toBe('thick-solid');
  });

  it('round trips JSON and rejects bad commands', () => {
    const project = demoProject();
    expect(parseProject(JSON.stringify(project)).shapes).toEqual(project.shapes);
    const bad = { ...project, steps: [{ id: 'x', label: '无效', timestamp: 0, command: { type: 'runCode' } }], cursor: 1 };
    expect(() => parseProject(JSON.stringify(bad))).toThrow('无效的作图命令');
    expect(() => parseProject('{')).toThrow('有效的 JSON');
  });

  it('keeps the R20 example mathematically correct', () => {
    const project = demoProject();
    const arc = project.shapes.find(shape => shape.id === 'r20-arc')?.geometry;
    expect(arc?.kind).toBe('arc');
    if (arc?.kind === 'arc') {
      expect(arc.center).toEqual({ x: 20, y: 20 });
      expect(arc.radius).toBe(20);
    }
  });
});

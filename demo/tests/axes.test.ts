import { describe, expect, it } from 'vitest';
import { axisTicks } from '../src/model/axes';
import { blankProject, parseProject } from '../src/model/history';

describe('coordinate-axis reference layer', () => {
  it('uses readable 1/2/5 steps at different zoom levels', () => {
    const near = axisTicks(6, -50, 50, -30, 30);
    expect(near.step).toBe(20);
    expect(near.x).toEqual([-40, -20, 0, 20, 40]);
    const far = axisTicks(60, -5, 5, -3, 3);
    expect(far.step).toBe(2);
    expect(far.y).toEqual([-2, 0, 2]);
  });

  it('defaults off and accepts older JSON without the setting', () => {
    const project = blankProject();
    expect(project.settings.showAxes).toBe(false);
    const old = JSON.parse(JSON.stringify(project));
    delete old.settings.showAxes;
    expect(parseProject(JSON.stringify(old)).settings.showAxes).toBe(false);
    project.settings.showAxes = true;
    expect(parseProject(JSON.stringify(project)).settings.showAxes).toBe(true);
  });
});

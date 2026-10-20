import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function blankBoard(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '新建空白画板' }).click();
  const canvas = page.locator('svg.drawing-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('画布未显示');
  const click = async (x: number, y: number) => canvas.click({ position: { x: box.width / 2 + x * 6, y: box.height / 2 - y * 6 } });
  const json = async () => {
    await page.getByRole('button', { name: '文件菜单' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '保存项目 JSON' }).click();
    const path = await (await download).path();
    if (!path) throw new Error('JSON 下载路径缺失');
    return JSON.parse(readFileSync(path, 'utf8'));
  };
  return { canvas, click, json };
}

test('line tool snaps to an arbitrary segment point and prefers its midpoint', async ({ page }) => {
  const { click, json } = await blankBoard(page);
  await page.getByRole('button', { name: '直线' }).click();
  await click(0, 0); await click(40, 0);
  await click(7, 0.5); await click(7, 15);
  await click(19.5, 0); await click(20, 16);
  const project = await json();
  expect(project.shapes[1].geometry.a).toEqual({ x: 7, y: 0 });
  expect(project.shapes[2].geometry.a).toEqual({ x: 20, y: 0 });
});

test('intersection and tangent markers can be named, undone, restored, and exported', async ({ page }) => {
  const { canvas, click, json } = await blankBoard(page);
  await page.getByRole('button', { name: '直线' }).click();
  await click(-25, -15); await click(25, -15);
  await click(0, -30); await click(0, 0);
  await page.getByRole('button', { name: '圆', exact: true }).click();
  await page.getByLabel('圆心 X').fill('0');
  await page.getByLabel('圆心 Y').fill('0');
  await page.getByLabel('半径 R').fill('10');
  await page.getByRole('button', { name: '按数值绘制' }).click();
  await page.getByRole('button', { name: '直线' }).click();
  await click(-25, 10); await click(25, 10);
  await page.getByRole('button', { name: '交点／切点标注' }).click();
  await page.getByLabel('标记名称').fill('O');
  await click(0, -15);
  await page.getByRole('button', { name: '切点', exact: true }).click();
  await page.getByLabel('标记名称').fill('T1');
  await click(0, 10);
  await expect(canvas.locator('.marker')).toHaveCount(2);
  await expect(canvas.locator('.marker')).toContainText(['O', 'T1']);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(canvas.locator('.marker')).toHaveCount(1);
  await page.getByRole('button', { name: '重做' }).click();
  await expect(canvas.locator('.marker')).toHaveCount(2);
  const project = await json();
  expect(project.shapes.filter((shape: { geometry: { kind: string } }) => shape.geometry.kind === 'marker').map((shape: { geometry: { label: string } }) => shape.geometry.label)).toEqual(['O', 'T1']);
  await page.getByRole('button', { name: '文件菜单' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 SVG' }).click();
  const path = await (await download).path();
  if (!path) throw new Error('SVG 下载路径缺失');
  expect(readFileSync(path, 'utf8')).toContain('T1</text>');
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await page.reload();
  await expect(canvas.locator('.marker')).toHaveCount(2);
  await page.getByRole('button', { name: '选择' }).click();
  const transform = await canvas.locator('.marker').filter({ hasText: 'T1' }).getAttribute('transform');
  const coordinates = transform?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
  if (!coordinates) throw new Error('切点屏幕坐标缺失');
  await canvas.click({ position: { x: Number(coordinates[1]), y: Number(coordinates[2]) } });
  await expect(canvas.locator('.marker.selected-shape')).toContainText('T1');
  await page.getByRole('button', { name: '删除所选图元' }).click();
  await expect(canvas.locator('.marker')).toHaveCount(1);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(canvas.locator('.marker')).toHaveCount(2);
});

test('perpendicular and tangent construction plus grouped toolbar fit at classroom sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const { canvas, click, json } = await blankBoard(page);
  await page.getByRole('button', { name: '直线' }).click();
  await click(-30, -20); await click(30, -20);
  await page.getByRole('button', { name: '垂线' }).click();
  await click(-15, -20); await click(7, -5);
  await page.getByRole('button', { name: '圆', exact: true }).click();
  await page.getByLabel('圆心 X').fill('0');
  await page.getByLabel('圆心 Y').fill('0');
  await page.getByLabel('半径 R').fill('10');
  await page.getByRole('button', { name: '按数值绘制' }).click();
  await page.getByRole('button', { name: '切线' }).click();
  await click(10, 0); await click(20, 0);
  await expect(canvas.locator('path[stroke="#3287e2"]')).toHaveCount(2);
  await click(5, 8.66);
  const project = await json();
  const perpendicular = project.shapes[1].geometry;
  expect(project.shapes[1].role).toBe('geometry');
  expect(perpendicular.kind).toBe('line');
  expect(perpendicular.a.x).toBeCloseTo(7);
  expect(perpendicular.b.x).toBeCloseTo(7);
  const tangent = project.shapes[3].geometry;
  expect(project.shapes[3].role).toBe('geometry');
  expect(tangent.kind).toBe('line');
  expect(tangent.a).toEqual({ x: 20, y: 0 });
  expect(tangent.b.x).toBeCloseTo(5);
  expect(tangent.b.y).toBeGreaterThan(0);
  for (const name of ['垂线', '切线', '交点／切点标注', '尺寸标注', '删除所选图元'])
    await expect(page.getByRole('button', { name })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  await page.screenshot({ path: 'qa/construction-1366.png', fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.getByRole('button', { name: '交点／切点标注' })).toBeInViewport();
  await page.screenshot({ path: 'qa/construction-1920.png', fullPage: true });
});

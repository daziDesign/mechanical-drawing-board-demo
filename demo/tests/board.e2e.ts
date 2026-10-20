import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

test('R20 示例可回放、隐藏辅助线并在刷新后恢复', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /打开 R20 教学示例/ }).click();
  await expect(page.locator('[data-shape-id="r20-arc"]')).toHaveCount(1);
  await expect(page.locator('[data-shape-id="r20-label"]')).toHaveCount(1);
  await expect(page.locator('[data-shape-id="offset-v"]')).toHaveCount(1);
  mkdirSync('qa', { recursive: true });
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.screenshot({ path: 'qa/implementation-1920.png', fullPage: true });
  await page.getByRole('button', { name: '上一步' }).click();
  await expect(page.locator('[data-shape-id="r20-label"]')).toHaveCount(0);
  await page.getByRole('button', { name: '上一步' }).click();
  await expect(page.locator('[data-shape-id="r20-arc"]')).toHaveCount(0);
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.locator('[data-shape-id="r20-arc"]')).toHaveCount(1);
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '退出回放' }).click();
  await page.locator('.canvas-controls button').nth(1).click();
  await expect(page.locator('[data-shape-id="offset-v"]')).toHaveCount(0);
  await page.waitForFunction(() => new Promise<boolean>((resolve) => {
    const request = indexedDB.open('mechanical-drawing-board', 1);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('projects', 'readonly').objectStore('projects').get('current');
      read.onsuccess = () => { db.close(); resolve(JSON.parse(read.result).settings.showConstruction === false); };
      read.onerror = () => { db.close(); resolve(false); };
    };
    request.onerror = () => resolve(false);
  }));
  await page.reload();
  await expect(page.locator('[data-shape-id="r20-arc"]')).toHaveCount(1);
  await expect(page.locator('[data-shape-id="offset-v"]')).toHaveCount(0);
  await page.getByRole('button', { name: '文件菜单' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目 JSON' }).click();
  const download = await downloadPromise;
  const project = JSON.parse(readFileSync(await download.path()!, 'utf8'));
  expect(project.steps.length).toBe(10);
  expect(project.settings.showConstruction).toBe(false);
});

test('教师能用两条偏移辅助线手工作出精确 R20 圆弧', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新建空白画板' }).click();
  const canvas = page.locator('svg.drawing-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('画布未显示');
  const clickWorld = async (x: number, y: number) => canvas.click({ position: { x: box.width / 2 + x * 6, y: box.height / 2 - y * 6 } });
  await page.getByRole('button', { name: '直线' }).click();
  await clickWorld(0, -30); await clickWorld(0, 50);
  await clickWorld(-30, 0); await clickWorld(70, 0);
  await page.getByRole('button', { name: '辅助平行线' }).click();
  await clickWorld(0, 35); await clickWorld(30, 30);
  await clickWorld(40, 0); await clickWorld(30, 30);
  await page.getByRole('button', { name: '粗实线' }).click();
  await page.getByRole('button', { name: '圆弧' }).click();
  await clickWorld(20, 20); await clickWorld(0, 20); await clickWorld(20, 0);
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(5);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(4);
  await page.getByRole('button', { name: '重做' }).click();
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(5);
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(5);
  await page.getByRole('button', { name: '文件菜单' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目 JSON' }).click();
  const download = await downloadPromise;
  const project = JSON.parse(readFileSync(await download.path()!, 'utf8'));
  const arc = project.shapes.find((shape: { geometry: { kind: string } }) => shape.geometry.kind === 'arc');
  expect(arc.geometry.center.x).toBeCloseTo(20, 6);
  expect(arc.geometry.center.y).toBeCloseTo(20, 6);
  expect(arc.geometry.radius).toBeCloseTo(20, 6);
});

test('1366×768 下核心控制可见', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: /打开 R20 教学示例/ }).click();
  await expect(page.locator('.tool-rail')).toBeVisible();
  await expect(page.getByRole('button', { name: '尺寸标注' })).toBeVisible();
  await expect(page.getByRole('button', { name: '橡皮擦' })).toBeVisible();
  expect((await page.getByRole('button', { name: '橡皮擦' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.playback-bar')).toBeVisible();
  await expect(page.locator('.style-strip')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.screenshot({ path: 'qa/implementation-1366.png', fullPage: true });
  await page.getByRole('button', { name: '全屏' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole('button', { name: '退出全屏' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  const zoomBefore = await page.locator('.coordinate').textContent();
  await page.locator('svg.drawing-canvas').hover({ position: { x: 600, y: 360 } });
  await page.mouse.wheel(0, -240);
  await expect(page.locator('.coordinate')).not.toHaveText(zoomBefore!);
  await page.getByRole('button', { name: '适合画布' }).click();
  const fitted = await page.locator('[data-shape-id="boundary-v"]').boundingBox();
  const strip = await page.locator('.style-strip').boundingBox();
  expect(fitted && strip && fitted.y > strip.y + strip.height).toBe(true);
});

test('圆、三点圆弧、精确输入和三种导出可用', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新建空白画板' }).click();
  const canvas = page.locator('svg.drawing-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('画布未显示');
  const clickWorld = async (x: number, y: number) => canvas.click({ position: { x: box.width / 2 + x * 6, y: box.height / 2 - y * 6 } });
  await page.getByRole('button', { name: '圆', exact: true }).click();
  await page.getByRole('button', { name: '打开参数面板' }).click();
  await page.locator('.field-label input').fill('25');
  await clickWorld(20, 10); await clickWorld(45, 10);
  await page.getByRole('button', { name: '圆弧', exact: true }).click();
  await page.getByRole('button', { name: '切换三点圆弧' }).click();
  await clickWorld(50, 0); await clickWorld(60, 10); await clickWorld(50, 20);
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(2);

  await page.getByRole('button', { name: '文件菜单' }).click();
  const jsonEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目 JSON' }).click();
  const jsonDownload = await jsonEvent;
  const jsonPath = await jsonDownload.path();
  if (!jsonPath) throw new Error('JSON 下载路径缺失');
  const project = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const circle = project.shapes.find((s: { geometry: { kind: string } }) => s.geometry.kind === 'circle');
  expect(circle.geometry.radius).toBe(25);

  await page.getByRole('button', { name: '文件菜单' }).click();
  const svgEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 SVG' }).click();
  const svgPath = await (await svgEvent).path();
  expect(readFileSync(svgPath!, 'utf8')).toContain('viewBox=');

  await page.getByRole('button', { name: '文件菜单' }).click();
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG' }).click();
  const pngPath = await (await pngEvent).path();
  expect(readFileSync(pngPath!).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(page.getByRole('status')).toContainText('不是有效的 JSON');
  await page.locator('input[type=file]').setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(2);

  const farProject = {
    schemaVersion: 1, unit: 'mm', name: '远处图样', cursor: 1,
    settings: { thickStrokeMm: 0.5, showConstruction: true },
    steps: [{ id: 'far-step', label: '远处直线', timestamp: Date.now(), command: { type: 'create', shape: { id: 'far-line', role: 'geometry', style: 'thick-solid', geometry: { kind: 'line', a: { x: 1000, y: 1000 }, b: { x: 1040, y: 1000 } } } } }],
  };
  await page.locator('input[type=file]').setInputFiles({ name: 'far.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(farProject)) });
  const lineBox = await page.locator('[data-shape-id="far-line"]').boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(lineBox && canvasBox && lineBox.x > canvasBox.x && lineBox.x < canvasBox.x + canvasBox.width).toBe(true);
});

test('触控输入能绘制直线', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true, isMobile: false });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: '新建空白画板' }).click();
  await page.getByRole('button', { name: '直线' }).click();
  const box = await page.locator('svg.drawing-canvas').boundingBox();
  if (!box) throw new Error('画布未显示');
  await page.touchscreen.tap(box.x + box.width / 2 - 60, box.y + box.height / 2);
  await page.touchscreen.tap(box.x + box.width / 2 + 60, box.y + box.height / 2);
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(1);
  await page.getByRole('button', { name: '橡皮擦' }).click();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(2);
  await context.close();
});

test('可直接输入线段、圆、圆弧和平行线的精确坐标与尺寸', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新建空白画板' }).click();
  await page.getByRole('button', { name: '直线' }).click();
  await page.getByLabel('起点 X').fill('0');
  await page.getByLabel('起点 Y').fill('0');
  await page.getByLabel('线段长度').fill('80');
  await page.getByLabel('方向角（°，0 为向右）').fill('0');
  await page.getByRole('button', { name: '按数值绘制' }).click();

  await page.getByRole('button', { name: '圆', exact: true }).click();
  await page.getByLabel('圆心 X').fill('30');
  await page.getByLabel('圆心 Y').fill('35');
  await page.getByLabel('半径 R').fill('12.5');
  await page.getByRole('button', { name: '按数值绘制' }).click();

  await page.getByRole('button', { name: '圆弧', exact: true }).click();
  await page.getByLabel('圆心 X').fill('30');
  await page.getByLabel('圆心 Y').fill('20');
  await page.getByLabel('半径 R').fill('20');
  await page.getByLabel('起始角（°）').fill('180');
  await page.getByLabel('终止角（°）').fill('270');
  await page.getByRole('button', { name: '按数值绘制' }).click();
  await page.screenshot({ path: 'qa/precision.png', fullPage: true });

  await page.getByRole('button', { name: '辅助平行线' }).click();
  const box = await page.locator('svg.drawing-canvas').boundingBox();
  if (!box) throw new Error('画布未显示');
  await page.locator('svg.drawing-canvas').click({ position: { x: box.width / 2 + 40 * 6, y: box.height / 2 } });
  await page.getByLabel('平行距离').fill('17.5');
  await page.getByRole('button', { name: '左侧' }).click();
  await page.getByRole('button', { name: '生成平行线' }).click();
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(4);

  await page.getByRole('button', { name: '文件菜单' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目 JSON' }).click();
  const path = await (await downloaded).path();
  if (!path) throw new Error('JSON 下载路径缺失');
  const project = JSON.parse(readFileSync(path, 'utf8'));
  const line = project.shapes[0].geometry;
  const circle = project.shapes[1].geometry;
  const arc = project.shapes[2].geometry;
  const parallel = project.shapes[3].geometry;
  expect(line.b.x).toBeCloseTo(80, 8);
  expect(circle.center).toEqual({ x: 30, y: 35 });
  expect(circle.radius).toBe(12.5);
  expect(arc.center).toEqual({ x: 30, y: 20 });
  expect(arc.radius).toBe(20);
  expect(parallel.a.y).toBeCloseTo(17.5, 8);
});

test('长度、半径和直径标注可回放并导出', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新建空白画板' }).click();
  const canvas = page.locator('svg.drawing-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('画布未显示');
  const clickWorld = async (x: number, y: number) => canvas.click({ position: { x: box.width / 2 + x * 6, y: box.height / 2 - y * 6 } });
  await page.getByRole('button', { name: '直线' }).click();
  await page.getByLabel('线段长度').fill('80');
  await page.getByRole('button', { name: '按数值绘制' }).click();
  await page.getByRole('button', { name: '圆', exact: true }).click();
  await page.getByLabel('圆心 X').fill('20');
  await page.getByLabel('圆心 Y').fill('30');
  await page.getByLabel('半径 R').fill('15');
  await page.getByRole('button', { name: '按数值绘制' }).click();
  await page.getByRole('button', { name: '尺寸标注' }).click();
  await clickWorld(40, 0); await clickWorld(40, 12);
  await clickWorld(35, 30); await clickWorld(45, 40);
  await page.getByRole('button', { name: '圆标直径' }).click();
  await clickWorld(20, 45); await clickWorld(55, 35);
  await expect(page.locator('.dimension-shape')).toHaveCount(3);
  await expect(page.locator('.dimension-shape')).toContainText(['80 mm', 'R15', '⌀30']);
  await page.getByRole('button', { name: '上一步' }).click();
  await expect(page.locator('.dimension-shape')).toHaveCount(2);
  await page.getByRole('button', { name: '退出回放' }).click();

  await page.getByRole('button', { name: '文件菜单' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 SVG' }).click();
  const path = await (await download).path();
  if (!path) throw new Error('SVG 下载路径缺失');
  const svg = readFileSync(path, 'utf8');
  expect(svg).toContain('80 mm</text>');
  expect(svg).toContain('R15</text>');
  expect(svg).toContain('⌀30</text>');
  await page.screenshot({ path: 'qa/dimensions.png', fullPage: true });
});

test('橡皮擦局部裁剪线段和圆，支持拖动、撤销、回放与恢复', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新建空白画板' }).click();
  const canvas = page.locator('svg.drawing-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('画布未显示');
  const screen = (x: number, y: number) => ({ x: box.x + box.width / 2 + x * 6, y: box.y + box.height / 2 - y * 6 });
  await page.getByRole('button', { name: '直线' }).click();
  await page.getByLabel('线段长度').fill('100');
  await page.getByRole('button', { name: '按数值绘制' }).click();
  await page.getByRole('button', { name: '圆', exact: true }).click();
  await page.getByLabel('圆心 Y').fill('20');
  await page.getByLabel('半径 R').fill('20');
  await page.getByRole('button', { name: '按数值绘制' }).click();
  await page.getByRole('button', { name: '橡皮擦' }).click();
  const from = screen(40, 0); const to = screen(60, 0);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up();
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(3);
  const circlePoint = screen(20, 20);
  await page.mouse.click(circlePoint.x, circlePoint.y);
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(3);
  const arcCount = () => page.locator('svg.drawing-canvas path[data-shape-id]').evaluateAll(nodes => nodes.filter(node => (node.getAttribute('d')?.match(/ A /g)?.length ?? 0) === 1).length);
  await expect.poll(arcCount).toBe(1);
  await page.mouse.move(box.x + box.width - 100, box.y + box.height - 100);
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.screenshot({ path: 'qa/eraser.png', fullPage: true });
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(3);
  await expect.poll(arcCount).toBe(0);
  await page.getByRole('button', { name: '重做' }).click();
  await expect.poll(arcCount).toBe(1);
  await page.getByRole('button', { name: '上一步' }).click();
  await expect.poll(arcCount).toBe(0);
  await page.getByRole('button', { name: '退出回放' }).click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await page.reload();
  await expect.poll(arcCount).toBe(1);

  await page.getByRole('button', { name: '文件菜单' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目 JSON' }).click();
  const path = await (await download).path();
  if (!path) throw new Error('JSON 下载路径缺失');
  const project = JSON.parse(readFileSync(path, 'utf8'));
  expect(project.shapes.filter((s: { geometry: { kind: string } }) => s.geometry.kind === 'line')).toHaveLength(2);
  expect(project.shapes.filter((s: { geometry: { kind: string } }) => s.geometry.kind === 'arc')).toHaveLength(1);
  expect(project.steps.at(-1).command.type).toBe('replace');
});

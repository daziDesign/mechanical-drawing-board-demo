import { expect, test } from '@playwright/test';
import { copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const offlineFile = path.join(demoRoot, 'offline', '机械制图教学画板.html');

test('copied USB HTML opens from file URL and keeps drawings across reloads', async ({ page }, testInfo) => {
  const copiedFile = testInfo.outputPath('机械制图教学画板.html');
  copyFileSync(offlineFile, copiedFile);
  const networkRequests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) networkRequests.push(request.url()); });
  await page.goto(pathToFileURL(copiedFile).href);
  await expect(page.getByRole('button', { name: '新建空白画板' })).toBeVisible();
  await page.getByRole('button', { name: '新建空白画板' }).click();
  await page.getByRole('button', { name: '直线' }).click();
  await page.getByLabel('线段长度').fill('35');
  await page.getByRole('button', { name: '按数值绘制' }).click();
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(1);
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(1);
  await page.getByRole('button', { name: '文件菜单' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目 JSON' }).click();
  const downloaded = await download;
  const savedPath = await downloaded.path();
  if (!savedPath) throw new Error('JSON 下载路径缺失');
  const project = JSON.parse(readFileSync(savedPath, 'utf8'));
  expect(project.shapes[0].geometry.kind).toBe('line');
  await page.getByRole('button', { name: '文件菜单' }).click();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 SVG' }).click();
  expect((await svgDownload).suggestedFilename()).toMatch(/\.svg$/);
  await page.getByRole('button', { name: '文件菜单' }).click();
  const pngDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG' }).click();
  expect((await pngDownload).suggestedFilename()).toMatch(/\.png$/);

  const browser = page.context().browser();
  if (!browser) throw new Error('浏览器实例不可用');
  const anotherComputer = await browser.newContext();
  try {
    const otherPage = await anotherComputer.newPage();
    await otherPage.goto(pathToFileURL(copiedFile).href);
    await expect(otherPage.getByRole('button', { name: '新建空白画板' })).toBeVisible();
    await otherPage.locator('input[type="file"]').setInputFiles(savedPath);
    await expect(otherPage.locator('svg.drawing-canvas path[data-shape-id]')).toHaveCount(1);
  } finally { await anotherComputer.close(); }
  expect(networkRequests).toEqual([]);
});

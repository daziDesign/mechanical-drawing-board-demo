import type { Project } from './types';
import { parseProject } from './history';

const DB = 'mechanical-drawing-board';
const STORE = 'projects';
const KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地保存空间。'));
  });
}

export async function saveProject(project: Project): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(JSON.stringify(project), KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('自动保存失败。'));
    });
  } finally { db.close(); }
}

export async function loadProject(): Promise<Project | null> {
  const db = await openDb();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('读取本地项目失败。'));
    });
    return typeof value === 'string' ? parseProject(value) : null;
  } finally { db.close(); }
}

export function downloadText(text: string, filename: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPng(svg: string, filename: string): Promise<void> {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('PNG 导出失败。'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.min(8192, image.width * 4));
    canvas.height = Math.max(1, Math.min(8192, image.height * 4));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持 PNG 导出。');
    context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG 导出失败。')), 'image/png'));
    const pngUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = pngUrl; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  } finally { URL.revokeObjectURL(url); }
}

import type { LineStyleId } from './types';

export type LineStyle = { id: LineStyleId; name: string; kind: 'solid' | 'dash' | 'wave' | 'zigzag'; thick: boolean; dashMm?: number[]; preview: string };
export const lineStyles: LineStyle[] = [
  { id: 'thick-solid', name: '粗实线', kind: 'solid', thick: true, preview: '━━━━━━━━' },
  { id: 'thin-solid', name: '细实线', kind: 'solid', thick: false, preview: '────────' },
  { id: 'wavy', name: '波浪线', kind: 'wave', thick: false, preview: '∿∿∿∿∿' },
  { id: 'zigzag', name: '双折线', kind: 'zigzag', thick: false, preview: '─⌁─⌁─' },
  { id: 'thin-dashed', name: '细虚线', kind: 'dash', thick: false, dashMm: [4, 2], preview: '╌╌╌╌╌' },
  { id: 'thick-dashed', name: '粗虚线', kind: 'dash', thick: true, dashMm: [4, 2], preview: '╍╍╍╍╍' },
  { id: 'thin-dash-dot', name: '细点画线', kind: 'dash', thick: false, dashMm: [9, 2, 0.3, 2], preview: '─·─·─' },
  { id: 'thick-dash-dot', name: '粗点画线', kind: 'dash', thick: true, dashMm: [9, 2, 0.3, 2], preview: '━·━·━' },
  { id: 'thin-dash-double-dot', name: '细双点画线', kind: 'dash', thick: false, dashMm: [9, 2, 0.3, 2, 0.3, 2], preview: '─··─··' },
];
export const getLineStyle = (id: LineStyleId) => lineStyles.find(s => s.id === id)!;
export const screenStrokePx = (id: LineStyleId) => getLineStyle(id).thick ? 2.5 : 1.25;
export const printStrokeMm = (id: LineStyleId, thickStrokeMm: number) => getLineStyle(id).thick ? thickStrokeMm : thickStrokeMm / 2;

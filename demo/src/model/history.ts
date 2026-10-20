import type { DrawingCommand, Materialized, Point, Project, Shape, Step } from './types';

export const blankProject = (name = '未命名画板'): Project => ({
  schemaVersion: 1, unit: 'mm', name, shapes: [], steps: [], cursor: 0,
  settings: { thickStrokeMm: 0.5, showConstruction: true },
});

export function materialize(steps: Step[], cursor = steps.length): Materialized {
  let shapes: Shape[] = [];
  let showConstruction = true;
  for (const step of steps.slice(0, cursor)) {
    const c = step.command;
    if (c.type === 'create') shapes = [...shapes, c.shape];
    else if (c.type === 'delete') shapes = shapes.filter(shape => shape.id !== c.id);
    else if (c.type === 'style') shapes = shapes.map(shape => shape.id === c.id ? { ...shape, style: c.style } : shape);
    else if (c.type === 'replace') shapes = [...shapes.filter(shape => !c.removeIds.includes(shape.id)), ...c.addShapes];
    else showConstruction = c.visible;
  }
  return { shapes, showConstruction };
}

export function addCommand(project: Project, command: DrawingCommand, label: string): Project {
  const steps = [
    ...project.steps.slice(0, project.cursor),
    { id: crypto.randomUUID(), label, command, timestamp: Date.now() },
  ];
  const state = materialize(steps);
  return { ...project, steps, cursor: steps.length, shapes: state.shapes, settings: { ...project.settings, showConstruction: state.showConstruction } };
}

export function moveCursor(project: Project, cursor: number): Project {
  const next = Math.max(0, Math.min(project.steps.length, cursor));
  const state = materialize(project.steps, next);
  return { ...project, cursor: next, shapes: state.shapes, settings: { ...project.settings, showConstruction: state.showConstruction } };
}

const isPoint = (value: unknown): value is Point => {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y);
};
const styles = new Set(['thick-solid', 'thin-solid', 'wavy', 'zigzag', 'thin-dashed', 'thick-dashed', 'thin-dash-dot', 'thick-dash-dot', 'thin-dash-double-dot']);
const isShape = (value: unknown): value is Shape => {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  if (typeof s.id !== 'string' || !styles.has(String(s.style)) || !['geometry', 'construction', 'annotation'].includes(String(s.role))) return false;
  const g = s.geometry as Record<string, unknown> | undefined;
  if (!g) return false;
  if (g.kind === 'line') return isPoint(g.a) && isPoint(g.b);
  if (g.kind === 'circle') return isPoint(g.center) && typeof g.radius === 'number' && Number.isFinite(g.radius) && g.radius > 0;
  if (g.kind === 'arc') return isPoint(g.center) && typeof g.radius === 'number' && Number.isFinite(g.radius) && g.radius > 0 && typeof g.startAngle === 'number' && Number.isFinite(g.startAngle) && typeof g.sweepAngle === 'number' && Number.isFinite(g.sweepAngle) && Math.abs(g.sweepAngle) > 0 && Math.abs(g.sweepAngle) <= Math.PI * 2;
  if (g.kind === 'marker') return isPoint(g.point) && typeof g.label === 'string' && g.label.length < 80;
  if (g.kind === 'callout') return isPoint(g.target) && isPoint(g.elbow) && isPoint(g.end) && typeof g.label === 'string' && g.label.length < 80;
  if (g.kind === 'dimension') {
    if (g.mode === 'linear') return isPoint(g.a) && isPoint(g.b) && typeof g.offset === 'number' && Number.isFinite(g.offset) && Math.hypot(g.a.x - g.b.x, g.a.y - g.b.y) > 1e-8;
    if (g.mode === 'radius' || g.mode === 'diameter') return isPoint(g.center) && isPoint(g.edge) && isPoint(g.labelPoint) && typeof g.value === 'number' && Number.isFinite(g.value) && g.value > 0;
  }
  return false;
};
const isCommand = (value: unknown): value is DrawingCommand => {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (c.type === 'create') return isShape(c.shape);
  if (c.type === 'delete') return typeof c.id === 'string';
  if (c.type === 'style') return typeof c.id === 'string' && styles.has(String(c.style));
  if (c.type === 'replace') return Array.isArray(c.removeIds) && c.removeIds.length <= 10000 && c.removeIds.every((id: unknown) => typeof id === 'string') && Array.isArray(c.addShapes) && c.addShapes.length <= 10000 && c.addShapes.every(isShape);
  if (c.type === 'constructionVisibility') return typeof c.visible === 'boolean';
  return false;
};

export function parseProject(json: string): Project {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('文件不是有效的 JSON。'); }
  if (!raw || typeof raw !== 'object') throw new Error('项目格式无效。');
  const p = raw as Record<string, unknown>;
  if (p.schemaVersion !== 1 || p.unit !== 'mm') throw new Error('项目版本或单位不受支持。');
  if (!Array.isArray(p.steps) || !Number.isInteger(p.cursor) || (p.cursor as number) < 0 || (p.cursor as number) > p.steps.length || p.steps.length > 10000) throw new Error('项目步骤无效。');
  if (!p.steps.every((s: unknown) => {
    if (!s || typeof s !== 'object') return false;
    const step = s as Record<string, unknown>;
    return typeof step.id === 'string' && typeof step.label === 'string' && step.label.length < 200 && typeof step.timestamp === 'number' && isCommand(step.command);
  })) throw new Error('项目包含无效的作图命令。');
  const settings = p.settings as Record<string, unknown> | undefined;
  if (!settings || typeof settings.thickStrokeMm !== 'number' || settings.thickStrokeMm <= 0 || settings.thickStrokeMm > 2) throw new Error('项目线宽设置无效。');
  const name = typeof p.name === 'string' && p.name.length <= 120 ? p.name : '导入的画板';
  const steps = p.steps as Step[];
  const state = materialize(steps, p.cursor as number);
  return { schemaVersion: 1, unit: 'mm', name, steps, cursor: p.cursor as number, shapes: state.shapes, settings: { thickStrokeMm: settings.thickStrokeMm, showConstruction: state.showConstruction } };
}

export function demoProject(): Project {
  let p = blankProject('R20 两直线圆弧连接');
  const make = (id: string, role: Shape['role'], geometry: Shape['geometry'], style: Shape['style'] = 'thin-solid'): Shape => ({ id, role, geometry, style });
  const create = (shape: Shape, label: string) => { p = addCommand(p, { type: 'create', shape }, label); };
  create(make('boundary-v', 'geometry', { kind: 'line', a: { x: 0, y: 0 }, b: { x: 0, y: 48 } }, 'thick-solid'), '绘制竖直已知直线');
  create(make('boundary-h', 'geometry', { kind: 'line', a: { x: 0, y: 0 }, b: { x: 48, y: 0 } }, 'thick-solid'), '绘制水平已知直线');
  create(make('offset-v', 'construction', { kind: 'line', a: { x: 20, y: 0 }, b: { x: 20, y: 44 } }), '向内偏移 20 mm，作竖直辅助线');
  create(make('offset-h', 'construction', { kind: 'line', a: { x: 0, y: 20 }, b: { x: 44, y: 20 } }), '向内偏移 20 mm，作水平辅助线');
  create(make('center-o', 'annotation', { kind: 'marker', point: { x: 20, y: 20 }, label: 'O' }), '两辅助线交点为圆心 O');
  create(make('tangent-1', 'annotation', { kind: 'marker', point: { x: 0, y: 20 }, label: 'T1' }), '确定切点 T1');
  create(make('tangent-2', 'annotation', { kind: 'marker', point: { x: 20, y: 0 }, label: 'T2' }), '确定切点 T2');
  create(make('r20-arc', 'geometry', { kind: 'arc', center: { x: 20, y: 20 }, radius: 20, startAngle: Math.PI, sweepAngle: Math.PI / 2 }, 'thick-solid'), '以 O 为圆心绘制 R20 圆弧');
  create(make('r20-label', 'annotation', { kind: 'callout', target: { x: 20 + 20 * Math.cos(1.18 * Math.PI), y: 20 + 20 * Math.sin(1.18 * Math.PI) }, elbow: { x: 8, y: 29 }, end: { x: 15, y: 29 }, label: 'R20' }), '标明连接圆弧半径 R20');
  return p;
}

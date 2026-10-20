import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import {
  ArrowClockwise, ArrowCounterClockwise, ArrowsOut, CaretDown, CaretLeft, CaretRight,
  Circle, Cursor, DownloadSimple, Eye, EyeSlash, FloppyDisk, FolderOpen, Hand,
  Minus, Pause, Play, Plus, Ruler, SlidersHorizontal, Trash, X,
} from '@phosphor-icons/react';
import { addCommand, blankProject, demoProject, materialize, moveCursor, parseProject } from './model/history';
import { angleOf, arcContains, arcThroughThreePoints, distance, nearestOnLine, nearestSnap, offsetLine, polar, positiveAngle, snapCandidates } from './model/geometry';
import { dimensionLayout, makeDimension } from './model/dimensions';
import { getLineStyle, lineStyles } from './model/lineStyles';
import { arrowTriangle, generateSvg, screenStyle, shapeBounds, shapePath } from './model/renderSvg';
import { downloadPng, downloadText, loadProject, saveProject } from './model/storage';
import type { Geometry, LineStyleId, Point, Project, Shape } from './model/types';

type Tool = 'select' | 'line' | 'circle' | 'arc-center' | 'arc-three' | 'offset' | 'dimension' | 'hand';
type Camera = { x: number; y: number; scale: number };
const iconTools = [
  { id: 'select', label: '选择', Icon: Cursor },
  { id: 'line', label: '直线', Icon: Minus },
  { id: 'circle', label: '圆', Icon: Circle },
  { id: 'arc-center', label: '圆弧', Icon: ArrowClockwise },
  { id: 'offset', label: '辅助平行线', Icon: SlidersHorizontal },
  { id: 'dimension', label: '尺寸标注', Icon: Ruler },
  { id: 'hand', label: '平移', Icon: Hand },
] as const;
const freshId = () => crypto.randomUUID();
const sampleCamera = (width: number, height: number): Camera => {
  const bottom = Math.max(90, Math.min(160, height * 0.17));
  const scale = Math.max(4, Math.min(12, (height - bottom - 165) / 48));
  return { x: width * 0.13 / scale, y: (height / 2 - bottom) / scale, scale };
};
const fitCamera = (shapes: Shape[], width: number, height: number): Camera => {
  if (!shapes.length) return { x: 0, y: 0, scale: 6 };
  const b = shapeBounds(shapes);
  const topClearance = 165; const bottomClearance = 45;
  const extentWidth = Math.max(30, b.maxX - b.minX + 24);
  const extentHeight = Math.max(25, b.maxY - b.minY + 24);
  const scale = Math.max(1, Math.min(14, Math.min(width / extentWidth, (height - topClearance - bottomClearance) / extentHeight)));
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 + (topClearance - bottomClearance) / (2 * scale), scale };
};

function hitShape(point: Point, shapes: Shape[], scale: number): Shape | null {
  let best: Shape | null = null;
  let bestPx = 12;
  for (const shape of shapes) {
    const g = shape.geometry;
    let px = Infinity;
    if (g.kind === 'line') px = distance(point, nearestOnLine(point, g)) * scale;
    else if (g.kind === 'circle') px = Math.abs(distance(point, g.center) - g.radius) * scale;
    else if (g.kind === 'arc' && arcContains(g, point)) px = Math.abs(distance(point, g.center) - g.radius) * scale;
    else if (g.kind === 'marker') px = distance(point, g.point) * scale;
    else if (g.kind === 'callout') px = distance(point, g.elbow) * scale;
    else if (g.kind === 'dimension') px = distance(point, dimensionLayout(g).label) * scale;
    if (px < bestPx) { best = shape; bestPx = px; }
  }
  return best;
}

export function App() {
  const [project, setProject] = useState<Project>(() => blankProject());
  const [ready, setReady] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [styleId, setStyleId] = useState<LineStyleId>('thin-solid');
  const [construction, setConstruction] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [draft, setDraft] = useState<Point[]>([]);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [snapLabel, setSnapLabel] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offsetId, setOffsetId] = useState<string | null>(null);
  const [dimensionSourceId, setDimensionSourceId] = useState<string | null>(null);
  const [dimensionDiameter, setDimensionDiameter] = useState(false);
  const [numeric, setNumeric] = useState('');
  const [exactX, setExactX] = useState('0');
  const [exactY, setExactY] = useState('0');
  const [exactAngle, setExactAngle] = useState('0');
  const [exactStart, setExactStart] = useState('180');
  const [exactEnd, setExactEnd] = useState('270');
  const [offsetSide, setOffsetSide] = useState<'left' | 'right'>('left');
  const [clockwise, setClockwise] = useState(false);
  const [panel, setPanel] = useState(false);
  const [fileMenu, setFileMenu] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState('待保存');
  const [playback, setPlayback] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [space, setSpace] = useState(false);
  const [camera, setCamera] = useState<Camera>(() => sampleCamera(1200, 700));
  const [size, setSize] = useState({ width: 1200, height: 700 });
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);
  const dragRef = useRef<{ x: number; y: number; camera: Camera } | null>(null);
  const cameraTouched = useRef(false);
  const editing = playback === null;
  const state = useMemo(() => editing ? { shapes: project.shapes, showConstruction: project.settings.showConstruction } : materialize(project.steps, playback), [editing, project, playback]);
  const visibleShapes = useMemo(() => state.shapes.filter(s => s.role !== 'construction' || state.showConstruction), [state]);
  const candidates = useMemo(() => snapCandidates(visibleShapes), [visibleShapes]);
  const selected = state.shapes.find(s => s.id === selectedId);

  const message = useCallback((value: string) => {
    setNotice(value);
    window.setTimeout(() => setNotice(''), 3500);
  }, []);
  useEffect(() => {
    loadProject().then(saved => {
      if (saved) { setProject(saved); setReady(true); }
      else setWelcome(true);
    }).catch(error => { setWelcome(true); message(error instanceof Error ? error.message : '本地项目读取失败。'); });
  }, [message]);
  useEffect(() => {
    if (!ready) return;
    const version = ++saveVersion.current;
    setSaveStatus('保存中');
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveProject(project));
    saveQueue.current.then(() => {
      if (version === saveVersion.current) setSaveStatus('已保存');
    }).catch(error => {
      if (version !== saveVersion.current) return;
      setSaveStatus('保存失败');
      message(error instanceof Error ? error.message : '自动保存失败。');
    });
  }, [project, ready, message]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: box.width, height: box.height });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (ready && !cameraTouched.current) setCamera(project.name === 'R20 两直线圆弧连接'
      ? sampleCamera(size.width, size.height)
      : fitCamera(project.shapes, size.width, size.height));
  }, [ready, project.name, size]);
  useEffect(() => {
    if (!playing || playback === null) return;
    if (playback >= project.steps.length) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setPlayback(n => n === null ? null : n + 1), 1050);
    return () => window.clearTimeout(timer);
  }, [playing, playback, project.steps.length]);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const map = useCallback((p: Point): Point => ({
    x: size.width / 2 + (p.x - camera.x) * camera.scale,
    y: size.height / 2 - (p.y - camera.y) * camera.scale,
  }), [camera, size]);
  const unmap = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: camera.x + (clientX - rect.left - size.width / 2) / camera.scale,
      y: camera.y - (clientY - rect.top - size.height / 2) / camera.scale,
    };
  }, [camera, size]);
  const snapped = (point: Point, shift: boolean): Point => {
    let next = point;
    if (shift && tool === 'line' && draft.length) {
      const first = draft[0];
      next = Math.abs(point.x - first.x) > Math.abs(point.y - first.y)
        ? { x: point.x, y: first.y } : { x: first.x, y: point.y };
    }
    const candidate = snapOn ? nearestSnap(next, candidates, camera.scale) : null;
    setSnapLabel(candidate?.label ?? '');
    return candidate?.point ?? next;
  };
  const changeTool = (next: Tool) => {
    setTool(next); setDraft([]); setOffsetId(null); setDimensionSourceId(null); setNumeric(next === 'offset' ? '20' : ''); setSnapLabel('');
  };
  const exactValue = (value: string, label: string, positive = false): number | null => {
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n) || Math.abs(n) > 100000 || (positive && n <= 0)) {
      message('请输入有效的' + label + '。'); return null;
    }
    return n;
  };
  const makeExact = () => {
    if (!editing) return;
    const amount = exactValue(numeric, tool === 'offset' ? '偏移距离' : tool === 'line' ? '长度' : '半径', true);
    if (amount === null) return;
    if (tool === 'offset') {
      const source = visibleShapes.find(s => s.id === offsetId);
      if (!source || source.geometry.kind !== 'line') { message('先在画布中选择要偏移的直线。'); return; }
      const { a, b } = source.geometry;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const sidePoint = offsetSide === 'left' ? { x: mid.x - (b.y - a.y), y: mid.y + (b.x - a.x) } : { x: mid.x + (b.y - a.y), y: mid.y - (b.x - a.x) };
      const line = offsetLine(source.geometry, amount, sidePoint);
      if (!line) { message('无法偏移零长度直线。'); return; }
      commit(line, '平行偏移 ' + amount + ' mm', 'construction', 'thin-solid'); setOffsetId(null); return;
    }
    const x = exactValue(exactX, 'X 坐标'); const y = exactValue(exactY, 'Y 坐标');
    if (x === null || y === null) return;
    const origin = { x, y };
    if (tool === 'line') {
      const degrees = exactValue(exactAngle, '方向角'); if (degrees === null) return;
      const end = polar(origin, amount, degrees * Math.PI / 180);
      commit({ kind: 'line', a: origin, b: end }, '精确直线 ' + amount + ' mm');
    } else if (tool === 'circle') commit({ kind: 'circle', center: origin, radius: amount }, '精确圆 R' + amount);
    else if (tool === 'arc-center') {
      const start = exactValue(exactStart, '起始角'); const end = exactValue(exactEnd, '终止角');
      if (start === null || end === null) return;
      const a = start * Math.PI / 180; const b = end * Math.PI / 180;
      const sweep = clockwise ? -positiveAngle(a - b) : positiveAngle(b - a);
      if (sweep < 0.005 && sweep > -0.005) { message('起始角和终止角不能相同。'); return; }
      commit({ kind: 'arc', center: origin, radius: amount, startAngle: a, sweepAngle: sweep }, '精确圆弧 R' + amount);
    }
    setDraft([]);
  };
  const commit = (geometry: Geometry, label: string, role: Shape['role'] = construction ? 'construction' : 'geometry', selectedStyle = styleId) => {
    setProject(current => addCommand(current, { type: 'create', shape: { id: freshId(), role, style: selectedStyle, geometry } }, label));
    setSelectedId(null);
  };
  const fit = useCallback(() => {
    cameraTouched.current = true;
    setCamera(fitCamera(visibleShapes, size.width, size.height));
  }, [visibleShapes, size]);
  const applyPoint = (point: Point) => {
    if (!editing) return;
    if (tool === 'select') { setSelectedId(hitShape(point, visibleShapes, camera.scale)?.id ?? null); return; }
    if (tool === 'hand') return;
    if (tool === 'dimension') {
      if (!dimensionSourceId) {
        const hit = hitShape(point, visibleShapes.filter(s => ['line', 'circle', 'arc'].includes(s.geometry.kind)), camera.scale);
        if (!hit) { message('先点选要标注的线段、圆或圆弧。'); return; }
        setDimensionSourceId(hit.id); message('再点标注文字的放置位置。'); return;
      }
      const source = visibleShapes.find(s => s.id === dimensionSourceId);
      if (!source || !['line', 'circle', 'arc'].includes(source.geometry.kind)) { setDimensionSourceId(null); return; }
      const geometry = source.geometry as Extract<Geometry, { kind: 'line' | 'circle' | 'arc' }>;
      const annotation = makeDimension(geometry, point, dimensionDiameter);
      if (annotation) commit(annotation, '添加尺寸标注', 'annotation', 'thin-solid');
      setDimensionSourceId(null); return;
    }
    if (tool === 'offset') {
      if (!offsetId) {
        const hit = hitShape(point, visibleShapes, camera.scale);
        if (!hit || hit.geometry.kind !== 'line') { message('先选择一条直线。'); return; }
        setOffsetId(hit.id); message('再单击直线目标一侧，确定偏移方向。'); return;
      }
      const source = visibleShapes.find(s => s.id === offsetId);
      if (!source || source.geometry.kind !== 'line') { setOffsetId(null); return; }
      const amount = Number(numeric || 20);
      const offset = offsetLine(source.geometry, amount, point);
      if (!offset) { message('偏移距离必须大于 0。'); return; }
      commit(offset, '平行偏移 ' + amount + ' mm', 'construction', 'thin-solid');
      setOffsetId(null);
      return;
    }
    if (draft.length === 0) { setDraft([point]); setExactX(String(Number(point.x.toFixed(3)))); setExactY(String(Number(point.y.toFixed(3)))); return; }
    const first = draft[0];
    if (tool === 'line') {
      let end = point;
      if (numeric) {
        const length = Number(numeric);
        if (!Number.isFinite(length) || length <= 0 || length > 100000) { message('请输入有效长度。'); return; }
        const d = distance(first, point);
        end = d < 1e-8 ? { x: first.x + length, y: first.y } : {
          x: first.x + (point.x - first.x) * length / d,
          y: first.y + (point.y - first.y) * length / d,
        };
      }
      if (distance(first, end) < 1e-6) { message('起点与终点不能重合。'); return; }
      commit({ kind: 'line', a: first, b: end }, '绘制直线');
      setDraft([]); setNumeric('');
    } else if (tool === 'circle') {
      const radius = numeric ? Number(numeric) : distance(first, point);
      if (!Number.isFinite(radius) || radius <= 0 || radius > 100000) { message('请输入有效半径。'); return; }
      commit({ kind: 'circle', center: first, radius }, '绘制 R' + radius + ' 圆');
      setDraft([]); setNumeric('');
    } else if (tool === 'arc-center') {
      if (draft.length === 1) {
        const radius = numeric ? Number(numeric) : distance(first, point);
        if (!Number.isFinite(radius) || radius <= 0 || radius > 100000) { message('请输入有效半径。'); return; }
        setDraft([first, polar(first, radius, angleOf(first, point))]);
        setExactStart(String(Number((angleOf(first, point) * 180 / Math.PI).toFixed(3))));
      } else {
        const start = angleOf(first, draft[1]);
        const end = angleOf(first, point);
        const sweep = clockwise ? -positiveAngle(start - end) : positiveAngle(end - start);
        if (Math.abs(sweep) < 0.005) { message('圆弧起点和终点不能重合。'); return; }
        commit({ kind: 'arc', center: first, radius: distance(first, draft[1]), startAngle: start, sweepAngle: sweep }, '绘制圆心圆弧');
        setDraft([]); setNumeric('');
      }
    } else if (tool === 'arc-three') {
      if (draft.length === 1) setDraft([first, point]);
      else {
        const arc = arcThroughThreePoints(first, draft[1], point);
        if (!arc) { message('三点不能在同一直线上。'); return; }
        commit(arc, '绘制三点圆弧');
        setDraft([]);
      }
    }
  };
  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button === 2) { changeTool('select'); return; }
    if (event.button === 1 || space || tool === 'hand') {
      cameraTouched.current = true;
      dragRef.current = { x: event.clientX, y: event.clientY, camera };
      event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    const point = snapped(unmap(event.clientX, event.clientY), event.shiftKey);
    setPointer(point); applyPoint(point);
  };
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      const drag = dragRef.current;
      setCamera({ ...drag.camera, x: drag.camera.x - (event.clientX - drag.x) / drag.camera.scale, y: drag.camera.y + (event.clientY - drag.y) / drag.camera.scale });
      return;
    }
    setPointer(snapped(unmap(event.clientX, event.clientY), event.shiftKey));
  };
  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const wheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    cameraTouched.current = true;
    const point = unmap(event.clientX, event.clientY);
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = event.clientX - rect.left - size.width / 2;
    const my = event.clientY - rect.top - size.height / 2;
    const scale = Math.max(0.75, Math.min(60, camera.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
    setCamera({ x: point.x - mx / scale, y: point.y + my / scale, scale });
  };
  const changeStyle = (next: LineStyleId) => {
    setStyleId(next);
    if (editing && selected && selected.role !== 'annotation') setProject(current => addCommand(current, { type: 'style', id: selected.id, style: next }, '改为' + getLineStyle(next).name));
    else if (editing && selected?.role === 'annotation') message('标注保持实线；已更新新图元的线型。');
  };
  const undo = () => { if (editing) setProject(current => moveCursor(current, current.cursor - 1)); };
  const redo = () => { if (editing) setProject(current => moveCursor(current, current.cursor + 1)); };
  const removeSelected = () => {
    if (editing && selectedId) {
      setProject(current => addCommand(current, { type: 'delete', id: selectedId }, '删除图元'));
      setSelectedId(null);
    }
  };
  const toggleGuides = () => {
    if (editing) setProject(current => addCommand(current, { type: 'constructionVisibility', visible: !current.settings.showConstruction }, current.settings.showConstruction ? '隐藏辅助线' : '显示辅助线'));
  };
  const start = (sample: boolean) => {
    setProject(sample ? demoProject() : blankProject());
    cameraTouched.current = !sample;
    setCamera(sample ? sampleCamera(size.width, size.height) : { x: 0, y: 0, scale: 6 });
    setReady(true); setWelcome(false); setPlayback(null); setPlaying(false); setDraft([]); setSelectedId(null); setDimensionSourceId(null);
    message(sample ? '已载入可编辑的 R20 示例。' : '已创建空白画板。');
  };
  const exportFile = async (kind: 'json' | 'svg' | 'png') => {
    setFileMenu(false);
    try {
      if (kind === 'json') downloadText(JSON.stringify(project, null, 2), project.name + '.json', 'application/json');
      else {
        const viewport = {
          minX: camera.x - size.width / (2 * camera.scale), maxX: camera.x + size.width / (2 * camera.scale),
          minY: camera.y - size.height / (2 * camera.scale), maxY: camera.y + size.height / (2 * camera.scale),
        };
        const svg = generateSvg(state.shapes, state.showConstruction, project.settings.thickStrokeMm, viewport);
        if (kind === 'svg') downloadText(svg, project.name + '.svg', 'image/svg+xml');
        else await downloadPng(svg, project.name + '.png');
      }
      message('已导出 ' + kind.toUpperCase() + '。');
    } catch (error) { message(error instanceof Error ? error.message : '导出失败。'); }
  };
  const importFile = async (file: File) => {
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('项目文件不能超过 10 MB。');
      const next = parseProject(await file.text());
      setProject(next); setReady(true); setWelcome(false); setFileMenu(false); setPlayback(null); setDraft([]); setSelectedId(null); setDimensionSourceId(null);
      cameraTouched.current = false;
      setCamera(next.name === 'R20 两直线圆弧连接' ? sampleCamera(size.width, size.height) : fitCamera(next.shapes, size.width, size.height));
      message('项目已载入。');
    } catch (error) { message(error instanceof Error ? error.message : '载入失败。'); }
  };
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
      if (event.code === 'Space' && !typing) { event.preventDefault(); setSpace(true); }
      if (event.key === 'Escape') {
        setDraft([]); setOffsetId(null); setDimensionSourceId(null); setFileMenu(false);
        if (playback !== null) { setPlayback(null); setPlaying(false); }
        else changeTool('select');
      }
      if (typing) return;
      if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (event.key === 'Delete' || event.key === 'Backspace') removeSelected();
      else if (editing && !event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === 'v') changeTool('select');
        else if (key === 'l') changeTool('line');
        else if (key === 'c') changeTool('circle');
        else if (key === 'a') changeTool('arc-center');
        else if (key === 'h') toggleGuides();
        else if (key === 'f') fit();
      }
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') setSpace(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  const preview = useMemo(() => {
    if (!pointer || !draft.length || !editing) return null;
    const first = draft[0];
    let geometry: Geometry | null = null;
    if (tool === 'line') geometry = { kind: 'line', a: first, b: pointer };
    else if (tool === 'circle') geometry = { kind: 'circle', center: first, radius: numeric && Number(numeric) > 0 ? Number(numeric) : distance(first, pointer) };
    else if (tool === 'arc-center' && draft.length === 1) geometry = { kind: 'line', a: first, b: pointer };
    else if (tool === 'arc-center' && draft.length === 2) {
      const start = angleOf(first, draft[1]); const end = angleOf(first, pointer);
      geometry = { kind: 'arc', center: first, radius: distance(first, draft[1]), startAngle: start, sweepAngle: clockwise ? -positiveAngle(start - end) : positiveAngle(end - start) };
    } else if (tool === 'arc-three' && draft.length === 1) geometry = { kind: 'line', a: first, b: pointer };
    else if (tool === 'arc-three' && draft.length === 2) geometry = arcThroughThreePoints(first, draft[1], pointer);
    if (!geometry || (geometry.kind === 'arc' && Math.abs(geometry.sweepAngle) < 0.005) || (geometry.kind === 'circle' && geometry.radius < 0.01)) return null;
    return shapePath({ id: 'preview', role: 'construction', style: styleId, geometry }, map, 'screen');
  }, [pointer, draft, editing, tool, numeric, clockwise, styleId, map]);
  const offsetPreview = useMemo(() => {
    const source = visibleShapes.find(s => s.id === offsetId);
    if (!pointer || !source || source.geometry.kind !== 'line') return null;
    const line = offsetLine(source.geometry, Number(numeric || 20), pointer);
    return line ? shapePath({ id: 'offset-preview', role: 'construction', style: 'thin-solid', geometry: line }, map, 'screen') : null;
  }, [pointer, offsetId, visibleShapes, numeric, map]);
  const hint = tool === 'line' ? (draft.length ? '单击终点；可输入精确长度，Shift 约束水平或垂直。' : '单击起点，再单击终点。')
    : tool === 'circle' ? (draft.length ? '单击确定半径，或在参数中输入精确半径。' : '单击圆心。')
    : tool === 'arc-center' ? ['单击圆心。', '单击起点，可输入半径。', '单击终点完成圆弧。'][Math.min(draft.length, 2)]
    : tool === 'arc-three' ? ['单击圆弧起点。', '单击经过点。', '单击圆弧终点。'][Math.min(draft.length, 2)]
    : tool === 'offset' ? (offsetId ? '单击目标一侧，生成平行辅助线。' : '单击要偏移的直线。')
    : tool === 'dimension' ? (dimensionSourceId ? '点击标注文字的放置位置。' : '点击要标注的线段、圆或圆弧。')
    : tool === 'hand' ? '拖动画布，滚轮缩放。' : '选择图元后可修改线型或删除。';

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div><strong>机械制图教学画板</strong><small>{project.name}</small></div></div>
      <div className="top-actions">
        <div className="menu-wrap">
          <button className="top-button" aria-label="文件菜单" onClick={() => setFileMenu(v => !v)}><FolderOpen size={19}/> 文件 <CaretDown size={13}/></button>
          {fileMenu && <div className="file-menu">
            <button onClick={() => { setFileMenu(false); if (window.confirm('新建画板会替换当前自动保存项目。建议先导出 JSON。继续吗？')) start(false); }}><Plus size={18}/> 新建空白画板</button>
            <button onClick={() => { setFileMenu(false); if (window.confirm('载入示例会替换当前自动保存项目。建议先导出 JSON。继续吗？')) start(true); }}><Circle size={18}/> 载入 R20 示例</button>
            <button onClick={() => fileRef.current?.click()}><FolderOpen size={18}/> 打开项目 JSON</button>
            <div className="menu-divider"/>
            <button onClick={() => exportFile('json')}><FloppyDisk size={18}/> 保存项目 JSON</button>
            <button onClick={() => exportFile('svg')}><DownloadSimple size={18}/> 导出 SVG</button>
            <button onClick={() => exportFile('png')}><DownloadSimple size={18}/> 导出 PNG</button>
          </div>}
        </div>
        <button className="top-button" aria-label="撤销" disabled={!editing || project.cursor === 0} onClick={undo}><ArrowCounterClockwise size={19}/> 撤销</button>
        <button className="top-button" aria-label="重做" disabled={!editing || project.cursor === project.steps.length} onClick={redo}><ArrowClockwise size={19}/> 重做</button>
        <span className="top-divider"/>
        <button className="top-button" onClick={fit}><ArrowsOut size={18}/> 适合画布</button>
        <button className="top-button" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}><ArrowsOut size={18}/> {fullscreen ? '退出全屏' : '全屏'}</button>
      </div>
      <div className="top-right"><span className="save-dot"/><span className="save-status">{saveStatus}</span><button className="save-button" onClick={() => exportFile('json')}><FloppyDisk size={19}/> 保存</button></div>
    </header>
    <div className="main-row">
      <aside className="tool-rail" aria-label="绘图工具">
        {iconTools.map(({ id, label, Icon }) => <button key={id} className={'tool-button ' + (tool === id ? 'active' : '')} aria-label={label} title={label} disabled={!editing} onClick={() => changeTool(id)}><Icon size={31}/><span>{label}</span></button>)}
        <div className="rail-spacer"/>
        <button className="tool-button" aria-label="删除所选图元" disabled={!editing || !selectedId} onClick={removeSelected}><Trash size={24}/><span>删除</span></button>
      </aside>
      <main className="canvas-area">
        <div className="style-strip"><div className="style-head"><strong>线型</strong><small>选择后用于新图元</small></div>
          <div className="style-options">{lineStyles.map(line => <button key={line.id} className={'style-choice ' + (styleId === line.id ? 'active' : '')} aria-label={line.name} title={line.name} onClick={() => changeStyle(line.id)}>
            <svg width="62" height="18" viewBox="0 0 62 18" aria-hidden="true"><path d={shapePath({ id: line.id, role: 'geometry', style: line.id, geometry: { kind: 'line', a: { x: 1, y: 9 }, b: { x: 61, y: 9 } } }, p => p, 'screen')} fill="none" stroke="#1c222b" strokeWidth={line.thick ? 2.5 : 1.3} strokeDasharray={line.dashMm?.map(v => v * 2).join(' ')}/></svg>
            <span>{line.name}</span></button>)}</div>
        </div>
        <div className="canvas-controls">
          <button className={construction ? 'selected' : ''} onClick={() => setConstruction(v => !v)}>辅助作图 {construction ? '开' : '关'}</button>
          <button onClick={toggleGuides}>{state.showConstruction ? <Eye size={16}/> : <EyeSlash size={16}/>} 辅助线</button>
          <button onClick={() => setSnapOn(v => !v)}>捕捉 {snapOn ? '开' : '关'}</button>
        </div>
        {editing && ['line', 'circle', 'arc-center', 'offset'].includes(tool) && <div className="precision-card" aria-label="精确作图">
          <div className="precision-title"><strong>精确作图</strong><span>单位 mm</span></div>
          {tool !== 'offset' && <div className="precision-grid">
            <label>{tool === 'line' ? '起点 X' : '圆心 X'}<input type="number" step="any" value={exactX} onChange={event => setExactX(event.target.value)}/></label>
            <label>{tool === 'line' ? '起点 Y' : '圆心 Y'}<input type="number" step="any" value={exactY} onChange={event => setExactY(event.target.value)}/></label>
          </div>}
          <label className="precision-wide">{tool === 'line' ? '线段长度' : tool === 'offset' ? '平行距离' : '半径 R'}<input type="number" min="0.001" step="any" placeholder={tool === 'offset' ? '20' : '输入毫米值'} value={numeric} onChange={event => setNumeric(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') makeExact(); }}/></label>
          {tool === 'line' && <label className="precision-wide">方向角（°，0 为向右）<input type="number" step="any" value={exactAngle} onChange={event => setExactAngle(event.target.value)}/></label>}
          {tool === 'arc-center' && <><div className="precision-grid"><label>起始角（°）<input type="number" step="any" value={exactStart} onChange={event => setExactStart(event.target.value)}/></label><label>终止角（°）<input type="number" step="any" value={exactEnd} onChange={event => setExactEnd(event.target.value)}/></label></div><div className="precision-segment"><button className={!clockwise ? 'active' : ''} onClick={() => setClockwise(false)}>逆时针</button><button className={clockwise ? 'active' : ''} onClick={() => setClockwise(true)}>顺时针</button></div></>}
          {tool === 'offset' && <><p className="precision-help">{offsetId ? '已选直线。可指定方向后直接生成。' : '先在画布中点选一条直线。'}</p><div className="precision-segment"><button className={offsetSide === 'left' ? 'active' : ''} onClick={() => setOffsetSide('left')}>左侧</button><button className={offsetSide === 'right' ? 'active' : ''} onClick={() => setOffsetSide('right')}>右侧</button></div></>}
          <button className="precision-submit" onClick={makeExact}>{tool === 'offset' ? '生成平行线' : '按数值绘制'}</button>
          <p className="precision-help">也可在画布点选{tool === 'line' ? '起点与终点' : tool === 'offset' ? '目标一侧' : tool === 'circle' ? '圆心与半径点' : '圆心、起点与终点'}。</p>
        </div>}
        {editing && tool === 'dimension' && <div className="precision-card dimension-card" aria-label="尺寸标注设置"><div className="precision-title"><strong>尺寸标注</strong><span>单位 mm</span></div><p className="precision-help">{dimensionSourceId ? '已选图元，再点击画布放置标注。' : '先点击一条线段、圆或圆弧。'}</p><div className="precision-segment"><button className={!dimensionDiameter ? 'active' : ''} onClick={() => setDimensionDiameter(false)}>长度 / 半径</button><button className={dimensionDiameter ? 'active' : ''} onClick={() => setDimensionDiameter(true)}>圆标直径</button></div><p className="precision-help">标注按图元几何计算；线段显示实际长度，圆和圆弧显示半径。</p></div>}
        <svg ref={svgRef} className={'drawing-canvas tool-' + tool} role="img" aria-label="机械制图画布"
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
          onPointerLeave={() => { setPointer(null); setSnapLabel(''); }} onWheel={wheel} onContextMenu={event => event.preventDefault()}>
          <rect width="100%" height="100%" fill="#fff"/>
          {visibleShapes.map(shape => shape.geometry.kind === 'marker'
            ? <g key={shape.id} transform={'translate(' + map(shape.geometry.point).x + ' ' + map(shape.geometry.point).y + ')'} className="marker"><circle r="4.5" fill="#fff" stroke="#3182dd" strokeWidth="2"/><text x="10" y="-10">{shape.geometry.label}</text></g>
            : shape.geometry.kind === 'callout'
            ? <g key={shape.id} data-shape-id={shape.id} className="callout"><defs><marker id={'arrow-' + shape.id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#151b23"/></marker></defs><path d={'M ' + map(shape.geometry.end).x + ' ' + map(shape.geometry.end).y + ' L ' + map(shape.geometry.elbow).x + ' ' + map(shape.geometry.elbow).y + ' L ' + map(shape.geometry.target).x + ' ' + map(shape.geometry.target).y} fill="none" stroke="#151b23" strokeWidth="1.6" markerEnd={'url(#arrow-' + shape.id + ')'}/><text x={map(shape.geometry.elbow).x - 2} y={map(shape.geometry.elbow).y - 8}>{shape.geometry.label}</text></g>
            : shape.geometry.kind === 'dimension'
            ? <g key={shape.id} data-shape-id={shape.id} className={'dimension-shape ' + (selectedId === shape.id ? 'selected-shape' : '')}>{dimensionLayout(shape.geometry).lines.map(([a, b], i) => <path key={i} d={'M ' + map(a).x + ' ' + map(a).y + ' L ' + map(b).x + ' ' + map(b).y} fill="none" stroke="#34455a" strokeWidth="1.3"/>)}{dimensionLayout(shape.geometry).arrow.map(({ tip, toward }, i) => <path key={'a' + i} d={arrowTriangle(map(tip), map(toward), 10, 3)} fill="#34455a"/>)}<text x={map(dimensionLayout(shape.geometry).label).x} y={map(dimensionLayout(shape.geometry).label).y - 5} textAnchor="middle">{dimensionLayout(shape.geometry).text}</text></g>
            : <path key={shape.id} data-shape-id={shape.id} d={shapePath(shape, map, 'screen')} fill="none" {...screenStyle(shape)} vectorEffect="non-scaling-stroke" className={selectedId === shape.id ? 'selected-shape' : ''}/>)}
          {preview && <path d={preview} fill="none" stroke="#3287e2" strokeWidth="1.8" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
          {offsetPreview && <path d={offsetPreview} fill="none" stroke="#3287e2" strokeWidth="1.8" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
          {draft.map((p, i) => <circle key={i} cx={map(p).x} cy={map(p).y} r="4" fill="#fff" stroke="#3287e2" strokeWidth="2" pointerEvents="none"/>)}
          {pointer && snapLabel && <g pointerEvents="none"><circle cx={map(pointer).x} cy={map(pointer).y} r="7" fill="#fff" stroke="#3287e2" strokeWidth="2"/><rect x={map(pointer).x + 11} y={map(pointer).y - 26} width="52" height="21" rx="4" fill="#fff" stroke="#b9d6f2"/><text x={map(pointer).x + 19} y={map(pointer).y - 11} fontSize="13" fill="#2673c9">{snapLabel}</text></g>}
        </svg>
        <div className="canvas-hint"><span>i</span>{editing ? hint : '步骤回放中；退出回放后可继续绘图。'}</div>
        <div className="coordinate">{pointer ? 'X ' + pointer.x.toFixed(1) + ' · Y ' + pointer.y.toFixed(1) + ' mm' : '移动指针查看坐标'} · {Math.round(camera.scale / 6 * 100)}%</div>
        <button className="properties-tab" aria-label={panel ? '折叠参数面板' : '打开参数面板'} onClick={() => setPanel(v => !v)}><SlidersHorizontal size={18}/><span>参数</span></button>
      </main>
      {panel && <aside className="properties-panel">
        <div className="panel-header"><strong>作图参数</strong><button aria-label="折叠参数面板" onClick={() => setPanel(false)}><X size={20}/></button></div>
        <p className="panel-tool">当前工具：{tool === 'arc-three' ? '三点圆弧' : tool === 'arc-center' ? '圆心圆弧' : iconTools.find(t => t.id === tool)?.label}</p>
        {['line', 'circle', 'arc-center', 'offset'].includes(tool) && <label className="field-label">{tool === 'line' ? '精确长度 L' : tool === 'offset' ? '偏移距离 D' : '精确半径 R'} <span>mm</span><input type="number" min="0.001" step="any" placeholder={tool === 'offset' ? '20' : '可选，留空用鼠标'} value={numeric} onChange={event => setNumeric(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && pointer && draft.length) { event.preventDefault(); applyPoint(pointer); } }}/></label>}
        {tool === 'arc-center' && <div className="field-label">圆弧方向<div className="segmented"><button className={!clockwise ? 'active' : ''} onClick={() => setClockwise(false)}>逆时针</button><button className={clockwise ? 'active' : ''} onClick={() => setClockwise(true)}>顺时针</button></div></div>}
        {tool === 'arc-center' && <button className="quiet-button" onClick={() => changeTool('arc-three')}>切换三点圆弧</button>}
        {tool === 'arc-three' && <button className="quiet-button" onClick={() => changeTool('arc-center')}>切换圆心圆弧</button>}
        {selected && <div className="selection-info"><strong>已选图元</strong><p>{selected.geometry.kind} · {getLineStyle(selected.style).name}</p><button className="quiet-button" onClick={removeSelected}>删除图元</button></div>}
        <div className="panel-tip">长度、半径和偏移距离使用毫米。按 Esc 取消绘制，按 F 适合画布。</div>
      </aside>}
    </div>
    <footer className="playback-bar">
      <div className="playback-title"><button aria-label={playing ? '暂停回放' : '开始回放'} disabled={!project.steps.length} onClick={() => { if (playback === null) { setPlayback(0); setPlaying(true); } else setPlaying(v => !v); }}>{playing ? <Pause size={21} weight="fill"/> : <Play size={21} weight="fill"/>}</button><div><strong>{editing ? '教学过程' : '步骤回放'}</strong><small>{editing ? project.cursor + ' 个作图步骤' : playback === 0 ? '起始画布' : project.steps[playback! - 1]?.label}</small></div></div>
      <div className="timeline"><input aria-label="教学步骤" type="range" min="0" max={project.steps.length} value={playback ?? project.cursor} disabled={!project.steps.length} onChange={event => { setPlaying(false); setPlayback(Number(event.target.value)); }}/><div><span>起始</span><span>{playback ?? project.cursor} / {project.steps.length}</span><span>完成</span></div></div>
      <div className="playback-buttons"><button aria-label="上一步" disabled={!project.steps.length} onClick={() => { setPlaying(false); setPlayback(Math.max(0, (playback ?? project.cursor) - 1)); }}><CaretLeft size={18}/> 上一步</button><button aria-label="下一步" disabled={!project.steps.length} onClick={() => { setPlaying(false); setPlayback(Math.min(project.steps.length, (playback ?? 0) + 1)); }}>下一步 <CaretRight size={18}/></button>{playback !== null && <button className="exit-playback" onClick={() => { setPlayback(null); setPlaying(false); }}>退出回放</button>}</div>
    </footer>
    {welcome && <div className="welcome-backdrop"><div className="welcome-dialog"><span>机械制图课堂工具</span><h1>从画板开始讲清每一步</h1><p>用精确图元和可回放的步骤，演示圆心、切点与辅助构造过程。项目自动保存在本机浏览器。</p><div><button className="welcome-primary" onClick={() => start(true)}>打开 R20 教学示例 <CaretRight size={20}/></button><button className="welcome-secondary" onClick={() => start(false)}>新建空白画板</button></div><small>无需登录 · 教学案例可编辑 · 支持 JSON、SVG、PNG 导出</small></div></div>}
    {notice && <div className="toast" role="status">{notice}</div>}
    <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) importFile(file); event.currentTarget.value = ''; }}/>
  </div>;
}

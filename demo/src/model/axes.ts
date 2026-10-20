export type AxisTicks = { step: number; x: number[]; y: number[] };

function values(min: number, max: number, step: number): number[] {
  const first = Math.ceil(min / step);
  const last = Math.floor(max / step);
  const count = Math.max(0, Math.min(300, last - first + 1));
  return Array.from({ length: count }, (_, index) => Number(((first + index) * step).toPrecision(12)));
}

export function axisTicks(scale: number, minX: number, maxX: number, minY: number, maxY: number): AxisTicks {
  const raw = 75 / scale;
  const base = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find(multiplier => multiplier * base >= raw)! * base;
  return { step, x: values(minX, maxX, step), y: values(minY, maxY, step) };
}

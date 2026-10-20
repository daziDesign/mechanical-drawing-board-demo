export type Point = { x: number; y: number };
export type LineStyleId =
  | 'thick-solid' | 'thin-solid' | 'wavy' | 'zigzag'
  | 'thin-dashed' | 'thick-dashed'
  | 'thin-dash-dot' | 'thick-dash-dot' | 'thin-dash-double-dot';
export type Role = 'geometry' | 'construction' | 'annotation';
export type LineGeometry = { kind: 'line'; a: Point; b: Point };
export type CircleGeometry = { kind: 'circle'; center: Point; radius: number };
export type ArcGeometry = { kind: 'arc'; center: Point; radius: number; startAngle: number; sweepAngle: number };
export type MarkerGeometry = { kind: 'marker'; point: Point; label: string };
export type CalloutGeometry = { kind: 'callout'; target: Point; elbow: Point; end: Point; label: string };
export type LinearDimension = { kind: 'dimension'; mode: 'linear'; a: Point; b: Point; offset: number };
export type RadialDimension = { kind: 'dimension'; mode: 'radius' | 'diameter'; center: Point; edge: Point; labelPoint: Point; value: number };
export type DimensionGeometry = LinearDimension | RadialDimension;
export type Geometry = LineGeometry | CircleGeometry | ArcGeometry | MarkerGeometry | CalloutGeometry | DimensionGeometry;
export type Shape = { id: string; role: Role; style: LineStyleId; geometry: Geometry };
export type DrawingCommand =
  | { type: 'create'; shape: Shape }
  | { type: 'delete'; id: string }
  | { type: 'style'; id: string; style: LineStyleId }
  | { type: 'replace'; removeIds: string[]; addShapes: Shape[] }
  | { type: 'constructionVisibility'; visible: boolean };
export type Step = { id: string; label: string; command: DrawingCommand; timestamp: number };
export type Project = {
  schemaVersion: 1;
  unit: 'mm';
  name: string;
  shapes: Shape[];
  steps: Step[];
  cursor: number;
  settings: { thickStrokeMm: number; showConstruction: boolean };
};
export type Materialized = { shapes: Shape[]; showConstruction: boolean };

/** Face-based candidates for ephemeral plan dimensions. No model changes or project storage. */
import type { Vec2 } from '../platform/module';
import type { NodeDto, RenderItem } from '../engine/protocol';

export interface FaceDimension {
  selected: string;
  reference: string;
  a: Vec2; // point on selected face
  b: Vec2; // point on reference face
  normal: Vec2; // signed selected -> reference unit vector
  distance: number;
  side: -1 | 1;
}
type Edge = { a: Vec2; b: Vec2; length: number; middle: Vec2; dir: Vec2 };
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const plus = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (p: Vec2, n: number): Vec2 => ({ x: p.x * n, y: p.y * n });
const perp = (p: Vec2): Vec2 => ({ x: -p.y, y: p.x });

function edges(item: RenderItem): Edge[] {
  const all: Edge[] = [];
  for (const shape of item.plan) {
    if (shape.kind !== 'cut' || !shape.closed) continue;
    const p = shape.points;
    for (let i = 0; i + 1 < p.length; i += 2) {
      const j = (i + 2) % p.length;
      const a = { x: p[i], y: p[i + 1] }, b = { x: p[j], y: p[j + 1] };
      const d = sub(b, a), length = Math.hypot(d.x, d.y);
      if (length > 1e-6) all.push({ a, b, length, dir: scale(d, 1 / length), middle: scale(plus(a, b), 0.5) });
    }
  }
  const longest = Math.max(0, ...all.map((e) => e.length));
  return all.filter((e) => e.length >= 0.65 * longest);
}

/** Return up to two clearances on the two faces of one selected wall.
 * Operates on visible cut polygons rather than centre-lines; only nearby parallel,
 * longitudinally overlapping faces are eligible.
 */
export function wallFaceDimensions(selected: string, items: RenderItem[], nodes: Map<string, NodeDto>): FaceDimension[] {
  if (nodes.get(selected)?.type !== 'IfcWall' && nodes.get(selected)?.type !== 'IfcWallStandardCase') return [];
  const self = items.find((r) => r.nodeId === selected);
  if (!self) return [];
  const faces = edges(self);
  if (!faces.length) return [];
  const axis = faces[0].dir, n = perp(axis);
  const found: FaceDimension[] = [];
  for (const other of items) {
    if (other.nodeId === selected || !['IfcWall', 'IfcWallStandardCase'].includes(nodes.get(other.nodeId)?.type ?? '')) continue;
    for (const a of faces) for (const b of edges(other)) {
      if (Math.abs(dot(a.dir, b.dir)) < 0.995) continue;
      // At least 20 cm of projection overlap along the wall face.
      const a0 = dot(a.a, a.dir), a1 = dot(a.b, a.dir);
      const b0 = dot(b.a, a.dir), b1 = dot(b.b, a.dir);
      const low = Math.max(Math.min(a0, a1), Math.min(b0, b1));
      const high = Math.min(Math.max(a0, a1), Math.max(b0, b1));
      if (high - low < 0.2) continue;
      const signDistance = dot(sub(b.middle, a.middle), n);
      const distance = Math.abs(signDistance);
      if (distance < 0.01 || distance > 100) continue;
      const side: -1 | 1 = signDistance >= 0 ? 1 : -1;
      // Measure between parallel projected face points, not arbitrary endpoints.
      const along = (low + high) / 2;
      const atA = plus(a.a, scale(a.dir, along - dot(a.a, a.dir)));
      const atB = plus(atA, scale(n, signDistance));
      found.push({ selected, reference: other.nodeId, a: atA, b: atB, normal: n, distance, side });
    }
  }
  return ([-1, 1] as const).flatMap((side) => found.filter((d) => d.side === side)
    .sort((a, b) => a.distance - b.distance).slice(0, 1));
}

/** Move only the selected wall away from/towards the held reference face. */
export function dimensionMove(d: FaceDimension, newDistance: number): Vec2 | null {
  if (!Number.isFinite(newDistance) || newDistance <= 0) return null;
  return scale(d.normal, -d.side * (newDistance - d.distance));
}

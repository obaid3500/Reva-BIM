import { describe, expect, it } from 'vitest';
import type { NodeDto, RenderItem } from '../engine/protocol';
import { dimensionMove, wallFaceDimensions } from './temporaryDimensions';

const wall = (id: string, y0: number, y1: number): RenderItem => ({
  nodeId: id,
  plan: [{ kind: 'cut', closed: true, points: [0, y0, 5, y0, 5, y1, 0, y1] }],
}) as unknown as RenderItem;
const nodes = new Map<string, NodeDto>(['middle', 'above', 'below'].map((id) =>
  [id, { id, type: 'IfcWall' } as NodeDto]));
describe('temporary wall-face dimensions', () => {
  const items = [wall('middle', 0, 0.2), wall('above', 3.2, 3.4), wall('below', -3.2, -3)];
  it('measures clearances between actual facing surfaces on both sides', () => {
    const candidates = wallFaceDimensions('middle', items, nodes);
    expect(candidates).toHaveLength(2);
    expect(candidates.map((d) => d.distance).sort()).toEqual([3, 3]);
    expect(candidates.map((d) => d.reference).sort()).toEqual(['above', 'below']);
  });
  it('moves the selected wall rather than its reference for a 3m → 3.5m edit', () => {
    const d = wallFaceDimensions('middle', items, nodes).find((d) => d.reference === 'above')!;
    const move = dimensionMove(d, 3.5)!;
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(0.5, 10);
    expect(move.y).toBeCloseTo(-0.5, 10);
  });
  it('rejects invalid values without geometry change', () => {
    const d = wallFaceDimensions('middle', items, nodes)[0];
    expect(dimensionMove(d, 0)).toBeNull();
    expect(dimensionMove(d, Number.NaN)).toBeNull();
  });
  it('does not invent references when walls are not parallel or not visible', () => {
    expect(wallFaceDimensions('middle', [wall('middle', 0, 0.2)], nodes)).toEqual([]);
  });
});

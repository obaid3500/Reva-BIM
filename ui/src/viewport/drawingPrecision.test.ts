import { describe, expect, it } from 'vitest';
import { drawingIncrement, preciseDrawingPoint, formatDrawingMetres } from './drawingPrecision';

describe('drawing precision uses exact geometry', () => {
  it('draws an exact 4m wall from pointer motion without typing', () => {
    const a = { x: 0, y: 0 };
    const r = preciseDrawingPoint(a, { x: 3.99873, y: 0 }, 100);
    expect(r.length).toBe(4);
    expect(Math.hypot(r.point.x - a.x, r.point.y - a.y)).toBeCloseTo(4, 10);
    expect(formatDrawingMetres(r.length)).toBe('4.00 m');
  });
  it('draws adjacent 4 by 3 metre edges without moving their bases', () => {
    const first = preciseDrawingPoint({ x: 0, y: 0 }, { x: 4.012, y: 0 }, 100);
    const second = preciseDrawingPoint(first.point, { x: 4, y: 3.009 }, 100);
    expect(first.point.x).toBeCloseTo(4, 10);
    expect(second.point.x).toBeCloseTo(4, 10);
    expect(second.point.y).toBeCloseTo(3, 10);
  });
  it('holds the increment through pointer jitter', () => {
    const base = { x: 0, y: 0 };
    const first = preciseDrawingPoint(base, { x: 4.001, y: 0 }, 100);
    const jitter = preciseDrawingPoint(base, { x: 4.029, y: 0 }, 100, first.hold);
    expect(jitter.length).toBe(4);
    const beyond = preciseDrawingPoint(base, { x: 4.05, y: 0 }, 100, jitter.hold);
    expect(beyond.length).toBe(4.05);
  });
  it('adapts increments to screen pixel size', () => {
    expect(drawingIncrement(100)).toBe(0.05);
    expect(drawingIncrement(350)).toBe(0.01);
    expect(drawingIncrement(10)).toBe(0.5);
  });
  it('keeps an active drag increment stable', () => {
    const base = { x: 1, y: 2 };
    const first = preciseDrawingPoint(base, { x: 5, y: 2 }, 100);
    const afterZoom = preciseDrawingPoint(base, { x: 5.03, y: 2 }, 500, first.hold);
    expect(afterZoom.hold.step).toBe(first.hold.step);
    expect(afterZoom.length).toBe(4);
  });
});
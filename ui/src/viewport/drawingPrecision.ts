/** Precision helpers for live *drawing* only. Model coordinates remain metres.
 * Object snaps and geometric tracking are resolved upstream and never moved here.
 */
import type { Vec2 } from '../platform/module';

export interface LengthHold { base: Vec2; step: number; length: number }
export interface LengthResult { point: Vec2; hold: LengthHold; length: number }

/** Choose increments by their visible size, not an arbitrary camera zoom value. */
export function drawingIncrement(pixelsPerMetre: number): number {
  if (!Number.isFinite(pixelsPerMetre) || pixelsPerMetre <= 0) return 0.05;
  const choices = [0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];
  // Aim for a 4–12px step; normal plan scales use 5cm.
  return choices.find((step) => step * pixelsPerMetre >= 3) ?? 5;
}

/** Quantize actual geometry, maintaining direction and a little hysteresis.
 * This must NEVER be applied over a resolved object snap or a numeric input.
 */
export function preciseDrawingPoint(
  base: Vec2, candidate: Vec2, pixelsPerMetre: number, previous?: LengthHold | null,
): LengthResult {
  const dx = candidate.x - base.x, dy = candidate.y - base.y;
  const raw = Math.hypot(dx, dy);
  const sameBase = previous && Math.hypot(previous.base.x - base.x, previous.base.y - base.y) < 1e-9;
  const step = sameBase ? previous.step : drawingIncrement(pixelsPerMetre);
  // Keep the acquired value until the hand clears 70% of a step; avoids jitter
  // around the usual 50%-of-step transition.
  const length = sameBase && Math.abs(raw - previous.length) <= step * 0.7
    ? previous.length : Math.round(raw / step) * step;
  const exact = Math.round(length * 1e9) / 1e9;
  const point = raw > 1e-12 ? { x: base.x + dx / raw * exact, y: base.y + dy / raw * exact } : { ...base };
  return { point, length: exact, hold: { base: { ...base }, step, length: exact } };
}

/** Drawing readouts have a stable, human-readable metre precision. */
export const formatDrawingMetres = (length: number): string => `${length.toFixed(2)} m`;

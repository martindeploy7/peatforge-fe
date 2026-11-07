import { describe, expect, it, vi } from 'vitest';
vi.mock('maplibre-gl', () => ({ default: {} }));
import { moveFlatView } from '../src/RiskMap';

const view = { x: 0, y: 0, zoom: 1, bearing: 0 };
describe('schematic map touch gestures', () => {
  it('pans without changing zoom or bearing', () => {
    expect(moveFlatView(view, [{ x: 10, y: 20 }], [{ x: 40, y: -10 }])).toEqual({ ...view, x: 30, y: -30 });
  });
  it('keeps the pinch anchor stable while zooming and translating', () => {
    expect(moveFlatView(view, [{ x: 50, y: 0 }, { x: 150, y: 0 }], [{ x: 10, y: 20 }, { x: 210, y: 20 }])).toEqual({ x: -90, y: 20, zoom: 2, bearing: 0 });
  });
  it('rotates a quarter turn around the midpoint', () => {
    const next = moveFlatView(view, [{ x: -50, y: 0 }, { x: 50, y: 0 }], [{ x: 0, y: -50 }, { x: 0, y: 50 }]);
    expect(next.bearing).toBeCloseTo(90);
    expect(next.zoom).toBe(1);
    expect(Math.abs(next.x) + Math.abs(next.y)).toBe(0);
  });
  it('bounds zoom and ignores coincident fingers or a changing touch count', () => {
    const start = [{ x: -50, y: 0 }, { x: 50, y: 0 }];
    expect(moveFlatView(view, start, [{ x: -500, y: 0 }, { x: 500, y: 0 }]).zoom).toBe(3);
    expect(moveFlatView(view, start, [{ x: -1, y: 0 }, { x: 1, y: 0 }]).zoom).toBe(.5);
    expect(moveFlatView(view, [{ x: 0, y: 0 }, { x: 0, y: 0 }], start)).toBe(view);
    expect(moveFlatView(view, start, [{ x: 0, y: 0 }])).toBe(view);
  });
  it('takes the short rotation across the angle boundary', () => {
    const radians = Math.PI / 180;
    const points = (angle: number) => [{ x: 0, y: 0 }, { x: Math.cos(angle * radians) * 100, y: Math.sin(angle * radians) * 100 }];
    expect(moveFlatView(view, points(179), points(-179)).bearing).toBeCloseTo(2);
  });
});

import { describe, expect, it } from 'vitest';
import { villages } from '../src/model';
import { hotspotGeometry, makeRiskHexes, mapAnchor, normalizeRiskGeometry, villageCoordinate } from '../src/mapGeometry';

describe('independently authored demo map geometry', () => {
  it('anchors Talio and preserves the southwest position of Talio Hulu', () => {
    expect(villageCoordinate(villages.find(v => v.id === 'talio')!)).toEqual(mapAnchor);
    const hulu = villageCoordinate(villages.find(v => v.id === 'talio-hulu')!);
    expect(hulu[0]).toBeLessThan(mapAnchor[0]);
    expect(hulu[1]).toBeLessThan(mapAnchor[1]);
  });
  it('creates closed finite hexagons with valid risk values', () => {
    const hexes = makeRiskHexes(villages);
    expect(hexes.features.length).toBeGreaterThan(100);
    for (const feature of hexes.features) {
      const ring = feature.geometry.coordinates[0];
      expect(ring).toHaveLength(7);
      expect(ring[0]).toEqual(ring[6]);
      expect(ring.flat().every(Number.isFinite)).toBe(true);
      expect(feature.properties?.risk).toBeGreaterThanOrEqual(1);
      expect(feature.properties?.risk).toBeLessThanOrEqual(4);
    }
  });
  it('returns no cells without village data', () => {
    expect(makeRiskHexes([]).features).toEqual([]);
  });
});

describe('backend map data', () => {
  it('preserves engine point geometry and maps known levels without manufacturing areas', () => {
    const point = { type: 'Point' as const, coordinates: [114.2, -3.1] };
    const input = { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, geometry: point, properties: { level: 'TINGGI', source: 'modelled' } }] };
    const result = normalizeRiskGeometry(input);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry).toEqual(point);
    expect(result.features[0].properties).toMatchObject({ risk: 3, level: 'TINGGI', source: 'modelled' });
    expect(input.features[0].properties).not.toHaveProperty('risk');
  });
  it('leaves unavailable risk unknown and never falls back to demo cells', () => {
    expect(normalizeRiskGeometry(null).features).toEqual([]);
    const result = normalizeRiskGeometry({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [114, -3] }, properties: { level: null } }] });
    expect(result.features[0].properties?.risk).toBeNull();
  });
  it('uses only available finite detections and preserves the heat-detection label', () => {
    const items = [{ id: 'satellite:1', lat: -3.1, lon: 114.2 }, { id: 'invalid', lat: NaN, lon: 114 }];
    expect(hotspotGeometry({ items, available: false }).features).toEqual([]);
    const result = hotspotGeometry({ items, available: true });
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry).toEqual({ type: 'Point', coordinates: [114.2, -3.1] });
    expect(result.features[0].properties?.label).toContain('bukan kebakaran terkonfirmasi');
  });
});

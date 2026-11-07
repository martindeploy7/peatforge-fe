import type { FeatureCollection, Polygon } from 'geojson';
import type { Village } from './model';

export const riskColors = { low: '#4f8b68', moderate: '#d5a039', high: '#dc793f', critical: '#c95151', unknown: '#7b858b' };
export const riskNumbers = { low: 1, moderate: 2, high: 3, critical: 4, unknown: null };
export const mapAnchor: [number, number] = [114.106, -3.0905];

export interface MapHotspot { id: string; lat: number; lon: number; detected_at?: string; confidence?: string | number; satellite?: string }
export interface MapHotspots { items: MapHotspot[]; available: boolean; stale?: boolean; data_as_of?: string | null }
export const emptyGeometry = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

export function normalizeRiskGeometry(data: FeatureCollection | null): FeatureCollection {
  if (!data) return emptyGeometry();
  const levels: Record<string, number> = { RENDAH: 1, SEDANG: 2, TINGGI: 3, EKSTREM: 4 };
  return { ...data, features: data.features.map(feature => ({ ...feature, properties: {
    ...feature.properties, risk: levels[String(feature.properties?.level)] ?? null,
  } })) };
}

export function hotspotGeometry(data: MapHotspots | null | undefined): FeatureCollection {
  if (!data?.available) return emptyGeometry();
  return { type: 'FeatureCollection', features: data.items.filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon)).map(item => ({
    type: 'Feature', properties: { ...item, label: 'Deteksi panas, bukan kebakaran terkonfirmasi' },
    geometry: { type: 'Point', coordinates: [item.lon, item.lat] },
  })) };
}

// Beyond the public Talio anchor these are demo positions, not surveyed coordinates.
export function villageCoordinate(village: Village): [number, number] {
  return [village.lng ?? mapAnchor[0] + (village.position[0] - 56) * 0.0016,
    village.lat ?? mapAnchor[1] - (village.position[1] - 52) * 0.0016];
}

export function makeRiskHexes(villages: Village[]): FeatureCollection<Polygon> {
  const features: FeatureCollection<Polygon>['features'] = [];
  if (villages.length === 0) return { type: 'FeatureCollection', features };
  const radius = 0.003;
  for (let column = -19; column <= 19; column += 1) {
    for (let row = -20; row <= 20; row += 1) {
      const lng = mapAnchor[0] + column * radius * 1.5;
      const lat = mapAnchor[1] + (row + (Math.abs(column) % 2) / 2) * radius * Math.sqrt(3);
      const nearest = villages.reduce((best, candidate) => {
        const [x, y] = villageCoordinate(candidate);
        const [bx, by] = villageCoordinate(best);
        return Math.hypot(x - lng, y - lat) < Math.hypot(bx - lng, by - lat) ? candidate : best;
      });
      const [x, y] = villageCoordinate(nearest);
      const distance = Math.hypot(x - lng, y - lat);
      const baseRisk = riskNumbers[nearest.risk];
      const number = baseRisk == null ? null : Math.min(4, Math.max(1, baseRisk - (distance > 0.036 ? 1 : 0)));
      const ring = Array.from({ length: 7 }, (_, index) => {
        const angle = (index % 6) * Math.PI / 3;
        return [lng + radius * Math.cos(angle), lat + radius * Math.sin(angle)];
      });
      features.push({ type: 'Feature', properties: { risk: number, villageId: nearest.id }, geometry: { type: 'Polygon', coordinates: [ring] } });
    }
  }
  return { type: 'FeatureCollection', features };
}

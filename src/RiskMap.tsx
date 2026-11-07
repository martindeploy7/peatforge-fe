/// <reference types="vite/client" />
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { ArrowDownToLine, ArrowUpToLine, Compass, Layers, LocateFixed, Minus, Plus, RotateCcw, RotateCw, X } from 'lucide-react';
import type { Message, Recommendation, Village } from './model';
import { riskLabels } from './model';
import { emptyGeometry, hotspotGeometry, makeRiskHexes, mapAnchor, normalizeRiskGeometry, riskColors, riskNumbers, villageCoordinate, type MapHotspots } from './mapGeometry';
import VillagePopoverContent, { placeVillagePopover } from './VillagePopover';
import './map.css';

interface Props {
  villages: Village[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenDetails: (id: string) => void;
  recommendations: Recommendation[];
  messages: Message[];
  mode: 'live' | 'replay';
  theme: 'light' | 'dark';
  scope: 'pilot' | 'national';
  replayIndex: number;
  backendRisk?: FeatureCollection | null;
  backendHotspots?: MapHotspots | null;
  backendCanals?: FeatureCollection | null;
}
const duration = (milliseconds: number) => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : milliseconds;
const tiles = () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const hatchPattern = (dark: boolean) => {
  const canvas = document.createElement('canvas'); canvas.width = 10; canvas.height = 10;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.strokeStyle = dark ? 'rgba(235,241,244,.12)' : 'rgba(54,65,70,.18)'; context.lineWidth = .75;
  context.beginPath(); context.moveTo(-1, 1); context.lineTo(1, -1); context.moveTo(0, 10); context.lineTo(10, 0); context.moveTo(9, 11); context.lineTo(11, 9); context.stroke();
  return context.getImageData(0, 0, 10, 10);
};
type Point = { x: number; y: number };
type FlatView = { x: number; y: number; zoom: number; bearing: number };
type VillagePreview = { id: string; anchor: Point; pinned: boolean; focusCard: boolean };
export function moveFlatView(view: FlatView, start: Point[], next: Point[]): FlatView {
  if (!start.length || start.length !== next.length) return view;
  const middle = (points: Point[]) => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length });
  const from = middle(start), to = middle(next);
  let zoom = view.zoom, angle = 0;
  if (start.length === 2) {
    const distance = (points: Point[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    if (distance(start) < 1 || distance(next) < 1) return view;
    zoom = Math.max(.5, Math.min(3, view.zoom * distance(next) / distance(start)));
    angle = Math.atan2(next[1].y - next[0].y, next[1].x - next[0].x) - Math.atan2(start[1].y - start[0].y, start[1].x - start[0].x);
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  }
  const ratio = zoom / view.zoom, x = from.x - view.x, y = from.y - view.y;
  return { zoom, bearing: view.bearing + angle * 180 / Math.PI,
    x: to.x - ratio * (x * Math.cos(angle) - y * Math.sin(angle)),
    y: to.y - ratio * (x * Math.sin(angle) + y * Math.cos(angle)) };
}

export default function RiskMap({ villages, selectedId, onSelect, onOpenDetails, recommendations, messages, mode, theme, scope, replayIndex, backendRisk, backendHotspots, backendCanals }: Props) {
  const mapRoot = useRef<HTMLElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [riskVisible, setRiskVisible] = useState(true);
  const [hatchVisible, setHatchVisible] = useState(true);
  const [basemapVisible, setBasemapVisible] = useState(true);
  const [is3d, setIs3d] = useState(false);
  const [flatView, setFlatView] = useState<FlatView>({ x: 0, y: 0, zoom: 1, bearing: 0 });
  const popoverId = useId();
  const previewCard = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<VillagePreview | null>(null);
  const previewRef = useRef<VillagePreview | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ left: 12, top: 12 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreFocus = useRef(false);
  const flatViewRef = useRef(flatView);
  flatViewRef.current = flatView;
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ view: FlatView; points: Point[] } | null>(null);
  const dragged = useRef(false);
  const selectedVillage = villages.find(village => village.id === selectedId);
  const integrated = backendRisk !== undefined;
  const mapVillages = useMemo(() => integrated ? villages.filter(village => Number.isFinite(village.lng) && Number.isFinite(village.lat)) : villages, [villages, integrated]);
  const anchor: [number, number] = mapVillages.length && integrated ? villageCoordinate(mapVillages[0]) : mapAnchor;
  const hexes = useMemo(() => backendRisk === undefined ? makeRiskHexes(villages) : normalizeRiskGeometry(backendRisk), [villages, replayIndex, backendRisk]);
  const hotspots = useMemo(() => hotspotGeometry(backendHotspots), [backendHotspots]);
  const canals = useMemo(() => backendCanals ?? emptyGeometry(), [backendCanals]);
  const latest = useRef({ hexes, hotspots, canals, anchor, theme, scope });
  latest.current = { hexes, hotspots, canals, anchor, theme, scope };
  const previewVillage = villages.find(village => village.id === preview?.id);
  const previewPending = recommendations.filter(item => item.villageId === preview?.id && item.status === 'pending').length;
  const previewReply = messages.filter(message => message.villageId === preview?.id && message.direction === 'in').at(-1);

  const cancelPreviewClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const dismissPreview = useCallback((restoreFocus = false) => {
    cancelPreviewClose();
    const active = previewRef.current;
    if (!active) return;
    previewRef.current = null;
    setPreview(null);
    mapRoot.current?.querySelectorAll<HTMLElement>('[data-village-id]').forEach(element => {
      element.setAttribute('aria-expanded', 'false');
      element.removeAttribute('aria-controls');
    });
    if (restoreFocus) {
      ignoreFocus.current = true;
      mapRoot.current?.querySelector<HTMLElement>(`[data-village-id="${active.id}"]`)?.focus({ preventScroll: true });
      ignoreFocus.current = false;
    }
  }, [cancelPreviewClose]);
  const openPreview = useCallback((id: string, marker: HTMLElement, interaction: 'hover' | 'focus' | 'pin' | 'keyboard') => {
    if (ignoreFocus.current || (interaction === 'hover' && previewRef.current?.pinned)) return;
    const bounds = mapRoot.current?.getBoundingClientRect();
    if (!bounds) return;
    cancelPreviewClose();
    const point = marker.getBoundingClientRect();
    const next = { id, anchor: { x: point.x + point.width / 2 - bounds.x, y: point.y + point.height / 2 - bounds.y }, pinned: interaction === 'pin' || interaction === 'keyboard', focusCard: interaction === 'keyboard' };
    previewRef.current = next;
    setPreview(next);
    mapRoot.current?.querySelectorAll<HTMLElement>('[data-village-id]').forEach(element => {
      const expanded = element.dataset.villageId === id;
      element.setAttribute('aria-expanded', String(expanded));
      if (expanded) element.setAttribute('aria-controls', popoverId);
      else element.removeAttribute('aria-controls');
    });
  }, [cancelPreviewClose, popoverId]);
  const schedulePreviewClose = useCallback(() => {
    cancelPreviewClose();
    closeTimer.current = setTimeout(() => {
      if (previewRef.current?.pinned || previewCard.current?.contains(document.activeElement)) return;
      if (document.activeElement instanceof HTMLElement && document.activeElement.dataset.villageId === previewRef.current?.id) return;
      dismissPreview();
    }, 220);
  }, [cancelPreviewClose, dismissPreview]);

  useLayoutEffect(() => {
    if (!preview || !previewCard.current || !mapRoot.current) return;
    const position = () => {
      const card = previewCard.current, root = mapRoot.current;
      if (!card || !root) return;
      const next = placeVillagePopover(preview.anchor, { width: root.clientWidth, height: root.clientHeight }, { width: card.offsetWidth, height: card.offsetHeight });
      setPreviewPosition(previous => previous.left === next.left && previous.top === next.top ? previous : next);
    };
    position();
    if (preview.focusCard) previewCard.current.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(previewCard.current);
    return () => observer.disconnect();
  }, [preview]);

  useEffect(() => {
    if (!preview) return;
    const outside = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || previewCard.current?.contains(target)) return;
      if (target instanceof Element && mapRoot.current?.contains(target.closest('[data-village-id]'))) return;
      dismissPreview();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); dismissPreview(true);
    };
    const resize = () => dismissPreview();
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', resize);
    };
  }, [preview, dismissPreview]);
  useEffect(() => { dismissPreview(); }, [scope, replayIndex, dismissPreview]);
  useEffect(() => cancelPreviewClose, [cancelPreviewClose]);

  useEffect(() => {
    if (!container.current) return;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: container.current, center: latest.current.anchor, zoom: 12.4,
        dragPan: true, touchZoomRotate: true, touchPitch: true,
        cooperativeGestures: false, maxPitch: 70,
        attributionControl: { compact: false },
        style: {
          version: 8,
          sources: { base: { type: 'raster', tiles: [tiles()], tileSize: 256, maxzoom: 18,
            attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community' } },
          layers: [{ id: 'base', type: 'raster', source: 'base', paint: { 'raster-saturation': -.85, 'raster-brightness-min': .1, 'raster-brightness-max': latest.current.theme === 'dark' ? .42 : .87 } }],
        },
      });
    } catch { if (import.meta.env.DEV) container.current.dataset.engine = 'fallback'; setFallback(true); return; }
    mapRef.current = map;
    map.on('move', () => dismissPreview());
    if (import.meta.env.DEV) {
      const reportView = () => {
        if (!container.current) return;
        Object.assign(container.current.dataset, { engine: 'maplibre', zoom: String(map.getZoom()), bearing: String(map.getBearing()), pitch: String(map.getPitch()), center: JSON.stringify(map.getCenter().toArray()) });
      };
      reportView();
      map.on('move', reportView);
    }
    map.on('pitch', () => setIs3d(map.getPitch() > 1));
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-right');
    map.once('style.load', () => {
      map.addSource('risk', { type: 'geojson', data: latest.current.hexes });
      map.addLayer({ id: 'risk-fill', type: 'fill', source: 'risk', paint: {
        'fill-color': ['match', ['get', 'risk'], 1, riskColors.low, 2, riskColors.moderate, 3, riskColors.high, 4, riskColors.critical, riskColors.unknown], 'fill-opacity': .32,
      } });
      map.addLayer({ id: 'risk-edge', type: 'line', source: 'risk', paint: { 'line-color': '#756e60', 'line-width': 0.55, 'line-opacity': 0.27 } });
      map.addLayer({ id: 'risk-point', type: 'circle', source: 'risk', filter: ['==', ['geometry-type'], 'Point'], paint: {
        'circle-radius': 22, 'circle-opacity': .25,
        'circle-color': ['match', ['get', 'risk'], 1, riskColors.low, 2, riskColors.moderate, 3, riskColors.high, 4, riskColors.critical, riskColors.unknown],
      } });
      map.addSource('hotspots', { type: 'geojson', data: latest.current.hotspots });
      map.addLayer({ id: 'hotspots', type: 'circle', source: 'hotspots', paint: { 'circle-radius': 5, 'circle-color': '#c95151', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
      map.addSource('canals', { type: 'geojson', data: latest.current.canals });
      map.addLayer({ id: 'canals', type: 'line', source: 'canals', paint: { 'line-color': '#468aaa', 'line-width': 2 } });
      const hatch = hatchPattern(latest.current.theme === 'dark');
      if (hatch) {
        map.addImage('model-hatching', hatch);
        map.addLayer({ id: 'model-hatching', type: 'fill', source: 'risk', paint: { 'fill-pattern': 'model-hatching' } });
      }
      setReady(true);
      if (import.meta.env.DEV && container.current) container.current.dataset.ready = 'true';
      if (latest.current.scope === 'national') map.easeTo({ center: [117, -2.4], zoom: 4.3, duration: 0 });
    });
    const resize = new ResizeObserver(() => map.resize()); resize.observe(container.current);
    return () => { resize.disconnect(); map.remove(); mapRef.current = null; };
  }, [dismissPreview]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('risk') as GeoJSONSource).setData(hexes);
    (map.getSource('hotspots') as GeoJSONSource).setData(hotspots);
    (map.getSource('canals') as GeoJSONSource).setData(canals);
    const markers = mapVillages.map(village => {
      const element = document.createElement('button');
      element.className = `village-marker risk-${village.risk} ${selectedId === village.id ? 'selected' : ''}`;
      element.style.setProperty('--marker-color', riskColors[village.risk]);
      element.setAttribute('aria-label', `Pilih Desa ${village.name}, risiko ${riskLabels[village.risk]}`);
      element.setAttribute('aria-pressed', String(selectedId === village.id));
      element.dataset.villageId = village.id;
      element.setAttribute('aria-haspopup', 'dialog');
      element.setAttribute('aria-expanded', String(previewRef.current?.id === village.id));
      if (previewRef.current?.id === village.id) element.setAttribute('aria-controls', popoverId);
      const value = document.createElement('span'); value.className = 'village-marker-number'; value.textContent = String(riskNumbers[village.risk] ?? '?');
      const label = document.createElement('span'); label.className = 'village-marker-label'; label.textContent = village.name;
      element.append(value, label);
      element.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') openPreview(village.id, element, 'hover'); });
      element.addEventListener('pointerleave', schedulePreviewClose);
      element.addEventListener('focus', () => openPreview(village.id, element, 'focus'));
      element.addEventListener('blur', schedulePreviewClose);
      element.addEventListener('click', event => {
        openPreview(village.id, element, event.detail === 0 ? 'keyboard' : 'pin');
        selectRef.current(village.id);
      });
      return new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(villageCoordinate(village)).addTo(map);
    });
    return () => { markers.forEach(marker => marker.remove()); };
  }, [ready, mapVillages, selectedId, hexes, hotspots, canals, openPreview, schedulePreviewClose, popoverId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setPaintProperty('base', 'raster-brightness-max', theme === 'dark' ? .42 : .87);
    const hatch = hatchPattern(theme === 'dark');
    if (hatch && map.hasImage('model-hatching')) map.updateImage('model-hatching', hatch);
  }, [ready, theme]);
  useEffect(() => {
    if (ready) mapRef.current?.setLayoutProperty('base', 'visibility', basemapVisible ? 'visible' : 'none');
  }, [ready, basemapVisible]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.easeTo({ center: scope === 'national' ? [117, -2.4] : latest.current.anchor, zoom: scope === 'national' ? 4.3 : 12.4, pitch: 0, bearing: 0, duration: duration(700) });
    setIs3d(false);
  }, [ready, scope, anchor[0], anchor[1]]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const id of ['risk-fill', 'risk-edge', 'risk-point']) map.setLayoutProperty(id, 'visibility', riskVisible ? 'visible' : 'none');
    if (map.getLayer('model-hatching')) map.setLayoutProperty('model-hatching', 'visibility', hatchVisible && riskVisible ? 'visible' : 'none');
  }, [ready, riskVisible, hatchVisible]);

  const zoom = (amount: number) => { mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 12.4) + amount, { duration: duration(250) }); setFlatView(value => ({ ...value, zoom: Math.max(0.5, Math.min(3, value.zoom + amount * 0.2)) })); };
  const rotate = (amount: number) => { mapRef.current?.rotateTo((mapRef.current?.getBearing() ?? 0) + amount, { duration: duration(250) }); setFlatView(value => ({ ...value, bearing: value.bearing + amount })); };
  const pitch = (amount: number) => mapRef.current?.easeTo({ pitch: Math.max(0, Math.min(70, (mapRef.current?.getPitch() ?? 0) + amount)), duration: duration(250) });
  const toggle3d = () => { mapRef.current?.easeTo({ pitch: is3d ? 0 : 55, bearing: is3d ? 0 : -12, duration: duration(600) }); setIs3d(!is3d); };
  const focusSelected = () => {
    if (!selectedVillage) return;
    if (integrated && (!Number.isFinite(selectedVillage.lng) || !Number.isFinite(selectedVillage.lat))) return;
    mapRef.current?.easeTo({ center: villageCoordinate(selectedVillage), zoom: Math.max(12.4, mapRef.current.getZoom()), duration: duration(500) });
    const rect = container.current?.getBoundingClientRect();
    if (fallback && rect) setFlatView(value => ({ ...value, bearing: 0, x: -(flatPosition(selectedVillage)[0] - 50) / 100 * rect.width * value.zoom, y: -(flatPosition(selectedVillage)[1] - 50) / 100 * rect.height * value.zoom }));
  };
  const flatPosition = (village: Village) => integrated ? [50 + (villageCoordinate(village)[0] - anchor[0]) * 750, 50 - (villageCoordinate(village)[1] - anchor[1]) * 750] : [50 + (village.position[0] - 56) * 1.2, 50 + (village.position[1] - 52) * 1.2];
  const svgPoint = ([lng, lat]: number[]) => `${500 + (lng - anchor[0]) * 7500},${500 - (lat - anchor[1]) * 7500}`;
  const flatPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };
  const startFlatGesture = () => { gesture.current = { view: flatViewRef.current, points: [...pointers.current.values()] }; };
  const endFlatGesture = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    startFlatGesture();
  };

  return <section ref={mapRoot} className={`risk-map ${theme}`} aria-label="Peta risiko kebakaran gambut">
    <div className="map-canvas" ref={container} />
    {fallback && <div className="map-fallback" tabIndex={0} role="region" aria-label={integrated ? 'Peta koordinat referensi, geser untuk memindahkan peta' : 'Peta skematis demo, geser untuk memindahkan peta'} onPointerDown={event => {
      if (!pointers.current.size) dragged.current = false;
      if ((event.target as HTMLElement).closest('button') || event.button !== 0 || pointers.current.size >= 2) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, flatPointer(event)); startFlatGesture();
    }} onPointerMove={event => {
      if (!pointers.current.has(event.pointerId) || !gesture.current) return;
      pointers.current.set(event.pointerId, flatPointer(event));
      const points = [...pointers.current.values()];
      if (points.some((point, index) => Math.hypot(point.x - gesture.current!.points[index].x, point.y - gesture.current!.points[index].y) > 4)) dragged.current = true;
      setFlatView(moveFlatView(gesture.current.view, gesture.current.points, points));
    }} onPointerUp={endFlatGesture} onPointerCancel={endFlatGesture} onLostPointerCapture={endFlatGesture} onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      const delta: Record<string, Point> = { ArrowLeft: { x: 40, y: 0 }, ArrowRight: { x: -40, y: 0 }, ArrowUp: { x: 0, y: 40 }, ArrowDown: { x: 0, y: -40 } };
      if (delta[event.key]) { event.preventDefault(); setFlatView(value => ({ ...value, x: value.x + delta[event.key].x, y: value.y + delta[event.key].y })); }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1); }
      if (event.key === '-') { event.preventDefault(); zoom(-1); }
    }} onClickCapture={event => { if (dragged.current) { event.stopPropagation(); dragged.current = false; } }}>
      <div className="fallback-world" style={{ transform: `translate(${flatView.x}px, ${flatView.y}px) scale(${flatView.zoom}) rotate(${flatView.bearing}deg)` }}><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label={integrated ? 'Geometri backend pada koordinat referensi' : 'Peta skematis demo'}>
        <defs><pattern id="fallback-hatch" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M-1 1L1-1M0 9L9 0M8 10L10 8" stroke="currentColor" strokeWidth="1" opacity=".2" /></pattern></defs>
        <g>
          {!integrated && <path className="fallback-river" d="M890 -100C790 100 660 150 720 340S950 580 780 720S720 950 840 1100" />}
          {riskVisible && hexes.features.map((feature, index) => {
            const color = [riskColors.unknown, riskColors.low, riskColors.moderate, riskColors.high, riskColors.critical][Number(feature.properties?.risk)] ?? riskColors.unknown;
            const geometry = feature.geometry;
            if (geometry.type === 'Point') return <circle key={index} cx={500 + (geometry.coordinates[0] - anchor[0]) * 7500} cy={500 - (geometry.coordinates[1] - anchor[1]) * 7500} r="22" fill={color} fillOpacity=".25" />;
            const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
            return <g key={index}>{polygons.map((rings, polygon) => <path key={polygon} d={rings.map(ring => `M${ring.map(svgPoint).join('L')}Z`).join('')} fill={color} fillRule="evenodd" fillOpacity=".32" stroke="currentColor" strokeWidth=".4" strokeOpacity=".2" />)}{hatchVisible && polygons.map((rings, polygon) => <path key={`hatch-${polygon}`} d={rings.map(ring => `M${ring.map(svgPoint).join('L')}Z`).join('')} fill="url(#fallback-hatch)" fillRule="evenodd" />)}</g>;
          })}
          {canals.features.map((feature, index) => {
            const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates : [];
            return <g key={index}>{lines.map((line, part) => <polyline key={part} points={line.map(svgPoint).join(' ')} fill="none" stroke="#468aaa" strokeWidth="2" />)}</g>;
          })}
          {hotspots.features.map((feature, index) => feature.geometry.type === 'Point' && <circle key={index} cx={500 + (feature.geometry.coordinates[0] - anchor[0]) * 7500} cy={500 - (feature.geometry.coordinates[1] - anchor[1]) * 7500} r="5" fill="#c95151" stroke="white"><title>Deteksi panas, bukan kebakaran terkonfirmasi</title></circle>)}
        </g>
      </svg>
      {mapVillages.map(village => <button key={village.id} data-village-id={village.id} aria-haspopup="dialog" aria-expanded={preview?.id === village.id} aria-controls={preview?.id === village.id ? popoverId : undefined} onPointerEnter={event => { if (event.pointerType !== 'touch') openPreview(village.id, event.currentTarget, 'hover'); }} onPointerLeave={schedulePreviewClose} onFocus={event => openPreview(village.id, event.currentTarget, 'focus')} onBlur={schedulePreviewClose} onClick={event => { openPreview(village.id, event.currentTarget, event.detail === 0 ? 'keyboard' : 'pin'); onSelect(village.id); }} aria-label={`Pilih Desa ${village.name}, risiko ${riskLabels[village.risk]}`} aria-pressed={selectedId === village.id} className={`village-marker fallback-marker risk-${village.risk} ${selectedId === village.id ? 'selected' : ''}`} style={{ left: `${flatPosition(village)[0]}%`, top: `${flatPosition(village)[1]}%`, '--marker-color': riskColors[village.risk] } as CSSProperties}><span className="village-marker-number">{riskNumbers[village.risk] ?? '?'}</span><span className="village-marker-label">{village.name}</span></button>)}
      </div><span className="map-unavailable">WebGL tidak tersedia · {integrated ? 'tampilan koordinat referensi' : 'peta skematis demo'}</span>
    </div>}
    {selectedVillage && <div className="map-selection"><p>{scope === 'national' ? 'Indonesia' : 'Wilayah pilot'} <span> / Desa terpilih</span></p><div><strong>{selectedVillage.name}</strong><span className={`map-selection-risk risk-${selectedVillage.risk}`}>{riskNumbers[selectedVillage.risk]} · {riskLabels[selectedVillage.risk]}</span></div></div>}
    <button className="map-layer-button map-button" onClick={() => setLayersOpen(!layersOpen)} aria-expanded={layersOpen}><Layers size={17} />Lapisan</button>
    {layersOpen && <div className="map-layer-popover"><header><strong>Lapisan peta</strong><button onClick={() => setLayersOpen(false)} aria-label="Tutup lapisan peta"><X size={16} /></button></header><label><input type="checkbox" checked={basemapVisible} onChange={event => setBasemapVisible(event.target.checked)} />Citra satelit Esri</label><label><input type="checkbox" checked={riskVisible} onChange={event => setRiskVisible(event.target.checked)} />Risiko kebakaran</label><label><input type="checkbox" checked={hatchVisible} onChange={event => setHatchVisible(event.target.checked)} />Arsir: hanya model</label><p>{integrated ? 'Titik referensi BMKG, bukan batas resmi desa. Risiko merupakan estimasi model.' : 'Warna dan posisi merupakan visualisasi demo, bukan batas desa.'}</p>{integrated && <p>Hotspot: deteksi panas, bukan kebakaran terkonfirmasi. {backendHotspots?.available ? `${backendHotspots.items.length} deteksi${backendHotspots.stale ? ' · cache lama' : ''}.` : 'Data hotspot belum tersedia.'} {backendCanals?.features.length ? 'Garis kanal dari OpenStreetMap.' : 'Geometri kanal belum tersedia.'}</p>}<p className="map-touch-help">Geser satu jari untuk memindahkan peta. Cubit untuk zoom, putar dua jari untuk arah.{!fallback && ' Geser dua jari sejajar ke atas atau bawah untuk kemiringan.'}{fallback && ' Kemiringan memerlukan WebGL.'}</p></div>}
    <div className="map-controls" role="group" aria-label="Navigasi peta"><div className="map-control-pair"><button className="map-button" onClick={focusSelected} disabled={!selectedVillage} title="Pusatkan desa terpilih" aria-label="Pusatkan peta ke desa terpilih"><LocateFixed size={18} /></button><button className="map-button compass" aria-label="Atur arah utara" onClick={() => { mapRef.current?.resetNorth({ duration: duration(300) }); setFlatView(value => ({ ...value, bearing: 0 })); }}><Compass size={20} /></button></div><div className="map-control-pair"><button className="map-button" aria-label="Putar peta ke kiri" onClick={() => rotate(-20)}><RotateCcw size={16} /></button><button className="map-button" aria-label="Putar peta ke kanan" onClick={() => rotate(20)}><RotateCw size={16} /></button></div><div className="map-control-pair"><button className="map-button" aria-label="Tambah kemiringan peta" disabled={fallback} onClick={() => pitch(15)}><ArrowUpToLine size={18} /></button><button className="map-button" aria-label="Kurangi kemiringan peta" disabled={fallback} onClick={() => pitch(-15)}><ArrowDownToLine size={18} /></button></div><div className="map-control-pair"><button className="map-button" aria-label="Perbesar peta" onClick={() => zoom(1)}><Plus size={20} /></button><button className="map-button" aria-label="Perkecil peta" onClick={() => zoom(-1)}><Minus size={20} /></button></div><button className="map-button map-3d" disabled={fallback} onClick={toggle3d} aria-pressed={is3d}>{is3d ? 'Lihat 2D' : 'Lihat 3D'}</button></div>
    <span className="demo-map-attribution">{integrated ? 'Titik referensi BMKG, bukan batas resmi · risiko model' : 'Posisi & area risiko perkiraan/demo'}</span>
    {integrated && (!backendRisk || backendRisk.features.length === 0) && <span className="national-map-note">Lapisan risiko belum tersedia</span>}
    {scope === 'national' && <span className="national-map-note">Cakupan Indonesia · {integrated ? 'risiko hanya wilayah pilot' : 'data demo wilayah pilot'}</span>}
    {preview && previewVillage && <div ref={previewCard} id={popoverId} role="dialog" aria-modal="false" aria-labelledby={`${popoverId}-heading`} tabIndex={-1} className="village-popover-dialog" style={previewPosition} onPointerEnter={cancelPreviewClose} onPointerLeave={schedulePreviewClose} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) dismissPreview(); }}>
      <VillagePopoverContent village={previewVillage} pendingCount={previewPending} lastReply={previewReply} mode={mode} integrated={integrated} headingId={`${popoverId}-heading`} onClose={() => dismissPreview(true)} onOpenDetails={() => { const id = preview.id; dismissPreview(); onOpenDetails(id); }} />
    </div>}
  </section>;
}

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import VillagePopoverContent, { placeVillagePopover, type VillagePopoverProps } from '../src/VillagePopover';
import { villages } from '../src/model';

const base: VillagePopoverProps = { village: villages[0], pendingCount: 2, mode: 'live', headingId: 'test-village-heading', onClose() {}, onOpenDetails() {} };
const render = (props: Partial<VillagePopoverProps> = {}) => renderToStaticMarkup(createElement(VillagePopoverContent, { ...base, ...props }));

describe('honest village popover content', () => {
  it('renders known risk, countdown, canal benefit and pending count', () => {
    const markup = render({ village: { ...base.village, confidence: .68 }, lastReply: { id: 'reply', villageId: 'talio', direction: 'in', body: 'AIR 61', time: '09:41' } });
    expect(markup).toContain('<h3 id="test-village-heading">Desa Talio</h3>');
    expect(markup).toContain('Kecamatan Pandih Batu');
    expect(markup).toContain('map-selection-risk risk-high');
    expect(markup).toContain('Perkiraan kritis dalam 4 hari.');
    expect(markup).toContain('+5 hari aman');
    expect(markup).toContain('<dt>Usulan menunggu</dt><dd>2</dd>');
    expect(markup).toContain('<dd>09:41</dd>');
    expect(markup).toContain('<dd>68%</dd>');
    expect(markup).toContain('Model demo · belum diukur');
    expect(markup).toContain('aria-label="Tutup ringkasan desa"');
    expect(markup).toContain('>Buka detail desa</button>');
  });
  it('labels unavailable values and preserves zero pending count', () => {
    const markup = render({ village: villages.find(village => village.id === 'dandang')!, pendingCount: 0 });
    expect(markup).toContain('Kecamatan belum tersedia');
    expect(markup).toContain('Perkiraan waktu kritis belum tersedia.');
    expect(markup).toContain('Manfaat sekat kanal belum tersedia.');
    expect(markup).toContain('<dt>Usulan menunggu</dt><dd>0</dd>');
    expect(markup).toContain('<dt>Balasan terakhir</dt><dd>Belum ada</dd>');
    expect(markup).not.toContain('Keyakinan model');
    expect(markup).not.toContain('+0 hari');
  });
  it('distinguishes critical today and replay risk from current-session queue', () => {
    const markup = render({ village: { ...base.village, criticalIn: 0, risk: 'critical' }, mode: 'replay' });
    expect(markup).toContain('Kondisi kritis hari ini.');
    expect(markup).toContain('map-selection-risk risk-critical');
    expect(markup).toContain('Ekstrem');
    expect(markup).toContain('Risiko dari replay. Usulan dan balasan: sesi demo saat ini.');
  });
  it('renders unknown backend risk and null benefits without safe defaults', () => {
    const markup = render({ integrated: true, village: { ...base.village, risk: 'unknown', criticalIn: null, extraDays: null } });
    expect(markup).toContain('risk-unknown');
    expect(markup).toContain('Manfaat sekat kanal belum tersedia.');
    expect(markup).toContain('Estimasi model · bukan pengukuran lapangan');
    expect(markup).not.toContain('hari aman');
    expect(markup).not.toContain('Risiko demo');
  });
  it('preserves an actual zero benefit and labels positive benefits as model output', () => {
    expect(render({ integrated: true, village: { ...base.village, extraDays: 0 } })).toContain('tambahan waktu menurut model 0 hari');
    expect(render({ integrated: true, village: { ...base.village, extraDays: 2 } })).toContain('+2 hari tambahan menurut model');
  });
});

describe('village popover placement', () => {
  it('prefers above the point and falls below when above is unavailable', () => {
    expect(placeVillagePopover({ x: 400, y: 350 }, { width: 800, height: 600 }, { width: 320, height: 200 })).toEqual({ left: 240, top: 122 });
    expect(placeVillagePopover({ x: 400, y: 30 }, { width: 800, height: 600 }, { width: 320, height: 200 })).toEqual({ left: 240, top: 58 });
  });
  it('fits all corners and a short map using the CSS-constrained card size', () => {
    const card = { width: 320, height: 320 };
    for (const bounds of [{ width: 768, height: 400 }, { width: 320, height: 96 }]) {
      const actualWidth = Math.min(card.width, bounds.width - 24);
      const actualHeight = Math.min(card.height, bounds.height - 24);
      for (const anchor of [{ x: 0, y: 0 }, { x: bounds.width, y: 0 }, { x: 0, y: bounds.height }, { x: bounds.width, y: bounds.height }]) {
        const result = placeVillagePopover(anchor, bounds, card);
        expect(result.left).toBeGreaterThanOrEqual(12);
        expect(result.top).toBeGreaterThanOrEqual(12);
        expect(result.left + actualWidth).toBeLessThanOrEqual(bounds.width - 12);
        expect(result.top + actualHeight).toBeLessThanOrEqual(bounds.height - 12);
      }
    }
  });
});

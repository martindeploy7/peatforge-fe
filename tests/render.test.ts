import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import App, { CommandWorkspace } from '../src/App';
import type { Command } from '../src/useCommand';
import { initialState } from '../src/model';
import { mapRecommendation, mapVillage } from '../src/backend';
import { config, proposal, replay, responders, status, villages } from './api-fixture';

vi.mock('../src/RiskMap', () => ({ default: () => null }));

describe('server-driven command render', () => {
  it('initial App only connects, with no fabricated status or proposal', () => {
    const markup = renderToStaticMarkup(createElement(App));
    expect(markup).toContain('Menghubungkan posko…');
    expect(markup).toContain('Memuat konfigurasi dan daftar desa dari server lokal.');
    expect(markup).not.toContain('usulan menunggu');
    expect(markup).not.toContain('Talio');
    expect(markup).not.toContain('PFVI');
  });
  it('renders typed server data and the existing command layout', () => {
    const action = proposal();
    const command: Command = {
      state: { ...initialState, villages: villages.map(v => mapVillage(v, status(v.id))), selectedVillageId: villages[0].id, recommendations: [mapRecommendation(action, status())], messages: [], events: [], smsSent: 0 },
      dispatch: vi.fn(), config, statuses: { [villages[0].id]: status() }, forecast: [], simulation: null, risk: null, hotspots: null, national: null, nationalDays: 1, setNationalDays: vi.fn(), policy: null, canalGeometry: null, archive: null, actions: [action], actionsLoaded: true, progress: null,
      detail: { canals: [], resources: null, history: [], observations: [], milestones: null, backtest: null }, responders, responder: responders[0], setResponderId: vi.fn(), replay, frames: [], loading: false, busy: false, errors: {}, unauthorized: false, refresh: vi.fn(), reconnect: vi.fn(), run: vi.fn(async () => true), simulate: vi.fn(async () => {}), loadHistory: vi.fn(async () => {}), markError: vi.fn(),
    };
    const markup = renderToStaticMarkup(createElement(CommandWorkspace, { command }));
    expect(markup).toContain('<h1>1 usulan menunggu keputusan Anda.</h1>');
    expect(markup).toContain(action.title);
    expect(markup).toContain('Setidaknya 8 hari penundaan');
    expect(markup).toContain('stale / tersimpan');
    expect(markup).toContain('>Setujui</button>');
    expect(markup).toContain('arsir = hanya model');
    expect(markup).toContain('Telepon-SMS');
  });
});

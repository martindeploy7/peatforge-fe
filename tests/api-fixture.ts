import type { Page } from '@playwright/test';
import type { BackendAction, BackendMessage, Config, ReplayMeta, Responder, Simulation, VillageMetadata, VillageStatus } from '../src/backend';

// Explicit TEST FIXTURE responses. Never installed in the application runtime.
export const villages: VillageMetadata[] = [
  ['62.11.01.2002', 'Talio', -3.1222040246, 114.0981588862],
  ['62.11.01.2003', 'Pangkoh Hilir', -3.0948407882, 114.1612351662],
  ['62.11.01.2004', 'Pangkoh Hulu', -3.0401913737, 114.1576813408],
  ['62.11.01.2005', 'Kantan Muara', -3.0086596884, 114.1169648671],
  ['62.11.01.2006', 'Talio Muara', -3.093826788, 114.1209430709],
].map(([id, name, lat, lon]) => ({ id: String(id), name: String(name), lat: Number(lat), lon: Number(lon), source: 'provider' }));
export const config: Config = { mode: 'demo', public_demo: true, source: 'fixture', outbound: 'mock', voice_mode: 'disabled', poll_ms: 60000, field_poll_ms: 3000, voice_available: false };
export const replay: ReplayMeta = { scenario: '2019', start: '2019-06-15', end: '2019-08-15', days: 62, perfect_forecast: true };
export const responders: Responder[] = villages.map((v, i) => ({ id: `R${i + 1}`, village_id: v.id, name: `Petugas ${v.name}`, role: 'relawan', tier: 1, phone_last4: '0000', consent_at: null, last_contacted_at: null }));
export const status = (village_id = villages[0].id): VillageStatus => ({ village_id, level: 'TINGGI', pfvi: 183, wt_cm: 51, confidence: .7, days_to_critical: null, critical_date: null, mode: 'live', day: 0, source: 'fixture', stale: true, data_as_of: '2026-11-07T00:00:00Z', wt_source: 'modelled', critical_now: false });
export const simulation: Simulation = { baseline_critical_date: '2026-11-10', scenario_critical_date: null, days_bought: null, at_least_days: 8, wt_gain_cm: null, pfvi_reduction: null, curve_baseline: [], curve_scenario: [], source: 'fixture', reason: 'scenario_beyond_horizon' };
export const proposal = (id = 'A1'): BackendAction => ({ id, village_id: villages[0].id, responder_id: 'R1', title: `Sekat Kanal empat ${id}`, reason: 'Laporan terkonfirmasi', kind: 'proposal', type: 'canal_block', status: 'proposed', days_bought: null, at_least_days: 8, benefit: { wt_gain_cm: null, pfvi_reduction: null }, created_at: '2026-11-07T00:00:00Z', expires_at: '2026-11-08T00:00:00Z', mode: 'live', day: 0, verifier: { decision: 'forward', checks: [{ passed: true, source: 'fixture' }] }, observation_id: 'O1' });

export async function installApiFixture(page: Page) {
  const requests: { path: string; method: string; body: Record<string, unknown> | null; search: string }[] = [];
  const actions: BackendAction[] = [], messages: BackendMessage[] = [];
  let state = 'idle', failRisk = false;
  const message = (body: string, direction: 'in' | 'out') => messages.push({ id: `M${messages.length}`, responder_id: 'R1', body, direction, channel: 'sms', speech: null, status: direction === 'in' ? 'received' : 'mock', created_at: '2026-11-07T00:00:00Z' });
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(4), body = req.postDataJSON() as Record<string, unknown> | null;
    requests.push({ path, method: req.method(), body, search: url.search });
    const reply = (json: unknown, code = 200) => route.fulfill({ status: code, json });
    if (path === '/config') return reply(config);
    if (path === '/villages') return reply({ items: villages });
    if (path === '/responders') return reply({ items: responders });
    if (path === '/replay/meta') return reply(replay);
    if (path === '/map/risk') return failRisk ? reply({ error: { code: 'unavailable', message: 'TEST engine unavailable' } }, 503) : reply({ type: 'FeatureCollection', features: villages.map(v => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [v.lon, v.lat] }, properties: { ...status(v.id), name: v.name, mode: url.searchParams.get('mode'), day: Number(url.searchParams.get('day')) } })) });
    if (path === '/actions') return reply({ items: actions, hidden_count: 0 });
    if (path === '/events/risk-changed') { state = 'collect'; message('Laporkan air, asap dan lokasi.', 'out'); return reply({ ok: true }); }
    if (path === '/demo/inbound') {
      message(String(body?.text), 'in');
      if (body?.text === 'YA' && state === 'confirm') { state = 'saved'; actions.push(proposal()); message('Laporan dicatat.', 'out'); }
      else { state = 'confirm'; message('Bacaan ulang: AIR 61 ASAP YA dekat kanal 4. Benar? Kirim YA.', 'out'); }
      return reply({ ok: true });
    }
    const decision = path.match(/^\/actions\/([^/]+)\/(approve|reject)$/);
    if (decision) { const action = actions.find(a => a.id === decision[1])!; action.status = decision[2] === 'approve' ? 'approved' : 'rejected'; return reply(action); }
    if (path === '/demo/progress') return reply({ responder_id: url.searchParams.get('responder_id'), state, mode: 'live', day: 0, observation_id: state === 'saved' ? 'O1' : null, action_id: actions[0]?.id ?? null, steps: [], counts: { messages: messages.length, observations: state === 'saved' ? 1 : 0, actions: actions.length } });
    if (/^\/responders\/[^/]+\/messages$/.test(path)) return reply({ items: messages });
    if (/^\/villages\/[^/]+\/simulate$/.test(path)) return reply(simulation);
    if (/^\/villages\/[^/]+\/resources$/.test(path)) return reply({ pumps: null, crews: null, canal_blocks: [] });
    if (/^\/villages\/[^/]+\/canals$/.test(path)) return reply({ items: [{ id: 'K4', name: 'Kanal empat', source: 'fixture' }] });
    if (/^\/villages\/[^/]+\/(forecast|params\/history)$/.test(path) || ['/observations', '/trace'].includes(path)) return reply({ items: [] });
    if (path === '/hotspots') return reply({ items: [], available: false, source: 'fixture' });
    if (path === '/canals/osm') return reply({ type: 'FeatureCollection', features: [], source: 'fixture' });
    if (path === '/national/hotspots') return reply({ total_matched: 0, regional_total: 0, by_province: {}, source: 'fixture' });
    if (['/policy', '/replay/hotspots/summary'].includes(path)) return reply({ source: 'fixture' });
    return reply({ error: { code: 'unexpected_test_request', message: `Unhandled test API: ${path}` } }, 500);
  });
  return { requests, actions, failRisk: () => { failRisk = true; } };
}

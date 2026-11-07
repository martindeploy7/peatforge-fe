import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Benefit, DecisionHistory, NationalData, SimulationPanel, VillageData } from '../src/BackendPanels'
import type { Command } from '../src/useCommand'
import type { BackendAction } from '../src/backend'

const command = (overrides: Partial<Command> = {}): Command => ({
  state: { selectedVillageId: 'v1', mode: 'live', replayIndex: 0 },
  detail: { canals: [{id: 'K2', name: 'Kanal dua', source: 'fixture'}], resources: null, observations: [], history: [], milestones: null, backtest: null },
  errors: {}, simulation: null, forecast: [], actions: [], national: null, nationalDays: 1,
  busy: false, setNationalDays: vi.fn(), simulate: vi.fn(), loadHistory: vi.fn(), dispatch: vi.fn(), run: vi.fn(), statuses: {}, policy: null, archive: null, canalGeometry: null,
  ...overrides,
} as unknown as Command)
const render = (component: typeof NationalData | typeof SimulationPanel | typeof VillageData | typeof DecisionHistory, value: Command) => renderToStaticMarkup(createElement(component, { command: value }))
const action = (status: BackendAction['status']): BackendAction => ({ id: status, village_id: 'v1', responder_id: 'r1', title: `Usulan ${status}`, reason: 'Bukti observasi', kind: 'proposal', type: 'canal_block', status, days_bought: null, at_least_days: 3, benefit: { wt_gain_cm: 2, pfvi_reduction: null }, created_at: '2026-11-07T00:00:00Z', expires_at: '2026-11-08T00:00:00Z', mode: 'live', day: 0, verifier: { decision: 'forward_with_flag', checks: [{ name: 'freshness', passed: false }] }, followup_status: 'sent' })

describe('backend detail panels', () => {
  it('preserves null benefits instead of inventing zero days and shows engine reason', () => {
    const markup = renderToStaticMarkup(createElement(Benefit, { result: { days_bought: null, at_least_days: null, wt_gain_cm: null, pfvi_reduction: null, reason: 'baseline_not_critical_in_horizon' } }))
    expect(markup).toContain('Tambahan hari belum dapat ditentukan')
    expect(markup).not.toContain('0 hari tambahan')
    expect(markup).toContain('baseline_not_critical_in_horizon')
    expect(markup).toContain('Belum tersedia')
  })
  it('labels a lower bound and preserves a genuine zero benefit', () => {
    const lower = renderToStaticMarkup(createElement(Benefit, { result: { days_bought: null, at_least_days: 5, wt_gain_cm: 2, pfvi_reduction: 0 } }))
    expect(lower).toContain('Setidaknya 5 hari tambahan')
    const exact = renderToStaticMarkup(createElement(Benefit, { result: { days_bought: 0, at_least_days: null, wt_gain_cm: 0, pfvi_reduction: 0 } }))
    expect(exact).toContain('0 hari tambahan')
  })
  it('renders actual province counts with source, stale timestamp and omitted point disclosure', () => {
    const markup = render(NationalData, command({ national: { by_province: { Papua: 9, Bali: 0 }, total_matched: 9, source: 'fixture', stale: true, data_as_of: '2019-06-15T00:00:00Z', points_omitted: true, regional_total: 10, unmatched_regional_count: 1 } }))
    expect(markup).toContain('Sumber: fixture')
    expect(markup).toContain('2019-06-15T00:00:00Z')
    expect(markup).toContain('stale / tersimpan')
    expect(markup).toContain('<th scope="row">Papua</th><td>9</td>')
    expect(markup).toContain('Koordinat titik tidak dikirim oleh API')
    expect(markup).toContain('bukan konfirmasi kebakaran')
    expect(markup).toContain('value="7"')
  })
  it('uses actual target canals, model curves and default intervention parameters', () => {
    const markup = render(SimulationPanel, command({ forecast: [{ date: '2026-11-07', wt_cm: 50, pfvi: 160, level: 'SEDANG', rain_mm: null }, { date: '2026-11-08', wt_cm: 70, pfvi: 190, level: 'TINGGI', rain_mm: 0 }] }))
    expect(markup).toContain('Kanal dua')
    expect(markup).toContain('value="60"')
    expect(markup).toContain('value="14"')
    expect(markup).toContain('d="M24.00,104.00 L396.00,16.00"')
  })
  it('separates level from critical condition and retains observation pre-update evidence', () => {
    const base = command()
    const markup = render(VillageData, command({ statuses: { v1: { village_id: 'v1', level: 'TINGGI', pfvi: 180, wt_cm: 65, days_to_critical: 0, critical_date: '2026-11-07', confidence: null, mode: 'live', day: 0, critical_now: true, critical_reason: 'wt' } }, detail: { ...base.detail, observations: [{id: 'obs1', wt_cm: 50, pre_update_model: {wt_cm: 65, pfvi: 180}}] } }))
    expect(markup).toContain('Level risiko: <b>TINGGI</b>')
    expect(markup).toContain('Kritis saat ini: <b>Ya</b>')
    expect(markup).toContain('pre update model')
    expect(markup).toContain('&quot;wt_cm&quot;: 65')
    expect(markup).toContain('validasi historis belum diklaim')
  })
  it('filters decision context, exposes verifier checks and allows explicit completion only when approved', () => {
    const actions = ['approved','rejected','expired','done'].map(status => action(status as BackendAction['status']))
    actions.push({...action('approved'), id: 'other-village', village_id: 'v2'}, {...action('approved'), id: 'other-mode', mode: 'replay'})
    const markup = render(DecisionHistory, command({actions}))
    expect(markup).toContain('Riwayat keputusan (4)')
    expect(markup).not.toContain('other-village')
    expect(markup).not.toContain('other-mode')
    expect(markup.match(/Konfirmasi sudah dilaksanakan/g)).toHaveLength(1)
    expect(markup).toContain('freshness')
    expect(markup).toContain('forward_with_flag')
    expect(markup).toContain('sent')
    expect(markup).toContain('Catatan pelaksanaan lapangan')
  })
})

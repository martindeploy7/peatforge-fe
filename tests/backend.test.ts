import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, backend, mapDecision, mapMessage, mapRecommendation, mapRisk, mapTrace, mapVillage } from '../src/backend'
import type { BackendAction, BackendMessage, Simulation, TraceEvent, VillageMetadata, VillageStatus } from '../src/backend'

const metadata: VillageMetadata = { id: 'talio', name: 'Talio', lat: -2.8, lon: 114.2, source: 'fixture' }
const status: VillageStatus = {
  village_id: 'talio', level: 'TINGGI', pfvi_level: 'TINGGI', critical_now: true, critical_reason: 'wt',
  pfvi: 231, wt_cm: 61, days_to_critical: 0, critical_date: '2026-11-07', confidence: 0.5,
  source: 'modelled', wt_source: 'modelled', stale: true, data_as_of: '2026-11-06T12:00:00Z',
  mode: 'live', day: 0, assumptions: ['Not field calibrated'], reason: null,
}
const simulation: Simulation = {
  baseline_critical_date: '2026-11-10', scenario_critical_date: null, days_bought: null,
  at_least_days: 4, reason: 'scenario_beyond_horizon', wt_gain_cm: 5.1, pfvi_reduction: 13.2,
  curve_baseline: [], curve_scenario: [], assumptions: ['Chosen scenario'],
}
const action: BackendAction = {
  id: 'a_1', village_id: 'talio', responder_id: 'r_1', title: 'Usulan sekat kanal', reason: 'Laporan terkonfirmasi',
  kind: 'proposal', type: 'canal_block', status: 'approved', days_bought: null, at_least_days: 4,
  benefit: { wt_gain_cm: 5.1, pfvi_reduction: 13.2 }, created_at: '2026-11-07T01:00:00Z',
  expires_at: '2026-11-07T07:00:00Z', mode: 'live', day: 0, verifier: { decision: 'forward_with_flag', checks: [{ name: 'hotspots_2km_48h', passed: null, available: false }] },
  simulation, assumptions: ['Modelled'],
}
function reply(value: unknown, statusCode = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value), { status: statusCode })))
}
afterEach(() => vi.unstubAllGlobals())

describe('same-origin backend transport', () => {
  it('keeps cookies and caller abort signal, and encodes IDs/query values', async () => {
    reply({ items: [] })
    const controller = new AbortController()
    await backend.messages('r/one', '2026-11-07T01:00:00+07:00', controller.signal)
    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/responders/r%2Fone/messages?after=2026-11-07T01%3A00%3A00%2B07%3A00')
    expect(options?.credentials).toBe('same-origin')
    expect(options?.redirect).toBe('error')
    controller.abort()
    expect(options?.signal?.aborted).toBe(true)
  })
  it('sends only the requested transition; approved never becomes done', async () => {
    reply(action)
    expect((await backend.approve('a_1')).status).toBe('approved')
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('/api/actions/a_1/approve', expect.objectContaining({ method: 'POST', body: '{}' }))
  })
  it('sends actual intervention inputs without generating benefit numbers', async () => {
    reply(simulation)
    const input = { type: 'canal_block' as const, targets: ['K3'], days: 7, delta_hc_cm: 40, mode: 'replay' as const, day: 12 }
    expect(await backend.simulate('talio', input)).toEqual(simulation)
    expect(fetch).toHaveBeenCalledWith('/api/villages/talio/simulate', expect.objectContaining({ body: JSON.stringify(input) }))
  })
  it('surfaces 401 once and never substitutes browser mocks', async () => {
    reply({ error: { code: 'unauthorized', message: 'Login diperlukan' } }, 401)
    await expect(backend.villages()).rejects.toMatchObject({ status: 401, code: 'unauthorized', message: 'Login diperlukan' })
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('handles non-JSON proxy failures without leaking response content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>private details</html>', { status: 502 })))
    await expect(backend.config()).rejects.toMatchObject({ status: 502, code: 'http_error' })
  })
  it('distinguishes invalid JSON, network failure, and cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>SPA fallback</html>')))
    await expect(backend.config()).rejects.toMatchObject({ code: 'invalid_response' })
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('connection details'))
    await expect(backend.config()).rejects.toBeInstanceOf(ApiError)
    const controller = new AbortController()
    controller.abort()
    const abort = new DOMException('aborted', 'AbortError')
    vi.mocked(fetch).mockRejectedValueOnce(abort)
    await expect(backend.config(controller.signal)).rejects.toBe(abort)
  })
  it('preserves Headers objects and rejects external paths', async () => {
    reply({ status: 'ok' })
    await api('/health', { headers: new Headers({ Accept: 'application/json' }) })
    expect(new Headers(vi.mocked(fetch).mock.calls[0]![1]?.headers).get('Accept')).toBe('application/json')
    await expect(api('https://elsewhere.test/api')).rejects.toThrow('Invalid API path')
    await expect(api('//elsewhere.test/api')).rejects.toThrow('Invalid API path')
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('preserves cancellation while reading a response body', async () => {
    const controller = new AbortController()
    const abort = new DOMException('aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => {
      controller.abort()
      throw abort
    } }))
    await expect(backend.config(controller.signal)).rejects.toBe(abort)
  })
  it('uses actual replay metadata and nullable computed milestones', async () => {
    const meta = { scenario: '2019', start: '2019-06-15', end: '2019-08-15', days: 62, perfect_forecast: true }
    reply(meta)
    expect(await backend.replayMeta()).toEqual(meta)
    const milestones = { ...meta, village_id: 'talio', mode: 'replay', source: 'fixture', items: [{ kind: 'pfvi_250', day: null, date: null, pfvi: null, wt_cm: null, reason: 'not_reached_in_replay' }] }
    reply(milestones)
    expect(await backend.replayMilestones('talio')).toEqual(milestones)
    expect(fetch).toHaveBeenCalledWith('/api/replay/milestones?village_id=talio', expect.anything())
  })
})

describe('mapping backend facts to command UI', () => {
  it('preserves positive-down WT and separates current criticality from PFVI level', () => {
    const village = mapVillage(metadata, status, simulation)
    expect(village).toMatchObject({ risk: 'high', waterTable: 61, criticalIn: 0, criticalNow: true, extraDays: null, lat: -2.8, lng: 114.2, source: 'modelled', stale: true })
    expect(village.status).toBe(status)
    expect(village.metadata).toBe(metadata)
    expect(village.simulation?.at_least_days).toBe(4)
  })
  it('does not fabricate safe risk or zero-valued data for missing status', () => {
    expect(mapVillage(metadata, null)).toMatchObject({ risk: 'unknown', criticalIn: null, extraDays: null, status: null })
    expect(mapVillage(metadata, null).pfvi).toBeUndefined()
    expect(mapRisk(undefined)).toBe('unknown')
    expect(mapVillage(metadata, { ...status, pfvi: null, wt_cm: null }).pfvi).toBeNull()
  })
  it('keeps explicit null provenance distinct from missing provenance', () => {
    const sourceNull = mapVillage(metadata, { ...status, source: null, stale: null, data_as_of: null })
    expect(sourceNull.source).toBeNull()
    expect(sourceNull.stale).toBeNull()
    expect(sourceNull.dataAsOf).toBeNull()
    expect(mapVillage(metadata, null).source).toBeUndefined()
  })
  it('maps forecast levels to ordinal UI data without dropping missing observations', () => {
    const points = [{ date: '2026-11-07', level: 'TINGGI' as const, pfvi: null, wt_cm: null, rain_mm: null }]
    const village = mapVillage(metadata, status, undefined, points)
    expect(village.forecast).toEqual([3])
    expect(village.forecastPoints).toBe(points)
  })
  it('retains unavailable benefits, verification checks, and every action state', () => {
    const mapped = mapRecommendation(action)
    expect(mapped).toMatchObject({ extraDays: null, pumps: null, risk: 'unknown', status: 'approved', raw: action })
    expect(mapped.raw.at_least_days).toBe(4)
    expect(mapDecision('proposed')).toBe('pending')
    for (const state of ['approved', 'rejected', 'done', 'expired', 'superseded'] as const) expect(mapDecision(state)).toBe(state)
  })
  it('uses implemented message body and retains trace facts', () => {
    const message: BackendMessage = { id: 'm_1', responder_id: 'r_1', direction: 'in', channel: 'web', body: 'AIR 61 ASAP TIDAK', speech: null, status: 'received', created_at: '2026-11-07T01:00:00Z' }
    expect(mapMessage(message, 'talio')).toEqual({ id: 'm_1', villageId: 'talio', direction: 'in', body: message.body, time: message.created_at })
    const trace: TraceEvent = { id: 'e_1', agent: 'Verifier', event: 'evidence_checked', input: { village_id: 'talio' }, output: { decision: 'hold' }, tool_calls: [], trace_id: null, created_at: message.created_at }
    expect(mapTrace(trace)).toMatchObject({ title: 'evidence_checked', raw: trace })
  })
})

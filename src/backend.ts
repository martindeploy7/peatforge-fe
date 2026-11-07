import type { AgentEvent, Decision, Message, Recommendation, Risk, Village } from './model'

export type Mode = 'live' | 'replay'
export type Level = 'RENDAH' | 'SEDANG' | 'TINGGI' | 'EKSTREM'
export type ActionStatus = 'proposed' | 'approved' | 'rejected' | 'done' | 'expired' | 'superseded'
export type ActionType = 'canal_block' | 'pump_standby' | 'dispatch_verify'
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type DataRecord = Record<string, Json>
export interface Items<T> { items: T[] }
export interface Context { mode?: Mode; day?: number }
export interface Provenance {
  source?: string | null
  stale?: boolean | null
  data_as_of?: string | null
  assumptions?: string[] | null
  reason?: string | null
}
export interface Config {
  mode: string
  public_demo: boolean
  source?: string
  outbound: string
  voice_mode: string
  poll_ms: number
  field_poll_ms: number
  voice_available: boolean
  browser_voice_supported?: boolean
}
export interface VillageMetadata extends Provenance {
  id: string; name: string; code?: string | null; lat: number; lon: number
}
export interface VillageStatus extends Provenance {
  village_id: string
  level: Level
  pfvi_level?: Level | null
  critical_now?: boolean
  critical_reason?: 'wt' | 'pfvi' | 'both' | null
  simulation_input_version?: string | null
  pfvi: number | null
  wt_cm: number | null
  wt_source?: 'modelled' | 'measured' | null
  days_to_critical: number | null
  critical_date: string | null
  confidence: number | null
  mode: Mode
  day: number
}
export interface ForecastPoint { date: string; pfvi: number | null; level: Level; wt_cm: number | null; rain_mm: number | null }
export interface SimulationInput extends Context { type: ActionType; targets: string[]; delta_hc_cm?: number | null; days?: number }
export interface Simulation extends Provenance {
  baseline_critical_date: string | null
  scenario_critical_date: string | null
  days_bought: number | null
  at_least_days: number | null
  wt_gain_cm: number | null
  pfvi_reduction: number | null
  curve_baseline: ForecastPoint[]
  curve_scenario: ForecastPoint[]
  model_setup?: DataRecord | null
}
export interface BackendAction {
  id: string; village_id: string; responder_id: string; title: string; reason: string
  kind: 'proposal' | 'verify'; type: ActionType; status: ActionStatus
  days_bought: number | null; at_least_days: number | null
  benefit: { wt_gain_cm: number | null; pfvi_reduction: number | null }
  created_at: string; expires_at: string; mode: Mode; day: number
  assumptions?: string[]; simulation_reason?: string | null; simulation?: Simulation
  simulation_request?: SimulationInput
  verifier: { decision: 'forward' | 'forward_with_flag' | 'hold'; checks: DataRecord[]; confidence_label?: string }
  trace_id?: string | null; observation_id?: string; approved_by?: string | null
  followup_message_id?: string; followup_status?: string; priority?: string
}
export interface Responder { id: string; village_id: string; name: string; role: string; tier: number | string; phone_last4: string | null; consent_at: string | null; last_contacted_at: string | null }
export interface BackendMessage { id: string; responder_id: string; direction: 'in' | 'out' | 'inbound' | 'outbound'; channel: string; body: string; speech: string | null; status: string; created_at: string; trace_id?: string | null }
export interface TraceEvent { id: string; agent: string; event: string; input: DataRecord; output: DataRecord; tool_calls: DataRecord[]; trace_id: string | null; created_at: string }
export interface Resources { pumps: number | null; crews: number | null; canal_blocks: { id: string; status: string }[] }
export interface ReplayMeta { scenario: string; start: string; end: string; days: number; perfect_forecast: boolean }
export interface ReplayMilestone { kind: 'wt_60' | 'pfvi_175' | 'pfvi_250' | 'critical'; day: number | null; date: string | null; wt_cm: number | null; pfvi: number | null; reason: string | null }
export interface ReplayMilestones extends ReplayMeta, Provenance { village_id: string; mode: 'replay'; items: ReplayMilestone[] }
export interface ReplayDay extends Items<VillageStatus> { mode: 'replay'; day: number; date: string }
export interface Progress extends Context { responder_id: string; state: string; observation_id: string | null; action_id: string | null; steps: { id: string; label: string; done: boolean }[]; counts: { messages: number; observations: number; actions: number } }
export interface FeatureCollection<P = DataRecord> { type: 'FeatureCollection'; features: { type: 'Feature'; geometry: { type: string; coordinates: Json }; properties: P }[] }
export interface Hotspots extends Provenance, Items<DataRecord> { available?: boolean; provider?: string; window_count?: number }
export interface ObservationInput extends Context {
  village_id: string; responder_id: string; wt_cm?: number | null; smoke?: boolean | null; fire?: boolean | null
  landmark_id?: string | null; note?: string; anonymous?: boolean; confirmed?: boolean
  water_category?: 'kering' | 'sedikit' | 'masih_ada' | 'banjir' | null
  smoke_category?: 'tidak' | 'bau' | 'terlihat' | 'api' | null
  place_text?: string | null; reported_words?: Record<string, string>
}
export interface Session { authenticated: boolean; public_demo?: boolean }
export interface BrowserStart extends Context { responder_id?: string }
export interface BrowserSimulationInput extends BrowserStart { session_id?: string; event_id: string; text: string }

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// Same-origin cookies only. Bodies, field tokens and auth values are never logged.
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\#]/.test(path)) throw new Error('Invalid API path')
  const headers = new Headers(options.headers)
  if (options.body !== undefined && options.body !== null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000)
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...options, headers, credentials: 'same-origin', redirect: 'error',
      signal,
    })
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))) throw error
    throw new ApiError(0, 'network', 'Layanan belum dapat dihubungi. Coba lagi.')
  }
  if (!response.ok) {
    let code = 'http_error', message = 'Layanan belum dapat dihubungi. Coba lagi.'
    try {
      const body = await response.json()
      if (typeof body.error?.code === 'string') code = body.error.code
      if (typeof body.error?.message === 'string') message = body.error.message
    } catch (error) { if (signal.aborted) throw error }
    throw new ApiError(response.status, code, message)
  }
  if (response.status === 204) return undefined as T
  try { return await response.json() as T } catch (error) {
    if (signal.aborted) throw error
    throw new ApiError(response.status, 'invalid_response', 'Respons layanan tidak valid.')
  }
}

type Query = Record<string, string | number | boolean | null | undefined>
function query(path: string, values: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null) params.set(key, String(value))
  return params.size ? `${path}?${params}` : path
}
const segment = (value: string) => encodeURIComponent(value)
const villagePath = (id: string, suffix: string) => `/villages/${segment(id)}/${suffix}`
const get = <T>(path: string, values: Query, signal?: AbortSignal) => api<T>(query(path, values), { signal })
const post = <T>(path: string, body: object, signal?: AbortSignal) => api<T>(path, { method: 'POST', body: JSON.stringify(body), signal })

export const backend = {
  config: (signal?: AbortSignal) => api<Config>('/config', { signal }),
  session: (signal?: AbortSignal) => api<Session>('/auth/session', { signal }),
  login: (pin: string, signal?: AbortSignal) => post<Session>('/auth/login', { pin }, signal),
  logout: (signal?: AbortSignal) => post<Session>('/auth/logout', {}, signal),
  villages: (signal?: AbortSignal) => api<Items<VillageMetadata>>('/villages', { signal }),
  status: (id: string, context: Context = {}, signal?: AbortSignal) => get<VillageStatus>(villagePath(id, 'status'), { ...context }, signal),
  forecast: (id: string, context: Context & { days?: number } = {}, signal?: AbortSignal) => get<Items<ForecastPoint>>(villagePath(id, 'forecast'), { ...context }, signal),
  simulate: (id: string, body: SimulationInput, signal?: AbortSignal) => post<Simulation>(villagePath(id, 'simulate'), body, signal),
  canals: (id: string, signal?: AbortSignal) => api<Items<DataRecord>>(villagePath(id, 'canals'), { signal }),
  resources: (id: string, signal?: AbortSignal) => api<Resources>(villagePath(id, 'resources'), { signal }),
  paramsHistory: (id: string, signal?: AbortSignal) => api<Items<DataRecord>>(villagePath(id, 'params/history'), { signal }),
  mapRisk: (context: Context & { date?: string } = {}, signal?: AbortSignal) => get<FeatureCollection<VillageStatus & { name: string }>>('/map/risk', { ...context }, signal),
  hotspots: (options: Context & { village_id?: string; hours?: number; radius_km?: number } = {}, signal?: AbortSignal) => get<Hotspots>('/hotspots', { ...options }, signal),
  osmCanals: (signal?: AbortSignal) => api<FeatureCollection & Provenance>('/canals/osm', { signal }),
  nationalHotspots: (days = 1, signal?: AbortSignal) => get<DataRecord>('/national/hotspots', { days }, signal),
  replayMeta: (signal?: AbortSignal) => api<ReplayMeta>('/replay/meta', { signal }),
  replayMilestones: (id: string, signal?: AbortSignal) => get<ReplayMilestones>('/replay/milestones', { village_id: id }, signal),
  replayDay: (day: number, signal?: AbortSignal) => api<ReplayDay>(`/replay/day/${segment(String(day))}`, { signal }),
  replayHotspotsSummary: (signal?: AbortSignal) => api<Provenance & DataRecord>('/replay/hotspots/summary', { signal }),
  archiveSummary: (signal?: AbortSignal) => api<Provenance & DataRecord>('/replay/hotspots/summary', { signal }),
  backtest: (id: string, signal?: AbortSignal) => get<DataRecord>('/backtest', { village_id: id }, signal),
  warmup: (mode: Mode = 'live', signal?: AbortSignal) => post<{ ready: boolean; villages: number }>(query('/warmup', { mode }), {}, signal),
  responders: (id?: string, signal?: AbortSignal) => get<Items<Responder>>('/responders', { village_id: id }, signal),
  messages: (id: string, after?: string, signal?: AbortSignal) => get<Items<BackendMessage>>(`/responders/${segment(id)}/messages`, { after }, signal),
  fieldLink: (id: string, signal?: AbortSignal) => api<{ field_path: string }>(`/responders/${segment(id)}/field-link`, { signal }),
  send: (id: string, text: string, channel: 'sms' | 'web' = 'sms', signal?: AbortSignal) => post<DataRecord>(`/responders/${segment(id)}/send`, { text, channel }, signal),
  demoInbound: (body: Context & { responder_id: string; text: string }, signal?: AbortSignal) => post<DataRecord>('/demo/inbound', body, signal),
  riskChanged: (body: Context & { village_id: string; level_to?: Level; hour_override?: number }, signal?: AbortSignal) => post<DataRecord>('/events/risk-changed', body, signal),
  scoutTick: (context: Context = {}, signal?: AbortSignal) => post<DataRecord>('/scout/tick', context, signal),
  policy: (signal?: AbortSignal) => api<DataRecord>('/policy', { signal }),
  trace: (options: { trace_id?: string; after?: string } = {}, signal?: AbortSignal) => get<Items<TraceEvent>>('/trace', options, signal),
  actions: (options: { village_id?: string; include_old?: boolean } = {}, signal?: AbortSignal) => get<Items<BackendAction> & { hidden_count: number }>('/actions', options, signal),
  approve: (id: string, signal?: AbortSignal) => post<BackendAction>(`/actions/${segment(id)}/approve`, {}, signal),
  reject: (id: string, reason = '', signal?: AbortSignal) => post<BackendAction>(`/actions/${segment(id)}/reject`, { reason }, signal),
  complete: (id: string, note = '', signal?: AbortSignal) => post<BackendAction>(`/actions/${segment(id)}/complete`, { note }, signal),
  progress: (id: string, signal?: AbortSignal) => get<Progress>('/demo/progress', { responder_id: id }, signal),
  observations: (id?: string, signal?: AbortSignal) => get<Items<DataRecord>>('/observations', { village_id: id }, signal),
  logObservation: (body: ObservationInput, signal?: AbortSignal) => post<DataRecord>('/observations', body, signal),
  fieldMessages: (token: string, after?: string, signal?: AbortSignal) => get<Items<BackendMessage> & { responder: { name: string; village_id: string } }>(`/field/${segment(token)}/messages`, { after }, signal),
  fieldSend: (token: string, text: string, signal?: AbortSignal) => post<DataRecord>(`/field/${segment(token)}/send`, { text, anonymous: false }, signal),
  voiceSimulate: (body: BrowserSimulationInput, signal?: AbortSignal) => post<DataRecord>('/voice/simulate', body, signal),
  voiceEnd: (session_id: string, signal?: AbortSignal) => post<DataRecord>('/voice/end', { session_id }, signal),
}

const risks: Record<Level, Risk> = { RENDAH: 'low', SEDANG: 'moderate', TINGGI: 'high', EKSTREM: 'critical' }
export function mapRisk(level: Level | null | undefined): Risk { return level ? risks[level] ?? 'unknown' : 'unknown' }
export function mapDecision(status: ActionStatus): Decision { return status === 'proposed' ? 'pending' : status }
export function mapVillage(metadata: VillageMetadata, status: VillageStatus | null, simulation?: Simulation, forecast?: ForecastPoint[], position: [number, number] = [metadata.lon, metadata.lat]): Village & { metadata: VillageMetadata; status: VillageStatus | null; simulation?: Simulation; forecastPoints?: ForecastPoint[] } {
  return {
    id: metadata.id, name: metadata.name, code: metadata.code ?? undefined, lat: metadata.lat, lng: metadata.lon, position,
    risk: mapRisk(status?.level), criticalIn: status?.days_to_critical ?? null,
    extraDays: simulation?.days_bought ?? null, pfvi: status?.pfvi, confidence: status?.confidence,
    waterTable: status?.wt_cm,
    forecast: forecast?.map(point => ({ RENDAH: 1, SEDANG: 2, TINGGI: 3, EKSTREM: 4 })[point.level] ?? null),
    source: status?.source, stale: status?.stale, dataAsOf: status?.data_as_of,
    criticalDate: status?.critical_date, criticalNow: status?.critical_now, statusReason: status?.reason, assumptions: status?.assumptions ?? undefined,
    metadata, status, simulation, forecastPoints: forecast,
  }
}
export function mapRecommendation(action: BackendAction, status?: VillageStatus): Recommendation & { raw: BackendAction } {
  return {
    id: action.id, villageId: action.village_id, title: action.title, reason: action.reason,
    status: mapDecision(action.status), extraDays: action.days_bought, risk: mapRisk(status?.level),
    evidence: action.verifier.checks.map(check => JSON.stringify(check)), assumptions: action.assumptions ?? [],
    pumps: null, createdAt: action.created_at, raw: action,
  }
}
export function mapMessage(message: BackendMessage, villageId: string): Message {
  return { id: message.id, villageId, direction: message.direction === 'in' || message.direction === 'inbound' ? 'in' : 'out', body: message.body, time: message.created_at }
}
export function mapTrace(event: TraceEvent): AgentEvent & { raw: TraceEvent } {
  return { id: event.id, time: event.created_at, agent: event.agent, title: event.event, detail: JSON.stringify({ input: event.input, output: event.output, tool_calls: event.tool_calls }), status: 'done', raw: event }
}

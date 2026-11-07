import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, backend, mapMessage, mapRecommendation, mapRisk, mapTrace, mapVillage, type BackendAction, type Config, type DataRecord, type FeatureCollection, type ForecastPoint, type Hotspots, type Progress, type ReplayMeta, type Responder, type Simulation, type VillageMetadata, type VillageStatus } from './backend'
import { initialState, riskLabels, type DemoAction, type DemoState } from './model'

const emptyState: DemoState = { ...initialState, villages: [], selectedVillageId: '', recommendations: [], messages: [], events: [], step: 0, smsSent: 0 }
export const errorText = (error: unknown) => error instanceof Error ? error.message : 'Layanan belum tersedia. Coba lagi.'
export const clockText = (value: string) => Number.isNaN(Date.parse(value)) ? value : new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const rank = { low: 1, moderate: 2, high: 3, critical: 4, unknown: 0 }
type Detail = { canals: DataRecord[]; resources: Awaited<ReturnType<typeof backend.resources>> | null; history: DataRecord[]; observations: DataRecord[]; milestones: Awaited<ReturnType<typeof backend.replayMilestones>> | null; backtest: DataRecord | null }
const emptyDetail: Detail = { canals: [], resources: null, history: [], observations: [], milestones: null, backtest: null }
const position = (item: VillageMetadata): [number, number] => [56 + (item.lon - 114.106) / .0016, 52 - (item.lat + 3.0905) / .0016]

export function useCommand() {
  const [state, setState] = useState<DemoState>(emptyState)
  const [config, setConfig] = useState<Config | null>(null)
  const [metadata, setMetadata] = useState<VillageMetadata[]>([])
  const [responders, setResponders] = useState<Responder[]>([])
  const [responderId, setResponderId] = useState('')
  const [replay, setReplay] = useState<ReplayMeta | null>(null)
  const [statuses, setStatuses] = useState<Record<string, VillageStatus>>({})
  const [forecast, setForecast] = useState<ForecastPoint[]>([])
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [risk, setRisk] = useState<FeatureCollection | null>(null)
  const [hotspots, setHotspots] = useState<Hotspots | null>(null)
  const [national, setNational] = useState<DataRecord | null>(null)
  const [nationalDays, setNationalDays] = useState(1)
  const [policy, setPolicy] = useState<DataRecord | null>(null)
  const [canalGeometry, setCanalGeometry] = useState<FeatureCollection | null>(null)
  const [archive, setArchive] = useState<DataRecord | null>(null)
  const [actions, setActions] = useState<BackendAction[]>([])
  const [actionsLoaded, setActionsLoaded] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [detail, setDetail] = useState<Detail>(emptyDetail)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [bootIndex, setBootIndex] = useState(0)
  const mutationLock = useRef(false)
  const context = { mode: state.mode, day: state.mode === 'live' ? 0 : state.replayIndex }
  const scopeKey = `${state.selectedVillageId}:${context.mode}:${context.day}`
  const scopeRef = useRef(scopeKey); scopeRef.current = scopeKey
  const responder = responders.find(item => item.id === responderId && item.village_id === state.selectedVillageId) ?? responders.find(item => item.village_id === state.selectedVillageId)
  const refresh = useCallback(() => setRefreshIndex(index => index + 1), [])
  const markError = useCallback((key: string, error: unknown) => {
    if (error instanceof ApiError && error.status === 401) { setUnauthorized(true); setState(emptyState); setConfig(null) }
    setErrors(previous => ({ ...previous, [key]: errorText(error) }))
  }, [])
  const clearError = useCallback((key: string) => setErrors(previous => { const next = { ...previous }; delete next[key]; return next }), [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void Promise.all([backend.config(controller.signal), backend.villages(controller.signal), backend.responders(undefined, controller.signal), backend.replayMeta(controller.signal)]).then(([cfg, villages, people, meta]) => {
      if (controller.signal.aborted) return
      setConfig(cfg); setMetadata(villages.items); setResponders(people.items); setReplay(meta); setUnauthorized(false); clearError('connection')
      setState(previous => {
        const requested = new URLSearchParams(window.location.search).get('village')
        const id = villages.items.some(item => item.id === previous.selectedVillageId) ? previous.selectedVillageId : villages.items.find(item => item.id === requested)?.id ?? villages.items[0]?.id ?? ''
        return { ...previous, selectedVillageId: id, villages: villages.items.map(item => mapVillage(item, null, undefined, undefined, position(item))) }
      })
    }).catch(error => { if (!controller.signal.aborted) markError('connection', error) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [bootIndex, clearError, markError])

  useEffect(() => {
    if (!config || !metadata.length || unauthorized) return
    const controller = new AbortController()
    let active = true, polling = false
    setStatuses({}); setRisk(null); setHotspots(null); setActionsLoaded(false)
    setState(previous => ({ ...previous, villages: metadata.map(item => mapVillage(item, null, undefined, undefined, position(item))) }))
    const poll = async () => {
      if (polling) return
      polling = true
      const capture = async <T,>(key: string, request: Promise<T>, apply: (value: T) => void) => {
        try { const value = await request; if (active) { apply(value); clearError(key) } } catch (error) { if (active) markError(key, error) }
      }
      await Promise.allSettled([
        capture('risk', backend.mapRisk(context, controller.signal), value => {
          setRisk(value as unknown as FeatureCollection)
          const next = Object.fromEntries(value.features.map(feature => [feature.properties.village_id, feature.properties]))
          setStatuses(next)
          setState(previous => ({ ...previous, villages: metadata.map(item => { const mapped = mapVillage(item, next[item.id] ?? null, undefined, undefined, position(item)); return { ...mapped, forecast: previous.villages.find(v => v.id === item.id)?.forecast } }) }))
        }),
        capture('actions', backend.actions({ include_old: true }, controller.signal), value => { setActions(value.items); setActionsLoaded(true) }),
        capture('trace', backend.trace({}, controller.signal), value => setState(previous => ({ ...previous, events: value.items.map(item => ({ ...mapTrace(item), time: clockText(item.created_at) })) }))),
        capture('hotspots', backend.hotspots({ ...context, hours: 72 }, controller.signal), setHotspots),
      ])
      polling = false
    }
    void poll()
    const timer = window.setInterval(() => void poll(), Math.max(4000, config.poll_ms || 4000))
    return () => { active = false; controller.abort(); window.clearInterval(timer) }
  }, [config, metadata, state.mode, state.replayIndex, unauthorized, refreshIndex, clearError, markError])

  useEffect(() => {
    setState(previous => ({ ...previous, recommendations: actions.filter(action => (action.mode ?? 'live') === previous.mode && (previous.mode === 'live' || action.day === previous.replayIndex)).map(action => ({ ...mapRecommendation(action, statuses[action.village_id]), createdAt: clockText(action.created_at) })) }))
  }, [actions, statuses, state.mode, state.replayIndex])

  useEffect(() => {
    if (!config || !state.selectedVillageId || unauthorized) return
    const controller = new AbortController()
    let active = true, polling = false
    setDetail(emptyDetail); setForecast([]); setProgress(null)
    setState(previous => ({ ...previous, messages: [], awaitingConfirmation: false, step: 0 }))
    const load = async () => {
      if (polling) return
      polling = true
      const capture = async <T,>(key: string, request: Promise<T>, apply: (value: T) => void) => {
        try { const value = await request; if (active) { apply(value); clearError(key) } } catch (error) { if (active) markError(key, error) }
      }
      const id = state.selectedVillageId
      await Promise.allSettled([
        capture('forecast', backend.forecast(id, { ...context, days: 14 }, controller.signal), value => { setForecast(value.items); setState(previous => ({ ...previous, villages: previous.villages.map(v => v.id === id ? { ...v, forecast: value.items.map(p => rank[mapRisk(p.level)] || null) } : v) })) }),
        capture('canals', backend.canals(id, controller.signal), value => setDetail(previous => ({ ...previous, canals: value.items }))),
        capture('resources', backend.resources(id, controller.signal), resources => setDetail(previous => ({ ...previous, resources }))),
        capture('history', backend.paramsHistory(id, controller.signal), value => setDetail(previous => ({ ...previous, history: value.items }))),
        capture('observations', backend.observations(id, controller.signal), value => setDetail(previous => ({ ...previous, observations: value.items }))),
        ...(responder ? [
          capture('messages', backend.messages(responder.id, undefined, controller.signal), value => setState(previous => ({ ...previous, messages: value.items.map(item => ({ ...mapMessage(item, id), time: clockText(item.created_at) })), smsSent: value.items.filter(m => m.direction === 'out' || m.direction === 'outbound').length }))),
          capture('progress', backend.progress(responder.id, controller.signal), value => { const matching = value.mode === context.mode && (context.mode === 'live' || value.day === context.day); setProgress(matching ? value : null); setState(previous => ({ ...previous, step: matching ? value.steps.filter(step => step.done).length : 0, awaitingConfirmation: matching && value.state === 'confirm' })) }),
        ] : []),
      ])
      polling = false
    }
    void load()
    const timer = window.setInterval(() => void load(), Math.max(4000, config.poll_ms || 4000))
    return () => { active = false; controller.abort(); window.clearInterval(timer) }
  }, [config, state.selectedVillageId, state.mode, state.replayIndex, responder?.id, unauthorized, refreshIndex, clearError, markError])

  useEffect(() => { setSimulation(null) }, [state.selectedVillageId, state.mode, state.replayIndex])

  useEffect(() => {
    if (!config || unauthorized) return
    const controller = new AbortController()
    const optional = async <T,>(key: string, request: Promise<T>, apply: (value: T) => void) => {
      try { const value = await request; if (!controller.signal.aborted) { apply(value); clearError(key) } } catch (error) { if (!controller.signal.aborted) markError(key, error) }
    }
    let nationalLoading = false
    const pollNational = async () => {
      if (nationalLoading) return
      nationalLoading = true
      await optional('national', backend.nationalHotspots(nationalDays, controller.signal), setNational)
      nationalLoading = false
    }
    setNational(null)
    void Promise.allSettled([
      pollNational(),
      optional('policy', backend.policy(controller.signal), setPolicy),
      optional('osm', backend.osmCanals(controller.signal), value => setCanalGeometry(value)),
      optional('archive', backend.replayHotspotsSummary(controller.signal), value => setArchive(value as DataRecord)),
    ])
    const timer = window.setInterval(() => void pollNational(), Math.max(4000, config.poll_ms || 4000))
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [config, nationalDays, refreshIndex, unauthorized, clearError, markError])

  const loadHistory = async () => {
    const id = state.selectedVillageId
    const scope = scopeKey
    await Promise.allSettled([
      backend.replayMilestones(id).then(milestones => { if (scopeRef.current === scope) setDetail(previous => ({ ...previous, milestones })) }).catch(error => { if (scopeRef.current === scope) markError('milestones', error) }),
      backend.backtest(id).then(backtest => { if (scopeRef.current === scope) setDetail(previous => ({ ...previous, backtest })) }).catch(error => { if (scopeRef.current === scope) markError('backtest', error) }),
    ])
  }
  const run = async (work: () => Promise<unknown>, notice: string) => {
    if (mutationLock.current) return false
    mutationLock.current = true; setBusy(true); clearError('operation')
    try { await work(); setState(previous => ({ ...previous, notice })); refresh(); return true }
    catch (error) { markError('operation', error); return false }
    finally { mutationLock.current = false; setBusy(false) }
  }
  const dispatch = (action: DemoAction) => {
    switch (action.type) {
      case 'select-village': setResponderId(''); setState(previous => ({ ...previous, selectedVillageId: action.id })); break
      case 'mode-switch': setState(previous => ({ ...previous, mode: action.mode, replayPlaying: false, messages: [], recommendations: [] })); break
      case 'replay-seek': setState(previous => ({ ...previous, replayIndex: Math.max(0, Math.min((replay?.days ?? 1) - 1, action.index)), replayPlaying: false })); break
      case 'replay-step': setState(previous => { const index = Math.max(0, Math.min((replay?.days ?? 1) - 1, previous.replayIndex + action.delta)); return { ...previous, replayIndex: index, replayPlaying: previous.replayPlaying && index < (replay?.days ?? 1) - 1 } }); break
      case 'replay-toggle': setState(previous => ({ ...previous, replayPlaying: !previous.replayPlaying, replayIndex: previous.replayIndex >= (replay?.days ?? 1) - 1 ? 0 : previous.replayIndex })); break
      case 'decision': void run(() => action.decision === 'approved' ? backend.approve(action.id) : backend.reject(action.id, 'Ditolak operator setelah meninjau bukti'), action.decision === 'approved' ? 'Persetujuan tersimpan. Pelaksanaan lapangan belum dikonfirmasi.' : 'Penolakan tersimpan.'); break
      case 'simulate-trigger': void run(() => backend.riskChanged({ ...context, village_id: state.selectedVillageId, ...(config?.public_demo ? { level_to: 'TINGGI', hour_override: 10 } : {}) }), 'Scout memproses peringatan; periksa percakapan responder.'); break
      case 'sms-send': if (responder && config?.public_demo) void run(() => backend.demoInbound({ ...context, responder_id: responder.id, text: action.text }), 'Balasan diproses Warden.'); break
      case 'query': {
        const visible = state.villages.filter(v => v.risk !== 'unknown').sort((a, b) => rank[b.risk] - rank[a.risk])
        const village = visible.find(v => action.text.toLowerCase().includes(v.name.toLowerCase())) ?? visible[0]
        setState(previous => ({ ...previous, query: action.text, queryAnswer: village ? `${village.name}: risiko ${riskLabels[village.risk]}, PFVI ${village.pfvi ?? 'belum tersedia'}, air tanah model ${village.waterTable ?? 'belum tersedia'} cm. ${village.criticalIn == null ? 'Ambang kritis tidak terlintasi dalam horizon yang tersedia.' : `Ambang kritis model dalam ${village.criticalIn} hari.`} Ringkasan data engine.` : 'Status desa belum tersedia dari engine.' })); break
      }
      case 'dismiss-guide': setState(previous => ({ ...previous, guideVisible: false })); break
      case 'clear-notice': setState(previous => ({ ...previous, notice: '' })); break
      default: break
    }
  }
  const simulate = async (target: string, raise: number, days: number) => {
    const scope = scopeKey
    await run(async () => { const result = await backend.simulate(state.selectedVillageId, { ...context, type: 'canal_block', targets: [target], delta_hc_cm: raise, days }); if (scopeRef.current === scope) setSimulation(result) }, 'Simulasi selesai dihitung oleh engine.')
  }
  const inputVersion = statuses[state.selectedVillageId]?.simulation_input_version
  const previousInput = useRef(inputVersion)
  useEffect(() => { if (!inputVersion) return; if (previousInput.current && previousInput.current !== inputVersion) setSimulation(null); previousInput.current = inputVersion }, [inputVersion])
  const frames = replay ? Array.from({ length: replay.days }, (_, index) => { const date = new Date(`${replay.start}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + index); return { date: date.toISOString().slice(0, 10), label: `${new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(date)} · hari ke-${index + 1}` } }) : []
  return { state, dispatch, config, statuses, forecast, simulation, risk, hotspots, national, nationalDays, setNationalDays, policy, canalGeometry, archive, actions, actionsLoaded, progress, detail, responders, responder, setResponderId, replay, frames, loading, busy, errors, unauthorized, refresh, reconnect: () => setBootIndex(index => index + 1), run, simulate, loadHistory, markError }
}
export type Command = ReturnType<typeof useCommand>

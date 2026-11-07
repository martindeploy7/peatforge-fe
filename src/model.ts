export type Risk = 'low' | 'moderate' | 'high' | 'critical' | 'unknown'
export type Decision = 'pending' | 'approved' | 'rejected' | 'done' | 'expired' | 'superseded'

export interface Village {
  id: string
  name: string
  risk: Risk
  district?: string
  code?: string
  criticalIn: number | null
  extraDays: number | null
  pfvi?: number | null
  confidence?: number | null
  lat?: number
  lng?: number
  waterTable?: number | null
  rainfall?: number
  dryDays?: number
  canalBlocks?: number
  position: [number, number]
  forecast?: (number | null)[]
  source?: string | null
  stale?: boolean | null
  dataAsOf?: string | null
  criticalDate?: string | null
  criticalNow?: boolean
  statusReason?: string | null
  assumptions?: string[]
}

export interface Recommendation {
  id: string
  villageId: string
  title: string
  reason: string
  status: Decision
  extraDays: number | null
  risk: Risk
  fromRisk?: Risk
  evidence: string[]
  assumptions: string[]
  score?: number
  crew?: number
  pumps: number | null
  createdAt: string
}

export interface Message {
  id: string
  villageId: string
  direction: 'in' | 'out'
  body: string
  translation?: string
  time: string
}

export interface AgentEvent {
  id: string
  time: string
  agent: string
  title: string
  detail: string
  status: 'done' | 'active' | 'waiting'
  level?: number
}

// Map positions are local layout coordinates; they are not recovered geographic data.
export const villages: Village[] = [
  { id: 'talio', name: 'Talio', risk: 'high', district: 'Pandih Batu', code: '62.11.01.2002', criticalIn: 4, extraDays: 5, position: [56, 52], forecast: [3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { id: 'dandang', name: 'Dandang', risk: 'moderate', criticalIn: null, extraDays: 0, position: [72, 78] },
  { id: 'pangkoh-hilir', name: 'Pangkoh Hilir', risk: 'low', criticalIn: null, extraDays: 0, position: [84, 37] },
  { id: 'kantan-muara', name: 'Kantan Muara', risk: 'high', criticalIn: null, extraDays: 1, position: [39, 18] },
  { id: 'talio-hulu', name: 'Talio Hulu', risk: 'moderate', criticalIn: null, extraDays: 0, position: [28, 63] },
]

const initialRecommendation: Recommendation = {
  id: 'kantan-pump', villageId: 'kantan-muara', title: 'Siagakan pompa di pos MPA',
  reason: 'Risiko di Kantan Muara naik ke tinggi.', status: 'pending', extraDays: 1,
  risk: 'high', evidence: ['Prakiraan kering 5 hari', 'Muka air tanah -52 cm (model)'], assumptions: ['Sekat K2 tertutup'], score: 0.71, pumps: 1, createdAt: '09:53',
}

const initialMessages: Message[] = [
  { id: 'talio-warning', villageId: 'talio', direction: 'out', time: '08:58', body: 'Warden BPBD Pulang Pisau. Desa Talio: risiko kebakaran TINGGI. Perkiraan kritis dalam 4 hari (keyakinan sedang).', translation: 'Warden BPBD Pulang Pisau. Talio village: fire risk HIGH. Critical expected in 4 days (medium confidence).' },
  { id: 'talio-instruction', villageId: 'talio', direction: 'out', time: '08:58', body: 'Langkah: cek sekat K3-K5, siapkan pompa, umumkan larangan bakar. Balas: AIR (cm) dan ASAP YA/TIDAK.', translation: 'Steps: check the K3-K5 blocks, prepare the pump, announce the burning ban. Reply: AIR (cm) and ASAP YES/NO.' },
]

export interface ReplayFrame { date: string; label: string }
export const replayFrames: ReplayFrame[] = Array.from({ length: 60 }, (_, index) => {
  const date = new Date(Date.UTC(2019, 7, 1 + index))
  const weekday = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][date.getUTCDay()]
  const day = `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  return { date: date.toISOString().slice(0, 10), label: `${weekday} ${day} · hari ke-${index + 1}` }
})

export function selectVillages(state: DemoState): Village[] {
  if (state.mode === 'live') return state.villages
  // shortcut: hold the nearest observed risk snapshot; replace when a complete replay is observed.
  const risks: Risk[] = state.replayIndex >= 59 ? ['high', 'critical', 'high', 'high', 'critical']
    : state.replayIndex >= 12 ? ['moderate', 'moderate', 'moderate', 'low', 'moderate']
    : ['low', 'low', 'moderate', 'low', 'moderate']
  return state.villages.map((village, index) => ({ ...village, risk: risks[index]!, criticalIn: village.id === 'talio' ? Math.max(0, 53 - state.replayIndex) : null, extraDays: village.id === 'talio' ? 5 : village.extraDays, forecast: undefined }))
}

export interface DemoState {
  villages: Village[]
  selectedVillageId: string
  recommendations: Recommendation[]
  replayIndex: number
  replayPlaying: boolean
  mode: 'live' | 'replay'
  query: string
  queryAnswer: string
  messages: Message[]
  simulationOpen: boolean
  simulationDays: number
  traceOpen: boolean
  notice: string
  step: number
  events: AgentEvent[]
  guideVisible: boolean
  smsSent: number
  awaitingConfirmation: boolean
  pendingReportVillageId: string | null
  pendingReportWaterLevel: number | null
  simulatedVillageIds: string[]
}

export const initialState: DemoState = {
  villages,
  selectedVillageId: 'talio', recommendations: [initialRecommendation], replayIndex: 0,
  replayPlaying: false, mode: 'live', query: '', queryAnswer: '', messages: initialMessages,
  simulationOpen: false, simulationDays: 4, traceOpen: false, notice: '', step: 3,
  events: [
    { id: 'initial-scout-tool', time: '08:58', agent: 'SCOUT', level: 0, title: 'tool', detail: 'Ambil status desa Talio dari engine', status: 'done' },
    { id: 'initial-scout-policy', time: '08:58', agent: 'SCOUT', level: 1, title: 'policy', detail: 'Kirim SMS status ke Ketua MPA Talio (kuota 1/hari)', status: 'done' },
  ],
  guideVisible: true, smsSent: 0, awaitingConfirmation: false, pendingReportVillageId: null, pendingReportWaterLevel: null, simulatedVillageIds: [],
}

export type DemoAction =
  | { type: 'select-village'; id: string }
  | { type: 'decision'; id: string; decision: 'approved' | 'rejected' }
  | { type: 'replay-seek'; index: number }
  | { type: 'replay-step'; delta: number }
  | { type: 'replay-toggle' }
  | { type: 'mode-switch'; mode: 'live' | 'replay' }
  | { type: 'query'; text: string }
  | { type: 'simulation-open'; open: boolean }
  | { type: 'simulation-days'; days: number }
  | { type: 'simulate-trigger' }
  | { type: 'sms-send'; text: string }
  | { type: 'trace-toggle' }
  | { type: 'dismiss-guide' }
  | { type: 'clear-notice' }

export function selectVillage(state: DemoState): Village {
  const visible = selectVillages(state)
  return visible.find(village => village.id === state.selectedVillageId) ?? visible[0]!
}

export function selectMetrics(state: DemoState) {
  return {
    pending: state.recommendations.filter(item => item.status === 'pending').length,
    highVillages: selectVillages(state).filter(village => village.risk === 'high' || village.risk === 'critical').length,
    hotspots: state.mode === 'replay' && state.replayIndex === 59 ? 16 : 0,
    smsSent: state.smsSent,
  }
}

export function answerQuery(state: DemoState, text: string): string {
  const query = text.trim().toLocaleLowerCase('id')
  if (!query) return ''
  const visible = selectVillages(state)
  if (/prioritas|paling|tinggi|urgent|mendesak/.test(query)) {
    const rank: Record<Risk, number> = { unknown: 0, low: 1, moderate: 2, high: 3, critical: 4 }
    const highest = Math.max(...visible.map(village => rank[village.risk]))
    const priority = visible.filter(village => rank[village.risk] === highest)
    const talio = visible.find(village => village.id === 'talio')!
    const countdown = talio.criticalIn === 0 ? 'Talio perlu tindakan hari ini.' : `Talio perlu tindakan dalam ${talio.criticalIn} hari.`
    return `${priority.map(village => village.name).join(' dan ')} berisiko ${riskLabels[priority[0]!.risk].toLocaleLowerCase('id')}. ${countdown} Menutup sekat kanal memberi ${talio.extraDays} hari tambahan.`
  }
  if (/usul|pompa|tindakan|rekomendasi/.test(query)) {
    const pending = state.recommendations.filter(item => item.status === 'pending')
    if (!pending.length) return 'Tidak ada usulan yang menunggu keputusan.'
    return `${pending.length} usulan menunggu keputusan: ${pending.map(item => `${item.title} (${visible.find(village => village.id === item.villageId)!.name}, +${item.extraDays} hari aman)`).join('; ')}.`
  }
  const village = visible.find(item => query.includes(item.name.toLocaleLowerCase('id'))) ?? selectVillage(state)
  if (village.criticalIn !== null) return `${village.name} ${village.criticalIn === 0 ? 'perlu tindakan hari ini' : `perlu tindakan dalam ${village.criticalIn} hari`}. Menutup sekat kanal memberi ${village.extraDays} hari tambahan.`
  return `Desa ${village.name} berisiko ${riskLabels[village.risk].toLocaleLowerCase('id')}. Rincian tambahan belum teramati pada referensi.`
}

export const riskLabels: Record<Risk, string> = { low: 'Rendah', moderate: 'Sedang', high: 'Tinggi', critical: 'Ekstrem', unknown: 'Belum tersedia' }

function withTalioProposal(state: DemoState, repeat: boolean): Recommendation[] {
  if (!repeat && state.recommendations.some(item => item.villageId === 'talio' && item.status === 'pending')) return state.recommendations
  const sequence = state.recommendations.filter(item => item.villageId === 'talio').length + 1
  return [...state.recommendations, { id: `talio-canal-${sequence}`, villageId: 'talio', title: 'Tutup sekat K3-K5, patroli K4', reason: 'Risiko di Talio naik ke ekstrem.', status: 'pending', extraDays: 4, risk: 'critical', fromRisk: 'high', evidence: ['Laporan relawan desa'], assumptions: [], crew: 6, pumps: 1, createdAt: 'Sekarang' }]
}

function seekReplay(state: DemoState, index: number): DemoState {
  if (!Number.isFinite(index)) return state
  const replayIndex = Math.max(0, Math.min(Math.max(0, replayFrames.length - 1), Math.trunc(index)))
  return { ...state, replayIndex, replayPlaying: state.replayPlaying && replayIndex < replayFrames.length - 1 }
}

function reduceDemo(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'select-village':
      return state.villages.some(village => village.id === action.id) ? { ...state, selectedVillageId: action.id, notice: '' } : state
    case 'decision': {
      const item = state.recommendations.find(recommendation => recommendation.id === action.id)
      if (!item || item.status !== 'pending') return state
      const approved = action.decision === 'approved'
      return { ...state,
        recommendations: state.recommendations.map(recommendation => recommendation.id === item.id ? { ...recommendation, status: action.decision } : recommendation),
        step: approved ? 5 : 3,
        notice: approved ? 'Usulan disetujui dalam demo lokal.' : 'Usulan ditolak dalam demo lokal.',
        events: [...state.events, { id: `decision-${item.id}`, time: 'Sekarang', agent: 'OPERATOR', title: approved ? 'approve' : 'reject', detail: `Operator ${approved ? 'menyetujui' : 'menolak'}: ${item.title}`, status: 'done' }],
        messages: approved ? [...state.messages, { id: `approved-${item.id}`, villageId: item.villageId, direction: 'out', time: 'Sekarang', body: `Tindak lanjut: operator menyetujui "${item.title}". Terima kasih atas laporan Anda.`, translation: `Follow-up: the operator approved "${item.title}". Thank you for your report.` }] : state.messages,
        smsSent: state.smsSent + (approved ? 1 : 0),
      }
    }
    case 'replay-seek': return seekReplay(state, action.index)
    case 'replay-step': return seekReplay(state, state.replayIndex + action.delta)
    case 'replay-toggle': return replayFrames.length > 1 ? { ...state, replayPlaying: !state.replayPlaying, replayIndex: !state.replayPlaying && state.replayIndex === replayFrames.length - 1 ? 0 : state.replayIndex } : state
    case 'mode-switch': return { ...state, mode: action.mode, replayPlaying: false }
    case 'query': return { ...state, query: action.text.trim(), queryAnswer: answerQuery(state, action.text), notice: '' }
    case 'clear-notice': return { ...state, notice: '' }
    case 'simulation-open': return { ...state, simulationOpen: action.open }
    case 'simulation-days': return Number.isFinite(action.days) ? { ...state, simulationDays: Math.max(1, Math.min(14, Math.trunc(action.days))) } : state
    case 'trace-toggle': return { ...state, traceOpen: !state.traceOpen }
    case 'dismiss-guide': return { ...state, guideVisible: false }
    case 'simulate-trigger': {
      const village = selectVillage(state)
      // shortcut: only Talio's simulation was observed; extend after observing another village flow.
      if (village.id !== 'talio' || state.mode !== 'live') return { ...state, notice: 'Simulasi yang direkonstruksi tersedia untuk Desa Talio pada mode Live.' }
      const sequence = state.simulatedVillageIds.length + 1
      return { ...state,
        villages: state.villages.map(item => item.id === village.id ? { ...item, risk: 'critical' } : item),
        recommendations: withTalioProposal(state, true),
        messages: [...state.messages, { id: `talio-simulation-warning-${sequence}`, villageId: village.id, direction: 'out', time: 'Sekarang', body: 'Warden BPBD Pulang Pisau. Desa Talio: risiko kebakaran EKSTREM. Balas: AIR (cm) dan ASAP YA/TIDAK.', translation: 'Warden BPBD Pulang Pisau. Talio village: EXTREME fire risk. Reply: AIR (cm) and ASAP YES/NO.' }],
        events: [...state.events,
          { id: `simulation-talio-${sequence}`, agent: 'SCOUT', level: 1, time: 'Sekarang', title: 'trigger', detail: 'Simulasi kenaikan risiko Talio: TINGGI ke EKSTREM', status: 'done' },
          { id: `simulation-sms-${sequence}`, agent: 'WARDEN', level: 1, time: 'Sekarang', title: 'message', detail: 'SMS status terkirim ke Ketua MPA Talio', status: 'done' },
          { id: `simulation-check-${sequence}`, agent: 'VERIFIER', level: 2, time: 'Sekarang', title: 'check', detail: 'Hotspot 1,2 km / 6 jam cocok dengan laporan', status: 'done' },
          { id: `simulation-plan-${sequence}`, agent: 'PLANNER', level: 2, time: 'Sekarang', title: 'propose', detail: 'Usulan: Tutup sekat K3-K5, patroli K4 (Talio)', status: 'done' },
        ],
        simulatedVillageIds: [...state.simulatedVillageIds, village.id], smsSent: state.smsSent + 1, step: 3,
        notice: 'Peringatan simulasi dikirim ke agen pemantau.',
      }
    }
    case 'sms-send': {
      const text = action.text.trim()
      if (!text) return state
      const messages: Message[] = [...state.messages, { id: `sms-${state.messages.length}`, villageId: state.selectedVillageId, direction: 'in', body: text, time: 'Sekarang' }]
      const report = text.match(/AIR\s*(\d+)\s*ASAP\s*(YA|TIDAK)/i)
      if (report) {
        const smoke = report[2]!.toUpperCase() === 'YA' ? 'asap terlihat' : 'tidak ada asap'
        messages.push({ id: `confirm-${messages.length}`, villageId: state.selectedVillageId, direction: 'out', body: `Saya catat: air sumur ${report[1]} cm, ${smoke}. Betul? Balas YA atau TIDAK.`, translation: `Recorded: well water ${report[1]} cm, ${report[2]!.toUpperCase() === 'YA' ? 'smoke seen' : 'no smoke'}. Correct? Reply YES or NO.`, time: 'Sekarang' })
      }
      const matchesReport = state.awaitingConfirmation && state.pendingReportVillageId === state.selectedVillageId
      const confirmed = matchesReport && text.toUpperCase() === 'YA'
      const denied = matchesReport && text.toUpperCase() === 'TIDAK'
      const observedCalibration = confirmed && state.selectedVillageId === 'talio' && state.pendingReportWaterLevel === 61
      if (confirmed) messages.push({ id: `thanks-${messages.length}`, villageId: state.selectedVillageId, direction: 'out', body: 'Terima kasih, laporan dicatat. Usulan tindakan dikirim ke operator.', translation: 'Thank you, the report is saved. An action proposal was sent to the operator.', time: 'Sekarang' })
      if (denied) messages.push({ id: `denied-${messages.length}`, villageId: state.selectedVillageId, direction: 'out', body: 'Baik, tidak dicatat. Kirim ulang: AIR (cm) dan ASAP YA/TIDAK.', translation: 'OK, not saved. Resend: AIR (cm) and ASAP YES/NO.', time: 'Sekarang' })
      // shortcut: TELP and malformed-report replies are local guidance; source replies were not observed.
      if (!report && !confirmed && !denied) messages.push({ id: `guidance-${messages.length}`, villageId: state.selectedVillageId, direction: 'out', body: text.toUpperCase() === 'TELP' ? 'Permintaan telepon dicatat pada demo lokal.' : 'Kirim laporan dengan format AIR (cm) dan ASAP YA/TIDAK.', time: 'Sekarang' })
      const events: AgentEvent[] = [...state.events, { id: `inbound-${state.messages.length}`, time: 'Sekarang', agent: 'WARDEN', level: 1, title: 'inbound', detail: `Pesan masuk dari ${state.selectedVillageId === 'talio' ? 'Pak Rahmat' : `relawan ${selectVillage(state).name}`}: ${text}`, status: 'done' }]
      return { ...state, messages, awaitingConfirmation: report ? true : confirmed || denied ? false : state.awaitingConfirmation,
        pendingReportVillageId: report ? state.selectedVillageId : confirmed || denied ? null : state.pendingReportVillageId,
        pendingReportWaterLevel: report ? Number(report[1]) : confirmed || denied ? null : state.pendingReportWaterLevel,
        recommendations: confirmed && state.selectedVillageId === 'talio' ? withTalioProposal(state, false) : state.recommendations,
        villages: observedCalibration ? state.villages.map(village => village.id === 'talio' ? { ...village, pfvi: 231, waterTable: -55, confidence: 0.68 } : village) : state.villages,
        events: confirmed ? [...events, { id: `recalibrate-${messages.length}`, time: 'Sekarang', agent: 'ENGINE', level: 0, title: 'recalibrate', detail: observedCalibration ? 'Kalibrasi ulang parameter v1 ke v2: k_drain 0.042 → 0.047; sy 0.35 → 0.33 (observasi muka air -61 cm).' : 'Laporan dikonfirmasi pada demo lokal; hasil kalibrasi angka ini belum teramati.', status: 'done' }] : events,
        notice: report ? 'Laporan menunggu konfirmasi.' : confirmed ? 'Laporan dikonfirmasi pada demo lokal.' : 'Laporan disimpan pada demo lokal.', step: report ? 2 : confirmed ? 3 : state.step }
    }
  }
}

export function reducer(state: DemoState, action: DemoAction): DemoState {
  const next = reduceDemo(state, action)
  if (next === state || !next.query) return next
  const queryAnswer = answerQuery(next, next.query)
  return queryAnswer === next.queryAnswer ? next : { ...next, queryAnswer }
}

import { useEffect, useRef, useState } from 'react'
import { Check, CircleHelp, Menu, Moon, Pause, Play, Search, Send, Share2, Smartphone, Sun, X, Zap } from 'lucide-react'
import RiskMap from './RiskMap'
import { riskLabels, type Recommendation, type Risk } from './model'
import type { FeatureCollection as GeoJSONCollection } from 'geojson'
import { backend, type BackendAction } from './backend'
import { useCommand, type Command } from './useCommand'
import { DecisionHistory, NationalData, SimulationPanel, VillageData } from './BackendPanels'
import VoicePanel from './voice/VoicePanel'
import FieldPage from './FieldPage'
import SourceDetails from './SourceDetails'

const riskOrder: Risk[] = ['low', 'moderate', 'high', 'critical']
const steps = ['Peringatan', 'Laporan', 'Usulan', 'Disetujui', 'Tindak lanjut']
const progress = ['Belum dimulai.', 'Peringatan dikirim. Agen pemantau mengabari relawan desa.', 'Laporan lapangan diterima. Agen memeriksa kondisi desa.', 'Usulan siap. Agen menyusun tindakan. Menunggu keputusan Anda.', 'Disetujui. Tindakan diteruskan kepada relawan.', 'Warga dikabari. Relawan menerima kabar tindak lanjut.']
const formatDate = (date?: string) => date ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', weekday: 'short' }).format(new Date(`${date}T12:00:00`)) : 'Belum tersedia'

export function RiskBadge({ risk, arrow = false }: { risk: Risk; arrow?: boolean }) {
  return <span className={`risk-badge risk-${risk}`}><span className="risk-bars" aria-hidden="true">{[0, 1, 2, 3].map(i => <i key={i} style={{ opacity: i <= riskOrder.indexOf(risk) ? 1 : .2, height: 4 + i * 3 }} />)}</span>{riskLabels[risk]}{arrow && ' ↑'}</span>
}

function DecisionCard({ item, raw, villageName, locked, onDecision, onTrace, onSelect }: { item: Recommendation; raw?: BackendAction; villageName: string; locked: boolean; onDecision: (id: string, decision: 'approved' | 'rejected') => void; onTrace: () => void; onSelect: (id: string) => void }) {
  const benefitDays = item.extraDays ?? raw?.at_least_days
  return <article className={`decision-card triage-item triage-risk-${item.risk}`} aria-label={item.title}>
    <div className="decision-top"><span className="pending-badge"><i />Menunggu keputusan</span><RiskBadge risk={item.risk} arrow /><time>{item.createdAt}</time></div>
    <h3>{item.title}</h3><p className="muted decision-location"><button className="decision-village-button" aria-label={`Pilih Desa ${villageName} di peta dan panel`} onClick={() => onSelect(item.villageId)}>Desa {villageName}</button></p><p className="decision-reason">{item.reason}</p>
    <div className={`decision-benefit${benefitDays != null && benefitDays > 0 ? ' has-benefit' : ''}`}><strong>{item.extraDays != null ? `${item.extraDays} hari penundaan model` : raw?.at_least_days != null ? `Setidaknya ${raw.at_least_days} hari penundaan` : raw?.kind === 'verify' ? 'Perlu verifikasi lapangan' : 'Tambahan hari belum dapat dihitung'}</strong><span>{raw?.observation_id ? 'Laporan lapangan terkonfirmasi' : 'Usulan engine'}{item.crew ? ` · ${item.crew} regu` : ''}{item.pumps ? ` · ${item.pumps} pompa` : ''}</span></div>
    <div className="decision-actions"><button className="button primary" disabled={locked} onClick={() => onDecision(item.id, 'approved')}>Setujui</button><button className="button" disabled={locked} onClick={() => onDecision(item.id, 'rejected')}>Tolak</button></div>
    <details className="evidence"><summary>Kenapa usulan ini?</summary><div>{item.evidence.map((text, i) => <p key={`e${i}`}><span className="evidence-label">Bukti</span>{text}</p>)}{item.assumptions.map((text, i) => <p key={`a${i}`}><span className="evidence-label assumption">Asumsi agen</span>{text}</p>)}<p>Kekuatan bukti: {item.score == null ? 'Belum tersedia' : `${item.score >= .75 ? 'Kuat' : 'Cukup'} (${item.score.toFixed(2)})`}</p><button className="text-button" onClick={onTrace}>Lihat jejak agen</button></div></details>
  </article>
}

function ForecastChart({ command }: { command: Command }) {
  const points = command.forecast
  if (!points.length) return <p className="muted">{command.errors.forecast ?? 'Prakiraan belum tersedia dari engine.'}</p>
  return <><svg className="forecast-chart" viewBox="0 0 300 132" role="img" aria-label="Prakiraan PFVI dari engine"><path d="M12 100H286 M12 66H286 M12 32H286" className="chart-grid" /><path d="M12 27H286" className="chart-threshold" /><text x="283" y="22" textAnchor="end">kritis 250</text><path d={points.map((point, index) => point.pfvi == null ? '' : `${index === 0 || points[index - 1].pfvi == null ? 'M' : 'L'}${12 + index * 274 / Math.max(1, points.length - 1)},${110 - point.pfvi / 300 * 100}`).join(' ')} className="chart-baseline" fill="none" /><text x="12" y="128">{points[0].date}</text><text x="284" y="128" textAnchor="end">{points.at(-1)?.date}</text></svg><small className="muted">PFVI model 0–300 · {points.length} titik prakiraan engine.</small></>
}

export function CommandWorkspace({ command }: { command: Command }) {
  const { state, dispatch, busy, frames: replayFrames } = command
  const [theme, setTheme] = useState<'light' | 'dark'>(() => { try { return localStorage.getItem('rebuild-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' } })
  const [scope, setScope] = useState<'pilot' | 'national'>('pilot')
  const [context, setContext] = useState('village')
  const [query, setQuery] = useState('')
  const [reply, setReply] = useState('')
  const [outboundMessage, setOutboundMessage] = useState('')
  const [decision, setDecision] = useState<{ id: string; kind: 'approved' | 'rejected' } | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const decisionDialog = useRef<HTMLDialogElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const share = useRef<HTMLDialogElement>(null)
  const [shareNotice, setShareNotice] = useState('')
  const help = useRef<HTMLDialogElement>(null)
  const phoneEnd = useRef<HTMLDivElement>(null)
  const pending = state.recommendations.filter(item => item.status === 'pending')
  const proposalStep = command.actions.some(action => action.id === command.progress?.action_id && action.status === 'proposed') ? 2 : -1
  const village = state.villages.find(item => item.id === state.selectedVillageId) ?? state.villages[0]
  const metrics = { pending: command.actionsLoaded ? pending.length : 'Memuat', highVillages: state.villages.some(v => v.risk !== 'unknown') ? state.villages.filter(v => v.risk === 'high' || v.risk === 'critical').length : 'N/A', hotspots: command.errors.hotspots || !command.hotspots?.available ? 'N/A' : command.hotspots.items.length, smsSent: state.smsSent }
  const messages = state.messages.filter(message => message.villageId === village.id)
  const lastReply = messages.filter(message => message.direction === 'in').at(-1)
  const national = scope === 'national'
  const contextTabs = national ? [['village', 'Kejadian'], ['trace', 'Jejak']] : [['village', 'Desa'], ['messages', 'Telepon-SMS'], ['trace', 'Jejak']]

  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('rebuild-theme', theme) } catch { /* Theme still works when storage is unavailable. */ } }, [theme])
  useEffect(() => {
    if (!state.replayPlaying) return
    const status = command.statuses[state.selectedVillageId]
    if (status?.mode !== 'replay' || status.day !== state.replayIndex) return
    const timer = window.setTimeout(() => dispatch({ type: 'replay-step', delta: 1 }), 1200)
    return () => window.clearTimeout(timer)
  }, [state.replayPlaying, state.replayIndex, command.statuses, state.selectedVillageId])
  useEffect(() => { if (context === 'messages') phoneEnd.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length, context])
  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [menuOpen])

  useEffect(() => {
    if (!state.notice) return
    const timer = window.setTimeout(() => dispatch({ type: 'clear-notice' }), 4500)
    return () => window.clearTimeout(timer)
  }, [state.notice])

  const chooseVillage = (id: string) => { dispatch({ type: 'select-village', id }); setContext('village') }
  const decide = (id: string, kind: 'approved' | 'rejected') => { if (!busy) { setDecision({ id, kind }); setDecisionNote(''); decisionDialog.current?.showModal() } }
  const [fieldPath, setFieldPath] = useState('')
  useEffect(() => { setFieldPath('') }, [command.responder?.id])
  const localShareLink = () => fieldPath ? new URL(fieldPath, window.location.origin).toString() : ''
  const copyShareLink = async () => { try { await navigator.clipboard.writeText(localShareLink()); setShareNotice('Link lokal disalin.') } catch { setShareNotice('Tidak bisa menyalin otomatis. Pilih dan salin alamat di bawah.') } }
  const sendReply = async (text: string) => { if (!text.trim() || !command.responder || !command.config?.public_demo) return; const ok = await command.run(() => backend.demoInbound({ responder_id: command.responder!.id, text, mode: state.mode, day: state.mode === 'live' ? 0 : state.replayIndex }), 'Balasan diproses Warden.'); if (ok) setReply('') }
  const sendOutbound = async (text: string) => {
    if (!text.trim() || !command.responder || !command.config?.public_demo || command.config.outbound !== 'mock') return
    const ok = await command.run(async () => {
      const result = await backend.send(command.responder!.id, text, 'sms')
      if (result.status === 'suppressed') throw new Error(`BE menahan pesan ini${typeof result.reason === 'string' ? `: ${result.reason}` : '.'}`)
    }, 'Pesan keluar tersimpan sebagai simulasi lokal.')
    if (ok) setOutboundMessage('')
  }
  const criticalDate = village.criticalDate ?? undefined
  const describe = village.risk === 'unknown' ? `${village.name}: status engine belum tersedia.` : village.criticalNow ? `${village.name} sudah melintasi ambang kritis model. Perlu pemeriksaan lapangan.` : village.criticalIn == null ? `${village.name}: ambang kritis belum terlintasi dalam horizon model.` : `${village.name}: perkiraan ambang kritis model dalam ${village.criticalIn} hari.`

  return <main className="command-room">
    <a className="skip-link" href="#decisions">Ke antrean keputusan</a>
    <header className="command-header"><a className="wordmark" href="/" aria-label="Peatforge command center"><span className="brand-symbol" /><strong>PEATFORGE</strong></a>
      <div className="segmented scope-switch" role="group" aria-label="Cakupan peta"><button aria-pressed={national} onClick={() => { setScope('national'); setContext('village') }}><span className="scope-long">Seluruh </span>Indonesia</button><button aria-pressed={!national} onClick={() => { setScope('pilot'); setContext('village') }}><span className="scope-long">Wilayah pilot (</span>Pulang Pisau<span className="scope-long">)</span></button></div>
      {!national && <div className="segmented mode-switch" role="group" aria-label="Mode data"><button aria-pressed={state.mode === 'live'} onClick={() => dispatch({ type: 'mode-switch', mode: 'live' })}>Live</button><button aria-pressed={state.mode === 'replay'} onClick={() => dispatch({ type: 'mode-switch', mode: 'replay' })}>Replay 2019</button></div>}
      <span className="data-mode-note">{command.config?.public_demo ? 'Demo terbuka · kanal simulasi' : 'Operator terautentikasi'}</span><div className="header-spacer" /><button className="button theme-button" aria-label="Mode posko malam" aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}<span>Mode posko malam</span></button><button className="button help-button" aria-label="Bantuan" onClick={() => help.current?.showModal()}><CircleHelp size={17} /><span>Bantuan</span></button>
      <div className="menu-anchor"><button className="button icon-button" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>{menuOpen && <div className="menu-panel"><div className="menu-autonomy"><strong>Otonomi agen L2</strong><p>Tindakan L3 memerlukan persetujuan operator.</p><span>Engine deterministik · Warden</span></div><span>Sumber input: {command.config?.source ?? 'belum tersedia'}</span><button onClick={() => { command.refresh(); setMenuOpen(false) }}>Muat ulang data</button><button onClick={() => { setScope('pilot'); setContext('messages'); setMenuOpen(false) }}><Smartphone size={16} />Simulator HP</button><button onClick={() => { help.current?.showModal(); setMenuOpen(false) }}><CircleHelp size={16} />Bantuan dan istilah</button></div>}</div>
    </header>
    <section className="summary-band" aria-label="Ringkasan operasi"><div><h1>{national ? 'Pantauan titik panas Indonesia.' : pending.length ? `${pending.length} usulan menunggu keputusan Anda.` : 'Tidak ada usulan yang menunggu.'}</h1><p>{national ? 'Deteksi panas satelit, belum merupakan konfirmasi kebakaran.' : describe}</p></div><dl><div><dt>{national ? 'deteksi di Indonesia' : 'menunggu keputusan'}</dt><dd>{national ? String(command.national?.total_matched ?? 'N/A') : metrics.pending}</dd></div><div><dt>{national ? 'periode hari' : 'desa risiko tinggi+'}</dt><dd>{national ? command.nationalDays : command.errors.risk ? 'N/A' : metrics.highVillages}</dd></div><div><dt>{national ? 'deteksi regional' : 'titik panas 72 jam'}</dt><dd>{national ? String(command.national?.regional_total ?? 'N/A') : metrics.hotspots}</dd></div></dl></section>
    {(command.errors.operation || command.errors.risk || command.errors.actions) && <div className="connection-warning" role="alert"><span>{command.errors.operation ?? command.errors.risk ?? command.errors.actions} Data yang tersimpan belum tentu mutakhir.</span><button className="text-button" onClick={command.refresh}>Coba lagi</button></div>}

    <div className="operations-grid">
      <section className="queue-panel" aria-labelledby="decisions"><div className="panel-scroll queue-scroll"><header className="queue-heading"><span className="section-caption">Antrean keputusan</span><h2 id="decisions">{pending.length ? `${pending.length} usulan menunggu Anda` : 'Tidak ada usulan'}</h2></header>
        <p className="queue-chain-caption">Alur responder terpilih</p><ol className="decision-chain" aria-label="Alur penanganan">{steps.map((label, index) => <li key={label} className={index === proposalStep ? 'current' : command.progress?.steps[index]?.done ? 'complete' : ''}><span>{command.progress?.steps[index]?.done && index !== proposalStep ? <Check size={15} strokeWidth={3} /> : index + 1}</span><small>{label}</small></li>)}</ol><p className="chain-description">{command.progress ? `Status Warden: ${command.progress.state}. Tindak lanjut: ${command.config?.outbound === 'mock' ? 'kanal simulasi' : 'lihat status pengiriman'}.` : progress[0]}</p>
        <div className="proposal-list">{pending.map(item => <DecisionCard key={item.id} item={item} raw={command.actions.find(action => action.id === item.id)} locked={busy || !!command.errors.actions} villageName={state.villages.find(v => v.id === item.villageId)?.name ?? item.villageId} onDecision={decide} onTrace={() => setContext('trace')} onSelect={chooseVillage} />)}</div>
        {!pending.length && <div className="queue-empty"><Check size={24} /><p>Belum ada usulan yang menunggu. Tekan tombol di bawah untuk mencoba alurnya.</p></div>}
        <div className="queue-simulation"><button className="button primary simulation-button" disabled={busy || !command.config?.public_demo} onClick={() => dispatch({ type: 'simulate-trigger' })}><Zap size={17} />Simulasikan kenaikan risiko</button><p className="simulation-caption">Memicu Scout untuk Desa {village.name}; angka model tetap dari engine. <button className="text-button" onClick={() => help.current?.showModal()}>Apa ini <CircleHelp size={13} /></button></p></div>
        {state.guideVisible && <aside className="quick-guide"><div><h3 className="section-caption">Cara pakai</h3><button className="close-button" aria-label="Tutup panduan" onClick={() => dispatch({ type: 'dismiss-guide' })}><X size={15} /></button></div><ol><li>Pilih desa di peta.</li><li>Tekan “Simulasikan kenaikan risiko”, lalu balas SMS lewat Simulator HP.</li><li>Baca usulan, lalu Setujui atau Tolak.</li></ol></aside>}
        <DecisionHistory command={command} />
        <p className="queue-footnote">{state.events.length} aktivitas tersimpan · {metrics.smsSent} pesan keluar responder ini · <button className="text-button" onClick={() => setContext('trace')}>lihat semua</button></p>
      </div></section>

      <section className="map-panel" aria-label="Peta risiko"><div className="map-stage"><RiskMap villages={state.villages} selectedId={village.id} onSelect={chooseVillage} onOpenDetails={id => { chooseVillage(id); window.requestAnimationFrame(() => document.getElementById('panel-village')?.focus()); }} recommendations={state.recommendations} messages={state.messages} mode={state.mode} theme={theme} scope={scope} replayIndex={state.replayIndex} backendRisk={command.risk as unknown as GeoJSONCollection | null} backendCanals={command.canalGeometry as unknown as GeoJSONCollection | null} backendHotspots={command.hotspots ? { available: command.hotspots.available === true && !command.errors.hotspots, items: command.hotspots.items.filter(item => typeof item.lat === 'number' && typeof item.lon === 'number').map(item => ({ id: String(item.id), lat: Number(item.lat), lon: Number(item.lon) })) } : null} />{!national && <div className="risk-legend"><div><b>Risiko <CircleHelp size={12} /></b>{riskOrder.map(risk => <RiskBadge key={risk} risk={risk} />)}</div><small><i className="hatch-swatch" />arsir = hanya model</small></div>}</div>
        {!national && <section className="forecast-strip" aria-label="Linimasa risiko">{state.mode === 'live' ? <><p>{command.forecast.length} titik prakiraan engine · warna dan angka = tingkat risiko</p><div className="forecast-blocks">{(village.forecast ?? []).map((value, index) => <span key={index} className={`forecast-level-${value}`} title={`${command.forecast[index]?.date ?? ''}: risiko ${value ?? 'belum tersedia'}`}>{value ?? '?'}</span>)}</div>{!command.forecast.length && <p>{command.errors.forecast ?? 'Memuat prakiraan…'}</p>}<div className="forecast-ticks"><span>{command.forecast[0]?.date}</span><span>{command.forecast.at(-1)?.date}</span></div></> : <div className="replay-controls"><button className="button icon-button" disabled={replayFrames.length < 2} aria-label={state.replayPlaying ? 'Jeda replay' : 'Putar replay'} onClick={() => dispatch({ type: 'replay-toggle' })}>{state.replayPlaying ? <Pause size={16} /> : <Play size={16} />}</button><input aria-label="Hari replay" type="range" min="0" max={Math.max(0, replayFrames.length - 1)} value={state.replayIndex} onChange={event => dispatch({ type: 'replay-seek', index: Number(event.target.value) })} /><span>{replayFrames[state.replayIndex]?.label ?? 'Rekaman belum tersedia'}</span></div>}</section>}
      </section>

      <section className="context-panel" aria-label="Konteks wilayah"><div className="context-tabs" role="tablist" aria-label="Panel konteks">{contextTabs.map(([key, label]) => <button key={key} role="tab" id={`tab-${key}`} aria-selected={context === key} tabIndex={context === key ? 0 : -1} aria-controls={`panel-${key}`} onClick={() => setContext(key)} onKeyDown={event => { const tabs = contextTabs.map(([id]) => id); const next = event.key === 'ArrowRight' ? (tabs.indexOf(key) + 1) % tabs.length : event.key === 'ArrowLeft' ? (tabs.indexOf(key) + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1; if (next >= 0) { event.preventDefault(); setContext(tabs[next]); document.getElementById(`tab-${tabs[next]}`)?.focus() } }}>{label}</button>)}</div>
        <div className="panel-scroll context-content" role="tabpanel" id={`panel-${context}`} aria-labelledby={`tab-${context}`} tabIndex={0}>
          {context === 'village' && (national ? <><NationalData command={command} /><button className="button" onClick={() => setScope('pilot')}>Buka wilayah pilot</button></> : <>
            <form className="query-box" onSubmit={event => { event.preventDefault(); dispatch({ type: 'query', text: query }) }}><Search size={15} /><input aria-label="Tanya Peatforge" placeholder="Tanya Peatforge: desa mana yang paling rawan?" value={query} onChange={event => setQuery(event.target.value)} /><button className="button small">Tanya</button></form>
            {state.query && <div className="query-answer" role="status">{state.queryAnswer}</div>}
            <div className="village-heading"><h2>Desa {village.name}</h2><RiskBadge risk={village.risk} /></div><p className="muted village-subtitle">Pulang Pisau · referensi koordinat BMKG</p><p className="village-summary">{describe}</p>
            <ul className="village-facts"><li>Risiko PFVI: <strong>{riskLabels[village.risk]}</strong></li><li>Perkiraan tanggal kritis: <strong>{formatDate(criticalDate)}</strong></li>{lastReply && <li>Kabar responder terakhir: <strong>“{lastReply.body}”</strong></li>}</ul>
            <section className="detail-section"><h3 className="section-caption">Pesan · {command.responder?.name ?? 'Belum ada responder'}</h3><div className="message-preview">{messages.slice(-3).map(message => <article key={message.id}><time>{message.time}</time><div><span>{message.direction === 'out' ? 'Warden' : 'Responder'}</span><p>{message.body}</p></div></article>)}{!messages.length && <p className="muted">{command.errors.messages ?? 'Belum ada pesan.'}</p>}</div><button className="text-button muted-link" onClick={() => setContext('messages')}>Buka percakapan responder</button></section>
            <SimulationPanel command={command} />
            <details className="technical-details"><summary>Lihat detail angka</summary><dl className="village-numbers"><div><dt>Indeks rawan api</dt><dd>{village.pfvi ?? 'N/A'}</dd><small>dari 300</small></div><div><dt>Air tanah model</dt><dd>{village.waterTable == null ? 'N/A' : `${village.waterTable} cm`}</dd><small>positif ke bawah permukaan</small></div></dl><h3 className="section-caption">Prakiraan PFVI engine</h3><ForecastChart command={command} /><p className="data-provenance">Perkiraan model, belum diukur · keyakinan heuristik {village.confidence == null ? 'belum tersedia' : village.confidence} · bukan probabilitas kebakaran</p></details>
            <VillageData command={command} />
            <SourceDetails command={command} />
          </>)}
          {context === 'messages' && <div className="sms-simulator">
            <h2>Simulator HP</h2>
            <label>Desa<select aria-label="Pilih desa responder" value={village.id} onChange={event => dispatch({ type: 'select-village', id: event.target.value })}>{state.villages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Anda berperan sebagai<select aria-label="Pilih responder" value={command.responder?.id ?? ''} onChange={event => command.setResponderId(event.target.value)}>{command.responders.filter(item => item.village_id === village.id).map(item => <option key={item.id} value={item.id}>{item.name} ({item.role})</option>)}</select></label>
            <button className="button share-phone" disabled={!command.responder || busy} onClick={async () => { try { const result = await backend.fieldLink(command.responder!.id); setFieldPath(result.field_path); setShareNotice(''); share.current?.showModal() } catch (error) { command.markError('operation', error) } }}><Share2 size={16} />Bagikan ke HP</button>
            <div className="phone-frame"><div className="phone-contact"><span>W</span><div><b>Warden Peatforge</b><small>ke {command.responder?.name ?? 'belum ada responder'}</small></div><span className="phone-demo">{command.config?.outbound === 'mock' ? 'Simulasi' : 'Operator'}</span></div>
              <div className="phone-messages">{messages.map(message => <article key={message.id} className={`sms-bubble sms-${message.direction}`}><p>{message.body}</p><time>{message.time}</time></article>)}{!messages.length && <p className="muted">{command.errors.messages ?? 'Belum ada pesan.'}</p>}<div ref={phoneEnd} /></div>
              <div className="reply-presets">{['AIR 61 ASAP YA dekat kanal 4', 'YA', 'TIDAK', 'TELP'].map(text => <button key={text} disabled={busy || !command.responder || !command.config?.public_demo} onClick={() => void sendReply(text)}>{text}</button>)}</div>
              {state.awaitingConfirmation && <p className="confirmation-hint" role="status">Periksa bacaan ulang, lalu kirim YA sebagai pesan tersendiri untuk menyimpan laporan.</p>}
              <form className="sms-compose" onSubmit={event => { event.preventDefault(); void sendReply(reply) }}><input aria-label="Ketik balasan sebagai responder" maxLength={500} placeholder="Pesan teks" value={reply} onChange={event => setReply(event.target.value)} /><button aria-label="Kirim" disabled={busy || !reply.trim() || !command.responder || !command.config?.public_demo}><Send size={19} /></button></form>
              <section className="warden-compose" aria-label="Kirim pesan keluar Warden">
                <div><strong>Pesan keluar dari Warden</strong><small>Tersimpan sebagai simulasi di BE lokal.</small></div>
                <form className="sms-compose" onSubmit={event => { event.preventDefault(); void sendOutbound(outboundMessage) }}><input aria-label="Pesan keluar dari Warden" maxLength={300} placeholder="Tulis pesan untuk responder" value={outboundMessage} onChange={event => setOutboundMessage(event.target.value)} /><button aria-label="Kirim simulasi Warden" disabled={busy || !outboundMessage.trim() || !command.responder || !command.config?.public_demo || command.config.outbound !== 'mock'}><Send size={19} /></button></form>
                {(!command.config?.public_demo || command.config.outbound !== 'mock') && <small className="muted">Pengiriman manual aktif hanya saat kanal BE terkunci ke mode simulasi.</small>}
              </section>
            </div>
            <p className="sms-disclaimer">{command.config?.public_demo ? 'Kanal simulasi BE. Pesan dan keputusan tersimpan di server lokal.' : 'Simulasi masuk hanya tersedia dalam demo terbuka.'}</p>
            {command.responder && <VoicePanel responderId={command.responder.id} mode={state.mode} day={state.mode === 'live' ? 0 : state.replayIndex} onChanged={command.refresh} />}
          </div>}
          {context === 'trace' && <section className="agent-trace"><h2>Jejak agen</h2><p className="muted">Aktivitas tersimpan dari Scout, Warden, Planner dan Verifier.</p>{!state.events.length && <p className="muted">{command.errors.trace ?? 'Belum ada aktivitas agen.'}</p>}{[...state.events].reverse().map(event => <article key={event.id}><div><b>{event.agent}</b><span>{event.title}</span><time>{event.time} WIB</time></div><details><summary>Input, output, dan bukti engine</summary><pre>{event.detail}</pre></details></article>)}</section>}
        </div>
      </section>
    </div>
    <footer className="data-footer"><span><i />Input: {command.config?.source} · angka model <span className="footer-divider">|</span> {national ? 'Hitungan nasional' : state.mode === 'replay' ? `Replay ${replayFrames[state.replayIndex]?.label ?? ''}` : 'Pilot Pulang Pisau'} · polling 4 detik</span><span>{state.mode === 'replay' ? 'Cuaca historis sebagai perfect forecast; bukan validasi prediksi.' : 'Persetujuan bukan konfirmasi pelaksanaan lapangan.'}</span></footer>
    {state.notice && <div className="notification" role="status">{state.notice}</div>}
    <dialog ref={share} className="help-dialog"><div><h2>Tautan responder</h2><button className="button icon-button" aria-label="Tutup berbagi" onClick={() => share.current?.close()}><X size={18} /></button></div><p>Tautan terbatas untuk {command.responder?.name}, Desa {village.name}. Simpan tautan ini secara pribadi. Alamat localhost hanya bisa dibuka pada perangkat ini.</p><input className="share-address" aria-label="Link responder lokal" readOnly value={typeof window === 'undefined' ? '' : localShareLink()} onFocus={event => event.target.select()} /><button className="button primary" onClick={copyShareLink}>Salin link lokal</button><p role="status">{shareNotice}</p></dialog>
    <dialog ref={decisionDialog} className="help-dialog" onClose={() => setDecision(null)}><form onSubmit={async event => { event.preventDefault(); if (!decision) return; const ok = await command.run(() => decision.kind === 'approved' ? backend.approve(decision.id) : backend.reject(decision.id, decisionNote), decision.kind === 'approved' ? 'Persetujuan tersimpan. Pelaksanaan belum dikonfirmasi.' : 'Penolakan tersimpan.'); if (ok) decisionDialog.current?.close() }}><h2>{decision?.kind === 'approved' ? 'Setujui usulan ini?' : 'Tolak usulan ini?'}</h2><p>{command.actions.find(item => item.id === decision?.id)?.title}</p><p>Persetujuan mencatat keputusan operator dan memproses tindak lanjut sesuai kebijakan BE. Pelaksanaan lapangan tetap perlu dikonfirmasi terpisah.</p>{decision?.kind === 'rejected' && <label>Alasan penolakan<textarea required maxLength={500} value={decisionNote} onChange={event => setDecisionNote(event.target.value)} /></label>}{command.errors.operation && <p role="alert">{command.errors.operation}</p>}<div className="decision-actions"><button type="button" className="button" onClick={() => decisionDialog.current?.close()}>Batal</button><button className="button primary" disabled={busy}>Konfirmasi {decision?.kind === 'approved' ? 'persetujuan' : 'penolakan'}</button></div></form></dialog>
    <dialog ref={help} className="help-dialog"><div><h2>Bantuan dan istilah</h2><button className="button icon-button" aria-label="Tutup bantuan" onClick={() => help.current?.close()}><X size={18} /></button></div><h3>Cara pakai</h3><ol><li>Pilih desa dan mode Live atau Replay 2019.</li><li>Simulasikan peringatan, lalu kirim laporan melalui Telepon-SMS.</li><li>Periksa bacaan ulang dan kirim YA tersendiri.</li><li>Tinjau bukti usulan, lalu Setujui atau Tolak dan konfirmasikan keputusan.</li></ol><h3>Tingkat risiko kebakaran gambut</h3><div className="help-risks">{riskOrder.map((risk, index) => <div key={risk}><RiskBadge risk={risk} /><span>Indeks {['< 100', '100–174', '175–249', '250+'][index]}</span></div>)}</div><p>Angka model berasal dari engine deterministik. Muka air ≥60 cm juga melintasi ambang kritis, walau PFVI di bawah 250. Titik panas bukan konfirmasi kebakaran.</p><p>Kanal, sumber daya dan responder demo diberi label fixture. Cuaca dapat berasal dari provider/cache atau fixture sesuai konfigurasi server. Browser tidak menggantikan data yang gagal dengan angka demo.</p></dialog>
  </main>
}

function ConnectedCommand() {
  const command = useCommand()
  if (!command.state.villages.length || command.unauthorized) return <main className="connection-page"><a className="wordmark" href="/"><span className="brand-symbol" /><strong>PEATFORGE</strong></a><h1>{command.loading ? 'Menghubungkan posko…' : command.unauthorized ? 'Sesi operator diperlukan' : 'BE lokal belum tersambung'}</h1><p role={command.loading ? 'status' : 'alert'}>{command.errors.connection ?? 'Memuat konfigurasi dan daftar desa dari server lokal.'}</p>{!command.loading && <><p>Jalankan START-LOCAL.command dari folder proyek, lalu buka http://127.0.0.1:8000.</p><button className="button primary" onClick={command.reconnect}>Hubungkan kembali</button></>}</main>
  return <CommandWorkspace command={command} />
}

export default function App() {
  const field = typeof window === 'undefined' ? null : window.location.pathname.match(/^\/f\/([^/]+)\/?$/)
  return field ? <FieldPage token={field[1]} /> : <ConnectedCommand />
}

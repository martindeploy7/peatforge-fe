import { describe, expect, it } from 'vitest'
import { answerQuery, initialState, reducer, replayFrames, selectMetrics, selectVillage } from '../src/model'

describe('observed live demo transitions', () => {
  it('starts with Talio selected and one Kantan Muara proposal', () => {
    expect(selectVillage(initialState)).toMatchObject({ name: 'Talio', risk: 'high', criticalIn: 4, extraDays: 5 })
    expect(selectMetrics(initialState)).toEqual({ pending: 1, highVillages: 2, hotspots: 0, smsSent: 0 })
  })

  it('guards invalid selection and preserves its seed', () => {
    expect(reducer(initialState, { type: 'select-village', id: 'missing' })).toBe(initialState)
    const state = reducer(initialState, { type: 'select-village', id: 'kantan-muara' })
    expect(selectVillage(state).name).toBe('Kantan Muara')
    expect(initialState.selectedVillageId).toBe('talio')
  })

  it('creates the observed Talio simulation without mutating its seed', () => {
    const state = reducer(initialState, { type: 'simulate-trigger' })
    expect(selectVillage(state)).toMatchObject({ risk: 'critical', extraDays: 5 })
    expect(state.recommendations[1]).toMatchObject({ title: 'Tutup sekat K3-K5, patroli K4', crew: 6, pumps: 1, extraDays: 4 })
    expect(selectMetrics(state)).toMatchObject({ pending: 2, smsSent: 1 })
    expect(state.messages.at(-1)!.translation).toContain('EXTREME')
    expect(selectVillage(initialState).risk).toBe('high')
    const repeated = reducer(state, { type: 'simulate-trigger' })
    expect(repeated.recommendations).toHaveLength(3)
    expect(new Set(repeated.recommendations.map(item => item.id)).size).toBe(3)
  })

  it('only decides a pending proposal once and notifies residents after approval', () => {
    const state = reducer(initialState, { type: 'decision', id: 'kantan-pump', decision: 'approved' })
    expect(selectMetrics(state).pending).toBe(0)
    expect(state.recommendations[0]!.status).toBe('approved')
    expect(state.messages.at(-1)!.body).toContain('operator menyetujui')
    expect(state.messages.at(-1)!.translation).toContain('operator approved')
    expect(state.step).toBe(5)
    expect(reducer(state, { type: 'decision', id: 'kantan-pump', decision: 'rejected' })).toBe(state)
    expect(reducer(initialState, { type: 'decision', id: 'absent', decision: 'approved' })).toBe(initialState)
  })

  it('rejects without a notification SMS', () => {
    const state = reducer(initialState, { type: 'decision', id: 'kantan-pump', decision: 'rejected' })
    expect(selectMetrics(state).pending).toBe(0)
    expect(state.smsSent).toBe(0)
    expect(state.messages).toBe(initialState.messages)
  })

  it('ignores empty messages and confirms a parsed volunteer report before calibration', () => {
    expect(reducer(initialState, { type: 'sms-send', text: '  ' })).toBe(initialState)
    const state = reducer(initialState, { type: 'sms-send', text: 'AIR 61 ASAP YA dekat kanal 4' })
    expect(state.awaitingConfirmation).toBe(true)
    expect(state.messages.at(-1)!.body).toBe('Saya catat: air sumur 61 cm, asap terlihat. Betul? Balas YA atau TIDAK.')
    expect(state.messages.at(-1)!.translation).toContain('61 cm, smoke seen')
    expect(state.events.at(-1)).toMatchObject({ agent: 'WARDEN', level: 1, title: 'inbound' })
    expect(state.events.at(-1)!.detail).toContain('AIR 61 ASAP YA dekat kanal 4')
    const confirmed = reducer(state, { type: 'sms-send', text: 'YA' })
    expect(confirmed.awaitingConfirmation).toBe(false)
    expect(confirmed.messages.at(-1)!.body).toContain('Terima kasih, laporan dicatat')
    expect(confirmed.messages.at(-1)!.translation).toContain('the report is saved')
    expect(confirmed.events.at(-1)!.title).toBe('recalibrate')
    expect(confirmed.recommendations).toHaveLength(2)
    expect(selectVillage(confirmed)).toMatchObject({ pfvi: 231, waterTable: -55, confidence: 0.68 })
    expect(selectVillage(initialState).pfvi).toBeUndefined()
    expect(initialState.messages).toHaveLength(2)
  })

  it('does not recalibrate an unprompted YA', () => {
    const state = reducer(initialState, { type: 'sms-send', text: 'YA' })
    expect(state.events.some(event => event.title === 'recalibrate')).toBe(false)
    expect(state.events.at(-1)).toMatchObject({ agent: 'WARDEN', title: 'inbound' })
  })

  it('binds report confirmation to its village and avoids duplicate pending proposals', () => {
    const parsed = reducer(initialState, { type: 'sms-send', text: 'AIR 61 ASAP YA' })
    const other = reducer(parsed, { type: 'select-village', id: 'dandang' })
    const unconfirmed = reducer(other, { type: 'sms-send', text: 'YA' })
    expect(unconfirmed.awaitingConfirmation).toBe(true)
    expect(unconfirmed.events.some(event => event.title === 'recalibrate')).toBe(false)
    expect(unconfirmed.events.at(-1)!.detail).toContain('relawan Dandang: YA')
    expect(unconfirmed.recommendations).toBe(parsed.recommendations)
    const simulated = reducer(initialState, { type: 'simulate-trigger' })
    const report = reducer(simulated, { type: 'sms-send', text: 'AIR 61 ASAP YA' })
    expect(reducer(report, { type: 'sms-send', text: 'YA' }).recommendations).toHaveLength(2)
  })

  it('discards a report on TIDAK without creating a proposal or calibration', () => {
    const parsed = reducer(initialState, { type: 'sms-send', text: 'AIR 61 ASAP YA dekat kanal 4' })
    const state = reducer(parsed, { type: 'sms-send', text: 'TIDAK' })
    expect(state.awaitingConfirmation).toBe(false)
    expect(state.messages.at(-1)!.body).toBe('Baik, tidak dicatat. Kirim ulang: AIR (cm) dan ASAP YA/TIDAK.')
    expect(state.recommendations).toBe(parsed.recommendations)
    expect(state.events.some(event => event.title === 'recalibrate')).toBe(false)
    expect(state.events.at(-1)!.detail).toContain('TIDAK')
  })

  it('answers observed questions and dismisses help', () => {
    expect(answerQuery(initialState, 'desa mana yang paling mendesak?')).toContain('4 hari')
    expect(answerQuery(initialState, '')).toBe('')
    expect(reducer(initialState, { type: 'dismiss-guide' }).guideVisible).toBe(false)
    const query = reducer(initialState, { type: 'query', text: 'desa mana yang paling mendesak?' })
    const cleared = reducer({ ...query, notice: 'Toast' }, { type: 'clear-notice' })
    expect(cleared.notice).toBe('')
    expect(cleared.queryAnswer).toContain('4 hari')
    expect(cleared.query).toBe(query.query)
    const approved = reducer(initialState, { type: 'decision', id: 'kantan-pump', decision: 'approved' })
    expect(answerQuery(approved, 'usulan apa?')).toBe('Tidak ada usulan yang menunggu keputusan.')
  })
})

describe('replay guards', () => {
  it('restarts playback from the final frame and stops at its bound', () => {
    const last = reducer(initialState, { type: 'replay-seek', index: 59 })
    const playing = reducer(last, { type: 'replay-toggle' })
    expect(playing.replayIndex).toBe(0)
    expect(playing.replayPlaying).toBe(true)
    expect(reducer(playing, { type: 'replay-step', delta: 59 }).replayPlaying).toBe(false)
  })
  it('clamps seek and step to available frames and rejects invalid numbers', () => {
    expect(reducer(initialState, { type: 'replay-seek', index: -20 }).replayIndex).toBe(0)
    expect(reducer(initialState, { type: 'replay-step', delta: 1000 }).replayIndex).toBe(Math.max(0, replayFrames.length - 1))
    expect(reducer(initialState, { type: 'replay-seek', index: Number.NaN })).toBe(initialState)
    expect(reducer(initialState, { type: 'mode-switch', mode: 'replay' }).replayPlaying).toBe(false)
  })

  it('uses the directly observed first replay frame', () => {
    const state = reducer(initialState, { type: 'mode-switch', mode: 'replay' })
    expect(selectVillage(state)).toMatchObject({ risk: 'low', criticalIn: 53, extraDays: 5 })
    expect(selectMetrics(state).highVillages).toBe(0)
  })

  it('matches observed intermediate and final replay snapshots', () => {
    const replay = reducer(initialState, { type: 'mode-switch', mode: 'replay' })
    const middle = reducer(replay, { type: 'replay-seek', index: 12 })
    expect(selectVillage(middle)).toMatchObject({ risk: 'moderate', criticalIn: 41 })
    const final = reducer(replay, { type: 'replay-seek', index: 59 })
    expect(selectVillage(final)).toMatchObject({ risk: 'high', criticalIn: 0 })
    expect(selectMetrics(final)).toMatchObject({ highVillages: 5, hotspots: 16 })
    expect(replayFrames[59]!.label).toBe('Min 29/09 · hari ke-60')
  })
})

describe('interaction regressions', () => {
  it('refreshes a visible query after approving its final pending proposal', () => {
    const asked = reducer(initialState, { type: 'query', text: 'usulan apa?' })
    const approved = reducer(asked, { type: 'decision', id: 'kantan-pump', decision: 'approved' })
    expect(approved.queryAnswer).toBe('Tidak ada usulan yang menunggu keputusan.')
  })

  it('refreshes a priority query when replay changes the risk snapshot', () => {
    const asked = reducer(initialState, { type: 'query', text: 'prioritas?' })
    const replay = reducer(asked, { type: 'mode-switch', mode: 'replay' })
    expect(replay.queryAnswer).toContain('53 hari')
    expect(replay.queryAnswer).toContain('Pangkoh Hilir')
  })

  it('replies to TELP and malformed reports without calibrating or creating proposals', () => {
    for (const text of ['TELP', 'AIR salah']) {
      const sent = reducer(initialState, { type: 'sms-send', text })
      expect(sent.messages.at(-1)!.direction).toBe('out')
      expect(sent.recommendations).toBe(initialState.recommendations)
      expect(sent.events.some(event => event.title === 'recalibrate')).toBe(false)
      expect(sent.events.at(-1)).toMatchObject({ agent: 'WARDEN', level: 1, title: 'inbound' })
    }
  })
})

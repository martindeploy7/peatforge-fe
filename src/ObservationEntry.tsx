import { useState, type FormEvent } from 'react'
import { backend, type ObservationInput } from './backend'
import type { Command } from './useCommand'

export default function ObservationEntry({ command }: { command: Command }) {
  const [water, setWater] = useState('')
  const [waterCategory, setWaterCategory] = useState<NonNullable<ObservationInput['water_category']> | ''>('')
  const [smokeCategory, setSmokeCategory] = useState<NonNullable<ObservationInput['smoke_category']> | ''>('')
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [formError, setFormError] = useState('')
  const responder = command.responder
  const hasData = water !== '' || waterCategory !== '' || smokeCategory !== '' || place.trim() !== '' || note.trim() !== ''

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!responder) { setFormError('Pilih desa dengan responder terdaftar sebelum mencatat observasi.'); return }
    if (!hasData) { setFormError('Isi setidaknya satu hasil pengamatan.'); return }
    if (!confirmed) { setFormError('Konfirmasikan bahwa catatan ini sesuai pengamatan.'); return }
    setFormError('')
    const category = smokeCategory || null
    const body: ObservationInput = {
      village_id: command.state.selectedVillageId,
      responder_id: responder.id,
      mode: command.state.mode,
      day: command.state.mode === 'live' ? 0 : command.state.replayIndex,
      confirmed: true,
      ...(water !== '' ? { wt_cm: Number(water) } : {}),
      ...(waterCategory ? { water_category: waterCategory } : {}),
      ...(category ? { smoke_category: category, smoke: category === 'terlihat' || category === 'api', fire: category === 'api' } : {}),
      ...(place.trim() ? { place_text: place.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    }
    const saved = await command.run(() => backend.logObservation(body), 'Observasi tersimpan di backend.')
    if (saved) { setWater(''); setWaterCategory(''); setSmokeCategory(''); setPlace(''); setNote(''); setConfirmed(false) }
  }

  return <form className="backend-form observation-form" onSubmit={event => void submit(event)}>
    <label>Muka air terukur (cm di bawah permukaan)<input type="number" min="0" max="150" step="0.1" value={water} onChange={event => { setWater(event.target.value); setConfirmed(false) }} placeholder="Kosongkan jika tidak diukur" /></label>
    <label>Kondisi air<select value={waterCategory} onChange={event => { setWaterCategory(event.target.value as typeof waterCategory); setConfirmed(false) }}><option value="">Belum dicatat</option><option value="kering">Kering</option><option value="sedikit">Sedikit</option><option value="masih_ada">Masih ada</option><option value="banjir">Banjir</option></select></label>
    <label>Asap atau api<select value={smokeCategory} onChange={event => { setSmokeCategory(event.target.value as typeof smokeCategory); setConfirmed(false) }}><option value="">Belum dicatat</option><option value="tidak">Tidak ada</option><option value="bau">Tercium bau</option><option value="terlihat">Asap terlihat</option><option value="api">Api terlihat</option></select></label>
    <label>Lokasi atau penanda<input maxLength={150} value={place} onChange={event => { setPlace(event.target.value); setConfirmed(false) }} placeholder="Nama kanal atau lokasi" /></label>
    <label>Catatan tambahan<input maxLength={500} value={note} onChange={event => { setNote(event.target.value); setConfirmed(false) }} placeholder="Keterangan lapangan" /></label>
    <label className="observation-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Saya konfirmasi ini hasil pengamatan. Angka muka air live dapat memperbarui parameter model.</label>
    {formError && <p className="observation-form-error" role="alert">{formError}</p>}
    {command.errors.operation && <p role="alert">{command.errors.operation}</p>}
    <button className="button primary" disabled={command.busy || !responder || !hasData || !confirmed}>Simpan observasi terkonfirmasi</button>
  </form>
}

import type { Command } from './useCommand'

export default function SourceDetails({ command }: { command: Command }) {
  const hotspots = command.hotspots
  const responder = command.responder
  return <section className="detail-section backend-panel">
    <details><summary>Deteksi panas satelit · {hotspots?.available ? hotspots.items.length : 'belum tersedia'}</summary>
      <p>Deteksi panas bukan konfirmasi kebakaran. Radius dan periode mengikuti data engine untuk mode yang dipilih.</p>
      {command.errors.hotspots && <p role="alert">{command.errors.hotspots}</p>}
      {hotspots && <><p>Sumber: {hotspots.source ?? 'belum tersedia'} · waktu data {hotspots.data_as_of ?? 'belum tersedia'} · {hotspots.stale ? 'cache stale' : 'lihat metadata sumber'}</p>{!hotspots.available && <p>{hotspots.reason ?? 'Data hotspot belum tersedia.'}</p>}
        <details><summary>Metadata deteksi</summary><pre>{JSON.stringify(Object.fromEntries(Object.entries(hotspots).filter(([key]) => key !== 'items')), null, 2)}</pre></details>
        {hotspots.items.map((item, index) => <details key={String(item.id ?? index)}><summary>{String(item.detected_at ?? 'Waktu belum tersedia')} · {String(item.satellite ?? item.instrument ?? 'deteksi panas')}</summary><pre>{JSON.stringify(item, null, 2)}</pre></details>)}
      </>}
    </details>
    <details><summary>Identitas dan kesiapan responder</summary>{responder ? <><p>{responder.name} · {responder.role} · tier {responder.tier}</p><p>Persetujuan kontak: {responder.consent_at ?? 'belum tercatat'}. Terakhir dihubungi: {responder.last_contacted_at ?? 'belum tercatat'}.</p><p>{responder.phone_last4 ? `Nomor disamarkan, berakhir ${responder.phone_last4}` : 'Tidak ada nomor yang ditampilkan.'}</p></> : <p>Responder belum tersedia untuk desa ini.</p>}</details>
    <details><summary>Status lengkap dan konfigurasi sumber</summary><pre>{JSON.stringify({ status: command.statuses[command.state.selectedVillageId] ?? null, configuration: command.config }, null, 2)}</pre></details>
  </section>
}

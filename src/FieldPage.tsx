import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import VoicePanel from './voice/VoicePanel';
import { FieldError, fieldDenied, fieldRequest } from './voice/fieldApi';
import type { FieldResponse } from './voice/fieldApi';
import './field-page.css';

export type FieldPageProps = { token: string };
const time = (value: string) => Number.isNaN(Date.parse(value)) ? '' : new Date(value).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB';
const statusLabel = (status: string) => ({ mock: 'Simulasi pengiriman', sent: 'Terkirim', delivered: 'Diterima', received: 'Diterima', failed: 'Gagal', queued: 'Menunggu pengiriman' })[status] ?? 'Tercatat';

export default function FieldPage({ token }: FieldPageProps) {
  const [conversation, setConversation] = useState<FieldResponse>({ items: [] });
  const [access, setAccess] = useState<'loading' | 'ready' | 'invalid' | 'denied'>('loading');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const scope = useRef(0);
  const revision = useRef(0);
  const busy = useRef(false);
  const blocked = useRef(false);
  const sendController = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  function failure(value: unknown) {
    if (fieldDenied(value)) {
      blocked.current = true;
      setAccess(value instanceof FieldError && value.status === 404 ? 'invalid' : 'denied');
      setConversation({ items: [] }); setText('');
    } else setError('Sambungan terputus. Coba lagi.');
  }

  useEffect(() => {
    scope.current += 1; revision.current = 0; busy.current = false; blocked.current = false;
    setConversation({ items: [] }); setAccess('loading'); setText(''); setError(''); setSending(false);
    return () => { scope.current += 1; sendController.current?.abort(); };
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false, loading = false;
    async function load() {
      if (loading || blocked.current || busy.current) return;
      loading = true;
      const version = revision.current;
      try {
        const result = await fieldRequest(token, 'messages', controller.signal);
        if (!stopped && !blocked.current && version === revision.current) {
          setConversation(result); setAccess('ready'); setError('');
        }
      } catch (value) {
        if (!stopped && version === revision.current) {
          failure(value);
          if (!fieldDenied(value)) setError('Sambungan terputus. Pesan terakhir tetap ditampilkan; mencoba kembali setiap 3 detik.');
        }
      } finally { loading = false; }
    }
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => { stopped = true; controller.abort(); window.clearInterval(timer); };
  }, [token, refresh]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [conversation.items.at(-1)?.id]);

  async function send(value: string) {
    const message = value.trim();
    if (busy.current || access !== 'ready' || !message || message.length > 500) return;
    const version = scope.current;
    const controller = new AbortController(); sendController.current = controller;
    revision.current += 1; busy.current = true; setSending(true); setError('');
    try {
      const result = await fieldRequest(token, 'send', controller.signal, message);
      if (scope.current === version) {
        setConversation(previous => ({ ...previous, ...result })); setText('');
      }
    } catch (value) {
      if (scope.current === version) {
        failure(value);
        if (!fieldDenied(value)) setError('Pengiriman belum dapat dipastikan. Periksa percakapan sebelum mengirim ulang.');
      }
    } finally {
      if (scope.current === version) { busy.current = false; setSending(false); }
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(text); }

  if (access === 'invalid' || access === 'denied') return <main className="field-page"><h1>{access === 'invalid' ? 'Tautan ini tidak berlaku' : 'Akses percakapan ditolak'}</h1><p>Hubungi operator untuk mendapatkan tautan yang berlaku.</p></main>;
  return <main className="field-page">
    <header className="field-header"><span className="field-brand">PEATFORGE · LAPANGAN</span><h1>Percakapan dengan Warden</h1><p>{conversation.responder?.name || 'Memuat identitas petugas…'}</p><small>Jaga tautan ini agar hanya Anda yang menggunakannya.</small></header>
    {access === 'ready' && conversation.browser_voice_supported && <VoicePanel fieldToken={token} mode={conversation.mode} day={conversation.day} onChanged={() => setRefresh(value => value + 1)} />}
    <section className="field-thread" aria-label="Percakapan dengan Warden" aria-busy={access === 'loading'}>
      {access === 'loading' && <p>Memuat percakapan…</p>}
      {access === 'ready' && !conversation.items.length && <p>Belum ada pesan. Kirim laporan pengamatan kepada Warden.</p>}
      {conversation.items.map(message => <article key={message.id} className={`field-message ${['inbound', 'in'].includes(message.direction) ? 'field-mine' : ''}`}>
        <strong>{['inbound', 'in'].includes(message.direction) ? 'Anda' : 'Warden'}</strong><p>{message.body}</p><small>{time(message.created_at)} · {statusLabel(message.status)}</small>
      </article>)}<div ref={bottom} />
    </section>
    <footer className="field-compose">
      {error && <p role="alert">{error}</p>}
      {conversation.state === 'confirm' && <div className="field-readback"><p role="status">Periksa bacaan ulang Warden. Kirim YA jika benar, atau TIDAK untuk membatalkan.</p><div className="field-confirm"><button type="button" disabled={sending || access !== 'ready'} onClick={() => void send('YA')}>YA</button><button type="button" disabled={sending || access !== 'ready'} onClick={() => void send('TIDAK')}>TIDAK</button></div></div>}
      {conversation.state === 'saved' && <p role="status">Laporan dicatat. Tindakan lapangan tetap memerlukan persetujuan operator.</p>}
      <form onSubmit={submit}><label htmlFor="field-message">Pesan kepada Warden</label><textarea id="field-message" rows={3} maxLength={500} value={text} disabled={sending || access !== 'ready'} onChange={event => setText(event.target.value)} aria-describedby="field-help" /><div className="field-send"><small id="field-help">{text.length}/500 karakter · Sebutkan air, asap, dan lokasi.</small><button disabled={sending || access !== 'ready' || !text.trim()}>{sending ? 'Mengirim…' : 'Kirim pesan'}</button></div></form>
    </footer>
  </main>;
}

# Integrasi lokal Peatforge, 7 November 2026

## Hasil implementasi

Target FE adalah `netlify-rebuild`, desain command center terakhir dalam workspace. Sumber BE adalah `peatforge/agents` dan `peatforge/engine`. `backend/` dan `web/` di folder induk merupakan versi lain dan bukan runtime integrasi ini. Tidak ada deployment, push, tunnel, pembacaan `.env`, atau pengiriman provider komunikasi.

FE menggunakan `/api` same-origin; dev Vite meneruskan API ke port 8000. Launcher `START-LOCAL.command` membangun FE lalu menjalankan aplikasi FastAPI yang sama dengan `web_dist=netlify-rebuild/dist`. State/cache baru di `runtime/local-integration/{provider,fixture}/`, terpisah dari runtime asli dan terpisah per sumber. Git pada folder BE `peatforge` tetap bersih setelah pekerjaan.

## Pemetaan data

| Layanan BE | Pemakaian FE |
| --- | --- |
| config, villages, responders, replay/meta | Bootstrap nyata, identitas desa/responder, label kanal, tanggal replay |
| map/risk | Titik risiko dan status lima desa, tanpa hex perkiraan FE |
| village forecast/status | PFVI, WT positif ke bawah, ambang kritis terpisah dari level, kurva dan tabel, sumber/freshness/asumsi |
| village simulate | Form target/horizon/batas kanal, dua kurva, tanggal lintasan, manfaat nullable/lower-bound, model_setup |
| canals/resources/params/history, observations | Inventaris fixture, riwayat parameter, snapshot pra-pembaruan |
| hotspots, canals/osm | Peta deteksi/geometri yang tersedia, rincian sumber dan metadata |
| replay milestones/backtest/hotspots summary | Tonggak aktual, lompat tanggal, batas evaluasi/arsip |
| national/hotspots | Hitungan provinsi 1–7 hari, snapshot, cakupan lama 34 provinsi; koordinat memang dihilangkan BE |
| responder messages, demo inbound/progress | Percakapan nyata tersimpan, readback/YA, alur Planner/Verifier, progres dari fakta BE |
| actions approve/reject/complete | Konfirmasi keputusan, alasan penolakan, riwayat, konfirmasi pelaksanaan dengan catatan |
| trace/policy | Jejak agen aktual dan kebijakan otonomi |
| field-link, field messages/send | Halaman scoped `/f/{token}`, polling 3 detik, tanpa akses operator |
| voice session/transcript/tool/end/simulate | Modul suara tervalidasi yang dipindahkan dari FE fullstack; simulasi teks tanpa mikrofon tersedia |

Command polling mengikuti konfigurasi dengan minimum 4 detik. Pergantian desa/mode/tanggal membatalkan pembacaan lama. Simulasi dan muatan tonggak ditahan dari pembaruan konteks yang salah. Replay maju setelah status tanggal aktif tersedia. Tidak ada fallback ke data demo browser pada kegagalan atau 401.

## Pemeriksaan yang dijalankan

| Pemeriksaan | Hasil aktual |
| --- | --- |
| `npm test` | PASS, 67 tes pada 9 file |
| `npm run build` | PASS, typecheck + Vite build |
| `npm run check:boundary` | PASS, import lokal dan dependency registry, 48 file pada pemeriksaan akhir |
| `node src/voice/events.test.mjs` | PASS, urutan ACK/transkrip/tools, deduplikasi, penutupan sesi |
| `node src/voice/audioGate.test.mjs` | PASS, hanya audio tervalidasi diputar, penolakan/mismatch/timeout, cleanup |
| `node src/voice/sessionClock.test.mjs` | PASS, masa berlaku credential berbeda dari umur sesi |
| `python3 -m pytest engine/tests/test_groundwater.py engine/tests/test_pfvi.py -q` dari `peatforge` | PASS, 19 tes |
| EngineService + Ingest fixture asli, kelima desa | PASS, status/simulasi replay day9, 15 titik baseline/skenario, nilai finite dan replay 62 hari |
| `python3 -m py_compile scripts/serve-local.py scripts/test_local_integration.py` | PASS |
| `zsh -n START-LOCAL.command` | PASS |
| Impeccable mechanical detector pada UI baru/berubah | PASS, hasil `[]`; bukan bukti QA visual/kontras runtime |
| Audit kontrak/state oleh agent terpisah | Tidak menemukan P0/P1; pemeriksaan source, bukan tes runtime |
| `npx playwright test --list` | 15 kasus terdaftar untuk 1440, 1024, 768; ini hanya penemuan tes |
| Eksekusi Playwright | BLOCKED, dev server ditolak `listen EPERM ... 127.0.0.1:5180` |
| Browser computer-use | BLOCKED, browser access host unavailable |
| `python3 scripts/test_local_integration.py` | BLOCKED, `ModuleNotFoundError: No module named 'fastapi'` |
| Instalasi dependency Python ke venv sementara | BLOCKED, pip gagal menjangkau registry/DNS dalam sandbox |

Build memberi peringatan bundle JS sekitar 1.39 MB sebelum gzip, terutama MapLibre; ini bukan kegagalan build. Belum ada pengukuran performa browser baru. Tidak ada klaim semua kontrol sudah diuji visual, kontras runtime sudah lulus, atau alur HTTP fullstack sudah terbukti.

## Verifikasi lanjutan yang konkret

Jalankan launcher melalui Terminal biasa yang memiliki jaringan dan izin localhost. `./START-LOCAL.command --fixture` memberikan input offline eksplisit. Setelah instalasi, jalankan `.venv-local/bin/python scripts/test_local_integration.py` untuk aplikasi FastAPI sesungguhnya dengan SQLite sementara dan provider diblokir. Jalankan `npm run test:smoke` dari FE untuk tes browser dengan API TEST FIXTURE. Suite browser itu tidak membuktikan pipeline Python; suite Python tidak membuktikan layout/browser.

Uji manual: pilih Talio, Replay 2019 hari ke-10 (day9), picu peringatan Scout, buka Telepon-SMS, kirim `AIR 61 ASAP YA dekat kanal 4`, baca readback dan kirim YA tersendiri. Periksa usulan dan bukti, konfirmasikan persetujuan atau penolakan, periksa tindak lanjut dan reload. Nilai Days Bought mengikuti hasil engine, bukan angka yang dipaksakan. Coba simulasi kanal, tonggak replay, hitungan nasional, tema dan halaman responder. Pengiriman tetap simulasi pada launcher ini.

Endpoint yang hanya ada dalam rencana, seperti public `/lapor`, pencarian lokasi bebas, national risk/summary, fire-events, Telegram dan SSE, tidak diada-adakan di FE. Data yang BE nyatakan unavailable tetap unavailable.

## Pembaruan kesiapan demo lokal

Pada pembaruan terakhir, FE juga menambahkan composer pesan keluar Warden khusus `public_demo + outbound=mock`, pemetaan `inbound/outbound` BE ke label percakapan, pencatatan observasi operator dengan konfirmasi, serta tombol satu-siklus Scout manual yang hanya muncul pada mode kanal simulasi. Tidak ada background Scout atau pemanggilan provider.

`npm run build` **lulus setelah pembaruan tersebut**. Tes unit/browser tidak dijalankan ulang setelah perubahan ini. Pengujian HTTP FastAPI dan browser lokal sebelumnya terhalang dependency/izin localhost sandbox; karena itu jalankan launcher lokal dan alur manual dari Terminal macOS biasa sebelum presentasi. Tes lama yang dicatat pada tabel di atas tidak membuktikan komponen baru ini telah dites di browser.

Untuk hackathon demo, masih ada 7 route yang sengaja belum menjadi kontrol layar: `POST /api/voice/twilio/call`; `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`; `GET /api/villages/{id}/status`; `GET /api/replay/day/{day}`; dan `POST /api/warmup`. Panggilan telepon provider serta mode login terlindungi tidak dipakai oleh launcher demo. Status dan snapshot replay sudah ditampilkan lewat endpoint lain, sedangkan warmup hanya persiapan cache.

## Persiapan Render dan perbaikan basemap

Basemap sekarang menggunakan Esri World Imagery dengan endpoint dan atribusi dari `peatforge/web/src/map/MapCanvas.tsx`, sesuai permintaan pengguna. Permintaan tile standar OpenStreetMap telah dihapus dari FE terbaru. Menu Lapisan dapat menyembunyikan citra satelit tanpa menghilangkan titik dan layer risiko BE. Setelah refresh melalui menu Arc pada `http://127.0.0.1:8000`, citra satelit dan atribusi Esri terlihat, serta gambar error tile OSM 403 tidak muncul. Ini observasi render lokal, bukan pengujian seluruh kontrol peta.

Audit juga memperbaiki draft observasi: pergantian desa/responder/mode/hari mereset form, dan perubahan input membatalkan checkbox konfirmasi. Tes API offline sekarang memeriksa direction `outbound` sesuai payload BE.

Pemeriksaan source terbaru: **67/67 tes FE, build TypeScript/Vite, boundary 49 file lulus**. Browser smoke masih terhalang `listen EPERM` di sandbox. BE launcher belum berjalan di sandbox: instalasi dependency gagal karena DNS. Docker daemon tidak tersedia. Paket Render telah dibuat, tetapi push source gagal `Could not resolve host: github.com`; resource cloud dan URL live belum ada.

## Panel sesuai referensi `image copy.png`

Panel kiri dan kanan mendapat palette charcoal untuk mode malam, kartu usulan amber dengan aksen status, chip hijau untuk manfaat positif, tautan bukti biru, tombol primer kontras, dan permukaan panduan yang terpisah. Label manfaat yang belum tersedia/bernilai nol tetap netral. Tahap Usulan ditonjolkan saat action BE berstatus proposed. UI tetap menggunakan data dan status BE.

67/67 tes FE serta build lulus setelah perubahan. Pemeriksaan rasio warna yang ditetapkan menghasilkan minimum 5.21:1 untuk pasangan teks yang diperiksa, bukan audit aksesibilitas seluruh layar. Review visual Arc `http://127.0.0.1:8000` menunjukkan dua panel charcoal, panduan, tombol dan tautan terbaru pada keadaan tanpa usulan; kartu usulan berisi belum direview visual karena tidak ada action pending pada state tersebut.

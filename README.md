# Peatforge lokal: FE desain terbaru + BE fullstack

Frontend ini mempertahankan desain command center yang sudah dikembangkan: tiga panel, antrean keputusan, peta, konteks desa, serta tema siang/malam. Data dan perubahan operasional sekarang menggunakan API Python di `../peatforge`, bukan state demo browser. Tidak ada deployment Netlify dalam pekerjaan ini.

## Jalankan integrasi

Dari folder induk proyek, jalankan melalui Terminal macOS:

```sh
./START-LOCAL.command
```

Launcher menyiapkan `.venv-local`, memasang dependency bila belum ada, membangun FE, lalu menyajikan FE dan API pada **http://127.0.0.1:8000**. Butuh Python 3.11+, Node 22.12+, dan internet saat instalasi awal. Ctrl+C menghentikan server.

Untuk alur offline dengan input ilmiah fixture yang diberi label:

```sh
./START-LOCAL.command --fixture
```

### Alur demo presentasi

Mulai dengan `--fixture` agar alur data numeriknya offline dan stabil. Di console, pilih Talio lalu Replay 2019 hari ke-10, jalankan simulasi intervensi kanal, buka Simulator HP, picu peringatan, kirim laporan dan konfirmasi `YA`, lalu tinjau usulan dan setujui atau tolak. Balasan responder, pesan keluar Warden, catat observasi dan siklus Scout manual semuanya tersimpan sebagai simulasi lokal. Tidak ada SMS atau panggilan telepon provider.

Login operator terlindungi, panggilan Twilio PSTN, pemanasan cache, dan endpoint status/replay alternatif tidak dibutuhkan oleh alur demo ini. Background Scout sengaja tidak berjalan otomatis.

Mode biasa mengambil input provider publik/cache. Kegagalan sumber ditampilkan sebagai belum tersedia; tidak ada pergantian diam-diam ke fixture. Cache provider yang sudah ada boleh disalin ke runtime terisolasi. Cache itu belum ditemukan dalam salinan proyek ini pada pemeriksaan.

State lokal baru berada di `../runtime/local-integration/`, terpisah antara subfolder `provider/` dan `fixture/` agar observasi latihan tidak memengaruhi model provider. Runtime asli `../peatforge/runtime` tidak ditimpa. Launcher tidak membaca `.env`, menonaktifkan background Scout dan credential komunikasi. Tidak ada SMS/panggilan nyata. Tombol suara mendukung simulasi teks; UAT suara provider memerlukan sesi konfigurasi terpisah pada BE asli. Credential tidak disimpan di FE.

Untuk hot reload, jalankan BE lewat launcher, kemudian di terminal kedua:

```sh
cd netlify-rebuild
npm run dev
```

Buka http://127.0.0.1:5180. Vite mem-proxy `/api` ke `127.0.0.1:8000`. Preview statis bukan server fullstack.

## Cakupan integrasi

- Lima desa dan koordinat referensi BMKG; PFVI, muka air tanah, ambang kritis, prakiraan dan provenance engine. Titik risiko BE tetap titik, tanpa hex buatan.
- Simulasi target kanal, kenaikan batas, horizon, kurva baseline/skenario, Days Bought nullable, batas minimum, WT/PFVI, tanggal kritis dan asumsi hidraulika.
- Replay mengikuti metadata BE: 15 Juni–15 Agustus 2019, 62 hari. Tonggak model dan pemutaran menunggu data tanggal aktif.
- Responder, pesan, readback, YA tersendiri, observasi, Verifier/Planner, persetujuan/penolakan, pengiriman, riwayat dan konfirmasi pelaksanaan dengan catatan. State tersimpan di SQLite. Command polling 4 detik.
- Pesan keluar Warden hanya tersedia ketika BE memberi `public_demo=true` dan `outbound=mock`. Form observasi operator memerlukan konfirmasi; siklus Scout manual hanya muncul dalam mode simulasi dan mengevaluasi semua desa untuk konteks aktif.
- Jejak agen, inventaris fixture, riwayat parameter dan snapshot sebelum pembaruan observasi.
- Hotspot pilot, OSM bila tersedia, arsip historis, hitungan nasional 1–7 hari, cakupan provinsi historis, snapshot dan batas sumber. API nasional sengaja tidak mengirim koordinat titik.
- Tautan `/f/{token}` scoped ke responder, polling 3 detik. Browser voice memakai pipeline validasi BE dan modul audio yang dipindahkan secara terkontrol dari FE fullstack; tidak ada import runtime lintas folder.

WT positif adalah kedalaman di bawah permukaan. WT ≥60 cm bisa kritis walau PFVI belum EKSTREM. Days Bought bukan jaminan hari aman. Persetujuan bukan pelaksanaan; queued/mock bukan bukti pesan diterima. Hotspot bukan konfirmasi kebakaran. Replay perfect forecast bukan validasi prediksi. Fixture tetap diberi label.

## Verifikasi integrasi

```sh
npm test
npm run build
npm run check:boundary
npm run test:smoke
node src/voice/events.test.mjs
node src/voice/audioGate.test.mjs
node src/voice/sessionClock.test.mjs
```

Dari folder induk setelah dependency Python siap:

```sh
.venv-local/bin/python scripts/test_local_integration.py
```

Tes browser memakai **TEST FIXTURE** API untuk memeriksa FE, tidak menjadi fallback aplikasi. Tes Python memakai BE sesungguhnya, input fixture, temporary SQLite dan blokir provider eksternal. Build dan tes offline bukan bukti verifikasi server/browser. Hasil aktual ada di `evidence/LOCAL-INTEGRATION.md`.

## Arsip baseline frontend sebelumnya

Bagian berikut mencatat rekonstruksi frontend sebelum integrasi BE. Klaim data browser/demo dan harness lama di bawah bukan perilaku aplikasi terintegrasi saat ini. Gunakan petunjuk di atas untuk versi sekarang.

### PeatForge: independent operations workspace

Frontend baru dari observasi [situs Netlify](https://glistening-alfajores-3f22e0.netlify.app/), dengan source dan dependency mandiri. Alur Netlify menjadi acuan perilaku. Pengguna kemudian mengizinkan pengembangan komposisi berbasis Palantir, antrean keputusan berbasis Linear, dan presentasi risiko berbasis ArcGIS. Rincian keputusan desain ada di `DESIGN.md`; batas produk ada di `PRODUCT.md`.

## Menjalankan lokal

Diuji dengan Node 22.22.2. Dependency minimum Node 22.12.0.

```sh
npm ci
npm run dev
```

Buka **http://127.0.0.1:5180/**. Server memakai host lokal dan port tetap; konflik port akan menghasilkan error. Untuk memeriksa build produksi, jalankan `npm run build`, hentikan server dev, lalu `npm run preview` pada alamat yang sama.

Keputusan, simulasi, SMS dan replay mengubah state demo di browser. Reload mengembalikan data awal; pilihan tema dapat tersimpan secara lokal. Tidak ada pengiriman SMS sungguhan atau deployment.

## Laptop, tablet dan peta

Targetnya laptop 1440×900, tablet landscape 1024×768 dan tablet portrait 768×1024, dalam tema terang maupun malam. Pada laptop terdapat antrean, peta dominan dan konteks desa; di tablet peta berada di atas antrean dan konteks. Halaman tablet dapat digulir. Tidak ada komposisi khusus ponsel.

Nama desa pada usulan dapat dipilih untuk menghubungkan keputusan dengan seleksi peta dan panel konteks. Bukti usulan tetap dapat dibuka sebelum menyetujui atau menolak. Stepper menjelaskan alur tindakan terakhir, bukan status seluruh antrean.

Hover atau fokus pada marker desa membuka kartu ringkas; klik/tap menahannya terbuka. Enter memindahkan fokus keyboard ke kartu, Escape menutupnya, dan tombol Buka detail desa memilih desa serta membuka panel konteksnya. Kartu memakai data sesi yang sama, dengan nilai yang belum tersedia ditandai jelas.

MapLibre menggunakan basemap beratribusi serta hex risiko demo. Kontrol meliputi pan, zoom, rotasi, kemiringan, tampilan 3D berbasis pitch, dan layer. Handler sentuh native mencakup satu jari untuk pan serta dua jari untuk pinch, rotasi dan tilt. Jika WebGL tidak tersedia, aplikasi menampilkan peta skematis berlabel demo dengan kemampuan yang lebih terbatas. Basemap memerlukan jaringan; font Latin disajikan dari paket lokal.

## Pemeriksaan

```sh
npm run build
npm test
npm run check:boundary
npm run test:smoke
```

Build mencakup typecheck. Tes mencakup state keputusan/SMS/replay, render awal, geometri peta, matematika gesture fallback dan batas source. Boundary check memeriksa import, symlink serta dependency yang ditautkan ke source luar; pemeriksaan ini tidak membuktikan kesamaan algoritme dengan backend referensi.

Playwright menyiapkan ketiga viewport laptop/tablet di atas. Menjalankannya membutuhkan Chromium Playwright dan lingkungan yang mengizinkan proses browser serta localhost. Pemeriksaan yang gagal atau terhalang lingkungan tidak dihitung lulus. Log build, tes dan boundary tersimpan di `evidence/final-build-tests.log`; hasil browser terbaru beserta batasnya ada di `evidence/QA.md`.

Harness berikut hanya tersedia melalui server dev dan tidak menjadi entry build produksi:

- [Alur bersih dan matriks enam kombinasi viewport/tema](http://127.0.0.1:5180/tests/browser-harness.html?width=1440&height=900&theme=light&autorun=1&matrix=1): menguji keyboard tab, keputusan, simulasi, laporan SMS, konfirmasi, replay dan kembali ke Live, sekaligus memeriksa layout. Hasil dan UUID ditampilkan pada halaman; tersedia unduhan JSON.
- [Gesture touch sintetis pada MapLibre aktual](http://127.0.0.1:5180/tests/touch-harness.html?width=1024&theme=dark&autorun=1): membaca perubahan zoom, bearing, pitch dan center setelah TouchEvents buatan, dengan ringkasan per tes dan JSON penuh. Parameter `width` menerima 768, 1024 atau 1440; `theme` menerima `light` atau `dark`. Tambahkan `download=1` untuk mengunduh hasil saat autorun selesai.

TouchEvents sintetis bukan bukti pengujian perangkat fisik. Uji scroll luar peta hanya memeriksa pembatalan event dan perubahan scroll programatis; gesture fisik/default scroll browser perlu pemeriksaan tersendiri. `FAIL`, `SKIP` dan `PARTIAL` tetap dilaporkan apa adanya.

## Sumber dan batas data

- `evidence/REFERENCE.md`: pengamatan UI dan perilaku Netlify.
- `evidence/PROVENANCE.md`: batas penulisan baru dan pengungkapan paparan source pada percakapan sebelumnya.
- `evidence/DASHBOARD-REFERENCES.md`: sumber referensi Palantir, Linear dan ArcGIS beserta batas observasinya.
- `evidence/REA.md`: penggunaan REA dan batas rekonstruksi model.
- `evidence/QA.md`: hasil pemeriksaan browser terbaru.

Geometri risiko, posisi desa selain jangkar publik, kurva dan transisi replay di antara snapshot yang teramati merupakan pendekatan demo. Backend, kalibrasi fisik dan dataset nasional tidak dipulihkan. Data yang belum diketahui tidak ditampilkan sebagai pengukuran nyata.

REA 6.7.0 dipasang terpisah sebagai alat inspeksi di `/private/tmp/peatforge-re-tools`, bukan dependency aplikasi. Tidak ada bundle aplikasi Netlify yang disalin ke source baru, dan tidak ada source yang diimpor atau ditautkan dari `../web/`.

Kelayakan hackathon mengikuti aturan penyelenggara; folder ini tidak menyatakan jaminan kelayakan.

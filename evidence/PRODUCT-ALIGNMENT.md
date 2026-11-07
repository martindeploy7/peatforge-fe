# PeatForge: arah produk dan batas rekonstruksi

Audit 7 November 2026. Acuan: `PRODUCT.md`, `DESIGN.md`, `evidence/REFERENCE.md`, dan kode baru `src/model.ts` / `src/App.tsx`. Tidak membaca implementasi lama atau mengakses browser pada audit ini. Alur dan data yang terlihat pada situs Netlify menjadi bukti produk; maksud pengguna di bawah yang belum dinyatakan situs ditandai sebagai inferensi.

## Pengguna dan keputusan utama

**Teramati:** situs menghubungkan risiko desa, relawan/MPA lewat SMS, usulan agen, keputusan operator, dan kabar tindak lanjut. Contoh tindakan adalah menyiagakan pompa atau menutup sekat K3–K5 dan patroli K4. Antarmuka menyebut BPBD Pulang Pisau, relawan Pak Rahmat, kebutuhan regu/pompa, dan tambahan hari aman.

**Inferensi:** pengguna utama adalah operator posko BPBD yang harus memilih tindakan yang masuk akal untuk desa yang benar, berdasarkan urgensi, bukti lapangan, asumsi, manfaat, dan sumber daya. Peta membantu menemukan dan memahami tempat. Antrean membantu memutuskan. Grafik dan jejak menjelaskan keputusan. Produk berhasil ketika operator dapat menjawab: **“Usulan mana perlu saya setujui atau tolak sekarang, untuk desa mana, dan berdasarkan apa?”**

Arah Palantir untuk komposisi, Linear untuk antrean, dan ArcGIS untuk risiko cocok dengan pekerjaan tersebut selama peta dominan tidak membuat keputusan sulit ditemukan, kerapatan tidak mengecilkan bukti penting, dan warna tidak menggantikan label.

## Rantai nilai yang harus tetap utuh

| Tahap | Bukti yang teramati | Peran pada pekerjaan operator |
|---|---|---|
| Risiko | Peta/marker, tingkat risiko, waktu kritis, prakiraan/replay | Menemukan urgensi dan desa |
| Bukti lapangan | AIR/ASAP melalui simulator SMS, konfirmasi YA/TIDAK | Membedakan laporan relawan dari perkiraan model |
| Usulan | Tindakan, desa, alasan, tambahan hari aman, regu/pompa, bukti/asumsi | Menilai konsekuensi tindakan |
| Keputusan manusia | Setujui/Tolak, status dan jejak operator | Mempertahankan kendali manusia pada L2 |
| Tindak lanjut | Pesan persetujuan dan tahap Warga dikabari | Menutup lingkaran komunikasi |

Jumlah metrik atau luas peta bukan ukuran keberhasilan sendiri. Ketepatan hubungan tempat, bukti, tindakan, dan akibat keputusan lebih penting.

## Yang berjalan dan yang merupakan demo

- **Berjalan lokal:** pemilihan desa, perubahan tampilan risiko/replay, antrean keputusan, persetujuan/penolakan, percakapan simulator, konfirmasi laporan, jejak, tema, dan kontrol kamera peta.
- **Batas demo:** state berada di frontend; tidak ada bukti sensor produksi, pengiriman SMS nyata, pengerahan regu/pompa, pelaksanaan sekat, atau backend prediksi yang dipulihkan. Basemap geografis bukan bukti bahwa poligon risiko adalah pengukuran lapangan.
- **Replay:** tanggal 1 Agustus–29 September 2019 dan beberapa snapshot teramati. Kode menahan snapshot risiko terdekat pada hari yang tidak diamati; ini tidak memulihkan seri historis lengkap.
- **Query:** jawaban berasal dari aturan lokal atas data demo, bukan bukti adanya asisten produksi atau pencarian pengetahuan umum.
- **Nasional:** situs acuan tetap memuat ringkasan pada audit; angka dan daftar kejadian nasional tidak diperoleh. Nilai kosong/keterangan batas lebih jujur daripada angka rekaan.
- **Kalibrasi:** nilai Talio 231/300, −55 cm, keyakinan 68% teramati setelah laporan 61 cm dikonfirmasi. Jangan menyajikannya sebagai baseline awal yang belum berubah.
- **Share:** link localhost hanya berlaku pada perangkat yang menjalankan aplikasi. Menyalin link tidak membuktikan akses dari HP lain.

## Tiga penyempurnaan bernilai tinggi

1. **Hubungkan usulan dengan desa yang sedang diperiksa.** Keadaan awal acuan memiliki kartu Kantan Muara dan panel Talio. Itu fakta sumber sekaligus kelemahan konteks untuk keputusan. Sebagai refinement, judul/nama desa pada kartu dapat memilih desa terkait dan membuka bukti yang sesuai. Pertahankan tindakan, manfaat, kebutuhan sumber daya, dan akses bukti pada kartu yang sama. Tidak perlu inspector atau navigasi baru.
2. **Buat hasil satu keputusan mudah dilacak.** Persetujuan menghapus kartu menunggu dan menambah pesan/jejak. Tahap global “Warga dikabari” jangan terbaca sebagai semua usulan telah selesai ketika masih ada antrean lain. Beri konteks desa/tindakan terakhir pada status, atau scope penjelasannya ke usulan tersebut. Tetap jelas bahwa pada demo, penambahan pesan bukan bukti pengiriman nyata atau eksekusi lapangan.
3. **Jaga lingkup waktu dan kepastian tetap dekat dengan data.** Pilihan Live/Replay, label model/arsir, desa terpilih, dan penanda demo harus mudah ditemukan. Replay mengubah risiko tetapi antrean/pesan demo tetap tersimpan: jangan memberi kesan seluruh tindakan berasal dari tanggal historis yang sama. Label singkat cukup; tidak perlu membangun penyimpanan temporal atau engine prediksi baru.

Dua poin terakhir adalah rekomendasi hasil inferensi pekerjaan operator, bukan klaim bahwa situs acuan sudah menyelesaikannya.

## Tolak atau tunda

- Dashboard KPI tambahan, chart dekoratif, pencarian global baru, panel analitik yang sederajat dengan keputusan utama.
- Meniru semua toolbar Palantir/ArcGIS atau workflow tiket Linear. Ambil hierarki dan disiplin visualnya saja.
- Mengarang data nasional, seri replay lengkap, confidence per desa, algoritme risiko, atau integrasi SMS/sensor.
- Menganggap persetujuan demo sebagai bukti tindakan telah dilaksanakan; jangan menambah otomasi L3 tanpa kebutuhan dan otorisasi yang jelas.
- Memadatkan kartu sampai tindakan/desa/urgensi/manfaat/sumber daya tidak terbaca; mengandalkan hover pada tablet.
- Mengubah backend, menambah dependency atau arsitektur, autentikasi, deployment, dan fitur produksi selama pekerjaan ini.

## Pemeriksaan penerimaan yang relevan

Peta, antrean, dan konteks tetap dapat dijangkau pada 1440, 1024, dan 768 px dalam tema terang/gelap tanpa overflow horizontal. Rantai simulasi → laporan → konfirmasi → keputusan → pesan/jejak tetap berfungsi. Tombol/tabs memiliki nama dan fokus keyboard yang jelas. Label risiko dan unit tetap terbaca tanpa mengandalkan warna. Klaim pengujian sentuh dibatasi pada event sintetis sampai perangkat fisik diuji.


## Status refinement saat review akhir

Kode baru kini memiliki tombol nama desa pada kartu yang memilih desa pada peta/panel, caption “Alur tindakan terakhir”, dan penanda “Demo lokal” di dekat mode. Ketiga rekomendasi utama ditangani dengan perubahan kecil pada alur yang sudah ada. Detail waktu replay tetap merupakan batas rekonstruksi yang didokumentasikan; tidak ditambah engine atau penyimpanan baru. Pemeriksaan visual akhir dan hasil matriks browser dimiliki root.

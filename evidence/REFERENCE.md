# Peatforge live reference audit

Reference: https://glistening-alfajores-3f22e0.netlify.app/

Observed 2026-11-07 in authenticated Arc. Only the rendered site and accessibility tree were inspected. No previous implementation, source files, bundles, or old reports were read.

## Visual evidence

- `01-desktop-light.png`: authoritative initial view, 2940×1844 physical pixels; roughly 1470×922 CSS pixels inferred from Retina scaling.
- `02-phone.png`: SMS tab captured during audit.
- `03-night.png`: captured after theme click but renderer lag means this does not establish dark colors.

Desktop has white header about56 CSS px, summary76px, footer28px. Three main columns approximately400/670/380px (27.5%/46.3%/26.2%). Fine gray borders separate panes. Map has forecast strip on bottom; detail panes scroll. Modern system sans appearance, exact family unverified. Base text roughly14px, main heading22px, pane headings20px, small labels12px. Estimated colors: text#1d2125, secondary#667080, border#d8dadd, orange#a34a0f. These are visual estimates.

Header: compact black rounded-square logo with white ring; spaced PEATFORGE. Geography segments Seluruh Indonesia / Wilayah pilot (Pulang Pisau); Live / Replay2019; moon Mode posko malam; Bantuan; hamburger.

Summary headline `1 usulan menunggu keputusan Anda.` Sentence `Talio perlu tindakan dalam4hari. Menutup sekat kanal memberi5hari tambahan.` Metrics1waiting,2high-risk villages,0hotspots72h.

Left: ANTREAN KEPUTUSAN; heading; five-step chain Peringatan / Laporan / Usulan / Disetujui / Warga dikabari. First two black checked circles, third orange active ring, final two gray outlined numbered circles. Caption `Usulan siap. Agen menyusun tindakan. Menunggu keputusan Anda.` Cream action card has orange border and thick orange left rail, status/risk pills and time. Black Setujui and outlined Tolak. Expand rationale adds evidence and assumption rows, confidence and trace link. Full-width black lightning Simulasikan kenaikan risiko; selected-village note; Apa ini. Pale gray CARA PAKAI box with3numbered steps and close×. Bottom activity count and lihat semua link.

Center: geographic terrain/roads/settlement labels; translucent irregular risk areas; fine hex grid; diagonal hatch=model-only. TALIO selected marker red3 with black/white borders and blue vertical accents; TALIO HULU orange2. Floating Peta button top-left; camera controls top-right (north, rotate, tilt, zoom,3D). Translucent risk legend bottom-left; scale bottom-right. Fifteen forecast cells (today throughday14), first4red3 then dark-burgundy4; captions Hari ini/+3/+7/+10/+14hari.

Right: Desa / Telepon-SMS / Jejak tabs, active black underline. Desa: Tanya Peatforge search + Tanya button, village name/risk, kecamatan, strong lead, bullet facts, SMS transcript, Buka simulator HP, Lihat detail angka. SMS: responder selector, Bagikan ke HP, black rounded phone frame, gray incoming/pale-blue outgoing bubbles, italic English translations, timestamps, quick replies and composer. Jejak: latest-first role, level badge, operation,time,sentence, Detail teknis(JSON) disclosure.

Footer: gray dot, monospaced data-version text and `Semua panel memakai rekaman data yang sama.` Netlify Private/Share/Make public HUD overlays bottom-right; hosting chrome, not app UI.

## Data observed

| Village | Initial Live risk |
|---|---|
|Talio|Tinggi|
|Dandang|Sedang|
|Pangkoh Hilir|Rendah|
|Kantan Muara|Tinggi|
|Talio Hulu|Sedang|

Selected Talio: Kecamatan Pandih Batu, code62.11.01.2002, action4days, critical Rab11/11, canal closure+5safe days. Volunteer Pak Rahmat(Ketua MPA).

Initial pending Kantan Muara card: `Siagakan pompa di pos MPA`, Tinggi↑,09:53, `Risiko di Kantan Muara naik ke tinggi.`, +1hariaman, `Pemantauan otomatis · butuh1pompa`. Evidence dry forecast5days; groundwater-52cm(model); assumption SekatK2tertutup; confidence Cukup(0.71).

Initial Talio SMS08:58 warns HIGHrisk, critical4days, mediumconfidence; next instructs checkK3-K5, preparepump, burningban, replyAIR(cm)/ASAPYA-TIDAK. Both bilingual. Initial activity summary2hidden,0SMSsent.

## Behavior observed

- Phone quick reply immediately sends `AIR 61 ASAP YA dekat kanal 4`; agent asks `Saya catat: air sumur61cm, asap terlihat. Betul? BalasYAatauTIDAK.` with translation.
- YA responds `Terima kasih, laporan dicatat. Usulan tindakan dikirim ke operator.`; ENGINE trace recalibrationv1to v2.
- SimulateTalio creates pending `Tutup sekat K3-K5, patroli K4`, Ekstrem↑, riskup toextreme,+4safedays, `Laporan relawan desa · butuh6regu ·1pompa`; sendsEKSTREM warningSMS askingAIR/ASAP. Toast `Peringatan simulasi dikirim ke agen pemantau`. Repeated simulation can create multiple proposals.
- Approve direct, no confirmation observed; removes pending proposal, chain toWarga dikabari, SMS `Tindak lanjut: operator menyetujui "Tutup sekat K3-K5, patroli K4". Terima kasih atas laporan Anda.`
- Reject direct, no reason dialog observed; removes pending proposal. Trace OPERATOR L2reject `Operator menolak: Tutup sekat K3-K5, patroli K4 (Talio)`.
- Replay2019 firstframe slider0, Putar, `Kam01/08 · hari ke-1`. TalioLOW/action53days/criticalSen23/09/+5canal. DandangLOW/PangkohHilirMEDIUM/KantanMuaraLOW/TalioHuluMEDIUM. Highcount0; hotspotcount0, label titikpanashariini; footerdate01/08. Bounds subsequently verified below; play speed remains unmeasured.
- Menu: Otonomi agenL2, Offlinebrain, Data tiruan, SimulatorHP, Bantuan dan istilah. Tooltip L0-L1record/suggest;L2requiresapproval;L3actsalone.

Trace examples: SCOUT L0tool `Ambil status desa Talio dari engine`; SCOUT L1policy `Kirim SMS status ke Ketua MPA Talio (kuota1/hari)`; WARDEN L1inbound; SCOUT L1trigger `Simulasi kenaikan risiko Talio: TINGGI ke EKSTREM`; WARDEN L1message `SMS status terkirim ke Ketua MPA Talio`; VERIFIER L2check `Hotspot1,2km /6jam cocok dengan laporan`; PLANNER L2propose; OPERATOR L2approve/reject. Disclosures carryt-ids.

## Limits

No auth bypass or publish/share actions. Only toy simulation/decision/reply actions. Renderer sometimes lagged AX updates: screenshots retained earlier view while AX showed mutations. Native pointer/scroll returned noWindowsAvailable; offscreen AX sometimes elementHasNoFrame. Repeated focus clicks occasionally required; simulation was triggered more than once during lag. Initial visual is authoritative; later behavior is AX-supported.

Tablet breakpoint, exact typography/colors, dark palette, replay play speed, numeric detail, national data, settingsdialogs unverified. Responsive adaptation is an implementation choice, not an observed source fact.


## Replay follow-up verification

Replay Putar changes to Jeda and advances days. Focusing Hari replay slider and pressing End sets59, `Min29/09 · hari ke-60`; confirmed span2019-08-01 through2019-09-29, values0..59. Observed value12 `Sel13/08 · hari ke-13`: TalioSedang/action41days; DandangSedang/PangkohHilirSedang/KantanMuaraRendah/TalioHuluSedang. Pause later at17 `Min18/08 · hari ke-18`, Talio36days. Final59: TalioTinggi/DandangEkstrem/PangkohHilirTinggi/KantanMuaraTinggi/TalioHuluEkstrem; highcount5,hotspots16. Talio sentence becomes `Talio sudah masuk kondisi kritis. Perlu tindakan hari ini. Menutup sekat kanal memberi5hari tambahan.` Criticaldate remainsSen23/09. Screenshot04-replay-end.png exists, but same compositor-lag caveat applies. Restored Live after observing endpoint.


Negative SMS confirmation verified: after a second parsed AIR report, TIDAK returns `Baik, tidak dicatat. Kirim ulang: AIR (cm) dan ASAP YA/TIDAK.` / `OK, not saved. Resend: AIR (cm) and ASAP YES/NO.` No new proposal observed. Source left on Live / Desa.


## Follow-up national and numeric inspection

National remained in loading state across repeated observations: `Memuat ringkasan nasional…`; `Penilaian kejadian sedang dihitung; sementara ditampilkan ringkasan titik panas.` Metrics `- kejadian lahan`, `- di atas gambut`, `- provinsi terdampak`. Live/Replay controls disappear, right tabs become Kejadian/Jejak, heading `Kejadian kebakaran se-Indonesia`, body `Data nasional sedang dihitung. Halaman ini diperbarui otomatis, tidak perlu dimuat ulang.` Left pilot queue remains. No national event rows or loaded counts were observed.

Talio numeric panel opened using keyboard: index231/300; groundwater-55cm below surface; criticalRab11/11 atindex250; curve labeled without/withcanal; closingcanal shiftscriticaltoSen16/11(+5days); confidence68%; unmeasuredmodel; calibrationv2. Calibrationhistory v2 k_drain0.042→0.047,sy0.35→0.33 triggeredobservasiwt=-61cm; labelKalibrasiawal(v1). These values were observed after the audit's confirmed61cmreport/calibration, so they must not be claimed as unmodifiedinitialbaseline. Numericchart exactpointcoordinates were not exposed.

Additional screenshot validation:04-replay-end.png actually shows the rendered source in darkmode at replayendpoint and can establish that darkstate;05-live-dark.png shows renderedsourceLiveindarkmode, despite capturebeingrequestedonnational. Screenshot06 was unrelatedactiveArcwindow and was removed. ScreenshotAPI can capture activewindow ratherthantheAXboundsource, so validateeachimagevisually.

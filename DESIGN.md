# Design

<!-- impeccable:design-schema 1 -->

## Direction Contract — Admin Dashboard (beranda)

> **Revisi 4**: menggantikan Dokumen Resmi/Kop Surat (revisi 3, user: "not bad tapi ada yang lain"), Peta Topografi (revisi 2, ditolak), dan SCADA (revisi 1). Retired, bukan diperluas. Arah baru: P&ID / Diagram Proses Pengolahan Air.

THESIS: Dashboard BTAM dibaca sebagai diagram alur proses (P&ID) — data mengalir lewat unit-unit instrumen bernomor kode sepanjang pipa, bukan kumpulan kartu statistik atau panel status independen.

OWN-WORLD: Latar gelap teknis (`#0b0f10`-family), unit proses berupa kotak instrumen berbingkai tebal cyan (`.pid-unit`) dengan kode label ala instrumentasi (REG-101, UJI-201, NLI-301, SRT-401), dihubungkan pipa (`.pid-pipe`) bergaris putus-putus yang beranimasi mengalir (background-position, bukan JS per-frame), angka KPI tampil sebagai "pembacaan instrumen" di dalam tiap unit, font mono untuk kode/angka, dot legenda tetap dipakai untuk daftar status detail di bawah alur (bukan elemen utama lagi).

STORY: Staf BTAM membaca dashboard sebagai jalur produksi satu angkatan bimtek — masuk di Pendaftaran, mengalir ke Ujian, ke Penilaian, berakhir di Sertifikasi — tiap simpul menunjukkan angka nyata dari tahap itu, bukan ringkasan generik terpisah-pisah.

FIRST VIEWPORT: Strip alur proses horizontal 4 unit (Pendaftaran → Ujian → Penilaian → Sertifikasi) dengan pipa mengalir di antaranya, sebagai hero; panel Kompetensi per Bidang dan Status Ujian detail menyusul di bawah sebagai tabel/daftar pendukung.

FORM: Dipilih user dari 3 opsi (P&ID, Kartu Kredensial, Rapor Akademik) setelah 2 arah sebelumnya (SCADA, Peta Topografi) ditolak dan 1 arah (Dokumen Resmi) diterima-tapi-diminta-alternatif. Staging: Dashboard/beranda admin sebagai first surface, modul lain BELUM mewarisi.

## Platform

web

## Color Strategy

Committed (satu warna dominan + netral) — cyan/teal sebagai identitas "instrumen aktif":

- **Base**: `#0b0f10`–`#12181c` (gelap teknis netral).
- **Unit proses**: border `#2dd4bf` (cyan-teal, warna pipa instrumentasi), bukan warna status semaphore penuh.
- **Pipa**: `#2dd4bf` dengan opacity diredam, garis putus animasi mengalir.
- **Status legend** (di panel detail bawah, bukan hero): hijau/amber/merah standar `#34d399`/`#fbbf24`/`#f87171` — dipertahankan karena masih perlu bedakan status per baris.

Gelap dipilih karena world ini literal ruang instrumentasi teknis (P&ID sungguhan selalu gelap/blueprint di layar kontrol), bukan sekadar mengulang preferensi revisi sebelumnya.

## Typography

- **IBM Plex Mono** — kode unit (REG-101 dst.), angka pembacaan instrumen.
- **IBM Plex Sans** — label, body.
- Tidak ganti font lagi di revisi ini — variasi datang dari struktur (flow diagram), bukan tipografi.

## Component Language

- **`.pid-unit`**: kotak instrumen bingkai tebal cyan, `box-shadow` halo tipis — meniru simbol instrumen P&ID sungguhan.
- **`.pid-pipe`**: garis penghubung 3px dengan `repeating-linear-gradient` + `animation: background-position` — mengalir tanpa JS per-frame, murah secara performa.
- **`.pid-unit-code`**: label kode mono kecil di setiap unit (REG-101/UJI-201/NLI-301/SRT-401) — bukan dekorasi, tiap kode dan datanya nyata dari query Firestore terkait.
- Panel Status Ujian & Kompetensi per Bidang di bawah alur tetap pakai `.pid-panel` + `.pid-dot` sebagai daftar pendukung (bukan lagi elemen utama hero).

## Motion

- Pipa mengalir kontinu (`background-position` animasi, bukan sekali saat load) — mode "sedang berjalan", bukan sweep satu kali seperti gauge/bar revisi sebelumnya.
- Dot status kritis tetap pulse halus di panel detail.

## Scope

Direction ini berlaku untuk **Dashboard/beranda admin** sebagai first surface. Modul admin lain BELUM mewarisi dunia ini.

## Brand Commitments (carried from PRODUCT.md)

Nama "BTAM" dan logo instansi (Kementerian PU / Ditjen Cipta Karya) tetap wajib tampil di header/navbar (di luar scope alur proses P&ID itu sendiri).

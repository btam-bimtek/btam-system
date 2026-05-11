# Struktur Aplikasi Penilaian Bimtek — Final v3

**Tanggal:** 2026-04-17
**Pengganti:** `STRUKTUR_APLIKASI_v2.md`
**Pelengkap:** `SCHEMA_HARMONIZATION.md`

**Versi ini sudah final.** Tidak ada pertanyaan terbuka lagi. Bisa langsung jadi basis eksekusi milestone.

---

## Ringkasan Keputusan Final

| # | Keputusan | Sumber |
|---|---|---|
| 1 | Field demografis peserta disimpan opsional, tidak tampil di UI penilaian | Sesi 1 Q1 |
| 2 | Analisa kompetensi 3 level (total, per-EK per-peserta, agregat) | Sesi 1 Q2 |
| 3 | Sertifikat deferred, schema disiapkan | Sesi 1 Q3 |
| 4 | Report penyelenggara akses via login admin | Sesi 1b Q1 |
| 5 | Report penyelenggara: tab interaktif + versi cetak | Sesi 1b Q2 |
| 6 | Data parsial: section yang datanya kurang di-disable dengan pesan jelas | Sesi 1b Q3 |
| 7 | Report peserta: admin generate PDF, kirim manual | Sesi 2 Q1 |
| 8 | Report peserta tampilkan: pre/post + per-EK + kehadiran + keaktifan + respek. Tidak tampilkan: nilai pengajar, tugas, presentasi | Sesi 2 Q2 |
| 9 | Report peserta tidak ada ranking/perbandingan dengan peserta lain | Sesi 2 Q3 |
| 10 | Peserta tidak lulus tetap dapat report, dengan pesan arahan tambahan | Sesi 2 Q4 |
| 11 | Section A: jabatan/instansi/provinsi ditampilkan. No peserta tidak | Sesi 3 |
| 12 | Section B: nilai kehadiran/keaktifan/respek ditampilkan deskriptif | Sesi 3 |
| 13 | Report peserta: pembaca = peserta + pimpinan instansi | Sesi 3 |
| 14 | Logo BTAM (kop surat), tanpa watermark | Sesi 3 |
| 15 | Bahasa formal | Sesi 3 |
| 16 | Nama pengajar tidak dicantumkan | Sesi 3 |
| 17 | **1 versi dokumen: personal tapi akuntabel** | Sesi 4 Q1 |
| 18 | **Threshold deskriptif dapat di-custom per-bimtek oleh admin** | Sesi 4 Q2 |
| 19 | **Kehadiran: label deskriptif + persentase + jumlah sesi** | Sesi 4 Q3 |
| 20 | **Peserta tidak lulus / skor rendah: bahasa netral tanpa judgment** | Sesi 4 Q4 |

---

## 1. Prinsip Desain (Final)

1. **Pisahkan "data penilaian" dari "data peserta"**
2. **Single source of truth** untuk nilai pre/post test = exam-app
3. **Report adalah modul agregasi**, tidak menyimpan hasil kalkulasi
4. **Dua jenis report, bukan satu template yang di-filter**
5. **Privasi peserta adalah default** di report peserta
6. **🆕 Personal tapi akuntabel**: report peserta jujur menyampaikan hasil (pimpinan perlu tahu seriusitas peserta), tapi bahasa tetap menghargai dan tidak menghakimi
7. **🆕 Fakta + konteks > label hitam-putih**: untuk data yang mudah disalahpahami (kehadiran, keaktifan), tampilkan fakta objektif (persentase) dengan label deskriptif sebagai konteks

---

## 2. Peta Modul (Final)

Sama dengan v2. 7 modul: Peserta Master → Bimtek → Input Nilai → Kelulusan → Report Penyelenggara + Report Peserta → (Sertifikat, deferred).

---

## 3. Rincian Per Modul

### 3.1 – 3.5 (Modul 1-5)

Tidak berubah dari v2. Lihat `STRUKTUR_APLIKASI_v2.md` section 3.1 – 3.5.

---

### 3.6. Modul Report Peserta (Final)

#### 3.6.1. Pembaca & Filosofi

**Pembaca dokumen ini (dwiguna):**
- **Primer:** peserta sendiri — untuk refleksi dan bukti pembelajaran
- **Sekunder:** pimpinan instansi peserta — untuk akuntabilitas investasi pelatihan

**Filosofi penyajian:** dokumen ini adalah *laporan hasil pembelajaran*, bukan *rapor*. Nadanya profesional dan faktual. Apa adanya, tapi tidak menelanjangi. Kalau peserta benar-benar serius, itu akan tampak dari datanya. Kalau peserta main-main, itu juga akan tampak — dan pimpinan berhak tahu tanpa kami perlu "melunakkan" fakta.

Kunci keseimbangannya: **data disampaikan apa adanya, bahasa menghargai martabat**. Contoh:
- ❌ "Kehadiran Anda kurang baik" → menghakimi
- ❌ "Kehadiran Anda 62.5%" → akurat tapi tanpa konteks
- ✅ "Kehadiran: **Sebagian** — 5 dari 8 sesi (62.5%)" → fakta + konteks netral

#### 3.6.2. Akses

**Admin-side:**
- Tab "📄 Report Peserta" di sebelah tab "Report" penyelenggara
- Daftar peserta dengan aksi: `[👁 Preview]` `[⬇ Download PDF]`
- Aksi batch: `[⬇ Download Semua (ZIP)]`
- Konfigurasi threshold deskriptif (lihat 3.6.5)

**Peserta/Pimpinan-side:** tidak ada akses langsung. Admin mengirim PDF manual via email/WA.

#### 3.6.3. Struktur Dokumen — 4 Section

**SECTION A — Kop Surat & Identitas**

Kop surat di bagian paling atas halaman pertama:
- Logo BTAM di pojok kiri
- Nama lembaga (BTAM) dan informasi kontak di sebelah kanan logo
- Garis pemisah di bawah kop

Di bawah kop surat, blok identitas:

> **Nama Peserta:** [Nama Lengkap]
> **Jabatan:** [Jabatan] *(kalau ada)*
> **Instansi:** [Instansi] *(kalau ada)*
> **Provinsi:** [Provinsi] *(kalau ada)*
>
> **Kegiatan:** [Nama Bimtek]
> **Tanggal Pelaksanaan:** [Tgl Mulai] – [Tgl Selesai]
> **Lokasi:** [Lokasi]

**Catatan penting:**
- **Nomor peserta TIDAK ditampilkan** di dokumen (sesuai keputusan 11). Tetap dipakai internal di nama file PDF untuk memudahkan admin cross-check sebelum kirim.
- Field demografis yang `null` (tidak ada data) **dilewati** (tidak muncul dengan tanda strip/kosong). Kalau peserta tidak punya data jabatan, baris "Jabatan" tidak dicetak sama sekali.

**SECTION B — Ringkasan Hasil Pembelajaran**

Dibagi dua sub-section: angka objektif (pre/post/total) dan deskriptif (komponen subjektif).

**B.1 — Nilai Kuantitatif**

Ditampilkan sebagai angka + label kualitatif:

| Komponen | Nilai | Keterangan |
|---|---|---|
| Pre Test | 45 | Awal pembelajaran |
| Post Test | 82 | Akhir pembelajaran |
| **Nilai Akhir** | **78** | **Nilai minimum kelulusan: 60** |
| **Status** | **LULUS** | |

Untuk peserta yang tidak lulus (berdasarkan keputusan 10 & 20 — bahasa netral):

> **Status: Belum Memenuhi Nilai Minimum Kelulusan**
>
> Nilai akhir Anda (55) belum mencapai nilai minimum kelulusan yang ditetapkan (60). Anda dapat mengikuti kegiatan bimtek pada periode berikutnya untuk memperdalam penguasaan materi. Informasi jadwal dan pendaftaran dapat diperoleh dari penyelenggara.

Tidak ada kata "mohon maaf", "gagal", "sayangnya". Netral dan memberi jalan keluar.

**B.2 — Komponen Deskriptif**

Tampilan: ikon + label deskriptif + fakta pendukung (angka/persentase).

> **Kehadiran:** Hadir Penuh — 8 dari 8 sesi (100%)
> **Keaktifan:** Aktif — terlibat dalam diskusi dan tanya jawab di kelas
> **Respek:** Sangat Baik — menjaga sikap dan etika profesional

Kalau skor rendah, tetap netral (keputusan 20):

> **Kehadiran:** Sebagian — 5 dari 8 sesi (62.5%)
> **Keaktifan:** Perlu Ditingkatkan — kontribusi di kelas masih dapat ditingkatkan
> **Respek:** Baik — sikap sudah sesuai, dapat lebih ditingkatkan lagi

**Perhatikan:** tidak ada kata "kurang", "buruk", "rendah", "lemah". Untuk skor di bawah threshold, gunakan frasa seperti "Perlu ditingkatkan", "Masih dapat ditingkatkan", "Dapat lebih dioptimalkan".

Ini menjawab kebutuhan akuntabilitas (pimpinan tahu kalau peserta hanya hadir 5 dari 8 sesi) tapi tetap menjaga martabat peserta.

**Yang TIDAK ditampilkan di Section B** (sesuai keputusan 8):
- Nilai pengajar (subjektif, rawan komplain)
- Nilai tugas
- Nilai presentasi

Kalau komponen ini dihitung di nilai akhir tertimbang, peserta tetap melihat nilai akhir tanpa breakdown komponen ini.

**SECTION C — Perubahan Kompetensi**

Ini inti dokumen. Struktur:

**C.1 — Chart Perbandingan Total Pre-Post**
- Bar chart: 2 batang ("Pre Test" vs "Post Test")
- Label delta: "Peningkatan: +37 poin (82%)"

**C.2 — Chart per-Elemen Kompetensi**
- Grouped bar chart: untuk setiap EK, tampilkan % penguasaan pre (abu-abu) vs post (biru)
- Diurut berdasarkan besar peningkatan (dari paling besar ke paling kecil)

**C.3 — Tabel per-EK**

| Elemen Kompetensi | Pre Test | Post Test | Perubahan |
|---|---|---|---|
| Analisis Risiko | 40% | 90% | +50% |
| Perencanaan Strategis | 60% | 85% | +25% |
| Pelaporan | 70% | 75% | +5% |
| Monitoring & Evaluasi | 55% | 50% | −5% |

**C.4 — Narasi Otomatis**

Kalimat otomatis dibangun dari data, bahasa formal dan profesional:

> "Peserta menunjukkan peningkatan paling signifikan pada Elemen Kompetensi **Analisis Risiko** (dari 40% menjadi 90%). Kompetensi **Monitoring & Evaluasi** masih perlu didalami lebih lanjut (penguasaan akhir 50%). Secara keseluruhan, nilai post test meningkat **82%** dibanding pre test."

Pakai "Peserta" atau "Bapak/Ibu [Nama]", bukan "Anda" — ini memudahkan dokumen dibaca oleh pimpinan tanpa terasa seperti surat pribadi.

**Edge case** yang perlu di-handle fallback:
- Pre test / post test tidak tersedia → narasi di-skip, section ditandai "Data tidak lengkap"
- Semua EK sama persis → "Kompetensi peserta relatif stabil dari awal hingga akhir kegiatan"
- Semua EK turun → "Hasil post test menunjukkan penurunan di sebagian besar kompetensi. Disarankan peserta mengulang materi dan mengikuti bimtek periode berikutnya"
- Hanya 1 EK → narasi disederhanakan, tidak ada "paling banyak" / "paling sedikit"

**SECTION D — Penutup**

Tiga baris:

> Dokumen ini diterbitkan sebagai laporan hasil pembelajaran peserta pada kegiatan bimbingan teknis tersebut di atas. Keberatan atau pertanyaan mengenai isi laporan dapat disampaikan kepada penyelenggara dalam waktu 7 (tujuh) hari kerja sejak tanggal penerbitan.
>
> [Kota], [Tanggal]
> Penyelenggara,
>
> _______________________
> [Nama Penanggung Jawab]

#### 3.6.4. Konfigurasi Threshold Deskriptif

Sesuai keputusan 18: admin bisa atur threshold per-bimtek.

Lokasi UI: di tab **Konfigurasi** bimtek, section baru "Threshold Deskriptif Report Peserta" (collapsible, default nilai default):

```
Kehadiran:
  ≥ 95%  → "Hadir Penuh"
  ≥ 80%  → "Hadir Aktif"
  ≥ 60%  → "Sebagian"
  < 60%  → "Tidak Memenuhi Syarat Kehadiran"

Keaktifan:
  ≥ 85   → "Sangat Aktif"
  ≥ 70   → "Aktif"
  ≥ 60   → "Cukup Aktif"
  < 60   → "Perlu Ditingkatkan"

Respek:
  ≥ 85   → "Sangat Baik"
  ≥ 70   → "Baik"
  ≥ 60   → "Cukup Baik"
  < 60   → "Perlu Ditingkatkan"
```

Struktur data (di `bimtek.config.reportThresholds`):
```js
{
  kehadiran: [
    { min: 95, label: 'Hadir Penuh' },
    { min: 80, label: 'Hadir Aktif' },
    { min: 60, label: 'Sebagian' },
    { min: 0,  label: 'Tidak Memenuhi Syarat Kehadiran' }
  ],
  keaktifan: [ /* sama pattern */ ],
  respek:    [ /* sama pattern */ ]
}
```

Label default boleh di-override admin, tapi **validasi:** label tidak boleh berisi kata-kata negatif dari blacklist (`kurang`, `buruk`, `jelek`, `gagal`, `lemah`). Kalau admin coba isi kata-kata itu, tampilkan warning — bukan blok, tapi peringatan "Bahasa ini dapat menimbulkan komplain dari peserta/pimpinan. Pertimbangkan frasa alternatif seperti 'Perlu Ditingkatkan'."

Ini membantu admin yang kurang sensitif terhadap nuansa bahasa, tanpa menghilangkan kebebasan konfigurasi.

#### 3.6.5. Format PDF

Strategi tidak berubah dari v2: mulai dengan `window.print()` + stylesheet print. Upgrade ke `html2pdf.js` saat batch generation jadi prioritas.

**Tambahan untuk kop surat BTAM (keputusan 14):**
- Logo BTAM disimpan sebagai asset statis di aplikasi
- Admin bisa upload logo kustom di Pengaturan (opsional, untuk fleksibilitas kalau nanti ada instansi lain pakai aplikasi ini)
- Stylesheet print mencakup kop surat di setiap halaman pertama dokumen

#### 3.6.6. Sumber Data

Sama dengan v2. Filter ke satu peserta + drop field yang tidak boleh ditampilkan:

```js
function generatePesertaReport(pesertaId, bimtekId) {
  const peserta  = pesertaMaster[pesertaId];
  const bimtek   = bimtekData[bimtekId];
  const scores   = bimtekScores[bimtekId][pesertaId];
  const examResults = getExamResults(bimtek.examCode, pesertaId);
  const thresholds  = bimtek.config.reportThresholds || DEFAULT_THRESHOLDS;

  return {
    header: {
      nama:     peserta.nama,
      jabatan:  peserta.jabatan   || null,
      instansi: peserta.instansi  || null,
      provinsi: peserta.provinsi  || null,
      // noPeserta SENGAJA tidak dikembalikan
      kegiatan: bimtek.nama,
      tglMulai: bimtek.tanggalMulai,
      tglSelesai: bimtek.tanggalSelesai,
      lokasi:   bimtek.lokasi
    },
    nilaiKuantitatif: {
      pretest:    scores.pretest,
      posttest:   scores.posttest,
      nilaiAkhir: calcFinal(scores),
      kkm:        bimtek.kkm,
      lulus:      calcFinal(scores) >= bimtek.kkm
    },
    deskriptif: {
      kehadiran:  mapToLabel(scores.kehadiran, thresholds.kehadiran,
                             { fakta: scores.kehadiranDetail }),
      keaktifan:  mapToLabel(scores.keaktifan, thresholds.keaktifan),
      respek:     mapToLabel(scores.respek,    thresholds.respek)
    },
    kompetensi: {
      total: { pre: examResults.pretest.score, post: examResults.posttest.score },
      perEK: calcEKComparison(examResults.pretest, examResults.posttest),
      narasi: generateNarasi(perEK, nilaiKuantitatif)  // handle edge cases
    }
  };
}
```

---

### 3.7. Modul Sertifikat — Deferred

Tidak berubah. Schema siap, implementasi ditunda.

---

## 4. Urutan Pengerjaan (Milestone Updated)

### Milestone 0 — Harmonisasi Schema
**2-4 jam**

### Milestone 1 — Tambah Field Demografis Opsional
**6-10 jam**

### Milestone 2 — Modul Report Penyelenggara (MVP)
**12-16 jam**

### Milestone 3 — Modul Report Peserta (Final Scope)
- Tab "Report Peserta" di admin
- Template HTML 4-section (kop surat BTAM, identitas, hasil, kompetensi, penutup)
- Konfigurasi threshold deskriptif per-bimtek (Section baru di tab Konfigurasi)
- Implementasi `mapToLabel()` dengan validasi blacklist kata negatif
- Generator narasi otomatis dengan handling edge case (pre/post kosong, semua sama, semua turun, dll)
- Export PDF via `window.print()` + stylesheet print dengan kop surat
- Edge case: peserta tidak lulus tampil dengan bahasa netral
- **Estimasi: 10-14 jam** (+2 jam dari v2 karena konfigurasi threshold & validasi blacklist)

### Milestone 4 — Enhancement (Demografi + Batch PDF)
- Breakdown demografis di report penyelenggara
- Batch download ZIP dengan html2pdf.js
- **5-8 jam**

### Milestone 5 *(future)* — Modul Sertifikat
Deferred.

**Total estimasi MVP (M0-M3): 30-44 jam.**

---

## 5. Resiko & Mitigasi

**R1: Admin set threshold ekstrem (misal `≥ 30 = "Sangat Aktif"`).**
Mitigasi: validasi soft — kalau threshold tertinggi < 70, tampilkan warning "Threshold Anda terlihat rendah. Apakah yakin?". Tidak blok, hanya peringatkan.

**R2: Pimpinan komplain karena menganggap laporan terlalu "lunak" (menyembunyikan fakta).**
Mitigasi: dokumentasikan ke admin bahwa laporan **tidak menyembunyikan angka objektif** (pre/post, nilai akhir, status lulus, persentase kehadiran semua transparan). Yang "dilunakkan" hanya kata-kata subjektif. Fakta tetap utuh.

**R3: Peserta komplain karena merasa "dipermalukan" ke pimpinan.**
Mitigasi: footer dengan jalur keberatan (7 hari kerja) ke penyelenggara. Label default sudah netral. Admin juga bisa custom threshold kalau mau lebih generous.

**R4: Insight narasi janggal di edge case.**
Sudah dihandle di 3.6.3 section C.4.

**R5: Batch generation lambat untuk >100 peserta.**
Mitigasi sama dengan v2: limit 50 per batch di MVP, offload ke server kalau jadi masalah nyata.

**R6: Bahasa threshold kustom menyinggung.**
Mitigasi: blacklist kata negatif dengan warning saat admin mengetik.

---

## Ringkasan 1 Menit

Aplikasi final 7 modul. **Report peserta** desain untuk dwiguna — peserta (refleksi) + pimpinan (akuntabilitas) — dengan prinsip **"personal tapi akuntabel"**: fakta objektif transparan, bahasa subjektif dibuat netral.

**Kunci desain Section B:** komponen subjektif (kehadiran, keaktifan, respek) pakai label deskriptif + fakta pendukung, threshold label dapat di-custom admin per-bimtek dengan guardrail blacklist kata negatif. Komponen kuantitatif (pre, post, nilai akhir) tetap angka asli — tidak disamarkan.

**Status dokumen ini:** final. Bisa langsung jadi basis implementasi milestone M0-M3. Total estimasi MVP 30-44 jam dengan AI coding assist.

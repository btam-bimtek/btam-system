# Resume Diskusi — 11 Mei 2026

**Milestone:** M1.7 — Input Nilai & Kelulusan  
**Status:** ⬜ Belum coding — desain selesai, siap eksekusi  
**Sesi:** Diskusi dari HP (tidak ada coding)

---

## 1. Status Masuk Sesi

| Milestone | Status |
|---|---|
| M1.1 Foundation | ✅ Done |
| M1.2 Master Data Core | ✅ Done |
| M1.3 Bank Soal | ✅ Done |
| M1.4 Bimtek CRUD | ✅ Done |
| M1.5 Exam Editor + Magic Link | ✅ Done |
| M1.6 Exam Runner | ✅ Done — Layer A tested |
| **M1.7 Input Nilai & Kelulusan** | **⬜ Next — desain selesai** |

---

## 2. Keputusan Workflow

### 2.1 Claude Code vs claude.ai

Disepakati workflow hybrid:
- **PC** → pakai Claude Code (baca/tulis file langsung, tanpa upload/download)
- **HP** → pakai claude.ai untuk diskusi, arsitektur, keputusan desain

Alasan: claude.ai di HP tidak bisa akses filesystem. Upload/download berulang tidak efisien. Claude Code hanya bisa di PC/desktop.

---

## 3. Keputusan Desain M1.7

### 3.1 Struktur Tab

Tab "Penilaian" ditambahkan sebagai **satu tab** di Bimtek detail (bukan dipecah jadi tab terpisah per komponen). Di dalam tab Penilaian ada **sub-tab**:

```
Penilaian
├── Kehadiran
├── Nilai Manual
├── Pre/Post
└── Kelulusan
```

Alasan: keempat komponen adalah satu workflow berurutan. Navbar sudah ada 6 tab — menambah lebih banyak terlalu panjang.

### 3.2 Tab Kehadiran

- Layout: **baris = peserta, kolom = sesi mapel**
- Kolom dikelompokkan per hari dengan header tanggal
- Scroll horizontal ada tapi terstruktur (bukan flat)
- Hanya sesi `tipe = 'mapel'` yang di-track — pembukaan/break/ISHOMA tidak dihitung
- Catatan: jumlah sesi mapel bisa 15-20+ (bukan maksimal 9 — yang maks 9 adalah JP per hari, bukan jumlah sesi)

### 3.3 Tab Nilai Manual

| Komponen | UI |
|---|---|
| Nilai pengajar | Expandable per mapel (satu baris per mapel, bisa di-expand) |
| Keaktifan | Satu angka per peserta |
| Respek | Satu angka per peserta |
| Tugas | Tampil hanya kalau `hasTugas = true` |
| Presentasi | Tampil hanya kalau `hasPresentasi = true` |

Input nilai pengajar: **admin saja** (pengajar belum punya login di Phase 1).

### 3.4 Scoring Engine (Pre/Post)

Alur:
```
exam_submissions
  → fetch bank_soal_answers
  → hitung skor per soal (bobot Bloom)
  → tulis exam_results (overwrite kalau sudah ada)
  → update bimtek_scores.pretest / posttest
```

**Selalu overwrite** — tidak skip kalau `exam_results` sudah ada. Ini handle skenario rescoring saat kunci jawaban diubah. Field `rescoredAt` diisi saat overwrite.

### 3.5 Redistribusi Bobot (Weight)

Kalau `hasTugas = false` atau `hasPresentasi = false`, bobot komponen yang tidak aktif **masuk ke nilai pengajar** (bukan didistribusi rata ke semua komponen):

```js
bobotPengajarEfektif = weights.pengajar
  + (hasTugas ? 0 : weights.tugas)
  + (hasPresentasi ? 0 : weights.presentasi)
```

### 3.6 Formula Nilai Akhir

```js
nilaiAkhir =
  (pretest    × weights.pretest) +
  (posttest   × weights.posttest) +
  (pengajar   × bobotPengajarEfektif) +
  (kehadiran  × weights.kehadiran) +
  (keaktifan  × weights.keaktifan) +
  (respek     × weights.respek) +
  (hasTugas    ? tugas    × weights.tugas    : 0) +
  (hasPresentasi ? presentasi × weights.presentasi : 0)
```

Total bobot selalu = 100% karena redistribusi ke pengajar.

### 3.7 Tab Kelulusan

- List peserta + nilai akhir + status lulus/tidak
- KKM default dari `bimtek.kkm` (default 60)
- Threshold deskriptif configurable per bimtek (`reportThresholds`)
- Blacklist kata negatif saat input threshold custom

---

## 4. Scope M1.7 (Revisi)

Lebih besar dari estimasi OPUSPLAN (16-22 jam) karena scoring engine masuk di sini:

| Komponen | Alasan Masuk M1.7 |
|---|---|
| Scoring engine | M1.8 (Report) butuh `exam_results` sudah terisi — tidak bisa defer |
| Tab Kehadiran | Core penilaian |
| Tab Nilai Manual | Core penilaian |
| Tab Pre/Post Sync | Trigger scoring engine dari UI |
| Tab Kelulusan | Output akhir penilaian |

**Estimasi direvisi: ~25-30 jam**

---

## 5. File yang Dibutuhkan untuk Coding

Upload sekaligus saat di PC:

| File | Path |
|---|---|
| `detail.js` | `admin/js/modules/bimtek/` |
| `api.js` | `admin/js/modules/bimtek/` |
| `exam-api.js` | `admin/js/modules/bimtek/` |
| `constants.js` | `shared/` |
| `main.css` | `admin/styles/` |

---

## 6. File yang Akan Dibuat (M1.7)

| File | Deskripsi |
|---|---|
| `tab-penilaian.js` | Orchestrator sub-tab Penilaian |
| `penilaian-api.js` | CRUD bimtek_scores, bimtek_attendance, exam_results |
| `sub-kehadiran.js` | UI matrix kehadiran |
| `sub-nilai-manual.js` | UI input nilai manual |
| `sub-prepost.js` | UI sync + trigger scoring engine |
| `sub-kelulusan.js` | UI list kelulusan + threshold config |
| `scorer.js` | Scoring engine (submissions → results) |

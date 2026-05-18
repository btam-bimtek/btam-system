# Resume Implementasi — 18 Mei 2026
## M1.8 Completion + M1.9 Dashboard & Settings + Bugfixes

**Tanggal:** 18 Mei 2026  
**Status Akhir:** M1.1–M1.9 ✅ Done | M1.10 ⬜ End-to-end Testing  
**Commit Terakhir:** `d2ad903` fix: bloom level tidak wajib diisi di bank soal  
**Live URL:** https://btam-bimtek.github.io/btam-system/admin/

---

## Yang Dikerjakan Sesi Ini

### 1. Commit M1.8 + M1.9 (sudah ada di branch, belum di-commit)

Sesi dimulai dengan kode M1.8 dan M1.9 yang sudah ditulis di sesi sebelumnya namun belum di-commit. Di-commit dengan dua commit:

- `b5c60f8` — docs: update PROGRESS.md
- `f630a17` — feat: M1.8 Report + M1.9 Dashboard & Settings

### 2. M1.8 Fix — Laporan Peserta Section A & C

Setelah review, ditemukan dua gap di M1.8:

**Gap 1 — Section A kop surat hardcoded**
- File: `admin/js/modules/bimtek/sub-report-peserta.js`
- Fix: import `getAppSetting('lembaga')` parallel dengan fetch peserta
- `_buildSectionA` sekarang menggunakan `S.lembagaSettings` (fallback ke default jika null)

**Gap 2 — Section C tidak ada per-EK grouped bar chart**
- Spec (STRUKTUR_APLIKASI_v3) minta C.1 total chart, C.2 per-EK chart, C.3 tabel, C.4 narasi
- Fix: tambah `<canvas id="report-chart-ek">` dengan tinggi adaptif `Math.max(160, ekComparison.length * 36)px`
- Tambah `_initSectionCEKChart(data)`: Chart.js horizontal bar, pre (gray) vs post (blue), grouped
- AutoPrint timeout: 400ms → 700ms (beri waktu dua chart render)

### 3. M1.8 Enhancement — Tab "Per Soal" di Laporan Penyelenggara

Fitur baru: inner tab "Per Soal" di antara "Per EK" dan "Per Pengajar".

**File `report-api.js`:**
- `getBimtekReportData` return sekarang include `soalErrorData`
- Fungsi `_buildSoalErrorData(examResults, exams)`:
  - Fetch soal dari Firestore berdasarkan `soalIds` di setiap exam
  - Aggregate: totalAttempts, salahCount, preAttempts, preSalah, postAttempts, postSalah
  - Return sorted by `persenSalah` desc

**File `sub-report-penyelenggara.js`:**
- Tambah tab button "Per Soal"
- `_renderPerSoal(el)`: bar chart top-10 + tabel lengkap
  - Tabel: #, Pertanyaan (dengan badge EK+Bloom), Attempt, Salah, % bar (merah/kuning/hijau), Pre/Post breakdown
  - Chart: horizontal bar, warna adaptif (≥70% merah, 40-69% kuning, <40% hijau), tooltip truncate pertanyaan

### 4. Bugfix — Bloom Level Tidak Wajib

**Problem:** Import soal dari Excel gagal jika kolom Bloom kosong.

**Root cause:** Validasi di `_validateSoal` throw error jika `bloomLevel` kosong. Di-set required juga di form UI.

**Fix (3 file, commit `d2ad903`):**

| File | Perubahan |
|------|-----------|
| `admin/js/modules/bank-soal/api.js` | Hapus: `if (!data.bloomLevel) errors.push(...)` |
| `admin/js/modules/bank-soal/form.js` | Hapus asterisk `*` dan `required` dari select bloomLevel |
| `admin/js/modules/bank-soal/import.js` | `bloomLevel` default `''` bukan `undefined` |

---

## Arsitektur File (Lengkap per 18 Mei 2026)

```
btam-system/
├── admin/
│   ├── index.html                        ← SPA shell, import Chart.js CDN
│   ├── styles/main.css                   ← Custom classes (form-input, btam-table, dll)
│   └── js/
│       ├── app.js                        ← Router hash-based
│       ├── components/
│       │   ├── modal.js                  ← openModal(config) — reusable
│       │   └── toast.js                  ← showToast(msg, type)
│       └── modules/
│           ├── auth/login.js
│           ├── dashboard/index.js        ← Live stats + quick actions (M1.9)
│           ├── settings/
│           │   ├── api.js                ← getAppSetting / saveAppSetting
│           │   └── index.js              ← 5 sub-tab: lembaga/bloom/threshold/logo/audit
│           ├── peserta-master/           ← CRUD + import Excel
│           ├── pengajar-master/          ← CRUD
│           ├── instansi-master/          ← CRUD
│           ├── bank-soal/
│           │   ├── api.js                ← createSoal/updateSoal/listSoal/pickSoalRandom
│           │   ├── form.js               ← Form add/edit soal + gambar upload
│           │   ├── import.js             ← Import Excel (SheetJS CDN)
│           │   └── index.js
│           └── bimtek/
│               ├── api.js                ← CRUD bimtek
│               ├── list.js               ← List bimtek dengan filter
│               ├── detail.js             ← Router tab bimtek detail
│               ├── form.js               ← Form create/edit bimtek
│               ├── form-mapel.js
│               ├── tab-jadwal.js         ← Scheduler dengan drag+shift
│               ├── tab-peserta.js
│               ├── tab-pengajar.js
│               ├── tab-ujian.js          ← Exam editor + magic link
│               ├── exam-api.js
│               ├── tab-penilaian.js      ← Orchestrator penilaian
│               ├── penilaian-api.js
│               ├── scorer.js             ← Scoring engine
│               ├── sub-kehadiran.js
│               ├── sub-nilai-manual.js
│               ├── sub-prepost.js
│               ├── sub-kelulusan.js
│               ├── sub-pelanggaran.js
│               ├── tab-report.js         ← Tab report (sub-tab penyelenggara/peserta)
│               ├── report-api.js         ← Aggregasi data laporan + soalErrorData
│               ├── report-narrative.js   ← Narasi otomatis Section C
│               ├── sub-report-penyelenggara.js  ← Chart + tabel + per soal
│               └── sub-report-peserta.js        ← Laporan peserta 4 section
├── exam/
│   ├── index.html                        ← Exam runner (standalone, light theme)
│   └── js/
│       ├── app.js
│       ├── entry.js
│       ├── instructions.js
│       ├── exam.js                       ← Timer, shuffle, anti-cheat
│       └── submit.js
└── shared/
    ├── constants.js                      ← BIDANG_LIST, BLOOM_LEVELS, COL, KOMPONEN_NILAI
    ├── db.js                             ← Firestore helpers (snapToArray, dll)
    ├── firebase-config.js                ← Firebase init (auth + db + storage)
    ├── logger.js                         ← logAudit
    └── normalize.js                      ← generateId, dll
```

---

## Firestore Collections

| Collection | Deskripsi |
|---|---|
| `admin_users` | Admin yang boleh login |
| `peserta_master` | Data peserta (noPeserta sebagai id) |
| `pengajar_master` | Data pengajar |
| `instansi_master` | Data instansi |
| `bank_soal` | Soal (opsi tanpa kunci) |
| `bank_soal_answers` | Kunci jawaban — collection terpisah, tidak bisa diakses exam app |
| `bimtek` | Jadwal bimtek (embed sesis, mapels) |
| `bimtek_scores` | Nilai per peserta per bimtek |
| `bimtek_attendance` | Kehadiran per peserta per sesi |
| `exams` | Konfigurasi ujian (soalIds, tipe, published) |
| `exam_sessions` | Token magic link per peserta per exam |
| `exam_submissions` | Jawaban peserta (raw) |
| `exam_results` | Hasil scoring per soal: `{ soalId: { benar, bobot, skor } }` |
| `app_settings` | Settings lembaga: `lembaga`, `bobotBloom`, `threshold`, `logo` |
| `audit_log` | Log semua aksi admin |

---

## Firebase Storage

| Path | Isi |
|---|---|
| `settings/logo.{ext}` | Logo lembaga untuk kop surat |
| `bank-soal/{soalId}/pertanyaan.{ext}` | Gambar soal |

**Bucket:** `bimtek-27fe5.firebasestorage.app` (region `asia-southeast1`)

---

## Known Issues & Next Steps

### ⬜ M1.10 — End-to-End Testing
Manual test full workflow:
1. Buat bimtek → isi jadwal → tambah peserta & pengajar
2. Buat exam (pretest + posttest) → generate magic link
3. Peserta ikut ujian via magic link
4. Admin: sync submissions → trigger scoring
5. Input nilai manual → hitung kelulusan
6. Generate laporan penyelenggara + laporan peserta

### Backlog (Lower Priority)
- `scorer.js` tidak baca custom bobot Bloom dari Settings (masih pakai `BLOOM_MAP` dari constants)
- Validasi exam published sebelum soal picker bisa digunakan
- Hapus Eruda debug dari `exam/index.html`

---

## Catatan Penting

- **No bundler** — semua import langsung di browser (ES modules)
- **GitHub Pages** — deploy otomatis dari branch `main`, path `/admin/`
- **Firestore Rules** — perlu update manual saat ada collection baru atau path Storage baru
- **SheetJS** — dimuat lazy via CDN saat modal import dibuka (bukan di index.html)
- **Chart.js** — dimuat di `index.html` (bukan lazy), versi 4.4.3

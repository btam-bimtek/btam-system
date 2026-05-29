# BTAM System — Project Knowledge & Decision Log

Dokumentasi lengkap desain, keputusan arsitektur, dan progress implementasi.

## 📋 Dokumentasi Utama

### Blueprint & Desain

- **`OPUSPLAN_20APR2026.md`** ⭐ **BACA INI DULU**
  - Blueprint komprehensif Phase 1-3 (165-442 jam)
  - Schema Firestore lengkap, security rules, workflow diagram
  - 22 risiko + mitigasi, testing strategy
  - **Status:** Final v3 (20 April 2026)

### Resume Diskusi (Arsitektur)

Rekam keputusan di setiap sesi diskusi:

1. **`RESUME_DISKUSI_19APR2026_SESI1.md`** (19 Apr)
   - Phasing (Phase 1→2a→2b→3), arsitektur, peserta master, bidang/tipe bimtek
   - Dashboard alumni (peta choropleth, live edit)
   
2. **`RESUME_DISKUSI_19APR2026_SESI2.md`** (19 Apr)
   - Mapel vs Sesi refactor, pendaftar vs peserta, scheduler form-based
   - Evaluasi pengajar (anonimitas schema-level)

3. **`RESUME_DISKUSI_20APR2026_SESI3.md`** (20 Apr)
   - Seed data historis (12.355 alumni 1990-2025)
   - Fix `kode_daerah` (duplikat, pemekaran Papua)
   - Dashboard Kinerja Instansi (M2a.5 baru)

4. **`RESUME_DISKUSI_11MEI2026_M1.7.md`** (11 May)
   - Workflow hybrid (PC=Claude Code, HP=claude.ai)
   - M1.7 desain: 4 sub-tab penilaian, scoring engine, redistribusi bobot

5. **`RESUME_DISKUSI_26MEI2026_EK_MASTER.md`** (26 May) ⭐ NEW
   - Arsitektur Master EK global (lintas bidang, lintas bimtek)
   - Keputusan: EK sebagai entitas global, bimtek punya `ekIds` baseline
   - Tracing: compute on-the-fly, UI di halaman detail peserta
   - Scope M1.11 (Master EK) + M1.12 (Tracing)

6. **`RESUME_IMPLEMENTASI_13MEI2026_GAMBAR_SOAL.md`** (13 May)
   - Fitur upload gambar soal ke Firebase Storage
   - Setup infrastruktur: upgrade Blaze, CORS, Storage Rules
   - Kendala & solusi lengkap (CORS, 403, bucket not found)

### Resume Implementasi (Coding Progress)

Per-milestone progress, bugs fixed, keputusan teknis:

1. **`RESUME_IMPLEMENTASI_24APR2026_M1.1-1.3.md`** (24 Apr)
   - M1.1-1.3 selesai dalam ~10 jam (2 hari) — 85% lebih cepat estimasi
   - GitHub Pages setup, testing layer A

2. **`RESUME_IMPLEMENTASI_24APR2026_SESI2_M1.4.md`** (24 Apr)
   - M1.4 CRUD bimtek selesai
   - 5 bug fix (router signature, bidang field, styling, dll)

3. **`RESUME_IMPLEMENTASI_27APR2026_M1.4_STAB.md`** (27 Apr)
   - M1.4 stabilisasi & bug fix lengkap (14 bug)
   - **3 Coding Rules** yang wajib dipatuhi:
     - Always read existing files sebelum coding
     - Tailwind + custom CSS only
     - Nilai Pengajar = rata-rata dari semua pengajar

4. **`RESUME_IMPLEMENTASI_03MEI2026_M1.4_JADWAL.md`** (03 May)
   - M1.4 Tab Jadwal (complex scheduler)
   - Segmentasi mapel, shift periode, inisialisasi hari
   - 7 bug fix

5. **`RESUME_IMPLEMENTASI_06MEI2026_M1.4_M1.5.md`** (06 May)
   - M1.4 final: peserta modal revamp
   - M1.5 Exam Editor + Magic Link selesai
   - Schema exam/exam_sessions finalized

6. **`RESUME_IMPLEMENTASI_07MEI2026_M1.6.md`** (07 May)
   - **M1.6 Exam Runner selesai** — Layer A tested
   - Anti-cheat engine (tab switch, fullscreen, copy, devtools)
   - Scoring ditunda ke Phase 2 via Cloud Function
   - Dua entry point exam app (magic link + portal login seleksi M2b.3)

### Legacy Dokumentasi (Referensi Saja)

- **`SCHEMA_HARMONIZATION_17APR2026.md`** — Harmonisasi schema dua aplikasi lama
- **`STRUKTUR_APLIKASI_v3_17APR2026.md`** — Struktur penilaian (sekarang di OPUSPLAN)

## 📊 Status Milestone

| Milestone | Status | Durasi | Tanggal |
|-----------|--------|--------|---------|
| M1.1 Foundation | ✅ Done | ~5 jam | 24 Apr |
| M1.2 Master Data Core | ✅ Done | ~3 jam | 24 Apr |
| M1.3 Bank Soal | ✅ Done | ~2 jam | 24 Apr |
| M1.4 Bimtek CRUD | ✅ Done | ~25 jam | 27 Apr - 6 May |
| M1.5 Exam Editor | ✅ Done | ~12 jam | 6 May |
| M1.6 Exam Runner | ✅ Done | ~18 jam | 7 May |
| M1.7 Input Nilai | ✅ Done | ~8 jam | 11 May |
| M1.8 Report Generation | ✅ Done | ~1 sesi | 18 May |
| M1.9 Dashboard + Settings | ✅ Done | ~1 sesi | 18 May |
| **M1.11 Master EK + Laporan** | ⬜ Next | ~8-12 jam | TBD |
| M1.12 Tracing Kompetensi | ⬜ Next | ~6-10 jam | TBD |
| M1.10 E2E Testing | ⬜ Last | ~8-12 jam | TBD |

**Total Phase 1 (M1.1-1.12+1.10):** ~179-242 jam | **Target:** Jul 2026

## 🛠️ 3 Coding Rules Wajib Dipatuhi

1. **Always read existing files first** — sebelum nulis kode apapun, baca:
   - `constants.js` (enum, default values)
   - `api.js` modul terkait (schema, function signatures)
   - File yang sudah ada untuk understand naming convention

2. **Tailwind + Custom CSS Only** — jangan Bootstrap
   - Inline style hanya untuk warna dinamis
   - Custom class dari `admin/styles/main.css`

3. **Nilai Pengajar = rata-rata dari semua pengajar**
   - Atau dari pengajar pengampu mapel jika multi-pengajar
   - Bobot tugas/presentasi tidak aktif → redistribusi ke pengajar

## 📌 File Penting di Repo

```
btam-system/
├── docs/                          ← Anda di sini
│   ├── README.md                  ← Dokumentasi index
│   ├── OPUSPLAN_20APR2026.md      ← Blueprint utama
│   └── RESUME_*.md                ← 13 file lainnya
├── PROGRESS.md                    ← Status milestone (update berkala)
├── shared/                        ← Shared utilities
├── admin/                         ← Admin app (Tailwind, Firestore)
│   └── js/modules/bimtek/
│       ├── api.js                 ← CRUD bimtek, mapel, jadwal, exam
│       ├── detail.js              ← Detail bimtek multi-tab
│       ├── form.js, form-mapel.js, tab-jadwal.js, ...
│       └── exam-api.js            ← Exam CRUD (M1.5)
└── exam/                          ← Exam app (student-facing)
    └── js/
        ├── app.js                 ← Orchestrator (token → exam → submit)
        ├── exam-runner.js         ← UI ujian + timer
        ├── anti-cheat.js          ← Anti-cheat engine
        └── db.js                  ← Firestore helpers
```

## 🚀 Next: M1.11 Master EK + Link ke Bimtek + Update Laporan

**File yang akan dibuat/diubah:**
- `admin/js/modules/master-ek/api.js` — CRUD EK
- `admin/js/modules/master-ek/index.js` — List EK
- `admin/js/modules/master-ek/form.js` — Form CRUD
- `admin/js/modules/master-ek/import.js` — Import Excel
- `shared/constants.js` — tambah `COL.ELEMEN_KOMPETENSI`
- `admin/js/router.js` — tambah route `/master-ek`
- `admin/js/modules/bimtek/form.js` — tambah EK multi-select
- `admin/js/modules/bimtek/api.js` — update field `ekIds`
- `admin/js/modules/bimtek/report-api.js` — gunakan `ekIds` sebagai baseline
- `firestore.rules` — tambah rule `elemen_kompetensi`

**Estimasi:** ~8-12 jam

**Wajib baca sebelum mulai:**
- `docs/RESUME_DISKUSI_26MEI2026_EK_MASTER.md` (keputusan desain lengkap)
- `shared/constants.js` (COL, BIDANG_LIST)
- `admin/js/modules/bimtek/report-api.js` (cara kerja laporan sekarang)
- 3 coding rules di atas

---

**Last Update:** 26 Mei 2026  
**Status:** M1.9 ✅ Done | M1.11 ⬜ Next (Master EK)

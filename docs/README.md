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
| **M1.7 Input Nilai & Kelulusan** | ⬜ Next | ~25-30 jam | TBD |
| M1.8 Report Peserta | ⬜ Future | ~12-16 jam | - |
| M1.9+ | ⬜ Future | - | - |

**Total Phase 1 (M1.1-1.10):** ~265-355 jam | **Target:** End Juni 2026

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

## 🚀 Next: M1.7 Input Nilai & Kelulusan

**File yang akan dibuat:**
- `tab-penilaian.js` — Orchestrator 4 sub-tab
- `penilaian-api.js` — CRUD scores, attendance, results
- `sub-kehadiran.js` — Matrix kehadiran (baris=peserta, kolom=sesi)
- `sub-nilai-manual.js` — Input pengajar/keaktifan/respek/tugas/presentasi
- `sub-prepost.js` — Sync + trigger scoring engine
- `sub-kelulusan.js` — List + threshold config
- `scorer.js` — Scoring engine (submissions → results)

**Estimasi:** 25-30 jam

**Wajib baca sebelum mulai:**
- OPUSPLAN section 3.5 (Input Nilai & Kelulusan)
- RESUME_DISKUSI_11MEI2026_M1.7.md (desain lengkap)
- 3 coding rules di atas

---

**Last Update:** 11 Mei 2026  
**Status:** M1.6 ✅ Done | M1.7 ⬜ Next

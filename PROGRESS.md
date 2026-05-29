# Progress Implementasi Sistem Bimtek BTAM

**Last Updated:** 26 Mei 2026  
**Status:** M1.1-1.9 ✅ Done | M1.10 dipindah ke akhir | M1.11-1.12 ⬜ Master EK + Tracing (baru)  
**Total Progress:** 9/12 milestones selesai (Phase 1 core 75% — milestone baru ditambah)

---

## Milestone Completion

### ✅ M1.1 — Foundation (Done)
**Selesai:** 24 April 2026  
**Durasi:** ~5 jam  
**Deliverables:**
- Login admin (Firebase Auth email/password)
- Hash-based routing (SPA)
- Auth guard (redirect ke login jika belum auth)
- Firestore rules deploy
- GitHub Pages hosting

### ✅ M1.2 — Master Data Core (Done)
**Selesai:** 24 April 2026  
**Durasi:** ~3 jam  
**Deliverables:**
- CRUD peserta (form + table, search, pagination)
- CRUD pengajar (form + table, bidang badge)
- CRUD instansi (form + table)
- Import Excel (peserta, pengajar, instansi)
- Duplicate detection (noPeserta case-insensitive)

### ✅ M1.3 — Bank Soal (Done)
**Selesai:** 24 April 2026  
**Durasi:** ~2 jam  
**Deliverables:**
- CRUD soal (form dengan dropdown bidang + Bloom level)
- Filter soal per bidang, per Bloom, per tipe
- Import Excel soal
- Kunci jawaban terpisah di collection `bank_soal_answers`

### ✅ M1.4 — Bimtek CRUD (Done)
**Selesai:** 6 Mei 2026  
**Durasi:** ~25 jam  
**Deliverables:**
- List bimtek (filter status/tipe/bidang)
- Form create/edit bimtek (tipe Reguler/PNBP, bidang single/multi, bobot penilaian)
- Tab Mata Pelajaran (CRUD mapel 1-9 JP)
- Tab Jadwal (scheduler form-based dengan validasi blocker)
  - Inisialisasi semua hari
  - Assign mapel ke slot kosong
  - Segmentasi mapel otomatis saat split di break
  - Shift periode (semua sesi bergeser saat tanggal berubah)
  - Export Excel jadwal
- Tab Peserta (modal search + checklist)
- Tab Pengajar (modal search + checklist)
- Bobot redistribusi otomatis (tugas/presentasi tidak aktif → pengajar)

**Bugs Fixed:** 27 bugs (5 di sesi 1, 14 di stabilisasi, 7 di jadwal, 1 di shift)

### ✅ M1.5 — Exam Editor & Magic Link (Done)
**Selesai:** 6 Mei 2026  
**Durasi:** ~12 jam  
**Deliverables:**
- List exam (card view dengan badge tipe pretest/posttest/pretest_posttest)
- Form create/edit exam (soal picker dengan Bloom + bidang filter)
- Soal recipe builder (pilih N soal dari pool)
- Generate magic link per peserta (batch, skip existing)
- Publish/unpublish exam
- Tab Ujian di detail bimtek (list exam + link generation + reset session)

**Schema:**
- `exams` collection
- `exam_sessions` collection (dengan token magic link)
- Firestore index untuk query efficient

### ✅ M1.6 — Exam Runner (Done)
**Selesai:** 7 Mei 2026  
**Durasi:** ~18 jam  
**Status:** Layer A tested (happy path 100%, edge case TBD)  
**Deliverables:**
- `/exam/` app (light theme, standalone)
- Entry screen (token validation + noPeserta input)
- Instructions screen
- Exam screen dengan:
  - Soal renderer (shuffle deterministik per token)
  - Opsi shuffle (deterministik per soal+token)
  - Navigation (prev/next/grid)
  - Mark for review
  - Timer + auto-save (30 detik)
  - Resume setelah refresh
- Submit + confirmation
- Anti-cheat engine:
  - Fullscreen mandatory (re-request jika exit)
  - Tab switch detection → warning
  - Window blur detection → warning
  - Copy/cut/paste blocked
  - Right-click blocked
  - DevTools blocked (F12, Ctrl+Shift+I/J/C, Ctrl+U)
  - Max 3 warnings → auto-submit
  - Watermark noPeserta

**Keputusan Desain:**
- Scoring: submit dulu, nilai diproses admin (tidak client-side) — security
- Upgrade path: Cloud Function Phase 2 (Blaze plan required)
- Dua entry point: magic link (M1.6) + portal login (M2b.3 seleksi)

**Firestore Rules Updated:**
- `exam_sessions`: allow update dari status 'issued' (peserta mulai ujian)
- `bank_soal`: allow read unauthenticated (exam app baca soal)

### ✅ M1.7 — Input Nilai & Kelulusan (Done)
**Selesai:** 11 Mei 2026  
**Durasi:** ~8 jam  
**Status:** Layer A implementation complete, integration done  
**Deliverables:**
- Tab Penilaian (satu tab dengan 4 sub-tab):
  - Sub-tab Kehadiran: matrix peserta × sesi mapel dengan bulk save + % calculation
  - Sub-tab Nilai Manual: input pengajar/keaktifan/respek/tugas/presentasi dengan 0-100 validation
  - Sub-tab Pre/Post: sync exam submissions, trigger scoring engine, display result counts
  - Sub-tab Kelulusan: list lulus/tidakLulus, KKM config, threshold deskriptif dengan negative word blacklist validation
- Scoring engine (scorer.js):
  - hitungSkor: soal per submission dengan bobot Bloom (C1=1 ... C6=6)
  - scoreAllSubmissions: batch score all submissions untuk satu exam
  - hitungNilaiAkhir: formula 8 komponen dengan bobot redistribusi (tugas/presentasi inactive → pengajar)
  - cekKelulusan: nilaiAkhir ≥ KKM check
- API layer (penilaian-api.js):
  - Get-or-create pattern untuk bimtek_scores dan attendance
  - Firestore CRUD dengan nested field updates
  - listBimtekScores enrichment (nilaiAkhir + lulus computed)
  - bulkUpdateKehadiran matrix submission handling

**Schema Used:**
- `bimtek_scores` collection (noPeserta, pengajar, keaktifan, respek, tugas, presentasi, kehadiran, nilaiAkhir, lulus)
- `bimtek_attendance` collection (nested sessions per sesiId)
- `exam_results` collection (examId, noPeserta, tipeSession, perolehan)

**Integration:**
- detail.js: added Penilaian tab button + renderTabPenilaian router case
- tab-penilaian.js: orchestrator loads scores + sesis, manages sub-tab switching

### ✅ Patch — Gambar Soal (Done)
**Selesai:** 13 Mei 2026  
**Durasi:** ~1 sesi  
**Deliverables:**
- Upload gambar opsional pada pertanyaan soal → Firebase Storage (`bank-soal/{soalId}/pertanyaan.{ext}`)
- Preview gambar di form tambah/edit soal (validasi maks 2MB)
- Gambar tampil di exam runner antara teks pertanyaan dan opsi jawaban
- Setup Firebase Storage (upgrade Spark → Blaze, buat bucket `asia-southeast1`, CORS config, Storage Rules)

### ✅ M1.8 — Report Generation (Done)
**Selesai:** 18 Mei 2026  
**Durasi:** ~1 sesi  
**Deliverables:**
- Tab Report di bimtek detail (sub-tab: Penyelenggara, Peserta)
- Laporan Penyelenggara: 4 inner-tab (overview, per-peserta, per-EK, per-pengajar) + Chart.js
- Laporan Peserta: list peserta + preview 4-section (A: kop+identitas, B: nilai, C: kompetensi, D: penutup)
- report-api.js: aggregasi data (scores enrichment, per-EK comparison, distribusi nilai)
- report-narrative.js: narasi otomatis Section C (7 edge case handling)
- Print mode via `window.print()` dengan print CSS
- Chart.js CDN ditambahkan ke admin/index.html

### ✅ M1.9 — Dashboard Home + Settings (Done)
**Selesai:** 18 Mei 2026  
**Durasi:** ~1 sesi  
**Deliverables:**
- Dashboard: live stats (bimtek aktif, total bimtek, total peserta, total pengajar), recent bimtek list, quick action buttons
- Halaman Settings (5 sub-tab):
  - Info Lembaga: nama, alamat, website, email, telepon
  - Bobot Bloom: custom bobot C1-C6 (global)
  - Threshold: KKM default + kehadiran minimum
  - Logo: upload ke Firebase Storage → tampil di kop surat laporan peserta
  - Audit Log: viewer dengan filter action + entity type

**Catatan Deployment:**
- Storage Rules perlu update untuk path `settings/**` agar upload logo bisa jalan
- Tambahkan rule: `match /settings/{allPaths=**} { allow read, write: if request.auth != null; }`

---

### ⬜ M1.11 — Master EK + Link ke Bimtek + Update Laporan
**Target:** TBD  
**Estimasi:** ~8-12 jam  
**Keputusan Desain:** `docs/RESUME_DISKUSI_26MEI2026_EK_MASTER.md`  
**Deliverables:**
- Modul `master-ek`: CRUD + Import Excel
- Update form & API bimtek: tambah field `ekIds`
- Update laporan peserta Section C: gunakan `bimtek.ekIds` sebagai baseline EK
- Update Firestore rules: tambah `elemen_kompetensi`
- Bank soal: badge warning kalau EK tidak ada di master

### ⬜ M1.12 — Tracing Kompetensi Peserta + Halaman Detail Peserta
**Target:** TBD  
**Estimasi:** ~6-10 jam  
**Deliverables:**
- Halaman detail peserta (`/peserta/:noPeserta`): Tab Info + Tab Riwayat Bimtek + Tab Kompetensi
- Tab Kompetensi: trend EK lintas bimtek (tabel + chart)
- `getPesertaEKHistory()` API function
- Update list peserta: nama jadi link klik

---

## Phase 1 Summary

| Fase | Milestone | Est. Jam | Real Jam | Status |
|------|-----------|----------|----------|--------|
| Core (M1.1-1.3) | Foundation → Bank Soal | 53-73 | ~10 | ✅ |
| Bimtek (M1.4) | Bimtek CRUD | 18-22 | ~25 | ✅ |
| Exam (M1.5-1.6) | Exam Editor + Runner | 26-36 | ~30 | ✅ |
| Penilaian (M1.7) | Input Nilai & Kelulusan | 16-22 | ~8 | ✅ |
| Report (M1.8-1.9) | Report + Dashboard + Settings | ~40 | ~2 sesi | ✅ |
| EK (M1.11) | Master EK + Update Laporan | 8-12 | TBD | ⬜ |
| Tracing (M1.12) | Tracing Kompetensi Peserta | 6-10 | TBD | ⬜ |
| Testing (M1.10) | End-to-end testing (incl. EK) | 8-12 | TBD | ⬜ |
| **Phase 1 Total** | **M1.1-1.12+1.10** | **~179-242** | **~75+** | **75% done** |

---

## Known Issues & Backlog

### M1.4
- [x] Bug: Tambah mapel crash (listPengajar return object)
- [x] Bug: Tambah peserta tidak jalan (listPeserta return object)
- [x] Bug: Validasi tabrakan salah (overlap dengan break)
- [x] Bug: Hapus mapel tersegmen gagal (filter sesis mismatch)
- [x] Bug: Hapus hari yang salah (timezone UTC vs Jakarta)
- [x] Bug: Bobot floating point (validation error)
- [x] Bug: Template literal bersarang (Tailwind class tidak generate)

### M1.6
- [x] Bug: Token format mismatch (#/session/TOKEN vs ?token=)
- [x] Bug: Label opsi teracak (render pakai opsi.id)
- [x] Bug: Warning reset saat refresh (warningCount hanya memory)
- [x] Bug: Overlay auto-submit saat confirm dialog (anti-cheat trigger false positive)
- [x] Todo: Hapus Eruda debug dari exam/index.html setelah testing
- [x] Todo: Validasi exam published sebelum soal picker (M1.9)

### Future Risks
- M1.7: Scoring engine floating point math → test ketat
- M2a: Firestore read cost (Phase 2a: 180k reads/hari) → Blaze wajib
- M2b: Seleksi 6k pendaftar × 5 ujian → load testing required

---

## Coding Standards

**3 Rules Wajib Dipatuhi:**

1. **Always read existing files first**
   - Baca `constants.js` (enum, defaults)
   - Baca `api.js` modul terkait (schema, function signatures)
   - Jangan asumsikan nama field

2. **Tailwind + Custom CSS Only**
   - No Bootstrap
   - Inline style untuk warna dinamis saja
   - Custom class dari `admin/styles/main.css`

3. **Nilai Pengajar = rata-rata dari semua pengajar**
   - Atau dari pengajar pengampu mapel jika multi-pengajar
   - Bobot tugas/presentasi tidak aktif → redistribusi ke pengajar

---

## Testing Strategy

**Layer A — Happy Path (100%)**
- Data valid, user benar → harus lulus

**Layer B — Edge Case (80%)**
- Data ekstrem, input tidak terduga → mayoritas harus lulus

**Layer C — Error Path (60%)**
- User salah, sistem gagal → error handling ada

---

## Dokumentasi

Semua design docs & decision logs di folder `/docs/`:
- `OPUSPLAN_20APR2026.md` — Blueprint utama
- `RESUME_DISKUSI_*` — Decision log per sesi diskusi
- `RESUME_IMPLEMENTASI_*` — Progress per milestone

Baca README.md di `/docs/` untuk index lengkap.

---

**Workflow:** PC (Claude Code) | HP (claude.ai)  
**Repository:** https://github.com/[user]/btam-system (private)  
**Live:** https://[user].github.io/btam-system/  
**Firebase Project:** bimtek-27fe5

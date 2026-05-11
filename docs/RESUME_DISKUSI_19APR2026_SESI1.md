# RESUME Diskusi Sistem BTAM — Snapshot 19 April 2026

**Cakupan:** Response 1-9 diskusi finalisasi arsitektur.  
**Status OPUSPLAN:** Final dengan revisi (peta choropleth + live edit alumni).  
**Next step:** Mulai coding Milestone 1.1 Foundation, atau diskusi detail lain.

---

## 1. Keputusan Final yang Sudah Dikunci

### 1.1. Phasing
Urutan eksekusi: **Phase 1 → 2a → 2b → 3**
- **Phase 1** (Mei-Jul 2026, 165-220 jam): Core Bimtek end-to-end untuk peserta yang sudah ditentukan
- **Phase 2a** (Aug-Sep 2026, 35-53 jam): Dashboard Alumni + Peta Choropleth + Live Edit
- **Phase 2b** (Okt-Nov 2026, 55-75 jam): Rekrutmen (administrasi + seleksi tertulis + penentuan)
- **Phase 3** (Des 2026, 25-40 jam): AI outreach, monitoring, sertifikat, batch PDF
- **Final testing** (Jan 2027, 15-25 jam)
- **Live** Feb 2027

**Total:** 295-413 jam.

**Alasan urutan 1→2a→2b→3:** User butuh dashboard alumni lebih awal untuk kebutuhan pelaporan, tapi critical path Phase 2b (rekrutmen, deadline Feb 2027) tetap dijaga.

### 1.2. Arsitektur
- 2 aplikasi terpisah: Admin app (dark, `/admin/`) + Exam app (light, `/exam/`)
- Vanilla HTML/JS/CSS + ES Modules + Tailwind CDN
- Firestore + Firebase Auth + Firebase Storage (project baru)
- GitHub Pages hosting
- Magic link untuk peserta, Firebase Auth email/password untuk admin

### 1.3. Peserta Master
**Opsi C dipilih:** Hybrid — ada master, admin bisa add peserta baru langsung dari form Bimtek (sistem otomatis juga insert ke master).

### 1.4. Bidang & Tipe Bimtek
- **4 Bidang fixed:** Produksi, Trandis, ME, Pendukung
- **2 Tipe:** Reguler (1 bidang, wajib seleksi) / PNBP (lintas bidang, peserta ditentukan klien, tanpa seleksi)
- **2 Mode:** Online (max 25 peserta, Zoom) / Offline (max 17 peserta, di BTAM)
- Pembayaran PNBP ignore dulu

### 1.5. Bank Soal
- **Mandiri** (dipisah dari exam): `bank_soal` + `bank_soal_answers`
- **Kategorisasi wajib:** bidang + Elemen Kompetensi + Bloom level (C1-C6)
- **Bobot:** global setting di `app_settings.bloomWeights` (default 1-6)
- **Strategi exam:** Soal Recipe — "N soal per EK", randomize per session
- **Tidak ada soal essay** (hanya multiple choice)
- Scoring weighted by bobot Bloom

### 1.6. Dashboard Alumni (Phase 2a) — Revisi Terbaru

**A. Sumber data:**
- `alumni_historis` (Firestore, **live-editable** bukan snapshot)
- `bimtek_scores` current system (filter lulus=true)

**B. Peta Choropleth:**
- Level **kabupaten/kota** (514 wilayah), bukan provinsi
- Color intensity **relatif ke seluruh Indonesia** (Kota Bandung banyak → tebal; Raja Ampat sedikit → pale)
- Static, tidak ada klik interaktif, tidak ada drill-down
- Library: **Leaflet + GeoJSON simplified** (target <2MB)
- Respon ke filter dashboard (tahun, bidang)

**C. Live Edit (bukan import-only):**
- UI Hybrid: datatable inline-edit untuk field kritis (provinsi, kab/kota, bidang) + modal untuk full edit
- Bulk edit dengan preview + undo window 10 menit
- User tetap bisa re-import mode Replace/Upsert kalau mau roundtrip via Excel
- Field tracking: `lastEditedAt`, `editCount` per record

**D. Collections baru:**
- `provinsi_master/{kodeBps}` — 38 provinsi seed
- `kabkota_master/{kodeBps}` — ~514 kab/kota seed dengan `aliases` untuk fuzzy match

**E. Fuzzy matching saat import:**
- "Bandung" → suggest "KOTA BANDUNG"
- Unmatched queue untuk manual review
- `peserta_master` juga pakai dropdown (bukan free text) untuk `kabKotaKode`

### 1.7. Keputusan Pending yang Masih Butuh Jawaban
- **UX inline edit alumni:** pilihan (A) full inline, (B) modal only, atau (C) Hybrid. Claude rekomendasi (C).

---

## 2. Pertimbangan Critical yang Jadi Catatan

### 2.1. Soal Peta
- User awalnya ingin peta provinsi + kab/kota bersamaan → Claude klarifikasi tidak bisa dalam 1 peta (konflik visual) → user pilih **level kab/kota saja, relatif ke Indonesia**
- Risiko "false pale" karena data kab/kota tidak match GeoJSON → mitigasi: `kabkota_master` seeded + fuzzy matching + live edit tooling

### 2.2. Soal Database Terpisah untuk Alumni
- User awalnya usul "database terpisah" supaya dashboard auto-update saat user update data → Claude push back karena over-engineering
- Root cause real: user mau edit data tanpa re-import terus-menerus → solusi: **live edit di Firestore** (bukan database terpisah)
- Keputusan final: tetap di Firestore `alumni_historis`, tambah tooling CRUD inline + bulk + undo

### 2.3. Konsekuensi Bank Soal Mandiri
- Soal dipisah dari exam → bikin sistem **random per session** dari `soalRecipe`
- Scoring weighted by Bloom → engine berbeda dari sistem lama
- Rescore kalau kunci diubah → Phase 1 manual trigger, Phase 3 auto via Cloud Function

---

## 3. File yang Sudah Dibuat

1. **`OPUSPLAN.md`** (~2400 baris) — Blueprint komprehensif dengan:
   - Schema Firestore lengkap (termasuk `provinsi_master`, `kabkota_master`, `alumni_historis` live-editable)
   - Security rules
   - 6 workflow diagram
   - Milestone breakdown per phase
   - Risk register (22 risiko)
   - Testing strategy + definisi "selesai" per milestone
   - Konvensi kode

**Lokasi file:** `/mnt/user-data/outputs/OPUSPLAN.md`

---

## 4. Prinsip Kolaborasi yang Sudah Disetujui

- Claude tulis kode per-modul, user copy-paste ke repo & test
- Satu milestone idealnya dalam satu chat session
- OPUSPLAN.md jadi context starter tiap chat baru
- User bebas challenge Claude, Claude push back kalau user salah
- Compact resume tiap 8-10 response disimpan ke project knowledge

---

## 5. Next Actions

**Immediate:**
1. User jawab: UX live edit alumni pilih (A)/(B)/(C)? Default rekomendasi: (C) Hybrid.
2. User review OPUSPLAN.md final → confirm atau revisi.

**Mulai coding:**
1. Siapkan: GitHub account, Firebase project baru, 1 email admin
2. Mulai chat baru dengan share OPUSPLAN.md → kerja Milestone 1.1 Foundation (15-20 jam)
3. Satu milestone per session

---

**Catatan untuk Claude di chat berikutnya:**
Saat user kembali dan share file ini + OPUSPLAN.md + dokumen lama (SCHEMA_HARMONIZATION.md, STRUKTUR_APLIKASI_v3.md), konteks sudah lengkap. Jangan ulang analisa dari nol, langsung fokus ke milestone atau pertanyaan spesifik user.

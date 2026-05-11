# RESUME Diskusi Sistem BTAM — Sesi 2 (19 April 2026)

**Cakupan:** Response 1-12 chat kedua tanggal 19 April 2026.  
**Status:** Revisi mayor OPUSPLAN dengan 5 area keputusan baru.  
**File yang harus diganti di project knowledge:** `OPUSPLAN.md` (versi terbaru di outputs).  
**Next step:** Mulai coding Milestone 1.1, atau upload file Excel provinsi/kabkota.

---

## 1. Keputusan Baru di Sesi Ini

### 1.1. Distribusi Data Alumni ke Tim Lain

- **Source of truth:** Firestore, admin BTAM satu-satunya yang edit (via UI admin app)
- **Tim lain:** read-only konsumen data, BUKAN editor
- **Pola:** Admin klik "Export Excel" → upload ke folder Google Drive shared (view-only) ke tim lain
- **Format:** Raw data lengkap (1 row per alumni, semua kolom), + sheet Metadata (tanggal export, jumlah record, nama admin)
- **Naming:** `alumni-btam-YYYYMMDD.xlsx`
- **TIDAK dilakukan:** Google Sheets API integration, public URL, bi-directional sync

Dokumentasi masuk di OPUSPLAN Section 9.7 dan Milestone 2a.1.

### 1.2. Refactor Sesi vs Mata Pelajaran

**Model salah sebelumnya:** `bimtek_sessions` = campur mapel dan slot waktu.  
**Model benar:** 
- **Mata pelajaran** (mapel) = unit konten, punya `totalJp`, `pengajarIds` (multi), `pengajarPenilaiId` (1)
- **Sesi** = blok waktu nyata eksekusi mapel (bisa 1 atau lebih per mapel)
- 1 JP = 45 menit
- Durasi mapel variatif: 1-6 JP
- **Constraint keras:** mapel tidak boleh lintas hari
- Mapel boleh dipecah di hari sama kalau ada jeda ISHOMA/break di tengah (jeda tidak dihitung JP)

Schema: sub-collection `bimtek/{bimtekId}/mapel/{mapelId}` dan `bimtek/{bimtekId}/sesi/{sesiId}` (terpisah).

### 1.3. Pendaftar (Calon Peserta) vs Peserta

**Model salah sebelumnya:** `calon_peserta` pakai `noPeserta` — ambigu.  
**Model benar:**
- **Pendaftar:** ~8.000/tahun, punya `pendaftarId` format `REG-YYYY-NNNNN` (auto saat submit MS Form)
- **Peserta:** 400-1.000/tahun, punya `noPeserta` format `PST-YYYY-NNNN` (auto-generate saat admin "Aktivasi Peserta", admin bisa override)
- Link: `peserta_master.pendaftarIdOrigin` → `calon_peserta.pendaftarId`

### 1.4. Retensi Data Calon Peserta

| Kategori | Aksi |
|---|---|
| Gugur administrasi | Hapus (tidak bernilai analitis) |
| Lulus admin tapi belum ikut tertulis | Hapus |
| Ikut tertulis (lulus/gugur) | **Simpan** — untuk analisis soal & pola kegagalan |
| Terpilih/cadangan | Simpan |

**Window retensi:** 3 tahun. Tahun lama → archive ke Firebase Storage JSON.  
**Data exam_results seleksi tertulis:** mengikuti retensi sama, untuk analisis Phase 3 (M3.7).

### 1.5. Evaluasi Pengajar oleh Peserta (Phase 3)

- **Placement:** setelah post-test, sebelum akses nilai akhir/sertifikat (gated)
- **Sifat:** wajib + anonim (anonimitas di level schema, bukan cuma UI)
- **Granularitas:** per pengajar terpisah (kalau mapel multi pengajar, peserta isi N form)
- **Schema anonim:** `evaluasi_pengajar_response` tidak punya `noPeserta`. Flag submission tersimpan terpisah di `bimtek_scores.evaluasiPengajarSubmitted`.
- **Milestone:** M3.6 (10-14 jam)

### 1.6. Scheduler Bimtek

**Strategi implementasi:** Phase 1 form-based (cepat, fungsional), Phase 3 upgrade ke drag-drop KALAU admin merasa perlu (opsional, 15-25 jam extra).

**Template default di `app_settings.scheduleDefaults`:**

| Hari | Jam mulai | Break pagi | ISHOMA | Break sore | Maks JP |
|---|---|---|---|---|---|
| Senin-Kamis | 08:00 | 10:15-10:30 | 12:00-13:00 | 14:30-14:45 | 9 (default, admin bisa turunkan) |
| Jumat | 08:00 | 10:15-10:30 | 11:15-13:30 | Opsional | Fleksibel |

**Validasi scheduler (blocker):**
- Mapel lintas hari → blocked
- Dua mapel overlap → blocked
- Total JP jadwal ≠ `mapel.totalJp` → blocked
- Mapel overlap break/ISHOMA pre-defined → blocked

**Validasi pengajar double-booked:** defer ke Phase 3 (admin atur manual di Phase 1).

**Split mapel:** UI tawar "Split di sini?" kalau mapel didrop di atas break. Jadi 2 sesi dengan JP terbagi, tapi dihitung sebagai 1 mapel kontinyu.

---

## 2. Perubahan di OPUSPLAN.md

File telah di-update dan di-copy ke `/mnt/user-data/outputs/OPUSPLAN.md`. Ganti versi di project knowledge.

**Section yang berubah:**
- Header (tanggal + revisi note)
- 1.3 Struktur Phase Final (update total effort)
- 4.2 Collection Overview (mapel + sesi split, pendaftarId, evaluasi pengajar)
- 4.4 peserta_master (tambah `pendaftarIdOrigin`, `tahunSiklusOrigin`)
- 4.9 bimtek sub-collections (refactor mapel+sesi, tambah jadwal field, catatan domain scheduler)
- 4.15 calon_peserta (refactor ke pendaftarId, retensi 3 tahun, analisis seleksi tertulis)
- 4.17 app_settings (tambah `scheduleDefaults`)
- 4.19 evaluasi_pengajar (BARU — template + response collections, anonimitas schema-level)
- 9.7 Distribusi Data ke Tim Lain (BARU)
- M1.4 Bimtek CRUD (tab Mata Pelajaran baru, scheduler form-based + validasi)
- M2a.1 export Excel (dipertegas untuk distribusi tim lain)
- M3.6 Evaluasi Pengajar (BARU, 10-14 jam)
- M3.7 Analisis Soal Seleksi Tertulis (BARU, 6-10 jam)
- M3.8 Scheduler Drag-Drop Upgrade (BARU, opsional, 15-25 jam)
- Risk register (R23-R25 baru)

**Angka effort update:**
- Phase 1: 165-220 → 168-225 jam (+3-5 jam scheduler)
- Phase 3: 25-40 → 41-62 jam (+ opsional 15-25 jam M3.8)
- Total core: 265-365 → 299-417 jam
- Total dengan M3.8: 314-442 jam

---

## 3. Yang Masih Pending dari User

1. **File Excel provinsi/kabkota master** — user bilang sudah punya, siap export. Setelah diupload, saya review kolom & match dengan GeoJSON untuk finalize Milestone 2a.0.

---

## 4. Prinsip Desain yang Di-reinforce di Sesi Ini

1. **Single source of truth** — hindari dua tempat edit data yang sama (kasus alumni)
2. **Domain modeling eksplisit** — mapel ≠ sesi, pendaftar ≠ peserta
3. **Anonimitas di schema-level**, bukan cuma UI (kasus evaluasi pengajar)
4. **Phase 1 minimum viable, upgrade di Phase 3** — hindari over-engineering awal (kasus scheduler)
5. **Validasi blocker vs warning** — admin punya override, tapi hal kritis tidak boleh lolos
6. **Retensi eksplisit** — data tidak semua disimpan selamanya

---

## 5. Next Actions

**Immediate (menunggu user):**
1. User upload file Excel provinsi/kabkota → Claude review & validate
2. User ganti `OPUSPLAN.md` di project knowledge dengan versi terbaru

**Siap mulai coding:**
1. Siapkan: GitHub account, Firebase project baru, 1 email admin, domain GitHub Pages
2. Mulai chat baru dengan share OPUSPLAN.md (versi terbaru) → kerja Milestone 1.1 Foundation (15-20 jam)
3. Target 1 milestone per chat session

---

## 6. Catatan untuk Claude di Chat Berikutnya

Saat user kembali dan share file ini + OPUSPLAN.md (versi final) + file Excel geografis:
- Konteks sudah lengkap, tidak perlu ulang analisa dari nol
- Fokus ke milestone coding atau pertanyaan spesifik
- Ingat prinsip: user suka di-challenge, tidak suka flattery, lebih baik pushback jujur daripada setuju kosong

**Identitas dokumen diskusi yang relevan di project knowledge:**
1. `OPUSPLAN.md` — blueprint final (versi terbaru, 2890 baris)
2. `RESUME_DISKUSI_19APR2026.md` — resume sesi 1
3. `RESUME_DISKUSI_19APR2026_SESI2.md` — file ini (sesi 2)
4. `SCHEMA_HARMONIZATION.md` — referensi (legacy)
5. `STRUKTUR_APLIKASI_v3.md` — referensi (legacy)
6. `STATUS_DISKUSI.md` — referensi (outdated, OPUSPLAN sudah superset)

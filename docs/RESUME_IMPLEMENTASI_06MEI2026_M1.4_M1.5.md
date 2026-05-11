# RESUME Implementasi — 06 Mei 2026

**Cakupan:** Lanjutan M1.4 (bug fixes) + M1.5 Exam Editor & Magic Link  
**Status:** M1.4 ✅ Selesai | M1.5 ✅ Selesai (sisi admin)

---

## 1. Bug Fixes M1.4 (Lanjutan)

| Bug | Root Cause | Fix | File |
|---|---|---|---|
| `timestamp is not defined` | `Timestamp` tidak ada di import `api.js`, hanya `serverTimestamp` | Tambah `Timestamp` ke destructuring import | `api.js` |
| Inisialisasi hari tidak tampil di jadwal | `initSesiHari` tulis slot tanpa field `urutan`, tapi `listSesi` query pakai `orderBy('urutan')` — Firestore tidak return dokumen tanpa field yang di-orderBy | Tambah `urutan` ke setiap slot dalam batch, dihitung dari `existingSnap.size + i + 1` | `api.js` |
| Hapus mapel → tidak ada tombol assign pengganti | Saat hapus mapel, segmen dihapus tapi slot kosong tidak dibuat kembali | Fungsi baru `restoreSlotKosong`: buat ulang slot kosong sejumlah JP mapel yang dihapus di posisi `jamMulai` yang sama | `api.js`, `detail.js` |
| Semua tombol bimtek tidak bisa diklik | Syntax error di `api.js` — sisa komentar `/**` mengambang di luar blok fungsi akibat insert `restoreSlotKosong` yang tidak teliti | Bersihkan komentar orphan | `api.js` |

---

## 2. Fitur Baru M1.4: Shift Periode Bimtek

**Masalah:** Ketika tanggal bimtek diubah, sesi lama tidak ikut bergeser.

**Solusi:** Ketika `periode.mulai` berubah di form edit bimtek:
1. Hitung `selisihHari` = tanggal baru − tanggal lama
2. Shift semua sesi sebesar selisih itu (`shiftSesiPeriode`)
3. Tampilkan warning non-blocking untuk:
   - Hari yang jadi Jumat dengan JP > 6
   - Periode diperpendek → cek sesi di akhir jadwal
   - Periode diperpanjang → inisialisasi hari baru

**Fungsi baru di `api.js`:** `shiftSesiPeriode(bimtekId, sesis, selisihHari)`  
**Perubahan di `form.js`:** Logika shift + warning di `_handleSubmit`, pass `oldData` ke fungsi

---

## 3. Fitur Baru M1.4: Modal Tambah Peserta (Revamp)

**Masalah:** `<select multiple>` tidak user-friendly di HP (butuh Ctrl+klik).

**Solusi:** Ganti ke modal dengan:
- Search bar (cari nama / noPeserta)
- Filter instansi (dropdown derive dari data peserta)
- Checklist (tap untuk pilih)
- "Pilih semua hasil filter" — cocok untuk satu rombongan PDAM
- Counter realtime "X dipilih"
- Tombol disabled saat menyimpan (cegah double submit)

---

## 4. M1.5 — Exam Editor & Magic Link

### File Baru
| File | Lokasi | Fungsi |
|---|---|---|
| `exam-api.js` | `admin/js/modules/bimtek/` | CRUD exam config + session management |
| `tab-ujian.js` | `admin/js/modules/bimtek/` | UI tab Ujian di detail bimtek |

### Perubahan
| File | Perubahan |
|---|---|
| `detail.js` | Tambah tab "Ujian", import `renderTabUjian` |
| `firestore.rules` | Tambah `allow delete: if canWrite()` di `exam_sessions` |

### Schema Baru

**`exams` collection:**
```js
{
  bimtekId, tipe, judul, durasi,
  soalIds[],          // pool soal dipilih admin
  jumlahDitampilkan,  // soal per session (≤ soalIds.length)
  published,
  createdAt, updatedAt, createdBy
}
```
- `tipe`: `'pretest' | 'posttest' | 'pretest_posttest'`

**`exam_sessions` collection:**
```js
{
  examId, bimtekId, noPeserta,
  tipeSession,        // 'pretest' | 'posttest'
  soalIds[],          // locked saat generate
  token,              // UUID magic link
  expiredAt, status,
  startedAt, submittedAt,
  createdAt, createdBy
}
```
- `status`: `'issued' | 'started' | 'submitted' | 'expired'`

### Logika Kunci
- **`pretest_posttest`**: soal identik di pretest dan posttest, hanya urutan di-shuffle di exam app. `jumlahDitampilkan` = `soalIds.length` (readonly di form).
- **`pretest` / `posttest` terpisah**: soal di-pick random dari pool sejumlah `jumlahDitampilkan` saat generate session.
- **Generate session**: skip peserta yang sudah punya session untuk tipe yang sama (`existingSet`). Batch write semua sekaligus.
- **Soal picker**: query langsung Firestore dengan `where('active', '==', true)` saja, filter `deleted` + `bidangId` di client — hindari composite index issue. Support multi-bidang (bimtek dengan 2+ bidangId).

### Fitur UI Tab Ujian
- List exam card: judul, tipe badge, status draft/published, jumlah soal, jumlah link
- Buat/edit ujian: modal dengan soal picker (search + filter Bloom + filter bidang)
- Generate magic link per peserta (batch, skip yang sudah ada)
- Lihat link: tabel per peserta per tipe session, copy individual, copy semua, reset session
- Publish/unpublish exam

### Firestore Indexes Baru
```json
{ "collectionGroup": "exams", "fields": [
    { "fieldPath": "bimtekId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
]},
{ "collectionGroup": "exam_sessions", "fields": [
    { "fieldPath": "examId", "order": "ASCENDING" },
    { "fieldPath": "noPeserta", "order": "ASCENDING" }
]},
{ "collectionGroup": "exam_sessions", "fields": [
    { "fieldPath": "bimtekId", "order": "ASCENDING" },
    { "fieldPath": "examId", "order": "ASCENDING" }
]}
```

---

## 5. Keputusan Desain

| Topik | Keputusan |
|---|---|
| Hapus vs Batal bimtek | Berbeda — batal = status `cancelled`, hapus = delete permanen. Perlu cek apakah subkoleksi ikut terhapus (Firestore tidak auto-delete subkoleksi) |
| Kelas/rombel per bimtek | Tidak ada konsep kelas — satu bimtek = satu penyelenggaraan. Bimtek judul sama di periode berbeda = dokumen bimtek baru |
| Exam tipe | 3 opsi: `pretest`, `posttest`, `pretest_posttest`. Kalau keduanya sama → 1 config, soal identik, urutan diacak |
| Shift periode | Geser semua sesi otomatis, tampilkan warning — tidak blokir user |

---

## 6. Anti-Cheat (Dicatat untuk M1.6 Exam Runner)

Daftar fitur anti-cheat yang akan diimplementasi di exam app:
- Fullscreen lock (keluar = warning)
- Tab/window switch detection (`visibilitychange` + `blur`)
- Split screen detection (`window.innerWidth < screen.width * 0.75`)
- App switch di HP (`visibilitychange` + `blur`)
- Watermark noPeserta + timestamp (transparan di atas soal)
- Orientation lock
- Prevent zoom (`user-scalable=no`)
- Right-click disabled
- Copy/paste disabled
- Max 3 warnings → auto-submit
- Auto-save tiap 30 detik

---

## 7. Next: M1.6 Exam Runner

Scope:
- `/exam/` app terpisah
- Entry screen: input noPeserta + validasi token magic link
- Timer + auto-save jawaban tiap 30 detik
- Resume setelah refresh (dari `exam_sessions`)
- Semua fitur anti-cheat
- Submit → result screen (skor + breakdown per EK)
- Admin lihat result di tab ujian

**File yang perlu dibaca sebelum mulai M1.6:**
- `exam/` folder structure (kalau sudah ada)
- `exam-api.js` (sudah ada dari M1.5)
- `shared/constants.js`
- `SCHEMA_HARMONIZATION.md`

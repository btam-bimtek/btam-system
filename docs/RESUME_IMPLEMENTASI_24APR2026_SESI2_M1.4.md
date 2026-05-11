# RESUME Implementasi — Sesi 24 Apr 2026 (Sesi 2)

**Cakupan:** M1.4 Bimtek CRUD + Tab Jadwal
**Status:** M1.4 ✅ (termasuk Tab Jadwal) — beberapa bug fix selesai di sesi ini

---

## 1. File yang Dibuat / Dimodifikasi

### Baru (upload ke `admin/js/modules/bimtek/`):
| File | Fungsi |
|---|---|
| `api.js` | CRUD bimtek, mapel, sesi — sudah ada `listSesi`, `createSesi`, `clearJadwal` |
| `list.js` | Daftar bimtek dengan filter status/tipe/bidang + badge warna bidang |
| `form.js` | Form create/edit bimtek — info dasar, jadwal, bobot penilaian, status |
| `form-mapel.js` | Modal add/edit mapel — load pengajar dari master, preview durasi JP |
| `detail.js` | Detail bimtek multi-tab: Info, Mapel, Jadwal, Peserta*, Pengajar* |
| `tab-jadwal.js` | Scheduler form-based — timeline per hari, validasi blocker, export Excel |
| `tab-peserta.js` | Tab peserta — search dari master, tambah/hapus (search client-side) |
| `tab-pengajar.js` | Tab pengajar — search dari master, tambah/hapus (search client-side) |

*Tab Peserta & Pengajar: file ada, tapi masih placeholder di UI (milestone berikutnya)

### Dimodifikasi:
- `pengajar-master/index.js` — fix badge warna bidang
- `shared/db.js` — fix `snapToArray`/`snapToDoc` dari `_id` → `id`

---

## 2. Bug yang Ditemukan & Diperbaiki

### Bug Kritis:
| Bug | Root Cause | Fix |
|---|---|---|
| Detail bimtek "undefined tidak ditemukan" | `snapToArray` return `_id` bukan `id`, sehingga `b.id` selalu undefined | Ubah `_id` → `id` di `db.js` |
| Bidang tampil "undefined" di list & detail | `BIDANG_LIST` pakai field `bidangId` bukan `id`, tapi kode pakai `b.id` | Ganti semua `b.id` → `b.bidangId` di semua file yang lookup BIDANG_LIST |
| Bidang tersimpan sebagai `["undefined"]` di Firestore | `form.js` render checkbox value pakai `b.id` (undefined) | Fix `b.id` → `b.bidangId` di form.js. Data lama perlu diperbaiki manual di Firestore |
| Search pengajar/peserta tidak return hasil | Kode pakai field `namaUpper` yang tidak ada — query return kosong | Ganti ke client-side filter dengan `nama.toLowerCase().includes()` |
| Badge warna bidang tidak muncul | Template literal bersarang tidak bisa eksekusi `${bd.color}` | Pindah ke fungsi terpisah `_bidangBadges()` dengan string concatenation |

### Pelajaran:
- **Selalu baca `constants.js` dan `api.js` modul terkait SEBELUM menulis kode** — asumsi nama field menyebabkan cascade bug
- Template literal bersarang (backtick di dalam backtick) tidak bisa mengeksekusi ekspresi — gunakan fungsi terpisah atau string concatenation

---

## 3. Arsitektur Tab Jadwal

**File:** `tab-jadwal.js`

**Konstanta jadwal:**
- Senin–Kamis: jam mulai 08:00, max 9 JP, break pagi 10:15–10:30, ISHOMA 12:00–13:00, break sore 14:30–14:45
- Jumat: max 7 JP per mapel (blocker), ISHOMA panjang 11:15–13:45

**Validasi blocker:**
1. Mapel >7 JP di hari Jumat → diblok
2. Mapel sudah dijadwalkan di hari lain → diblok
3. Overlap antar mapel → diblok
4. Overlap dengan break/ISHOMA → diblok

**Warning non-blocker:**
- Total JP hari >8 → toast warning tapi tetap bisa save

**Yang di-skip (Phase 3):** split mapel lintas break

**Fitur lain:** export Excel jadwal via SheetJS, reset seluruh jadwal

---

## 4. Keputusan Teknis

- **Search peserta/pengajar:** client-side filter `includes()` — konsisten dengan pattern existing di masing-masing api.js. Tidak pakai `namaUpper` prefix search Firestore karena field itu tidak ada
- **Tab Peserta & Pengajar:** file sudah dibuat, tapi belum di-wire ke milestone ini. Import ada di `detail.js` — perlu diaktifkan di milestone berikutnya
- **Split mapel:** skip Phase 1, akan diimplementasi di M3.8

---

## 5. Data Cleanup yang Perlu Dilakukan

Bimtek yang dibuat sebelum bug fix `form.js` tersimpan dengan `bidangIds: ["undefined"]`.
Perlu diperbaiki manual di Firestore console — edit field `bidangIds` ke nilai yang benar.

---

## 6. Next: M1.5 — Exam App

Berdasarkan OPUSPLAN, M1.5 adalah **Exam Editor + Magic Link**:
- Buat/edit exam (judul, instruksi, durasi, passing score)
- Soal recipe builder (pilih dari bank soal per EK/Bloom/bidang)
- Generate magic link untuk peserta akses exam
- Link exam ke bimtek (preTestExamId / postTestExamId)

**Constraint penting sebelum mulai M1.5:**
- Baca `bank-soal/api.js` dan `shared/constants.js` SEBELUM nulis kode
- Konfirmasi schema exam di Firestore (collection name, field names)

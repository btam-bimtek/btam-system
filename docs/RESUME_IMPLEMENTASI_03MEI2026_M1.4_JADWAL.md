# RESUME Implementasi — 03 Mei 2026

**Cakupan:** Lanjutan M1.4 — Tab Jadwal (scheduler bimtek)  
**Status:** M1.4 Tab Jadwal 🔄 — fitur inti selesai, perlu live test

---

## 1. Bug yang Ditemukan & Diperbaiki

| Bug | Root Cause | Fix |
|---|---|---|
| Tambah Mapel crash | `listPengajar()` return `{ data, lastDoc }` bukan array — `S.pengajars` bukan array | Destructure `.data`, pakai `pageSize: 999` |
| Tambah Peserta tidak jalan | `listPeserta()` sama — return object bukan array | Destructure `.data` di semua call site |
| Validasi tabrakan salah | `validateJadwalMapel` cek overlap ke break/ISHOMA — padahal segmen mapel memang melewatinya | Filter cek overlap hanya untuk `tipe: mapel/pembukaan/penutupan` |
| Hapus mapel tersegmen gagal | `deleteSesiByMapel` panggil `listSesi` ulang — hasilnya tidak match | Ganti ke langsung filter `S.sesis` client-side lalu delete per ID |
| Hapus hari yang salah | `toISOString()` convert ke UTC, Jakarta UTC+7 mundur 1 hari | Ganti ke `getFullYear()/getMonth()/getDate()` (local time) |
| Segmen lain ikut punya tombol × | Tiap segmen render tombol hapus sendiri | Tombol × hanya di segmen pertama (`segmenKe === 1`) |
| Tombol × tidak responsif | `data-del-ids` tidak dibaca karena HTML attribute pakai camelCase | Ganti ke `btn.dataset.delIds` — sudah auto-camelCase |

---

## 2. Arsitektur Tab Jadwal (Final)

### Inisialisasi
- Tombol **"Inisialisasi Semua Hari"** → loop semua hari dalam `bimtek.periode.mulai` – `periode.selesai`
- Per hari: `initSesiHari(bimtekId, tglStr, totalJp)` — generate semua slot dalam 1 batch write
- Default JP: Senin–Kamis = 9 JP, Jumat = 6 JP
- Slot yang dibuat: slot kosong (1 JP/45 menit) + break/ISHOMA sesuai hari

### Struktur slot per hari (reguler 9 JP)
```
08:00–08:45  Kosong JP 1
08:45–09:30  Kosong JP 2
09:30–10:15  Kosong JP 3
10:15–10:30  Break pagi
10:30–11:15  Kosong JP 4
11:15–12:00  Kosong JP 5
12:00–13:00  ISHOMA
13:00–13:45  Kosong JP 6
13:45–14:30  Kosong JP 7
14:30–14:45  Break sore
14:45–15:30  Kosong JP 8
15:30–16:15  Kosong JP 9
```

### Struktur slot per hari (Jumat 6 JP)
```
08:00–08:45  Kosong JP 1
08:45–09:30  Kosong JP 2
09:30–10:15  Kosong JP 3
10:15–10:30  Break pagi
10:30–11:15  Kosong JP 4
11:15–13:45  ISHOMA Jumat
13:45–14:30  Kosong JP 5
14:30–15:15  Kosong JP 6
```

### Edit JP per hari
- Tombol **+** / **−** di header tiap hari
- **+** → `tambahJpKosong()` — tambah 1 slot kosong di ujung hari
- **−** → `kurangJpKosong()` — hapus slot kosong terakhir (tolak kalau terakhir bukan kosong)

### Assign Mapel ke Slot
- Slot kosong tampil abu-abu italic dengan tombol **"Assign Mapel"**
- Klik → modal `_showAssignModal(slotId, tglStr)` — tampilkan mapel yang bisa di-assign
- Mapel dengan JP > slot kosong tersedia = disabled otomatis di dropdown
- Setelah pilih → hapus slot kosong yang dipakai → buat sesi mapel (dengan segmentasi via `hitungSegmenMapel`)

### Hapus Jadwal Mapel
- Tombol × hanya muncul di segmen pertama mapel
- Semua ID segmen disimpan di `data-del-ids` (comma-separated)
- Klik × → hapus semua ID sekaligus

---

## 3. Fungsi Baru di api.js

| Fungsi | Kegunaan |
|---|---|
| `hitungSegmenMapel(jamMulai, totalJp, breaks)` | Hitung segmen sesi saat mapel dipecah break. Return `[{jamMulai, jamSelesai, jp}]` |
| `initSesiHari(bimtekId, tglStr, totalJp)` | Generate semua slot 1 hari (kosong + break/ISHOMA) via batch write |
| `tambahJpKosong(bimtekId, sesiHariIni)` | Tambah 1 slot kosong di akhir hari |
| `kurangJpKosong(bimtekId, sesiHariIni)` | Hapus slot kosong terakhir hari ini |
| `deleteSesiByMapel(bimtekId, mapelId, tanggalStr)` | Hapus semua segmen mapel di 1 tanggal (via batch) |

### Field baru di `createSesi` payload
```js
segmenKe: number | null      // urutan segmen (1, 2, 3, ...)
totalSegmen: number | null   // total segmen mapel ini
```

### Tipe sesi baru
- `'kosong'` — slot JP yang belum diisi mapel (1 JP, 45 menit)

---

## 4. Konstanta Jadwal (Tetap/Statis)

| Hari | Break pagi | ISHOMA | Break sore | Default JP |
|---|---|---|---|---|
| Senin–Kamis | 10:15–10:30 | 12:00–13:00 | 14:30–14:45 | 9 JP |
| Jumat | 10:15–10:30 | 11:15–13:45 | — | 6 JP |

**BREAK_SLOTS_REGULAR** dan **BREAK_SLOTS_JUMAT** → statis hardcoded, dipakai `hitungSegmenMapel` dan `initSesiHari`.

---

## 5. Constraints dari OPUSPLAN yang Dipertahankan

- Mapel >7 JP tidak boleh di hari Jumat (blocker)
- Warning kalau total JP harian >8
- 1 JP = 45 menit
- Mapel tidak boleh lintas hari

---

## 6. Status Checklist M1.4

- [x] List bimtek tampil dengan filter & badge warna
- [x] Buat/edit bimtek → form benar
- [x] Tab Mata Pelajaran → tambah/edit/hapus mapel
- [x] Tambah peserta dari master
- [x] Tab Jadwal → inisialisasi semua hari
- [x] Tab Jadwal → assign mapel ke slot kosong
- [x] Tab Jadwal → hapus jadwal mapel (semua segmen)
- [x] Tab Jadwal → edit JP per hari (+/−)
- [x] Segmentasi mapel otomatis (split di break)
- [ ] Live test end-to-end (perlu dikonfirmasi user)

---

## 7. File yang Dimodifikasi Sesi Ini

| File | Perubahan |
|---|---|
| `bimtek/api.js` | + `hitungSegmenMapel`, `initSesiHari`, `tambahJpKosong`, `kurangJpKosong`, `deleteSesiByMapel`; + field `segmenKe/totalSegmen` di `createSesi`; fix `validateJadwalMapel` skip break/ISHOMA |
| `bimtek/detail.js` | Rewrite penuh tab jadwal: slot kosong, inisialisasi semua hari, assign modal, edit JP, fix timezone bug |

---

## 8. Next: Setelah M1.4 Confirmed

**M1.5 — Exam Editor + Magic Link**

Wajib sebelum mulai:
1. Baca `bank-soal/api.js` — konfirmasi schema
2. Baca `shared/constants.js` — konfirmasi COL names untuk exam collections
3. Cek schema `se_exams`, `se_participants`, `se_results` di Firestore (lihat SCHEMA_HARMONIZATION.md)

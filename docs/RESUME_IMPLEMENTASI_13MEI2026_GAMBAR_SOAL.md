# Resume Implementasi — 13 Mei 2026

**Fitur:** Upload Gambar pada Soal (Bank Soal)  
**Status:** ✅ Done  
**Durasi:** ~1 sesi  
**Platform:** Claude Code Desktop (PC)

---

## 1. Status Masuk Sesi

| Milestone | Status |
|---|---|
| M1.1–1.7 | ✅ Done |
| M1.8–1.10 Report & Sertifikat | ⬜ Next |

Masuk sesi dengan repo fresh clone dari GitHub setelah context lama habis.

---

## 2. Fitur yang Diimplementasikan

### 2.1 Upload Gambar Soal ke Firebase Storage

**Deskripsi:** Admin dapat menambahkan gambar opsional pada pertanyaan soal. Gambar tampil di exam runner antara teks pertanyaan dan opsi jawaban.

**Scope:**
- Gambar hanya untuk pertanyaan soal (bukan opsi jawaban)
- Disimpan di Firebase Storage path: `bank-soal/{soalId}/pertanyaan.{ext}`
- Tampil di exam runner (`/exam/`) saat peserta mengerjakan ujian

**File yang diubah:**

| File | Perubahan |
|---|---|
| `admin/js/modules/bank-soal/api.js` | `createSoal()` terima optional `preGeneratedId` agar path Storage konsisten dengan Firestore ID |
| `admin/js/modules/bank-soal/form.js` | UI upload gambar, preview, validasi 2MB, upload ke Storage, state management |
| `exam/js/exam-runner.js` | Render gambar di kartu soal (max-height 280px, lazy loading) |

**Schema Firestore (tidak berubah):** field `pertanyaanImage` di `bank_soal` sudah ada sejak awal di `api.js`, hanya belum diisi dari form.

---

## 3. Infrastruktur Setup (Firebase Storage)

Project sebelumnya di Spark plan — Firebase Storage belum pernah diaktifkan. Proses setup:

| Langkah | Tindakan |
|---|---|
| Upgrade plan | Spark → Blaze (pay-as-you-go) |
| Buat bucket | Firebase Console → Storage → Get started |
| Region | `asia-southeast1` (Singapore) |
| CORS config | `gsutil cors set cors.json gs://bimtek-27fe5.firebasestorage.app` |
| Storage Rules | Allow read publik untuk `bank-soal/**`, write hanya authenticated |

**CORS config** (file `cors.json` di root repo):
```json
[{
  "origin": ["https://btam-bimtek.github.io", "http://localhost:8080", "http://localhost:3000"],
  "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
  "maxAgeSeconds": 3600,
  "responseHeader": ["Content-Type", "Authorization", "x-goog-resumable"]
}]
```

**Firebase Storage Rules** (set via Firebase Console → Storage → Rules):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /bank-soal/{allPaths=**} {
      allow read;
      allow write: if request.auth != null;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 4. Kendala & Solusi

| Kendala | Solusi |
|---|---|
| CORS error saat upload dari `localhost` | Push ke GitHub Pages |
| CORS error dari GitHub Pages | Konfigurasi CORS bucket via `gsutil` |
| `gsutil` tidak terinstall | Install Google Cloud SDK via `winget install Google.CloudSDK` |
| 404 bucket not found | Firebase Storage belum diinisialisasi (Spark plan tidak support) |
| Upgrade ke Blaze diperlukan | Upgrade di Firebase Console, aktifkan Storage, buat bucket |
| 403 Forbidden saat upload | Storage Rules default memblokir — set rules allow write untuk authenticated user |

---

## 5. Catatan Teknis

- **Download URL Firebase Storage** (hasil `getDownloadURL`) bersifat publik via token — tidak perlu Storage rules allow read untuk exam app yang unauthenticated. Tapi rules `allow read` pada `bank-soal/**` tetap dipasang untuk konsistensi.
- `preGeneratedId` di `createSoal()` memastikan ID Firestore dan path Storage selalu sinkron tanpa dua kali round-trip.
- Jika gambar di-hapus dari form (tombol "Hapus"), field `pertanyaanImage` di-set ke `null` — file lama di Storage tidak dihapus (cleanup manual atau Cloud Function Phase 2).

---

## 6. Commit

| Hash | Pesan |
|---|---|
| `5fd844c` | `feat: tambah upload gambar soal ke Firebase Storage` |

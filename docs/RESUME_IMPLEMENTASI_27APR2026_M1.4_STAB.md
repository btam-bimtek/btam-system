# RESUME Implementasi — 25–27 Apr 2026

**Cakupan:** Debugging & stabilisasi M1.4 Bimtek CRUD  
**Status:** M1.4 🔄 Hampir selesai — bug form utama sudah fix, tab mapel perlu dikonfirmasi

---

## 1. Rule Baru yang Disepakati

| Rule | Detail |
|---|---|
| **RULE CODING** | Selalu minta upload file yang relevan dan baca isinya SEBELUM menulis kode apapun. Tidak boleh nulis kode tanpa baca file existing yang terkait. |
| **RULE STYLING** | Semua UI pakai Tailwind + custom class dari `main.css` (badge, badge-blue/green/red/purple/yellow/gray, form-input, form-select, form-textarea, btam-table). JANGAN Bootstrap. Inline style hanya untuk warna dinamis. |
| **RULE NILAI PENGAJAR** | Nilai pengajar = rata-rata dari seluruh pengajar bimtek. Kalau mapel punya >1 pengajar, nilai pengajar untuk mapel itu diambil dari pengajar pengampu mapel tersebut. |

---

## 2. Bug yang Ditemukan & Diperbaiki

| Bug | Root Cause | File |
|---|---|---|
| Halaman list tidak render | Signature `renderBimtekList(container)` tidak cocok — `main.js` kirim `{ query }` | `list.js` |
| Halaman detail tidak render | Signature `renderBimtekDetail(container, id)` tidak cocok — `main.js` kirim `{ id }` | `detail.js` |
| Form bimtek crash saat load | Import `validateWeights` dari `api.js` yang belum ada | `api.js` |
| Badge warna bidang tidak tampil | Tailwind class dinamis tidak di-generate CDN | Semua pakai inline style + `color` dari `BIDANG_LIST` |
| `confirmDialog` tampil "undefined" | Dipanggil dengan string, tapi menerima object `{ title, message }` | `list.js`, `detail.js` |
| Tombol Detail/Edit tidak jalan | Event listener dipasang sebelum konten dirender | `list.js` — bind langsung ke tombol setelah render |
| Form tampil OJT/eLearning | File di repo adalah versi lama yang belum dipatch | `form.js` — generate ulang bersih |
| Redirect setelah create bimtek | `result.bimtekId` — `createBimtek` return `ref.id` langsung (string) | `form.js` |
| Bobot default 0% | `DEFAULT_WEIGHTS` desimal (0.10) tapi render tanpa ×100 | `form.js` — `Math.round(w * 100)` |
| Bobot bertambah saat toggle | `_readWeights` mulai dari `DEFAULT_WEIGHTS` lalu redistribute → double count | `form.js` — `_readWeights` pakai empty object |
| Bobot default 110% | Redistribute menambahkan tugas+presentasi ke pengajar, padahal DEFAULT_WEIGHTS sudah include keduanya | `form.js` — fix redistribute logic |
| Validasi bobot gagal meski 100% | Floating point `0.9999...` tidak lolos `Math.abs(wSum - 1) > 0.01` | `form.js` — pakai `Math.round(wSum * 100)` |
| Form mapel modal tidak tampil | Pakai Bootstrap class `modal-overlay` yang tidak ada | `form-mapel.js` — rewrite pakai Tailwind |
| Bidang di form-mapel salah tersimpan | `b.id` seharusnya `b.bidangId` | `form-mapel.js` |

---

## 3. Status File Bimtek Saat Ini

| File | Status |
|---|---|
| `api.js` | ✅ Lengkap — ada `validateWeights`, semua CRUD |
| `list.js` | ✅ Jalan — filter, badge warna, navigate benar |
| `form.js` | ✅ Jalan — tipe Reguler/PNBP, bidang dropdown/checkbox, bobot redistribute |
| `form-mapel.js` | ✅ Dipatch — Tailwind modal, bidangId fix |
| `detail.js` | ✅ Dipatch — signature fix, Tailwind style, tab Mapel/Jadwal/Peserta |

---

## 4. Keputusan Bisnis Penting

- **Tipe bimtek:** Hanya **Reguler** dan **PNBP** (OJT, eLearning, Lainnya dihapus dari form)
- **Bidang reguler:** Dropdown single select. PNBP: checkbox multi-select
- **Bobot tugas/presentasi default:** 0% saat tidak aktif, 5% saat diaktifkan
- **Redistribute bobot:** Bobot tugas+presentasi yang tidak aktif dialihkan ke **Nilai Pengajar** otomatis
- **Nilai Pengajar:** rata-rata dari semua pengajar. Kalau mapel >1 pengajar → dari pengajar pengampu mapel tersebut

---

## 5. Checklist M1.4

- [x] List bimtek tampil dengan filter & badge warna
- [x] Buat bimtek baru → redirect ke detail
- [x] Edit bimtek → simpan → redirect ke detail
- [x] Publikasi bimtek → status berubah ke "Direncanakan"
- [x] Hapus bimtek
- [x] Bobot penilaian default benar (100%)
- [x] Toggle tugas/presentasi → bobot redistribute ke pengajar
- [ ] Tab Mata Pelajaran → tambah/edit/hapus mapel (perlu dikonfirmasi)
- [ ] Tab Jadwal (ada di `detail.js` tapi belum ditest)
- [ ] Tab Peserta (ada di `detail.js` tapi belum ditest)

---

## 6. Yang Perlu Dilakukan Sebelum Lanjut M1.5

1. Test tab Mata Pelajaran — tombol tambah mapel sudah jalan?
2. Test tab Jadwal — tambah sesi manual
3. Konfirmasi tidak ada bug baru di form-mapel.js

---

## 7. Next: M1.5 — Exam Editor + Magic Link

- Buat/edit exam (judul, instruksi, durasi, passing score)
- Soal recipe builder (pilih dari bank soal per EK/Bloom/bidang)
- Generate magic link untuk peserta
- Link exam ke bimtek (preTestExamId / postTestExamId)

**Wajib sebelum mulai:** baca `bank-soal/api.js` dan konfirmasi schema exam di Firestore

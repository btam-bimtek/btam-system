# Resume Implementasi — 07 Mei 2026

**Milestone:** M1.6 — Exam Runner (Exam App)  
**Status:** ✅ Selesai — tested Layer A, semua bug ditemukan sudah difix  
**Next:** M1.7 — Input Nilai & Kelulusan

---

## 1. File yang Dibuat/Diubah (M1.6)

| File | Status | Deskripsi |
|---|---|---|
| `exam/index.html` | ✅ Final | Entry point exam app — SPA light theme, Tailwind CDN + Eruda (debug, hapus setelah selesai) |
| `exam/js/app.js` | ✅ Final | Orchestrator: token parse → validasi → entry → instruksi → exam → result |
| `exam/js/db.js` | ✅ Final | Firestore helpers tanpa Firebase Auth |
| `exam/js/anti-cheat.js` | ✅ Final | Anti-cheat engine (tab switch, fullscreen, copy, devtools) |
| `exam/js/exam-runner.js` | ✅ Final | UI ujian: render soal, timer, auto-save, navigasi, submit |
| `admin/js/modules/bimtek/tab-ujian.js` | ✅ Final | Fix EXAM_HOST URL agar include `/btam-system/` |

**Tidak dibuat** (diputuskan tidak diperlukan untuk M1.6):
- `scorer.js` — scoring ditunda ke Phase 2 via Cloud Function

---

## 2. Keputusan Desain M1.6

### 2.1 Scoring: Opsi B (submit dulu, nilai diproses admin)

**Alasan:** `bank_soal_answers` adalah admin-only read. Menyimpan kunci di session doc berarti siapa pun yang punya token URL bisa lihat kunci sebelum mulai ujian.

**Keputusan:** Exam app hanya submit jawaban ke `exam_submissions`. Result screen tampilkan "Jawaban berhasil dikumpulkan." Nilai dihitung dari sisi admin (tab Ujian).

**Upgrade path ke Phase 2 (Cloud Function):**
- Upgrade ke Firebase Blaze plan (wajib sebelum Februari 2027)
- Deploy Cloud Function: trigger on `exam_submissions` create → hitung skor → tulis ke `exam_results`
- Update Firestore rule: `exam_results` allow read `|| request.auth == null`
- Uncomment block `UPGRADE PATH` di `exam/js/app.js` result screen
- Komentar lengkap sudah ada di kode

**Catatan upgrade Blaze + Cloud Function:**
- Volume BTAM rutin: 160 invokasi/bulan → gratis (free tier: 2 juta/bulan)
- Seleksi 6.000 orang: 6.000 invokasi → tetap gratis
- Firestore reads seleksi: 6.000 × ~30 soal = 180.000 reads/hari → **melampaui Spark limit (50.000/hari)** → wajib Blaze sebelum Feb 2027

### 2.2 Shuffle soal: deterministik per token

Urutan soal di-shuffle menggunakan Mulberry32 seeded RNG dengan seed dari `session.token`. Konsisten saat resume (buka link lagi = urutan soal sama).

### 2.3 Shuffle opsi: deterministik per soalId + token

Urutan opsi A/B/C/D per soal di-shuffle menggunakan seed dari `soalId + token`. Label huruf (A/B/C/D) tetap berurutan A→B→C→D berdasarkan posisi tampil — bukan dari `opsi.id` asli.

### 2.4 Auto-save: setiap 30 detik ke session.answers + warningCount

Gagal auto-save tidak diekspos ke peserta (silent). Resume otomatis jika peserta refresh. `warningCount` ikut disimpan agar tidak reset saat refresh.

### 2.5 Anti-cheat

| Fitur | Implementasi |
|---|---|
| Fullscreen mandatory | Request saat klik "Mulai Ujian", re-request jika exit |
| Tab switch | `visibilitychange` event → warning |
| Window blur | `blur` event + 600ms delay → warning (hanya jika `document.hidden`) |
| Copy/cut/paste | Block via capture event listener |
| Right-click | Block contextmenu |
| DevTools | Block F12, Ctrl+Shift+I/J/C, Ctrl+U |
| Max warnings | Default 3 → auto-submit |
| Watermark | noPeserta transparan di background saat ujian |
| Pause saat confirm() | Anti-cheat di-pause sementara saat dialog submit muncul untuk cegah false warning |
| Resume restore | `warningCount` di-restore dari session saat peserta refresh/buka ulang link |

---

## 3. Perubahan Firestore Rules yang Diperlukan

### 3.1 `exam_sessions` — izinkan start dari status 'issued'
```js
// SESUDAH:
allow update: if isAdmin()
              || (resource.data.status in ['issued', 'started']
                  && request.resource.data.noPeserta == resource.data.noPeserta
                  && request.resource.data.examId == resource.data.examId);
```

### 3.2 `bank_soal` — izinkan exam app baca soal
```js
match /bank_soal/{soalId} {
  allow read: if isAdmin() || request.auth == null;
  allow write: if canWrite();
}
```

---

## 4. Bug yang Ditemukan & Difix Saat Testing

| Bug | Penyebab | Fix |
|---|---|---|
| 404 saat buka exam | URL tanpa `/btam-system/` di tengah | Fix `EXAM_HOST` di `tab-ujian.js` — derive base path dari `window.location.pathname` |
| Token tidak terbaca | Format hash `#/session/TOKEN` dari M1.5 tapi app.js baca `?token=` | Tambah fallback regex untuk kedua format |
| Exam config tidak ditemukan | `exam.published == false` | Publish exam dulu dari admin app (bug logis: bimtek belum publish tapi exam bisa publish — catat sebagai backlog M1.9) |
| Label opsi ikut teracak | Render pakai `opsi.id` sebagai label | Ganti ke `String.fromCharCode(65 + idx)` untuk label posisi |
| Warning reset saat refresh | `warningCount` hanya di memori | Simpan ke Firestore via auto-save, restore saat `initExamRunner` |
| Overlay auto-submit muncul saat submit manual | Anti-cheat trigger dari `confirm()` dialog | Tambah `pauseAntiCheat()` / `resumeAntiCheat()` saat confirm dialog |
| Blank white page | `anti-cheat.js` tidak export `pauseAntiCheat` | Upload file yang sudah difix |

---

## 5. Layer A Testing — Hasil

| Test | Status |
|---|---|
| Token tidak ada → error "Tautan Tidak Valid" | ✅ |
| Token expired | ⏳ Belum bisa dicek (perlu tunggu natural expiry) |
| Token valid → entry screen dengan nama ujian + durasi | ✅ |
| noPeserta salah → error merah | ✅ |
| noPeserta benar → instruksi | ✅ |
| Mulai ujian → fullscreen + timer | ✅ |
| Navigasi soal (prev/next/grid) | ✅ |
| Pilih jawaban → nav grid update | ✅ |
| Tandai soal | ✅ |
| Refresh di tengah ujian → resume dengan jawaban + warningCount tersimpan | ✅ |
| Submit → konfirmasi "Jawaban Berhasil Dikumpulkan" | ✅ |
| Buka link lagi setelah submit → "Ujian Sudah Dikumpulkan" | ✅ |
| Firestore: `exam_sessions.status == 'submitted'` | ✅ |
| Firestore: `exam_submissions` doc terbuat | ✅ |
| Anti-cheat: tab switch → peringatan | ✅ |
| Anti-cheat: max warnings → auto-submit | ✅ |
| Label opsi A/B/C/D berurutan meski konten diacak | ✅ |

**Layer A: LULUS** (kecuali token expired yang belum bisa ditest)

---

## 6. Keputusan Arsitektur Seleksi (M2b.3)

### 6.1 Konteks seleksi tertulis
- 10-15 jenis ujian tersedia (satu per bimtek)
- Pendaftar hanya bisa mengerjakan ujian bimtek yang dia **lulus seleksi administrasi**-nya per bimtek
- Seleksi admin per bimtek, bukan satu gerbang global
- Tiap pendaftar mengerjakan ujian sesuai bimtek yang lolos — biasanya 1-5, tidak ada hard limit
- Window: 24 jam, durasi per ujian ~20 menit
- Skala: ~6.000 pendaftar

### 6.2 Auth seleksi: portal login (BUKAN magic link)
```
exam/?mode=seleksi
  → input email
  → query calon_peserta by email
  → tampil daftar ujian eligible (bimtekId dimana statusAdmin == 'lulus')
  → klik satu ujian → exam runner (identik dengan bimtek)
```

### 6.3 Dua entry point di exam app yang sama
```
exam/?token=xxx       → magic link (bimtek)     ← M1.6 ✅
exam/?mode=seleksi    → portal login (seleksi)  ← M2b.3
```

### 6.4 Schema exam_sessions — Opsi B
Tambah field opsional `pendaftarId: string | null` di M2b.3. Field `noPeserta` tetap ada untuk bimtek. Tepat satu yang diisi, yang lain null.

---

## 7. Backlog Items (catat untuk M1.9)

- Admin bisa publish exam meskipun bimtek belum dipublish — perlu validasi di M1.9
- Hapus Eruda dari `exam/index.html` setelah testing selesai

---

## 8. Status Milestone

| Milestone | Status |
|---|---|
| M1.1 Foundation | ✅ Done |
| M1.2 Master Data Core | ✅ Done |
| M1.3 Bank Soal | ✅ Done |
| M1.4 Bimtek CRUD | ✅ Done |
| M1.5 Exam Editor + Magic Link | ✅ Done |
| **M1.6 Exam Runner** | **✅ Done — Layer A tested** |
| M1.7 Input Nilai & Kelulusan | ⬜ Next |


---

## 1. File yang Dibuat (M1.6)

| File | Deskripsi |
|---|---|
| `exam/index.html` | Entry point exam app — SPA light theme, Tailwind CDN |
| `exam/js/app.js` | Orchestrator: token parse → validasi → entry → instruksi → exam → result |
| `exam/js/db.js` | Firestore helpers tanpa Firebase Auth |
| `exam/js/anti-cheat.js` | Anti-cheat engine (tab switch, fullscreen, copy, devtools) |
| `exam/js/exam-runner.js` | UI ujian: render soal, timer, auto-save, navigasi, submit |

**Tidak dibuat** (diputuskan tidak diperlukan untuk M1.6):
- `scorer.js` — scoring ditunda ke Phase 2 via Cloud Function

---

## 2. Keputusan Desain M1.6

### 2.1 Scoring: Opsi B (submit dulu, nilai diproses admin)

**Alasan:** `bank_soal_answers` adalah admin-only read. Menyimpan kunci di session doc berarti siapa pun yang punya token URL bisa lihat kunci sebelum mulai ujian.

**Keputusan:** Exam app hanya submit jawaban ke `exam_submissions`. Result screen tampilkan "Jawaban berhasil dikumpulkan." Nilai dihitung dari sisi admin (tab Ujian).

**Upgrade path ke Phase 2 (Cloud Function):**
- Upgrade ke Firebase Blaze plan (wajib sebelum Februari 2027)
- Deploy Cloud Function: trigger on `exam_submissions` create → hitung skor → tulis ke `exam_results`
- Update Firestore rule: `exam_results` allow read `|| request.auth == null`
- Uncomment block `UPGRADE PATH` di `exam/js/app.js` result screen
- Komentar lengkap sudah ada di kode

**Catatan upgrade Blaze + Cloud Function:**
- Volume BTAM rutin: 160 invokasi/bulan → gratis (free tier: 2 juta/bulan)
- Seleksi 6.000 orang: 6.000 invokasi → tetap gratis
- Firestore reads seleksi: 6.000 × ~30 soal = 180.000 reads/hari → **melampaui Spark limit (50.000/hari)** → wajib Blaze sebelum Feb 2027

### 2.2 Shuffle soal: deterministik per token

Urutan soal di-shuffle menggunakan Mulberry32 seeded RNG dengan seed dari `session.token`. Konsisten saat resume (buka link lagi = urutan soal sama).

### 2.3 Shuffle opsi: deterministik per soalId + token

Urutan opsi A/B/C/D per soal di-shuffle menggunakan seed dari `soalId + token`. Tujuan: peserta berdekatan tidak bisa contek ("jawabannya B" bisa berbeda untuk dua peserta yang soalnya sama).

### 2.4 Auto-save: setiap 30 detik ke session.answers

Gagal auto-save tidak diekspos ke peserta (silent retry). Resume otomatis jika peserta refresh/buka link lagi.

### 2.5 Anti-cheat

| Fitur | Implementasi |
|---|---|
| Fullscreen mandatory | Request saat klik "Mulai Ujian", re-request jika exit |
| Tab switch | `visibilitychange` event → warning |
| Window blur | `blur` event + 600ms delay → warning (hanya jika `document.hidden`) |
| Copy/cut/paste | Block via capture event listener |
| Right-click | Block contextmenu |
| DevTools | Block F12, Ctrl+Shift+I/J/C, Ctrl+U |
| Max warnings | Default 3 (dari `EXAM_DEFAULTS.MAX_WARNINGS`) → auto-submit |
| Watermark | noPeserta transparan di background saat ujian |

---

## 3. Perubahan Firestore Rules yang Diperlukan

**Wajib dilakukan sebelum testing M1.6:**

### 3.1 `exam_sessions` — izinkan start dari status 'issued'

```js
// SEBELUM:
allow update: if isAdmin()
              || (resource.data.status == 'started'
                  && request.resource.data.noPeserta == resource.data.noPeserta
                  && request.resource.data.examId == resource.data.examId);

// SESUDAH:
allow update: if isAdmin()
              || (resource.data.status in ['issued', 'started']
                  && request.resource.data.noPeserta == resource.data.noPeserta
                  && request.resource.data.examId == resource.data.examId);
```

**Alasan:** Saat peserta klik "Mulai Ujian", status masih 'issued'. Perlu diubah ke 'started' oleh exam app (unauthenticated). Rule lama hanya allow update saat status sudah 'started'.

### 3.2 `bank_soal` — izinkan exam app baca soal

```js
// TAMBAHKAN di match /bank_soal/{soalId}:
match /bank_soal/{soalId} {
  allow read: if isAdmin() || request.auth == null;  // exam app baca soal
  allow write: if canWrite();
}
```

**Alasan:** Exam app berjalan tanpa Firebase Auth. Perlu baca soal (pertanyaan + opsi, tanpa kunci jawaban) untuk menampilkan ujian.

---

## 4. Checklist Deploy M1.6

### 4.1 Upload ke GitHub Pages
```
exam/
  index.html          ← ganti placeholder yang lama
  js/
    app.js
    db.js
    anti-cheat.js
    exam-runner.js
```

### 4.2 Update Firestore Rules
Terapkan dua perubahan di section 3 di atas via Firebase Console atau CLI.

### 4.3 Test End-to-End (Layer A — Happy Path)
- [ ] Buka `exam/?token=INVALID` → tampil error "Tautan Tidak Ditemukan"
- [ ] Buka `exam/?token=TOKEN_EXPIRED` → tampil error "Tautan Kedaluwarsa"
- [ ] Buka `exam/?token=VALID` → tampil entry screen dengan nama ujian + durasi
- [ ] Input noPeserta salah → tampil error merah
- [ ] Input noPeserta benar → lanjut ke instruksi
- [ ] Klik "Mulai Ujian" → fullscreen + timer mulai
- [ ] Navigasi soal (prev/next/grid) → lancar
- [ ] Pilih jawaban → nav grid update (biru = dijawab)
- [ ] Tandai soal → nav grid update (amber = ditandai)
- [ ] Refresh browser di tengah ujian → resume dengan jawaban tersimpan
- [ ] Submit → tampil "Jawaban Berhasil Dikumpulkan"
- [ ] Buka link lagi setelah submit → tampil "Ujian Sudah Dikumpulkan"
- [ ] Cek Firestore: `exam_sessions.status == 'submitted'`, `exam_submissions` doc ada

### 4.4 Test Layer B — Edge Cases
- [ ] Buka link di mobile → UI responsif
- [ ] Anti-cheat: pindah tab → muncul toast peringatan + badge update
- [ ] Anti-cheat: keluar fullscreen → muncul toast + re-request fullscreen
- [ ] Anti-cheat: 3 peringatan → auto-submit
- [ ] Timer habis → auto-submit
- [ ] Submit dengan soal belum dijawab → confirm dialog muncul dengan jumlah yang benar

---

## 5. Keputusan Arsitektur Seleksi (M2b.3)

### 5.1 Konteks seleksi tertulis

- 10-15 jenis ujian tersedia (satu per bimtek)
- Pendaftar hanya bisa mengerjakan ujian bimtek yang dia **lulus seleksi administrasi**-nya
- Seleksi admin per bimtek, bukan satu gerbang global
- Tiap pendaftar biasanya mengerjakan 1-5 ujian, tidak ada hard limit
- Window: 24 jam, durasi per ujian ~20 menit
- Skala: ~6.000 pendaftar

### 5.2 Auth seleksi: portal login (BUKAN magic link)

Magic link tidak feasible untuk seleksi (6.000 orang × hingga lebih dari 5 ujian = potensial puluhan ribu link).

**Solusi: portal login di exam app**

```
exam/?mode=seleksi
  → input email (yang dipakai saat daftar via pendaftar app)
  → sistem query calon_peserta by email
  → validasi: email ditemukan + status siklus = 'tertulis'
  → tampil daftar ujian yang eligible:
      hanya bimtekId dimana statusAdmin == 'lulus'
  → klik satu ujian → masuk exam runner (identik dengan bimtek)
```

Admin **tidak perlu kirim link** — cukup umumkan satu URL portal + periode 24 jam.

### 5.3 Dua entry point di exam app yang sama

```
exam/?token=xxx       → magic link flow (bimtek)    ← M1.6 ✅
exam/?mode=seleksi    → portal login (seleksi)      ← M2b.3
```

Exam runner (`exam-runner.js`) dipakai ulang tanpa perubahan untuk keduanya.

### 5.4 Schema exam_sessions — Opsi B (dua field terpisah)

Keputusan: **tidak** mengganti `noPeserta` dengan field unified. Tambah field opsional:

```js
// exam_sessions — update schema (M2b.3)
{
  // ... field existing ...
  noPeserta: string | null,    // diisi untuk sesi bimtek
  pendaftarId: string | null,  // diisi untuk sesi seleksi tertulis
  // Tepat satu dari dua field ini yang diisi, yang lain null
}
```

**Tidak ada perubahan ke `exam_sessions` untuk M1.6.** `pendaftarId` field ditambahkan saat M2b.3.

### 5.5 Firestore rule exam_sessions untuk seleksi (M2b.3)

Perlu ditambahkan saat M2b.3:
```js
allow update: if isAdmin()
              || (resource.data.status in ['issued', 'started']
                  && (
                    // bimtek: cek noPeserta
                    request.resource.data.noPeserta == resource.data.noPeserta
                    // seleksi: cek pendaftarId
                    || request.resource.data.pendaftarId == resource.data.pendaftarId
                  )
                  && request.resource.data.examId == resource.data.examId);
```

---

## 6. Update OPUSPLAN yang Diperlukan

### Section 1.2 — Keputusan Utama
```
// Ubah:
Autentikasi peserta | Magic link (1x pakai dengan window 24 jam)

// Menjadi:
Autentikasi peserta (bimtek) | Magic link (1x pakai, window 24 jam)
Autentikasi pendaftar (seleksi) | Portal login via email (M2b.3)
```

### Section 4.13 — exam_sessions schema
Tambah dua field opsional:
- `pendaftarId: string | null` — untuk sesi seleksi tertulis (M2b.3)
- `bimtekId: string` — sudah ada di exam-api.js, perlu eksplisit di schema doc

### Section 5 — Firestore Rules
Update rule `exam_sessions`:
- `resource.data.status == 'started'` → `resource.data.status in ['issued', 'started']`

Tambah rule `bank_soal`:
- `allow read: if isAdmin() || request.auth == null`

### Section M1.6 — Definisi Selesai
```
// Ubah:
peserta bisa ikut exam dari magic link, submit, lihat hasil. Admin lihat hasil di dashboard.

// Menjadi:
peserta bisa ikut exam dari magic link, submit, muncul konfirmasi "Jawaban berhasil dikumpulkan".
Admin lihat submission di tab Ujian. Scoring via Cloud Function di Phase 2.
```

### Section M2b.3 — Seleksi Tertulis Native
Ganti seluruh deskripsi M2b.3 dengan:

```
#### Milestone 2b.3 — Seleksi Tertulis Native (18-25 jam)

Entry point: `exam/?mode=seleksi` (portal login, bukan magic link)

- [ ] Portal login screen di exam app:
  - [ ] Input email → query calon_peserta
  - [ ] Validasi: email ditemukan + siklus sedang dalam fase 'tertulis'
  - [ ] Tampil daftar ujian eligible (bimtek yang lulus seleksi admin)
  - [ ] Tidak ada hard limit jumlah ujian per pendaftar (biasanya 1-5)
- [ ] Generate exam_sessions untuk seleksi:
  - [ ] Pakai pendaftarId (bukan noPeserta) di session doc
  - [ ] Session di-generate on-the-fly saat pendaftar klik ujian (bukan pre-generate)
    atau pre-generate saat admin publish fase tertulis (TBD)
  - [ ] Window: expiresAt = siklus.phases.tertulis.end
- [ ] Schema exam_sessions: tambah field pendaftarId (Opsi B)
- [ ] Update Firestore rules exam_sessions untuk handle pendaftarId
- [ ] Exam runner: reuse exam-runner.js dari M1.6 tanpa perubahan
- [ ] Upgrade ke Firebase Blaze plan (wajib untuk Firestore read scale 6.000 orang)
- [ ] Test load: 100 concurrent sessions tanpa error

**Definisi selesai:** pendaftar bisa login via email, lihat daftar ujian eligible,
submit ujian, konfirmasi tersimpan. 50 concurrent test tanpa error.
```

### Reminder Wajib Sebelum Seleksi Feb 2027
Tambah ke risk register / catatan milestone:

```
⚠️ WAJIB DILAKUKAN ~2 BULAN SEBELUM SELEKSI FEBRUARI 2027:
1. Upgrade Firebase ke Blaze plan (Spark hard limit 50.000 reads/hari — seleksi butuh 180.000+/hari)
2. Deploy Cloud Function untuk scoring otomatis (lihat UPGRADE PATH comment di exam/js/app.js)
3. Update Firestore rule exam_results: tambah || request.auth == null
4. Uncomment block UPGRADE PATH di app.js result screen
5. Test end-to-end dengan data dummy 6.000 pendaftar
```

---

## 7. Status Milestone

| Milestone | Status |
|---|---|
| M1.1 Foundation | ✅ Done |
| M1.2 Master Data Core | ✅ Done |
| M1.3 Bank Soal | ✅ Done |
| M1.4 Bimtek CRUD | ✅ Done |
| M1.5 Exam Editor + Magic Link | ✅ Done |
| **M1.6 Exam Runner** | **✅ Done — siap deploy** |
| M1.7 Input Nilai & Kelulusan | ⬜ Next |

# Schema Data Terpadu & Checklist Harmonisasi

**Tanggal:** 2026-04-17
**Aplikasi terlibat:**
- `exam-app-main-11.html` (Sistem Ujian Pre/Post Test)
- `penilaian-bimtek-btam.html` (Sistem Penilaian Global Bimtek)

**Tujuan dokumen ini:**
1. Menetapkan **schema data tunggal** yang harus dipatuhi semua aplikasi dalam ekosistem BTAM
2. Mengidentifikasi **ketidakselarasan** antara dua aplikasi yang ada
3. Memberikan **checklist perubahan konkret** untuk menyelaraskan dua aplikasi
4. Menjadi **referensi** saat bangun aplikasi ketiga/keempat nanti

---

## 1. Foto Realitas: Schema Peserta Saat Ini

### 1.1. Di `exam-app-main-11.html`

```js
// Object Participant (di Firestore: se_participants.{examId}.list[])
{
  noPeserta: string,   // WAJIB — primary key, case-insensitive match
  nama:      string,   // WAJIB
  instansi:  string,   // WAJIB
  kabKota:   string,   // opsional
  provinsi:  string    // opsional
}
```

**Kolom CSV:** `noPeserta, nama, instansi, kabKota, provinsi`

### 1.2. Di `penilaian-bimtek-btam.html`

```js
// Object Peserta (di localStorage: store.kegiatanList[].peserta[])
{
  id:       string,   // WAJIB — primary key (auto-generate "001", "002" jika tidak diisi)
  nama:     string,   // WAJIB
  jabatan:  string,   // opsional
  instansi: string,   // opsional
  provinsi: string    // opsional
}
```

**Kolom Excel import:** `No, Nama, Jabatan, Instansi, Provinsi` (case-insensitive, deteksi otomatis)

### 1.3. Masalah Nyata

| Masalah | Impact | Prioritas |
|---|---|---|
| **`noPeserta`** vs **`id`** — nama field beda untuk konsep yang sama | Matching rapuh, harus mapping manual | 🔴 Tinggi |
| **`jabatan`** ada di `penilaian` tapi **tidak di `exam-app`** | `pullFromFirebase()` selalu kasih jabatan kosong | 🔴 Tinggi |
| **`kabKota`** ada di `exam-app` tapi **tidak di `penilaian`** | Data hilang saat sinkronisasi | 🟡 Sedang |
| Matching by **nama lowercase** di `syncExamScores()` | "Budi Santoso" ≠ "Budi Santoso " ≠ "Budi  Santoso" | 🔴 Tinggi |
| `id` auto-generated "001","002" di `penilaian` | Konflik dengan `noPeserta` real dari `exam-app` | 🟡 Sedang |
| Email, No HP, JK, Pendidikan — **tidak ada di keduanya** | Tidak bisa kirim sertifikat/laporan digital, tidak ada analisis demografis | 🟢 Rendah (nice to have) |

---

## 2. Schema Terpadu v2 (Target)

Ini adalah **kontrak bersama** yang harus dipatuhi semua aplikasi di ekosistem BTAM mulai sekarang.

### 2.1. Collection `peserta_master` (BARU — di Firestore)

Penting: **ini entitas master terpisah**, bukan per-exam seperti `se_participants` sekarang. Alasan: peserta yang sama mungkin ikut banyak Bimtek/banyak ujian. Data master-nya satu, relasi ke Bimtek/ujian terpisah.

```js
{
  noPeserta:    string,        // PK — ID resmi (NIP, NIK, atau ID internal) — case-insensitive
  nama:         string,        // WAJIB
  
  // Identitas pribadi (opsional, boleh null)
  jenisKelamin: 'L' | 'P' | null,
  jabatan:      string | null,
  pendidikan:   'SMA' | 'D3' | 'S1' | 'S2' | 'S3' | 'Lainnya' | null,
  email:        string | null,
  noHp:         string | null, // format: 08xxx atau +62xxx
  
  // Afiliasi organisasi (opsional)
  instansi:     string | null,
  unitKerja:    string | null, // bagian/divisi di dalam instansi
  kabKota:      string | null,
  provinsi:     string | null,
  
  // Escape hatch untuk field tambahan khusus Bimtek tertentu
  customFields: { [key: string]: string } | null,
  
  // Audit
  createdAt:    Timestamp,
  updatedAt:    Timestamp,
  createdBy:    string | null   // admin yang input
}
```

**Convention penting:**
- `noPeserta` disimpan **apa adanya** (preserve case), tapi matching & deduplication **selalu case-insensitive**.
- Field opsional yang kosong **selalu `null`**, bukan `""` atau `undefined`. Alasan: lebih mudah dideteksi "belum diisi" vs "diisi kosong".
- `customFields` untuk kebutuhan spesifik Bimtek tertentu (misal nomor Zoom, afiliasi proyek tertentu) — bukan untuk field yang ada di banyak Bimtek.

### 2.2. Collection `bimtek` (BARU — di Firestore)

Entitas "Kegiatan" yang menaungi Pre/Post Test + penilaian lainnya.

```js
{
  id:        string,    // PK — auto-generated
  nama:      string,    // WAJIB — nama Bimtek
  lokasi:    string,
  periode:   {
    mulai: Timestamp,
    selesai: Timestamp
  },
  kkm:       number,    // default 60
  
  // Link ke modul lain
  examCode:  string | null,  // kode ujian di exam-app (linkage Pre/Post Test)
  
  // Konfigurasi penilaian (sesuai penilaian-bimtek-btam.html)
  weights: {
    pretest:    number,
    posttest:   number,
    pengajar:   number,
    kehadiran:  number,
    keaktifan:  number,
    respek:     number,
    tugas:      number,
    presentasi: number
  },
  hasTugas:      boolean,
  hasPresentasi: boolean,
  
  // Peserta yang ikut Bimtek ini (referensi ke peserta_master)
  pesertaIds: string[],       // array of noPeserta
  
  // Pengajar (sementara: list nama; nanti upgrade jadi pengajarIds ke master)
  pengajar:   string[],
  
  // Audit
  createdAt:  Timestamp,
  updatedAt:  Timestamp
}
```

### 2.3. Collection `bimtek_scores` (BARU — di Firestore)

Pisah dari `bimtek` supaya dokumen Bimtek tidak membengkak kalau pesertanya banyak.

```js
// Document ID: {bimtekId}__{noPeserta}
{
  bimtekId:   string,
  noPeserta:  string,
  
  // Nilai per komponen (null = belum diinput)
  pretest:    number | null,   // dari exam-app (sync)
  posttest:   number | null,   // dari exam-app (sync)
  pengajar:   { [namaPengajar: string]: number } | null,
  kehadiran:  number | null,
  keaktifan:  number | null,
  respek:     number | null,
  tugas:      number | null,
  presentasi: number | null,
  
  // Metadata sumber data
  pretest_src:  'manual' | 'firebase' | null,
  posttest_src: 'manual' | 'firebase' | null,
  
  updatedAt:  Timestamp
}
```

### 2.4. Collection Lama Tetap Dipakai (Compatibility)

Collection existing tidak dihapus, hanya ditambahi atau disinkronkan:

| Collection | Status | Peran Baru |
|---|---|---|
| `se_exams` | ✅ Tetap | Config ujian (Pre/Post Test), tidak berubah |
| `se_answers` | ✅ Tetap | Kunci jawaban, tidak berubah |
| `se_participants` | ⚠️ **Deprecated, akan digantikan** | Whitelist per exam. Phase 1 tetap ada, Phase 2 digantikan oleh `bimtek.pesertaIds` + `peserta_master` |
| `se_results` | ✅ Tetap | Hasil ujian. Tambah field `noPeserta` eksplisit (sudah ada `id`, tinggal pastikan konsisten) |
| `se_submissions` | ✅ Tetap | Raw submission, tidak berubah |
| **`peserta_master`** | 🆕 Baru | Master data peserta |
| **`bimtek`** | 🆕 Baru | Master Kegiatan |
| **`bimtek_scores`** | 🆕 Baru | Nilai per peserta per Kegiatan |

---

## 3. Konvensi Penamaan (Wajib Dipatuhi)

Supaya tidak ada lagi `id` vs `noPeserta` vs `participantId`:

| Konsep | Nama Field (wajib) | Dilarang pakai |
|---|---|---|
| ID resmi peserta | `noPeserta` | `id`, `participantId`, `peserta_id` |
| Nama lengkap peserta | `nama` | `name`, `fullName`, `namaLengkap` |
| Instansi/Lembaga | `instansi` | `institution`, `kantor`, `lembaga` |
| Kabupaten/Kota | `kabKota` | `kota`, `kabupaten`, `kab_kota` |
| ID kegiatan Bimtek | `bimtekId` | `kegiatanId`, `batchId` |
| Kode ujian | `examCode` | `kodeUjian`, `exam_code` |
| ID soal ujian | `examId` | `ujianId` |
| No HP | `noHp` | `phone`, `telepon`, `hp` |
| Email | `email` | `emailAddress`, `mail` |
| Jenis kelamin | `jenisKelamin` (value: 'L'/'P') | `gender`, `sex`, `jk` |
| Pendidikan terakhir | `pendidikan` | `education`, `pendidikanTerakhir` |

**Kenapa ini penting:** saat Anda bangun aplikasi ke-3, Anda (atau AI yang bantu Anda) akan tergoda pakai `id` atau `participantId`. Jangan. Selalu cek tabel ini.

---

## 4. Aturan Matching Peserta Antar Aplikasi

### Rule #1 — **HANYA** match by `noPeserta`

**DILARANG** match by nama. Alasan: nama tidak unik, nama bisa mengandung spasi/titik/huruf kapital yang beda, nama bisa typo.

**SATU-SATUNYA** fallback yang diizinkan: kalau `noPeserta` hilang (dokumen lama pre-migrasi), flag as `"needs_manual_match"`, jangan asumsikan.

### Rule #2 — Normalisasi sebelum match

```js
function normalizeNoPeserta(raw) {
  return String(raw || '').trim().toLowerCase();
}

function matchesPeserta(a, b) {
  return normalizeNoPeserta(a.noPeserta) === normalizeNoPeserta(b.noPeserta);
}
```

Selalu trim + lowercase. Tidak lebih, tidak kurang. Jangan tambah `.replace(/\s+/g, '')` atau normalisasi lain yang "lebih pintar" — justru itu bikin tidak konsisten.

### Rule #3 — Display case original, bandingkan case normalized

Saat **menampilkan** di UI: pakai `noPeserta` asli dari database (preserve case asli).
Saat **matching/dedup**: pakai hasil `normalizeNoPeserta()`.

---

## 5. Checklist Harmonisasi — Perubahan Konkret

Ini yang perlu dilakukan **segera**, tanpa menunggu migrasi ke schema v2 yang lebih besar. Ini perbaikan "low-hanging fruit" yang bisa dikerjakan dalam beberapa jam.

### 5.1. Di `penilaian-bimtek-btam.html`

#### ✅ Ubah 1: Rename field `id` → `noPeserta` di internal state

**Lokasi:** `newKegiatan()`, semua `peserta.map()`, `peserta[i].id`, `peserta[i].nama`

**Alasan:** konsistensi dengan ekosistem BTAM. `id` ambigu (bisa jadi id baris, id Firestore, id peserta).

**Catatan:** localStorage existing data pakai `id`. Kalau langsung rename, data lama pecah. Solusi bertahap:

```js
// Helper: normalisasi object peserta lama jadi baru
function normalizePeserta(p) {
  return {
    noPeserta: p.noPeserta || p.id || '',
    nama:      p.nama || '',
    jabatan:   p.jabatan || '',
    instansi:  p.instansi || '',
    provinsi:  p.provinsi || '',
    // field baru sementara null
    kabKota:      p.kabKota || null,
    jenisKelamin: p.jenisKelamin || null,
    email:        p.email || null,
    noHp:         p.noHp || null,
    pendidikan:   p.pendidikan || null
  };
}

// Panggil saat loadStore()
function loadStore() {
  const raw = localStorage.getItem('bimtek_store');
  if (!raw) return { kegiatanList: [], firebaseCfg: null };
  const store = JSON.parse(raw);
  // Migration: normalisasi semua peserta
  store.kegiatanList.forEach(k => {
    k.peserta = (k.peserta || []).map(normalizePeserta);
  });
  return store;
}
```

#### ✅ Ubah 2: Tambah field baru di form & import

**Form Add/Edit Peserta** (`#modal-peserta`):
```html
<!-- Tambahkan setelah field Provinsi: -->
<div class="form-group"><label>Kab/Kota</label><input type="text" id="p-kabkota"></div>
<div class="form-group">
  <label>Jenis Kelamin</label>
  <select id="p-jk">
    <option value="">—</option>
    <option value="L">Laki-laki</option>
    <option value="P">Perempuan</option>
  </select>
</div>
<div class="form-group"><label>Jabatan</label> <!-- sudah ada --></div>
<div class="form-group">
  <label>Pendidikan</label>
  <select id="p-pendidikan">
    <option value="">—</option>
    <option value="SMA">SMA</option>
    <option value="D3">D3</option>
    <option value="S1">S1</option>
    <option value="S2">S2</option>
    <option value="S3">S3</option>
    <option value="Lainnya">Lainnya</option>
  </select>
</div>
<div class="form-group"><label>Email</label><input type="email" id="p-email"></div>
<div class="form-group"><label>No. HP</label><input type="text" id="p-nohp" placeholder="08xxxxxxxxxx"></div>
```

**Update `savePeserta()`:**
```js
function savePeserta() {
  const k = getKeg(); if (!k) return;
  const idx = parseInt(document.getElementById('edit-peserta-idx').value);
  const p = {
    noPeserta:    document.getElementById('p-id').value.trim(),
    nama:         document.getElementById('p-nama').value.trim(),
    jabatan:      document.getElementById('p-jabatan').value.trim() || null,
    instansi:     document.getElementById('p-instansi').value.trim() || null,
    provinsi:     document.getElementById('p-provinsi').value.trim() || null,
    kabKota:      document.getElementById('p-kabkota').value.trim() || null,
    jenisKelamin: document.getElementById('p-jk').value || null,
    pendidikan:   document.getElementById('p-pendidikan').value || null,
    email:        document.getElementById('p-email').value.trim() || null,
    noHp:         document.getElementById('p-nohp').value.trim() || null
  };
  if (!p.noPeserta || !p.nama) { toast('No. Peserta dan Nama wajib', 'error'); return; }
  if (idx >= 0) k.peserta[idx] = p;
  else { k.peserta.push(p); ensureScores(); }
  saveStore();
  renderPesertaTable();
  closeModal('modal-peserta');
  toast(idx >= 0 ? 'Diperbarui ✓' : 'Ditambahkan ✓', 'ok');
}
```

**Update `importPeserta()`** — tambah deteksi kolom `jenisKelamin`, `pendidikan`, `email`, `noHp`, `kabKota`:
```js
// Di loop kolom header:
if (c.includes('kelamin') || c.includes('jk') || c === 'gender') colMap.jenisKelamin = j;
if (c.includes('pendidikan')) colMap.pendidikan = j;
if (c.includes('email') || c === 'mail') colMap.email = j;
if (c.includes('hp') || c.includes('telepon') || c.includes('phone')) colMap.noHp = j;
if (c.includes('kab') || c.includes('kota')) colMap.kabKota = j;
```

#### ✅ Ubah 3: Fix `syncExamScores()` — match HANYA by `noPeserta`

**Sebelum:**
```js
const pIdx = k.peserta.findIndex(p =>
  p.id.toLowerCase() === rId || (rName && p.nama.toLowerCase() === rName)
);
```

**Sesudah:**
```js
const pIdx = k.peserta.findIndex(p =>
  normalizeNoPeserta(p.noPeserta) === normalizeNoPeserta(rId)
);
// Kalau tidak ketemu, TIDAK fallback ke nama. Biarkan unmatched.
// Tampilkan warning berapa yang tidak match supaya admin tahu.
```

Tambah helper di atas:
```js
function normalizeNoPeserta(raw) {
  return String(raw || '').trim().toLowerCase();
}
```

#### ✅ Ubah 4: Fix `pullFromFirebase()` — preserve jabatan

**Masalah saat ini:** saat pull dari `se_participants`, field `jabatan: ''` di-hardcode kosong.

**Solusi:** cek dulu di `se_results` apakah ada data tambahan, atau minimal JANGAN overwrite jabatan kalau peserta sudah ada.

Actually lebih baik: minta `exam-app-main-11` yang mulai simpan `jabatan`. Lihat section 5.2.

### 5.2. Di `exam-app-main-11.html`

#### ✅ Ubah 5: Tambah field di Participant (whitelist)

**Update CSV_HEADERS:**
```js
// ganti
const CSV_HEADERS = ['nopeserta','nama','instansi','kabkota','provinsi'];
// jadi
const CSV_HEADERS = ['nopeserta','nama','jabatan','instansi','kabkota','provinsi','jeniskelamin','pendidikan','email','nohp'];
// Catatan: hanya nopeserta, nama, instansi yang WAJIB — rest opsional di parsing
```

**Update `parseCSVText()` validation:**
- Wajib: `nopeserta`, `nama`, `instansi`
- Opsional: sisanya (bisa tidak ada di header)

**Update `addParticipantManual()` & `saveEditParticipant()` & form HTML:**
Tambah input fields untuk jabatan, JK, pendidikan, email, noHp.

**Update object Participant:**
```js
d.list.push({
  noPeserta, nama, instansi,
  kabKota: kabKota || null,
  provinsi: provinsi || null,
  jabatan: jabatan || null,
  jenisKelamin: jenisKelamin || null,
  pendidikan: pendidikan || null,
  email: email || null,
  noHp: noHp || null
});
```

#### ✅ Ubah 6: Simpan field baru di `se_results` saat submit ujian

Sekarang saat peserta submit, `se_results` hanya simpan:
```js
{ id, name, instansi, examCode, examType, score, ... }
```

**Tambah:** ambil dari whitelist, copy field ekstra ke `se_results`:
```js
// Di finishExam() atau prosesNilai()
const wlData = getParticipantsForExam(cfg.id);
const found = (wlData?.list || []).find(p =>
  normalizeNoPeserta(p.noPeserta) === normalizeNoPeserta(sid)
);
const resultPayload = {
  id: sid,
  noPeserta: sid,                     // ← BARU, eksplisit
  name: name,
  nama: name,                         // ← BARU, konsisten
  instansi: found?.instansi || inputInstansi,
  jabatan: found?.jabatan || null,    // ← BARU
  kabKota: found?.kabKota || null,    // ← BARU
  provinsi: found?.provinsi || null,  // ← BARU
  jenisKelamin: found?.jenisKelamin || null, // ← BARU
  pendidikan: found?.pendidikan || null,     // ← BARU
  email: found?.email || null,        // ← BARU
  noHp: found?.noHp || null,          // ← BARU
  // ...field existing (score, details, dll)
};
```

Ini pemenang besar: begitu ini diimplement, `penilaian-bimtek-btam.html` yang `pullFromFirebase()` langsung dapat semua field peserta, tidak hanya nama+instansi.

#### ✅ Ubah 7: Kolom tambahan di form Entry Peserta

Sekarang form entry hanya: No. Peserta, Nama, Instansi. Mau ditambah Email & No HP? Itu keputusan produk:

**Opsi A — Tambah di form entry (peserta isi sendiri):**
Pro: data pasti terisi (peserta mengisi).
Con: peserta bisa isi sembarangan, tambah friction di form.

**Opsi B — Hanya ambil dari whitelist (admin isi saat import CSV):**
Pro: form entry tetap simple.
Con: kalau admin tidak isi di CSV, field-nya kosong.

**Opsi C — Hybrid: kalau whitelist aktif & field-nya ada → tidak tampil di form. Kalau tidak → tampil sebagai opsional.**

Saya rekomendasi **Opsi C**. Tapi ini butuh keputusan Anda. Lihat pertanyaan di bawah.

---

## 6. Roadmap Harmonisasi (3 Tahap)

### Tahap A — Hari Ini / Besok (Quick Wins, backward compatible)

Hasil: dua aplikasi pakai nama field yang sama, matching lebih reliable.

- [ ] **[penilaian]** Tambah `normalizePeserta()` helper + panggil di `loadStore()`
- [ ] **[penilaian]** Fix `syncExamScores()` — hapus fallback match by nama
- [ ] **[exam-app]** Tambah `noPeserta` di result payload saat submit ujian
- [ ] **[keduanya]** Test: buat Bimtek baru di `penilaian`, isi examCode, run ujian di `exam-app`, sync — harus 100% match by noPeserta

**Estimasi: 2-4 jam dengan AI.**

### Tahap B — Minggu Ini (Tambah Field Peserta)

Hasil: dua aplikasi bisa simpan jabatan, JK, pendidikan, email, HP.

- [ ] **[exam-app]** Tambah field di whitelist: CSV header, form add/edit, object Participant
- [ ] **[exam-app]** Simpan field tambahan ke `se_results` saat submit
- [ ] **[penilaian]** Tambah field di form add/edit peserta
- [ ] **[penilaian]** Update `importPeserta()` untuk baca kolom baru dari Excel
- [ ] **[penilaian]** Update `pullFromFirebase()` — ambil semua field baru dari `se_results` / `se_participants`
- [ ] **[keduanya]** Update export Excel — kolom baru muncul

**Estimasi: 6-10 jam dengan AI. Lebih lama karena perubahan di banyak tempat.**

**PR jawab sebelum mulai:** lihat section 7 di bawah.

### Tahap C — Bulan Depan (Migrasi ke Schema v2)

Hasil: ada `peserta_master`, `bimtek`, `bimtek_scores` collection di Firestore. Dua app jadi "read dari master + write scores ke masing-masing domain".

Ini tahap besar. **Jangan mulai sampai Tahap A & B selesai dan stabil.** Detail migrasi nanti saya buat dokumen terpisah.

---

## 7. Keputusan yang Saya Butuhkan dari Anda

Sebelum Tahap B dimulai, ada 3 pertanyaan produk yang **hanya Anda bisa jawab**:

### Q1 — Field mana yang WAJIB di CSV import whitelist?

Sekarang: `noPeserta, nama, instansi`.

Pilihan:
- Tetap seperti sekarang (3 wajib, sisanya opsional)
- Tambah `jabatan` sebagai wajib (untuk sertifikat)
- Tambah `jenisKelamin` sebagai wajib (untuk statistik)
- Custom (sebutkan)

### Q2 — Peserta isi email/HP sendiri di form entry, atau hanya admin di CSV?

Pilihan A, B, atau C dari section 5.2 Ubah 7.

### Q3 — Migrasi data existing

Anda sudah punya:
- Peserta di `se_participants` — dengan schema lama (noPeserta, nama, instansi, kabKota, provinsi)
- Kegiatan di localStorage `penilaian` — dengan schema lama (id, nama, jabatan, instansi, provinsi)
- Results di `se_results` — dengan schema lama

Saat upgrade ke schema baru (Tahap B), data lama akan tetap pakai schema lama. Aplikasi harus handle **kedua**. Pilihan:

- **Auto-migrate saat load** (di backend Firestore atau di client setiap load) — lebih mulus tapi lebih kompleks
- **Manual migration button** di admin panel — "Convert legacy data to new schema" — lebih explicit tapi admin harus tahu kapan klik
- **Tidak migrate, dua schema coexist** — ditangani di code dengan `p.noPeserta || p.id`

Saya rekomendasi **opsi ke-3** (coexist) dengan normalizer function. Lebih aman, tidak ada risiko data corruption.

---

## 8. Contoh Kode Helper Bersama

File ini bisa Anda tempel di kedua aplikasi (copy-paste) atau nanti extract jadi file JS terpisah:

```js
// ═══════════════════════════════════════════════════════════
// SHARED: NORMALIZER & VALIDATOR
// Salin blok ini identik di kedua aplikasi supaya konsisten.
// ═══════════════════════════════════════════════════════════

/** Normalize noPeserta untuk matching (tidak untuk display) */
function normalizeNoPeserta(raw) {
  return String(raw || '').trim().toLowerCase();
}

/** Normalize peserta object ke schema v2 (handle legacy field) */
function normalizePeserta(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    noPeserta:    String(p.noPeserta || p.id || '').trim(),
    nama:         String(p.nama || p.name || '').trim(),
    jabatan:      p.jabatan || null,
    instansi:     p.instansi || null,
    unitKerja:    p.unitKerja || null,
    kabKota:      p.kabKota || null,
    provinsi:     p.provinsi || null,
    jenisKelamin: p.jenisKelamin || null,
    pendidikan:   p.pendidikan || null,
    email:        p.email || null,
    noHp:         p.noHp || p.phone || null,
    customFields: p.customFields || null
  };
}

/** Cek apakah dua peserta object adalah orang yang sama */
function isSamePeserta(a, b) {
  if (!a || !b) return false;
  return normalizeNoPeserta(a.noPeserta || a.id) ===
         normalizeNoPeserta(b.noPeserta || b.id);
}

/** Validate peserta — return array of error messages (empty = valid) */
function validatePeserta(p) {
  const errors = [];
  if (!p.noPeserta || !p.noPeserta.trim()) errors.push('No. Peserta wajib diisi');
  if (!p.nama || !p.nama.trim()) errors.push('Nama wajib diisi');
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.push('Format email tidak valid');
  if (p.noHp && !/^(\+62|62|0)8\d{7,12}$/.test(p.noHp.replace(/[\s-]/g, ''))) {
    errors.push('Format No. HP tidak valid (harus 08xxx atau +62xxx)');
  }
  if (p.jenisKelamin && !['L','P'].includes(p.jenisKelamin)) errors.push('Jenis Kelamin harus L atau P');
  return errors;
}
```

---

## 9. Apa yang TIDAK Dibahas di Dokumen Ini

Supaya scope jelas, berikut yang sengaja **tidak** dibahas (nanti di dokumen lain):

- ❌ Master data Pengajar (masih list string di `penilaian`, harus jadi entity tersendiri)
- ❌ Master data Elemen Kompetensi (sekarang per-exam di `exam-app`, harus terpusat)
- ❌ Modul Laporan Pembelajaran (belum ada)
- ❌ Authentication Firebase untuk 4-10 admin (pernah dibahas di percakapan, belum diputuskan)
- ❌ Rewrite full ke SvelteKit (diputuskan ditunda)
- ❌ Schema Bimtek lengkap dengan jadwal sesi (kalau multi-hari)

Ini semua berada di backlog "future chapters". Fokus dokumen ini: **menyelaraskan dua aplikasi yang sudah ada**.

---

## Ringkasan Eksekutif

Kalau Anda baca dokumen ini sekilas, bawa pulang 3 hal:

1. **Gunakan `noPeserta` (bukan `id`) di mana pun. Kasus-sensitif display, case-insensitive match.** Aturan nomor satu.

2. **Match peserta antar aplikasi HANYA pakai `noPeserta`. Jangan pernah pakai nama.** Aturan nomor dua.

3. **Pakai `normalizePeserta()` helper di kedua app.** Aturan nomor tiga. Copy-paste kode di section 8 ke kedua file HTML.

Kalau tiga aturan ini dipatuhi, 90% masalah sinkronisasi hilang. Sisanya (tambah field, migrasi data) adalah decoration.

---

**Langkah berikutnya dari Anda:**

1. Baca dokumen ini. Tandai yang tidak setuju atau tidak jelas.
2. Jawab 3 pertanyaan di section 7 (Q1, Q2, Q3).
3. Kalau oke, saya bantu generate perubahan konkret (Tahap A) yang bisa langsung Anda tempel di dua file HTML.

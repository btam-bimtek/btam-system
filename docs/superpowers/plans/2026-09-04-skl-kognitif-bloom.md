# SKL & Pemetaan Kognitif Bloom — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghubungkan unit kompetensi dengan level kognitif Bloom di bank soal, menetapkan standar kompetensi lulusan per bimtek, menyusun set soal pre/post dari standar itu, dan melaporkan capaian kognitif peserta.

**Architecture:** Logika murni (pembagian butir per level, penilaian capaian) diletakkan di `shared/kompetensi.js` tanpa dependensi Firestore sehingga bisa diuji dengan `node --test`. Sisanya menempel pada modul yang sudah ada: validasi di `bank-soal/api.js`, form bimtek mendapat tab baru, generator mengisi pemilih soal `exam-modal.js` yang sudah ada, laporan menambah blok pada dua dokumen yang sudah terbit.

**Tech Stack:** JavaScript ESM tanpa bundler · Firestore SDK v9 modular via CDN · Tailwind via CDN · `node --test` bawaan Node 24 untuk unit test · SheetJS via CDN (sudah dipakai)

**Spec:** `docs/superpowers/specs/2026-09-04-skl-kognitif-bloom-design.md`

## Global Constraints

- **Tanpa bundler, tanpa dependensi npm runtime.** Semua library lewat CDN `<script>`. `package.json` yang ditambahkan Task 1 hanya menyatakan `"type": "module"` agar Node bisa menjalankan test — tidak boleh menambah `dependencies` apa pun.
- **Kunci jawaban tetap terpisah.** `bank_soal_answers` tidak boleh dibaca dari mana pun kecuali jalur admin yang sudah ada. Tidak ada task di rencana ini yang menyentuhnya.
- **Tailwind saja untuk styling.** Tidak ada file CSS baru. Palet mengikuti kelas yang sudah dipakai: latar `bg-gray-900`, garis `border-gray-800`, aksen `#2dd4bf` / `bg-teal-700`, peringatan `text-yellow-400`, galat `text-red-400`.
- **Bahasa Indonesia** untuk seluruh teks yang dilihat pengguna dan komentar kode.
- **Nilai bimtek berstatus `selesai` tidak boleh berubah.** Task 2 memasang pengamannya dan harus mendarat sebelum task mana pun mengubah `bank_soal.bloomLevel`.
- **Setiap task diakhiri satu commit** dengan pesan berbahasa Indonesia berimbuhan `feat:` / `fix:` / `docs:` / `test:`.
- Level Bloom yang sah hanya `C1`–`C6`, sumber tunggalnya `BLOOM_LEVELS` di `shared/constants.js:36`.

## Struktur File

| File | Tanggung jawab | Task |
|---|---|---|
| `package.json` | *baru* — menyatakan ESM + skrip test. Tanpa dependencies. | 1 |
| `tests/kompetensi.test.js` | *baru* — unit test logika murni kompetensi | 1, 10, 13 |
| `shared/kompetensi.js` | *baru* — logika murni: pembagian butir per level, pelabelan level, penilaian capaian. Tanpa import Firestore. | 10, 13 |
| `admin/js/modules/bimtek/sub-prepost.js` | pengaman sinkronisasi bimtek selesai | 2 |
| `admin/js/modules/bank-soal/api.js` | `bloomLevel` wajib; API stok & usulan | 3, 4, 5 |
| `admin/js/modules/bank-soal/form.js` | penanda field wajib | 3 |
| `admin/js/modules/bank-soal/import.js` | *tidak diubah* — penolakan baris tanpa level datang sendiri lewat `_validateSoal` | 3 (verifikasi) |
| `admin/js/modules/bank-soal/stok.js` | *baru* — matriks stok UK × Bloom | 4 |
| `admin/js/modules/bank-soal/bloom-review.js` | *baru* — layar peninjauan usulan | 7 |
| `admin/js/modules/bank-soal/index.js` | tombol menuju dua layar baru | 4, 7 |
| `firestore.rules` | aturan `bloom_suggestions` | 5 |
| `admin/js/modules/bimtek/api.js` | simpan & sunting `bimtek.skl` | 8 |
| `admin/js/modules/bimtek/form-skl.js` | *baru* — tab SKL pada form bimtek, sekaligus satu-satunya pemilih UK bimtek | 9 |
| `admin/js/modules/bimtek/form.js` | pasang tab SKL; turunkan `ukIds` dari SKL | 9 |
| `admin/js/modules/bimtek/generator-soal.js` | *baru* — susun set soal dari SKL | 11 |
| `admin/js/modules/bimtek/exam-modal.js` | tombol Susun dari SKL | 12 |
| `admin/js/modules/bimtek/report-api.js` | panggil penilaian capaian | 14 |
| `admin/js/modules/bimtek/sub-report-peserta.js` | bagian C laporan peserta | 14 |
| `admin/js/modules/bimtek/report-narrative.js` | kalimat naratif capaian | 14 |
| `admin/js/modules/bimtek/sub-report-penyelenggara.js` | blok pemenuhan SKL | 15 |

## Cara Verifikasi

Proyek ini belum punya test apa pun. Dua jalur verifikasi dipakai:

- **Logika murni** (`shared/kompetensi.js`) diuji `node --test`. Ini satu-satunya kode yang diuji otomatis, dan memang di situlah kesalahan paling mahal: salah membagi butir atau salah menilai capaian menghasilkan laporan yang keliru tanpa gejala.
- **Kode yang menyentuh Firestore atau DOM** diverifikasi manual di browser. Setiap task semacam itu memuat langkah verifikasi dengan hasil yang diharapkan secara eksplisit. Jalankan `python -m http.server 8080` dari akar proyek, buka `http://localhost:8080/admin/`.

---

## FASE 1 — Fondasi Data

### Task 1: Penyiapan test runner

**Files:**
- Create: `package.json`
- Create: `tests/kompetensi.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: —
- Produces: perintah `npm test` yang menjalankan `node --test tests/`; berkas `tests/kompetensi.test.js` yang diperluas Task 10 dan 13.

- [ ] **Step 1: Buat `package.json`**

Node memperlakukan berkas `.js` sebagai CommonJS kecuali `package.json` menyatakan sebaliknya. Tanpa berkas ini, `import`/`export` di `shared/` akan menjadi galat sintaks saat diuji. Browser tidak membaca `package.json`, jadi aplikasi tidak terpengaruh.

```json
{
  "name": "btam-system",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Sistem manajemen bimtek BTAM. Tanpa bundler — package.json ini hanya agar Node bisa menjalankan unit test.",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Buat test sementara untuk membuktikan runner bekerja**

Isi `tests/kompetensi.test.js`:

```js
// tests/kompetensi.test.js
// Unit test logika murni kompetensi. Jalankan: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOOM_LEVELS } from '../shared/constants.js';

test('BLOOM_LEVELS memuat enam level C1..C6 berurutan', () => {
  assert.equal(BLOOM_LEVELS.length, 6);
  assert.deepEqual(
    BLOOM_LEVELS.map(b => b.level),
    ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']
  );
});
```

- [ ] **Step 3: Jalankan test**

Jalankan: `npm test`
Diharapkan: PASS, 1 test lulus. Ini sekaligus membuktikan `shared/constants.js` bisa diimpor Node tanpa menyeret Firestore.

- [ ] **Step 4: Tambahkan `node_modules` ke `.gitignore`**

Tambahkan baris berikut di akhir `.gitignore` (pencegahan — proyek ini tidak memakai npm install, tapi seseorang bisa saja menjalankannya kelak):

```
node_modules/
```

- [ ] **Step 5: Commit**

```bash
git add package.json tests/kompetensi.test.js .gitignore
git commit -m "test: siapkan node --test untuk logika murni

package.json hanya menyatakan type:module agar Node bisa membaca ESM di
shared/. Tanpa dependencies — proyek tetap tanpa bundler."
```

---

### Task 2: Pengaman nilai bimtek selesai

Task ini harus mendarat sebelum task mana pun mengubah `bank_soal.bloomLevel`. Nilai lama sudah beku secara struktural karena bobot ikut tersimpan di `exam_results.detail[soalId].bobot` (`scorer.js:49-55`), tapi tombol Sinkronisasi bisa menulis ulang semuanya.

**Files:**
- Modify: `admin/js/modules/bimtek/sub-prepost.js:15` (tanda tangan fungsi), `:102-105` (tombol), `:182` (handler)

**Interfaces:**
- Consumes: `BIMTEK_STATUS` dari `shared/constants.js:65`
- Produces: —

- [ ] **Step 1: Impor konstanta status**

Ubah baris 13 `sub-prepost.js`:

```js
import { COL, BIMTEK_STATUS } from '../../../../shared/constants.js';
```

- [ ] **Step 2: Nonaktifkan tombol untuk bimtek selesai**

Ganti blok tombol di `:102-105`:

```js
                <button class="btn-sync-exam shrink-0 px-4 py-2 ${bimtek?.status === BIMTEK_STATUS.SELESAI
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-500 text-white'} text-sm rounded-lg transition-colors"
                  data-exam-id="${exam.id}" data-exam-judul="${_esc(exam.judul)}"
                  ${bimtek?.status === BIMTEK_STATUS.SELESAI ? 'data-terkunci="1"' : ''}
                  title="${bimtek?.status === BIMTEK_STATUS.SELESAI
                    ? 'Bimtek sudah selesai — nilai dikunci agar tidak berubah'
                    : ''}">
                  Sinkronisasi
                </button>
```

- [ ] **Step 3: Minta konfirmasi tegas saat tombol terkunci ditekan**

Di dalam handler `.btn-sync-exam` (`:169-175`), sisipkan pengecekan sebelum memanggil `_syncExam`:

```js
    container.querySelectorAll('.btn-sync-exam').forEach(btn => {
      btn.addEventListener('click', async () => {
        const examId    = btn.dataset.examId;
        const examJudul = btn.dataset.examJudul;

        // Bimtek selesai: nilai sudah dilaporkan dan sertifikat mungkin sudah
        // terbit. Sinkronisasi ulang akan menghitung ulang skor memakai bobot
        // Bloom terkini, yang bisa berbeda dari saat nilai pertama ditetapkan.
        if (btn.dataset.terkunci === '1') {
          const lanjut = await confirmDialog({
            title: 'Bimtek ini sudah selesai',
            message: `Nilai bimtek yang sudah selesai dikunci agar tidak berubah. `
              + `Sinkronisasi ulang akan MENIMPA nilai pre/post seluruh peserta `
              + `memakai bobot Bloom yang berlaku sekarang — nilai bisa bergeser `
              + `dari yang sudah tercetak di sertifikat dan laporan.\n\n`
              + `Lanjutkan menimpa nilai "${examJudul}"?`
          });
          if (!lanjut) return;
          await logAudit({
            action:     'force_resync_completed_bimtek',
            entityType: 'exam',
            entityId:   examId,
            metadata:   { bimtekId, examJudul }
          });
        }

        await _syncExam(bimtekId, examId, examJudul, btn, container, bimtek, onSyncComplete);
      });
    });
```

- [ ] **Step 4: Impor `logAudit`**

Tambahkan di blok impor atas `sub-prepost.js`:

```js
import { logAudit } from '../../../../shared/logger.js';
```

- [ ] **Step 5: Verifikasi di browser**

1. Jalankan `python -m http.server 8080`, buka `http://localhost:8080/admin/`
2. Buka bimtek berstatus **aktif** → tab Penilaian → sub-tab Pre/Post Test.
   Diharapkan: tombol Sinkronisasi hijau, menekannya memunculkan dialog biasa.
3. Buka bimtek berstatus **selesai** → tab yang sama.
   Diharapkan: tombol abu-abu, kursor `not-allowed`, tooltip menyebut nilai dikunci. Menekannya memunculkan dialog peringatan penimpaan, dan menekan Batal tidak mengubah apa pun.

- [ ] **Step 6: Commit**

```bash
git add admin/js/modules/bimtek/sub-prepost.js
git commit -m "feat: kunci sinkronisasi nilai untuk bimtek berstatus selesai

Sinkronisasi menghitung ulang skor memakai bobot Bloom terkini. Untuk
bimtek yang sertifikatnya sudah terbit, itu menggeser nilai yang sudah
dilaporkan. Tombol dikunci, buka paksa tercatat di audit log."
```

---

### Task 3: Wajibkan `bloomLevel`

**Files:**
- Modify: `admin/js/modules/bank-soal/api.js:315-330` (`_validateSoal`)
- Modify: `admin/js/modules/bank-soal/form.js:65-74` (label field)
- Verifikasi saja (tanpa perubahan): `admin/js/modules/bank-soal/import.js`

**Interfaces:**
- Consumes: `BLOOM_LEVELS` dari `shared/constants.js:36`
- Produces: jaminan bahwa soal baru selalu berlevel, sehingga generator Task 11 tidak perlu menangani level kosong.

- [ ] **Step 1: Tambahkan aturan pada `_validateSoal`**

Di `bank-soal/api.js`, ubah `_validateSoal` (`:315`). Tambahkan setelah pemeriksaan `bidangId`:

```js
function _validateSoal(data) {
  const errors = [];
  if (!data.pertanyaan?.trim())           errors.push('Pertanyaan wajib diisi.');
  if (!data.bidangId)                     errors.push('Bidang wajib dipilih.');
  // Level Bloom menentukan bobot soal dan seluruh pemetaan kognitif. Soal
  // tanpa level diam-diam dihitung berbobot 1 (setara C1) oleh scorer, yang
  // membuat soal analisis dinilai seringan soal hafalan.
  if (!data.bloomLevel)                   errors.push('Level Bloom wajib dipilih.');
  else if (!BLOOM_MAP[data.bloomLevel])   errors.push(`Level Bloom '${data.bloomLevel}' tidak dikenal.`);
  if (!data.kunci)                        errors.push('Kunci jawaban wajib dipilih.');
  if (!data.opsi || data.opsi.length < 2) errors.push('Minimal 2 opsi jawaban.');
```

`BLOOM_MAP` sudah diimpor di `api.js:14` — tidak perlu impor baru.

- [ ] **Step 2: Tandai field wajib di form**

Di `bank-soal/form.js:65-67`, ubah label:

```js
          <label class="block text-xs font-medium text-gray-400 mb-1.5">
            Level Bloom <span class="text-red-400">*</span>
          </label>
```

Dan tambahkan atribut `required` pada `<select>` di `:68`:

```js
          <select name="bloomLevel" class="form-select" required>
```

- [ ] **Step 3: Pastikan import massal ikut menolak, tanpa mengubah kodenya**

`import.js` tidak perlu diubah. Alurnya sudah benar: `_mapRowToSoal()` (`:241`) menormalkan nilai kolom lewat `BLOOM_ALIAS` dan mengembalikan string kosong bila tidak dikenali, lalu `_doImport()` (`:194-234`) memanggil `createSoal()` per baris di dalam `try/catch` dan mengumpulkan galatnya ke daftar yang ditampilkan di `:234`.

Karena `createSoal()` memanggil `_validateSoal()`, aturan baru dari Step 1 otomatis berlaku untuk import. Baris tanpa level akan gagal dengan "Level Bloom wajib dipilih.", baris dengan nilai asing gagal dengan "Level Bloom 'X' tidak dikenal." — keduanya muncul di daftar galat beserta nomor barisnya, dan baris lain tetap terimpor.

Yang perlu dilakukan hanyalah membuktikannya di Step 4. Jangan menambah pemeriksaan ganda di `import.js` — itu akan menduplikasi aturan yang sudah punya satu sumber di `_validateSoal`.

- [ ] **Step 4: Verifikasi di browser**

1. Bank Soal → Tambah Soal. Isi semua field **kecuali** Level Bloom, tekan Simpan.
   Diharapkan: tersimpan gagal dengan pesan "Level Bloom wajib dipilih."
2. Isi Level Bloom, simpan lagi.
   Diharapkan: tersimpan normal.
3. Bank Soal → Import Excel dengan satu baris yang kolom Level Bloom-nya kosong.
   Diharapkan: baris itu dilaporkan sebagai galat dengan nomor barisnya, baris lain tetap terimpor.

- [ ] **Step 5: Commit**

```bash
git add admin/js/modules/bank-soal/api.js admin/js/modules/bank-soal/form.js
git commit -m "feat: wajibkan level Bloom pada soal baru

Soal tanpa level dihitung berbobot 1 oleh scorer, setara C1. Form dan
import kini menolaknya alih-alih mengisi default secara senyap."
```

---

### Task 4: Matriks stok UK × Bloom

**Files:**
- Create: `admin/js/modules/bank-soal/stok.js`
- Modify: `admin/js/modules/bank-soal/api.js` (tambah `buildStokMatrix`)
- Modify: `admin/js/modules/bank-soal/index.js:35-45` (tombol)

**Interfaces:**
- Consumes: `listSoal` dari `bank-soal/api.js:18`
- Produces: `buildStokMatrix()` → `{ rows, totalSoal, selKosong, selTipis, selSiap }`; dipakai Task 9 untuk kolom Stok pada form SKL.

- [ ] **Step 1: Tambahkan `buildStokMatrix` di `bank-soal/api.js`**

Sisipkan sebelum bagian `// ─── Internal ───` (`:313`):

```js
// ─── Stok per UK x Bloom ──────────────────────────────────────

/**
 * Hitung sebaran soal aktif per Unit Kompetensi per level Bloom.
 * Dipakai matriks stok di Bank Soal dan kolom Stok di form SKL bimtek.
 * @returns {{ rows: object[], totalSoal: number, selKosong: number,
 *             selTipis: number, selSiap: number }}
 *   rows: [{ ukKode, ukNama, lv: {C1..C6}, total }] urut total menurun
 */
export async function buildStokMatrix() {
  const snap = await getDocs(query(
    collection(db, COL.BANK_SOAL),
    where('deleted', '==', false),
    where('active',  '==', true)
  ));

  const LEVELS = BLOOM_LEVELS.map(b => b.level);
  const map = new Map();

  snapToArray(snap).forEach(s => {
    const kode = (s.unitKompetensi || '').toUpperCase().trim();
    if (!kode) return; // soal tanpa UK tidak masuk matriks
    if (!map.has(kode)) {
      map.set(kode, {
        ukKode: kode,
        ukNama: s.ekNama || kode,
        lv:     Object.fromEntries(LEVELS.map(l => [l, 0])),
        tanpaLevel: 0,
        total:  0,
      });
    }
    const e = map.get(kode);
    e.total++;
    if (LEVELS.includes(s.bloomLevel)) e.lv[s.bloomLevel]++;
    else e.tanpaLevel++;
    if (!e.ukNama && s.ekNama) e.ukNama = s.ekNama;
  });

  const rows = [...map.values()].sort((a, b) => b.total - a.total);

  let selKosong = 0, selTipis = 0, selSiap = 0;
  rows.forEach(r => LEVELS.forEach(l => {
    const n = r.lv[l];
    if (n === 0)      selKosong++;
    else if (n === 1) selTipis++;
    else              selSiap++;
  }));

  return {
    rows,
    totalSoal: rows.reduce((a, r) => a + r.total, 0),
    selKosong, selTipis, selSiap,
  };
}
```

Tambahkan `BLOOM_LEVELS` pada impor `constants` di `:14`:

```js
import { COL, BLOOM_MAP, BLOOM_LEVELS } from '../../../../shared/constants.js';
```

- [ ] **Step 2: Buat `admin/js/modules/bank-soal/stok.js`**

```js
// admin/js/modules/bank-soal/stok.js
// Matriks stok soal per Unit Kompetensi per level Bloom.
// Menjawab: untuk UK ini, level kognitif mana yang sudah bisa diuji?

import { buildStokMatrix } from './api.js';
import { BLOOM_LEVELS } from '../../../../shared/constants.js';

export async function renderStokMatrix(container) {
  container.innerHTML = `<div class="flex justify-center py-10">
    <div class="w-5 h-5 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
  </div>`;

  let data;
  try {
    data = await buildStokMatrix();
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-400 p-4">Gagal memuat: ${_esc(err.message)}</p>`;
    return;
  }

  const LEVELS = BLOOM_LEVELS.map(b => b.level);

  const head = LEVELS.map(l =>
    `<th class="w-12 text-center text-xs font-semibold text-gray-400">${l}</th>`).join('');

  const rows = data.rows.map((r, i) => `
    <tr>
      <td class="text-center text-gray-600 w-8 text-xs">${i + 1}</td>
      <td class="font-mono text-xs text-[#2dd4bf] whitespace-nowrap">${_esc(r.ukKode)}</td>
      <td class="text-xs text-gray-300">${_esc(r.ukNama)}</td>
      ${LEVELS.map(l => `<td class="text-center text-xs ${_selClass(r.lv[l])}">${r.lv[l] || '·'}</td>`).join('')}
      <td class="text-center text-xs text-yellow-500">${r.tanpaLevel || '·'}</td>
      <td class="text-center text-xs text-gray-300 font-medium">${r.total}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-white mb-1">Stok Soal per Kompetensi &amp; Level Kognitif</h3>
        <p class="text-xs text-gray-500 mb-3">
          Satu sel = satu kombinasi UK &times; level. Sel kosong berarti level itu belum bisa diujikan
          untuk UK tersebut, jadi target SKL di level itu tidak akan pernah terbukti.
        </p>
        <div class="flex flex-wrap gap-4 text-xs">
          <span class="text-gray-400">Total soal aktif ber-UK: <strong class="text-gray-200">${data.totalSoal}</strong></span>
          <span class="text-gray-600">Sel kosong: <strong>${data.selKosong}</strong></span>
          <span class="text-yellow-400">Sel tipis (1 soal): <strong>${data.selTipis}</strong></span>
          <span class="text-teal-400">Sel siap (&ge;2 soal): <strong>${data.selSiap}</strong></span>
        </div>
      </div>

      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table class="btam-table min-w-[760px]">
          <thead>
            <tr>
              <th class="w-8"></th>
              <th class="w-40">Kode UK</th>
              <th>Nama Unit Kompetensi</th>
              ${head}
              <th class="w-12 text-center text-xs" title="Soal yang belum punya level Bloom">?</th>
              <th class="w-12 text-center text-xs">Tot</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${LEVELS.length + 5}" class="text-center py-10 text-gray-500 text-xs">Belum ada soal ber-UK</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

// Sel dibedakan karena konsekuensinya berbeda: 0 tidak bisa diuji sama
// sekali, 1 bisa diuji tapi kesimpulannya bersandar pada satu jawaban.
function _selClass(n) {
  if (n === 0) return 'text-gray-700';
  if (n === 1) return 'text-yellow-400';
  return 'text-teal-400';
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 3: Pasang tombol di Bank Soal**

Di `bank-soal/index.js`, tambahkan tombol sebelum `#btn-export` (`:35`):

```js
          <button id="btn-stok" class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-[#1e3a3f] hover:bg-[#12181c] transition-colors">
            Stok UK × Bloom
          </button>
```

Impor dan pasang handler. Tambahkan impor:

```js
import { renderStokMatrix } from './stok.js';
```

Tambahkan pada blok pemasangan event (dekat handler `#btn-export`):

```js
  document.getElementById('btn-stok')?.addEventListener('click', () => {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="max-w-full">
        <div class="flex items-center gap-3 mb-6">
          <button id="btn-stok-kembali" class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-[#1e3a3f] hover:bg-[#12181c] transition-colors">← Kembali</button>
          <h1 class="text-lg font-bold text-white">Stok UK × Bloom</h1>
        </div>
        <div id="stok-pane"></div>
      </div>`;
    document.getElementById('btn-stok-kembali').addEventListener('click', () => renderBankSoalList());
    renderStokMatrix(document.getElementById('stok-pane'));
  });
```

- [ ] **Step 4: Verifikasi di browser**

1. Bank Soal → tombol **Stok UK × Bloom**.
   Diharapkan: tabel 56 baris UK, kolom C1–C6, kolom `?` untuk soal tanpa level, kolom Tot.
2. Periksa ringkasan di atas tabel.
   Diharapkan sebelum Task 6 dijalankan: sel kosong 274, sel tipis 44, sel siap 18 — cocok dengan audit di spec §2. Baris teratas `F.42AMI00.006.1` dengan total 31.
3. Tekan **← Kembali**.
   Diharapkan: kembali ke daftar bank soal, filter dan halaman kembali ke keadaan awal.

- [ ] **Step 5: Commit**

```bash
git add admin/js/modules/bank-soal/stok.js admin/js/modules/bank-soal/api.js admin/js/modules/bank-soal/index.js
git commit -m "feat: matriks stok soal per UK x level Bloom

Menjadikan hubungan kompetensi-kognitif kasatmata, dan jadi rujukan saat
menyusun SKL: target di level yang selnya kosong tidak akan terbukti."
```

---

### Task 5: Koleksi `bloom_suggestions`

**Files:**
- Modify: `firestore.rules` (setelah blok `bank_soal_answers`, `:117`)
- Modify: `admin/js/modules/bank-soal/api.js` (tambah tiga fungsi)

**Interfaces:**
- Consumes: `COL` dari `shared/constants.js`
- Produces: `listBloomSuggestions()`, `applyBloomSuggestions(keputusan)`, `countPendingBloom()`. Dipakai Task 6 (pengisian) dan Task 7 (layar peninjauan).

- [ ] **Step 1: Tambahkan nama koleksi ke `shared/constants.js`**

Cari objek `COL` dan tambahkan:

```js
  BLOOM_SUGGESTIONS: 'bloom_suggestions',
```

- [ ] **Step 2: Tambahkan aturan Firestore**

Sisipkan setelah blok `bank_soal_answers` (`firestore.rules:117`):

```
    // Usulan level Bloom untuk soal lama yang belum berlevel.
    // Admin saja — exam app tidak pernah menyentuhnya. Koleksi sementara,
    // boleh dihapus setelah seluruh usulan ditinjau.
    match /bloom_suggestions/{soalId} {
      allow read, write: if canWrite();
    }
```

- [ ] **Step 3: Tambahkan API di `bank-soal/api.js`**

Sisipkan setelah `buildStokMatrix`:

```js
// ─── Usulan level Bloom (backfill) ────────────────────────────

/** Ambil usulan yang masih menunggu peninjauan, digabung dengan isi soalnya. */
export async function listBloomSuggestions() {
  const snap = await getDocs(query(
    collection(db, COL.BLOOM_SUGGESTIONS),
    where('status', '==', 'pending')
  ));
  const usulan = snapToArray(snap);
  if (!usulan.length) return [];

  // Ambil soal per potongan 30 — batas operator 'in' Firestore
  const soalMap = {};
  const ids = usulan.map(u => u.soalId);
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const s = await getDocs(query(
      collection(db, COL.BANK_SOAL),
      where('soalId', 'in', chunk)
    ));
    snapToArray(s).forEach(d => { soalMap[d.soalId] = d; });
  }

  return usulan
    .filter(u => soalMap[u.soalId])
    .map(u => ({ ...u, soal: soalMap[u.soalId] }));
}

export async function countPendingBloom() {
  const snap = await getCountFromServer(query(
    collection(db, COL.BLOOM_SUGGESTIONS),
    where('status', '==', 'pending')
  ));
  return snap.data().count;
}

/**
 * Terapkan keputusan admin: tulis bloomLevel + bobot ke bank_soal dan
 * tandai usulannya selesai.
 * @param {{soalId: string, level: string, status: 'disetujui'|'diubah'|'ditolak'}[]} keputusan
 * @returns {{ diterapkan: number, ditolak: number }}
 */
export async function applyBloomSuggestions(keputusan) {
  const email = auth.currentUser?.email ?? null;
  let diterapkan = 0, ditolak = 0;

  const CHUNK = 200; // 2 tulisan per keputusan, aman di bawah batas 500
  for (let i = 0; i < keputusan.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const k of keputusan.slice(i, i + CHUNK)) {
      if (k.status === 'ditolak') {
        ditolak++;
      } else {
        if (!BLOOM_MAP[k.level]) throw new Error(`Level '${k.level}' tidak dikenal untuk soal ${k.soalId}.`);
        batch.update(doc(db, COL.BANK_SOAL, k.soalId), {
          bloomLevel: k.level,
          bobot:      _hitungBobot(k.level),
          updatedAt:  serverTimestamp(),
        });
        diterapkan++;
      }
      batch.update(doc(db, COL.BLOOM_SUGGESTIONS, k.soalId), {
        status:       k.status,
        levelDipakai: k.status === 'ditolak' ? null : k.level,
        ditinjauPada: serverTimestamp(),
        ditinjauOleh: email,
      });
    }
    await batch.commit();
  }

  await logAudit({
    action: 'apply_bloom_suggestions', entityType: 'bank_soal', entityId: 'batch',
    metadata: { diterapkan, ditolak }
  });

  return { diterapkan, ditolak };
}
```

- [ ] **Step 4: Deploy rules**

Jalankan: `firebase deploy --only firestore:rules`
Diharapkan: `Deploy complete!`

- [ ] **Step 5: Verifikasi rules terpasang**

Buka Firebase Console → Firestore → Rules, cari blok `bloom_suggestions`.
Diharapkan: blok ada dan berbunyi `allow read, write: if canWrite();`

- [ ] **Step 6: Commit**

```bash
git add firestore.rules shared/constants.js admin/js/modules/bank-soal/api.js
git commit -m "feat: koleksi bloom_suggestions untuk backfill level Bloom

Admin-only. Menyimpan usulan level beserta alasannya sampai ditinjau,
lalu menulis bloomLevel + bobot ke bank_soal secara batch."
```

---

### Task 6: Klasifikasi 154 soal

Task ini dikerjakan oleh Claude di dalam sesi, bukan oleh kode yang dijalankan berulang. Alasannya di spec §5.1: proyek tidak punya backend, dan membangun Cloud Functions plus akun API berbayar untuk backfill sekali jalan tidak sebanding.

**Files:**
- Create: `<scratchpad>/tarik-soal-tanpa-bloom.mjs` (sekali pakai, jangan di-commit)
- Create: `<scratchpad>/tulis-usulan-bloom.mjs` (sekali pakai, jangan di-commit)

**Interfaces:**
- Consumes: koleksi `bloom_suggestions` dan aturannya dari Task 5
- Produces: 154 dokumen `bloom_suggestions` berstatus `pending`, dibaca Task 7

- [ ] **Step 1: Tarik soal tanpa level**

Tulis skrip di scratchpad yang mengambil token lewat `execFileSync('gcloud', ['auth','print-access-token'], { shell: process.platform === 'win32' })` — jangan pernah mencetak tokennya — lalu `POST` ke `https://firestore.googleapis.com/v1/projects/bimtek-27fe5/databases/(default)/documents:runQuery` dengan header `Authorization: Bearer <token>` dan `x-goog-user-project: bimtek-27fe5`.

`structuredQuery`: `from` = `bank_soal`, `where` = `deleted == false`, `select` = `soalId`, `pertanyaan`, `opsi`, `unitKompetensi`, `ekNama`, `bidangId`, `bloomLevel`.

Saring di sisi klien untuk `bloomLevel` kosong, simpan ke JSON di scratchpad.

Jalankan skripnya.
Diharapkan: 154 soal terambil. Jika jumlahnya berbeda, hentikan dan laporkan ke pemilik proyek sebelum lanjut — selisih berarti data berubah sejak audit 3 September.

- [ ] **Step 2: Klasifikasikan tiap soal**

Baca tiap soal — pertanyaan berikut seluruh opsi jawabannya — dan tetapkan level berdasarkan **tuntutan kognitif untuk menjawabnya**, bukan kata kerja pada judul UK:

| Level | Tuntutan | Ciri |
|---|---|---|
| C1 Mengingat | memanggil kembali fakta | definisi, kepanjangan singkatan, angka baku |
| C2 Memahami | menjelaskan makna | menafsirkan, membedakan dua konsep, memberi contoh |
| C3 Menerapkan | memakai prosedur pada situasi | hitungan dengan rumus baku, memilih langkah untuk kasus |
| C4 Menganalisis | menguraikan menjadi bagian & hubungan | mencari penyebab, membandingkan beberapa faktor |
| C5 Mengevaluasi | menimbang dan memutuskan berdasar kriteria | menilai kelayakan, memilih dari beberapa opsi valid |
| C6 Mencipta | menyusun sesuatu yang baru | merancang, merumuskan usulan |

Catatan penting: seri `BTAM-SAKEP-01..06` (25 soal) dan `E.360011.019.01` (25 soal) seluruhnya belum berlevel. Nama UK `E.360011.019.01` adalah *Mengevaluasi unit produksi*, tapi **jangan** menyimpulkan seluruh soalnya C5 dari nama itu — banyak soal di UK ber-nama evaluatif sebenarnya menanyakan definisi. Nilai per butir.

Tulis hasilnya sebagai JSON: `[{ soalId, usulLevel, alasan }]`, dengan `alasan` satu kalimat pendek yang menyebut apa yang dituntut soal itu.

- [ ] **Step 3: Tulis ke `bloom_suggestions`**

Skrip kedua mengirim `POST` ke `.../documents:batchWrite` dengan token yang sama. Tiap dokumen:

```
name: projects/bimtek-27fe5/databases/(default)/documents/bloom_suggestions/<soalId>
fields: {
  soalId:    { stringValue: <soalId> },
  usulLevel: { stringValue: 'C3' },
  alasan:    { stringValue: '...' },
  status:    { stringValue: 'pending' },
  dibuatPada:{ timestampValue: <ISO now> }
}
```

Kirim per potongan 200 dokumen. Jalankan skripnya.
Diharapkan: 154 dokumen tertulis, tanpa galat.

- [ ] **Step 4: Verifikasi jumlah**

Buka Firebase Console → Firestore → koleksi `bloom_suggestions`.
Diharapkan: 154 dokumen, semuanya `status: "pending"`, tiap dokumen punya `usulLevel` berisi C1–C6 dan `alasan` tidak kosong.

- [ ] **Step 5: Hapus skrip sekali pakai**

Hapus kedua berkas dari scratchpad. Jangan di-commit ke repo — keduanya memuat pola pengambilan token dan tidak berguna lagi setelah dipakai.

- [ ] **Step 6: Tidak ada commit**

Task ini hanya mengubah data Firestore, bukan kode. Lewati commit.

---

### Task 7: Layar peninjauan usulan Bloom

**Files:**
- Create: `admin/js/modules/bank-soal/bloom-review.js`
- Modify: `admin/js/modules/bank-soal/index.js` (tombol dengan lencana jumlah)

**Interfaces:**
- Consumes: `listBloomSuggestions()`, `applyBloomSuggestions()`, `countPendingBloom()` dari Task 5
- Produces: —

- [ ] **Step 1: Buat `bloom-review.js`**

```js
// admin/js/modules/bank-soal/bloom-review.js
// Peninjauan usulan level Bloom untuk soal lama yang belum berlevel.
// Keputusan disimpan di memori sampai admin menekan Simpan, supaya
// meninjau 150+ butir tidak menghasilkan 150 tulisan terpisah.

import { listBloomSuggestions, applyBloomSuggestions } from './api.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { BLOOM_LEVELS } from '../../../../shared/constants.js';

export async function renderBloomReview(container, onSelesai) {
  container.innerHTML = `<div class="flex justify-center py-10">
    <div class="w-5 h-5 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
  </div>`;

  let usulan;
  try {
    usulan = await listBloomSuggestions();
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-400 p-4">Gagal memuat: ${_esc(err.message)}</p>`;
    return;
  }

  if (!usulan.length) {
    container.innerHTML = `<div class="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
      <p class="text-gray-400 text-sm font-medium">Tidak ada usulan menunggu</p>
      <p class="text-gray-600 text-xs mt-1">Semua soal sudah punya level Bloom.</p>
    </div>`;
    return;
  }

  // soalId → { level, status }. Awalnya semua mengikuti usulan, belum diputus.
  const keputusan = new Map(
    usulan.map(u => [u.soalId, { level: u.usulLevel, status: null }])
  );

  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <h3 class="text-sm font-semibold text-white mb-1">Usulan Level Bloom</h3>
          <p class="text-xs text-gray-500">
            Tiap usulan disertai alasannya. Ubah bila tidak setuju, atau tolak untuk
            membiarkan soal tanpa level. Perubahan baru tersimpan saat Anda menekan Simpan.
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span id="bloom-progres" class="text-xs text-gray-500"></span>
          <button id="btn-setujui-sisa" class="px-3 py-2 rounded-lg text-xs text-gray-300 border border-[#1e3a3f] hover:bg-[#12181c] transition-colors">
            Setujui semua sisa
          </button>
          <button id="btn-simpan-bloom" class="px-4 py-2 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
            Simpan
          </button>
        </div>
      </div>
      <div id="bloom-list" class="space-y-3"></div>
    </div>`;

  const listEl = container.querySelector('#bloom-list');
  listEl.innerHTML = usulan.map(u => _kartu(u)).join('');

  function perbaruiProgres() {
    const diputus = [...keputusan.values()].filter(k => k.status).length;
    container.querySelector('#bloom-progres').textContent =
      `${diputus} dari ${usulan.length} diputuskan`;
  }
  perbaruiProgres();

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-aksi]');
    if (!btn) return;
    const soalId = btn.dataset.soalId;
    const k = keputusan.get(soalId);
    if (!k) return;

    if (btn.dataset.aksi === 'setuju') k.status = 'disetujui';
    if (btn.dataset.aksi === 'tolak')  k.status = 'ditolak';

    _tandaiKartu(listEl, soalId, k);
    perbaruiProgres();
  });

  listEl.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-soal-id]');
    if (!sel) return;
    const k = keputusan.get(sel.dataset.soalId);
    if (!k) return;
    k.level  = sel.value;
    k.status = 'diubah';
    _tandaiKartu(listEl, sel.dataset.soalId, k);
    perbaruiProgres();
  });

  container.querySelector('#btn-setujui-sisa').addEventListener('click', () => {
    keputusan.forEach((k, soalId) => {
      if (!k.status) { k.status = 'disetujui'; _tandaiKartu(listEl, soalId, k); }
    });
    perbaruiProgres();
  });

  container.querySelector('#btn-simpan-bloom').addEventListener('click', async () => {
    const siap = [...keputusan.entries()]
      .filter(([, k]) => k.status)
      .map(([soalId, k]) => ({ soalId, level: k.level, status: k.status }));

    if (!siap.length) { showToast('Belum ada usulan yang diputuskan.', 'warning'); return; }

    const terap = siap.filter(s => s.status !== 'ditolak').length;
    const ok = await confirmDialog({
      title: 'Simpan keputusan level Bloom',
      message: `${terap} soal akan diberi level Bloom, ${siap.length - terap} ditolak. `
        + `Ini mengubah bobot soal tersebut pada penilaian berikutnya. `
        + `Nilai bimtek yang sudah selesai tidak terpengaruh.`
    });
    if (!ok) return;

    const btn = container.querySelector('#btn-simpan-bloom');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    try {
      const { diterapkan, ditolak } = await applyBloomSuggestions(siap);
      showToast(`${diterapkan} soal diperbarui, ${ditolak} ditolak.`, 'ok');
      if (onSelesai) onSelesai();
      else renderBloomReview(container);
    } catch (err) {
      showToast(`Gagal menyimpan: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  });
}

function _kartu(u) {
  const opsi = (u.soal.opsi ?? [])
    .map(o => `<li class="text-gray-500">${_esc(o.id)}. ${_esc(o.text)}</li>`).join('');

  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4" data-kartu="${_esc(u.soalId)}">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm text-gray-200 mb-2">${_esc(u.soal.pertanyaan)}</p>
          <ul class="text-xs space-y-0.5 mb-2">${opsi}</ul>
          <p class="text-xs text-gray-600">
            <span class="font-mono text-[#2dd4bf]">${_esc(u.soal.unitKompetensi || '—')}</span>
            ${u.soal.ekNama ? ` · ${_esc(u.soal.ekNama)}` : ''}
          </p>
        </div>
        <div class="shrink-0 w-56 space-y-2">
          <select data-soal-id="${_esc(u.soalId)}" class="form-select text-xs w-full">
            ${BLOOM_LEVELS.map(b =>
              `<option value="${b.level}" ${b.level === u.usulLevel ? 'selected' : ''}>${b.level} — ${b.nama}</option>`
            ).join('')}
          </select>
          <p class="text-xs text-gray-500 italic">${_esc(u.alasan ?? '')}</p>
          <div class="flex gap-2">
            <button data-aksi="setuju" data-soal-id="${_esc(u.soalId)}"
              class="flex-1 px-2 py-1.5 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">Setuju</button>
            <button data-aksi="tolak" data-soal-id="${_esc(u.soalId)}"
              class="px-2 py-1.5 rounded-lg text-xs text-gray-400 border border-[#1e3a3f] hover:bg-[#12181c] transition-colors">Tolak</button>
          </div>
          <p class="text-xs" data-status="${_esc(u.soalId)}"></p>
        </div>
      </div>
    </div>`;
}

function _tandaiKartu(listEl, soalId, k) {
  const el = listEl.querySelector(`[data-status="${CSS.escape(soalId)}"]`);
  if (!el) return;
  const teks = { disetujui: '✓ disetujui', diubah: `✓ diubah ke ${k.level}`, ditolak: '✗ ditolak' };
  el.textContent = teks[k.status] ?? '';
  el.className = `text-xs ${k.status === 'ditolak' ? 'text-gray-500' : 'text-teal-400'}`;
  listEl.querySelector(`[data-kartu="${CSS.escape(soalId)}"]`)
    ?.classList.toggle('opacity-50', k.status === 'ditolak');
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Pasang tombol berlencana di Bank Soal**

Di `bank-soal/index.js`, tambahkan impor:

```js
import { renderBloomReview } from './bloom-review.js';
import { countPendingBloom } from './api.js';
```

Tambahkan tombol setelah `#btn-stok`:

```js
          <button id="btn-bloom-review" class="hidden px-3 py-2 rounded-lg text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-700/40 hover:bg-yellow-900/50 transition-colors">
            Usulan Level Bloom <span id="bloom-badge" class="ml-1 font-semibold"></span>
          </button>
```

Pasang handler dan pemuatan lencana:

```js
  countPendingBloom().then(n => {
    if (!n) return;
    const b = document.getElementById('btn-bloom-review');
    if (!b) return;
    b.classList.remove('hidden');
    document.getElementById('bloom-badge').textContent = `(${n})`;
  }).catch(console.error);

  document.getElementById('btn-bloom-review')?.addEventListener('click', () => {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="max-w-full">
        <div class="flex items-center gap-3 mb-6">
          <button id="btn-bloom-kembali" class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-[#1e3a3f] hover:bg-[#12181c] transition-colors">← Kembali</button>
          <h1 class="text-lg font-bold text-white">Usulan Level Bloom</h1>
        </div>
        <div id="bloom-pane"></div>
      </div>`;
    document.getElementById('btn-bloom-kembali').addEventListener('click', () => renderBankSoalList());
    renderBloomReview(document.getElementById('bloom-pane'), () => renderBankSoalList());
  });
```

- [ ] **Step 3: Verifikasi di browser**

1. Buka Bank Soal.
   Diharapkan: tombol kuning **Usulan Level Bloom (154)** muncul.
2. Tekan tombol itu.
   Diharapkan: 154 kartu, tiap kartu memuat pertanyaan, opsi jawaban, kode UK, dropdown level terisi usulan, dan alasan.
3. Tekan **Setuju** pada satu kartu.
   Diharapkan: muncul "✓ disetujui", penghitung di atas naik jadi "1 dari 154 diputuskan".
4. Ubah dropdown pada kartu lain.
   Diharapkan: muncul "✓ diubah ke Cx", penghitung naik jadi 2.
5. Tekan **Tolak** pada kartu ketiga.
   Diharapkan: kartu meredup, muncul "✗ ditolak".
6. Tekan **Simpan** → konfirmasi.
   Diharapkan: toast menyebut jumlah yang diperbarui dan ditolak; kembali ke daftar bank soal.
7. Buka kembali **Stok UK × Bloom**.
   Diharapkan: kolom `?` berkurang sebanyak soal yang disetujui, dan angka pada kolom C1–C6 bertambah.

- [ ] **Step 4: Commit**

```bash
git add admin/js/modules/bank-soal/bloom-review.js admin/js/modules/bank-soal/index.js
git commit -m "feat: layar peninjauan usulan level Bloom

Keputusan ditahan di memori sampai Simpan, supaya meninjau 154 butir
tidak menghasilkan 154 tulisan Firestore terpisah."
```

---

## FASE 2 — Standar Kompetensi Lulusan

### Task 8: Simpan `bimtek.skl`

**Files:**
- Modify: `admin/js/modules/bimtek/api.js:119` (create), `:146` (daftar putih update)

**Interfaces:**
- Consumes: —
- Produces: field `bimtek.skl` bertipe `[{ ukId, ukKode, ukNama, targetBloom, ambang, jumlahSoal }]`, dibaca Task 9, 11, 14, 15.

- [ ] **Step 1: Simpan `skl` saat bimtek dibuat**

Di `bimtek/api.js`, setelah baris `ukIds: data.ukIds || [],` (`:119`), tambahkan:

```js
    skl: data.skl || [],
```

- [ ] **Step 2: Izinkan `skl` disunting**

Di `:146`, tambahkan `'skl'` ke daftar putih field yang boleh diubah:

```js
    'periode', 'lokasi', 'kapasitas', 'pengajarIds', 'ukIds', 'skl', 'kkm', 'weights',
```

Tanpa langkah ini SKL tersimpan saat bimtek dibuat tapi hilang diam-diam setiap kali bimtek disunting — jenis kegagalan yang tidak memunculkan galat apa pun.

- [ ] **Step 3: Verifikasi lewat konsol browser**

Buka `http://localhost:8080/admin/`, masuk sebagai admin, buka Console lalu jalankan:

```js
const { updateBimtek, getBimtek } = await import('./js/modules/bimtek/api.js');
const id = '<id bimtek uji coba>';
await updateBimtek(id, { skl: [{ ukId:'uji', ukKode:'UJI', ukNama:'Uji', targetBloom:'C3', ambang:70, jumlahSoal:8 }] });
console.log((await getBimtek(id)).skl);
```

Diharapkan: array berisi satu objek dengan `targetBloom: 'C3'`. Jika keluar `undefined`, daftar putih di Step 2 belum benar.

Bersihkan setelahnya: `await updateBimtek(id, { skl: [] });`

- [ ] **Step 4: Commit**

```bash
git add admin/js/modules/bimtek/api.js
git commit -m "feat: simpan bimtek.skl pada create dan update

'skl' ditambahkan ke daftar putih updateBimtek — tanpa itu SKL hilang
diam-diam setiap bimtek disunting."
```

---

### Task 9: Tab SKL pada form bimtek

**Files:**
- Create: `admin/js/modules/bimtek/form-skl.js`
- Modify: `admin/js/modules/bimtek/form.js:55` (tombol tab), `:153` (panel), `:193` (pengalihan tab), dan pengumpulan data saat submit

**Interfaces:**
- Consumes: `buildStokMatrix()` dari Task 4; `listUKAktif()` dari `master-uk/api.js:53`
- Produces: `renderTabSKL(el, sklAwal, bidangIds)` dan `bacaSKL(el)` → array baris SKL. `bacaSKL` juga menjadi sumber `bimtek.ukIds`, dipakai Task 11, 14, 15.

> **Catatan penting sebelum mulai.** `bimtek.ukIds` selama ini **tidak pernah diisi UI mana pun** — `createBimtek` dan `updateBimtek` menerimanya (`api.js:119,146`) dan `report-api.js:185` membacanya sebagai baseline, tapi tidak ada form yang mengumpulkannya. Karena itu tab SKL memuat pemilih UK-nya sendiri, dan `ukIds` diturunkan dari baris SKL saat submit. Dengan begitu tidak ada dua daftar UK yang harus dijaga tetap sinkron, dan baseline di `report-api.js` akhirnya terisi.

- [ ] **Step 1: Buat `form-skl.js`**

```js
// admin/js/modules/bimtek/form-skl.js
// Tab Standar Kompetensi Lulusan pada form bimtek.
// Satu baris per UK: sampai level kognitif mana lulusan harus menguasainya.
//
// Tab ini juga menjadi satu-satunya tempat UK bimtek ditentukan — bimtek.ukIds
// diturunkan dari baris di sini saat submit, bukan dikumpulkan terpisah.

import { buildStokMatrix } from '../bank-soal/api.js';
import { listUKAktif } from '../master-uk/api.js';
import { BLOOM_LEVELS } from '../../../../shared/constants.js';

const TARGET_DEFAULT = 'C3';
const AMBANG_DEFAULT = 70;
const JUMLAH_DEFAULT = 8;

/**
 * @param {HTMLElement} el        - panel #tab-skl
 * @param {object[]}    sklAwal   - bimtek.skl yang sudah tersimpan
 * @param {string[]}    bidangIds - bidang bimtek, membatasi pilihan UK
 */
export async function renderTabSKL(el, sklAwal = [], bidangIds = []) {
  el.innerHTML = `<div class="flex justify-center py-8">
    <div class="w-5 h-5 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin"></div>
  </div>`;

  const [ukAktif, stok] = await Promise.all([
    listUKAktif({ bidangId: bidangIds[0] ?? '' }),
    buildStokMatrix(),
  ]);
  const stokMap = Object.fromEntries(stok.rows.map(r => [r.ukKode.toUpperCase(), r]));

  const baris = (sklAwal ?? []).map(s => ({
    ukId:        s.ukId,
    ukKode:      s.ukKode,
    ukNama:      s.ukNama,
    targetBloom: s.targetBloom ?? TARGET_DEFAULT,
    ambang:      s.ambang      ?? AMBANG_DEFAULT,
    jumlahSoal:  s.jumlahSoal  ?? JUMLAH_DEFAULT,
  }));

  el.innerHTML = `
    <div class="space-y-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-white mb-1">Standar Kompetensi Lulusan</h3>
        <p class="text-xs text-gray-500 mb-3">
          Tetapkan unit kompetensi yang dicakup bimtek ini, lalu untuk tiap UK: sampai level
          kognitif mana lulusan harus menguasainya, persentase benar minimal di tiap level,
          dan berapa butir soal yang diujikan.
          Kolom Stok menunjukkan apakah bank soal sanggup membuktikan target itu.
        </p>
        <div class="flex items-center gap-2">
          <select id="skl-pilih-uk" class="form-select text-xs flex-1">
            <option value="">— pilih unit kompetensi untuk ditambahkan —</option>
            ${ukAktif.map(u => `
              <option value="${_esc(u.id)}"
                      data-kode="${_esc(u.kode ?? u.id.toUpperCase())}"
                      data-nama="${_esc(u.nama)}">${_esc(u.kode ?? u.id.toUpperCase())} — ${_esc(u.nama)}</option>`).join('')}
          </select>
          <button type="button" id="skl-tambah"
            class="shrink-0 px-3 py-2 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
            Tambah
          </button>
        </div>
      </div>

      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table class="btam-table min-w-[780px]">
          <thead>
            <tr>
              <th>Unit Kompetensi</th>
              <th class="w-40">Target</th>
              <th class="w-24">Ambang %</th>
              <th class="w-24">Jml Soal</th>
              <th class="w-56">Stok bank soal</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody id="skl-tbody">
            ${baris.map(b => _baris(b, stokMap[b.ukKode.toUpperCase()])).join('') || _barisKosong()}
          </tbody>
        </table>
      </div>
    </div>`;

  const tbody = el.querySelector('#skl-tbody');

  el.querySelector('#skl-tambah').addEventListener('click', () => {
    const sel = el.querySelector('#skl-pilih-uk');
    const opt = sel.selectedOptions[0];
    if (!sel.value) return;

    if (tbody.querySelector(`tr[data-uk-id="${CSS.escape(sel.value)}"]`)) {
      sel.value = '';
      return; // sudah ada, jangan digandakan
    }

    const b = {
      ukId:        sel.value,
      ukKode:      opt.dataset.kode,
      ukNama:      opt.dataset.nama,
      targetBloom: TARGET_DEFAULT,
      ambang:      AMBANG_DEFAULT,
      jumlahSoal:  JUMLAH_DEFAULT,
    };
    tbody.querySelector('[data-kosong]')?.closest('tr')?.remove();
    tbody.insertAdjacentHTML('beforeend', _baris(b, stokMap[b.ukKode.toUpperCase()]));
    sel.value = '';
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-skl-hapus]');
    if (!btn) return;
    btn.closest('tr').remove();
    if (!tbody.querySelector('tr[data-uk-id]')) tbody.innerHTML = _barisKosong();
  });

  // Kolom stok dihitung ulang tiap target berubah — target C4 pada UK yang
  // sel C4-nya kosong tidak akan pernah bisa dibuktikan, dan admin perlu
  // tahu itu sebelum menyimpan, bukan setelah ujian berlangsung.
  tbody.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-skl-target]');
    if (!sel) return;
    const tr   = sel.closest('tr');
    const kode = tr.dataset.ukKode.toUpperCase();
    tr.querySelector('[data-skl-stok]').innerHTML = _stokTeks(sel.value, stokMap[kode]);
  });
}

function _barisKosong() {
  return `<tr><td colspan="6" data-kosong class="text-center py-8 text-gray-500 text-xs">
    Belum ada unit kompetensi. Pilih dari daftar di atas lalu tekan Tambah.
  </td></tr>`;
}

/**
 * Baca isi tab SKL menjadi array siap simpan.
 * Hanya baris ber-`data-uk-id` yang dibaca, sehingga baris placeholder
 * "belum ada unit kompetensi" tidak ikut terbaca sebagai data.
 */
export function bacaSKL(el) {
  return [...el.querySelectorAll('#skl-tbody tr[data-uk-id]')].map(tr => ({
    ukId:        tr.dataset.ukId,
    ukKode:      tr.dataset.ukKode,
    ukNama:      tr.dataset.ukNama,
    targetBloom: tr.querySelector('[data-skl-target]').value,
    ambang:      Number(tr.querySelector('[data-skl-ambang]').value) || AMBANG_DEFAULT,
    jumlahSoal:  Number(tr.querySelector('[data-skl-jumlah]').value) || JUMLAH_DEFAULT,
  }));
}

function _baris(b, stokRow) {
  return `
    <tr data-uk-id="${_esc(b.ukId)}" data-uk-kode="${_esc(b.ukKode)}" data-uk-nama="${_esc(b.ukNama)}">
      <td>
        <div class="font-mono text-xs text-[#2dd4bf]">${_esc(b.ukKode)}</div>
        <div class="text-xs text-gray-400">${_esc(b.ukNama)}</div>
      </td>
      <td>
        <select data-skl-target class="form-select text-xs w-full">
          ${BLOOM_LEVELS.map(l =>
            `<option value="${l.level}" ${l.level === b.targetBloom ? 'selected' : ''}>${l.level} — ${l.nama}</option>`
          ).join('')}
        </select>
      </td>
      <td><input data-skl-ambang type="number" min="1" max="100" value="${b.ambang}" class="form-input text-xs w-full"></td>
      <td><input data-skl-jumlah type="number" min="1" max="50" value="${b.jumlahSoal}" class="form-input text-xs w-full"></td>
      <td data-skl-stok class="text-xs">${_stokTeks(b.targetBloom, stokRow)}</td>
      <td class="text-center">
        <button type="button" data-skl-hapus title="Hapus UK ini"
          class="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </td>
    </tr>`;
}

function _stokTeks(target, stokRow) {
  const targetIdx = BLOOM_LEVELS.findIndex(l => l.level === target);
  const levels    = BLOOM_LEVELS.slice(0, targetIdx + 1).map(l => l.level);
  if (!stokRow) return `<span class="text-red-400">✗ belum ada soal untuk UK ini</span>`;

  const kosong = levels.filter(l => (stokRow.lv[l] ?? 0) === 0);
  const tipis  = levels.filter(l => (stokRow.lv[l] ?? 0) === 1);

  if (kosong.length) return `<span class="text-red-400">✗ tidak ada soal ${kosong.join(', ')}</span>`;
  if (tipis.length)  return `<span class="text-yellow-400">⚠ hanya 1 butir di ${tipis.join(', ')}</span>`;
  return `<span class="text-teal-400">✓ memadai</span>`;
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Pasang tab di `form.js`**

Tambahkan impor:

```js
import { renderTabSKL, bacaSKL } from './form-skl.js';
```

Tambahkan tombol tab setelah tombol Bobot Nilai (`:55`):

```js
        <button class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent" data-tab="skl">SKL</button>
```

Tambahkan panel setelah `<div id="tab-weights">` (`:153` dan penutupnya):

```js
      <div id="tab-skl" class="hidden"></div>
```

Tambahkan pengalihan pada handler tab (`:193`):

```js
      app.querySelector('#tab-skl').classList.toggle('hidden', btn.dataset.tab !== 'skl');
```

Muat isinya sekali saja saat tab pertama kali dibuka. Panel harus tetap ada di DOM setelah itu, karena isinya dibaca saat submit:

```js
      if (btn.dataset.tab === 'skl' && !app.querySelector('#tab-skl').dataset.dimuat) {
        const panel = app.querySelector('#tab-skl');
        panel.dataset.dimuat = '1';
        // bidangIds dibaca saat tab dibuka, bukan saat form dibuat, supaya
        // daftar UK mengikuti bidang yang mungkin baru saja diubah admin.
        const bidangTerpilih = [...app.querySelectorAll('input[name="bidangIds"]:checked')].map(i => i.value);
        renderTabSKL(panel, d?.skl ?? [], bidangTerpilih);
      }
```

Sesuaikan selektor `input[name="bidangIds"]:checked` dengan cara `form.js` benar-benar mengumpulkan `bidangIds` saat submit — cari kata `bidangIds` di berkas itu dan pakai mekanisme yang sama. Jika bidang disimpan sebagai `<select>` tunggal, ganti dengan `[app.querySelector('[name="bidangIds"]').value]`.

- [ ] **Step 3: Sertakan SKL dan turunkan `ukIds` saat submit**

Di tempat `form.js` menyusun objek data untuk `createBimtek`/`updateBimtek`, tambahkan:

```js
    // Tab SKL dimuat malas. Kalau admin tidak pernah membukanya, panelnya
    // kosong dan bacaSKL akan mengembalikan array kosong — yang berarti
    // MENGHAPUS SKL yang sudah tersimpan. Karena itu jatuhkan ke nilai lama.
    ...(() => {
      const panel = app.querySelector('#tab-skl');
      const skl   = panel?.dataset.dimuat ? bacaSKL(panel) : (d?.skl ?? []);
      return {
        skl,
        // ukIds diturunkan dari SKL, bukan disimpan terpisah — satu daftar
        // UK saja, tidak ada dua sumber yang harus dijaga tetap sinkron.
        ukIds: skl.map(s => s.ukId),
      };
    })(),
```

- [ ] **Step 4: Verifikasi di browser**

1. Bimtek → Tambah bimtek → tab **SKL**.
   Diharapkan: tabel kosong dengan ajakan memilih UK, dan dropdown berisi UK aktif sesuai bidang bimtek.
2. Pilih satu UK → **Tambah**. Ulangi untuk dua UK lain.
   Diharapkan: 3 baris muncul, masing-masing target C3, ambang 70, jumlah 8, kolom Stok terisi.
3. Pilih UK yang sudah ada di tabel → **Tambah** lagi.
   Diharapkan: tidak ada baris ganda.
4. Ubah target satu baris ke C6.
   Diharapkan: kolom Stok berubah merah menyebut level yang tidak punya soal.
5. Tekan tombol ✕ pada satu baris.
   Diharapkan: baris hilang; jika semua dihapus, ajakan memilih UK muncul lagi.
6. Ubah ambang jadi 60 dan jumlah jadi 10, simpan bimtek, buka kembali → tab SKL.
   Diharapkan: nilai 60 dan 10 kembali muncul beserta seluruh UK-nya.
7. Periksa dokumen bimtek di Firebase Console.
   Diharapkan: `skl` berisi 3 objek, dan `ukIds` berisi 3 id yang sama persis dengan `skl[].ukId`.
8. Buka bimtek itu, sunting judulnya saja **tanpa** membuka tab SKL, simpan, buka lagi → tab SKL.
   Diharapkan: SKL masih utuh. Ini pemeriksaan terpenting di task ini — kegagalannya menghapus data secara diam-diam.

- [ ] **Step 5: Commit**

```bash
git add admin/js/modules/bimtek/form-skl.js admin/js/modules/bimtek/form.js
git commit -m "feat: tab SKL pada form bimtek

Target level, ambang, dan jumlah soal per UK. Kolom stok memberi tahu
sebelum menyimpan apakah bank soal sanggup membuktikan target itu.

Tab ini sekaligus mengisi bimtek.ukIds, yang selama ini diterima api.js
dan dibaca report-api.js sebagai baseline tapi tidak pernah diisi UI
mana pun. ukIds diturunkan dari baris SKL supaya tidak ada dua daftar
UK yang harus dijaga sinkron."
```

---

## FASE 3 — Generator

### Task 10: Fungsi pembagian butir per level

**Files:**
- Create: `shared/kompetensi.js`
- Modify: `tests/kompetensi.test.js`

**Interfaces:**
- Consumes: `BLOOM_LEVELS` dari `shared/constants.js:36`
- Produces: `bagiSoalPerLevel(targetBloom, jumlahSoal)` → `{ C1: n, ..., C<target>: n }` yang jumlahnya persis `jumlahSoal`, dipakai Task 11 dan 12; `labelBloom(level)` → `'C3 Menerapkan'`, dipakai Task 14 dan 15.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di `tests/kompetensi.test.js`:

```js
import { bagiSoalPerLevel } from '../shared/kompetensi.js';

test('bagiSoalPerLevel: target C3 dengan 8 soal condong ke level target', () => {
  assert.deepEqual(bagiSoalPerLevel('C3', 8), { C1: 1, C2: 3, C3: 4 });
});

test('bagiSoalPerLevel: target C4 dengan 6 soal', () => {
  assert.deepEqual(bagiSoalPerLevel('C4', 6), { C1: 1, C2: 1, C3: 2, C4: 2 });
});

test('bagiSoalPerLevel: target C1 menaruh semua di C1', () => {
  assert.deepEqual(bagiSoalPerLevel('C1', 5), { C1: 5 });
});

test('bagiSoalPerLevel: hasilnya selalu berjumlah persis jumlahSoal', () => {
  for (const target of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) {
    for (let n = 1; n <= 40; n++) {
      const bagi  = bagiSoalPerLevel(target, n);
      const total = Object.values(bagi).reduce((a, b) => a + b, 0);
      assert.equal(total, n, `target ${target}, jumlah ${n} menghasilkan ${total}`);
    }
  }
});

test('bagiSoalPerLevel: tidak pernah menghasilkan level di atas target', () => {
  const bagi = bagiSoalPerLevel('C2', 10);
  assert.deepEqual(Object.keys(bagi), ['C1', 'C2']);
});

test('bagiSoalPerLevel: menolak level tidak dikenal', () => {
  assert.throws(() => bagiSoalPerLevel('C9', 5), /tidak dikenal/);
});

test('bagiSoalPerLevel: menolak jumlah soal tidak sah', () => {
  assert.throws(() => bagiSoalPerLevel('C3', 0),   /minimal 1/);
  assert.throws(() => bagiSoalPerLevel('C3', 2.5), /bilangan bulat/);
});
```

Tambahkan juga test untuk pelabel level, yang dipakai laporan di Task 14:

```js
import { labelBloom } from '../shared/kompetensi.js';

test('labelBloom: menggabungkan kode dan nama level', () => {
  assert.equal(labelBloom('C1'), 'C1 Mengingat');
  assert.equal(labelBloom('C4'), 'C4 Menganalisis');
});

test('labelBloom: nilai kosong atau asing tidak melempar galat', () => {
  assert.equal(labelBloom(null), '—');
  assert.equal(labelBloom('C9'), 'C9');
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Jalankan: `npm test`
Diharapkan: FAIL — `Cannot find module '../shared/kompetensi.js'`

- [ ] **Step 3: Tulis implementasinya**

Buat `shared/kompetensi.js`:

```js
// shared/kompetensi.js
// Logika murni pemetaan kognitif: pembagian butir soal per level Bloom dan
// penilaian capaian peserta terhadap SKL.
//
// Tanpa import Firestore atau DOM — dipakai admin app, dan bisa diuji
// langsung dengan `npm test`.

import { BLOOM_LEVELS } from './constants.js';

/**
 * Bagi sejumlah butir soal ke level C1..target, condong ke level target.
 *
 * Bobot level ke-i adalah i, sehingga level target selalu mendapat porsi
 * terbesar — di situlah pembuktian pencapaian target berlangsung, jadi di
 * situ pula butir terbanyak diperlukan.
 *
 * Sisa pembulatan dibagikan dengan metode sisa terbesar agar jumlahnya
 * persis sama dengan yang diminta; seri dimenangkan level yang lebih tinggi.
 *
 * @param {string} targetBloom - 'C1'..'C6'
 * @param {number} jumlahSoal  - bilangan bulat >= 1
 * @returns {Object.<string, number>} mis. { C1: 1, C2: 3, C3: 4 }
 */
export function bagiSoalPerLevel(targetBloom, jumlahSoal) {
  const targetIdx = BLOOM_LEVELS.findIndex(b => b.level === targetBloom);
  if (targetIdx < 0) throw new Error(`Level Bloom '${targetBloom}' tidak dikenal.`);
  if (!Number.isInteger(jumlahSoal)) throw new Error('jumlahSoal harus bilangan bulat.');
  if (jumlahSoal < 1) throw new Error('jumlahSoal minimal 1.');

  const levels = BLOOM_LEVELS.slice(0, targetIdx + 1).map(b => b.level);
  const bobot  = levels.map((_, i) => i + 1);
  const total  = bobot.reduce((a, b) => a + b, 0);

  const kuota = levels.map((lv, i) => {
    const persis = (bobot[i] / total) * jumlahSoal;
    const dasar  = Math.floor(persis);
    return { lv, idx: i, dasar, sisa: persis - dasar };
  });

  const hasil = {};
  kuota.forEach(k => { hasil[k.lv] = k.dasar; });

  const kurang = jumlahSoal - kuota.reduce((a, k) => a + k.dasar, 0);
  const urut   = [...kuota].sort((a, b) => (b.sisa - a.sisa) || (b.idx - a.idx));
  for (let i = 0; i < kurang; i++) hasil[urut[i % urut.length].lv]++;

  return hasil;
}

/**
 * Label level Bloom untuk ditampilkan: 'C3' → 'C3 Menerapkan'.
 *
 * Catatan: JANGAN memakai mapToLabel() dari report-narrative.js untuk ini.
 * Fungsi itu memetakan nilai numerik ke label ambang, sama sekali bukan
 * level kognitif.
 *
 * @param {string|null} level
 * @returns {string}
 */
export function labelBloom(level) {
  if (!level) return '—';
  const b = BLOOM_LEVELS.find(x => x.level === level);
  return b ? `${b.level} ${b.nama}` : String(level);
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Jalankan: `npm test`
Diharapkan: PASS, seluruh test `bagiSoalPerLevel` lulus termasuk yang menyapu 240 kombinasi target × jumlah.

- [ ] **Step 5: Commit**

```bash
git add shared/kompetensi.js tests/kompetensi.test.js
git commit -m "feat: bagiSoalPerLevel — pembagian butir condong ke level target

Metode sisa terbesar menjamin jumlahnya persis sama dengan yang diminta,
diuji menyapu 240 kombinasi target x jumlah."
```

---

### Task 11: Generator set soal

**Files:**
- Create: `admin/js/modules/bimtek/generator-soal.js`

**Interfaces:**
- Consumes: `bagiSoalPerLevel()` dari Task 10; `pickSoalRandom()` dari `bank-soal/api.js:208`
- Produces: `susunDariSKL(skl, bidangId)` → `{ soalIds, blueprint, adaDefisit }` dengan `blueprint = { dibuatDari, dibuatPada, komposisi: [{ukId, ukKode, bloomLevel, diminta, terpenuhi, soalIds}] }`. Dipakai Task 12 dan dibaca Task 14, 15.

- [ ] **Step 1: Buat `generator-soal.js`**

```js
// admin/js/modules/bimtek/generator-soal.js
// Menyusun set soal dari Standar Kompetensi Lulusan bimtek.
//
// Kekurangan stok TIDAK digeser ke level lain. Menambal sel C4 yang kosong
// dengan butir C2 akan membuat laporan mengklaim pengukuran yang tidak
// pernah terjadi. Kekurangan dicatat di blueprint dan ditampilkan apa adanya.

import { bagiSoalPerLevel } from '../../../../shared/kompetensi.js';
import { pickSoalRandom } from '../bank-soal/api.js';

/**
 * @param {object[]} skl      - bimtek.skl
 * @param {string}   bidangId - bidang bimtek, membatasi kolam soal
 * @returns {Promise<{ soalIds: string[], blueprint: object, adaDefisit: boolean }>}
 */
export async function susunDariSKL(skl, bidangId) {
  if (!skl?.length) throw new Error('Bimtek ini belum punya SKL.');
  if (!bidangId)    throw new Error('Bidang bimtek belum ditentukan.');

  const komposisi = [];
  const terpakai  = [];   // lintas UK, supaya satu butir tidak terambil dua kali

  for (const baris of skl) {
    const bagi = bagiSoalPerLevel(baris.targetBloom, baris.jumlahSoal);

    for (const [bloomLevel, diminta] of Object.entries(bagi)) {
      if (diminta < 1) continue;

      const pool = await pickSoalRandom({
        bidangId,
        unitKompetensi: baris.ukKode,
        bloomLevels:    [bloomLevel],
        jumlah:         diminta,
        excludeIds:     terpakai,
      });

      const ids = pool.map(s => s.soalId);
      terpakai.push(...ids);

      komposisi.push({
        ukId:       baris.ukId,
        ukKode:     baris.ukKode,
        bloomLevel,
        diminta,
        terpenuhi:  ids.length,
        soalIds:    ids,
      });
    }
  }

  return {
    soalIds:  terpakai,
    blueprint: {
      dibuatDari: 'skl',
      dibuatPada: new Date().toISOString(),
      komposisi,
    },
    adaDefisit: komposisi.some(k => k.terpenuhi < k.diminta),
  };
}

/** Ringkas komposisi menjadi baris siap tampil di pratinjau. */
export function ringkasKomposisi(blueprint) {
  const perUK = new Map();
  for (const k of blueprint.komposisi) {
    if (!perUK.has(k.ukKode)) perUK.set(k.ukKode, { ukKode: k.ukKode, sel: [], diminta: 0, terpenuhi: 0 });
    const e = perUK.get(k.ukKode);
    e.sel.push(k);
    e.diminta   += k.diminta;
    e.terpenuhi += k.terpenuhi;
  }
  return [...perUK.values()];
}
```

- [ ] **Step 2: Verifikasi lewat konsol browser**

Buka `http://localhost:8080/admin/`, masuk sebagai admin, jalankan di Console:

```js
const { susunDariSKL, ringkasKomposisi } = await import('./js/modules/bimtek/generator-soal.js');
const hasil = await susunDariSKL(
  [{ ukId:'f.42ami00.006.1', ukKode:'F.42AMI00.006.1', ukNama:'Menyusun Rencana Teknis Terinci', targetBloom:'C3', ambang:70, jumlahSoal:8 }],
  '<bidangId soal UK tersebut>'
);
console.log(hasil.soalIds.length, hasil.adaDefisit);
console.table(hasil.blueprint.komposisi);
```

Diharapkan: `8 false` — UK ini punya C1=9, C2=7, C3=8 sehingga permintaan 1/3/4 terpenuhi seluruhnya. Tabel komposisi menampilkan tiga baris dengan `diminta === terpenuhi`.

Lalu uji kasus defisit:

```js
const defisit = await susunDariSKL(
  [{ ukId:'e.36pam11.002.1', ukKode:'E.36PAM11.002.1', ukNama:'Mengoperasikan Prasedimentasi', targetBloom:'C4', ambang:70, jumlahSoal:6 }],
  '<bidangId UK tersebut>'
);
console.log(defisit.adaDefisit);
console.table(defisit.blueprint.komposisi);
```

Diharapkan: `true`, dan baris komposisi menunjukkan `terpenuhi < diminta` pada level yang stoknya kosong — bukan digeser ke level lain.

- [ ] **Step 3: Commit**

```bash
git add admin/js/modules/bimtek/generator-soal.js
git commit -m "feat: generator set soal dari SKL

Kekurangan stok dicatat di blueprint, tidak digeser ke level lain —
menambal sel kosong dengan butir level lain membuat laporan mengklaim
pengukuran yang tidak terjadi."
```

---

### Task 12: Tombol Susun dari SKL

**Files:**
- Modify: `admin/js/modules/bimtek/exam-modal.js:24` (tanda tangan), `:53` (state), `:87` (letak tombol), `:210` (simpan blueprint)

**Interfaces:**
- Consumes: `susunDariSKL()`, `ringkasKomposisi()` dari Task 11
- Produces: `exams.blueprint` tersimpan di Firestore, dibaca Task 14 dan 15

- [ ] **Step 1: Terima `skl` dan `bidangId` sebagai argumen**

Ubah tanda tangan di `:24`:

```js
export async function showExamModal({ bimtekId, bidangIds = [], skl = [], exam = null, onSaved, defaultTipe = 'pretest' }) {
```

Cari pemanggil `showExamModal` di `tab-ujian.js` dan teruskan `skl: bimtek.skl ?? []`.

- [ ] **Step 2: Tambahkan tombol dan area pratinjau**

Setelah input `#exam-jumlah` (`:87`), sisipkan:

```js
        ${skl.length ? `
          <div class="mt-3 p-3 rounded-lg border border-[#1e3a3f] bg-[#0b1116]">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-medium text-gray-300">Susun otomatis dari SKL</p>
                <p class="text-xs text-gray-500">Mengisi daftar soal sesuai target tiap unit kompetensi. Hasilnya masih bisa Anda ubah.</p>
              </div>
              <button type="button" id="btn-susun-skl"
                class="shrink-0 px-3 py-2 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
                Susun dari SKL
              </button>
            </div>
            <div id="skl-pratinjau" class="mt-3 hidden"></div>
          </div>` : ''}
```

- [ ] **Step 3: Pasang handler**

Tambahkan impor di atas `exam-modal.js`:

```js
import { susunDariSKL, ringkasKomposisi } from './generator-soal.js';
```

Deklarasikan penampung blueprint di dekat `selectedSoalIds` (`:53`):

```js
  let blueprintTersimpan = exam?.blueprint ?? null;
```

Pasang handler setelah pemasangan event lain:

```js
  modal.querySelector('#btn-susun-skl')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const teksAsli = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Menyusun…';
    try {
      const hasil = await susunDariSKL(skl, bidangIds[0]);

      selectedSoalIds.clear();
      hasil.soalIds.forEach(id => selectedSoalIds.add(id));
      blueprintTersimpan = hasil.blueprint;

      // Segarkan centang di daftar soal dan jumlah ditampilkan
      modal.querySelectorAll('.soal-cb').forEach(cb => {
        cb.checked = selectedSoalIds.has(cb.value);
      });
      modal.querySelector('#exam-jumlah').value = selectedSoalIds.size;
      countLbl.textContent = `${selectedSoalIds.size} dipilih`;

      const pratinjau = modal.querySelector('#skl-pratinjau');
      pratinjau.classList.remove('hidden');
      pratinjau.innerHTML = _pratinjauSKL(hasil);
    } catch (err) {
      showToast(`Gagal menyusun: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = teksAsli;
    }
  });
```

Tambahkan fungsi pembangun pratinjau di bagian bawah berkas, sebelum `_esc`:

```js
function _pratinjauSKL(hasil) {
  const baris = ringkasKomposisi(hasil.blueprint).map(u => {
    const sel = u.sel.map(k => {
      const kurang = k.terpenuhi < k.diminta;
      return `<span class="${kurang ? 'text-red-400' : 'text-gray-400'}">${k.bloomLevel}:${k.terpenuhi}${kurang ? `/${k.diminta}` : ''}</span>`;
    }).join(' · ');
    return `<tr>
      <td class="font-mono text-xs text-[#2dd4bf] py-1 pr-3">${_esc(u.ukKode)}</td>
      <td class="text-xs py-1 pr-3">${sel}</td>
      <td class="text-xs py-1 text-gray-300">${u.terpenuhi}/${u.diminta}</td>
    </tr>`;
  }).join('');

  const peringatan = hasil.adaDefisit
    ? `<p class="text-xs text-yellow-400 mt-2">
         ⚠ Sebagian level tidak punya cukup soal di bank. Kekurangannya dicatat dan akan
         ditandai di laporan — tidak diganti dengan soal level lain.
       </p>`
    : '';

  return `<table class="w-full">${baris}</table>${peringatan}`;
}
```

- [ ] **Step 4: Simpan blueprint bersama exam**

Di penyusunan objek `data` (`:210`), tambahkan:

```js
      blueprint:         blueprintTersimpan,
```

Lalu di `exam-api.js`, tambahkan `blueprint` pada `createExam` (`:45`, dekat `soalIds`) dan `updateExam` (`:67`):

```js
    blueprint:          data.blueprint ?? null,
```

- [ ] **Step 5: Verifikasi di browser**

1. Buka bimtek yang sudah punya SKL → tab Ujian → Tambah Ujian.
   Diharapkan: kotak "Susun otomatis dari SKL" muncul.
2. Buka bimtek **tanpa** SKL → Tambah Ujian.
   Diharapkan: kotak itu tidak muncul sama sekali.
3. Kembali ke bimtek ber-SKL, tekan **Susun dari SKL**.
   Diharapkan: daftar soal tercentang otomatis, "n dipilih" berubah, `#exam-jumlah` terisi, pratinjau memperlihatkan komposisi per UK per level.
4. Untuk UK yang stoknya kurang.
   Diharapkan: angka merah berbentuk `C4:1/2` dan peringatan kuning di bawah tabel.
5. Hapus centang satu soal secara manual lalu simpan ujian.
   Diharapkan: tersimpan tanpa galat, jumlah soal berkurang satu.
6. Buka kembali ujian yang baru disimpan, periksa di Firebase Console.
   Diharapkan: dokumen `exams` memuat field `blueprint` dengan array `komposisi`.

- [ ] **Step 6: Commit**

```bash
git add admin/js/modules/bimtek/exam-modal.js admin/js/modules/bimtek/exam-api.js
git commit -m "feat: tombol Susun dari SKL di form ujian

Mengisi pemilih soal yang sudah ada, tidak menggantikannya — admin tetap
bisa mengoreksi. Blueprint tersimpan agar laporan bisa membedakan
'tidak diuji' dari 'bank soal tidak punya butirnya'."
```

---

## FASE 4 — Laporan

### Task 13: Fungsi penilaian capaian

**Files:**
- Modify: `shared/kompetensi.js`
- Modify: `tests/kompetensi.test.js`

**Interfaces:**
- Consumes: `BLOOM_LEVELS`
- Produces: `calcLevelAttainment(detail, soalMap, sklRow, blueprint)` → `{ ukId, ukKode, ukNama, target, ambang, perLevel, levelTercapai, memenuhiTarget, tipis, defisit }`. Dipakai Task 14 dan 15.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di `tests/kompetensi.test.js`:

```js
import { calcLevelAttainment } from '../shared/kompetensi.js';

// Kerangka data uji: soalMap meniru dokumen bank_soal, detail meniru
// exam_results.detail yang ditulis scorer.js.
const SKL_ROW = {
  ukId: 'uk1', ukKode: 'UK.001', ukNama: 'Mengoperasikan Pompa',
  targetBloom: 'C3', ambang: 70, jumlahSoal: 8,
};

function buatSoal(spec) {
  // spec: [[soalId, level, benar], ...]
  const soalMap = {};
  const detail  = {};
  spec.forEach(([id, lv, benar]) => {
    soalMap[id] = { soalId: id, unitKompetensi: 'UK.001', bloomLevel: lv };
    detail[id]  = { benar, bobot: 1, skor: benar ? 1 : 0 };
  });
  return { soalMap, detail };
}

test('calcLevelAttainment: lolos seluruh level sampai target', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', true], ['b', 'C1', true],
    ['c', 'C2', true], ['d', 'C2', true],
    ['e', 'C3', true], ['f', 'C3', true],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, 'C3');
  assert.equal(h.memenuhiTarget, true);
  assert.equal(h.tipis, false);
});

test('calcLevelAttainment: berhenti di level sebelum yang gagal', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', true],  ['b', 'C1', true],
    ['c', 'C2', true],  ['d', 'C2', true],
    ['e', 'C3', false], ['f', 'C3', false],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, 'C2');
  assert.equal(h.memenuhiTarget, false);
});

test('calcLevelAttainment: gagal di level bawah membatalkan klaim level atas', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', false], ['b', 'C1', false],
    ['c', 'C2', true],  ['d', 'C2', true],
    ['e', 'C3', true],  ['f', 'C3', true],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, null,
    'benar di C3 tanpa lolos C1 bukan bukti penguasaan C3');
  assert.equal(h.memenuhiTarget, false);
});

test('calcLevelAttainment: level tanpa soal memutus rantai', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', true], ['b', 'C1', true],
    ['e', 'C3', true], ['f', 'C3', true],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, 'C1', 'C2 tidak diuji, jadi C3 tidak bisa diklaim');
});

test('calcLevelAttainment: menandai kesimpulan yang bersandar satu butir', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', true], ['b', 'C1', true],
    ['c', 'C2', true], ['d', 'C2', true],
    ['e', 'C3', true],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, 'C3');
  assert.equal(h.tipis, true, 'C3 hanya diwakili satu butir');
});

test('calcLevelAttainment: mengabaikan soal dari UK lain', () => {
  const { soalMap, detail } = buatSoal([['a', 'C1', true], ['b', 'C1', true]]);
  soalMap['x'] = { soalId: 'x', unitKompetensi: 'UK.999', bloomLevel: 'C1' };
  detail['x']  = { benar: false, bobot: 1, skor: 0 };
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.perLevel.C1.total, 2, 'soal UK lain tidak boleh ikut terhitung');
});

test('calcLevelAttainment: melaporkan defisit dari blueprint', () => {
  const { soalMap, detail } = buatSoal([['a', 'C1', true]]);
  const blueprint = { komposisi: [
    { ukId: 'uk1', ukKode: 'UK.001', bloomLevel: 'C3', diminta: 4, terpenuhi: 1, soalIds: ['e'] },
    { ukId: 'uk1', ukKode: 'UK.001', bloomLevel: 'C1', diminta: 1, terpenuhi: 1, soalIds: ['a'] },
  ] };
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW, blueprint);
  assert.equal(h.defisit.length, 1);
  assert.deepEqual(h.defisit[0], { bloomLevel: 'C3', diminta: 4, terpenuhi: 1 });
});

test('calcLevelAttainment: detail kosong tidak melempar galat', () => {
  const h = calcLevelAttainment({}, {}, SKL_ROW);
  assert.equal(h.levelTercapai, null);
  assert.deepEqual(h.perLevel, {});
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Jalankan: `npm test`
Diharapkan: FAIL — `calcLevelAttainment is not a function`

- [ ] **Step 3: Tulis implementasinya**

Tambahkan di `shared/kompetensi.js`:

```js
/**
 * Nilai capaian kognitif seorang peserta pada satu unit kompetensi.
 *
 * Aturan levelTercapai: level tertinggi L yang persentase benarnya >= ambang
 * DAN seluruh level di bawah L juga >= ambang. Syarat berjenjang ini penting —
 * tanpa itu, satu tebakan beruntung di level tinggi cukup untuk mengklaim
 * penguasaan yang tidak dimiliki.
 *
 * Level tanpa soal memutus rantai: tidak bisa diklaim dikuasai, tidak juga
 * dianggap lulus diam-diam.
 *
 * @param {Object} detail    - exam_results.detail: { soalId: { benar, bobot, skor } }
 * @param {Object} soalMap   - { soalId: { unitKompetensi, bloomLevel, ... } }
 * @param {Object} sklRow    - satu baris bimtek.skl
 * @param {Object} [blueprint] - exams.blueprint, untuk melaporkan defisit stok
 */
export function calcLevelAttainment(detail, soalMap, sklRow, blueprint = null) {
  const { ukId, ukKode, ukNama, targetBloom, ambang } = sklRow;
  const kodeUK = String(ukKode ?? '').toUpperCase();

  const perLevel = {};
  for (const [soalId, d] of Object.entries(detail ?? {})) {
    const soal = soalMap?.[soalId];
    if (!soal) continue;
    if (String(soal.unitKompetensi ?? '').toUpperCase() !== kodeUK) continue;
    const lv = soal.bloomLevel;
    if (!lv) continue;
    if (!perLevel[lv]) perLevel[lv] = { benar: 0, total: 0, pct: 0 };
    perLevel[lv].total++;
    if (d?.benar) perLevel[lv].benar++;
  }
  for (const v of Object.values(perLevel)) {
    v.pct = v.total > 0 ? Math.round((v.benar / v.total) * 100) : 0;
  }

  const targetIdx = BLOOM_LEVELS.findIndex(b => b.level === targetBloom);
  if (targetIdx < 0) throw new Error(`Level Bloom '${targetBloom}' tidak dikenal.`);
  const urutan = BLOOM_LEVELS.slice(0, targetIdx + 1).map(b => b.level);

  let levelTercapai = null;
  let levelPemutus  = null;
  for (const lv of urutan) {
    const s = perLevel[lv];
    if (!s || s.total === 0 || s.pct < ambang) { levelPemutus = lv; break; }
    levelTercapai = lv;
  }

  // Kesimpulan ditandai tipis bila level yang menentukannya — entah yang
  // dicapai terakhir atau yang menggagalkan — hanya diwakili satu butir.
  const levelPenentu = levelPemutus ?? levelTercapai;
  const totalPenentu = levelPenentu ? (perLevel[levelPenentu]?.total ?? 0) : 0;
  const tipis        = totalPenentu === 1;

  const defisit = (blueprint?.komposisi ?? [])
    .filter(k => k.ukId === ukId && k.terpenuhi < k.diminta)
    .map(k => ({ bloomLevel: k.bloomLevel, diminta: k.diminta, terpenuhi: k.terpenuhi }));

  return {
    ukId, ukKode, ukNama: ukNama ?? ukKode,
    target: targetBloom, ambang,
    perLevel,
    levelTercapai,
    memenuhiTarget: levelTercapai === targetBloom,
    tipis,
    defisit,
  };
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Jalankan: `npm test`
Diharapkan: PASS, seluruh test lulus termasuk Task 10.

- [ ] **Step 5: Commit**

```bash
git add shared/kompetensi.js tests/kompetensi.test.js
git commit -m "feat: calcLevelAttainment — penilaian capaian kognitif per UK

Level tercapai mensyaratkan seluruh level di bawahnya juga lolos, supaya
satu tebakan beruntung di level tinggi tidak jadi klaim penguasaan.
Kesimpulan yang bersandar satu butir ditandai tipis."
```

---

### Task 14: Laporan Peserta — bagian C

**Files:**
- Modify: `admin/js/modules/bimtek/report-api.js:170-231` (`getPesertaReportData`)
- Modify: `admin/js/modules/bimtek/report-narrative.js` (tambah `narasiCapaianKognitif`)
- Modify: `admin/js/modules/bimtek/sub-report-peserta.js:954` dan `:1058` (bagian C)

**Interfaces:**
- Consumes: `calcLevelAttainment()` dari Task 13
- Produces: `pesertaReportData.capaianKognitif` → array hasil `calcLevelAttainment` untuk pre dan post

- [ ] **Step 1: Hitung capaian di `report-api.js`**

Tambahkan impor:

```js
import { calcLevelAttainment } from '../../../../shared/kompetensi.js';
```

Di `getPesertaReportData`, setelah blok `ekComparison` selesai (`:211`), sisipkan:

```js
  // ── Capaian kognitif terhadap SKL ─────────────────────────────────────────
  // Hanya dihitung bila bimtek punya SKL. Bimtek tanpa SKL memakai jalur lama
  // dan laporannya tidak berubah sama sekali.
  let capaianKognitif = null;
  if (bimtek.skl?.length && allSoalIds.length > 0) {
    const soalMap   = await _fetchSoalMap(allSoalIds);
    const blueprint = exams.find(e => e.blueprint)?.blueprint ?? null;

    capaianKognitif = bimtek.skl.map(row => ({
      ...row,
      pre:  calcLevelAttainment(pretestResult?.detail  ?? {}, soalMap, row, blueprint),
      post: calcLevelAttainment(posttestResult?.detail ?? {}, soalMap, row, blueprint),
    }));
  }
```

Tambahkan `capaianKognitif` pada objek yang dikembalikan (`:219-230`):

```js
    capaianKognitif,
```

- [ ] **Step 2: Tambahkan penyusun kalimat di `report-narrative.js`**

Tambahkan di akhir berkas:

```js
// Kata kerja yang menggambarkan apa yang bisa dilakukan peserta di tiap level.
// Dipakai untuk menyusun kalimat capaian yang bermakna bagi pembaca awam —
// "naik dari Mengingat ke Menerapkan" lebih berarti daripada "42% ke 88%".
const KATA_KERJA_BLOOM = {
  C1: 'mengingat dan menyebutkan kembali',
  C2: 'memahami dan menjelaskan',
  C3: 'menerapkan pada situasi kerja nyata',
  C4: 'menganalisis dan menguraikan penyebab',
  C5: 'menimbang dan mengevaluasi',
  C6: 'merancang dan menyusun hal baru',
};

/**
 * Susun kalimat capaian kognitif untuk satu unit kompetensi.
 * @param {object} baris - satu elemen pesertaReportData.capaianKognitif
 * @returns {{ kalimat: string, catatan: string|null }}
 */
export function narasiCapaianKognitif(baris) {
  const { ukNama, post, pre, target } = baris;
  const namaTarget  = labelBloom(target);
  const namaCapaian = post.levelTercapai ? labelBloom(post.levelTercapai) : null;

  let kalimat;
  if (post.memenuhiTarget) {
    const naik = pre.levelTercapai && pre.levelTercapai !== post.levelTercapai;
    kalimat = naik
      ? `Saudara mencapai sasaran ${namaTarget} pada ${ukNama}, naik dari `
        + `${labelBloom(pre.levelTercapai)} sebelum mengikuti bimtek. `
        + `Saudara kini mampu ${KATA_KERJA_BLOOM[target]}.`
      : `Saudara mencapai sasaran ${namaTarget} pada ${ukNama}, `
        + `yakni mampu ${KATA_KERJA_BLOOM[target]}.`;
  } else if (namaCapaian) {
    kalimat = `Pada ${ukNama}, Saudara mampu ${KATA_KERJA_BLOOM[post.levelTercapai]}, `
      + `namun belum menunjukkan kemampuan ${KATA_KERJA_BLOOM[target]} `
      + `sebagaimana disasar bimtek ini. Disarankan pendalaman lebih lanjut.`;
  } else {
    kalimat = `Pada ${ukNama}, Saudara belum menunjukkan penguasaan yang memadai `
      + `pada level kognitif manapun yang diujikan. Disarankan mengulang materi ini.`;
  }

  let catatan = null;
  if (post.defisit.length) {
    const lv = post.defisit.map(d => d.bloomLevel).join(', ');
    catatan = `Penilaian level ${lv} belum lengkap — bank soal belum menyediakan `
      + `cukup butir untuk level tersebut.`;
  } else if (post.tipis) {
    catatan = `Penilaian pada level penentu bersandar pada satu butir soal, `
      + `sehingga kesimpulannya perlu dibaca dengan hati-hati.`;
  }

  return { kalimat, catatan };
}
```

Tambahkan impor di atas `report-narrative.js`:

```js
import { labelBloom } from '../../../../shared/kompetensi.js';
```

**Jangan memakai `mapToLabel()` yang sudah ada di berkas ini (`:19`).** Tanda tangannya `mapToLabel(value, thresholds)` — ia memetakan nilai numerik ke label ambang seperti "Baik"/"Cukup", sama sekali bukan level kognitif. Memanggilnya dengan `'C3'` akan mengembalikan label ambang yang keliru tanpa memunculkan galat apa pun.

- [ ] **Step 3: Tampilkan di bagian C**

Di `sub-report-peserta.js`, cari bagian "C. Perubahan Kompetensi" (`:954` untuk pratinjau, `:1058` untuk keluaran DOCX). Sisipkan blok berikut **setelah** tabel persentase yang sudah ada, di kedua tempat:

```js
${data.capaianKognitif ? `
  <p style="margin:12px 0 6px 0;font-weight:600;">Capaian Level Kognitif</p>
  ${data.capaianKognitif.map(b => {
    const { kalimat, catatan } = narasiCapaianKognitif(b);
    const status = b.post.memenuhiTarget ? '✓ tercapai' : '✗ belum tercapai';
    const dari   = b.pre.levelTercapai  ? labelBloom(b.pre.levelTercapai)  : '—';
    const ke     = b.post.levelTercapai ? labelBloom(b.post.levelTercapai) : 'belum tercapai';
    return `
      <div style="margin-bottom:10px;">
        <p style="margin:0 0 2px 0;"><strong>${_esc(b.ukNama)}</strong>
           <span style="color:#666;">— sasaran ${_esc(labelBloom(b.targetBloom))}</span></p>
        <p style="margin:0 0 2px 0;">sebelum ${_esc(dari)} &rarr; sesudah ${_esc(ke)} &nbsp; ${status}</p>
        <p style="margin:0;text-align:justify;">${_esc(kalimat)}</p>
        ${catatan ? `<p style="margin:2px 0 0 0;font-size:9pt;color:#8a6d00;">${_esc(catatan)}</p>` : ''}
      </div>`;
  }).join('')}
` : ''}
```

Tambahkan impor di atas `sub-report-peserta.js`:

```js
import { narasiCapaianKognitif } from './report-narrative.js';
import { labelBloom } from '../../../../shared/kompetensi.js';
```

- [ ] **Step 4: Verifikasi di browser**

1. Buka bimtek **tanpa** SKL → tab Laporan → Laporan Peserta, pilih satu peserta.
   Diharapkan: bagian C persis seperti sebelumnya, tanpa blok baru. Ini pemeriksaan terpenting — bimtek lama tidak boleh berubah.
2. Buka bimtek **ber-SKL** yang pre dan post-testnya sudah tersinkron → Laporan Peserta.
   Diharapkan: setelah tabel persentase muncul "Capaian Level Kognitif", satu blok per UK berisi baris sebelum→sesudah, tanda ✓/✗, dan kalimat naratifnya.
3. Cari UK yang levelnya hanya diwakili satu butir.
   Diharapkan: muncul catatan berwarna kuning tentang kesimpulan yang bersandar satu butir.
4. Unduh DOCX peserta itu, buka di Word.
   Diharapkan: blok capaian ikut tercetak dengan tata letak rapi, tidak terpotong antar-halaman.

- [ ] **Step 5: Commit**

```bash
git add admin/js/modules/bimtek/report-api.js admin/js/modules/bimtek/report-narrative.js admin/js/modules/bimtek/sub-report-peserta.js
git commit -m "feat: capaian level kognitif di bagian C laporan peserta

Menyatakan level yang dicapai beserta kalimat naratifnya, bukan hanya
persentase. Bimtek tanpa SKL tidak berubah sama sekali."
```

---

### Task 15: Laporan Penyelenggara — blok pemenuhan SKL

**Files:**
- Modify: `admin/js/modules/bimtek/report-api.js:45-113` (`getBimtekReportData`)
- Modify: `admin/js/modules/bimtek/sub-report-penyelenggara.js:274` (setelah blok per-UK)

**Interfaces:**
- Consumes: `calcLevelAttainment()` dari Task 13
- Produces: `reportData.pemenuhanSKL` → `[{ ukKode, ukNama, target, capai, dari, pct, levelRata, defisit }]`

- [ ] **Step 1: Hitung pemenuhan SKL di `report-api.js`**

Di `getBimtekReportData`, setelah `pengajarData` (`:95`), sisipkan:

```js
  // ── Pemenuhan SKL seluruh peserta ─────────────────────────────────────────
  let pemenuhanSKL = null;
  if (bimtek.skl?.length) {
    const allSoalIds = [...new Set(exams.flatMap(e => e.soalIds ?? []))];
    if (allSoalIds.length) {
      const soalMap   = await _fetchSoalMap(allSoalIds);
      const blueprint = exams.find(e => e.blueprint)?.blueprint ?? null;
      const posts     = examResults.filter(r => r.tipeSession === 'posttest');

      pemenuhanSKL = bimtek.skl.map(row => {
        const hasil = posts.map(r => calcLevelAttainment(r.detail ?? {}, soalMap, row, blueprint));
        const capai = hasil.filter(h => h.memenuhiTarget).length;

        // Level rata-rata = level tertinggi yang dicapai mayoritas peserta.
        const urutan = BLOOM_LEVELS.map(b => b.level);
        let levelRata = null;
        for (const lv of urutan) {
          const n = hasil.filter(h => h.levelTercapai && urutan.indexOf(h.levelTercapai) >= urutan.indexOf(lv)).length;
          if (hasil.length && n > hasil.length / 2) levelRata = lv;
        }

        return {
          ukKode:  row.ukKode,
          ukNama:  row.ukNama,
          target:  row.targetBloom,
          capai,
          dari:    hasil.length,
          pct:     hasil.length ? Math.round((capai / hasil.length) * 100) : 0,
          levelRata,
          defisit: hasil[0]?.defisit ?? [],
        };
      });
    }
  }
```

Tambahkan impor:

```js
import { calcLevelAttainment } from '../../../../shared/kompetensi.js';
import { COL, BLOOM_LEVELS } from '../../../../shared/constants.js';
```

Sesuaikan impor `constants` yang sudah ada alih-alih menggandakannya.

Tambahkan `pemenuhanSKL` pada objek kembalian (`:97-112`).

- [ ] **Step 2: Tampilkan blok di laporan penyelenggara**

Di `sub-report-penyelenggara.js`, setelah blok "Perbandingan Pre/Post per Unit Kompetensi" (`:274` dan penutup div-nya), sisipkan:

```js
${data.pemenuhanSKL ? `
  <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
    <h3 class="text-sm font-semibold text-white mb-1">Pemenuhan Standar Kompetensi Lulusan</h3>
    <p class="text-xs text-gray-500 mb-4">
      Berapa peserta yang mencapai target level kognitif tiap unit kompetensi, dihitung dari post-test.
    </p>
    <table class="btam-table">
      <thead>
        <tr>
          <th>Unit Kompetensi</th>
          <th class="w-28 text-center">Target</th>
          <th class="w-32 text-center">Capai target</th>
          <th class="w-28 text-center">Level mayoritas</th>
        </tr>
      </thead>
      <tbody>
        ${data.pemenuhanSKL.map(u => {
          const rendah = u.pct < 50;
          return `
            <tr>
              <td>
                <div class="font-mono text-xs text-[#2dd4bf]">${_esc(u.ukKode)}</div>
                <div class="text-xs text-gray-400">${_esc(u.ukNama)}</div>
              </td>
              <td class="text-center text-xs text-gray-300">${_esc(u.target)}</td>
              <td class="text-center text-xs ${rendah ? 'text-red-400' : 'text-gray-300'}">
                ${u.capai}/${u.dari} &nbsp; ${u.pct}% ${rendah ? '⚠' : ''}
              </td>
              <td class="text-center text-xs text-gray-300">${_esc(u.levelRata ?? '—')}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${data.pemenuhanSKL.filter(u => u.pct < 50 || u.defisit.length).map(u => `
      <div class="mt-3 bg-yellow-900/10 border border-yellow-700/30 rounded-lg p-3">
        <p class="text-xs text-yellow-400">
          <strong>${_esc(u.ukNama)}</strong> —
          ${u.pct < 50 ? `hanya ${u.pct}% peserta mencapai sasaran ${_esc(u.target)}. ` : ''}
          ${u.defisit.length
            ? `Bank soal menyediakan ${u.defisit.map(d => `${d.terpenuhi} dari ${d.diminta} butir ${d.bloomLevel}`).join(', ')}
               — kesimpulan ini perlu diperkuat sebelum dijadikan dasar evaluasi materi.`
            : `Perlu ditinjau apakah alokasi jam pelajaran memadai untuk level tersebut.`}
        </p>
      </div>`).join('')}
  </div>` : ''}
```

- [ ] **Step 3: Verifikasi di browser**

1. Buka bimtek **tanpa** SKL → tab Laporan → Laporan Penyelenggara.
   Diharapkan: tidak ada blok Pemenuhan SKL; laporan persis seperti sebelumnya.
2. Buka bimtek **ber-SKL** dengan post-test tersinkron.
   Diharapkan: blok Pemenuhan SKL muncul di bawah tabel per-UK, satu baris tiap UK dengan `capai/dari` dan persentase.
3. Cari UK yang persentasenya di bawah 50%.
   Diharapkan: angka merah dengan ⚠, dan kotak kuning penjelas di bawah tabel.
4. Cari UK yang blueprint-nya mencatat defisit.
   Diharapkan: kotak kuning menyebut jumlah butir yang tersedia versus yang diminta.

- [ ] **Step 4: Commit**

```bash
git add admin/js/modules/bimtek/report-api.js admin/js/modules/bimtek/sub-report-penyelenggara.js
git commit -m "feat: blok pemenuhan SKL di laporan penyelenggara

Menampilkan berapa peserta mencapai target tiap UK, dan menandai UK yang
kesimpulannya belum layak dipercaya karena bank soal kurang butir."
```

---

## Catatan Penutup

**Urutan tidak boleh diacak pada dua titik:**
- Task 2 harus mendarat sebelum Task 7, karena Task 7 mengubah `bloomLevel` yang memengaruhi hasil sinkronisasi.
- Task 5 harus mendarat sebelum Task 6, karena Task 6 menulis ke koleksi yang aturannya dipasang Task 5.

Selebihnya tiap fase berdiri sendiri dan boleh dihentikan di batas fase.

**Temuan di luar lingkup, tidak dikerjakan rencana ini:** `firestore.rules` memuat dua blok `match /bank_soal/{soalId}` (`:103-106` dan `:109-112`), yang kedua didahului komentar sisa "TAMBAHKAN di match...". Aturan Firestore meng-OR-kan blok berulang, sehingga yang berlaku adalah gabungan keduanya — termasuk `allow read: if request.auth == null` yang membuka baca seluruh bank soal tanpa autentikasi. Ini tampaknya disengaja untuk exam app yang memang tanpa autentikasi, tapi duplikasinya menyesatkan pembaca. Layak dibereskan terpisah.

# Redesain Tab Korelasi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perbaiki cacat metodologis di Tab Korelasi (`admin/js/modules/historis/tab-korelasi.js`) dengan mempensiunkan view yang punya overlap waktu X/Y (K-1, K-2, K-3), memperluas K-4A jadi tulang punggung analisis lag-safe, mengganti K-4B dengan view "Dampak" (window fleksibel + kontingensi persentase + caveat), dan mengubah K-5 jadi murni deskriptif.

**Architecture:** Perubahan terkonsentrasi di dua file: `api.js` (tambah agregasi `byYearBidang` per instansi) dan `tab-korelasi.js` (hapus 3 view lama, ubah nav & dispatcher, perluas K-4A, ganti K-4B, ubah K-5). Tidak ada perubahan schema Firestore — murni agregasi ulang dari field `bidang`+`tahun` yang sudah ada di `alumni_historis`.

**Tech Stack:** Vanilla ES modules (tanpa bundler), Tailwind + `main.css` custom classes, Chart.js (sudah dimuat global di `index.html`), Firebase Firestore.

## Global Constraints

- Tidak ada bundler — import path harus valid untuk browser (relatif, dengan ekstensi `.js`), tidak boleh `require()`/CommonJS.
- Styling: Tailwind + class dari `main.css` (`form-select`, `btam-table`, dst) saja — tidak ada Bootstrap.
- Baca file terkait (`api.js`, `tab-korelasi.js`) sebelum mengedit — jangan asumsikan nama field.
- Proyek ini **tidak punya test framework otomatis** (tidak ada `package.json`/Jest/dsb). Setiap task diverifikasi manual di browser (buka halaman admin `/historis` → tab Korelasi, cek console tanpa error, cek visual) — bukan `pytest`/`jest` seperti pada proyek dgn test runner.

---

## Task 1: Tambah agregasi `byYearBidang` di `getKorelasiData()`

**Files:**
- Modify: `admin/js/modules/historis/api.js:362-386` (blok agregasi `alumniMap`)

**Interfaces:**
- Produces: tiap elemen hasil `getKorelasiData()` sekarang punya `alumni.byYearBidang: { [tahun: string]: { produksi?: number, trandis?: number, me?: number, pendukung?: number, multi_bidang?: number } }` — dipakai Task 3 (K-4A breakdown bidang) dan Task 4 (view Dampak, window fleksibel).

- [ ] **Step 1: Baca ulang blok agregasi alumni untuk memastikan nama field**

Baca `admin/js/modules/historis/api.js:362-386` — pastikan field `r.bidang` dan `r.tahun` seperti yang sudah dipakai di `a.byBidang` dan `a.byYear`.

- [ ] **Step 2: Tambah inisialisasi & akumulasi `byYearBidang`**

Di `admin/js/modules/historis/api.js`, ubah blok berikut (sekitar baris 367-386):

```js
    if (!alumniMap[r.instansi]) {
      alumniMap[r.instansi] = {
        total: 0, total5yr: 0,
        byYear: {}, byBidang: {}, byBimtek: {},
        byYearBidang: {},
        bimtekEvents: new Set(),
        provinsi: null, kab_kota: null,
      };
    }
    const a = alumniMap[r.instansi];
    a.total++;
    if (r.tahun >= CUTOFF_5YR) a.total5yr++;
    if (r.tahun) a.byYear[r.tahun] = (a.byYear[r.tahun] || 0) + 1;
    if (r.bidang) a.byBidang[r.bidang] = (a.byBidang[r.bidang] || 0) + 1;
    if (r.tahun && r.bidang) {
      if (!a.byYearBidang[r.tahun]) a.byYearBidang[r.tahun] = {};
      a.byYearBidang[r.tahun][r.bidang] = (a.byYearBidang[r.tahun][r.bidang] || 0) + 1;
    }
    if (r.nama_bimtek) {
      a.byBimtek[r.nama_bimtek] = (a.byBimtek[r.nama_bimtek] || 0) + 1;
      a.bimtekEvents.add(`${r.nama_bimtek}|${r.tahun}`);
    }
    if (!a.provinsi  && r.provinsi)  a.provinsi  = r.provinsi;
    if (!a.kab_kota  && r.kab_kota)  a.kab_kota  = r.kab_kota;
```

- [ ] **Step 3: Sertakan `byYearBidang` di output `result.push`**

Di blok yang sama file, cari (sekitar baris 430-437):

```js
      alumni: {
        total:     a.total,
        total5yr:  a.total5yr,
        eventUnik: a.bimtekEvents.size,
        byYear:    a.byYear,
        byBidang:  a.byBidang,
        byBimtek:  a.byBimtek,
      },
```

Ubah jadi:

```js
      alumni: {
        total:        a.total,
        total5yr:     a.total5yr,
        eventUnik:    a.bimtekEvents.size,
        byYear:       a.byYear,
        byBidang:     a.byBidang,
        byBimtek:     a.byBimtek,
        byYearBidang: a.byYearBidang,
      },
```

- [ ] **Step 4: Verifikasi manual di browser**

Buka aplikasi admin (mis. `python -m http.server 8000` dari root repo, lalu buka `http://localhost:8000/admin/#/historis`), login, buka tab Korelasi. Di DevTools Console jalankan:

```js
import('./js/modules/historis/api.js').then(async m => {
  const d = await m.getKorelasiData();
  console.log(d.find(x => x.alumni)?.alumni.byYearBidang);
});
```

Expected: object dengan key tahun berisi count per bidang (bukan `undefined`), tidak ada error di console.

- [ ] **Step 5: Commit**

```bash
git add admin/js/modules/historis/api.js
git commit -m "feat: tambah agregasi byYearBidang di getKorelasiData"
```

---

## Task 2: Hapus view K-1, K-2, K-3 dari nav & dispatcher

**Files:**
- Modify: `admin/js/modules/historis/tab-korelasi.js:1-19` (state)
- Modify: `admin/js/modules/historis/tab-korelasi.js:22-42` (`renderKorelasiTab`)
- Modify: `admin/js/modules/historis/tab-korelasi.js:94-107` (nav buttons di `_renderShell`)
- Modify: `admin/js/modules/historis/tab-korelasi.js:135-143` (`_refresh` dispatcher)
- Modify: `admin/js/modules/historis/tab-korelasi.js:145-436` (hapus `_renderK1`, `_renderK2`, `_renderK3`, `_runK3` beserta komentar section-nya)
- Modify: `admin/js/modules/historis/tab-korelasi.js:1197-1204` (hapus `_allBimtekNames`, sudah tidak dipakai)

**Interfaces:**
- Consumes: tidak ada dependency baru dari task lain.
- Produces: nav Korelasi tersisa `['k4', 'K-4 Waktu'], ['k5', 'K-5 Provinsi'], ['tabel', 'Tabel'], ['diagnostik', 'Diagnostik']`; default `_view` berubah dari `'k1'` jadi `'k4'`.

- [ ] **Step 1: Update state awal**

Di `admin/js/modules/historis/tab-korelasi.js:6-18`, ganti:

```js
let _view       = 'k1';
let _sub        = { k1: 'A', k2: 'A', k4: 'A' };
let _k3x        = '';
let _k3y        = 'total_latest';
```

jadi:

```js
let _view       = 'k4';
let _sub        = { k4: 'A' };
```

- [ ] **Step 2: Update reset state di `renderKorelasiTab`**

Di `admin/js/modules/historis/tab-korelasi.js:30-32`, ganti:

```js
  _selected = null; _filterProv = ''; _filterStat = 'all';
  _view = 'k1'; _sub = { k1: 'A', k2: 'A', k4: 'A' };
  _k3x = ''; _k3y = 'total_latest';
  _destroyCharts();
```

jadi:

```js
  _selected = null; _filterProv = ''; _filterStat = 'all';
  _view = 'k4'; _sub = { k4: 'A' };
  _destroyCharts();
```

- [ ] **Step 3: Update daftar nav button**

Di `admin/js/modules/historis/tab-korelasi.js:96-106`, ganti:

```js
        ${[
          ['k1',         'K-1 Intensitas'],
          ['k2',         'K-2 Bidang'],
          ['k3',         'K-3 Explorer'],
          ['k4',         'K-4 Waktu'],
          ['k5',         'K-5 Provinsi'],
          ['tabel',      'Tabel'],
          ['diagnostik', 'Diagnostik'],
        ].map(([v, lbl]) =>
```

jadi:

```js
        ${[
          ['k4',         'K-4 Waktu'],
          ['k5',         'K-5 Provinsi'],
          ['tabel',      'Tabel'],
          ['diagnostik', 'Diagnostik'],
        ].map(([v, lbl]) =>
```

- [ ] **Step 4: Update dispatcher `_refresh`**

Di `admin/js/modules/historis/tab-korelasi.js:135-143`, ganti:

```js
function _refresh() {
  if (_view === 'k1')         _renderK1();
  else if (_view === 'k2')    _renderK2();
  else if (_view === 'k3')    _renderK3();
  else if (_view === 'k4')    _renderK4();
  else if (_view === 'k5')    _renderK5();
  else if (_view === 'tabel') _renderTabel();
  else                        _renderDiagnostik();
}
```

jadi:

```js
function _refresh() {
  if (_view === 'k4')         _renderK4();
  else if (_view === 'k5')    _renderK5();
  else if (_view === 'tabel') _renderTabel();
  else                        _renderDiagnostik();
}
```

- [ ] **Step 5: Hapus fungsi `_renderK1`, `_renderK2`, `_renderK3`, `_runK3`**

Hapus seluruh blok dari komentar `// ─── K-1: Intensitas Bimtek → Tren Kinerja ───` (baris 145) sampai tepat sebelum `// ─── K-4: Efek Waktu ───` (baris 438) di `admin/js/modules/historis/tab-korelasi.js`. Ini menghapus `_renderK1`, `_renderK2`, `_renderK3`, `_runK3` sekaligus.

- [ ] **Step 6: Hapus `_allBimtekNames` (dead code setelah K-3 dihapus)**

Hapus fungsi `_allBimtekNames` di `admin/js/modules/historis/tab-korelasi.js:1197-1204` (setelah Step 5, nomor baris akan bergeser — cari via `grep -n "_allBimtekNames"`).

- [ ] **Step 7: Verifikasi manual di browser**

Buka tab Korelasi. Expected: nav cuma tampil "K-4 Waktu / K-5 Provinsi / Tabel / Diagnostik", default landing di K-4A, tidak ada error console soal fungsi undefined.

- [ ] **Step 8: Commit**

```bash
git add admin/js/modules/historis/tab-korelasi.js
git commit -m "refactor: pensiunkan K-1/K-2/K-3 dari Tab Korelasi (overlap waktu X/Y)"
```

---

## Task 3: Perluas K-4A dengan breakdown bidang

**Files:**
- Modify: `admin/js/modules/historis/tab-korelasi.js` (fungsi `_renderK4A`, sekitar baris 464-521 sebelum Task 2 — cari via `grep -n "_renderK4A"` setelah Task 2 diterapkan)

**Interfaces:**
- Consumes: `alumni.byYearBidang[tahun][bidang]` dari Task 1.
- Produces: tidak ada — task terminal untuk K-4A.

- [ ] **Step 1: Baca fungsi `_renderK4A` saat ini**

Jalankan `grep -n "_renderK4A" -A 60 admin/js/modules/historis/tab-korelasi.js` untuk melihat isi terkini (nomor baris sudah bergeser setelah Task 2).

- [ ] **Step 2: Tambah state pilihan bidang**

Di deklarasi state atas file (`admin/js/modules/historis/tab-korelasi.js`, dekat `let _sub`), tambah:

```js
let _k4Bidang = '';
```

- [ ] **Step 3: Tambah dropdown bidang & filter X berdasar bidang**

Ganti isi `_renderK4A` — bagian `PAIRS` dan `isFirst` tetap sama, tapi ubah bagian membangun `points` dan tambahkan dropdown di `el.innerHTML`. Bentuk akhir fungsi:

```js
function _renderK4A() {
  const el = document.getElementById('k4-content');

  const PAIRS = [
    { t: '2020', t1: '2021', label: 'Bimtek 2020 → Kinerja 2021' },
    { t: '2021', t1: '2022', label: 'Bimtek 2021 → Δ Kinerja 2022−2021' },
    { t: '2022', t1: '2023', label: 'Bimtek 2022 → Δ Kinerja 2023−2022' },
  ];
  let selPair = 0;

  const BIDANG_OPTIONS = [
    { v: '',            l: 'Semua Bidang' },
    { v: 'produksi',    l: 'Produksi' },
    { v: 'trandis',     l: 'Trandis' },
    { v: 'me',          l: 'ME' },
    { v: 'pendukung',   l: 'Pendukung' },
  ];

  const xForRow = (d, tahun) => {
    if (!_k4Bidang) return d.alumni.byYear[tahun] ?? 0;
    return d.alumni.byYearBidang?.[tahun]?.[_k4Bidang] ?? 0;
  };

  const render = () => {
    const p = PAIRS[selPair];
    const isFirst = selPair === 0;

    const points = _filtered()
      .filter(d => d.alumni && d.kinerja)
      .map(d => {
        const xVal = xForRow(d, p.t);
        const k1 = d.kinerja.byYear[p.t1]?.total;
        const k0 = isFirst ? null : d.kinerja.byYear[p.t]?.total;
        const yVal = isFirst ? k1 : (k1 != null && k0 != null ? k1 - k0 : null);
        return {
          x: xVal, y: yVal,
          instansi: d.instansi, provinsi: d.provinsi,
          kategori: _latestKat(d),
        };
      })
      .filter(p => p.y !== null);

    const bidangLabel = BIDANG_OPTIONS.find(b => b.v === _k4Bidang)?.l ?? 'Semua Bidang';

    el.innerHTML = `
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2 items-center">
          ${PAIRS.map((pr, i) =>
            `<button class="k4a-pair px-3 py-1.5 rounded-lg text-xs ${i === selPair ? 'bg-gray-700 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400'} transition-colors" data-i="${i}">${_esc(pr.label)}</button>`
          ).join('')}
          <select id="k4a-bidang" class="form-select text-xs ml-2">
            ${BIDANG_OPTIONS.map(b => `<option value="${b.v}"${b.v === _k4Bidang ? ' selected' : ''}>${b.l}</option>`).join('')}
          </select>
        </div>
        <p class="text-xs text-gray-500">
          ${isFirst ? `Peserta bimtek BTAM (${_esc(bidangLabel)}) tahun ${p.t} → skor kinerja tahun ${p.t1}` :
                      `Peserta bimtek BTAM (${_esc(bidangLabel)}) tahun ${p.t} → perubahan skor kinerja ${p.t}→${p.t1}`}
        </p>
        <p class="text-xs text-gray-600">Hypothesis-generating — N kecil per kombinasi, bukan bukti kausal.</p>
        <div id="k4a-chart"></div>
      </div>`;

    document.querySelectorAll('.k4a-pair').forEach(b => {
      b.addEventListener('click', () => { selPair = +b.dataset.i; render(); });
    });
    document.getElementById('k4a-bidang').addEventListener('change', e => {
      _k4Bidang = e.target.value; render();
    });

    _scatter('k4a-chart', points, {
      xLabel:   `Peserta Bimtek ${p.t}${_k4Bidang ? ` (${bidangLabel})` : ''}`,
      yLabel:   isFirst ? `Skor Kinerja ${p.t1}` : `Δ Kinerja ${p.t}→${p.t1}`,
      title:    `K-4A — ${p.label}`,
      subtitle: `${points.length} instansi dengan data lengkap · ${bidangLabel}`,
      zeroLine: !isFirst,
    });
  };

  render();
}
```

- [ ] **Step 4: Verifikasi manual di browser**

Buka K-4 Waktu (default landing). Ganti dropdown bidang ke "Trandis" — chart harus re-render, subtitle N harus berubah (biasanya lebih kecil dari "Semua Bidang"). Ganti kembali ke "Semua Bidang" — hasil harus identik dengan sebelum Task 3 (regresi tidak berubah untuk kasus default).

- [ ] **Step 5: Commit**

```bash
git add admin/js/modules/historis/tab-korelasi.js
git commit -m "feat: tambah breakdown bidang di K-4A Lag Tahun"
```

---

## Task 4: Ganti K-4B dengan view "Dampak" (window fleksibel + kontingensi %)

**Files:**
- Modify: `admin/js/modules/historis/tab-korelasi.js` (hapus sub-tab K-4B dari `_renderK4`, tambah fungsi `_renderK4B` versi baru — nama fungsi dipertahankan untuk minim perubahan wiring, tapi isinya total baru)

**Interfaces:**
- Consumes: `d.alumni.byYear[tahun]` (count peserta per tahun, sudah ada di data existing), `d.kinerja.byYear['2021'|'2023'].kategori` dan `.total`.
- Produces: tidak ada — task terminal untuk view Dampak.

- [ ] **Step 1: Tambah state window**

Di deklarasi state atas file, dekat `_k4Bidang` (Task 3), tambah:

```js
let _dampakWindow = 2; // tahun sebelum 2021
```

- [ ] **Step 2: Tulis ulang `_renderK4B` (isi view Dampak)**

Jalankan `grep -n "_renderK4B" admin/js/modules/historis/tab-korelasi.js` untuk lokasi fungsi terkini, lalu ganti seluruh isi fungsi jadi:

```js
function _renderK4B() {
  if (_charts.main) { _charts.main.destroy(); delete _charts.main; }
  const el = document.getElementById('k4-content');

  const WINDOW_OPTIONS = [1, 2, 3, 5];
  const BASE_YEAR = 2021, END_YEAR = 2023;

  const group = total =>
    total === 0 ? 'Tidak Ada' :
    total <= 10  ? 'Rendah (1–10)' :
    total <= 30  ? 'Sedang (11–30)' : 'Tinggi (31+)';

  const GROUPS = ['Tidak Ada', 'Rendah (1–10)', 'Sedang (11–30)', 'Tinggi (31+)'];
  const KAT_RANK = { SEHAT: 3, 'KURANG SEHAT': 2, SAKIT: 1 };

  const windowStart = BASE_YEAR - _dampakWindow;
  const windowEnd   = BASE_YEAR - 1;

  const matrix = {};
  GROUPS.forEach(g => { matrix[g] = { naik: 0, tetap: 0, turun: 0, na: 0, deltas: [] }; });

  let excluded = 0;

  _filtered().forEach(d => {
    const k21 = d.kinerja?.byYear?.[String(BASE_YEAR)];
    const k23 = d.kinerja?.byYear?.[String(END_YEAR)];
    if (!k21 || !k23) { excluded++; return; }

    let intensitas = 0;
    for (let y = windowStart; y <= windowEnd; y++) {
      intensitas += d.alumni?.byYear?.[String(y)] ?? 0;
    }
    const g = group(intensitas);

    let trans = 'na';
    if (k21.kategori && k23.kategori) {
      const r21 = KAT_RANK[k21.kategori] ?? 0;
      const r23 = KAT_RANK[k23.kategori] ?? 0;
      trans = r23 > r21 ? 'naik' : r23 < r21 ? 'turun' : 'tetap';
    }
    matrix[g][trans]++;

    if (k21.total != null && k23.total != null) {
      matrix[g].deltas.push(k23.total - k21.total);
    }
  });

  const rowTotal = g => matrix[g].naik + matrix[g].tetap + matrix[g].turun + matrix[g].na;
  const pct = (n, total) => total === 0 ? '–' : `${Math.round((n / total) * 100)}%`;
  const avgDelta = g => {
    const arr = matrix[g].deltas;
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };

  el.innerHTML = `
    <div class="space-y-4">
      <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3">
        <p class="text-xs text-yellow-400 font-semibold mb-1">⚠️ Asosiasi, bukan bukti sebab-akibat</p>
        <p class="text-xs text-gray-400">
          Belum mengontrol ukuran/kapasitas PDAM. Perhatikan N per sel — sel dengan N kecil (redup di bawah)
          tidak bisa disimpulkan.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-400">Window intensitas: N tahun sebelum ${BASE_YEAR}</label>
        <select id="dampak-window" class="form-select text-xs">
          ${WINDOW_OPTIONS.map(w => `<option value="${w}"${w === _dampakWindow ? ' selected' : ''}>${w} tahun (${BASE_YEAR - w}–${BASE_YEAR - 1})</option>`).join('')}
        </select>
      </div>

      <p class="text-xs text-gray-500">
        Grup intensitas dihitung dari peserta bimtek ${windowStart}–${windowEnd} saja (sebelum window kinerja).
        Outcome: transisi kategori kinerja ${BASE_YEAR}→${END_YEAR}. ${excluded} instansi dikecualikan (data kinerja ${BASE_YEAR}/${END_YEAR} tidak lengkap).
      </p>

      <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table class="btam-table text-xs w-full">
          <thead>
            <tr>
              <th>Intensitas (${windowStart}–${windowEnd})</th>
              <th class="text-center text-emerald-400">Naik</th>
              <th class="text-center text-gray-400">Tetap</th>
              <th class="text-center text-red-400">Turun</th>
              <th class="text-center text-gray-600">Tdk Lengkap</th>
              <th class="text-center text-white">N</th>
              <th class="text-center text-blue-400">Rata² Δ Skor</th>
            </tr>
          </thead>
          <tbody>
            ${GROUPS.map(g => {
              const n = rowTotal(g);
              const dim = n < 5 ? ' text-gray-600 italic' : '';
              const ad  = avgDelta(g);
              return `
              <tr class="${dim}">
                <td class="font-medium text-white">${g}</td>
                <td class="text-center text-emerald-400">${pct(matrix[g].naik, n)}</td>
                <td class="text-center text-gray-400">${pct(matrix[g].tetap, n)}</td>
                <td class="text-center text-red-400">${pct(matrix[g].turun, n)}</td>
                <td class="text-center text-gray-600">${pct(matrix[g].na, n)}</td>
                <td class="text-center text-white">${n}</td>
                <td class="text-center text-blue-400">${ad === null ? '–' : (ad >= 0 ? '+' : '') + ad.toFixed(2)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('dampak-window').addEventListener('change', e => {
    _dampakWindow = +e.target.value; _renderK4B();
  });
}
```

- [ ] **Step 3: Ganti label tombol sub-tab K-4B**

Di fungsi `_renderK4`, ganti teks tombol `data-sub="B"` dari `K-4B Transisi Kategori` jadi `K-4B Dampak (Grup Intensitas)` — cari string ini di `admin/js/modules/historis/tab-korelasi.js` (di dalam `_renderK4`).

- [ ] **Step 4: Verifikasi manual di browser**

Buka K-4 Waktu → sub-tab K-4B. Expected: banner caveat tampil, tabel kontingensi tampil dgn kolom persen + N + Δ skor, ganti dropdown window ke "1 tahun" dan "5 tahun" — angka N & persentase harus berubah sesuai window, baris dgn N<5 tampak redup/italic, tidak ada error console.

- [ ] **Step 5: Commit**

```bash
git add admin/js/modules/historis/tab-korelasi.js
git commit -m "feat: ganti K-4B jadi view Dampak (window fleksibel, kontingensi %, caveat)"
```

---

## Task 5: Ubah K-5 jadi deskriptif murni (hapus klaim korelasi)

**Files:**
- Modify: `admin/js/modules/historis/tab-korelasi.js` (fungsi `_renderK5`, cari via `grep -n "_renderK5"`)

**Interfaces:**
- Consumes: `_filtered()`, `_latestV(d, 'total')` — sudah ada.
- Produces: tidak ada — task terminal.

- [ ] **Step 1: Baca fungsi `_renderK5` saat ini**

`grep -n "_renderK5" -A 45 admin/js/modules/historis/tab-korelasi.js`

- [ ] **Step 2: Ganti isi fungsi jadi list deskriptif (bukan scatter)**

Ganti seluruh isi `_renderK5` jadi:

```js
function _renderK5() {
  const el = document.getElementById('kor-sub-content');

  const provMap = {};
  _filtered().forEach(d => {
    const prov = d.provinsi;
    if (!prov) return;
    if (!provMap[prov]) provMap[prov] = { bimtek: 0, scores: [], count: 0 };
    const p = provMap[prov];
    if (d.alumni) p.bimtek += d.alumni.total;
    const v = _latestV(d, 'total');
    if (v !== null) { p.scores.push(v); p.count++; }
  });

  const rows = Object.entries(provMap)
    .map(([prov, p]) => ({
      prov,
      bimtek:    p.bimtek,
      avgSkor:   p.scores.length ? p.scores.reduce((a,b) => a+b, 0) / p.scores.length : null,
      nInstansi: p.count,
    }))
    .sort((a, b) => b.bimtek - a.bimtek);

  el.innerHTML = `
    <div class="space-y-4">
      <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3">
        <p class="text-xs text-yellow-400 font-semibold mb-1">⚠️ Deskriptif, bukan korelasi</p>
        <p class="text-xs text-gray-400">
          Dua angka independen per provinsi (jangkauan bimtek, rata-rata kinerja terkini) — bukan pasangan
          X/Y yang dihubungkan. Pola di level provinsi tidak mewakili pola di level instansi individual
          (ecological fallacy).
        </p>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table class="btam-table text-xs w-full">
          <thead>
            <tr>
              <th>Provinsi</th>
              <th class="text-center">Total Peserta Bimtek</th>
              <th class="text-center">Rata-rata Skor Kinerja</th>
              <th class="text-center">N PDAM (data kinerja)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="font-medium text-white">${_esc(r.prov)}</td>
                <td class="text-center text-blue-400">${r.bimtek}</td>
                <td class="text-center text-emerald-400">${r.avgSkor === null ? '–' : r.avgSkor.toFixed(2)}</td>
                <td class="text-center text-gray-400">${r.nInstansi}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}
```

- [ ] **Step 3: Verifikasi manual di browser**

Buka K-5 Provinsi. Expected: banner "Deskriptif, bukan korelasi" tampil, tabel terurut menurun by total peserta bimtek (bukan scatter/chart lagi), tidak ada error console soal `_scatter` yang hilang referensinya di view ini.

- [ ] **Step 4: Commit**

```bash
git add admin/js/modules/historis/tab-korelasi.js
git commit -m "refactor: K-5 jadi tabel deskriptif murni, hapus klaim korelasi provinsi"
```

---

## Task 6: Verifikasi akhir end-to-end

**Files:** tidak ada perubahan file — task verifikasi murni.

- [ ] **Step 1: Full manual walkthrough di browser**

Dengan data korelasi nyata ter-load (butuh `alumni_historis` + `kinerja_instansi` sudah terisi di Firestore project), buka tab Korelasi dan cek satu per satu:
- Nav hanya menampilkan K-4 Waktu / K-5 Provinsi / Tabel / Diagnostik (K-1/K-2/K-3 sudah hilang).
- K-4A: ganti pair tahun dan dropdown bidang, chart re-render tanpa error.
- K-4B (dalam K-4 Waktu): ganti window 1/2/3/5 tahun, tabel persentase & N berubah, banner caveat selalu tampil.
- K-5: tabel deskriptif tampil terurut, banner caveat tampil, tidak ada garis regresi/scatter.
- Tabel & Diagnostik: tidak berubah perilaku dari sebelumnya (regresi cepat).

- [ ] **Step 2: Cek console browser bersih**

Buka DevTools Console selama seluruh walkthrough Step 1 — pastikan tidak ada error/warning baru yang muncul (selain warning pre-existing yang sudah ada sebelum perubahan ini, jika ada).

- [ ] **Step 3: Update spec doc status (opsional, jika ditemukan penyesuaian selama implementasi)**

Kalau ada penyesuaian dari spec (`docs/superpowers/specs/2026-08-07-tab-korelasi-redesign-design.md`) yang terjadi selama implementasi, tambahkan catatan singkat di akhir file spec tsb mencatat perbedaannya.

- [ ] **Step 4: Commit final (jika ada perubahan dari Step 3)**

```bash
git add docs/superpowers/specs/2026-08-07-tab-korelasi-redesign-design.md
git commit -m "docs: catat penyesuaian implementasi redesain Tab Korelasi"
```

// admin/js/modules/historis/tab-korelasi.js
// Tab Korelasi: analisis hubungan peserta bimtek BTAM ↔ kinerja PDAM (BPPSPAM).

import { getKorelasiData } from './api.js';

// ─── State ────────────────────────────────────────────────────────────────────

let _data       = null;
let _charts     = {};
let _selected   = null;
let _filterProv = '';
let _filterStat = 'all';
let _view       = 'k4';
let _sub        = { k4: 'A' };
let _sortKey    = 'instansi';
let _sortDir    = 1;
let _k4Bidang   = '';

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function renderKorelasiTab() {
  const el = document.getElementById('tab-content');
  el.innerHTML = `
    <div class="flex items-center gap-2 text-sm text-gray-400 py-8">
      <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      Memuat data korelasi…
    </div>`;

  _selected = null; _filterProv = ''; _filterStat = 'all';
  _view = 'k4'; _sub = { k4: 'A' };
  _destroyCharts();

  try {
    _data = await getKorelasiData();
  } catch (err) {
    el.innerHTML = `<p class="text-sm text-red-400">Gagal memuat: ${err.message}</p>`;
    return;
  }
  _renderShell(el);
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function _renderShell(el) {
  const provList = [...new Set(_data.map(d => d.provinsi).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id'));
  const matched     = _data.filter(d => d.alumni && d.kinerja).length;
  const alumniOnly  = _data.filter(d => d.alumni && !d.kinerja).length;
  const kinerjaOnly = _data.filter(d => !d.alumni && d.kinerja).length;

  el.innerHTML = `
    <div class="space-y-5">
      <!-- Summary cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p class="text-xl font-bold text-white">${_data.length}</p>
          <p class="text-xs text-gray-500">Total Instansi</p>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p class="text-xl font-bold text-green-400">${matched}</p>
          <p class="text-xs text-gray-500">Data Lengkap</p>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p class="text-xl font-bold text-blue-400">${alumniOnly}</p>
          <p class="text-xs text-gray-500">Hanya Bimtek</p>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p class="text-xl font-bold text-purple-400">${kinerjaOnly}</p>
          <p class="text-xs text-gray-500">Hanya Kinerja</p>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap gap-3 items-center">
        <select id="kor-filter-prov" class="form-select text-xs">
          <option value="">Semua Provinsi</option>
          ${provList.map(p => `<option value="${_esc(p)}">${_esc(p)}</option>`).join('')}
        </select>
        <select id="kor-filter-stat" class="form-select text-xs">
          <option value="all">Semua Status</option>
          <option value="matched">Data Lengkap</option>
          <option value="alumni_only">Hanya Bimtek</option>
          <option value="kinerja_only">Hanya Kinerja</option>
        </select>
      </div>

      ${matched === 0 ? `
      <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
        <p class="text-xs font-semibold text-yellow-400 mb-1">⚠️ Tidak ada instansi yang cocok antara data bimtek dan data kinerja</p>
        <p class="text-xs text-gray-400 mb-2">Import data kinerja terlebih dahulu, atau periksa kecocokan nama instansi via tab Diagnostik.</p>
      </div>` : ''}

      <!-- Navigasi korelasi -->
      <div class="flex flex-wrap gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        ${[
          ['k4',         'K-4 Waktu'],
          ['k5',         'K-5 Provinsi'],
          ['tabel',      'Tabel'],
          ['diagnostik', 'Diagnostik'],
        ].map(([v, lbl]) =>
          `<button class="kor-nav-btn px-3 py-2 rounded-lg text-xs font-medium transition-colors" data-view="${v}">${lbl}</button>`
        ).join('')}
      </div>

      <div id="kor-sub-content"></div>
      <div id="kor-detail" class="hidden"></div>
    </div>`;

  document.getElementById('kor-filter-prov').addEventListener('change', e => { _filterProv = e.target.value; _refresh(); });
  document.getElementById('kor-filter-stat').addEventListener('change', e => { _filterStat = e.target.value; _refresh(); });
  document.querySelectorAll('.kor-nav-btn').forEach(b => {
    b.addEventListener('click', () => _switchView(b.dataset.view));
  });
  _switchView(_view);
}

function _switchView(v) {
  _view = v;
  document.querySelectorAll('.kor-nav-btn').forEach(b => {
    const on = b.dataset.view === v;
    b.classList.toggle('bg-gray-700', on);
    b.classList.toggle('text-white', on);
    b.classList.toggle('text-gray-400', !on);
  });
  _destroyCharts();
  document.getElementById('kor-detail').classList.add('hidden');
  _selected = null;
  _refresh();
}

function _refresh() {
  if (_view === 'k4')         _renderK4();
  else if (_view === 'k5')    _renderK5();
  else if (_view === 'tabel') _renderTabel();
  else                        _renderDiagnostik();
}

// ─── K-4: Efek Waktu ──────────────────────────────────────────────────────────

function _renderK4() {
  const el  = document.getElementById('kor-sub-content');
  const sub = _sub.k4;

  el.innerHTML = `
    <div class="space-y-4">
      <div class="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button class="k4-sub px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" data-sub="A">K-4A Lag Tahun</button>
        <button class="k4-sub px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" data-sub="B">K-4B Transisi Kategori</button>
      </div>
      <div id="k4-content"></div>
    </div>`;

  document.querySelectorAll('.k4-sub').forEach(b => {
    const on = b.dataset.sub === sub;
    b.classList.toggle('bg-gray-700', on); b.classList.toggle('text-white', on);
    b.classList.toggle('text-gray-400', !on);
    b.addEventListener('click', () => { _sub.k4 = b.dataset.sub; _renderK4(); });
  });

  if (sub === 'A') _renderK4A();
  else             _renderK4B();
}

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

function _renderK4B() {
  if (_charts.main) { _charts.main.destroy(); delete _charts.main; }
  const el = document.getElementById('k4-content');

  // Kelompok intensitas
  const group = total =>
    total === 0 ? 'Tidak Ada' :
    total <= 10  ? 'Rendah (1–10)' :
    total <= 30  ? 'Sedang (11–30)' : 'Tinggi (31+)';

  const GROUPS = ['Tidak Ada', 'Rendah (1–10)', 'Sedang (11–30)', 'Tinggi (31+)'];
  const TRANS  = { naik: 'Naik', tetap: 'Tetap', turun: 'Turun', 'n/a': 'Tidak Lengkap' };
  const KAT_RANK = { SEHAT: 3, 'KURANG SEHAT': 2, SAKIT: 1 };

  const matrix = {};
  GROUPS.forEach(g => { matrix[g] = { naik: 0, tetap: 0, turun: 0, 'n/a': 0 }; });

  _filtered()
    .filter(d => d.kinerja)
    .forEach(d => {
      const total = d.alumni?.total ?? 0;
      const g     = group(total);
      const k21   = d.kinerja.byYear['2021']?.kategori;
      const k23   = d.kinerja.byYear['2023']?.kategori;

      let trans = 'n/a';
      if (k21 && k23) {
        const r21 = KAT_RANK[k21] ?? 0;
        const r23 = KAT_RANK[k23] ?? 0;
        trans = r23 > r21 ? 'naik' : r23 < r21 ? 'turun' : 'tetap';
      }
      matrix[g][trans]++;
    });

  // Bar chart data
  const labels   = GROUPS;
  const datasets = [
    { label: 'Naik',           data: labels.map(g => matrix[g].naik),  backgroundColor: 'rgba(52,211,153,0.8)' },
    { label: 'Tetap',          data: labels.map(g => matrix[g].tetap), backgroundColor: 'rgba(148,163,184,0.6)' },
    { label: 'Turun',          data: labels.map(g => matrix[g].turun), backgroundColor: 'rgba(248,113,113,0.8)' },
    { label: 'Tidak Lengkap',  data: labels.map(g => matrix[g]['n/a']), backgroundColor: 'rgba(75,85,99,0.5)' },
  ];

  el.innerHTML = `
    <div class="space-y-3">
      <p class="text-xs text-gray-500">
        Kelompok instansi berdasarkan intensitas bimtek BTAM (total lifetime), dibandingkan dengan
        <strong class="text-white">perubahan kategori kinerja 2021→2023</strong>.
      </p>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div style="height:300px;position:relative;"><canvas id="chart-k4b"></canvas></div>
      </div>
      <!-- Tabel ringkasan -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table class="btam-table text-xs w-full">
          <thead><tr><th>Intensitas Bimtek</th><th class="text-center text-emerald-400">Naik</th><th class="text-center text-gray-400">Tetap</th><th class="text-center text-red-400">Turun</th><th class="text-center text-gray-600">N/A</th></tr></thead>
          <tbody>
            ${GROUPS.map(g => `
              <tr>
                <td class="font-medium text-white">${g}</td>
                <td class="text-center text-emerald-400">${matrix[g].naik}</td>
                <td class="text-center text-gray-400">${matrix[g].tetap}</td>
                <td class="text-center text-red-400">${matrix[g].turun}</td>
                <td class="text-center text-gray-600">${matrix[g]['n/a']}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  if (_charts.k4b) { _charts.k4b.destroy(); delete _charts.k4b; }
  const ctx = document.getElementById('chart-k4b').getContext('2d');
  _charts.k4b = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af', boxWidth: 14, font: { size: 10 } } },
        tooltip: { backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1, bodyColor: '#9ca3af' },
      },
      scales: {
        x: { stacked: false, ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
        y: { stacked: false, beginAtZero: true, ticks: { color: '#6b7280', precision: 0 }, grid: { color: '#1f2937' } },
      },
    },
  });
}

// ─── K-5: Agregasi Provinsi ───────────────────────────────────────────────────

function _renderK5() {
  const el = document.getElementById('kor-sub-content');

  // Agregasi per provinsi
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

  const points = Object.entries(provMap)
    .filter(([, p]) => p.scores.length > 0)
    .map(([prov, p]) => ({
      x:        p.bimtek,
      y:        p.scores.reduce((a,b) => a+b, 0) / p.scores.length,
      instansi: prov,
      provinsi: prov,
      kategori: null,
      extra:    `${p.count} PDAM dengan data kinerja`,
    }))
    .sort((a, b) => b.y - a.y);

  el.innerHTML = `
    <div class="space-y-4">
      <p class="text-xs text-gray-500">
        Total peserta bimtek BTAM per provinsi vs rata-rata skor kinerja PDAM di provinsi tersebut.
        Satu titik = satu provinsi.
      </p>
      <div id="k5-chart"></div>
    </div>`;

  _scatter('k5-chart', points, {
    xLabel:   'Total Peserta Bimtek dari Provinsi',
    yLabel:   'Rata-rata Skor Kinerja PDAM',
    title:    'K-5 — Agregasi Provinsi: Intensitas Bimtek → Rata-rata Kinerja',
    subtitle: `${points.length} provinsi`,
    isProvinsi: true,
  });
}

// ─── Scatter helper ───────────────────────────────────────────────────────────

function _scatter(containerId, points, { xLabel, yLabel, title, subtitle, zeroLine, isProvinsi, colorByTren, showRegression, dotColorFn, legendItems } = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (_charts.main) { _charts.main.destroy(); delete _charts.main; }

  if (!points.length) {
    el.innerHTML = `<div class="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      <p class="text-sm text-gray-500">Tidak ada data untuk filter yang dipilih.</p></div>`;
    return;
  }

  const xMax = Math.max(...points.map(p => p.x), 0);

  // OLS regression line + Pearson r
  let rValue = null, regrDataset = null;
  if (showRegression && points.length >= 3) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const xm = xs.reduce((a,b) => a+b, 0) / xs.length;
    const ym = ys.reduce((a,b) => a+b, 0) / ys.length;
    const num  = xs.reduce((s,x,i) => s + (x-xm)*(ys[i]-ym), 0);
    const denX = xs.reduce((s,x)   => s + (x-xm)**2, 0);
    const denY = ys.reduce((s,y)   => s + (y-ym)**2, 0);
    const sl   = denX === 0 ? 0 : num / denX;
    const ic   = ym - sl * xm;
    rValue = (denX === 0 || denY === 0) ? 0 : num / Math.sqrt(denX * denY);
    const rClr = sl > 0.001 ? 'rgba(52,211,153,0.75)' : sl < -0.001 ? 'rgba(248,113,113,0.75)' : 'rgba(156,163,175,0.5)';
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    regrDataset = {
      type: 'line', fill: false, pointRadius: 0, borderWidth: 2, borderDash: [6, 3],
      borderColor: rClr,
      data: [{ x: x0, y: ic + sl * x0 }, { x: x1, y: ic + sl * x1 }],
    };
  }
  const rBadge = rValue !== null ? (() => {
    const abs = Math.abs(rValue), sign = rValue >= 0 ? '+' : '';
    const str = abs >= 0.5 ? 'kuat' : abs >= 0.3 ? 'sedang' : 'lemah';
    const cls = rValue > 0.05 ? 'text-emerald-400' : rValue < -0.05 ? 'text-red-400' : 'text-gray-400';
    return `<span class="text-xs font-mono ${cls}">r = ${sign}${rValue.toFixed(2)}</span><span class="text-xs text-gray-600 ml-1">(${str})</span>`;
  })() : '';

  el.innerHTML = `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 class="text-sm font-semibold text-white">${_esc(title || '')}</h3>
          ${subtitle ? `<p class="text-xs text-gray-500 mt-0.5">${_esc(subtitle)}</p>` : ''}
        </div>
        ${!isProvinsi ? `<div class="flex flex-col items-end gap-1.5">
          ${rBadge ? `<div class="flex items-center gap-1.5">${rBadge}</div>` : ''}
          ${legendItems
            ? `<div class="flex flex-wrap gap-3 text-xs text-gray-400">
                ${legendItems.map(l => `<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:${l.color}"></span>${_esc(l.label)}</span>`).join('')}
              </div>`
            : colorByTren
            ? `<div class="flex flex-wrap gap-3 text-xs text-gray-400">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>Tren Naik</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-slate-500 inline-block"></span>Stabil</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400 inline-block"></span>Tren Turun</span>
              </div>`
            : `<div class="flex flex-wrap gap-3 text-xs text-gray-400">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>SEHAT</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>KURANG SEHAT</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400 inline-block"></span>SAKIT</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-slate-500 inline-block"></span>—</span>
              </div>`}
        </div>` : ''}
      </div>
      <div style="height:420px;position:relative;"><canvas id="chart-main"></canvas></div>
      <p class="text-xs text-gray-600 mt-2">${points.length} titik · klik titik untuk detail instansi</p>
    </div>`;

  const datasets = [{
    type: 'scatter',
    data:            points.map(p => ({ x: p.x, y: p.y })),
    backgroundColor: points.map(p => dotColorFn ? dotColorFn(p) : (colorByTren ? _trenBg(p.y) : _katBg(p.kategori))),
    pointRadius:     isProvinsi ? 8 : 7,
    pointHoverRadius: 11,
  }];

  if (zeroLine) {
    datasets.push({
      type: 'line',
      data: [{ x: 0, y: 0 }, { x: xMax * 1.1 || 10, y: 0 }],
      borderColor: 'rgba(156,163,175,0.35)',
      borderDash: [5, 5], borderWidth: 1,
      pointRadius: 0, fill: false,
    });
  }

  if (regrDataset) datasets.push(regrDataset);

  const ctx = document.getElementById('chart-main').getContext('2d');
  _charts.main = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex !== 0) return null;
              const p = points[ctx.dataIndex];
              if (!p) return '';
              const yFmt = typeof p.y === 'number'
                ? (Math.abs(p.y) < 10 ? p.y.toFixed(3) : p.y.toFixed(1))
                : String(p.y);
              return [
                p.instansi,
                `${xLabel}: ${p.x}  ·  ${yLabel}: ${yFmt}`,
                p.kategori ? `Kategori: ${p.kategori}` : '',
                p.extra || '',
                p.provinsi && !isProvinsi ? `Provinsi: ${p.provinsi}` : '',
              ].filter(Boolean);
            },
          },
          backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1,
          titleColor: '#f3f4f6', bodyColor: '#9ca3af',
        },
      },
      scales: {
        x: {
          title: { display: true, text: xLabel || 'X', color: '#9ca3af', font: { size: 11 } },
          beginAtZero: true,
          ticks: { color: '#6b7280', precision: 0 }, grid: { color: '#1f2937' },
        },
        y: {
          title: { display: true, text: yLabel || 'Y', color: '#9ca3af', font: { size: 11 } },
          ticks: { color: '#6b7280' }, grid: { color: '#1f2937' },
        },
      },
      onClick: (_e, els) => {
        if (!els.length || els[0].datasetIndex !== 0) return;
        const nama = points[els[0].index].instansi;
        _selected = (_selected === nama) ? null : nama;
        if (_selected) _renderDetail(_selected);
        else document.getElementById('kor-detail').classList.add('hidden');
      },
    },
  });
}

// ─── Tabel ────────────────────────────────────────────────────────────────────

function _renderTabel() {
  const rows = _filteredSorted();
  const el   = document.getElementById('kor-sub-content');

  const KAT_CLS = { SEHAT: 'text-emerald-400', 'KURANG SEHAT': 'text-yellow-400', SAKIT: 'text-red-400' };

  const thSort = (key, label) => {
    const active = _sortKey === key;
    const arrow  = active ? (_sortDir === 1 ? ' ↑' : ' ↓') : ' ↕';
    return `<th class="cursor-pointer hover:text-white select-none whitespace-nowrap" data-sk="${key}">${label}${arrow}</th>`;
  };

  const tbRows = rows.map(d => {
    const katCells = ['2021','2022','2023'].map(y => {
      const k   = d.kinerja?.byYear?.[y];
      const kat = k?.kategori ?? null;
      const tot = k?.total != null ? k.total.toFixed(2) : null;
      const cls = KAT_CLS[kat] ?? 'text-gray-700';
      return `<td class="text-center text-xs">
        ${kat ? `<span class="${cls} font-medium">${kat}</span>${tot ? `<br><span class="text-gray-600">${tot}</span>` : ''}` : '—'}
      </td>`;
    }).join('');

    const slope = _kSlope(d);
    const statusBadge = (d.alumni && d.kinerja)
      ? `<span class="badge badge-green text-xs">Lengkap</span>`
      : d.alumni ? `<span class="badge badge-blue text-xs">Bimtek</span>`
                 : `<span class="badge badge-gray text-xs">Kinerja</span>`;

    return `
      <tr class="cursor-pointer hover:bg-gray-800/60 ${_selected === d.instansi ? 'bg-gray-800' : ''}" data-nama="${_esc(d.instansi)}">
        <td><span class="font-medium text-white">${_esc(d.instansi)}</span></td>
        <td class="whitespace-nowrap text-gray-400">${_esc(d.provinsi ?? '—')}</td>
        <td class="text-center tabular-nums">${d.alumni?.total ?? '—'}</td>
        ${katCells}
        <td class="text-center">${_trenBadge(slope)}</td>
        <td>${statusBadge}</td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="btam-table text-xs w-full">
          <thead>
            <tr>
              ${thSort('instansi', 'Instansi')}
              ${thSort('provinsi', 'Provinsi')}
              ${thSort('peserta',  'Peserta Bimtek')}
              <th class="text-center">2021</th><th class="text-center">2022</th><th class="text-center">2023</th>
              <th class="text-center">Tren</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${tbRows}</tbody>
        </table>
      </div>
      <p class="text-xs text-gray-600 px-4 py-2">${rows.length} instansi · klik baris untuk detail</p>
    </div>`;

  el.querySelectorAll('th[data-sk]').forEach(th => {
    th.addEventListener('click', () => {
      _sortDir = (_sortKey === th.dataset.sk) ? _sortDir * -1 : 1;
      _sortKey = th.dataset.sk;
      _renderTabel();
    });
  });
  el.querySelectorAll('tr[data-nama]').forEach(tr => {
    tr.addEventListener('click', () => {
      const nama = tr.dataset.nama;
      _selected = (_selected === nama) ? null : nama;
      if (_selected) _renderDetail(_selected);
      else document.getElementById('kor-detail').classList.add('hidden');
      _renderTabel();
    });
  });
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function _renderDetail(nama) {
  const d = _data.find(x => x.instansi === nama);
  if (!d) return;

  ['det-kin','det-alumni'].forEach(k => {
    if (_charts[k]) { _charts[k].destroy(); delete _charts[k]; }
  });

  const panel = document.getElementById('kor-detail');
  panel.classList.remove('hidden');

  const slope    = _kSlope(d);
  const latestKat = _latestKat(d);
  const KAT_CLR  = { SEHAT: 'text-emerald-400', 'KURANG SEHAT': 'text-yellow-400', SAKIT: 'text-red-400' };

  const byYearEntries = d.kinerja?.byYear
    ? Object.entries(d.kinerja.byYear).sort(([a],[b]) => +a - +b)
    : [];
  const alumniByYear = d.alumni?.byYear
    ? Object.entries(d.alumni.byYear).sort(([a],[b]) => +a - +b)
    : [];
  const byBidang = d.alumni?.byBidang ?? {};

  panel.innerHTML = `
    <div class="bg-gray-900 border border-blue-800/40 rounded-xl p-5 space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-bold text-white">${_esc(d.instansi)}</h3>
          <p class="text-xs text-gray-500 mt-0.5">${[d.kab_kota, d.provinsi].filter(Boolean).join(', ') || '—'}</p>
          ${d.kinerja?.nama_bumd && d.kinerja.nama_bumd !== d.instansi
            ? `<p class="text-xs text-blue-400 mt-0.5">BUMD: ${_esc(d.kinerja.nama_bumd)}</p>` : ''}
        </div>
        <button id="btn-close-det" class="text-gray-600 hover:text-gray-300 text-xl flex-shrink-0">&times;</button>
      </div>

      <!-- Stat strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-lg font-bold text-blue-400">${d.alumni?.total ?? '—'}</p>
          <p class="text-xs text-gray-500">Peserta Bimtek</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-lg font-bold text-purple-400">${d.alumni?.eventUnik ?? '—'}</p>
          <p class="text-xs text-gray-500">Event Unik</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-sm font-bold ${KAT_CLR[latestKat] ?? 'text-gray-400'}">${latestKat ?? '—'}</p>
          <p class="text-xs text-gray-500">Kategori Terbaru</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <p class="text-sm font-bold">${_trenBadge(slope)}</p>
          <p class="text-xs text-gray-500">Tren OLS</p>
        </div>
      </div>

      <!-- Kinerja per tahun -->
      ${byYearEntries.length ? `
      <div>
        <p class="text-xs font-semibold text-gray-400 mb-2">Kinerja per Tahun</p>
        <div class="grid grid-cols-3 gap-2">
          ${byYearEntries.map(([y, k]) => `
            <div class="bg-gray-800 rounded-lg p-3">
              <p class="text-xs font-bold text-gray-400 mb-1">${y}</p>
              <p class="text-xs ${KAT_CLR[k.kategori] ?? 'text-gray-400'} font-medium">${k.kategori ?? '—'}</p>
              ${k.total != null ? `<p class="text-xs text-white font-bold">${k.total.toFixed(2)}</p>` : ''}
              <div class="mt-1.5 space-y-0.5 text-xs text-gray-500">
                ${k.bobot_keuangan  != null ? `<div>Keu: ${(k.bobot_keuangan*100).toFixed(0)}%</div>` : ''}
                ${k.bobot_pelayanan != null ? `<div>Lay: ${(k.bobot_pelayanan*100).toFixed(0)}%</div>` : ''}
                ${k.bobot_operasi   != null ? `<div>Ops: ${(k.bobot_operasi*100).toFixed(0)}%</div>` : ''}
                ${k.bobot_sdm       != null ? `<div>SDM: ${(k.bobot_sdm*100).toFixed(0)}%</div>` : ''}
                ${k.nrw             != null ? `<div>NRW: ${(k.nrw*100).toFixed(1)}%</div>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Charts -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${byYearEntries.length ? `
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs font-semibold text-gray-400">Tren Total Kinerja</p>
              <div class="flex gap-2 text-xs text-gray-600">
                <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>SEHAT</span>
                <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block"></span>KURANG SEHAT</span>
                <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"></span>SAKIT</span>
              </div>
            </div>
            <div style="height:180px;position:relative;"><canvas id="chart-det-kin"></canvas></div>
          </div>` : ''}
        ${alumniByYear.length ? `<div><p class="text-xs font-semibold text-gray-400 mb-2">Peserta Bimtek per Tahun</p>
          <div style="height:180px;position:relative;"><canvas id="chart-det-alumni"></canvas></div></div>` : ''}
      </div>

      <!-- Bidang breakdown -->
      ${Object.keys(byBidang).length ? `
      <div>
        <p class="text-xs font-semibold text-gray-400 mb-2">Peserta per Bidang</p>
        <div class="flex flex-wrap gap-2">
          ${Object.entries(byBidang).sort((a,b) => b[1]-a[1]).map(([b, n]) =>
            `<span class="badge badge-gray text-xs">${_esc(b)} (${n})</span>`
          ).join('')}
        </div>
      </div>` : ''}
    </div>`;

  document.getElementById('btn-close-det').addEventListener('click', () => {
    _selected = null; panel.classList.add('hidden');
  });

  // Chart kinerja
  if (byYearEntries.length) {
    const xs   = byYearEntries.map(([t]) => +t);
    const ys   = byYearEntries.map(([, v]) => v.total ?? null).filter(v => v !== null);
    const xsFil = xs.filter((_, i) => byYearEntries[i][1].total != null);
    if (ys.length >= 2) {
      const xm = xsFil.reduce((a,b) => a+b,0) / xsFil.length;
      const ym = ys.reduce((a,b) => a+b,0) / ys.length;
      const sl = xsFil.reduce((s,x,i) => s+(x-xm)*(ys[i]-ym),0) /
                 (xsFil.reduce((s,x) => s+(x-xm)**2,0) || 1);
      const ic = ym - sl * xm;
      const regrLine = xsFil.map(x => +(ic + sl * x).toFixed(3));

      _charts['det-kin'] = new Chart(
        document.getElementById('chart-det-kin').getContext('2d'),
        {
          type: 'line',
          data: {
            labels: byYearEntries.map(([t]) => t),
            datasets: [
              { label: 'Skor', data: byYearEntries.map(([,v]) => v.total ?? null),
                borderColor: '#818cf8', backgroundColor: 'rgba(129,140,248,0.12)',
                tension: 0.3, fill: true, pointRadius: 7, pointHoverRadius: 9,
                pointBackgroundColor: byYearEntries.map(([,v]) => _katPoint(v?.kategori)),
                pointBorderColor:     byYearEntries.map(([,v]) => _katPoint(v?.kategori)),
                pointBorderWidth: 2 },
              { label: 'Tren OLS', data: regrLine,
                borderColor: slope != null && slope > 0.05 ? '#34d399' : slope != null && slope < -0.05 ? '#f87171' : '#94a3b8',
                borderDash: [5,4], borderWidth: 1.5, pointRadius: 0, fill: false },
            ],
          },
          options: {
            ..._chartOpts({ yMin: 1, yMax: 5 }),
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1,
                titleColor: '#f3f4f6', bodyColor: '#9ca3af',
                callbacks: {
                  title: items => byYearEntries[items[0]?.dataIndex]?.[0] ?? '',
                  label: item => {
                    const [, v] = byYearEntries[item.dataIndex] || [];
                    return [`Skor: ${item.parsed.y?.toFixed(2) ?? '—'}`, `Kategori: ${v?.kategori ?? '—'}`];
                  },
                },
              },
            },
          },
        }
      );
    }
  }

  if (alumniByYear.length) {
    _charts['det-alumni'] = new Chart(
      document.getElementById('chart-det-alumni').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: alumniByYear.map(([t]) => t),
          datasets: [{ data: alumniByYear.map(([,v]) => v), backgroundColor: 'rgba(96,165,250,0.75)', borderRadius: 4 }],
        },
        options: _chartOpts({ yMin: 0, precision: 0 }),
      }
    );
  }

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Diagnostik ───────────────────────────────────────────────────────────────

function _renderDiagnostik() {
  const el = document.getElementById('kor-sub-content');

  const alumniNames  = _data.filter(d => d.alumni).map(d => d.instansi).sort((a,b) => a.localeCompare(b,'id'));
  const kinerjaNames = _data.filter(d => d.kinerja).map(d => d.kinerja.nama_bumd || d.instansi).sort((a,b) => a.localeCompare(b,'id'));

  const suggestions = [];
  alumniNames.forEach(a => {
    const wa = _words(a);
    let best = 0, match = null;
    kinerjaNames.forEach(k => {
      const s = _similarity(wa, _words(k));
      if (s > best) { best = s; match = k; }
    });
    if (match && best >= 0.4 && best < 1) suggestions.push({ alumni: a, kinerja: match, score: best });
  });

  el.innerHTML = `
    <div class="bg-gray-900 border border-yellow-700/40 rounded-xl p-5 space-y-4">
      <h3 class="text-sm font-semibold text-white">Diagnostik Nama Instansi</h3>
      <p class="text-xs text-gray-400">
        Nama harus <strong class="text-white">cocok setelah normalisasi</strong>
        (strip PDAM/PERUMDAM, kabupaten/kota). Perbaiki di Excel lalu re-import.
      </p>
      ${suggestions.length ? `
        <div>
          <p class="text-xs font-semibold text-yellow-400 mb-2">Kemungkinan pasangan (${suggestions.length}):</p>
          <div class="bg-gray-800 rounded-lg p-3 max-h-52 overflow-y-auto space-y-1">
            ${suggestions.slice(0,20).map(s =>
              `<div class="text-xs py-1 border-b border-gray-700 flex gap-2">
                <span class="text-blue-300 w-5/12 truncate">${_esc(s.alumni)}</span>
                <span class="text-gray-600">↔</span>
                <span class="text-purple-300 flex-1 truncate">${_esc(s.kinerja)}</span>
                <span class="text-gray-600">${Math.round(s.score*100)}%</span>
              </div>`
            ).join('')}
          </div>
        </div>` : ''}
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-xs font-semibold text-blue-400 mb-2">Instansi di data bimtek (${alumniNames.length})</p>
          <div class="bg-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto space-y-1">
            ${alumniNames.map(n => `<div class="text-xs text-blue-300 py-0.5 border-b border-gray-800 truncate">${_esc(n)}</div>`).join('')}
          </div>
        </div>
        <div>
          <p class="text-xs font-semibold text-purple-400 mb-2">Instansi di data kinerja (${kinerjaNames.length})</p>
          <div class="bg-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto space-y-1">
            ${kinerjaNames.map(n => `<div class="text-xs text-purple-300 py-0.5 border-b border-gray-800 truncate">${_esc(n)}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

// ─── Helpers data ─────────────────────────────────────────────────────────────

function _filtered() {
  return _data.filter(d => {
    if (_filterProv && d.provinsi !== _filterProv) return false;
    if (_filterStat === 'matched'      && !(d.alumni && d.kinerja))  return false;
    if (_filterStat === 'alumni_only'  && !(d.alumni && !d.kinerja)) return false;
    if (_filterStat === 'kinerja_only' && !(!d.alumni && d.kinerja)) return false;
    return true;
  });
}

function _filteredSorted() {
  const rows = _filtered();
  rows.sort((a, b) => {
    let av, bv;
    if (_sortKey === 'instansi')      { av = a.instansi ?? ''; bv = b.instansi ?? ''; }
    else if (_sortKey === 'provinsi') { av = a.provinsi ?? ''; bv = b.provinsi ?? ''; }
    else if (_sortKey === 'peserta')  { av = a.alumni?.total ?? -1; bv = b.alumni?.total ?? -1; }
    else { av = ''; bv = ''; }
    if (typeof av === 'string') return av.localeCompare(bv, 'id') * _sortDir;
    return (av - bv) * _sortDir;
  });
  return rows;
}

/** OLS slope of total kinerja over available years. Null if < 2 data points. */
function _kSlope(d) {
  if (!d.kinerja?.byYear) return null;
  const pts = Object.entries(d.kinerja.byYear)
    .map(([t, v]) => ({ x: +t, y: v?.total }))
    .filter(p => p.y != null)
    .sort((a,b) => a.x - b.x);
  if (pts.length < 2) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const xm = xs.reduce((a,b) => a+b,0) / xs.length;
  const ym = ys.reduce((a,b) => a+b,0) / ys.length;
  const num = xs.reduce((s,x,i) => s+(x-xm)*(ys[i]-ym), 0);
  const den = xs.reduce((s,x) => s+(x-xm)**2, 0);
  return den === 0 ? 0 : num / den;
}

/** OLS slope of a specific kinerja metric field (nrw, cakupan, bobot_operasi, dst). */
function _metricSlope(d, field) {
  if (!d.kinerja?.byYear) return null;
  const pts = Object.entries(d.kinerja.byYear)
    .map(([t, v]) => ({ x: +t, y: v?.[field] }))
    .filter(p => p.y != null)
    .sort((a, b) => a.x - b.x);
  if (pts.length < 2) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const xm = xs.reduce((a,b) => a+b, 0) / xs.length;
  const ym = ys.reduce((a,b) => a+b, 0) / ys.length;
  const num = xs.reduce((s,x,i) => s + (x-xm)*(ys[i]-ym), 0);
  const den = xs.reduce((s,x) => s + (x-xm)**2, 0);
  return den === 0 ? 0 : num / den;
}

/** Latest value of a kinerja field across available years. */
function _latestV(d, field) {
  if (!d.kinerja?.byYear) return null;
  const entries = Object.entries(d.kinerja.byYear).sort(([a],[b]) => +b - +a);
  for (const [, v] of entries) { if (v?.[field] != null) return v[field]; }
  return null;
}

function _latestKat(d) {
  if (!d.kinerja?.byYear) return null;
  const entries = Object.entries(d.kinerja.byYear).sort(([a],[b]) => +b - +a);
  for (const [, v] of entries) { if (v?.kategori) return v.kategori; }
  return null;
}

// ─── Helpers display ──────────────────────────────────────────────────────────

function _katBg(kat) {
  if (kat === 'SEHAT')         return 'rgba(52,211,153,0.8)';
  if (kat === 'KURANG SEHAT')  return 'rgba(251,191,36,0.8)';
  if (kat === 'SAKIT')         return 'rgba(248,113,113,0.8)';
  return 'rgba(100,116,139,0.6)';
}

function _trenBg(slope) {
  if (slope == null) return 'rgba(100,116,139,0.6)';
  if (slope >  0.05) return 'rgba(52,211,153,0.85)';
  if (slope < -0.05) return 'rgba(248,113,113,0.85)';
  return 'rgba(100,116,139,0.6)';
}

function _katPoint(kat) {
  if (kat === 'SEHAT')        return '#34d399';
  if (kat === 'KURANG SEHAT') return '#fbbf24';
  if (kat === 'SAKIT')        return '#f87171';
  return '#818cf8';
}

function _slopeClass(slope) {
  if (slope === null) return 'flat';
  if (slope >  0.05) return 'up';
  if (slope < -0.05) return 'down';
  return 'flat';
}

function _trenBadge(slope) {
  if (slope === null) return `<span class="text-gray-700">—</span>`;
  const sign = slope >= 0 ? '+' : '';
  const lbl  = `${sign}${slope.toFixed(2)}/thn`;
  const cls  = _slopeClass(slope);
  if (cls === 'up')   return `<span class="text-emerald-400">↑</span><span class="text-xs text-emerald-600 ml-0.5">${lbl}</span>`;
  if (cls === 'down') return `<span class="text-red-400">↓</span><span class="text-xs text-red-500 ml-0.5">${lbl}</span>`;
  return `<span class="text-gray-400">→</span><span class="text-xs text-gray-600 ml-0.5">${lbl}</span>`;
}

function _chartOpts({ yMin, yMax, precision } = {}) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        ...(yMin != null && { min: yMin }), ...(yMax != null && { max: yMax }),
        beginAtZero: yMin == null,
        ticks: { color: '#6b7280', ...(precision != null && { precision }) },
        grid: { color: '#1f2937' },
      },
      x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
    },
  };
}

function _words(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function _similarity(wa, wb) {
  if (!wa.length || !wb.length) return 0;
  const sa = new Set(wa), sb = new Set(wb);
  const inter = [...sa].filter(w => sb.has(w)).length;
  return inter / Math.max(sa.size, sb.size);
}

function _destroyCharts() {
  Object.values(_charts).forEach(c => { try { c.destroy(); } catch (_) {} });
  _charts = {};
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

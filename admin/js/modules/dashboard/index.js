// admin/js/modules/dashboard/index.js

import { setPageTitle }  from '../../layout/navbar.js';
import { getState }      from '../../store.js';
import { listBimtek }    from '../bimtek/api.js';
import { countPeserta }  from '../peserta-master/api.js';
import { countPengajar } from '../pengajar-master/api.js';
import { hitungNilaiAkhir, cekKelulusan } from '../bimtek/scorer.js';
import {
  db, collection, query, where, getDocs, doc, getDoc, snapToArray
} from '../../../../shared/db.js';
import { COL, BIDANG_LIST } from '../../../../shared/constants.js';
import { getAlumniStats } from '../historis/api.js';

let _charts = {};
let _leafletMap  = null;
let _geoJsonData = null; // cache GeoJSON peta Indonesia
let _sebaranRaw  = null; // cache data sebaran untuk filter tahun

export async function renderDashboard() {
  setPageTitle('Dashboard');

  Object.values(_charts).forEach(c => { try { c.destroy(); } catch (_) {} });
  _charts = {};
  if (_leafletMap) { try { _leafletMap.remove(); } catch (_) {} _leafletMap = null; }

  const profile = getState('auth.profile');
  const nama    = profile?.nama ?? profile?.email ?? 'Admin';

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="max-w-5xl mx-auto">
      <div class="mb-8">
        <h1 class="text-xl font-bold text-white">Selamat datang, ${_esc(nama)}</h1>
        <p class="text-gray-500 text-sm mt-1">Seleksi & Asesmen Bimtek Air Minum Terpadu</p>
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8" id="stat-grid">
        ${_statSkeleton('Bimtek Aktif')}
        ${_statSkeleton('Bimtek Selesai')}
        ${_statSkeleton('Total Peserta')}
        ${_statSkeleton('Total Pengajar')}
      </div>

      <!-- Charts baris atas -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 class="text-sm font-semibold text-gray-200 mb-4">Tren Bimtek per Tahun</h2>
          <div style="height:220px;position:relative;">
            <canvas id="chart-tren"></canvas>
          </div>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 class="text-sm font-semibold text-gray-200 mb-4">Sebaran Bidang</h2>
          <div id="chart-bidang-wrap" style="height:220px;position:relative;">
            <canvas id="chart-bidang"></canvas>
          </div>
        </div>
      </div>

      <!-- Chart kelulusan per bimtek -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 class="text-sm font-semibold text-gray-200 mb-4">Tingkat Kelulusan per Bimtek</h2>
        <div id="kelulusan-content">
          <div class="text-xs text-gray-500 py-6 text-center animate-pulse">Memuat data kelulusan…</div>
        </div>
      </div>

      <!-- Historis: Tren Peserta per Tahun -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <h2 class="text-sm font-semibold text-gray-200 mb-4">Tren Peserta per Tahun</h2>
        <div id="chart-tren-peserta-wrap" style="height:220px;position:relative;">
          <canvas id="chart-tren-peserta"></canvas>
        </div>
      </div>

      <!-- Sebaran Provinsi: Map -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 class="text-sm font-semibold text-gray-200">Peta Sebaran Provinsi Peserta</h2>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
            <!-- Filter tipe -->
            <div class="flex items-center gap-2">
              <span>Tipe</span>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="map-tipe" value="all"     checked class="accent-teal-500"> Semua
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="map-tipe" value="reguler"       class="accent-teal-500"> Reguler
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="map-tipe" value="pnbp"          class="accent-teal-500"> PNBP
              </label>
            </div>
            <!-- Filter periode -->
            <div class="flex items-center gap-2">
              <span>Periode</span>
              <select id="map-year-from"
                class="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 focus:outline-none focus:border-teal-500">
                <option value="">Semua</option>
              </select>
              <span>–</span>
              <select id="map-year-to"
                class="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 focus:outline-none focus:border-teal-500">
                <option value="">Semua</option>
              </select>
            </div>
          </div>
        </div>
        <div id="map-provinsi" style="height:420px;border-radius:8px;">
          <div class="flex items-center justify-center h-full text-xs text-gray-500 animate-pulse">Memuat peta…</div>
        </div>
        <p id="map-total" class="text-xs text-gray-600 mt-2 text-right"></p>
      </div>

      <!-- Sebaran Provinsi (bar) & Top Instansi -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 class="text-sm font-semibold text-gray-200 mb-4">Sebaran Provinsi (Top 10)</h2>
          <div id="chart-provinsi-wrap" style="height:260px;position:relative;">
            <div class="text-xs text-gray-500 py-6 text-center animate-pulse">Memuat data provinsi…</div>
          </div>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 class="text-sm font-semibold text-gray-200 mb-4">Top Instansi Pengirim Peserta</h2>
          <div id="chart-instansi-wrap" style="height:260px;position:relative;">
            <div class="text-xs text-gray-500 py-6 text-center animate-pulse">Memuat data instansi…</div>
          </div>
        </div>
      </div>

      <!-- Bimtek terbaru -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl mb-8">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 class="text-sm font-semibold text-gray-200">Bimtek Terbaru</h2>
          <a href="#/bimtek" class="text-xs text-blue-400 hover:text-blue-300">Lihat semua</a>
        </div>
        <div id="recent-list" class="divide-y divide-gray-800">
          ${_rowSkeleton(5)}
        </div>
      </div>

      <!-- Quick actions -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        ${_quickBtn('Bimtek',     '#/bimtek',    _iconCalendar(), 'blue')}
        ${_quickBtn('Peserta',    '#/peserta',   _iconUsers(),    'green')}
        ${_quickBtn('Pengajar',   '#/pengajar',  _iconAcademic(), 'yellow')}
        ${_quickBtn('Bank Soal',  '#/bank-soal', _iconDoc(),      'purple')}
        ${_quickBtn('Instansi',   '#/instansi',  _iconOffice(),   'pink')}
        ${_quickBtn('Pengaturan', '#/settings',  _iconCog(),      'gray')}
      </div>
    </div>`;

  _loadData();
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function _loadData() {
  try {
    const [allBimtek, totalPeserta, totalPengajar, alumniStats] = await Promise.all([
      listBimtek(),
      countPeserta(),
      countPengajar(),
      getAlumniStats().catch(() => null),
    ]);

    const aktif   = allBimtek.filter(b => ['ongoing','planned'].includes(b.status)).length;
    const selesai = allBimtek.filter(b => b.status === 'completed').length;

    _renderStats(aktif, selesai, totalPeserta, totalPengajar, alumniStats);
    _renderRecentList(allBimtek.slice(0, 5));
    _renderChartTren(allBimtek, alumniStats);
    _renderChartBidang(allBimtek, alumniStats);
    _loadKelulusanChart(allBimtek);
    _renderChartTrenPeserta(allBimtek, alumniStats);
    _loadSebaranData(allBimtek, alumniStats);
  } catch (err) {
    console.error('[dashboard]', err);
    const sg = document.getElementById('stat-grid');
    if (sg) sg.innerHTML = `<div class="col-span-4 text-xs text-red-400 px-1">Gagal memuat data: ${_esc(err.message)}</div>`;
  }
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function _renderStats(aktif, selesai, peserta, pengajar, alumniStats) {
  document.getElementById('stat-grid').innerHTML = [
    _statCard('Bimtek Aktif',   aktif,    'text-blue-400',   _iconCalendar('w-5 h-5')),
    _statCard('Bimtek Selesai', selesai,  'text-green-400',  _iconCheck('w-5 h-5')),
    _statCard('Peserta Master', peserta,  'text-purple-400', _iconUsers('w-5 h-5'),
      alumniStats?.totalRows ? `+${alumniStats.totalRows.toLocaleString('id-ID')} historis` : null),
    _statCard('Total Pengajar', pengajar, 'text-yellow-400', _iconAcademic('w-5 h-5')),
  ].join('');
}

// ─── Chart: Tren Bimtek per Tahun ─────────────────────────────────────────────

function _renderChartTren(allBimtek, alumniStats) {
  // Bimtek baru (dari sistem) — hitung nama unik per tahun, sama seperti historis
  const byYearNewSet = {};
  allBimtek.forEach(b => {
    if (!b.periode?.mulai) return;
    // Gunakan namaKey (pre-normalized) jika tersedia, fallback ke normalisasi manual
    const nama = b.namaKey || (b.nama ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!nama) return;
    const d  = b.periode.mulai.toDate ? b.periode.mulai.toDate() : new Date(b.periode.mulai);
    const yr = d.getFullYear();
    if (!byYearNewSet[yr]) byYearNewSet[yr] = new Set();
    byYearNewSet[yr].add(nama);
  });
  const byYearNew = Object.fromEntries(
    Object.entries(byYearNewSet).map(([yr, s]) => [yr, s.size])
  );

  // Gabungkan semua tahun dari historis + baru
  const allYears = new Set([
    ...Object.keys(byYearNew).map(Number),
    ...Object.keys(alumniStats?.bimtekCountByYear ?? {}).map(Number),
  ]);
  const years  = [...allYears].sort();
  const canvas = document.getElementById('chart-tren');
  if (!canvas) return;

  if (years.length === 0) {
    canvas.parentElement.innerHTML = `<p class="text-xs text-gray-500 text-center py-8">Belum ada data.</p>`;
    return;
  }

  const hasHistoris = alumniStats && Object.keys(alumniStats.bimtekCountByYear).length > 0;
  const datasets = [];

  if (hasHistoris) {
    datasets.push({
      label: 'Historis',
      data: years.map(y => alumniStats.bimtekCountByYear[y] || 0),
      backgroundColor: 'rgba(59,130,246,0.35)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 3,
      stack: 'total',
    });
  }
  datasets.push({
    label: 'Sistem Baru',
    data: years.map(y => byYearNew[y] || 0),
    backgroundColor: 'rgba(59,130,246,0.85)',
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderRadius: 4,
    stack: 'total',
  });

  _charts.tren = new Chart(canvas, {
    type: 'bar',
    data: { labels: years.map(String), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: hasHistoris, labels: { color: '#9ca3af', font: { size: 11 } } },
      },
      scales: {
        x: { stacked: true, ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { color: '#1f2937' } },
        y: { stacked: true, ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 }, grid: { color: '#1f2937' }, beginAtZero: true }
      }
    }
  });
}

// ─── Chart: Sebaran Bidang ────────────────────────────────────────────────────

function _renderChartBidang(allBimtek, alumniStats) {
  const byBidang = {};
  allBimtek.forEach(b => {
    (b.bidangIds || []).forEach(id => {
      byBidang[id] = (byBidang[id] || 0) + 1;
    });
  });
  // Merge historis bidang (dalam satuan peserta, bukan bimtek)
  Object.entries(alumniStats?.bidangCount ?? {}).forEach(([bidang, cnt]) => {
    byBidang[bidang] = (byBidang[bidang] || 0) + cnt;
  });

  const wrap   = document.getElementById('chart-bidang-wrap');
  const canvas = document.getElementById('chart-bidang');
  if (!canvas) return;

  const keys = Object.keys(byBidang);
  if (keys.length === 0) {
    wrap.innerHTML = `<p class="text-xs text-gray-500 text-center py-8">Belum ada data bidang.</p>`;
    return;
  }

  const labels = keys.map(id => BIDANG_LIST.find(b => b.bidangId === id)?.nama || id);
  const data   = keys.map(id => byBidang[id]);
  const colors = keys.map(id => BIDANG_LIST.find(b => b.bidangId === id)?.color || '#6b7280');

  _charts.bidang = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor: colors,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 11 }, padding: 10 } }
      }
    }
  });
}

// ─── Chart: Kelulusan per Bimtek ─────────────────────────────────────────────

async function _loadKelulusanChart(allBimtek) {
  const el = document.getElementById('kelulusan-content');
  if (!el) return;

  const completed = allBimtek.filter(b => b.status === 'completed').slice(0, 8);

  if (completed.length === 0) {
    el.innerHTML = `<p class="text-xs text-gray-500 text-center py-6">Belum ada bimtek selesai.</p>`;
    return;
  }

  try {
    const rows = await Promise.all(completed.map(async b => {
      const snap   = await getDocs(query(collection(db, COL.BIMTEK_SCORES), where('bimtekId', '==', b.id)));
      const scores = snapToArray(snap);
      let lulus = 0;
      scores.forEach(s => {
        const na = hitungNilaiAkhir(s, b);
        if (cekKelulusan(na, b.kkm, s.kehadiran ?? null)) lulus++;
      });
      return { nama: b.nama, total: scores.length, lulus, tidakLulus: scores.length - lulus };
    }));

    // Terbaru di bawah pada horizontal bar
    rows.reverse();

    const h = Math.max(180, rows.length * 46);
    el.innerHTML = `<div style="height:${h}px;position:relative;"><canvas id="chart-kelulusan"></canvas></div>`;

    const canvas = document.getElementById('chart-kelulusan');
    _charts.kelulusan = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(d => _truncate(d.nama, 32)),
        datasets: [
          { label: 'Lulus',          data: rows.map(d => d.lulus),      backgroundColor: 'rgba(34,197,94,0.75)',  borderColor: '#22c55e', borderWidth: 1, borderRadius: 3 },
          { label: 'Belum Memenuhi', data: rows.map(d => d.tidakLulus), backgroundColor: 'rgba(239,68,68,0.65)', borderColor: '#ef4444', borderWidth: 1, borderRadius: 3 },
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const d = rows[items[0]?.dataIndex];
                if (!d || d.total === 0) return '';
                const pct = Math.round(d.lulus / d.total * 100);
                return [`Kelulusan: ${pct}% (${d.lulus}/${d.total})`];
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 }, grid: { color: '#1f2937' }, beginAtZero: true },
          y: { stacked: true, ticks: { color: '#d1d5db', font: { size: 11 } }, grid: { color: '#1f2937' } }
        }
      }
    });
  } catch (err) {
    el.innerHTML = `<p class="text-xs text-red-400 p-4">Gagal memuat kelulusan: ${_esc(err.message)}</p>`;
  }
}

// ─── Chart: Tren Peserta per Tahun ───────────────────────────────────────────

function _renderChartTrenPeserta(allBimtek, alumniStats) {
  // Peserta baru (dari sistem)
  const byYearNew = {};
  allBimtek.forEach(b => {
    if (!b.periode?.mulai) return;
    const d  = b.periode.mulai.toDate ? b.periode.mulai.toDate() : new Date(b.periode.mulai);
    const yr = d.getFullYear();
    byYearNew[yr] = (byYearNew[yr] || 0) + (b.pesertaIds?.length || 0);
  });

  const allYears = new Set([
    ...Object.keys(byYearNew).map(Number),
    ...Object.keys(alumniStats?.pesertaByYear ?? {}).map(Number),
  ]);
  const years  = [...allYears].sort();
  const wrap   = document.getElementById('chart-tren-peserta-wrap');
  const canvas = document.getElementById('chart-tren-peserta');
  if (!canvas) return;

  if (years.length === 0) {
    wrap.innerHTML = `<p class="text-xs text-gray-500 text-center py-8">Belum ada data.</p>`;
    return;
  }

  const hasHistoris = alumniStats && Object.keys(alumniStats.pesertaByYear).length > 0;
  const datasets = [];

  if (hasHistoris) {
    datasets.push({
      label: 'Historis',
      data: years.map(y => alumniStats.pesertaByYear[y] || 0),
      backgroundColor: 'rgba(168,85,247,0.35)',
      borderColor: '#a855f7',
      borderWidth: 1,
      borderRadius: 3,
      stack: 'total',
    });
  }
  datasets.push({
    label: 'Sistem Baru',
    data: years.map(y => byYearNew[y] || 0),
    backgroundColor: 'rgba(168,85,247,0.85)',
    borderColor: '#a855f7',
    borderWidth: 1,
    borderRadius: 4,
    stack: 'total',
  });

  _charts.trenPeserta = new Chart(canvas, {
    type: 'bar',
    data: { labels: years.map(String), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: hasHistoris, labels: { color: '#9ca3af', font: { size: 11 } } },
      },
      scales: {
        x: { stacked: true, ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { color: '#1f2937' } },
        y: { stacked: true, ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 }, grid: { color: '#1f2937' }, beginAtZero: true }
      }
    }
  });
}

// ─── Sebaran Provinsi & Instansi ──────────────────────────────────────────────

async function _loadSebaranData(allBimtek, alumniStats) {
  // Map pesertaId → { years: Set, tipe: string } (dari bimtek sistem baru)
  const metaByPeserta = {}; // { [pesertaId]: { years: Set<number>, tipe: 'reguler'|'pnbp' } }
  allBimtek.forEach(b => {
    if (!b.periode?.mulai) return;
    const d    = b.periode.mulai.toDate ? b.periode.mulai.toDate() : new Date(b.periode.mulai);
    const yr   = d.getFullYear();
    const tipe = b.tipe === 'pnbp' ? 'pnbp' : 'reguler';
    (b.pesertaIds || []).forEach(id => {
      if (!metaByPeserta[id]) metaByPeserta[id] = { years: new Set(), tipe };
      metaByPeserta[id].years.add(yr);
    });
  });

  // provinsiByYearTipe untuk sistem baru + instansiCount
  const provinsiByYearTipeNew = { all: {}, reguler: {}, pnbp: {} };
  const instansiCount         = {};

  Object.entries(alumniStats?.instansiCount ?? {}).forEach(([k, v]) => {
    instansiCount[k] = (instansiCount[k] || 0) + v;
  });

  const allIds = Object.keys(metaByPeserta);
  if (allIds.length > 0) {
    try {
      const CHUNK = 30;
      const chunks = [];
      for (let i = 0; i < allIds.length; i += CHUNK) chunks.push(allIds.slice(i, i + CHUNK));
      const snaps = await Promise.all(
        chunks.flatMap(chunk => chunk.map(id => getDoc(doc(db, COL.PESERTA_MASTER, id))))
      );
      snaps.forEach(snap => {
        if (!snap.exists()) return;
        const d    = snap.data();
        const meta = metaByPeserta[snap.id];
        if (d.provinsi && meta) {
          meta.years.forEach(yr => {
            for (const key of ['all', meta.tipe]) {
              if (!provinsiByYearTipeNew[key][yr]) provinsiByYearTipeNew[key][yr] = {};
              provinsiByYearTipeNew[key][yr][d.provinsi] = (provinsiByYearTipeNew[key][yr][d.provinsi] || 0) + 1;
            }
          });
        }
        if (d.instansi) instansiCount[d.instansi] = (instansiCount[d.instansi] || 0) + 1;
      });
    } catch (err) {
      console.error('[dashboard sebaran peserta baru]', err);
    }
  }

  // Gabungkan provinsiByYearTipe historis + sistem baru
  const provinsiByYearTipe = { all: {}, reguler: {}, pnbp: {} };
  for (const key of ['all', 'reguler', 'pnbp']) {
    const srcH = alumniStats?.provinsiByYearTipe?.[key] ?? {};
    const srcN = provinsiByYearTipeNew[key];
    for (const [yr, map] of [...Object.entries(srcH), ...Object.entries(srcN)]) {
      if (!provinsiByYearTipe[key][yr]) provinsiByYearTipe[key][yr] = {};
      Object.entries(map).forEach(([p, c]) => {
        provinsiByYearTipe[key][yr][p] = (provinsiByYearTipe[key][yr][p] || 0) + c;
      });
    }
  }

  // Aggregate semua tahun untuk tipe 'all' sebagai default
  const provinsiCountAll = {};
  Object.values(provinsiByYearTipe.all).forEach(map => {
    Object.entries(map).forEach(([p, c]) => {
      provinsiCountAll[p] = (provinsiCountAll[p] || 0) + c;
    });
  });

  const allYears = Object.keys(provinsiByYearTipe.all).map(Number).sort();
  _sebaranRaw = { provinsiByYearTipe, provinsiCountAll, instansiCount, allYears };

  // Isi dropdown filter tahun (dari & sampai)
  const selFrom = document.getElementById('map-year-from');
  const selTo   = document.getElementById('map-year-to');
  if (selFrom && selTo) {
    allYears.forEach(yr => {
      const o1 = document.createElement('option'); o1.value = yr; o1.textContent = yr;
      const o2 = document.createElement('option'); o2.value = yr; o2.textContent = yr;
      selFrom.appendChild(o1);
      selTo.appendChild(o2);
    });
    if (allYears.length) selTo.value = allYears[allYears.length - 1];
  }

  const _applyFilter = () => {
    if (!_sebaranRaw) return;
    const from    = selFrom?.value ? Number(selFrom.value) : null;
    const to      = selTo?.value   ? Number(selTo.value)   : null;
    const tipeKey = document.querySelector('input[name="map-tipe"]:checked')?.value ?? 'all';
    const byYear  = _sebaranRaw.provinsiByYearTipe[tipeKey] ?? _sebaranRaw.provinsiByYearTipe.all;
    const count   = _aggregateProvinsiRange(byYear, from, to);
    _renderMapProvinsi(count);
    _renderChartProvinsi(count);
  };

  selFrom?.addEventListener('change', _applyFilter);
  selTo?.addEventListener('change', _applyFilter);
  document.querySelectorAll('input[name="map-tipe"]').forEach(r => r.addEventListener('change', _applyFilter));

  if (Object.keys(provinsiCountAll).length === 0 && Object.keys(instansiCount).length === 0) {
    const mp = document.getElementById('map-provinsi');
    if (mp) mp.innerHTML = `<p class="text-xs text-gray-500 text-center py-8">Belum ada data peserta.</p>`;
    const pw = document.getElementById('chart-provinsi-wrap');
    if (pw) pw.innerHTML = `<p class="text-xs text-gray-500 text-center py-8">Belum ada data peserta.</p>`;
    const iw = document.getElementById('chart-instansi-wrap');
    if (iw) iw.innerHTML = `<p class="text-xs text-gray-500 text-center py-8">Belum ada data peserta.</p>`;
    return;
  }

  _renderMapProvinsi(provinsiCountAll);
  _renderChartProvinsi(provinsiCountAll);
  _renderChartInstansi(instansiCount);
}

function _aggregateProvinsiRange(provinsiByYear, from, to) {
  const result = {};
  Object.entries(provinsiByYear).forEach(([yr, map]) => {
    const y = Number(yr);
    if (from && y < from) return;
    if (to   && y > to)   return;
    Object.entries(map).forEach(([p, c]) => {
      result[p] = (result[p] || 0) + c;
    });
  });
  return result;
}

// URL GeoJSON peta Indonesia (superpikar, nama provinsi dalam Bahasa Indonesia, property: state)
const _GEOJSON_URL = 'https://cdn.jsdelivr.net/gh/superpikar/indonesia-geojson@master/indonesia.geojson';

// GeoJSON peta Leaflet yang sedang aktif (untuk resetStyle)
let _geoLayer = null;

async function _renderMapProvinsi(provinsiCount) {
  const container = document.getElementById('map-provinsi');
  if (!container) return;

  // Hapus instance Leaflet sebelumnya
  if (_leafletMap) {
    try { _leafletMap.remove(); } catch (_) {}
    _leafletMap = null;
    _geoLayer   = null;
  }
  // Reset container — penting agar Leaflet tidak menemukan elemen lama
  container.innerHTML = '';

  if (Object.keys(provinsiCount).length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-500 text-center py-16">Data provinsi belum tersedia.</p>`;
    return;
  }

  // Fetch GeoJSON sekali, cache di module scope
  if (!_geoJsonData) {
    try {
      const res = await fetch(_GEOJSON_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      _geoJsonData = await res.json();
    } catch (err) {
      container.innerHTML = `<p class="text-xs text-red-400 p-4 text-center">Gagal memuat data peta: ${_esc(err.message)}</p>`;
      return;
    }
  }

  // maxVal dihitung setelah normCount selesai (di bawah) agar merge alias sudah diterapkan

  // Multi-stop gradient dengan skala sqrt supaya distribusi skewed tetap kontras
  // Stop: merah gelap → oranye → kuning → hijau → tosca → biru tua
  const _STOPS = [
    [0.00, [153,  27,  27]],  // merah-800     (nilai sangat kecil)
    [0.20, [234,  88,  12]],  // oranye-600    (nilai kecil)
    [0.40, [234, 179,   8]],  // kuning-500    (nilai sedang-bawah)
    [0.60, [ 34, 197,  94]],  // hijau-500     (nilai sedang-atas)
    [0.80, [ 20, 184, 166]],  // tosca-500     (nilai besar)
    [1.00, [ 29,  78, 216]],  // biru-700      (nilai sangat besar)
  ];

  function _getColor(count) {
    if (!count) return '#1e293b'; // abu gelap untuk provinsi tanpa data
    const t = Math.sqrt(count / maxVal); // sqrt → kontras lebih merata
    for (let i = 1; i < _STOPS.length; i++) {
      const [p0, c0] = _STOPS[i - 1];
      const [p1, c1] = _STOPS[i];
      if (t <= p1) {
        const u = (t - p0) / (p1 - p0);
        const r = Math.round(c0[0] + (c1[0] - c0[0]) * u);
        const g = Math.round(c0[1] + (c1[1] - c0[1]) * u);
        const b = Math.round(c0[2] + (c1[2] - c0[2]) * u);
        return `rgb(${r},${g},${b})`;
      }
    }
    return `rgb(249,115,22)`;
  }

  // Alias: nama tidak baku / singkatan → nama baku (setelah lowercase & trim)
  const _ALIAS = {
    'jabar':'jawa barat','jawa bar.':'jawa barat',
    'jateng':'jawa tengah','jawa teng.':'jawa tengah',
    'jatim':'jawa timur','jawa tim.':'jawa timur',
    'diy':'yogyakarta','d.i. yogyakarta':'yogyakarta','d.i.yogyakarta':'yogyakarta',
    'di yogyakarta':'yogyakarta',
    'sumut':'sumatera utara','sumbar':'sumatera barat',
    'sumsel':'sumatera selatan','sumteng':'sumatera tengah',
    'kalbar':'kalimantan barat','kalteng':'kalimantan tengah',
    'kalsel':'kalimantan selatan','kaltim':'kalimantan timur',
    'kaltara':'kalimantan utara','kalut':'kalimantan utara',
    'sulut':'sulawesi utara','sulteng':'sulawesi tengah',
    'sulsel':'sulawesi selatan','sultra':'sulawesi tenggara',
    'sulbar':'sulawesi barat',
    'malut':'maluku utara',
    'ntb':'nusa tenggara barat','ntt':'nusa tenggara timur',
    'babel':'kepulauan bangka belitung','bangka belitung':'kepulauan bangka belitung',
    'kepri':'kepulauan riau',
    'jakarta':'jakarta',
    'dki':'jakarta',
    'papua bar.':'papua barat',
  };

  // Normalisasi nama provinsi — berlaku untuk data alumni maupun nama di GeoJSON
  function _norm(s) {
    let v = (s || '').toLowerCase()
      .replace(/^(provinsi|prov\.?|daerah istimewa|dki|d\.i\.)\s*/gi, '')
      .replace(/\bkep\.\s*/gi, 'kepulauan ')   // "Kep. Riau" → "Kepulauan Riau"
      .replace(/\s+/g, ' ')
      .trim();
    return _ALIAS[v] ?? v;
  }

  const normCount = {};
  // Merge: jika dua nama berbeda normalize ke key sama, jumlahkan (jangan timpa)
  Object.entries(provinsiCount).forEach(([k, v]) => {
    const nk = _norm(k);
    if (normCount[nk]) {
      normCount[nk] = { orig: normCount[nk].orig, count: normCount[nk].count + v };
    } else {
      normCount[nk] = { orig: k, count: v };
    }
  });

  // maxVal dari normCount (sudah di-merge), bukan dari raw provinsiCount
  const values = Object.values(normCount).map(v => v.count);
  const maxVal = Math.max(...values, 1);

  // Debug: normCount dari data
  console.group('[Map Debug] normCount keys (dari data alumni/peserta):');
  Object.entries(normCount).sort((a,b) => b[1].count - a[1].count)
    .forEach(([k, v]) => console.log(`  "${k}" ← "${v.orig}" (${v.count})`));
  console.groupEnd();

  // Debug: GeoJSON state → norm → hasil match (tampilkan setelah GeoJSON siap)
  const geoDebug = {};
  _geoJsonData.features.forEach(f => {
    const raw   = f.properties.state || '';
    const normd = _norm(raw);
    const match = normCount[normd];
    geoDebug[raw] = { normd, count: match?.count ?? 0, matched: !!match };
  });
  console.group('[Map Debug] GeoJSON state → norm → count:');
  Object.entries(geoDebug).sort((a,b) => b[1].count - a[1].count)
    .forEach(([raw, d]) => console.log(`  ${d.matched ? '✓' : '✗'} "${raw}" → "${d.normd}" = ${d.count}`));
  console.groupEnd();
  const unmatched = Object.entries(geoDebug).filter(([,d]) => !d.matched).map(([r]) => r);
  if (unmatched.length) console.warn('[Map Debug] Provinsi GeoJSON tanpa match data:', unmatched);

  // Init Leaflet — gunakan requestAnimationFrame agar container sudah di-render browser
  await new Promise(r => requestAnimationFrame(r));

  _leafletMap = L.map(container, {
    center: [-2, 118],
    zoom: 4,
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true,
  });

  // Tile layer gelap tanpa label (sesuai dark theme)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 14,
  }).addTo(_leafletMap);

  // Debug: tampilkan GeoJSON names vs match result
  console.group('[Map Debug] GeoJSON state → norm → match:');
  (_geoJsonData.features || []).forEach(f => {
    const raw   = f.properties.state || '';
    const normd = _norm(raw);
    const hit   = normCount[normd];
    console.log(`  "${raw}" → "${normd}" → ${hit ? `✅ ${hit.count}` : '❌ tidak match'}`);
  });
  console.groupEnd();

  _geoLayer = L.geoJSON(_geoJsonData, {
    style: feature => {
      const rawName = feature.properties.state || '';
      const count   = normCount[_norm(rawName)]?.count || 0;
      return {
        fillColor:   _getColor(count),
        fillOpacity: 1,
        color:       '#374151',
        weight:      0.5,
      };
    },
    onEachFeature: (feature, layer) => {
      const rawName = feature.properties.state || '?';
      const count   = normCount[_norm(rawName)]?.count || 0;
      layer.bindTooltip(
        `<div style="font-size:12px;padding:4px 8px"><b>${rawName}</b><br>${count.toLocaleString('id-ID')} peserta</div>`,
        { sticky: true, className: 'leaflet-tooltip-dark' }
      );
      layer.on({
        mouseover(e) { e.target.setStyle({ weight: 1.5, color: '#14b8a6' }); },
        mouseout(e)  { _geoLayer?.resetStyle(e.target); },
      });
    },
  }).addTo(_leafletMap);

  // Legenda stepped — sesuai skala sqrt yang dipakai _getColor
  // Legenda: gradient bar dengan posisi warna akurat sesuai skala sqrt
  // Posisi CSS (%) = t² × 100, sehingkan warna di bar sesuai nilai count di peta
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const fmt = n => n.toLocaleString('id-ID');
    // t² × 100 → posisi CSS gradient: 0%, 4%, 16%, 36%, 64%, 100%
    const grad = '#991b1b 0%,#ea580c 4%,#eab308 16%,#22c55e 36%,#14b8a6 64%,#1d4ed8 100%';
    const div = L.DomUtil.create('div');
    div.style.cssText = 'background:#1f2937;padding:6px 10px;border-radius:6px;border:1px solid #374151;font-size:11px;color:#9ca3af';
    div.innerHTML = `
      <div style="width:130px;height:8px;border-radius:3px;background:linear-gradient(to right,${grad});margin-bottom:3px"></div>
      <div style="display:flex;justify-content:space-between;width:130px"><span>0</span><span>${fmt(maxVal)}</span></div>`;
    return div;
  };
  legend.addTo(_leafletMap);

  // Paksa recalculate ukuran (penting jika container baru saja di-render)
  setTimeout(() => _leafletMap?.invalidateSize(), 150);

  const total = values.reduce((s, v) => s + v, 0);
  const el    = document.getElementById('map-total');
  if (el) el.textContent = `Total: ${total.toLocaleString('id-ID')} peserta dari ${values.length} provinsi`;

  console.log('[Map Debug] provinsiCount raw:', provinsiCount);
}

function _renderChartProvinsi(provinsiCount) {
  const wrap = document.getElementById('chart-provinsi-wrap');
  if (!wrap) return;

  const sorted = Object.entries(provinsiCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length === 0) {
    wrap.innerHTML = `<p class="text-xs text-gray-500 text-center py-8">Data provinsi belum tersedia.</p>`;
    return;
  }

  const h = Math.max(220, sorted.length * 28);
  wrap.innerHTML = `<div style="height:${h}px;position:relative;"><canvas id="chart-provinsi"></canvas></div>`;

  _charts.provinsi = new Chart(document.getElementById('chart-provinsi'), {
    type: 'bar',
    data: {
      labels: sorted.map(([p]) => _truncate(p, 22)),
      datasets: [{
        label: 'Peserta',
        data: sorted.map(([, v]) => v),
        backgroundColor: 'rgba(20,184,166,0.7)',
        borderColor: '#14b8a6',
        borderWidth: 1,
        borderRadius: 3,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9ca3af', font: { size: 10 }, stepSize: 1 }, grid: { color: '#1f2937' }, beginAtZero: true },
        y: { ticks: { color: '#d1d5db', font: { size: 10 } }, grid: { color: '#1f2937' } }
      }
    }
  });
}

function _renderChartInstansi(instansiCount) {
  const wrap = document.getElementById('chart-instansi-wrap');
  if (!wrap) return;

  const sorted = Object.entries(instansiCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length === 0) {
    wrap.innerHTML = `<p class="text-xs text-gray-500 text-center py-8">Data instansi belum tersedia.</p>`;
    return;
  }

  const h = Math.max(220, sorted.length * 28);
  wrap.innerHTML = `<div style="height:${h}px;position:relative;"><canvas id="chart-instansi"></canvas></div>`;

  _charts.instansi = new Chart(document.getElementById('chart-instansi'), {
    type: 'bar',
    data: {
      labels: sorted.map(([inst]) => _truncate(inst, 22)),
      datasets: [{
        label: 'Peserta',
        data: sorted.map(([, v]) => v),
        backgroundColor: 'rgba(251,146,60,0.7)',
        borderColor: '#fb923c',
        borderWidth: 1,
        borderRadius: 3,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9ca3af', font: { size: 10 }, stepSize: 1 }, grid: { color: '#1f2937' }, beginAtZero: true },
        y: { ticks: { color: '#d1d5db', font: { size: 10 } }, grid: { color: '#1f2937' } }
      }
    }
  });
}

// ─── Recent List ──────────────────────────────────────────────────────────────

function _renderRecentList(items) {
  const el = document.getElementById('recent-list');
  if (!items.length) {
    el.innerHTML = `<div class="px-5 py-8 text-center text-sm text-gray-500">Belum ada data bimtek.</div>`;
    return;
  }
  el.innerHTML = items.map(b => `
    <a href="#/bimtek/${b.id}"
       class="flex items-center justify-between px-5 py-3 hover:bg-gray-800/50 transition-colors">
      <div class="min-w-0">
        <p class="text-sm text-gray-100 truncate">${_esc(b.nama)}</p>
        <p class="text-xs text-gray-500 mt-0.5">${_esc(_formatPeriode(b.periode))}</p>
      </div>
      <span class="badge ${_statusColor(b.status)} ml-4 shrink-0">${_statusLabel(b.status)}</span>
    </a>`).join('');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function _statCard(label, value, valueCls, iconSvg, subLabel = null) {
  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-gray-500">${label}</span>
        <span class="${valueCls}">${iconSvg}</span>
      </div>
      <p class="text-2xl font-bold text-white">${value}</p>
      ${subLabel ? `<p class="text-xs text-gray-600 mt-1">${subLabel}</p>` : ''}
    </div>`;
}

function _statSkeleton(label) {
  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
      <p class="text-xs text-gray-500 mb-3">${label}</p>
      <div class="h-8 w-16 bg-gray-700 rounded"></div>
    </div>`;
}

function _rowSkeleton(n) {
  return Array.from({ length: n }, () => `
    <div class="px-5 py-3 animate-pulse flex justify-between items-center">
      <div class="space-y-1.5">
        <div class="h-3.5 w-48 bg-gray-800 rounded"></div>
        <div class="h-3 w-32 bg-gray-800 rounded"></div>
      </div>
      <div class="h-5 w-16 bg-gray-800 rounded-full"></div>
    </div>`).join('');
}

function _quickBtn(label, href, iconSvg, color) {
  const cls = {
    blue:   'border-blue-800/60   bg-blue-600/10   hover:border-blue-600   text-blue-400',
    green:  'border-green-800/60  bg-green-600/10  hover:border-green-600  text-green-400',
    yellow: 'border-yellow-800/60 bg-yellow-600/10 hover:border-yellow-600 text-yellow-400',
    purple: 'border-purple-800/60 bg-purple-600/10 hover:border-purple-600 text-purple-400',
    pink:   'border-pink-800/60   bg-pink-600/10   hover:border-pink-600   text-pink-400',
    gray:   'border-gray-700      bg-gray-800/50   hover:border-gray-500   text-gray-400',
  }[color] ?? '';
  return `
    <a href="${href}"
       class="flex flex-col items-center gap-2 border rounded-xl p-4 transition-colors cursor-pointer ${cls}">
      ${iconSvg}
      <span class="text-xs font-medium text-gray-200">${label}</span>
    </a>`;
}

function _statusColor(s) {
  return { ongoing:'badge-blue', planned:'badge-yellow', completed:'badge-green', draft:'badge-gray', cancelled:'badge-red' }[s] ?? 'badge-gray';
}

function _statusLabel(s) {
  return { ongoing:'Berjalan', planned:'Direncanakan', completed:'Selesai', draft:'Draft', cancelled:'Dibatalkan' }[s] ?? s;
}

function _formatPeriode(p) {
  if (!p) return '—';
  const fmt = ts => {
    if (!ts) return '?';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  };
  return `${fmt(p.mulai)} – ${fmt(p.selesai)}`;
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function _iconCalendar(cls = 'w-6 h-6') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
  </svg>`;
}

function _iconCheck(cls = 'w-6 h-6') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`;
}

function _iconUsers(cls = 'w-6 h-6') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>`;
}

function _iconAcademic(cls = 'w-6 h-6') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
  </svg>`;
}

function _iconDoc(cls = 'w-6 h-6') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
  </svg>`;
}

function _iconOffice(cls = 'w-6 h-6') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
  </svg>`;
}

function _iconCog(cls = 'w-6 h-6') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>`;
}

// admin/js/modules/dashboard/index.js

import { setPageTitle }  from '../../layout/navbar.js';
import { getState }      from '../../store.js';
import { listBimtek }    from '../bimtek/api.js';
import { countPeserta }  from '../peserta-master/api.js';
import { countPengajar } from '../pengajar-master/api.js';
import { hitungNilaiAkhir, cekKelulusan } from '../bimtek/scorer.js';
import {
  db, collection, query, where, getDocs, snapToArray
} from '../../../../shared/db.js';
import { COL, BIDANG_LIST } from '../../../../shared/constants.js';

// Simpan instance Chart agar bisa di-destroy saat re-render
let _charts = {};

export async function renderDashboard() {
  setPageTitle('Dashboard');

  Object.values(_charts).forEach(c => { try { c.destroy(); } catch (_) {} });
  _charts = {};

  const profile = getState('auth.profile');
  const nama    = profile?.nama ?? profile?.email ?? 'Admin';

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="max-w-5xl mx-auto">
      <div class="mb-8">
        <h1 class="text-xl font-bold text-white">Selamat datang, ${_esc(nama)}</h1>
        <p class="text-gray-500 text-sm mt-1">Sistem Manajemen Bimtek BTAM</p>
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
    const [allBimtek, totalPeserta, totalPengajar] = await Promise.all([
      listBimtek(),
      countPeserta(),
      countPengajar(),
    ]);

    const aktif   = allBimtek.filter(b => ['ongoing','planned'].includes(b.status)).length;
    const selesai = allBimtek.filter(b => b.status === 'completed').length;

    _renderStats(aktif, selesai, totalPeserta, totalPengajar);
    _renderRecentList(allBimtek.slice(0, 5));
    _renderChartTren(allBimtek);
    _renderChartBidang(allBimtek);
    _loadKelulusanChart(allBimtek);
  } catch (err) {
    console.error('[dashboard]', err);
    const sg = document.getElementById('stat-grid');
    if (sg) sg.innerHTML = `<div class="col-span-4 text-xs text-red-400 px-1">Gagal memuat data: ${_esc(err.message)}</div>`;
  }
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function _renderStats(aktif, selesai, peserta, pengajar) {
  document.getElementById('stat-grid').innerHTML = [
    _statCard('Bimtek Aktif',   aktif,    'text-blue-400',   _iconCalendar('w-5 h-5')),
    _statCard('Bimtek Selesai', selesai,  'text-green-400',  _iconCheck('w-5 h-5')),
    _statCard('Total Peserta',  peserta,  'text-purple-400', _iconUsers('w-5 h-5')),
    _statCard('Total Pengajar', pengajar, 'text-yellow-400', _iconAcademic('w-5 h-5')),
  ].join('');
}

// ─── Chart: Tren Bimtek per Tahun ─────────────────────────────────────────────

function _renderChartTren(allBimtek) {
  const byYear = {};
  allBimtek.forEach(b => {
    if (!b.periode?.mulai) return;
    const d  = b.periode.mulai.toDate ? b.periode.mulai.toDate() : new Date(b.periode.mulai);
    const yr = d.getFullYear();
    byYear[yr] = (byYear[yr] || 0) + 1;
  });

  const years  = Object.keys(byYear).map(Number).sort();
  const canvas = document.getElementById('chart-tren');
  if (!canvas) return;

  if (years.length === 0) {
    canvas.parentElement.innerHTML = `<p class="text-xs text-gray-500 text-center py-8">Belum ada data.</p>`;
    return;
  }

  _charts.tren = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: years.map(String),
      datasets: [{
        label: 'Jumlah Bimtek',
        data: years.map(y => byYear[y]),
        backgroundColor: 'rgba(59,130,246,0.7)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { color: '#1f2937' } },
        y: { ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 }, grid: { color: '#1f2937' }, beginAtZero: true }
      }
    }
  });
}

// ─── Chart: Sebaran Bidang ────────────────────────────────────────────────────

function _renderChartBidang(allBimtek) {
  const byBidang = {};
  allBimtek.forEach(b => {
    (b.bidangIds || []).forEach(id => {
      byBidang[id] = (byBidang[id] || 0) + 1;
    });
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
        if (cekKelulusan(na, b.kkm)) lulus++;
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

function _statCard(label, value, valueCls, iconSvg) {
  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-gray-500">${label}</span>
        <span class="${valueCls}">${iconSvg}</span>
      </div>
      <p class="text-2xl font-bold text-white">${value}</p>
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

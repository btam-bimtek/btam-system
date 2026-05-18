// admin/js/modules/bimtek/sub-report-penyelenggara.js
// Laporan penyelenggara: overview, per-peserta, per-EK, per-pengajar + Chart.js charts.

import { getBimtekReportData } from './report-api.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';

// Chart instances — di-destroy sebelum re-create
const _charts = {};

let S = {
  data:    null,
  bimtek:  null,
  innerTab: 'overview'
};

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

export async function renderSubReportPenyelenggara(container, bimtekId, bimtek, mapels, pengajars) {
  S.bimtek   = bimtek;
  S.innerTab = 'overview';

  try {
    S.data = await getBimtekReportData(bimtekId, bimtek, mapels, pengajars);
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm p-4">Gagal memuat data: ${err.message}</div>`;
    console.error(err);
    return;
  }

  _renderShell(container);
}

// ─── SHELL ────────────────────────────────────────────────────────────────────

function _renderShell(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4 no-print">
      <div class="flex gap-1 text-sm">
        ${_innerTabBtn('overview',    'Overview')}
        ${_innerTabBtn('per-peserta', 'Per Peserta')}
        ${_innerTabBtn('per-ek',      'Per EK')}
        ${_innerTabBtn('per-soal',    'Per Soal')}
        ${_innerTabBtn('per-pengajar','Per Pengajar')}
      </div>
      <button id="btn-print-penyelenggara"
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
        </svg>
        Print
      </button>
    </div>

    <div id="penyelenggara-content" class="report-penyelenggara-content"></div>
  `;

  container.querySelectorAll('.inner-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.innerTab = btn.dataset.tab;
      container.querySelectorAll('.inner-tab-btn').forEach(b => {
        b.className = _innerTabClass(b.dataset.tab === S.innerTab);
      });
      _renderInnerTab(container.querySelector('#penyelenggara-content'));
    });
  });

  container.querySelector('#btn-print-penyelenggara').addEventListener('click', () => window.print());

  _renderInnerTab(container.querySelector('#penyelenggara-content'));
}

function _innerTabBtn(id, label) {
  const active = S.innerTab === id;
  return `<button class="inner-tab-btn ${_innerTabClass(active)}" data-tab="${id}">${label}</button>`;
}

function _innerTabClass(active) {
  return `inner-tab-btn px-3 py-1.5 rounded-md text-sm transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`;
}

// ─── INNER TABS ───────────────────────────────────────────────────────────────

function _renderInnerTab(el) {
  _destroyAllCharts();
  if (!el) return;

  if (S.innerTab === 'overview')     _renderOverview(el);
  if (S.innerTab === 'per-peserta')  _renderPerPeserta(el);
  if (S.innerTab === 'per-ek')       _renderPerEK(el);
  if (S.innerTab === 'per-soal')     _renderPerSoal(el);
  if (S.innerTab === 'per-pengajar') _renderPerPengajar(el);
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

function _renderOverview(el) {
  const { stats, distribusi, bimtek } = S.data;
  const b = S.bimtek;

  el.innerHTML = `
    <!-- Summary cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      ${_statCard('Total Peserta', stats.total, 'text-white')}
      ${_statCard('Lulus', stats.lulus, 'text-green-400')}
      ${_statCard('Belum Memenuhi', stats.tidakLulus, 'text-red-400')}
      ${_statCard('Tingkat Kelulusan', `${stats.pctLulus}%`, stats.pctLulus >= 80 ? 'text-green-400' : 'text-yellow-400')}
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      ${_statCard('Rata-rata Pre Test',  stats.avgPretest   != null ? stats.avgPretest   : '—', 'text-gray-300')}
      ${_statCard('Rata-rata Post Test', stats.avgPosttest  != null ? stats.avgPosttest  : '—', 'text-blue-400')}
      ${_statCard('Rata-rata Nilai Akhir', stats.avgNilaiAkhir != null ? stats.avgNilaiAkhir : '—', 'text-white')}
      ${_statCard('Rata-rata Kehadiran', stats.avgKehadiran != null ? `${stats.avgKehadiran}%` : '—', 'text-gray-300')}
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

      <!-- Distribusi Nilai -->
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 class="text-sm font-semibold text-white mb-4">Distribusi Nilai Akhir</h3>
        <div class="relative h-48">
          <canvas id="chart-distribusi"></canvas>
        </div>
      </div>

      <!-- Pre vs Post -->
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 class="text-sm font-semibold text-white mb-4">Rata-rata Pre Test vs Post Test</h3>
        <div class="relative h-48">
          <canvas id="chart-prepost"></canvas>
        </div>
      </div>

    </div>

    <!-- Kelulusan pie + Kehadiran bar -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- Kelulusan donut -->
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 class="text-sm font-semibold text-white mb-4">Status Kelulusan</h3>
        <div class="relative h-48">
          <canvas id="chart-kelulusan"></canvas>
        </div>
      </div>

      <!-- Info bimtek -->
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 class="text-sm font-semibold text-white mb-4">Informasi Kegiatan</h3>
        <dl class="space-y-2 text-sm">
          <div class="flex gap-2"><dt class="text-gray-400 w-32 shrink-0">Nama Kegiatan</dt><dd class="text-white">${_esc(b.nama)}</dd></div>
          <div class="flex gap-2"><dt class="text-gray-400 w-32 shrink-0">Tipe</dt><dd class="text-white">${_esc(b.tipe?.toUpperCase() ?? '-')}</dd></div>
          <div class="flex gap-2"><dt class="text-gray-400 w-32 shrink-0">Periode</dt><dd class="text-white">${_fmtDate(b.periode?.mulai)} – ${_fmtDate(b.periode?.selesai)}</dd></div>
          <div class="flex gap-2"><dt class="text-gray-400 w-32 shrink-0">Lokasi</dt><dd class="text-white">${_esc(b.lokasi || '-')}</dd></div>
          <div class="flex gap-2"><dt class="text-gray-400 w-32 shrink-0">KKM</dt><dd class="text-white">${b.kkm ?? 60}</dd></div>
          <div class="flex gap-2"><dt class="text-gray-400 w-32 shrink-0">Kapasitas</dt><dd class="text-white">${b.kapasitas ?? '-'}</dd></div>
        </dl>
      </div>

    </div>
  `;

  // Init charts setelah DOM ready
  requestAnimationFrame(() => {
    _initDistribusiChart(distribusi);
    _initPrePostChart(stats);
    _initKelulusanChart(stats);
  });
}

function _statCard(label, value, valueClass) {
  return `
    <div class="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div class="text-xs text-gray-400 mb-1">${label}</div>
      <div class="text-2xl font-bold ${valueClass}">${value}</div>
    </div>`;
}

// ─── PER PESERTA ──────────────────────────────────────────────────────────────

function _renderPerPeserta(el) {
  const { scoresSorted, bimtek: b } = S.data;
  const kkm = S.bimtek.kkm ?? 60;

  if (scoresSorted.length === 0) {
    el.innerHTML = `<div class="text-gray-400 text-sm py-8 text-center">Belum ada data nilai peserta.</div>`;
    return;
  }

  const rows = scoresSorted.map((s, i) => `
    <tr>
      <td class="text-center text-gray-500 text-xs">${i + 1}</td>
      <td>
        <div class="font-medium text-white text-sm">${_esc(s.peserta?.nama ?? s.noPeserta)}</div>
        <div class="text-xs text-gray-500">${_esc(s.peserta?.instansi ?? '')}</div>
      </td>
      <td class="text-center text-sm">${_val(s.pretest)}</td>
      <td class="text-center text-sm">${_val(s.posttest)}</td>
      <td class="text-center text-sm">${_val(s.kehadiran)}${s.kehadiran != null ? '%' : ''}</td>
      <td class="text-center text-sm">${_val(s.keaktifan)}</td>
      <td class="text-center text-sm">${_val(s.respek)}</td>
      <td class="text-center font-bold text-sm ${s.nilaiAkhir >= kkm ? 'text-green-400' : 'text-red-400'}">${_val(s.nilaiAkhir)}</td>
      <td class="text-center">
        ${s.lulus
          ? '<span class="badge badge-green text-xs">LULUS</span>'
          : '<span class="badge badge-red text-xs">BELUM</span>'}
      </td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="text-xs text-gray-400 mb-3">${scoresSorted.length} peserta · KKM ${kkm}</div>
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
      <table class="btam-table">
        <thead>
          <tr>
            <th class="text-center w-8">#</th>
            <th>Nama Peserta</th>
            <th class="text-center">Pre</th>
            <th class="text-center">Post</th>
            <th class="text-center">Hadir</th>
            <th class="text-center">Aktif</th>
            <th class="text-center">Respek</th>
            <th class="text-center">Nilai Akhir</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── PER EK ───────────────────────────────────────────────────────────────────

function _renderPerEK(el) {
  const { ekDataAll } = S.data;

  if (!ekDataAll || ekDataAll.length === 0) {
    el.innerHTML = `
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
        <p class="text-gray-400 text-sm">Data per-Elemen Kompetensi belum tersedia.</p>
        <p class="text-gray-600 text-xs mt-2">Sinkronisasi nilai pre/post test terlebih dahulu di tab Penilaian.</p>
      </div>`;
    return;
  }

  const rows = ekDataAll.map(ek => {
    const deltaStr = ek.delta != null
      ? `<span class="${ek.delta >= 0 ? 'text-green-400' : 'text-red-400'}">${ek.delta >= 0 ? '+' : ''}${ek.delta}%</span>`
      : '—';
    return `
      <tr>
        <td class="font-medium text-sm">${_esc(ek.ekNama)}</td>
        <td class="text-center text-sm">${ek.prePct  != null ? ek.prePct  + '%' : '—'}</td>
        <td class="text-center text-sm">${ek.postPct != null ? ek.postPct + '%' : '—'}</td>
        <td class="text-center text-sm">${deltaStr}</td>
        <td class="text-center text-xs text-gray-500">${ek.pesertaCount ?? '—'}</td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <!-- Chart per-EK -->
    <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
      <h3 class="text-sm font-semibold text-white mb-4">Perbandingan Pre/Post per Elemen Kompetensi</h3>
      <div class="relative" style="height: ${Math.max(200, ekDataAll.length * 40)}px">
        <canvas id="chart-ek"></canvas>
      </div>
    </div>

    <!-- Tabel -->
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table class="btam-table">
        <thead>
          <tr>
            <th>Elemen Kompetensi</th>
            <th class="text-center">Pre Test (avg)</th>
            <th class="text-center">Post Test (avg)</th>
            <th class="text-center">Perubahan</th>
            <th class="text-center">Peserta</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  requestAnimationFrame(() => _initEKChart(ekDataAll));
}

// ─── PER SOAL ─────────────────────────────────────────────────────────────────

function _renderPerSoal(el) {
  const { soalErrorData } = S.data;

  if (!soalErrorData || soalErrorData.length === 0) {
    el.innerHTML = `
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
        <p class="text-gray-400 text-sm">Data per soal belum tersedia.</p>
        <p class="text-gray-600 text-xs mt-2">Sinkronisasi nilai pre/post test terlebih dahulu di tab Penilaian.</p>
      </div>`;
    return;
  }

  // Top 10 untuk chart
  const top10 = soalErrorData.slice(0, 10);
  const chartH = Math.max(200, top10.length * 40);

  const rows = soalErrorData.map((s, i) => {
    const pct = s.persenSalah;
    const barColor = pct >= 70 ? 'bg-red-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-green-500';
    return `
      <tr>
        <td class="text-center text-gray-500 text-xs">${i + 1}</td>
        <td class="text-sm text-gray-200 max-w-xs">
          <div class="line-clamp-2">${_esc(s.pertanyaan)}</div>
          <div class="flex gap-1 mt-1">
            <span class="badge badge-blue text-xs">${_esc(s.elemenKompetensi)}</span>
            <span class="badge badge-gray text-xs">${_esc(s.bloomLevel)}</span>
          </div>
        </td>
        <td class="text-center text-sm text-gray-400">${s.totalAttempts}</td>
        <td class="text-center text-sm text-red-400">${s.salahCount}</td>
        <td class="text-center">
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-gray-700 rounded-full h-2">
              <div class="${barColor} h-2 rounded-full" style="width:${pct}%"></div>
            </div>
            <span class="text-sm font-medium ${pct >= 70 ? 'text-red-400' : pct >= 40 ? 'text-yellow-400' : 'text-green-400'} w-10 text-right">${pct}%</span>
          </div>
        </td>
        <td class="text-center text-xs text-gray-500">
          ${s.preAttempts > 0 ? `Pre: ${s.preSalah}/${s.preAttempts}` : ''}
          ${s.preAttempts > 0 && s.postAttempts > 0 ? '<br>' : ''}
          ${s.postAttempts > 0 ? `Post: ${s.postSalah}/${s.postAttempts}` : ''}
        </td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="text-xs text-gray-400 mb-4">
      ${soalErrorData.length} soal · Diurutkan dari yang paling sering salah
    </div>

    <!-- Chart top 10 -->
    <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
      <h3 class="text-sm font-semibold text-white mb-4">Top ${top10.length} Soal dengan Error Rate Tertinggi</h3>
      <div class="relative" style="height:${chartH}px">
        <canvas id="chart-soal-error"></canvas>
      </div>
    </div>

    <!-- Tabel lengkap -->
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
      <table class="btam-table">
        <thead>
          <tr>
            <th class="text-center w-8">#</th>
            <th>Pertanyaan</th>
            <th class="text-center">Attempt</th>
            <th class="text-center">Salah</th>
            <th class="text-center w-40">% Salah</th>
            <th class="text-center">Pre / Post</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  requestAnimationFrame(() => _initSoalErrorChart(top10));
}

// ─── PER PENGAJAR ─────────────────────────────────────────────────────────────

function _renderPerPengajar(el) {
  const { pengajarData, stats } = S.data;

  if (!pengajarData || pengajarData.length === 0) {
    el.innerHTML = `<div class="text-gray-400 text-sm py-8 text-center">Belum ada data pengajar.</div>`;
    return;
  }

  const rows = pengajarData.map(pg => {
    const bidangStr = (pg.bidang ?? []).map(b => {
      const found = BIDANG_LIST.find(x => x.bidangId === b);
      return found ? `<span class="badge badge-blue text-xs mr-1">${_esc(found.nama)}</span>` : '';
    }).join('');
    const mapelStr = pg.mapels.length > 0 ? pg.mapels.map(_esc).join(', ') : '—';

    return `
      <tr>
        <td>
          <div class="font-medium text-white text-sm">${_esc(pg.nama)}</div>
          <div class="mt-0.5">${bidangStr}</div>
        </td>
        <td class="text-sm text-gray-300">${mapelStr}</td>
        <td class="text-center text-sm">
          ${stats.avgNilaiAkhir != null ? stats.avgNilaiAkhir : '—'}
        </td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="text-xs text-gray-400 mb-3">
      Nilai pengajar yang ditampilkan adalah rata-rata nilai akhir seluruh peserta bimtek ini.
    </div>
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table class="btam-table">
        <thead>
          <tr>
            <th>Pengajar</th>
            <th>Mata Pelajaran Diampu</th>
            <th class="text-center">Avg Nilai Akhir Kelas</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── CHART.JS HELPERS ─────────────────────────────────────────────────────────

function _initDistribusiChart(distribusi) {
  const canvas = document.getElementById('chart-distribusi');
  if (!canvas || !window.Chart) return;

  _destroyChart('distribusi');
  _charts['distribusi'] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: distribusi.map(b => b.label),
      datasets: [{
        label: 'Jumlah Peserta',
        data: distribusi.map(b => b.count),
        backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#10b981'],
        borderRadius: 4,
        borderWidth: 0
      }]
    },
    options: _chartOptions({ yLabel: 'Peserta', showLegend: false })
  });
}

function _initPrePostChart(stats) {
  const canvas = document.getElementById('chart-prepost');
  if (!canvas || !window.Chart) return;
  if (stats.avgPretest == null && stats.avgPosttest == null) return;

  _destroyChart('prepost');
  _charts['prepost'] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Pre Test', 'Post Test'],
      datasets: [{
        data: [stats.avgPretest ?? 0, stats.avgPosttest ?? 0],
        backgroundColor: ['#6b7280', '#3b82f6'],
        borderRadius: 4,
        borderWidth: 0
      }]
    },
    options: {
      ..._chartOptions({ yLabel: 'Nilai', showLegend: false }),
      scales: {
        ..._chartOptions({}).scales,
        y: { ..._chartOptions({}).scales?.y, max: 100 }
      }
    }
  });
}

function _initKelulusanChart(stats) {
  const canvas = document.getElementById('chart-kelulusan');
  if (!canvas || !window.Chart || stats.total === 0) return;

  _destroyChart('kelulusan');
  _charts['kelulusan'] = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Lulus', 'Belum Memenuhi'],
      datasets: [{
        data: [stats.lulus, stats.tidakLulus],
        backgroundColor: ['#22c55e', '#ef4444'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 12 }, padding: 16 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} peserta` } }
      }
    }
  });
}

function _initEKChart(ekDataAll) {
  const canvas = document.getElementById('chart-ek');
  if (!canvas || !window.Chart || !ekDataAll.length) return;

  _destroyChart('ek');
  const labels = ekDataAll.map(ek => ek.ekNama);
  _charts['ek'] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pre Test',
          data: ekDataAll.map(ek => ek.prePct),
          backgroundColor: '#6b728080',
          borderColor: '#6b7280',
          borderWidth: 1,
          borderRadius: 3
        },
        {
          label: 'Post Test',
          data: ekDataAll.map(ek => ek.postPct),
          backgroundColor: '#3b82f680',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 3
        }
      ]
    },
    options: {
      ..._chartOptions({ yLabel: '%' }),
      indexAxis: 'y',
      scales: {
        x: {
          max: 100, min: 0,
          grid: { color: '#374151' },
          ticks: { color: '#9ca3af', callback: v => v + '%' }
        },
        y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af', font: { size: 11 } } }
      }
    }
  });
}

function _initSoalErrorChart(top10) {
  const canvas = document.getElementById('chart-soal-error');
  if (!canvas || !window.Chart || !top10.length) return;

  _destroyChart('soal-error');
  // Label disingkat: nomor urut + EK agar tidak terlalu panjang
  const labels = top10.map((s, i) => `#${i + 1} ${s.elemenKompetensi !== '—' ? s.elemenKompetensi : ''}`);
  const colors = top10.map(s =>
    s.persenSalah >= 70 ? '#ef4444' : s.persenSalah >= 40 ? '#f59e0b' : '#22c55e'
  );

  _charts['soal-error'] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '% Salah',
        data: top10.map(s => s.persenSalah),
        backgroundColor: colors.map(c => c + '99'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw}% salah`,
            afterLabel: ctx => {
              const s = top10[ctx.dataIndex];
              const short = s.pertanyaan.length > 80
                ? s.pertanyaan.slice(0, 80) + '…'
                : s.pertanyaan;
              return short;
            }
          }
        }
      },
      scales: {
        x: {
          min: 0, max: 100,
          grid: { color: '#374151' },
          ticks: { color: '#9ca3af', callback: v => v + '%' }
        },
        y: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } }
      }
    }
  });
}

function _chartOptions({ yLabel = '', showLegend = true } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        labels: { color: '#9ca3af', font: { size: 12 } }
      },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
      y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' }, beginAtZero: true }
    }
  };
}

function _destroyChart(key) {
  if (_charts[key]) {
    _charts[key].destroy();
    delete _charts[key];
  }
}

function _destroyAllCharts() {
  Object.keys(_charts).forEach(_destroyChart);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _val(v) {
  return v != null ? v : '—';
}

function _fmtDate(ts) {
  if (!ts) return '-';
  const d = ts?.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

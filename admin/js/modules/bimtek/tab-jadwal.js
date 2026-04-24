/**
 * bimtek/tab-jadwal.js
 * Lokasi: admin/js/modules/bimtek/tab-jadwal.js
 *
 * Scheduler form-based — Phase 1.
 * Split mapel di-skip (Phase 3 M3.8).
 *
 * Flow:
 *  1. Render daftar hari dari periode bimtek
 *  2. Per hari: tampilkan slot timeline + form tambah sesi mapel
 *  3. Admin pilih mapel → set jam mulai → sistem compute jam selesai
 *  4. Validasi blocker + warning sebelum save
 *  5. Save → tulis ke Firestore (sesi sub-collection + update mapel.jadwal)
 */

import {
  listMapel, listSesi, createSesi, clearJadwal,
  getBimtek, updateMapel
} from './api.js';
import {
  db, collection, query, where, getDocs,
  doc, getDoc, deleteDoc, serverTimestamp, Timestamp
} from '../../../../shared/db.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { requireWrite } from '../../auth-guard.js';
import { BIDANG_LIST } from '../../../../shared/constants.js';

// ─── Konstanta jadwal ──────────────────────────────────────────────────────────

const SCHEDULE = {
  senKam: {
    jamMulai: '08:00',
    maxJp: 9,
    warnJp: 8,
    breaks: [
      { jamMulai: '10:15', jamSelesai: '10:30', label: 'Break Pagi' },
      { jamMulai: '12:00', jamSelesai: '13:00', label: 'ISHOMA' },
      { jamMulai: '14:30', jamSelesai: '14:45', label: 'Break Sore' },
    ],
  },
  jumat: {
    jamMulai: '08:00',
    maxJpPerMapel: 7,   // blocker
    breaks: [
      { jamMulai: '10:15', jamSelesai: '10:30', label: 'Break Pagi' },
      { jamMulai: '11:15', jamSelesai: '13:45', label: 'ISHOMA Jumat' },
    ],
  },
};

const JP_MENIT = 45;

// ─── State modul ──────────────────────────────────────────────────────────────

let _bimtekId  = null;
let _bimtek    = null;
let _mapelList = [];   // semua mapel bimtek
let _sesiList  = [];   // semua sesi tersimpan
let _days      = [];   // array Date objek (periode bimtek)

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function renderTabJadwal(pane, bimtekId, bimtek) {
  _bimtekId = bimtekId;
  _bimtek   = bimtek;

  pane.innerHTML = _loadingHTML();
  try {
    [_mapelList, _sesiList] = await Promise.all([
      listMapel(bimtekId),
      listSesi(bimtekId),
    ]);
    _days = _buildDayList(bimtek.periode?.mulai, bimtek.periode?.selesai);
    _render(pane);
  } catch (err) {
    pane.innerHTML = `<div class="text-red-400 text-sm p-4">${err.message}</div>`;
  }
}

// ─── Main render ──────────────────────────────────────────────────────────────

function _render(pane) {
  if (!_days.length) {
    pane.innerHTML = `
      <div class="text-yellow-400 text-sm p-4">
        Periode bimtek belum diset. Edit bimtek terlebih dahulu.
      </div>`;
    return;
  }

  const warnings = _globalWarnings();
  const unscheduled = _mapelList.filter(m => !m.jadwal);

  pane.innerHTML = `
    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-400">${_days.length} hari · ${_mapelList.length} mapel</span>
        ${unscheduled.length
          ? `<span class="text-xs text-yellow-400">⚠ ${unscheduled.length} mapel belum dijadwalkan</span>`
          : `<span class="text-xs text-green-400">✓ Semua mapel terjadwal</span>`}
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-export-jadwal"
          class="px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export Excel
        </button>
        <button id="btn-clear-jadwal"
          class="px-3 py-1.5 rounded-lg text-xs border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors">
          Reset Jadwal
        </button>
      </div>
    </div>

    <!-- Global warnings -->
    ${warnings.length ? `
      <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 mb-4 space-y-1">
        ${warnings.map(w => `<p class="text-xs text-yellow-400">⚠ ${w}</p>`).join('')}
      </div>` : ''}

    <!-- Mapel belum terjadwal -->
    ${unscheduled.length ? `
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Belum Dijadwalkan</p>
        <div class="flex flex-wrap gap-2">
          ${unscheduled.map(m => `
            <span class="inline-flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs text-gray-300">
              <span class="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0"></span>
              ${_esc(m.nama)}
              <span class="text-gray-600">${m.totalJp} JP</span>
            </span>`).join('')}
        </div>
      </div>` : ''}

    <!-- Timeline per hari -->
    <div class="space-y-4" id="days-container">
      ${_days.map(d => _buildDayCard(d)).join('')}
    </div>
  `;

  _attachListeners(pane);
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function _buildDayCard(date) {
  const dayKey   = _dateKey(date);
  const isJumat  = date.getDay() === 5;
  const isMinggu = date.getDay() === 0;
  const sched    = isJumat ? SCHEDULE.jumat : SCHEDULE.senKam;
  const sesiHari = _sesiList.filter(s => _dateKey(_tsToDate(s.tanggal)) === dayKey);
  const jpHari   = sesiHari.filter(s => s.tipe === 'mapel').reduce((a, s) => a + (s.jp || 0), 0);
  const warnPadat = !isJumat && jpHari > SCHEDULE.senKam.warnJp;

  if (isMinggu) return `
    <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-4 opacity-50">
      <p class="text-xs text-gray-500">${_fmtDay(date)} — Libur (Minggu)</p>
    </div>`;

  return `
    <div class="bg-gray-900 border ${warnPadat ? 'border-yellow-700/50' : 'border-gray-800'} rounded-xl overflow-hidden"
      data-day="${dayKey}">

      <!-- Day header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-gray-200">${_fmtDay(date)}</span>
          ${isJumat ? '<span class="text-xs bg-blue-900/40 text-blue-400 border border-blue-700/40 px-1.5 py-0.5 rounded">Jumat</span>' : ''}
          ${warnPadat ? '<span class="text-xs text-yellow-400">⚠ Hari padat</span>' : ''}
        </div>
        <span class="text-xs text-gray-500">${jpHari} JP terjadwal</span>
      </div>

      <!-- Timeline visual -->
      <div class="px-4 py-3 space-y-1.5" id="timeline-${dayKey}">
        ${_buildTimeline(dayKey, sched)}
      </div>

      <!-- Form tambah sesi mapel -->
      <div class="px-4 pb-4">
        <div class="border border-dashed border-gray-700 rounded-lg p-3">
          <p class="text-xs text-gray-500 mb-2">Tambah mata pelajaran ke hari ini:</p>
          <div class="flex items-center gap-2 flex-wrap">
            <select class="form-select text-xs py-1 w-52 sel-mapel" data-day="${dayKey}">
              <option value="">— Pilih mapel —</option>
              ${_availableMapel(dayKey).map(m => `
                <option value="${m.id}" data-jp="${m.totalJp}">
                  ${_esc(m.nama)} (${m.totalJp} JP)
                </option>`).join('')}
            </select>
            <input type="time" class="form-input text-xs py-1 w-28 inp-jam" data-day="${dayKey}"
              value="${sched.jamMulai}" step="900">
            <button class="btn-add-sesi px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              data-day="${dayKey}">
              Tambah
            </button>
          </div>
          <p class="text-xs text-gray-600 mt-1.5">
            Jam mulai → sistem hitung jam selesai otomatis berdasarkan JP.
            Break/ISHOMA tidak dihitung JP.
          </p>
        </div>
      </div>
    </div>`;
}

// ─── Timeline visual ──────────────────────────────────────────────────────────

function _buildTimeline(dayKey, sched) {
  const isJumat = sched === SCHEDULE.jumat;
  const sesiHari = _sesiList
    .filter(s => _dateKey(_tsToDate(s.tanggal)) === dayKey)
    .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));

  const rows = [];

  // Break slots (dari schedule template)
  const breakSlots = sched.breaks.map(b => ({
    ...b, tipe: 'break', _template: true
  }));

  // Merge sesi mapel + break template, sort by jamMulai
  const allSlots = [
    ...sesiHari.map(s => ({ ...s, _template: false })),
    ...breakSlots.filter(b => {
      // Hanya tampilkan break kalau tidak ada sesi mapel yang sudah overlap
      return !sesiHari.some(s =>
        _timeToMin(s.jamMulai) < _timeToMin(b.jamSelesai) &&
        _timeToMin(s.jamSelesai) > _timeToMin(b.jamMulai)
      );
    }),
  ].sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));

  if (!allSlots.length) {
    return `<p class="text-xs text-gray-600 py-2">Belum ada sesi. Tambah mapel di bawah.</p>`;
  }

  return allSlots.map(slot => {
    if (slot.tipe === 'break' || slot.tipe === 'ishoma') {
      return `
        <div class="flex items-center gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg">
          <span class="text-xs text-gray-600 font-mono w-28 shrink-0">
            ${slot.jamMulai} – ${slot.jamSelesai}
          </span>
          <span class="text-xs text-gray-500 italic">${_esc(slot.label || slot.keterangan || 'Break')}</span>
        </div>`;
    }

    // Mapel sesi
    const mapel = _mapelList.find(m => m.id === slot.mapelId);
    const bidang = BIDANG_LIST.find(b => b.id === mapel?.bidangId);
    return `
      <div class="flex items-center gap-3 py-2 px-3 bg-blue-900/20 border border-blue-800/40 rounded-lg group">
        <span class="text-xs text-gray-400 font-mono w-28 shrink-0">
          ${slot.jamMulai} – ${slot.jamSelesai}
        </span>
        <div class="flex-1 min-w-0">
          <span class="text-sm text-gray-200 font-medium">${_esc(mapel?.nama ?? slot.mapelId)}</span>
          <span class="text-xs text-gray-500 ml-2">${slot.jp} JP · ${_esc(bidang?.nama ?? '')}</span>
        </div>
        <button class="btn-remove-sesi opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700
          text-gray-500 hover:text-red-400 transition-all" data-sesi-id="${slot.id}"
          data-mapel-id="${slot.mapelId}" title="Hapus dari jadwal">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

// ─── Add sesi logic ───────────────────────────────────────────────────────────

async function _handleAddSesi(dayKey) {
  const dayEl   = document.querySelector(`[data-day="${dayKey}"]`);
  const selMapel = dayEl?.querySelector('.sel-mapel');
  const inpJam  = dayEl?.querySelector('.inp-jam');
  const btn     = dayEl?.querySelector('.btn-add-sesi');

  const mapelId = selMapel?.value;
  const jamMulai = inpJam?.value;

  if (!mapelId) { showToast('Pilih mata pelajaran dulu', 'warning'); return; }
  if (!jamMulai) { showToast('Set jam mulai dulu', 'warning'); return; }

  const mapel = _mapelList.find(m => m.id === mapelId);
  if (!mapel) return;

  const date   = _days.find(d => _dateKey(d) === dayKey);
  const isJumat = date?.getDay() === 5;

  // ── Validasi blocker ──────────────────────────────────────────────────────

  // 1. Mapel > 7 JP di hari Jumat
  if (isJumat && mapel.totalJp > SCHEDULE.jumat.maxJpPerMapel) {
    showToast(
      `Mapel "${mapel.nama}" punya ${mapel.totalJp} JP — tidak bisa dijadwalkan di hari Jumat (maks ${SCHEDULE.jumat.maxJpPerMapel} JP karena ISHOMA panjang 11:15–13:45).`,
      'error'
    );
    return;
  }

  // 2. Mapel sudah terjadwal di hari lain
  if (mapel.jadwal) {
    const existingKey = _dateKey(_tsToDate(mapel.jadwal.tanggal));
    if (existingKey !== dayKey) {
      showToast(
        `Mapel "${mapel.nama}" sudah dijadwalkan di ${_fmtDayFromKey(existingKey)}. Hapus dulu dari hari itu.`,
        'error'
      );
      return;
    }
    // Mapel sudah di hari yang sama — berarti ini sesi tambahan (split)
    // Phase 1: tidak support split, tolak
    showToast(
      `Mapel "${mapel.nama}" sudah terjadwal di hari ini. Split mapel akan tersedia di versi berikutnya.`,
      'warning'
    );
    return;
  }

  // 3. Compute jam selesai — perlu handle lompat break
  const sched = isJumat ? SCHEDULE.jumat : SCHEDULE.senKam;
  const { jamSelesai, error: computeError } = _computeJamSelesai(
    jamMulai, mapel.totalJp, sched.breaks
  );

  if (computeError) {
    showToast(computeError, 'error');
    return;
  }

  // 4. Overlap dengan sesi mapel lain di hari yang sama
  const sesiHari = _sesiList.filter(s =>
    _dateKey(_tsToDate(s.tanggal)) === dayKey && s.tipe === 'mapel'
  );
  const overlap = sesiHari.find(s =>
    _timeToMin(jamMulai) < _timeToMin(s.jamSelesai) &&
    _timeToMin(jamSelesai) > _timeToMin(s.jamMulai)
  );
  if (overlap) {
    const om = _mapelList.find(m => m.id === overlap.mapelId);
    showToast(
      `Waktu ${jamMulai}–${jamSelesai} overlap dengan "${om?.nama ?? 'mapel lain'}" (${overlap.jamMulai}–${overlap.jamSelesai}).`,
      'error'
    );
    return;
  }

  // 5. Overlap dengan break/ISHOMA
  const breakOverlap = sched.breaks.find(b =>
    _timeToMin(jamMulai) < _timeToMin(b.jamSelesai) &&
    _timeToMin(jamSelesai) > _timeToMin(b.jamMulai)
  );
  if (breakOverlap) {
    showToast(
      `Waktu ${jamMulai}–${jamSelesai} bertabrakan dengan ${breakOverlap.label} (${breakOverlap.jamMulai}–${breakOverlap.jamSelesai}). Geser jam mulai.`,
      'error'
    );
    return;
  }

  // ── Warning non-blocker ───────────────────────────────────────────────────

  const jpHariSetelah = sesiHari.reduce((a, s) => a + (s.jp || 0), 0) + mapel.totalJp;
  if (!isJumat && jpHariSetelah > SCHEDULE.senKam.warnJp) {
    showToast(
      `Total JP hari ini akan menjadi ${jpHariSetelah} JP. Hari padat — hati-hati kelelahan peserta.`,
      'warning'
    );
    // Non-blocker: lanjut save
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  btn.disabled = true;
  btn.textContent = 'Menyimpan…';

  try {
    const tanggal = Timestamp.fromDate(date);

    // Buat sesi di Firestore
    const newSesi = await createSesi(_bimtekId, {
      tanggal,
      jamMulai,
      jamSelesai,
      tipe: 'mapel',
      mapelId,
      jp: mapel.totalJp,
      keterangan: null,
    });

    // Update mapel.jadwal
    await updateMapel(_bimtekId, mapelId, {
      jadwal: {
        tanggal,
        jamMulai,
        jamSelesai,
        sesiIds: [newSesi.sesiId],
      },
    });

    showToast(`${mapel.nama} dijadwalkan ${jamMulai}–${jamSelesai}`, 'success');

    // Refresh state
    [_mapelList, _sesiList] = await Promise.all([
      listMapel(_bimtekId),
      listSesi(_bimtekId),
    ]);

    // Re-render
    const pane = document.querySelector('#pane-jadwal');
    if (pane) _render(pane);

  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Tambah';
  }
}

// ─── Remove sesi ──────────────────────────────────────────────────────────────

async function _handleRemoveSesi(sesiId, mapelId) {
  if (!requireWrite()) return;

  const mapel = _mapelList.find(m => m.id === mapelId);
  const ok = await confirmDialog({
    title: 'Hapus dari Jadwal',
    message: `Hapus "${mapel?.nama ?? 'mapel'}" dari jadwal? Mapel akan kembali ke daftar "Belum Dijadwalkan".`,
    confirmLabel: 'Hapus', danger: true,
  });
  if (!ok) return;

  try {
    // Hapus sesi doc
    await deleteDoc(doc(db, 'bimtek', _bimtekId, 'sesi', sesiId));

    // Reset mapel.jadwal → null
    if (mapelId) {
      await updateMapel(_bimtekId, mapelId, { jadwal: null });
    }

    showToast('Sesi dihapus dari jadwal', 'success');

    [_mapelList, _sesiList] = await Promise.all([
      listMapel(_bimtekId),
      listSesi(_bimtekId),
    ]);
    const pane = document.querySelector('#pane-jadwal');
    if (pane) _render(pane);

  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

// ─── Clear all ────────────────────────────────────────────────────────────────

async function _handleClearJadwal(pane) {
  if (!requireWrite()) return;
  const ok = await confirmDialog({
    title: 'Reset Seluruh Jadwal',
    message: 'Hapus semua sesi yang sudah dijadwalkan? Semua mapel akan kembali ke "Belum Dijadwalkan".',
    confirmLabel: 'Reset', danger: true,
  });
  if (!ok) return;

  try {
    await clearJadwal(_bimtekId);
    showToast('Jadwal direset', 'success');
    [_mapelList, _sesiList] = await Promise.all([
      listMapel(_bimtekId),
      listSesi(_bimtekId),
    ]);
    _render(pane);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

// ─── Export Excel ─────────────────────────────────────────────────────────────

async function _handleExportJadwal() {
  try {
    const { utils, writeFile } = await import('https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs');

    const rows = [['Hari/Tanggal', 'Jam Mulai', 'Jam Selesai', 'Mata Pelajaran', 'JP', 'Bidang', 'Pengajar']];

    const sorted = [..._sesiList].sort((a, b) => {
      const ta = _tsToDate(a.tanggal).getTime();
      const tb = _tsToDate(b.tanggal).getTime();
      if (ta !== tb) return ta - tb;
      return a.jamMulai.localeCompare(b.jamMulai);
    });

    for (const s of sorted) {
      if (s.tipe !== 'mapel') continue;
      const mapel  = _mapelList.find(m => m.id === s.mapelId);
      const bidang = BIDANG_LIST.find(b => b.id === mapel?.bidangId);
      rows.push([
        _fmtDay(_tsToDate(s.tanggal)),
        s.jamMulai,
        s.jamSelesai,
        mapel?.nama ?? '—',
        s.jp ?? 0,
        bidang?.nama ?? '—',
        (mapel?.pengajarIds ?? []).join(', '),
      ]);
    }

    const ws = utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 35 }, { wch: 5 }, { wch: 20 }, { wch: 30 }];
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Jadwal');
    writeFile(wb, `jadwal-${_bimtek?.kodeBimtek ?? _bimtekId}.xlsx`);
    showToast('Jadwal berhasil di-export', 'success');

  } catch (err) {
    showToast('Export gagal: ' + err.message, 'error');
  }
}

// ─── Listeners ────────────────────────────────────────────────────────────────

function _attachListeners(pane) {
  // Tambah sesi per hari
  pane.querySelectorAll('.btn-add-sesi').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!requireWrite()) return;
      _handleAddSesi(btn.dataset.day);
    });
  });

  // Enter di jam input juga trigger add
  pane.querySelectorAll('.inp-jam').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (!requireWrite()) return;
        _handleAddSesi(inp.dataset.day);
      }
    });
  });

  // Hapus sesi
  pane.querySelectorAll('.btn-remove-sesi').forEach(btn => {
    btn.addEventListener('click', () =>
      _handleRemoveSesi(btn.dataset.sesiId, btn.dataset.mapelId)
    );
  });

  // Export
  pane.querySelector('#btn-export-jadwal')?.addEventListener('click', _handleExportJadwal);

  // Reset
  pane.querySelector('#btn-clear-jadwal')?.addEventListener('click', () => _handleClearJadwal(pane));
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

/**
 * Hitung jamSelesai dari jamMulai + totalJp,
 * dengan loncat break yang ada di tengah.
 * Return { jamSelesai: '14:30', error: null } atau { jamSelesai: null, error: 'pesan' }
 */
function _computeJamSelesai(jamMulai, totalJp, breaks) {
  let cursor = _timeToMin(jamMulai);
  let jpLeft = totalJp;

  // Max iterasi: 9 JP × 45 menit + total break ~135 menit = ~540 menit dari mulai
  const maxCursor = cursor + 540;

  while (jpLeft > 0) {
    if (cursor > maxCursor) {
      return { jamSelesai: null, error: 'Jadwal melampaui batas waktu. Kurangi JP atau geser jam mulai.' };
    }

    // Cek apakah cursor sekarang jatuh di dalam break
    const activeBreak = breaks.find(b =>
      cursor >= _timeToMin(b.jamMulai) && cursor < _timeToMin(b.jamSelesai)
    );

    if (activeBreak) {
      // Loncat ke akhir break
      cursor = _timeToMin(activeBreak.jamSelesai);
      continue;
    }

    // Sampai mana kita bisa jalan sebelum ketemu break berikutnya?
    const nextBreak = breaks
      .filter(b => _timeToMin(b.jamMulai) > cursor)
      .sort((a, b) => _timeToMin(a.jamMulai) - _timeToMin(b.jamMulai))[0];

    const minutesAvailable = nextBreak
      ? _timeToMin(nextBreak.jamMulai) - cursor
      : jpLeft * JP_MENIT + 1; // tidak ada break lagi, bisa sampai selesai

    const minutesToConsume = jpLeft * JP_MENIT;

    if (minutesAvailable >= minutesToConsume) {
      // Selesai sebelum break berikutnya
      cursor += minutesToConsume;
      jpLeft = 0;
    } else {
      // Habis slot sebelum break, lanjut setelah break
      const jpConsumed = Math.floor(minutesAvailable / JP_MENIT);
      jpLeft -= jpConsumed;
      cursor = _timeToMin(nextBreak.jamSelesai); // loncat ke setelah break
    }
  }

  // Cek tidak melebihi jam 17:00
  if (cursor > _timeToMin('17:00')) {
    return { jamSelesai: null, error: 'Jadwal melebihi jam 17:00. Kurangi JP atau geser jam mulai lebih awal.' };
  }

  return { jamSelesai: _minToTime(cursor), error: null };
}

function _timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function _minToTime(min) {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function _buildDayList(mulai, selesai) {
  if (!mulai || !selesai) return [];
  const start = _tsToDate(mulai);
  const end   = _tsToDate(selesai);
  const days  = [];
  const cur   = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endD  = new Date(end);
  endD.setHours(0, 0, 0, 0);

  while (cur <= endD) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function _tsToDate(ts) {
  if (!ts) return new Date();
  return ts?.toDate?.() ?? new Date(ts);
}

function _dateKey(date) {
  // YYYY-MM-DD
  return date.toISOString().split('T')[0];
}

function _fmtDay(date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

function _fmtDayFromKey(key) {
  return _fmtDay(new Date(key + 'T00:00:00'));
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

/** Mapel yang belum dijadwalkan atau sudah di hari ini */
function _availableMapel(dayKey) {
  return _mapelList.filter(m => {
    if (!m.jadwal) return true; // belum dijadwalkan
    return _dateKey(_tsToDate(m.jadwal.tanggal)) === dayKey; // sudah di hari ini (split — disabled Phase 1)
  });
}

function _globalWarnings() {
  const warnings = [];

  // Hari kosong di tengah periode (weekday tanpa sesi)
  const hariDenganSesi = new Set(
    _sesiList
      .filter(s => s.tipe === 'mapel')
      .map(s => _dateKey(_tsToDate(s.tanggal)))
  );
  const hariKosong = _days.filter(d => {
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    return !isWeekend && !hariDenganSesi.has(_dateKey(d));
  });
  if (hariKosong.length && _sesiList.length > 0) {
    warnings.push(`${hariKosong.length} hari kerja belum ada sesi terjadwal.`);
  }

  return warnings;
}

function _loadingHTML() {
  return `<div class="flex items-center justify-center py-16">
    <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>`;
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

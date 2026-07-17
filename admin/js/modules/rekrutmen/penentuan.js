// admin/js/modules/rekrutmen/penentuan.js
// B4 — Ranking, penentuan peserta final, dan aktivasi ke peserta_master.

import { setPageTitle }  from '../../layout/navbar.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { showToast }     from '../../components/toast.js';
import { getState }      from '../../store.js';
import { listSiklus, getSiklus } from './siklus-api.js';
import { db }            from '../../../../shared/firebase-config.js';
import {
  collection, doc, getDoc, setDoc, getDocs, updateDoc, writeBatch,
  query, where, orderBy, Timestamp
} from '../../../../shared/db.js';
import { logAudit }      from '../../../../shared/logger.js';
import { COL }           from '../../../../shared/constants.js';

let _S = { tahun: null, siklus: null, ranked: {} };

export async function renderPenentuan() {
  setPageTitle('Rekrutmen — Penentuan Peserta');

  const sikluses = await listSiklus();
  const aktif    = sikluses.find(s => ['tertulis','penentuan'].includes(s.status)) ?? sikluses[0];
  _S.tahun  = aktif?.tahun ?? null;
  _S.siklus = aktif ?? null;

  document.getElementById('app').innerHTML = `
    <div class="max-w-4xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-white">Penentuan Peserta</h1>
          <p class="text-xs text-gray-500 mt-0.5">Ranking dan konfirmasi peserta bimtek final</p>
        </div>
        <select id="sel-siklus" class="form-input text-sm py-1.5 w-44">
          ${sikluses.map(s => `<option value="${s.tahun}" ${s.tahun === _S.tahun ? 'selected' : ''}>${s.nama}</option>`).join('')}
        </select>
      </div>
      <div id="content"></div>
    </div>`;

  document.getElementById('sel-siklus')?.addEventListener('change', async e => {
    _S.tahun  = parseInt(e.target.value);
    _S.siklus = await getSiklus(_S.tahun);
    await _renderContent();
  });

  await _renderContent();
}

async function _renderContent() {
  const content = document.getElementById('content');
  if (!content || !_S.siklus) return;

  // Load semua calon yang lulus administrasi
  const snap = await getDocs(query(
    collection(db, COL.CALON_PESERTA),
    where('tahun', '==', _S.tahun),
    where('statusAdmin', '==', 'lulus'),
    orderBy('nilaiTertulis', 'desc')
  ));
  const calons = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const bimteks = _S.siklus.bimtekPilihan || [];

  // Group by pilihan bimtek pertama lalu rank by nilai
  _S.ranked = _buildRanking(calons, bimteks);

  content.innerHTML = `
    <div class="space-y-4">

      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-400">${calons.length} calon lulus administrasi · ${bimteks.length} bimtek tersedia</p>
        <div class="flex gap-2">
          <button id="btn-auto-rank" class="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors">
            Ranking Otomatis
          </button>
          <button id="btn-aktivasi-semua" class="px-3 py-1.5 rounded-lg text-xs bg-green-700 hover:bg-green-600 text-white transition-colors">
            Aktivasi Semua Terpilih
          </button>
        </div>
      </div>

      ${bimteks.map(b => _renderBimtekBlock(b, calons, _S.ranked[b.bimtekId] ?? [])).join('')}

      <!-- Calon tidak terpilih -->
      ${_renderTidakTerpilih(calons, _S.ranked)}

    </div>`;

  _bindPenentuanEvents(calons, bimteks);
}

// ─── Ranking ─────────────────────────────────────────────────

function _buildRanking(calons, bimteks) {
  const ranked = {};
  const assigned = new Set();

  bimteks.forEach(b => { ranked[b.bimtekId] = []; });

  // Pass 1: assign by pilihan 1
  calons.forEach(c => {
    const p1 = c.pilihanBimtekIds?.[0];
    if (p1 && ranked[p1]) {
      ranked[p1].push({ ...c, rankSource: 'pilihan1' });
      assigned.add(c.id);
    }
  });

  // Sort each bimtek by nilai tertulis desc, split terpilih vs cadangan
  bimteks.forEach(b => {
    ranked[b.bimtekId].sort((a, z) => (z.nilaiTertulis ?? 0) - (a.nilaiTertulis ?? 0));
    ranked[b.bimtekId] = ranked[b.bimtekId].map((c, i) => ({
      ...c,
      rank:      i + 1,
      isPrimary: i < b.kuota
    }));
  });

  // Pass 2: calon yang tidak masuk pilihan 1 → coba pilihan 2 & 3
  calons.filter(c => !assigned.has(c.id)).forEach(c => {
    for (let p = 1; p < (c.pilihanBimtekIds?.length ?? 0); p++) {
      const bid = c.pilihanBimtekIds[p];
      if (!bid || !ranked[bid]) continue;
      const bimtek   = bimteks.find(b => b.bimtekId === bid);
      const terpilih = ranked[bid].filter(x => x.isPrimary).length;
      if (terpilih < (bimtek?.kuota ?? 0)) {
        const rank = ranked[bid].length + 1;
        ranked[bid].push({ ...c, rank, isPrimary: true, rankSource: `pilihan${p+1}` });
        assigned.add(c.id);
        break;
      }
    }
  });

  return ranked;
}

function _renderBimtekBlock(b, calons, list) {
  const terpilih  = list.filter(c => c.isPrimary);
  const cadangan  = list.filter(c => !c.isPrimary);
  const isPublish = !!_S.siklus?.phases?.penentuan?.published;

  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <p class="font-semibold text-white text-sm">${_esc(b.namaBimtek)}</p>
          <p class="text-xs text-gray-500">${_esc(b.bidang || '')} · ${b.mode === 'online' ? 'Online' : 'Tatap Muka'} · Kuota ${b.kuota}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs px-2 py-0.5 rounded-full ${terpilih.length >= b.kuota ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}">
            ${terpilih.length}/${b.kuota} terpilih
          </span>
          <button class="btn-aktivasi-bimtek px-3 py-1 rounded-lg text-xs bg-green-900/50 hover:bg-green-900 text-green-300 transition-colors"
                  data-bid="${_esc(b.bimtekId)}">
            Aktivasi
          </button>
        </div>
      </div>

      ${list.length ? `
        <table class="w-full text-xs">
          <thead class="bg-gray-950">
            <tr>
              <th class="px-4 py-2 text-left text-gray-500 font-medium w-8">#</th>
              <th class="px-4 py-2 text-left text-gray-500 font-medium">Nama</th>
              <th class="px-4 py-2 text-left text-gray-500 font-medium">Instansi</th>
              <th class="px-4 py-2 text-right text-gray-500 font-medium">Nilai</th>
              <th class="px-4 py-2 text-center text-gray-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            ${[...terpilih, ...cadangan].map(c => `
              <tr class="border-t border-gray-800/50 ${c.isPrimary ? '' : 'opacity-60'}">
                <td class="px-4 py-2 text-gray-500">${c.rank}</td>
                <td class="px-4 py-2">
                  <p class="font-medium text-gray-200">${_esc(c.nama)}</p>
                  <p class="text-gray-600">${_esc(c.pendaftarId)} · Pilihan ${(c.pilihanBimtekIds?.indexOf(b.bimtekId) ?? 0) + 1}</p>
                </td>
                <td class="px-4 py-2 text-gray-400">${_esc(c.instansi || '—')}</td>
                <td class="px-4 py-2 text-right font-mono text-gray-300">${c.nilaiTertulis ?? '—'}</td>
                <td class="px-4 py-2 text-center">
                  ${c.isPrimary
                    ? '<span class="bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded text-xs">Terpilih</span>'
                    : '<span class="bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded text-xs">Cadangan</span>'}
                  ${c.noPesertaAssigned
                    ? `<span class="ml-1 bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded text-xs">Aktif</span>`
                    : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>` : `
        <p class="text-xs text-gray-600 px-5 py-3">Belum ada calon untuk bimtek ini.</p>`}
    </div>`;
}

function _renderTidakTerpilih(calons, ranked) {
  const assignedIds = new Set(Object.values(ranked).flat().map(c => c.id));
  const tidakTerpilih = calons.filter(c => !assignedIds.has(c.id));
  if (!tidakTerpilih.length) return '';

  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 class="text-sm font-medium text-gray-400 mb-3">Tidak Terpilih (${tidakTerpilih.length})</h3>
      <div class="space-y-1">
        ${tidakTerpilih.map(c => `
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-400">${_esc(c.nama)} — ${_esc(c.instansi || '')}</span>
            <span class="text-gray-600">${c.nilaiTertulis ?? 'Tidak ujian'}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── Events ──────────────────────────────────────────────────

function _bindPenentuanEvents(calons, bimteks) {
  const email = getState('auth')?.user?.email;

  document.getElementById('btn-auto-rank')?.addEventListener('click', () => {
    _S.ranked = _buildRanking(calons, bimteks);
    showToast('Ranking diperbarui', 'success');
    _renderContent();
  });

  document.getElementById('btn-aktivasi-semua')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Aktivasi semua peserta terpilih?',
      message: 'Semua calon dengan status "Terpilih" akan dibuatkan akun peserta (noPeserta) dan didaftarkan ke bimtek masing-masing.',
      confirmLabel: 'Aktivasi',
      danger: false
    });
    if (!ok) return;
    await _aktivasiSemua(email);
  });

  document.querySelectorAll('.btn-aktivasi-bimtek').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bid     = btn.dataset.bid;
      const terpilih = (_S.ranked[bid] ?? []).filter(c => c.isPrimary && !c.noPesertaAssigned);
      if (!terpilih.length) { showToast('Tidak ada yang perlu diaktivasi', 'info'); return; }
      const ok = await confirmDialog({
        title: `Aktivasi ${terpilih.length} peserta?`,
        message: 'Calon terpilih akan dibuatkan noPeserta dan terdaftar di peserta_master.',
        confirmLabel: 'Aktivasi',
        danger: false
      });
      if (!ok) return;
      await _aktivasiBimtek(bid, terpilih, email);
    });
  });
}

// ─── Aktivasi ────────────────────────────────────────────────

async function _aktivasiSemua(email) {
  let total = 0;
  for (const [bid, list] of Object.entries(_S.ranked)) {
    const toAktivasi = list.filter(c => c.isPrimary && !c.noPesertaAssigned);
    if (toAktivasi.length) {
      await _aktivasiBimtek(bid, toAktivasi, email);
      total += toAktivasi.length;
    }
  }
  showToast(`${total} peserta berhasil diaktivasi`, 'success');
  await _renderContent();
}

async function _aktivasiBimtek(bimtekId, calonList, email) {
  const tahun  = _S.tahun;
  const batch  = writeBatch(db);
  const result = [];

  for (const calon of calonList) {
    const noPeserta = _generateNoPeserta(tahun, calon);

    // Insert ke peserta_master
    batch.set(doc(db, COL.PESERTA_MASTER, noPeserta), {
      noPeserta,
      nama:         calon.nama,
      jenisKelamin: calon.jenisKelamin ?? null,
      jabatan:      calon.jabatan ?? null,
      pendidikan:   calon.pendidikan ?? null,
      email:        calon.email,
      noHp:         calon.noHp,
      instansi:     calon.instansi ?? null,
      unitKerja:    calon.unitKerja ?? null,
      provinsi:     calon.provinsi ?? null,
      kabKota:      calon.kabKota ?? null,
      pendaftarIdOrigin: calon.pendaftarId,
      tahunSiklusOrigin: tahun,
      createdAt:    Timestamp.now(),
      updatedAt:    Timestamp.now(),
      createdBy:    email,
      deleted:      false,
      deletedAt:    null
    });

    // Update calon_peserta
    batch.update(doc(db, COL.CALON_PESERTA, calon.id), {
      noPesertaAssigned: noPeserta,
      statusFinal:       'terpilih',
      bimtekIdTerpilih:  bimtekId,
      updatedAt:         Timestamp.now()
    });

    // Sinkronkan ke status_lookup (salinan ringkas untuk cek status publik)
    batch.set(doc(db, COL.STATUS_LOOKUP, calon.pendaftarId), {
      statusFinal:      'terpilih',
      bimtekIdTerpilih: bimtekId,
      updatedAt:        Timestamp.now()
    }, { merge: true });

    result.push({ noPeserta, calonId: calon.id });
  }

  await batch.commit();
  await logAudit({ action: 'aktivasi_peserta', entityType: 'rekrutmen', entityId: String(tahun), metadata: { bimtekId, count: calonList.length } });
  showToast(`${calonList.length} peserta diaktivasi untuk bimtek ini`, 'success');
}

// ─── Helpers ─────────────────────────────────────────────────

function _generateNoPeserta(tahun, calon) {
  const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `PST-${tahun}-${suffix}`;
}

function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

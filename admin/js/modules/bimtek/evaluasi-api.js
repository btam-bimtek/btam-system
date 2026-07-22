// admin/js/modules/bimtek/evaluasi-api.js
// Query & agregasi evaluasi_pengajar_response untuk admin (tab Evaluasi di
// detail bimtek — breakdown per mapel, dan laporan lintas bimtek per periode
// — kumulatif per pengajar).
//
// CATATAN: "anonim" di sini adalah level UI — field noPeserta tetap ada di
// data mentah (untuk audit manual lewat Firestore console kalau perlu), tapi
// fungsi-fungsi di file ini TIDAK mengembalikan/menampilkan noPeserta ke UI.
//
// Skor pengajar disimpan bertingkat per mapel — 1 pengajar bisa mengajar
// beberapa mapel dalam 1 bimtek, dan dinilai terpisah untuk tiap mapel:
//   pengajarPerMapel: { [mapelId]: { [pengajarId]: { skor, komentar } } }

import { db, collection, getDocs, query, where } from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import {
  PERTANYAAN_PENYELENGGARA, PERTANYAAN_KEPUASAN, PERTANYAAN_PENGAJAR
} from '../../../../shared/evaluasi-questions.js';

/**
 * Union pengajarId dari semua mapel di sebuah bimtek. Pengajar sebenarnya
 * diassign per mata pelajaran (mapel.pengajarIds), bukan di bimtek.pengajarIds
 * (field itu jarang diisi) — jadi ini sumber kebenaran untuk "siapa saja yang
 * mengajar di bimtek ini" dipakai oleh evaluasi.
 */
export function unionPengajarIds(mapels = []) {
  return [...new Set(mapels.flatMap(m => m.pengajarIds || []))];
}

export async function listEvaluasiByBimtek(bimtekId) {
  const snap = await getDocs(
    query(collection(db, COL.EVALUASI_PENGAJAR_RESPONSE), where('bimtekId', '==', bimtekId))
  );
  return snap.docs.map(d => d.data());
}

function _aggValues(entries, pertanyaan) {
  const perKey = {};
  const komentar = [];
  for (const q of pertanyaan) perKey[q.key] = [];

  for (const g of entries) {
    if (!g) continue;
    for (const q of pertanyaan) {
      const v = g.skor?.[q.key];
      if (typeof v === 'number' && v > 0) perKey[q.key].push(v);
    }
    if (g.komentar) komentar.push(g.komentar);
  }

  const avgPerKey = {};
  let allVals = [];
  for (const q of pertanyaan) {
    const vals = perKey[q.key];
    avgPerKey[q.key] = vals.length ? _avg(vals) : null;
    allVals = allVals.concat(vals);
  }

  return {
    avgPerKey,
    avgOverall: allVals.length ? _avg(allVals) : null,
    n: allVals.length ? Math.max(...pertanyaan.map(q => perKey[q.key].length)) : 0,
    komentar,
  };
}

/**
 * Rata-rata skor Penyelenggara + Kepuasan, dan skor pengajar **kumulatif**
 * (digabung lintas semua mapel/bimtek — dipakai Laporan Evaluasi lintas
 * bimtek). Untuk breakdown per mapel di 1 bimtek, pakai aggregateEvaluasiPerMapel.
 * @param {object[]} responses    hasil listEvaluasiByBimtek (bisa gabungan banyak bimtek)
 * @param {string[]} pengajarIds  union semua pengajarId yang relevan
 */
export function aggregateEvaluasi(responses, pengajarIds = []) {
  const result = {
    penyelenggara: _aggValues(responses.map(r => r.penyelenggara), PERTANYAAN_PENYELENGGARA),
    kepuasan:      _aggValues(responses.map(r => r.kepuasan), PERTANYAAN_KEPUASAN),
    pengajar:      {},
    totalResponden: responses.length,
  };

  for (const pengajarId of pengajarIds) {
    const entries = responses.flatMap(r =>
      Object.values(r.pengajarPerMapel || {}).map(byPengajar => byPengajar?.[pengajarId]).filter(Boolean)
    );
    result.pengajar[pengajarId] = _aggValues(entries, PERTANYAAN_PENGAJAR);
  }

  return result;
}

/**
 * Breakdown skor pengajar per mapel (untuk tab Evaluasi di 1 bimtek) — 1 kartu
 * per pasangan (mapel, pengajar).
 * @param {object[]} responses  hasil listEvaluasiByBimtek untuk 1 bimtek
 * @param {object[]} mapels     S.mapels dari detail.js
 * @returns {Array<{ mapel: object, pengajarId: string, agg: object }>}
 */
export function aggregateEvaluasiPerMapel(responses, mapels = []) {
  const out = [];
  for (const mapel of mapels) {
    for (const pengajarId of mapel.pengajarIds || []) {
      const entries = responses
        .map(r => r.pengajarPerMapel?.[mapel.id]?.[pengajarId])
        .filter(Boolean);
      out.push({ mapel, pengajarId, agg: _aggValues(entries, PERTANYAAN_PENGAJAR) });
    }
  }
  return out;
}

function _avg(arr) {
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

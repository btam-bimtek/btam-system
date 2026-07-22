// admin/js/modules/bimtek/evaluasi-api.js
// Query & agregasi evaluasi_pengajar_response untuk admin (tab Evaluasi di
// detail bimtek, dan laporan lintas bimtek per periode).
//
// CATATAN: "anonim" di sini adalah level UI — field noPeserta tetap ada di
// data mentah (untuk audit manual lewat Firestore console kalau perlu), tapi
// fungsi-fungsi di file ini TIDAK mengembalikan/menampilkan noPeserta ke UI.

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

/**
 * Rata-rata skor per pertanyaan + skor keseluruhan dari sekumpulan jawaban
 * (bisa dari 1 bimtek atau gabungan banyak bimtek).
 * @param {object[]} responses  hasil listEvaluasiByBimtek (bisa digabung dari banyak bimtek)
 * @param {string[]} pengajarIds  union semua pengajarId yang relevan (dari bimtek.pengajarIds)
 */
export function aggregateEvaluasi(responses, pengajarIds = []) {
  const _aggGroup = (field, pertanyaan) => {
    const perKey = {};
    const komentar = [];
    for (const q of pertanyaan) perKey[q.key] = [];

    for (const r of responses) {
      const g = r[field];
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
  };

  const result = {
    penyelenggara: _aggGroup('penyelenggara', PERTANYAAN_PENYELENGGARA),
    kepuasan:      _aggGroup('kepuasan', PERTANYAAN_KEPUASAN),
    pengajar:      {},
    totalResponden: responses.length,
  };

  for (const pengajarId of pengajarIds) {
    const perKey = {};
    const komentar = [];
    for (const q of PERTANYAAN_PENGAJAR) perKey[q.key] = [];

    for (const r of responses) {
      const g = r.pengajar?.[pengajarId];
      if (!g) continue;
      for (const q of PERTANYAAN_PENGAJAR) {
        const v = g.skor?.[q.key];
        if (typeof v === 'number' && v > 0) perKey[q.key].push(v);
      }
      if (g.komentar) komentar.push(g.komentar);
    }

    const avgPerKey = {};
    let allVals = [];
    for (const q of PERTANYAAN_PENGAJAR) {
      const vals = perKey[q.key];
      avgPerKey[q.key] = vals.length ? _avg(vals) : null;
      allVals = allVals.concat(vals);
    }

    result.pengajar[pengajarId] = {
      avgPerKey,
      avgOverall: allVals.length ? _avg(allVals) : null,
      n: allVals.length ? Math.max(...PERTANYAAN_PENGAJAR.map(q => perKey[q.key].length)) : 0,
      komentar,
    };
  }

  return result;
}

function _avg(arr) {
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

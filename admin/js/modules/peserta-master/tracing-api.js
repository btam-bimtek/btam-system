// admin/js/modules/peserta-master/tracing-api.js
// API untuk tracing riwayat bimtek dan kemajuan UK seorang peserta.
// Query on-the-fly dari bimtek_scores + exam_results + bank_soal — tidak ada koleksi baru.

import {
  db, doc, getDoc, getDocs, collection, query, where, snapToArray
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { hitungNilaiAkhir, cekKelulusan } from '../bimtek/scorer.js';
import { calcEKComparison } from '../bimtek/report-api.js';

// ─── RIWAYAT BIMTEK ───────────────────────────────────────────────────────────

/**
 * Semua bimtek yang pernah diikuti peserta ini, diurutkan terbaru dulu.
 * @param {string} noPeserta
 * @returns {Promise<Array<{bimtekId, bimtek, score, nilaiAkhir, lulus}>>}
 */
export async function getPesertaBimtekHistory(noPeserta) {
  // 1. Semua bimtek_scores milik peserta ini
  const scoresSnap = await getDocs(
    query(collection(db, COL.BIMTEK_SCORES), where('noPeserta', '==', noPeserta))
  );
  const scores = snapToArray(scoresSnap);
  if (!scores.length) return [];

  // 2. Batch get semua bimtek docs
  const bimtekIds = [...new Set(scores.map(s => s.bimtekId).filter(Boolean))];
  const bimtekSnaps = await Promise.all(bimtekIds.map(id => getDoc(doc(db, COL.BIMTEK, id))));
  const bimtekMap = {};
  bimtekSnaps.forEach(snap => {
    if (snap.exists()) bimtekMap[snap.id] = { id: snap.id, ...snap.data() };
  });

  // 3. Enrich dengan nilaiAkhir + lulus
  return scores
    .map(s => {
      const bimtek = bimtekMap[s.bimtekId];
      if (!bimtek) return null;
      const nilaiAkhir = hitungNilaiAkhir(s, bimtek);
      const lulus      = cekKelulusan(nilaiAkhir, bimtek.kkm, s.kehadiran ?? null);
      return { bimtekId: s.bimtekId, bimtek, score: s, nilaiAkhir, lulus };
    })
    .filter(Boolean)
    .sort((a, b) => (b.bimtek.tanggalMulai?.seconds ?? 0) - (a.bimtek.tanggalMulai?.seconds ?? 0));
}

// ─── TRACING UK ───────────────────────────────────────────────────────────────

/**
 * Kemajuan penguasaan UK peserta, lintas semua bimtek yang pernah diikuti.
 *
 * @param {string} noPeserta
 * @returns {Promise<{
 *   byEK:      Array<{ekKey, ekNama, latestPct, entries: Array<{bimtekId, bimtekNama, tanggal, prePct, postPct, delta}>}>,
 *   bimtekList: Array<bimtekDoc>
 * }>}
 */
export async function getPesertaEKHistory(noPeserta) {
  // 1. Semua exam_results milik peserta ini
  const resultsSnap = await getDocs(
    query(collection(db, COL.EXAM_RESULTS), where('noPeserta', '==', noPeserta))
  );
  const allResults = snapToArray(resultsSnap);
  if (!allResults.length) return { byEK: [], bimtekList: [] };

  // 2. Group by bimtekId → {pretest, posttest}
  const byBimtek = {};
  allResults.forEach(r => {
    const bid = r.bimtekId;
    if (!bid) return;
    if (!byBimtek[bid]) byBimtek[bid] = { pretest: null, posttest: null };
    if (r.tipeSession === 'pretest')  byBimtek[bid].pretest  = r;
    if (r.tipeSession === 'posttest') byBimtek[bid].posttest = r;
  });

  // 3. Batch get bimtek docs
  const bimtekIds = Object.keys(byBimtek);
  const bimtekSnaps = await Promise.all(bimtekIds.map(id => getDoc(doc(db, COL.BIMTEK, id))));
  const bimtekMap = {};
  bimtekSnaps.forEach(snap => {
    if (snap.exists()) bimtekMap[snap.id] = { id: snap.id, ...snap.data() };
  });

  // 4. Kumpulkan semua soalIds unik dari semua detail result
  const allSoalIds = new Set();
  allResults.forEach(r => Object.keys(r.detail ?? {}).forEach(id => allSoalIds.add(id)));

  // 5. Batch get soal docs (in chunks of 30 for safety)
  const soalMap = {};
  const soalIdArr = [...allSoalIds];
  const CHUNK = 30;
  for (let i = 0; i < soalIdArr.length; i += CHUNK) {
    const chunk = soalIdArr.slice(i, i + CHUNK);
    const snaps = await Promise.all(chunk.map(id => getDoc(doc(db, COL.BANK_SOAL, id))));
    snaps.forEach(snap => {
      if (snap.exists()) soalMap[snap.id] = { id: snap.id, ...snap.data() };
    });
  }

  // 6. Per bimtek: hitung UK comparison dari soal ujian
  const bimtekEKMap = {}; // bimtekId → ekComparison[]

  for (const [bimtekId, { pretest, posttest }] of Object.entries(byBimtek)) {
    const bimtek = bimtekMap[bimtekId];
    if (!bimtek) continue;

    bimtekEKMap[bimtekId] = calcEKComparison(
      pretest?.detail  ?? {},
      posttest?.detail ?? {},
      soalMap
    );
  }

  // 8. Aggregate per UK key
  const ukAgg = {}; // ekKey → {ekKey, ekNama, entries[]}

  for (const [bimtekId, ekList] of Object.entries(bimtekEKMap)) {
    const bimtek  = bimtekMap[bimtekId];
    const tanggal = bimtek?.tanggalMulai ?? null;

    ekList.forEach(e => {
      const key = e.ekKey;
      if (!ukAgg[key]) ukAgg[key] = { ekKey: key, ekNama: e.ekNama, entries: [] };
      if (e.ekNama && e.ekNama !== key) ukAgg[key].ekNama = e.ekNama;

      ukAgg[key].entries.push({
        bimtekId,
        bimtekNama: bimtek?.nama ?? bimtekId,
        tanggal,
        prePct:  e.prePct,
        postPct: e.postPct,
        delta:   e.delta,
      });
    });
  }

  // 9. Sort entries tiap UK by tanggal asc → latestPct
  const byEK = Object.values(ukAgg).map(ek => {
    const sorted  = ek.entries.sort((a, b) => (a.tanggal?.seconds ?? 0) - (b.tanggal?.seconds ?? 0));
    const withPost = sorted.filter(e => e.postPct != null);
    const latestPct = withPost.length > 0 ? withPost[withPost.length - 1].postPct : null;
    return { ...ek, entries: sorted, latestPct };
  }).sort((a, b) => (b.latestPct ?? -1) - (a.latestPct ?? -1));

  // 10. bimtekList sorted descending
  const bimtekList = bimtekIds
    .map(id => bimtekMap[id])
    .filter(Boolean)
    .sort((a, b) => (b.tanggalMulai?.seconds ?? 0) - (a.tanggalMulai?.seconds ?? 0));

  return { byEK, bimtekList };
}


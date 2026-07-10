// admin/js/modules/bimtek/report-api.js
// Aggregasi data untuk report penyelenggara dan report peserta.

import { db, doc, getDoc } from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { listBimtekScores, listExamResults, hitungKehadiran } from './penilaian-api.js';
import { hitungNilaiAkhir, cekKelulusan } from './scorer.js';
import { listExams } from './exam-api.js';
import { listSesi } from './api.js';
import { getUKByKodes } from '../master-uk/api.js';

// ─── DEFAULT THRESHOLDS (sesuai STRUKTUR_APLIKASI_v3) ─────────────────────────

export const DEFAULT_REPORT_THRESHOLDS = {
  kehadiran: [
    { min: 95, label: 'Hadir Penuh' },
    { min: 80, label: 'Hadir Aktif' },
    { min: 60, label: 'Sebagian' },
    { min: 0,  label: 'Tidak Memenuhi Syarat Kehadiran' }
  ],
  keaktifan: [
    { min: 85, label: 'Sangat Aktif' },
    { min: 70, label: 'Aktif' },
    { min: 60, label: 'Cukup Aktif' },
    { min: 0,  label: 'Perlu Ditingkatkan' }
  ],
  respek: [
    { min: 85, label: 'Sangat Baik' },
    { min: 70, label: 'Baik' },
    { min: 60, label: 'Cukup Baik' },
    { min: 0,  label: 'Perlu Ditingkatkan' }
  ]
};

// ─── PENYELENGGARA REPORT ─────────────────────────────────────────────────────

/**
 * Ambil semua data untuk report penyelenggara.
 * @param {string} bimtekId
 * @param {object} bimtek - bimtek doc data
 * @param {object[]} mapels - dari listMapel (sudah di-load di detail.js)
 * @param {object[]} pengajars - dari listPengajar (sudah di-load di detail.js)
 * @returns {object} reportData
 */
export async function getBimtekReportData(bimtekId, bimtek, mapels = [], pengajars = []) {
  const [scores, examResults, exams, sesis] = await Promise.all([
    listBimtekScores(bimtekId),
    listExamResults(bimtekId),
    listExams(bimtekId),
    listSesi(bimtekId)
  ]);

  // Fetch peserta master data (batch)
  const noPesertaList = bimtek.pesertaIds || [];
  const pesertaMap = await _batchGetPeserta(noPesertaList);

  // Enrich scores dengan peserta info + lulus (sudah dari listBimtekScores)
  const enriched = scores.map(s => ({
    ...s,
    peserta: pesertaMap[s.noPeserta] ?? { nama: s.noPeserta, jabatan: null, instansi: null }
  }));

  // Statistik agregat
  const total = enriched.length;
  const lulus = enriched.filter(s => s.lulus).length;
  const validNilai = enriched.map(s => s.nilaiAkhir).filter(v => v != null && v > 0);
  const validPre   = enriched.map(s => s.pretest).filter(v => v != null);
  const validPost  = enriched.map(s => s.posttest).filter(v => v != null);
  const validKehadiran = enriched.map(s => s.kehadiran).filter(v => v != null);

  const avgNilaiAkhir = _avg(validNilai);
  const avgPretest    = _avg(validPre);
  const avgPosttest   = _avg(validPost);
  const avgKehadiran  = _avg(validKehadiran);

  // Distribusi nilai akhir (5 bucket)
  const distribusi = _distribusiNilai(validNilai);

  // Sorted untuk per-peserta table (by nilaiAkhir desc)
  const scoresSorted = [...enriched].sort((a, b) => (b.nilaiAkhir ?? -1) - (a.nilaiAkhir ?? -1));

  // Per-UK aggregate (semua peserta, pre vs post)
  const ekDataAll = await _calcEKDataAll(examResults, exams);

  // Per-soal error rate
  const soalErrorData = await _buildSoalErrorData(examResults, exams);

  // Per-pengajar data
  const pengajarData = _buildPengajarData(enriched, mapels, pengajars);

  return {
    scores: enriched,
    scoresSorted,
    pesertaMap,
    exams,
    sesis,
    ekDataAll,
    soalErrorData,
    pengajarData,
    stats: {
      total, lulus, tidakLulus: total - lulus,
      avgNilaiAkhir, avgPretest, avgPosttest, avgKehadiran,
      pctLulus: total > 0 ? Math.round((lulus / total) * 100) : 0
    },
    distribusi
  };
}

// ─── PESERTA REPORT ───────────────────────────────────────────────────────────

/**
 * Ambil semua data untuk report satu peserta.
 * @returns {object} pesertaReportData
 */
export async function getPesertaReportData(bimtekId, noPeserta, bimtek) {
  // Fetch peserta master, skor, dan sesis secara parallel
  const [scoreSnap, pesertaSnap, exams, sesis, attendanceSnap] = await Promise.all([
    getDoc(doc(db, COL.BIMTEK_SCORES, `${bimtekId}__${noPeserta}`)),
    getDoc(doc(db, COL.PESERTA_MASTER, noPeserta)),
    listExams(bimtekId),
    listSesi(bimtekId),
    getDoc(doc(db, COL.BIMTEK_ATTENDANCE, `${bimtekId}__${noPeserta}`))
  ]);

  const rawScores = scoreSnap.exists() ? { id: scoreSnap.id, ...scoreSnap.data() } : null;
  const peserta   = pesertaSnap.exists() ? { id: pesertaSnap.id, ...pesertaSnap.data() } : { nama: noPeserta };

  // Hitung detail kehadiran dulu (% hadir sesi) — dipakai untuk gate kelulusan
  let kehadiranDetail = null;
  if (attendanceSnap.exists()) {
    const attendance = { id: attendanceSnap.id, ...attendanceSnap.data() };
    kehadiranDetail = hitungKehadiran(attendance, sesis);
  }

  // Hitung nilai akhir — gate kehadiran pakai % hadir sesi, bukan nilai komponen
  const nilaiAkhir = rawScores ? hitungNilaiAkhir(rawScores, bimtek) : 0;
  const lulus      = cekKelulusan(nilaiAkhir, bimtek.kkm, kehadiranDetail?.persentase ?? null);
  const scores     = rawScores ? { ...rawScores, nilaiAkhir, lulus } : null;

  // Cari hasil exam pretest & posttest untuk peserta ini
  let pretestResult  = null;
  let posttestResult = null;
  let pretestSoalIds  = [];
  let posttestSoalIds = [];

  for (const exam of exams) {
    if (!pretestResult) {
      const snap = await getDoc(doc(db, COL.EXAM_RESULTS, `${exam.id}__${noPeserta}__pretest`));
      if (snap.exists()) {
        pretestResult  = { id: snap.id, ...snap.data() };
        pretestSoalIds = exam.soalIds ?? [];
      }
    }
    if (!posttestResult) {
      const snap = await getDoc(doc(db, COL.EXAM_RESULTS, `${exam.id}__${noPeserta}__posttest`));
      if (snap.exists()) {
        posttestResult  = { id: snap.id, ...snap.data() };
        posttestSoalIds = exam.soalIds ?? [];
      }
    }
    if (pretestResult && posttestResult) break;
  }

  // Per-UK analysis
  let ekComparison = null;
  const allSoalIds = [...new Set([...pretestSoalIds, ...posttestSoalIds])];
  if (allSoalIds.length > 0 && (pretestResult || posttestResult)) {
    const soalMap = await _fetchSoalMap(allSoalIds);
    ekComparison = calcEKComparison(
      pretestResult?.detail  ?? {},
      posttestResult?.detail ?? {},
      soalMap
    );
  }

  // ── Merge dengan baseline UK dari bimtek.ukIds ────────────────────────────
  // Jika bimtek punya ukIds yang terdefinisi, UK yang ada di baseline tapi
  // tidak ada di exam results → tetap ditampilkan dengan data null.
  const baselineUkIds = bimtek.ukIds || [];
  if (baselineUkIds.length > 0) {
    const ukMasterMap = await getUKByKodes(baselineUkIds);
    const existingKeys = new Set((ekComparison || []).map(e => e.ekKey?.toLowerCase()));

    const missing = baselineUkIds
      .filter(id => !existingKeys.has(id.toLowerCase()))
      .map(id => {
        const master = ukMasterMap[id.toLowerCase()];
        return {
          ekKey:   master?.kode ?? id,
          ekNama:  master?.nama ?? id,
          prePct:  null,
          postPct: null,
          delta:   null,
          fromBaseline: true, // marker: UK ini dari definisi bimtek, belum ada data ujian
        };
      });

    // Update nama UK di ekComparison dengan nama dari master (lebih akurat)
    const updatedComparison = (ekComparison || []).map(e => {
      const master = ukMasterMap[e.ekKey?.toLowerCase()];
      return master ? { ...e, ekNama: master.nama } : e;
    });

    ekComparison = [...updatedComparison, ...missing];
  }

  // Deteksi soal yang tidak punya unitKompetensi (jatuh ke bloomLevel sebagai ekKey)
  const _bloomPat = /^C[1-6]$/i;
  const hasIncompleteUKData = !!(ekComparison?.some(e => _bloomPat.test(e.ekKey)));

  return {
    peserta,
    scores,
    kehadiranDetail,
    pretestResult,
    posttestResult,
    ekComparison,
    hasUKBaseline: baselineUkIds.length > 0,
    hasIncompleteUKData,
    thresholds: bimtek.reportThresholds ?? DEFAULT_REPORT_THRESHOLDS
  };
}

// ─── PER-UK COMPARISON ────────────────────────────────────────────────────────

/**
 * Hitung persentase penguasaan per Unit Kompetensi (pre vs post).
 * @param {object} pretestDetail  - { soalId: {benar, bobot, skor} }
 * @param {object} posttestDetail - { soalId: {benar, bobot, skor} }
 * @param {object} soalMap        - { soalId: soalDoc }
 * @returns {Array<{ekKey, ekNama, prePct, postPct, delta}>} sorted by delta desc
 */
export function calcEKComparison(pretestDetail, posttestDetail, soalMap) {
  const ekMap = {};

  const _process = (detail, prefix) => {
    for (const [soalId, d] of Object.entries(detail ?? {})) {
      const soal  = soalMap[soalId];
      if (!soal) continue;
      const ekKey  = (soal.unitKompetensi?.toUpperCase()) || soal.bloomLevel || 'unknown';
      const ekNama = soal.ekNama || ekKey;
      if (!ekMap[ekKey]) {
        ekMap[ekKey] = { ekKey, ekNama, preSkor: 0, preBobot: 0, postSkor: 0, postBobot: 0 };
      }
      ekMap[ekKey][prefix + 'Skor']  += d.skor  ?? 0;
      ekMap[ekKey][prefix + 'Bobot'] += d.bobot ?? 1;
    }
  };

  _process(pretestDetail,  'pre');
  _process(posttestDetail, 'post');

  return Object.values(ekMap).map(ek => {
    const prePct  = ek.preBobot  > 0 ? Math.round((ek.preSkor  / ek.preBobot)  * 100) : null;
    const postPct = ek.postBobot > 0 ? Math.round((ek.postSkor / ek.postBobot) * 100) : null;
    const delta   = (prePct != null && postPct != null) ? postPct - prePct : null;
    return { ekKey: ek.ekKey, ekNama: ek.ekNama, prePct, postPct, delta };
  }).sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999));
}

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

async function _batchGetPeserta(noPesertaList) {
  if (!noPesertaList.length) return {};
  const snaps = await Promise.all(
    noPesertaList.map(id => getDoc(doc(db, COL.PESERTA_MASTER, id)))
  );
  const map = {};
  snaps.forEach(snap => {
    if (snap.exists()) map[snap.id] = { id: snap.id, ...snap.data() };
  });
  return map;
}

async function _fetchSoalMap(soalIds) {
  if (!soalIds.length) return {};
  const snaps = await Promise.all(soalIds.map(id => getDoc(doc(db, COL.BANK_SOAL, id))));
  const map = {};
  snaps.forEach(snap => {
    if (snap.exists()) map[snap.id] = { id: snap.id, ...snap.data() };
  });
  return map;
}

function _avg(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function _distribusiNilai(values) {
  const buckets = [
    { label: '< 60',  min: 0,  max: 59,  count: 0 },
    { label: '60-69', min: 60, max: 69,  count: 0 },
    { label: '70-79', min: 70, max: 79,  count: 0 },
    { label: '80-89', min: 80, max: 89,  count: 0 },
    { label: '≥ 90',  min: 90, max: 100, count: 0 }
  ];
  values.forEach(v => {
    const b = buckets.find(b => v >= b.min && v <= b.max);
    if (b) b.count++;
  });
  return buckets;
}

async function _calcEKDataAll(examResults, exams) {
  if (!examResults.length || !exams.length) return null;

  // Kumpulkan semua soalIds unik dari semua exam
  const allSoalIds = [...new Set(exams.flatMap(e => e.soalIds ?? []))];
  if (!allSoalIds.length) return null;

  const soalMap = await _fetchSoalMap(allSoalIds);

  // Group results by noPeserta + tipeSession
  const pretestResults  = examResults.filter(r => r.tipeSession === 'pretest');
  const posttestResults = examResults.filter(r => r.tipeSession === 'posttest');

  // Per-UK per peserta, lalu rata-rata
  const ekAggPre  = {};  // ekKey → {totalPct, count}
  const ekAggPost = {};

  const _addEK = (results, agg) => {
    results.forEach(result => {
      const detail = result.detail ?? {};
      for (const [soalId, d] of Object.entries(detail)) {
        const soal = soalMap[soalId];
        if (!soal) continue;
        const ekKey = (soal.unitKompetensi?.toUpperCase()) || soal.bloomLevel || 'unknown';
        if (!agg[ekKey]) agg[ekKey] = { ekNama: soal.ekNama || ekKey, totalSkor: 0, totalBobot: 0, pesertaSet: new Set() };
        agg[ekKey].totalSkor  += d.skor  ?? 0;
        agg[ekKey].totalBobot += d.bobot ?? 1;
        agg[ekKey].pesertaSet.add(result.noPeserta);
      }
    });
  };

  _addEK(pretestResults,  ekAggPre);
  _addEK(posttestResults, ekAggPost);

  const allEkKeys = [...new Set([...Object.keys(ekAggPre), ...Object.keys(ekAggPost)])];

  return allEkKeys.map(ekKey => {
    const pre  = ekAggPre[ekKey];
    const post = ekAggPost[ekKey];
    const ekNama = pre?.ekNama ?? post?.ekNama ?? ekKey;
    const prePct  = (pre  && pre.totalBobot  > 0) ? Math.round((pre.totalSkor  / pre.totalBobot)  * 100) : null;
    const postPct = (post && post.totalBobot > 0) ? Math.round((post.totalSkor / post.totalBobot) * 100) : null;
    return {
      ekKey, ekNama, prePct, postPct,
      delta: (prePct != null && postPct != null) ? postPct - prePct : null,
      pesertaCount: Math.max(pre?.pesertaSet?.size ?? 0, post?.pesertaSet?.size ?? 0)
    };
  }).sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999));
}

function _buildPengajarData(scores, mapels, pengajars) {
  // Buat map pengajar → mapel yang diajar
  const pengajarMapelMap = {};
  mapels.forEach(m => {
    (m.pengajarIds ?? []).forEach(pgId => {
      if (!pengajarMapelMap[pgId]) pengajarMapelMap[pgId] = [];
      pengajarMapelMap[pgId].push(m.nama);
    });
  });

  const avgNilaiPengajar = _avg(scores.map(s => s.pengajar).filter(v => v != null));

  return pengajars.map(pg => ({
    id: pg.id,
    nama: pg.nama,
    bidang: pg.bidang ?? [],
    mapels: pengajarMapelMap[pg.id] ?? [],
    avgNilai: avgNilaiPengajar
  }));
}

async function _buildSoalErrorData(examResults, exams) {
  if (!examResults.length || !exams.length) return [];

  const allSoalIds = [...new Set(exams.flatMap(e => e.soalIds ?? []))];
  if (!allSoalIds.length) return [];

  const soalMap = await _fetchSoalMap(allSoalIds);

  // Agregasi per soalId lintas semua hasil
  const stats = {};
  examResults.forEach(result => {
    const tipe   = result.tipeSession;   // 'pretest' | 'posttest'
    const detail = result.detail ?? {};
    for (const [soalId, d] of Object.entries(detail)) {
      if (!stats[soalId]) {
        stats[soalId] = {
          soalId,
          totalAttempts: 0, salahCount: 0,
          preAttempts: 0,   preSalah: 0,
          postAttempts: 0,  postSalah: 0
        };
      }
      const s = stats[soalId];
      s.totalAttempts++;
      if (!d.benar) s.salahCount++;
      if (tipe === 'pretest') {
        s.preAttempts++;
        if (!d.benar) s.preSalah++;
      } else {
        s.postAttempts++;
        if (!d.benar) s.postSalah++;
      }
    }
  });

  return Object.values(stats).map(s => {
    const soal = soalMap[s.soalId];
    return {
      ...s,
      pertanyaan:       soal?.pertanyaan                              ?? s.soalId,
      unitKompetensi: soal?.unitKompetensi?.toUpperCase()          ?? '—',
      ekNama:           soal?.ekNama                                  ?? null,
      bloomLevel:       soal?.bloomLevel                              ?? '—',
      persenSalah: s.totalAttempts > 0
        ? Math.round((s.salahCount / s.totalAttempts) * 100)
        : 0
    };
  }).sort((a, b) => b.persenSalah - a.persenSalah);
}

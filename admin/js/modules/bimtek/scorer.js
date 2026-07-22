// admin/js/modules/bimtek/scorer.js
// Scoring engine: fetch submissions → hitung skor → tulis exam_results
// Dipakai oleh sub-prepost.js saat admin trigger "Sinkronisasi Nilai"

import {
  db, collection, doc, getDoc, getDocs, updateDoc, writeBatch,
  query, where, serverTimestamp,
  snapToArray
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { logAudit } from '../../../../shared/logger.js';
import { recalcSoalStats } from '../bank-soal/api.js';

/**
 * Hitung skor submission based on kunci jawaban dan bobot Bloom.
 *
 * @param {object} submission - exam_submissions doc
 *   { examId, noPeserta, answers, submittedAt, ... }
 * @param {object} exam - exams doc
 *   { soalIds, jumlahDitampilkan, tipeSession, ... }
 * @param {object[]} soals - bank_soal docs
 *   { id, bloomLevel, ... }
 * @param {object} kunciMap - bank_soal_answers map {soalId: kunci}
 * @param {object} [bloomBobot] - custom bobot map {C1:1,...} dari app_settings/bloom_bobot
 * @returns { skor (0-100), detail { soalId: {benar, bobot, skor}, ... } }
 */
export function hitungSkor(submission, exam, soals, kunciMap, bloomBobot) {
  const jawaban = submission.answers || submission.jawaban || {}; // exam app saves as 'answers'
  let totalBobot = 0;
  let totalScore = 0;
  const detail = {};

  for (const soalId of exam.soalIds) {
    const soal = soals.find(s => s.id === soalId);
    if (!soal) continue;

    const bloomLevel = soal.bloomLevel || 'C1';
    const bobot = _getBloomBobot(bloomLevel, bloomBobot);

    const jawabBenar = kunciMap[soalId] ?? null;
    const jawabPeserta = jawaban[soalId] ?? null;
    const benar = jawabBenar !== null && jawabBenar === jawabPeserta;

    const skorSoal = benar ? bobot : 0;

    totalBobot += bobot;
    totalScore += skorSoal;

    detail[soalId] = {
      benar,
      bobot,
      skor: skorSoal,
      jawabBenar,
      jawabPeserta
    };
  }

  const skorAkhir = totalBobot > 0 ? Math.round((totalScore / totalBobot) * 100) : 0;

  return {
    skor: skorAkhir,
    totalBobot,
    totalScore,
    detail
  };
}

/**
 * Get bobot Bloom dari tingkat C1-C6.
 * Prioritaskan custom bloomBobot dari app_settings jika ada.
 */
function _getBloomBobot(level, bloomBobot) {
  if (bloomBobot && bloomBobot[level] != null) return Number(bloomBobot[level]);
  const defaults = { 'C1': 1, 'C2': 2, 'C3': 3, 'C4': 4, 'C5': 5, 'C6': 6 };
  return defaults[level] || 1;
}

/**
 * Score semua submissions untuk satu exam.
 *
 * Flow:
 * 1. List exam_submissions untuk examId
 * 2. Ambil exam config, soal, dan kunci jawaban
 * 3. Per submission: hitung skor → tulis/overwrite exam_results
 * 4. Update bimtek_scores.pretest/posttest
 *
 * @param {string} bimtekId
 * @param {string} examId
 * @returns { processed: number, failed: number, errors: [{noPeserta, error}] }
 */
export async function scoreAllSubmissions(bimtekId, examId) {
  const errors = [];
  let processed = 0;
  let failed = 0;

  try {
    // 1. Ambil exam config
    const examSnap = await getDoc(doc(db, COL.EXAMS, examId));
    if (!examSnap.exists()) throw new Error('Exam tidak ditemukan');
    const exam = { id: examSnap.id, ...examSnap.data() };

    // 2. Ambil semua soal + kunci jawaban + custom bloom bobot
    const [soalsSnap, answersSnap, bloomSnap] = await Promise.all([
      getDocs(query(collection(db, COL.BANK_SOAL), where('soalId', 'in', exam.soalIds))),
      getDocs(collection(db, COL.BANK_SOAL_ANSWERS)),
      getDoc(doc(db, COL.APP_SETTINGS, 'bloom_bobot'))
    ]);
    const bloomBobot = bloomSnap.exists() ? bloomSnap.data() : null;

    const soals = snapToArray(soalsSnap);
    const kunciMap = {};
    answersSnap.docs.forEach(d => {
      kunciMap[d.id] = d.data().kunci; // field 'kunci' berisi jawaban benar
    });

    // 3. List submissions untuk exam ini
    const submissionsSnap = await getDocs(
      query(collection(db, COL.EXAM_SUBMISSIONS), where('examId', '==', examId))
    );
    const allSubmissions = snapToArray(submissionsSnap);

    // Dedupe: per (noPeserta, tipeSession) hanya ambil submission dengan submittedAt terakhir
    // (peserta yang di-reset dan mengerjakan ulang punya >1 dokumen submission)
    const latestByKey = new Map();
    for (const s of allSubmissions) {
      const key = `${s.noPeserta}__${s.tipeSession}`;
      const existing = latestByKey.get(key);
      const sTime = s.submittedAt?.toMillis?.() ?? s.submittedAt ?? 0;
      const eTime = existing ? (existing.submittedAt?.toMillis?.() ?? existing.submittedAt ?? 0) : -Infinity;
      if (!existing || sTime > eTime) latestByKey.set(key, s);
    }
    const submissions = Array.from(latestByKey.values());

    // 4. Score per submission (batch write)
    const batch = writeBatch(db);

    for (const submission of submissions) {
      try {
        const { skor, detail } = hitungSkor(submission, exam, soals, kunciMap, bloomBobot);

        // Tulis/overwrite exam_results — sertakan tipeSession agar pretest & posttest tidak saling overwrite
        const resultRef = doc(db, COL.EXAM_RESULTS, `${examId}__${submission.noPeserta}__${submission.tipeSession}`);
        batch.set(resultRef, {
          examId,
          bimtekId,
          noPeserta: submission.noPeserta,
          tipeSession: submission.tipeSession,
          skor,
          detail,
          submittedAt: submission.submittedAt ?? null,
          scoredAt: serverTimestamp(),
          rescoredAt: serverTimestamp()
        }, { merge: false });

        // Update bimtek_scores — skip untuk seleksi_tertulis (bukan komponen penilaian bimtek)
        if (submission.tipeSession !== 'seleksi_tertulis') {
          const scoreKey = submission.tipeSession === 'pretest' ? 'pretest' : 'posttest';
          const scoreRef = doc(db, COL.BIMTEK_SCORES, `${bimtekId}__${submission.noPeserta}`);
          batch.set(scoreRef, {
            noPeserta: submission.noPeserta,
            bimtekId,
            [scoreKey]: skor,
            [`${scoreKey}_src`]: 'firebase',
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        processed++;
      } catch (err) {
        failed++;
        errors.push({
          noPeserta: submission.noPeserta,
          error: err.message
        });
      }
    }

    // 5. Commit batch
    if (processed > 0) {
      await batch.commit();
      await logAudit({
        action: 'score_submissions',
        entityType: 'exam',
        entityId: examId,
        metadata: { bimtekId, processed, failed }
      });
      recalcSoalStats(exam.soalIds).catch(console.error);
    }

    return { processed, failed, errors };
  } catch (err) {
    throw new Error(`Gagal score submissions: ${err.message}`);
  }
}

/**
 * Score satu submission saja.
 * Dipakai saat admin perlu rescore submission tertentu.
 */
export async function scoreSubmission(bimtekId, examId, noPeserta) {
  try {
    // Submissions pakai auto-ID — harus query by field, bukan doc reference langsung
    const submSnap = await getDocs(
      query(
        collection(db, COL.EXAM_SUBMISSIONS),
        where('examId',    '==', examId),
        where('noPeserta', '==', noPeserta),
      )
    );
    if (submSnap.empty) throw new Error('Submission tidak ditemukan');
    // Bisa ada >1 submission (peserta di-reset lalu mengerjakan ulang) — pakai yang submittedAt paling akhir
    const submDocs = snapToArray(submSnap);
    const submDoc  = submDocs.reduce((latest, s) => {
      const sTime = s.submittedAt?.toMillis?.() ?? s.submittedAt ?? 0;
      const lTime = latest.submittedAt?.toMillis?.() ?? latest.submittedAt ?? 0;
      return sTime > lTime ? s : latest;
    });
    const submission = submDoc;

    // Ambil exam, soal, answers, dan custom bloom bobot
    const examSnap = await getDoc(doc(db, COL.EXAMS, examId));
    if (!examSnap.exists()) throw new Error('Exam tidak ditemukan');

    const [soalsSnap, answersSnap, bloomSnap] = await Promise.all([
      getDocs(query(collection(db, COL.BANK_SOAL), where('soalId', 'in', examSnap.data().soalIds))),
      getDocs(collection(db, COL.BANK_SOAL_ANSWERS)),
      getDoc(doc(db, COL.APP_SETTINGS, 'bloom_bobot'))
    ]);
    const soals = snapToArray(soalsSnap);
    const bloomBobot = bloomSnap.exists() ? bloomSnap.data() : null;

    const kunciMap = {};
    answersSnap.docs.forEach(d => {
      kunciMap[d.id] = d.data().kunci;
    });

    // Hitung skor
    const { skor, detail } = hitungSkor(
      submission,
      examSnap.data(),
      soals,
      kunciMap,
      bloomBobot
    );

    // Tulis exam_results + update bimtek_scores
    const batch = writeBatch(db);

    const resultRef = doc(db, COL.EXAM_RESULTS, `${examId}__${noPeserta}__${submission.tipeSession}`);
    batch.set(resultRef, {
      examId,
      bimtekId,
      noPeserta,
      tipeSession: submission.tipeSession,
      skor,
      detail,
      submittedAt: submission.submittedAt ?? null,
      scoredAt: serverTimestamp(),
      rescoredAt: serverTimestamp()
    }, { merge: false });

    // Skip bimtek_scores untuk seleksi_tertulis
    if (submission.tipeSession !== 'seleksi_tertulis') {
      const scoreKey = submission.tipeSession === 'pretest' ? 'pretest' : 'posttest';
      const scoreRef = doc(db, COL.BIMTEK_SCORES, `${bimtekId}__${noPeserta}`);
      batch.set(scoreRef, {
        noPeserta,
        bimtekId,
        [scoreKey]: skor,
        [`${scoreKey}_src`]: 'firebase',
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();

    await logAudit({
      action: 'score_submission',
      entityType: 'exam_submission',
      entityId: `${examId}__${noPeserta}`,
      metadata: { skor }
    });
    recalcSoalStats(examSnap.data().soalIds).catch(console.error);

    return skor;
  } catch (err) {
    throw new Error(`Gagal score submission: ${err.message}`);
  }
}

/**
 * Hitung nilai akhir dari bimtek_scores.
 * Formula: (pretest × w.pretest) + (posttest × w.posttest) + ... = 100
 *
 * Redistribusi: jika tugas/presentasi tidak aktif, bobot mereka masuk ke pengajar.
 */
export function hitungNilaiAkhir(scores, bimtek) {
  const w = bimtek.weights;
  const hasTugas = bimtek.hasTugas || false;
  const hasPresentasi = bimtek.hasPresentasi || false;

  // Redistribusi bobot
  // Pakai ?? (bukan ||) — bobot 0 yang sengaja di-set admin harus tetap 0,
  // bukan fallback ke default 0.20 (0 dianggap falsy oleh ||).
  let bobotPengajarEfektif = w.pengajar ?? 0.20;
  if (!hasTugas) bobotPengajarEfektif += w.tugas || 0;
  if (!hasPresentasi) bobotPengajarEfektif += w.presentasi || 0;

  const nilaiAkhir =
    (scores.pretest || 0) * (w.pretest || 0) +
    (scores.posttest || 0) * (w.posttest || 0) +
    (scores.pengajar || 0) * bobotPengajarEfektif +
    (scores.kehadiran || 0) * (w.kehadiran || 0) +
    (scores.keaktifan || 0) * (w.keaktifan || 0) +
    (scores.respek || 0) * (w.respek || 0) +
    (hasTugas ? (scores.tugas || 0) * (w.tugas || 0) : 0) +
    (hasPresentasi ? (scores.presentasi || 0) * (w.presentasi || 0) : 0);

  return Math.round(nilaiAkhir);
}

// Kategori kelulusan (batas tetap, bukan KKM per-bimtek) dipindah ke shared/scoring.js
// supaya bisa dipakai bareng oleh Portal Peserta (sertifikat), bukan cuma admin.
export { KATEGORI_NILAI, kategoriNilai, cekKelulusan } from '../../../../shared/scoring.js';

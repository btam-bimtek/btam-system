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

/**
 * Hitung skor submission based on kunci jawaban dan bobot Bloom.
 *
 * @param {object} submission - exam_submissions doc
 *   { examId, noPeserta, jawaban, submittedAt, ... }
 * @param {object} exam - exams doc
 *   { soalIds, jumlahDitampilkan, tipeSession, ... }
 * @param {object[]} soals - bank_soal docs
 *   { id, bloomLevel, ... }
 * @param {object} answers - bank_soal_answers map {soalId: jawaban}
 * @returns { skor (0-100), detail { soalId: {benar, bobot, skor}, ... } }
 */
export function hitungSkor(submission, exam, soals, answers) {
  const jawaban = submission.jawaban || {};
  let totalBobot = 0;
  let totalScore = 0;
  const detail = {};

  for (const soalId of exam.soalIds) {
    const soal = soals.find(s => s.id === soalId);
    if (!soal) continue;

    const bloomLevel = soal.bloomLevel || 'C1';
    const bobot = _getBloomBobot(bloomLevel);

    const jawabBenar = answers[soalId];
    const jawabPeserta = jawaban[soalId];
    const benar = jawabBenar && jawabBenar === jawabPeserta;

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
 */
function _getBloomBobot(level) {
  const bobot = {
    'C1': 1, 'C2': 2, 'C3': 3,
    'C4': 4, 'C5': 5, 'C6': 6
  };
  return bobot[level] || 1;
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

    // 2. Ambil semua soal + kunci jawaban
    const [soalsSnap, answersSnap] = await Promise.all([
      getDocs(query(collection(db, COL.BANK_SOAL), where('id', 'in', exam.soalIds))),
      getDocs(collection(db, COL.BANK_SOAL_ANSWERS))
    ]);

    const soals = snapToArray(soalsSnap);
    const answersMap = {};
    answersSnap.docs.forEach(d => {
      answersMap[d.id] = d.data().jawaban;
    });

    // 3. List submissions untuk exam ini
    const submissionsSnap = await getDocs(
      query(collection(db, COL.EXAM_SUBMISSIONS), where('examId', '==', examId))
    );
    const submissions = snapToArray(submissionsSnap);

    // 4. Score per submission (batch write)
    const batch = writeBatch(db);

    for (const submission of submissions) {
      try {
        const { skor, detail } = hitungSkor(submission, exam, soals, answersMap);

        // Tulis/overwrite exam_results
        const resultRef = doc(db, COL.EXAM_RESULTS, `${examId}__${submission.noPeserta}`);
        batch.set(resultRef, {
          examId,
          bimtekId,
          noPeserta: submission.noPeserta,
          tipeSession: submission.tipeSession,
          skor,
          detail,
          submittedAt: submission.submittedAt,
          scoredAt: serverTimestamp(),
          rescoredAt: serverTimestamp() // Mark saat rescoring
        }, { merge: false }); // Overwrite jika ada

        // Update bimtek_scores (set+merge agar otomatis buat dokumen jika belum ada)
        const scoreKey = submission.tipeSession === 'pretest' ? 'pretest' : 'posttest';
        const scoreRef = doc(db, COL.BIMTEK_SCORES, `${bimtekId}__${submission.noPeserta}`);
        batch.set(scoreRef, {
          noPeserta: submission.noPeserta,
          bimtekId,
          [scoreKey]: skor,
          [`${scoreKey}_src`]: 'firebase',
          updatedAt: serverTimestamp()
        }, { merge: true });

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
    // Ambil submission
    const submissionRef = doc(db, COL.EXAM_SUBMISSIONS, `${examId}__${noPeserta}`);
    const submissionSnap = await getDoc(submissionRef);
    if (!submissionSnap.exists()) throw new Error('Submission tidak ditemukan');
    const submission = { id: submissionSnap.id, ...submissionSnap.data() };

    // Ambil exam, soal, answers
    const exam = await getDoc(doc(db, COL.EXAMS, examId));
    if (!exam.exists()) throw new Error('Exam tidak ditemukan');

    const soalsSnap = await getDocs(
      query(collection(db, COL.BANK_SOAL), where('id', 'in', exam.data().soalIds))
    );
    const soals = snapToArray(soalsSnap);

    const answersSnap = await getDocs(collection(db, COL.BANK_SOAL_ANSWERS));
    const answersMap = {};
    answersSnap.docs.forEach(d => {
      answersMap[d.id] = d.data().jawaban;
    });

    // Hitung skor
    const { skor, detail } = hitungSkor(
      submission,
      exam.data(),
      soals,
      answersMap
    );

    // Tulis exam_results + update bimtek_scores
    const batch = writeBatch(db);

    const resultRef = doc(db, COL.EXAM_RESULTS, `${examId}__${noPeserta}`);
    batch.set(resultRef, {
      examId,
      bimtekId,
      noPeserta,
      tipeSession: submission.tipeSession,
      skor,
      detail,
      submittedAt: submission.submittedAt,
      scoredAt: serverTimestamp(),
      rescoredAt: serverTimestamp()
    }, { merge: false });

    const scoreKey = submission.tipeSession === 'pretest' ? 'pretest' : 'posttest';
    const scoreRef = doc(db, COL.BIMTEK_SCORES, `${bimtekId}__${noPeserta}`);
    batch.update(scoreRef, {
      [scoreKey]: skor,
      [`${scoreKey}_src`]: 'firebase',
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    await logAudit({
      action: 'score_submission',
      entityType: 'exam_submission',
      entityId: `${examId}__${noPeserta}`,
      metadata: { skor }
    });

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
  let bobotPengajarEfektif = w.pengajar || 0.20;
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

/**
 * Cek kelulusan berdasarkan nilai akhir dan KKM.
 */
export function cekKelulusan(nilaiAkhir, kkm) {
  return nilaiAkhir >= (kkm || 60);
}

// admin/js/modules/bimtek/penilaian-api.js
// CRUD untuk bimtek_scores, bimtek_attendance, dan interface ke exam_results

import {
  db, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  collection, query, where, orderBy, serverTimestamp,
  snapToArray
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { logAudit } from '../../../../shared/logger.js';
import { hitungNilaiAkhir, cekKelulusan } from './scorer.js';

// ─── BIMTEK SCORES ──────────────────────────────────────────────

/**
 * List bimtek_scores untuk satu bimtek.
 * @returns [{noPeserta, pretest, posttest, pengajar, kehadiran, keaktifan, respek, tugas, presentasi, nilaiAkhir, lulus}]
 */
export async function listBimtekScores(bimtekId) {
  const snap = await getDocs(
    query(
      collection(db, COL.BIMTEK_SCORES),
      where('bimtekId', '==', bimtekId),
      orderBy('noPeserta', 'asc')
    )
  );
  const scores = snapToArray(snap);

  // Enrich dengan nilaiAkhir + lulus
  const bimtek = await getDoc(doc(db, COL.BIMTEK, bimtekId));
  if (!bimtek.exists()) throw new Error('Bimtek tidak ditemukan');

  return scores.map(s => {
    const nilaiAkhir = hitungNilaiAkhir(s, bimtek.data());
    const lulus = cekKelulusan(nilaiAkhir, bimtek.data().kkm, s.kehadiran ?? null);
    return {
      ...s,
      nilaiAkhir,
      lulus
    };
  });
}

/**
 * Get atau create bimtek_scores untuk peserta.
 * Jika tidak ada, create dengan nilai awal kosong (null).
 */
export async function getBimtekScore(bimtekId, noPeserta) {
  const docId = `${bimtekId}__${noPeserta}`;
  const snap = await getDoc(doc(db, COL.BIMTEK_SCORES, docId));

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  // Create kosong
  const template = {
    bimtekId,
    noPeserta,
    pretest: null,
    posttest: null,
    pengajar: null,
    kehadiran: null,
    keaktifan: null,
    respek: null,
    tugas: null,
    presentasi: null,
    pretest_src: null,
    posttest_src: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, COL.BIMTEK_SCORES, docId), template);
  return { id: docId, ...template };
}

/**
 * Update nilai dalam bimtek_scores.
 * @param {string} bimtekId
 * @param {string} noPeserta
 * @param {object} values - { pengajar, kehadiran, keaktifan, respek, tugas, presentasi }
 */
export async function updateNilai(bimtekId, noPeserta, values) {
  const docId = `${bimtekId}__${noPeserta}`;

  const allowed = ['pretest', 'posttest', 'pengajar', 'kehadiran', 'keaktifan', 'respek', 'tugas', 'presentasi'];
  const payload = {};

  for (const key of allowed) {
    if (key in values) {
      const val = values[key];
      // Validasi range 0-100
      if (val !== null && (typeof val !== 'number' || val < 0 || val > 100)) {
        throw new Error(`${key} harus antara 0-100`);
      }
      payload[key] = val;
    }
  }

  if (Object.keys(payload).length === 0) return;

  payload.updatedAt = serverTimestamp();
  await updateDoc(doc(db, COL.BIMTEK_SCORES, docId), payload);

  await logAudit({
    action: 'update_nilai',
    entityType: 'bimtek_scores',
    entityId: docId,
    metadata: { fields: Object.keys(payload) }
  });
}

/**
 * Bulk update nilai pengajar (per peserta).
 * Dipakai saat admin input nilai pengajar untuk semua peserta.
 */
export async function bulkUpdateNilaiPengajar(bimtekId, updates) {
  // updates: { noPeserta: nilai, ... }
  const batch = writeBatch(db);

  for (const [noPeserta, nilai] of Object.entries(updates)) {
    if (nilai === null || typeof nilai !== 'number' || nilai < 0 || nilai > 100) continue;

    const docId = `${bimtekId}__${noPeserta}`;
    const docRef = doc(db, COL.BIMTEK_SCORES, docId);

    // Ensure exist dulu
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      batch.set(docRef, {
        bimtekId,
        noPeserta,
        pretest: null,
        posttest: null,
        pengajar: nilai,
        kehadiran: null,
        keaktifan: null,
        respek: null,
        tugas: null,
        presentasi: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      batch.update(docRef, {
        pengajar: nilai,
        updatedAt: serverTimestamp()
      });
    }
  }

  await batch.commit();

  await logAudit({
    action: 'bulk_update_nilai_pengajar',
    entityType: 'bimtek_scores',
    entityId: bimtekId,
    metadata: { count: Object.keys(updates).length }
  });
}

// ─── ATTENDANCE ──────────────────────────────────────────────────

/**
 * Get atau create attendance record untuk peserta.
 * Format: { sesiId: {kehadiran: true/false, keterangan: '...'}, ... }
 */
export async function getAttendance(bimtekId, noPeserta) {
  const docId = `${bimtekId}__${noPeserta}`;
  const snap = await getDoc(doc(db, COL.BIMTEK_ATTENDANCE, docId));

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  // Create kosong
  const template = {
    bimtekId,
    noPeserta,
    sessions: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, COL.BIMTEK_ATTENDANCE, docId), template);
  return { id: docId, ...template };
}

/**
 * Update kehadiran untuk sesi tertentu.
 * @param {string} bimtekId
 * @param {string} noPeserta
 * @param {string} sesiId
 * @param {boolean} kehadiran
 * @param {string} keterangan - optional
 */
export async function updateKehadiran(bimtekId, noPeserta, sesiId, kehadiran, keterangan = null) {
  const docId = `${bimtekId}__${noPeserta}`;
  const docRef = doc(db, COL.BIMTEK_ATTENDANCE, docId);

  // Ensure exist
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await getAttendance(bimtekId, noPeserta);
  }

  // Update nested field
  const updatePayload = {
    [`sessions.${sesiId}`]: {
      kehadiran: !!kehadiran,
      keterangan: keterangan || null,
      updatedAt: serverTimestamp()
    },
    updatedAt: serverTimestamp()
  };

  await updateDoc(docRef, updatePayload);

  await logAudit({
    action: 'update_kehadiran',
    entityType: 'bimtek_attendance',
    entityId: docId,
    metadata: { sesiId, kehadiran }
  });
}

/**
 * Hitung statistik kehadiran: berapa sesi hadir dari total sesi mapel.
 * @param {object} attendance - dari getAttendance
 * @param {object[]} sesis - dari listSesi (bimtek)
 * @returns { hadir: number, total: number, persentase: number }
 */
export function hitungKehadiran(attendance, sesis) {
  // Filter sesi yang tipe 'mapel' saja (bukan break/ISHOMA)
  const mapelSesis = sesis.filter(s => s.tipe === 'mapel');
  const total = mapelSesis.length;

  if (total === 0) return { hadir: 0, total: 0, persentase: 0 };

  const hadir = mapelSesis.filter(s => {
    const status = attendance.sessions?.[s.id];
    return status?.kehadiran === true;
  }).length;

  const persentase = Math.round((hadir / total) * 100);

  return { hadir, total, persentase };
}

/**
 * Bulk update kehadiran dari matrix (all peserta, all sesi in one shot).
 * Dipakai saat admin submit matrix kehadiran.
 *
 * @param {string} bimtekId
 * @param {object} matrixData
 *   {
 *     noPeserta: { sesiId: true/false, ... },
 *     ...
 *   }
 */
export async function bulkUpdateKehadiran(bimtekId, matrixData) {
  const batch = writeBatch(db);

  for (const [noPeserta, sessions] of Object.entries(matrixData)) {
    const docId = `${bimtekId}__${noPeserta}`;
    const docRef = doc(db, COL.BIMTEK_ATTENDANCE, docId);

    // Ensure exist dulu
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      batch.set(docRef, {
        bimtekId,
        noPeserta,
        sessions: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Update sessions
    const sessionsPayload = {};
    for (const [sesiId, kehadiran] of Object.entries(sessions)) {
      sessionsPayload[`sessions.${sesiId}`] = {
        kehadiran: !!kehadiran,
        keterangan: null,
        updatedAt: serverTimestamp()
      };
    }

    batch.update(docRef, {
      ...sessionsPayload,
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();

  await logAudit({
    action: 'bulk_update_kehadiran',
    entityType: 'bimtek_attendance',
    entityId: bimtekId,
    metadata: { pesertaCount: Object.keys(matrixData).length }
  });
}

// ─── EXAM RESULTS (read-only, written by scorer.js) ──────────────

/**
 * Get exam result untuk peserta + tipe session.
 */
export async function getExamResult(examId, noPeserta, tipeSession = null) {
  const docId = `${examId}__${noPeserta}`;
  const snap = await getDoc(doc(db, COL.EXAM_RESULTS, docId));

  if (!snap.exists()) return null;

  const result = { id: snap.id, ...snap.data() };
  if (tipeSession && result.tipeSession !== tipeSession) return null;

  return result;
}

/**
 * List exam results untuk bimtek (all peserta, all exam results).
 */
export async function listExamResults(bimtekId) {
  const snap = await getDocs(
    query(
      collection(db, COL.EXAM_RESULTS),
      where('bimtekId', '==', bimtekId)
    )
  );
  return snapToArray(snap);
}

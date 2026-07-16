// admin/js/modules/bimtek/exam-api.js
// CRUD untuk exams dan exam_sessions dalam konteks bimtek.

import {
  db, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, serverTimestamp, writeBatch, deleteField,
  snapToArray, snapToDoc
} from '../../../../shared/db.js';
import { getCurrentUser } from '../../../../shared/auth.js';
import { logAudit } from '../../../../shared/logger.js';
import { COL } from '../../../../shared/constants.js';
import { recalcSoalStats } from '../bank-soal/api.js';

// ─── Exam Config ──────────────────────────────────────────────

export async function listExams(bimtekId) {
  const snap = await getDocs(
    query(collection(db, COL.EXAMS), where('bimtekId', '==', bimtekId), orderBy('createdAt', 'asc'))
  );
  return snapToArray(snap);
}

export async function getExam(examId) {
  return snapToDoc(await getDoc(doc(db, COL.EXAMS, examId)));
}

/**
 * Buat exam config baru.
 * @param {string} bimtekId
 * @param {object} data
 * @param {string}   data.tipe            - 'pretest'|'posttest'|'pretest_posttest'
 * @param {string}   data.judul
 * @param {number}   data.durasi          - menit
 * @param {string[]} data.soalIds         - pool soal yang dipilih admin
 * @param {number}   data.jumlahDitampilkan - soal per session (≤ soalIds.length)
 */
export async function createExam(bimtekId, data) {
  _validateExam(data);
  const user = getCurrentUser();
  const ref  = await addDoc(collection(db, COL.EXAMS), {
    bimtekId,
    tipe:               data.tipe,
    judul:              data.judul.trim(),
    durasi:             data.durasi,
    soalIds:            data.soalIds,
    jumlahDitampilkan:  data.jumlahDitampilkan,
    published:          false,
    createdAt:          serverTimestamp(),
    updatedAt:          serverTimestamp(),
    createdBy:          user.uid,
  });
  await logAudit({ action: 'create_exam', entityType: 'exam', entityId: ref.id, metadata: { bimtekId, tipe: data.tipe } });
  recalcSoalStats(data.soalIds).catch(console.error);
  return ref.id;
}

export async function updateExam(examId, data) {
  _validateExam(data);
  // Ambil soalIds lama untuk recalc soal yang mungkin dikeluarkan dari exam
  const oldSnap = await getDoc(doc(db, COL.EXAMS, examId));
  const oldSoalIds = oldSnap.exists() ? (oldSnap.data().soalIds ?? []) : [];

  await updateDoc(doc(db, COL.EXAMS, examId), {
    tipe:              data.tipe,
    judul:             data.judul.trim(),
    durasi:            data.durasi,
    soalIds:           data.soalIds,
    jumlahDitampilkan: data.jumlahDitampilkan,
    updatedAt:         serverTimestamp(),
  });
  await logAudit({ action: 'update_exam', entityType: 'exam', entityId: examId });
  // Recalc untuk semua soal yang terpengaruh (lama + baru)
  const affectedIds = [...new Set([...oldSoalIds, ...data.soalIds])];
  recalcSoalStats(affectedIds).catch(console.error);
}

export async function deleteExam(examId) {
  // Ambil data exam sebelum hapus
  const examSnap = await getDoc(doc(db, COL.EXAMS, examId));
  if (!examSnap.exists()) throw new Error('Ujian tidak ditemukan.');
  const exam    = examSnap.data();
  const soalIds = exam.soalIds ?? [];
  const bimtekId = exam.bimtekId;

  // Ambil semua sessions untuk mendapatkan daftar noPeserta + tipeSession
  const sessions = await listSessions(examId);

  // Kumpulkan semua doc yang harus dihapus dalam batch(es)
  // Firestore batch limit = 500 operasi
  const toDelete = [];

  // exam_sessions
  sessions.forEach(s => toDelete.push(doc(db, COL.EXAM_SESSIONS, s.id)));

  // exam_results: id = ${examId}__${noPeserta}__${tipeSession}
  sessions.forEach(s => toDelete.push(doc(db, COL.EXAM_RESULTS, `${examId}__${s.noPeserta}__${s.tipeSession}`)));

  // exam_submissions: hapus yang terkait examId ini
  const subsSnap = await getDocs(
    query(collection(db, COL.EXAM_SUBMISSIONS), where('examId', '==', examId))
  );
  subsSnap.forEach(d => toDelete.push(d.ref));

  // Jalankan batch delete (maks 500 per batch)
  const BATCH_LIMIT = 490;
  for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + BATCH_LIMIT).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  // Bersihkan field pretest/posttest di bimtek_scores untuk peserta yang terdampak
  const tipeMap = { pretest: new Set(), posttest: new Set() };
  sessions.forEach(s => {
    if (s.tipeSession === 'pretest' || s.tipeSession === 'posttest') {
      tipeMap[s.tipeSession].add(s.noPeserta);
    }
  });

  const scoreUpdates = [];
  for (const [tipe, pesertaSet] of Object.entries(tipeMap)) {
    for (const noPeserta of pesertaSet) {
      scoreUpdates.push({ noPeserta, tipe });
    }
  }

  if (scoreUpdates.length > 0) {
    const batch = writeBatch(db);
    for (const { noPeserta, tipe } of scoreUpdates) {
      const scoreRef  = doc(db, COL.BIMTEK_SCORES, `${bimtekId}__${noPeserta}`);
      const scoreSnap = await getDoc(scoreRef);
      if (scoreSnap.exists()) {
        batch.update(scoreRef, {
          [tipe]:          deleteField(),
          [`${tipe}_src`]: deleteField(),
          updatedAt:       serverTimestamp(),
        });
      }
    }
    await batch.commit();
  }

  // Hapus doc exam
  await deleteDoc(doc(db, COL.EXAMS, examId));
  await logAudit({ action: 'delete_exam', entityType: 'exam', entityId: examId });
  recalcSoalStats(soalIds).catch(console.error);
}

export async function publishExam(examId, published) {
  await updateDoc(doc(db, COL.EXAMS, examId), { published, updatedAt: serverTimestamp() });
}

// ─── Exam Sessions (Magic Link) ───────────────────────────────

export async function listSessions(examId) {
  const snap = await getDocs(
    query(collection(db, COL.EXAM_SESSIONS), where('examId', '==', examId), orderBy('noPeserta', 'asc'))
  );
  return snapToArray(snap);
}

export async function listSessionsByBimtek(bimtekId) {
  const snap = await getDocs(
    query(collection(db, COL.EXAM_SESSIONS), where('bimtekId', '==', bimtekId))
  );
  return snapToArray(snap);
}

/**
 * Generate magic link sessions untuk semua peserta.
 * Untuk tipe 'pretest_posttest': generate 2 session per peserta (pretest + posttest)
 *   dengan soalIds yang sama (hanya di-shuffle ulang di exam app).
 * Untuk tipe lain: generate 1 session per peserta.
 *
 * Skip peserta yang sudah punya session untuk tipe yang sama.
 *
 * @param {object} exam   - exam doc dari getExam/listExams
 * @param {string[]} pesertaIds - array noPeserta
 * @param {number} expiredJam  - jam sebelum expired (default 72)
 * @returns {{ created: number, skipped: number }}
 */
export async function generateSessions(exam, pesertaIds, expiredJam = 72) {
  const user      = getCurrentUser();
  const expiredAt = new Date(Date.now() + expiredJam * 60 * 60 * 1000);

  // Fetch info peserta untuk disimpan di session (agar exam app tidak perlu akses peserta_master)
  const pesertaMap = {};
  await Promise.all(pesertaIds.map(async id => {
    try {
      const snap = await getDoc(doc(db, COL.PESERTA_MASTER, id));
      if (snap.exists()) {
        const d = snap.data();
        pesertaMap[id] = {
          namaPeserta:     d.nama     || '',
          jabatanPeserta:  d.jabatan  || '',
          instansiPeserta: d.instansi || '',
        };
      }
    } catch { /* lewati jika gagal fetch satu peserta */ }
  }));

  // Ambil sessions yang sudah ada untuk exam ini
  const existing    = await listSessions(exam.id);
  const existingSet = new Set(existing.map(s => `${s.noPeserta}__${s.tipeSession}`));

  const tipes = exam.tipe === 'pretest_posttest' ? ['pretest', 'posttest'] : [exam.tipe];

  const batch   = writeBatch(db);
  let created   = 0;
  let skipped   = 0;

  for (const noPeserta of pesertaIds) {
    for (const tipeSession of tipes) {
      const key = `${noPeserta}__${tipeSession}`;
      if (existingSet.has(key)) { skipped++; continue; }

      // Lock soalIds saat generate
      // pretest_posttest: soal identik (shuffle hanya di exam app)
      // pretest/posttest terpisah: random pick sejumlah jumlahDitampilkan
      const soalIds = _pickSoal(exam.soalIds, exam.jumlahDitampilkan);
      const info    = pesertaMap[noPeserta] || {};

      const token = _generateToken();
      const ref   = doc(collection(db, COL.EXAM_SESSIONS));
      batch.set(ref, {
        examId:          exam.id,
        bimtekId:        exam.bimtekId,
        noPeserta,
        tipeSession,
        soalIds,
        token,
        expiredAt,
        status:          'issued',
        startedAt:       null,
        submittedAt:     null,
        namaPeserta:     info.namaPeserta     || '',
        jabatanPeserta:  info.jabatanPeserta  || '',
        instansiPeserta: info.instansiPeserta || '',
        examJudul:       exam.judul           || '',
        examDurasi:      exam.durasi          || 0,
        createdAt:       serverTimestamp(),
        createdBy:       user.uid,
      });
      created++;
    }
  }

  if (created > 0) await batch.commit();
  await logAudit({
    action: 'generate_sessions', entityType: 'exam', entityId: exam.id,
    metadata: { created, skipped, tipe: exam.tipe }
  });

  return { created, skipped };
}

/**
 * Perpanjang waktu sesi ujian yang sedang berjalan.
 * Tambahan menit bersifat kumulatif — memanggil dua kali masing-masing +5 = +10 total.
 * Efektif saat peserta me-refresh halaman ujian.
 */
export async function extendSession(sessionId, additionalMinutes) {
  const snap = await getDoc(doc(db, COL.EXAM_SESSIONS, sessionId));
  if (!snap.exists()) throw new Error('Session tidak ditemukan.');
  const current  = snap.data().timeExtensionMinutes || 0;
  const newTotal = current + additionalMinutes;
  await updateDoc(doc(db, COL.EXAM_SESSIONS, sessionId), {
    timeExtensionMinutes: newTotal,
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    action: 'extend_session', entityType: 'exam_session', entityId: sessionId,
    metadata: { additionalMinutes, newTotal },
  });
  return newTotal;
}

export async function deleteSession(sessionId) {
  await deleteDoc(doc(db, COL.EXAM_SESSIONS, sessionId));
}

export async function resetSession(sessionId) {
  const user = getCurrentUser();

  // Ambil session untuk mendapatkan examId, noPeserta, tipeSession
  const sessSnap = await getDoc(doc(db, COL.EXAM_SESSIONS, sessionId));
  if (!sessSnap.exists()) throw new Error('Session tidak ditemukan.');
  const sess = sessSnap.data();

  const batch = writeBatch(db);

  // Hapus exam_results untuk session ini (nilai aktif)
  // Submissions TIDAK dihapus — tetap tersimpan sebagai arsip histori pengerjaan
  const resultId = `${sess.examId}__${sess.noPeserta}__${sess.tipeSession}`;
  batch.delete(doc(db, COL.EXAM_RESULTS, resultId));

  // Hapus field pretest/posttest dari bimtek_scores agar tab Pre/Post-Test & Kelulusan ikut terupdate
  if (sess.tipeSession !== 'seleksi_tertulis') {
    const scoreKey = sess.tipeSession === 'pretest' ? 'pretest' : 'posttest';
    const scoreRef = doc(db, COL.BIMTEK_SCORES, `${sess.bimtekId}__${sess.noPeserta}`);
    const scoreSnap = await getDoc(scoreRef);
    if (scoreSnap.exists()) {
      batch.update(scoreRef, {
        [scoreKey]:          deleteField(),
        [`${scoreKey}_src`]: deleteField(),
        updatedAt:           serverTimestamp(),
      });
    }
  }

  // Reset session ke state awal
  batch.update(doc(db, COL.EXAM_SESSIONS, sessionId), {
    status:       'issued',
    startedAt:    null,
    submittedAt:  null,
    answers:      null,
    lastSavedAt:  null,
    warningCount: 0,
    violationLog: [],
    updatedAt:    serverTimestamp(),
    resetBy:      user.uid,
  });

  await batch.commit();
  await logAudit({ action: 'reset_session', entityType: 'exam_session', entityId: sessionId });
}

// ─── Helpers ──────────────────────────────────────────────────

function _validateExam(data) {
  const errors = [];
  if (!data.judul?.trim())          errors.push('Judul ujian wajib diisi.');
  if (!data.tipe)                   errors.push('Tipe ujian wajib dipilih.');
  if (!data.durasi || data.durasi < 1) errors.push('Durasi wajib diisi.');
  if (!data.soalIds?.length)        errors.push('Pilih minimal 1 soal.');
  if (data.jumlahDitampilkan < 1)   errors.push('Jumlah soal ditampilkan minimal 1.');
  if (data.jumlahDitampilkan > data.soalIds?.length)
    errors.push('Jumlah ditampilkan tidak boleh melebihi jumlah soal dipilih.');
  if (errors.length) throw new Error(errors.join(' '));
}

/** Fisher-Yates shuffle + slice */
function _pickSoal(soalIds, jumlah) {
  const arr = [...soalIds];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, jumlah);
}

/** Generate UUID-like token */
function _generateToken() {
  return 'xxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// exam/js/db.js
// Firestore helpers untuk exam app — TANPA Firebase Auth.
// Exam app berjalan sebagai unauthenticated client; otorisasi berbasis token
// magic link yang disimpan di session doc.

import { db } from '../../shared/firebase-config.js';
import {
  doc, getDoc, getDocFromServer, getDocs, updateDoc, addDoc,
  collection, query, where, serverTimestamp, arrayUnion, runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Collection names — mirror dari shared/constants.js COL
// (tidak import langsung agar exam/js/db.js tetap berdiri sendiri)
const BIMTEK           = 'bimtek';
const EXAMS            = 'exams';
const EXAM_SESSIONS    = 'exam_sessions';
const EXAM_SUBMISSIONS = 'exam_submissions';
const BANK_SOAL        = 'bank_soal';

// ─── Bimtek (lookup by accessCode) ───────────────────────────

/**
 * Cari bimtek berdasarkan kode ujian (accessCode).
 * Firestore rule: bimtek collection harus allow read tanpa auth.
 * @param {string} code  - kode ujian mentah dari input (misal "ABC-DEF" atau "ABCDEF")
 * @returns {object|null} bimtek doc + id, atau null
 */
export async function getBimtekByAccessCode(code) {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const snap = await getDocs(
    query(collection(db, BIMTEK), where('accessCode', '==', normalized))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  if (data.deleted) return null;
  return { id: d.id, ...data };
}

/**
 * Ambil semua sessions milik seorang peserta dalam satu bimtek.
 * Dipakai oleh alur kode ujian untuk step 2 & 3.
 * @param {string} bimtekId
 * @param {string} noPeserta
 * @returns {object[]} array session docs
 */
export async function getSessionsByBimtekAndPeserta(bimtekId, noPeserta) {
  const snap = await getDocs(
    query(
      collection(db, EXAM_SESSIONS),
      where('bimtekId',   '==', bimtekId),
      where('noPeserta',  '==', noPeserta),
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Session ──────────────────────────────────────────────────

/**
 * Cari session berdasarkan magic link token.
 * Firestore rule: allow read if request.auth == null (unauthenticated OK)
 * @param {string} token
 * @returns {object|null} session doc + field 'id', atau null
 */
export async function getSessionByToken(token) {
  const snap = await getDocs(
    query(collection(db, EXAM_SESSIONS), where('token', '==', token))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Claim session untuk device ini secara atomic.
 * Dipakai saat status 'issued' → 'started' (mulai ujian baru).
 * Throw error dengan code='DEVICE_CONFLICT' jika device lain sudah memegang lock.
 * @param {string} sessionId
 * @param {string} deviceToken  - UUID unik per browser tab (dari sessionStorage)
 */
export async function startSessionWithDevice(sessionId, deviceToken) {
  const sessionRef = doc(db, EXAM_SESSIONS, sessionId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists()) throw new Error('Session not found');
    const data = snap.data();

    if (data.deviceToken && data.deviceToken !== deviceToken) {
      const err = new Error('DEVICE_CONFLICT');
      err.code = 'DEVICE_CONFLICT';
      throw err;
    }

    tx.update(sessionRef, {
      status:      'started',
      startedAt:   serverTimestamp(),
      answers:     {},
      deviceToken,
    });
  });
}

/**
 * Claim session yang sudah 'started' untuk device ini (resume).
 * Throw error dengan code='DEVICE_CONFLICT' jika device lain sudah memegang lock.
 * @param {string} sessionId
 * @param {string} deviceToken
 */
export async function claimDeviceForResume(sessionId, deviceToken) {
  const sessionRef = doc(db, EXAM_SESSIONS, sessionId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists()) throw new Error('Session not found');
    const data = snap.data();

    if (data.deviceToken && data.deviceToken !== deviceToken) {
      const err = new Error('DEVICE_CONFLICT');
      err.code = 'DEVICE_CONFLICT';
      throw err;
    }

    tx.update(sessionRef, { deviceToken });
  });
}

/**
 * Auto-save jawaban + warningCount ke session doc.
 * Jika deviceToken diberikan, baca token di Firestore sebelum save untuk mendeteksi
 * apakah admin telah membuka kunci dan device lain sudah mengambil alih.
 * Token TIDAK ditulis ulang di sini — hanya diubah via transaction (start/resume/unlock admin).
 *
 * @param {string} sessionId
 * @param {object} answers
 * @param {number} warningCount
 * @param {string|undefined} deviceToken  - token device ini (dari _session.deviceToken)
 * @returns {boolean} true jika masih pemilik sah, false jika admin unlock + device lain masuk
 */
export async function autoSaveAnswers(sessionId, answers, warningCount = 0, deviceToken) {
  if (deviceToken) {
    // Deteksi eviction: jika admin membuka kunci dan device baru sudah mengklaim,
    // token di Firestore akan berbeda dari milik kita.
    const snap = await getDoc(doc(db, EXAM_SESSIONS, sessionId));
    if (snap.exists()) {
      const current = snap.data().deviceToken;
      // current berbeda dengan milik kita (termasuk jika current sudah null/undefined
      // karena admin baru saja membuka kunci tapi device lain belum klaim — biarkan lanjut)
      if (current && current !== deviceToken) return false;
    }
  }

  await updateDoc(doc(db, EXAM_SESSIONS, sessionId), {
    answers,
    warningCount,
    lastSavedAt: serverTimestamp(),
    // deviceToken TIDAK ditulis — lock hanya diubah via startSessionWithDevice /
    // claimDeviceForResume / unlockDeviceSession (admin)
  });
  return true;
}

/** Simpan warningCount + catat jenis pelanggaran ke violationLog. */
export async function saveWarningCount(sessionId, warningCount, reason) {
  const update = { warningCount };
  if (reason) update.violationLog = arrayUnion(reason);
  await updateDoc(doc(db, EXAM_SESSIONS, sessionId), update);
}

/**
 * Submit ujian: buat exam_submission doc dulu, baru update session status.
 * Urutan ini memastikan kalau submission berhasil tapi update session gagal,
 * data jawaban tetap tersimpan di exam_submissions.
 *
 * @param {string} sessionId
 * @param {object} submissionData
 */
export async function submitExam(sessionId, submissionData) {
  // 1. Buat submission document
  // Firestore rule: allow create if hasAll(['sessionId','examId','noPeserta','answers'])
  await addDoc(collection(db, EXAM_SUBMISSIONS), {
    sessionId,
    examId:       submissionData.examId,
    bimtekId:     submissionData.bimtekId,
    noPeserta:    submissionData.noPeserta,
    tipeSession:  submissionData.tipeSession,
    answers:      submissionData.answers,
    flagged:       submissionData.flagged,
    submitReason:  submissionData.submitReason,
    warningCount:  submissionData.warningCount,
    violationLog:  submissionData.violationLog || [],
    totalSoal:     submissionData.totalSoal,
    submittedAt:  serverTimestamp(),
  });

  // 2. Update session status → submitted
  await updateDoc(doc(db, EXAM_SESSIONS, sessionId), {
    status:      'submitted',
    submittedAt: serverTimestamp(),
    answers:     submissionData.answers,
  });
}

// ─── Exam Config ──────────────────────────────────────────────

/**
 * Ambil semua ujian yang published di satu bimtek.
 * Dipakai untuk menampilkan pilihan ujian di step 3.
 * Firestore rule: allow read if published == true.
 */
export async function getExamsByBimtek(bimtekId) {
  const snap = await getDocs(
    query(
      collection(db, EXAMS),
      where('bimtekId',  '==', bimtekId),
      where('published', '==', true),
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch exam config dari collection 'exams'.
 * Firestore rule: allow read if published == true (exam app tanpa auth)
 */
export async function getExam(examId) {
  const snap = await getDoc(doc(db, EXAMS, examId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Sama dengan getExam tapi selalu baca dari server (bypass SDK cache).
 * Dipakai untuk validasi window ujian di saat klik "Mulai" agar selalu
 * mendapat status terkini meski admin baru saja mengubahnya.
 */
export async function getExamFromServer(examId) {
  const snap = await getDocFromServer(doc(db, EXAMS, examId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ─── Bank Soal ────────────────────────────────────────────────

/**
 * Fetch soal dari bank_soal (TANPA kunci jawaban).
 * Hasil diurutkan sesuai soalIds (mempertahankan urutan input).
 *
 * Firestore rule yang dibutuhkan:
 *   match /bank_soal/{soalId} {
 *     allow read: if isAdmin() || request.auth == null;
 *   }
 *
 * @param {string[]} soalIds
 * @returns {object[]} array soal, ordered sesuai soalIds
 */
export async function getSoalList(soalIds) {
  if (!soalIds?.length) return [];
  // Fetch parallel — Promise.all mempertahankan urutan
  const snaps = await Promise.all(
    soalIds.map(id => getDoc(doc(db, BANK_SOAL, id)))
  );
  return snaps
    .filter(s => s.exists())
    .map(s => ({ id: s.id, ...s.data() }));
}

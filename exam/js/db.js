// exam/js/db.js
// Firestore helpers untuk exam app — TANPA Firebase Auth.
// Exam app berjalan sebagai unauthenticated client; otorisasi berbasis token
// magic link yang disimpan di session doc.

import { db } from '../../shared/firebase-config.js';
import {
  doc, getDoc, getDocs, updateDoc, addDoc,
  collection, query, where, serverTimestamp, arrayUnion,
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
 * Update status session ke 'started' dan catat startedAt.
 * Dipanggil sekali saat peserta klik "Mulai Ujian".
 *
 * Firestore rule yang dibutuhkan (perlu update dari default):
 *   allow update: if resource.data.status in ['issued','started'] && ...
 */
export async function startSession(sessionId) {
  await updateDoc(doc(db, EXAM_SESSIONS, sessionId), {
    status:    'started',
    startedAt: serverTimestamp(),
    answers:   {},
  });
}

/**
 * Auto-save jawaban + warningCount ke session doc (dipanggil setiap 30 detik).
 * warningCount disimpan agar tidak reset saat peserta refresh.
 * @param {string} sessionId
 * @param {object} answers       { [soalId]: 'a'|'b'|'c'|'d' }
 * @param {number} warningCount  jumlah peringatan saat ini
 */
export async function autoSaveAnswers(sessionId, answers, warningCount = 0) {
  await updateDoc(doc(db, EXAM_SESSIONS, sessionId), {
    answers,
    warningCount,
    lastSavedAt: serverTimestamp(),
  });
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
 * Fetch exam config dari collection 'exams'.
 * Firestore rule: allow read if published == true (exam app tanpa auth)
 */
export async function getExam(examId) {
  const snap = await getDoc(doc(db, EXAMS, examId));
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

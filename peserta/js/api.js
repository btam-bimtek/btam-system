// peserta/js/api.js
// Query Firestore untuk Portal Peserta (publik, tanpa Firebase Auth).
//
// CATATAN KEAMANAN: login noPeserta+tanggalLahir adalah gerbang UI, bukan
// proteksi Firestore Security Rules yang sesungguhnya (rules tidak bisa
// memverifikasi kredensial tanpa Firebase Auth sungguhan). Model kepercayaan
// di sini sama dengan magic link ujian (exam_sessions) — "tahu ID dokumen
// yang tepat = bisa baca dokumen itu", get-only (tanpa list publik) untuk
// data per-peserta. Lihat firestore.rules untuk detail rule per collection.

import { db } from '../../shared/firebase-config.js';
import { collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp } from '../../shared/db.js';
import { COL } from '../../shared/constants.js';
import { getPesertaReportData } from '../../admin/js/modules/bimtek/report-api.js';
import { listMapel } from '../../admin/js/modules/bimtek/api.js';

const SESSION_KEY = 'btam_peserta_session';

// ─── Session (localStorage) ─────────────────────────────────

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setSession(noPeserta) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ noPeserta }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Login ───────────────────────────────────────────────────

/**
 * Verifikasi noPeserta + tanggalLahir terhadap peserta_master.
 * @returns {object|null} data peserta kalau cocok, null kalau tidak
 */
export async function login(noPeserta, tanggalLahir) {
  const snap = await getDoc(doc(db, COL.PESERTA_MASTER, noPeserta.trim()));
  if (!snap.exists()) return null;
  const peserta = { id: snap.id, ...snap.data() };
  if (peserta.deleted) return null;
  if (!peserta.tanggalLahir || peserta.tanggalLahir !== tanggalLahir) return null;
  return peserta;
}

export async function getPeserta(noPeserta) {
  const snap = await getDoc(doc(db, COL.PESERTA_MASTER, noPeserta));
  if (!snap.exists()) return null;
  const peserta = { id: snap.id, ...snap.data() };
  return peserta.deleted ? null : peserta;
}

// ─── Dashboard: daftar bimtek diikuti ───────────────────────

export async function getBimtek(bimtekId) {
  const snap = await getDoc(doc(db, COL.BIMTEK, bimtekId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Mapel + pengajarIds masing-masing — dipakai form evaluasi (per mapel per pengajar). */
export { listMapel };

export async function listBimtekDiikuti(noPeserta) {
  const snap = await getDocs(
    query(collection(db, COL.BIMTEK), where('pesertaIds', 'array-contains', noPeserta))
  );
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.periode?.mulai?.toMillis?.() ?? 0) - (a.periode?.mulai?.toMillis?.() ?? 0));
  return list;
}

export async function getPengajar(pengajarId) {
  const snap = await getDoc(doc(db, COL.PENGAJAR_MASTER, pengajarId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getBimtekScore(bimtekId, noPeserta) {
  const snap = await getDoc(doc(db, COL.BIMTEK_SCORES, `${bimtekId}__${noPeserta}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ─── Sertifikat / report ────────────────────────────────────

export { getPesertaReportData };

export async function getLembagaSettings() {
  const snap = await getDoc(doc(db, COL.APP_SETTINGS, 'lembaga'));
  return snap.exists() ? snap.data() : {};
}

// ─── Evaluasi ────────────────────────────────────────────────

function _evaluasiDocId(bimtekId, noPeserta) {
  return `${bimtekId}__${noPeserta}`;
}

/** Cek apakah peserta sudah submit evaluasi untuk bimtek ini. */
export async function sudahEvaluasi(bimtekId, noPeserta) {
  const snap = await getDoc(doc(db, COL.EVALUASI_PENGAJAR_RESPONSE, _evaluasiDocId(bimtekId, noPeserta)));
  return snap.exists();
}

/**
 * Submit evaluasi. Field noPeserta tetap disimpan (untuk audit manual di
 * Firestore console) tapi UI admin tidak menampilkannya — "anonim" di sini
 * adalah level UI, bukan level data.
 */
export async function submitEvaluasi(bimtekId, noPeserta, payload) {
  await setDoc(doc(db, COL.EVALUASI_PENGAJAR_RESPONSE, _evaluasiDocId(bimtekId, noPeserta)), {
    bimtekId, noPeserta,
    ...payload,
    submittedAt: serverTimestamp(),
  });
}

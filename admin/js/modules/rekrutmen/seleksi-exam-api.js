// admin/js/modules/rekrutmen/seleksi-exam-api.js
// Menghubungkan ujian seleksi tertulis (exam system) ke calon peserta rekrutmen.
// Calon peserta tidak punya entri di peserta_master maupun bimtekId — sesi ujian
// mereka pakai noPeserta = pendaftarId (nomor registrasi yang mereka tahu, dipakai
// untuk verifikasi identitas di exam app) dan diakses lewat magic link (?token=...),
// bukan lewat "Kode Ujian" per-bimtek.

import {
  db, collection, doc, getDoc, getDocs, updateDoc, writeBatch,
  query, where, serverTimestamp, snapToArray, setDoc
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { logAudit } from '../../../../shared/logger.js';
import { getCurrentUser } from '../../../../shared/auth.js';
import { hitungSkor } from '../bimtek/scorer.js';
import { updateNilaiTertulis } from './calon-api.js';

const TIPE_SESSION = 'seleksi_tertulis';

/**
 * Generate magic link session untuk calon peserta yang lulus administrasi
 * dan belum punya sesi. Skip yang sudah punya sesi (idempotent).
 * @param {object} exam - doc exams (harus tipe seleksi_tertulis)
 * @param {object[]} calonList - calon_peserta docs { id, nama, instansi, ... }
 * @param {Date} expiredAt
 * @returns {{ created: number, skipped: number }}
 */
export async function generateSeleksiSessions(exam, calonList, expiredAt) {
  const user = getCurrentUser();

  const existingSnap = await getDocs(
    query(collection(db, COL.EXAM_SESSIONS), where('examId', '==', exam.id))
  );
  const existingSet = new Set(snapToArray(existingSnap).map(s => s.noPeserta));

  const batch = writeBatch(db);
  let created = 0, skipped = 0;

  for (const calon of calonList) {
    // noPeserta pakai pendaftarId (nomor registrasi yang diketahui calon), bukan docId
    // internal — dipakai untuk verifikasi identitas di layar masuk exam app.
    if (existingSet.has(calon.pendaftarId)) { skipped++; continue; }

    const soalIds = _pickSoal(exam.soalIds, exam.jumlahDitampilkan);
    const ref = doc(collection(db, COL.EXAM_SESSIONS));
    batch.set(ref, {
      examId:          exam.id,
      bimtekId:         exam.bimtekId ?? null,
      noPeserta:        calon.pendaftarId,
      tipeSession:      TIPE_SESSION,
      soalIds,
      token:            _generateToken(),
      expiredAt,
      status:           'issued',
      startedAt:        null,
      submittedAt:      null,
      namaPeserta:      calon.nama     || '',
      jabatanPeserta:   calon.jabatan  || '',
      instansiPeserta:  calon.instansi || '',
      examJudul:        exam.judul     || '',
      examDurasi:       exam.durasi    || 0,
      createdAt:        serverTimestamp(),
      createdBy:        user.uid,
    });
    created++;
  }

  if (created > 0) await batch.commit();
  await logAudit({
    action: 'generate_seleksi_sessions', entityType: 'exam', entityId: exam.id,
    metadata: { created, skipped }
  });

  return { created, skipped };
}

/**
 * Generate sesi ujian untuk SEMUA bimtek yang punya examIdTertulis, ke SEMUA
 * calon yang lolos administrasi di bimtek itu. Dipanggil sekali dari UI,
 * menggantikan generate satu-per-satu.
 * @param {object} siklus - doc siklus_seleksi (butuh bimtekPilihan)
 * @param {object[]} calonList - semua calon (statusAdminOverall lulus)
 * @param {Date} expiredAt
 */
export async function generateSeleksiSessionsBulk(siklus, calonList, expiredAt) {
  const bimtekWithExam = (siklus.bimtekPilihan || []).filter(b => b.examIdTertulis);
  let created = 0, skipped = 0;
  const byBimtek = [];

  for (const b of bimtekWithExam) {
    const examSnap = await getDoc(doc(db, COL.EXAMS, b.examIdTertulis));
    if (!examSnap.exists()) { byBimtek.push({ bimtekId: b.bimtekId, created: 0, skipped: 0, error: 'Exam tidak ditemukan' }); continue; }
    const exam = { id: examSnap.id, ...examSnap.data() };

    const eligible = calonList.filter(c => c.statusAdmin?.[b.bimtekId]?.status === 'lulus');
    const { created: c, skipped: s } = await generateSeleksiSessions(exam, eligible, expiredAt);
    created += c; skipped += s;
    byBimtek.push({ bimtekId: b.bimtekId, created: c, skipped: s });
  }

  // Sinkronkan status_lookup untuk semua calon yang barusan dapat sesi baru.
  const touchedIds = new Set(
    bimtekWithExam.flatMap(b => calonList.filter(c => c.statusAdmin?.[b.bimtekId]?.status === 'lulus').map(c => c.id))
  );
  for (const id of touchedIds) await syncUjianTertulisStatusLookup(id);

  return { created, skipped, byBimtek };
}

/** List sesi seleksi_tertulis untuk exam tertentu (dipakai untuk tampilkan link per calon). */
export async function listSeleksiSessions(examId) {
  const snap = await getDocs(
    query(collection(db, COL.EXAM_SESSIONS), where('examId', '==', examId), where('tipeSession', '==', TIPE_SESSION))
  );
  return snapToArray(snap);
}

/**
 * Score semua exam_submissions seleksi_tertulis untuk exam ini, tulis exam_results,
 * lalu sinkronkan nilaiTertulis + statusTertulis ke calon_peserta.
 * @returns {{ processed: number, failed: number, errors: [{noPeserta, error}] }}
 */
export async function scoreSeleksiSubmissions(examId) {
  const errors = [];
  let processed = 0, failed = 0;

  const examSnap = await getDoc(doc(db, COL.EXAMS, examId));
  if (!examSnap.exists()) throw new Error('Exam tidak ditemukan');
  const exam = { id: examSnap.id, ...examSnap.data() };

  const [soalsSnap, answersSnap, bloomSnap, submissionsSnap] = await Promise.all([
    getDocs(query(collection(db, COL.BANK_SOAL), where('soalId', 'in', exam.soalIds))),
    getDocs(collection(db, COL.BANK_SOAL_ANSWERS)),
    getDoc(doc(db, COL.APP_SETTINGS, 'bloom_bobot')),
    getDocs(query(
      collection(db, COL.EXAM_SUBMISSIONS),
      where('examId', '==', examId),
      where('tipeSession', '==', TIPE_SESSION)
    )),
  ]);
  const bloomBobot = bloomSnap.exists() ? bloomSnap.data() : null;
  const soals = snapToArray(soalsSnap);
  const kunciMap = {};
  answersSnap.docs.forEach(d => { kunciMap[d.id] = d.data().kunci; });

  // Dedupe: per noPeserta, ambil submission dengan submittedAt terakhir
  const latestByPeserta = new Map();
  for (const s of snapToArray(submissionsSnap)) {
    const existing = latestByPeserta.get(s.noPeserta);
    const sTime = s.submittedAt?.toMillis?.() ?? s.submittedAt ?? 0;
    const eTime = existing ? (existing.submittedAt?.toMillis?.() ?? existing.submittedAt ?? 0) : -Infinity;
    if (!existing || sTime > eTime) latestByPeserta.set(s.noPeserta, s);
  }
  const submissions = Array.from(latestByPeserta.values());

  const batch = writeBatch(db);
  const scored = [];

  for (const submission of submissions) {
    try {
      const { skor, detail } = hitungSkor(submission, exam, soals, kunciMap, bloomBobot);
      const resultRef = doc(db, COL.EXAM_RESULTS, `${examId}__${submission.noPeserta}__${TIPE_SESSION}`);
      batch.set(resultRef, {
        examId,
        bimtekId:    exam.bimtekId ?? null,
        noPeserta:   submission.noPeserta,
        tipeSession: TIPE_SESSION,
        skor,
        detail,
        submittedAt: submission.submittedAt ?? null,
        scoredAt:    serverTimestamp(),
        rescoredAt:  serverTimestamp(),
      }, { merge: false });
      scored.push({ pendaftarId: submission.noPeserta, skor });
      processed++;
    } catch (err) {
      failed++;
      errors.push({ noPeserta: submission.noPeserta, error: err.message });
    }
  }

  if (processed > 0) await batch.commit();

  // Sinkron ke calon_peserta — noPeserta di sesi/submission adalah pendaftarId,
  // perlu resolve ke docId calon_peserta dulu (pendaftarId unik & embed tahun).
  for (const { pendaftarId, skor } of scored) {
    try {
      const calonSnap = await getDocs(
        query(collection(db, COL.CALON_PESERTA), where('pendaftarId', '==', pendaftarId))
      );
      if (calonSnap.empty) throw new Error('Calon peserta tidak ditemukan');
      await updateNilaiTertulis(calonSnap.docs[0].id, exam.bimtekId, skor);
      await syncUjianTertulisStatusLookup(calonSnap.docs[0].id);
    } catch (err) {
      failed++;
      errors.push({ noPeserta: pendaftarId, error: err.message });
    }
  }

  if (processed > 0) {
    await logAudit({
      action: 'score_seleksi_submissions', entityType: 'exam', entityId: examId,
      metadata: { processed, failed }
    });
  }

  return { processed, failed, errors };
}

/** Sinkronkan nilai untuk SEMUA bimtek yang punya examIdTertulis sekaligus. */
export async function scoreSeleksiSubmissionsBulk(siklus) {
  const bimtekWithExam = (siklus.bimtekPilihan || []).filter(b => b.examIdTertulis);
  let processed = 0, failed = 0;
  const byBimtek = [];

  for (const b of bimtekWithExam) {
    try {
      const { processed: p, failed: f } = await scoreSeleksiSubmissions(b.examIdTertulis);
      processed += p; failed += f;
      byBimtek.push({ bimtekId: b.bimtekId, processed: p, failed: f });
    } catch (e) {
      byBimtek.push({ bimtekId: b.bimtekId, processed: 0, failed: 0, error: e.message });
    }
  }

  return { processed, failed, byBimtek };
}

/**
 * Sinkronkan ringkasan semua sesi ujian seleksi_tertulis milik satu calon
 * ke status_lookup.ujianTertulis, supaya calon bisa lihat & akses link
 * ujiannya sendiri lewat halaman Cek Status Pendaftaran (tanpa distribusi manual).
 */
export async function syncUjianTertulisStatusLookup(calonDocId) {
  const calonSnap = await getDoc(doc(db, COL.CALON_PESERTA, calonDocId));
  if (!calonSnap.exists()) return;
  const calon = calonSnap.data();

  const sessSnap = await getDocs(
    query(
      collection(db, COL.EXAM_SESSIONS),
      where('noPeserta', '==', calon.pendaftarId),
      where('tipeSession', '==', TIPE_SESSION)
    )
  );

  const nilaiTertulis = calon.nilaiTertulis || {};
  const ujianTertulis = snapToArray(sessSnap).map(s => ({
    bimtekId:   s.bimtekId,
    namaBimtek: s.examJudul || s.bimtekId,
    token:      s.token,
    status:     s.status,
    nilai:      nilaiTertulis[s.bimtekId] ?? null,
  }));

  await setDoc(doc(db, COL.STATUS_LOOKUP, calon.pendaftarId), { ujianTertulis }, { merge: true });
}

// ─── Helpers ──────────────────────────────────────────────────

function _pickSoal(soalIds, jumlah) {
  const arr = [...soalIds];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, jumlah);
}

function _generateToken() {
  return 'xxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

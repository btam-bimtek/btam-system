// admin/js/modules/historis/api.js
// CRUD untuk alumni_historis dan kinerja_instansi.

import {
  db, collection, doc, getDocs, setDoc, writeBatch,
  query, orderBy, limit, where, getCountFromServer, snapToArray
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { logAudit } from '../../../../shared/logger.js';

// ─── Alumni Historis ──────────────────────────────────────────────────────────

/**
 * Hitung jumlah dokumen di alumni_historis.
 */
export async function countAlumniHistoris() {
  const snap = await getCountFromServer(collection(db, COL.ALUMNI_HISTORIS));
  return snap.data().count;
}

/**
 * Batch import alumni historis dari array data yang sudah dinormalisasi.
 * Gunakan docId deterministik untuk deduplication.
 * @param {object[]} rows - array dokumen siap simpan (sudah dinormalisasi)
 * @param {string}   sourceFile - nama file Excel sumber
 * @param {string}   performedBy - email admin
 * @returns {{ imported: number, skipped: number }}
 */
export async function batchImportAlumni(rows, sourceFile, performedBy) {
  const BATCH_SIZE = 400; // Firestore max 500 per batch
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(row => {
      const id  = _buildAlumniId(row);
      const ref = doc(db, COL.ALUMNI_HISTORIS, id);
      batch.set(ref, { ...row, alumniId: id, sourceFile, importedBy: performedBy }, { merge: true });
    });
    await batch.commit();
    imported += chunk.length;
  }

  await logAudit({
    action:     'import_alumni_historis',
    entityType: 'alumni_historis',
    entityId:   sourceFile,
    metadata:   { count: imported, sourceFile },
  });

  return { imported };
}

/**
 * Ambil sample alumni (untuk preview list setelah import).
 */
export async function listAlumniSample(limitN = 20) {
  const snap = await getDocs(query(
    collection(db, COL.ALUMNI_HISTORIS),
    orderBy('tahun', 'desc'),
    limit(limitN)
  ));
  return snapToArray(snap);
}

/**
 * Statistik ringkas alumni_historis (untuk dashboard section).
 */
export async function getAlumniStats() {
  const snap = await getDocs(collection(db, COL.ALUMNI_HISTORIS));
  const rows  = snapToArray(snap);

  const tahunSet    = new Set();
  const instansiSet = new Set();
  const provinsiCount = {};

  rows.forEach(r => {
    if (r.tahun)     tahunSet.add(r.tahun);
    if (r.instansi)  instansiSet.add(r.instansi);
    if (r.provinsi)  provinsiCount[r.provinsi] = (provinsiCount[r.provinsi] || 0) + 1;
  });

  return {
    totalRows:       rows.length,
    tahunRange:      tahunSet.size ? [Math.min(...tahunSet), Math.max(...tahunSet)] : null,
    totalInstansi:   instansiSet.size,
    provinsiCount,
  };
}

// ─── Kinerja Instansi ─────────────────────────────────────────────────────────

/**
 * Batch import kinerja instansi.
 * DocId = slug instansi (lowercase, spasi → underscore).
 * Merge: re-import aman, tidak menghapus data existing.
 */
export async function batchImportKinerja(rows, sourceFile, performedBy) {
  const BATCH_SIZE = 400;
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(row => {
      const id  = _slugify(row.instansi);
      const ref = doc(db, COL.KINERJA_INSTANSI, id);
      batch.set(ref, { ...row, kinerjaId: id }, { merge: true });
    });
    await batch.commit();
    imported += chunk.length;
  }

  await logAudit({
    action:     'import_kinerja_instansi',
    entityType: 'kinerja_instansi',
    entityId:   sourceFile,
    metadata:   { count: imported, sourceFile },
  });

  return { imported };
}

export async function listKinerjaInstansi() {
  const snap = await getDocs(query(
    collection(db, COL.KINERJA_INSTANSI),
    orderBy('instansi')
  ));
  return snapToArray(snap);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _buildAlumniId(row) {
  // ID deterministik untuk deduplication: tahun+bimtek+peserta+instansi
  const raw = [
    String(row.tahun ?? ''),
    (row.nama_bimtek  ?? '').toLowerCase().trim(),
    (row.nama_peserta ?? '').toLowerCase().trim(),
    (row.instansi     ?? '').toLowerCase().trim(),
  ].join('|');
  return _hashStr(raw);
}

function _slugify(str) {
  return String(str ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// FNV-1a 32-bit hash → hex string (deterministik, tidak butuh crypto)
function _hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

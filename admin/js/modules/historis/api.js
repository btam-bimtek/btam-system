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
 * Statistik lengkap alumni_historis untuk dashboard.
 * Membaca semua dokumen sekali, aggregasi semua dimensi yang diperlukan.
 */
export async function getAlumniStats() {
  const snap = await getDocs(collection(db, COL.ALUMNI_HISTORIS));
  if (snap.empty) return null;

  const rows = snapToArray(snap);

  const pesertaByYear  = {};  // { tahun: jumlah_baris }
  const bimtekByYear   = {};  // { tahun: Set<nama_bimtek> } → unique bimtek per tahun
  const bidangCount    = {};  // { bidang: count }
  const provinsiCount  = {};  // { provinsi: count }
  const instansiCount  = {};  // { instansi: count }

  rows.forEach(r => {
    const yr = r.tahun;
    if (!yr) return;

    // Peserta per tahun
    pesertaByYear[yr] = (pesertaByYear[yr] || 0) + 1;

    // Bimtek unik per tahun (approx: distinct nama_bimtek)
    if (r.nama_bimtek) {
      if (!bimtekByYear[yr]) bimtekByYear[yr] = new Set();
      bimtekByYear[yr].add(r.nama_bimtek.toLowerCase().trim());
    }

    // Bidang
    if (r.bidang) bidangCount[r.bidang] = (bidangCount[r.bidang] || 0) + 1;

    // Provinsi
    if (r.provinsi) provinsiCount[r.provinsi] = (provinsiCount[r.provinsi] || 0) + 1;

    // Instansi
    if (r.instansi) instansiCount[r.instansi] = (instansiCount[r.instansi] || 0) + 1;
  });

  // Convert bimtekByYear Set → count
  const bimtekCountByYear = Object.fromEntries(
    Object.entries(bimtekByYear).map(([yr, s]) => [yr, s.size])
  );

  const years = Object.keys(pesertaByYear).map(Number).filter(Boolean);

  return {
    totalRows:        rows.length,
    tahunRange:       years.length ? [Math.min(...years), Math.max(...years)] : null,
    pesertaByYear,
    bimtekCountByYear,
    bidangCount,
    provinsiCount,
    instansiCount,
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

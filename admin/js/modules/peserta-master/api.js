// admin/js/modules/peserta-master/api.js
// Semua Firestore operation untuk peserta_master.
// UI code tidak boleh call Firestore langsung — harus lewat sini.

import {
  db, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  collection, query, where, orderBy, limit, startAfter,
  serverTimestamp, writeBatch, getCountFromServer,
  snapToArray, snapToDoc
} from '../../../../shared/db.js';
import { auth } from '../../../../shared/firebase-config.js';
import { logAudit } from '../../../../shared/logger.js';
import { normalizePeserta, normalizeNoPeserta } from '../../../../shared/normalize.js';
import { validatePeserta } from '../../../../shared/validate.js';
import { COL } from '../../../../shared/constants.js';

const COL_NAME = COL.PESERTA_MASTER;

// ─── List ─────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string}  [opts.search]     - filter nama (prefix search)
 * @param {string}  [opts.instansiId]
 * @param {number}  [opts.pageSize]   default 25
 * @param {object}  [opts.lastDoc]    - untuk cursor pagination
 * @returns {Promise<{data: object[], lastDoc: object|null}>}
 */
export async function listPeserta({ search = '', instansiId = '', pageSize = 25, lastDoc = null } = {}) {
  let q = query(
    collection(db, COL_NAME),
    where('deleted', '==', false),
    orderBy('nama'),
    limit(pageSize)
  );

  if (instansiId) q = query(q, where('instansiId', '==', instansiId));
  if (lastDoc)    q = query(q, startAfter(lastDoc));

  const snap = await getDocs(q);
  let data = snapToArray(snap);

  // Client-side search (Firestore tidak support full substring search)
  if (search) {
    const s = search.toLowerCase();
    data = data.filter(p =>
      p.nama?.toLowerCase().includes(s) ||
      p.noPeserta?.toLowerCase().includes(s) ||
      p.instansi?.toLowerCase().includes(s)
    );
  }

  return {
    data,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null
  };
}

/**
 * Total count (untuk pagination display).
 */
export async function countPeserta() {
  const snap = await getCountFromServer(
    query(collection(db, COL_NAME), where('deleted', '==', false))
  );
  return snap.data().count;
}

// ─── Get single ───────────────────────────────────────────────

export async function getPeserta(noPeserta) {
  const snap = await getDoc(doc(db, COL_NAME, noPeserta));
  return snapToDoc(snap);
}

// ─── Create ───────────────────────────────────────────────────

export async function createPeserta(rawData) {
  const data = normalizePeserta(rawData);
  const { valid, errors } = validatePeserta(data);
  if (!valid) throw new Error(errors.join(' '));

  // Check duplicate (case-insensitive)
  const existSnap = await getDoc(doc(db, COL_NAME, data.noPeserta));
  if (existSnap.exists() && !existSnap.data().deleted) {
    throw new Error(`Nomor peserta '${data.noPeserta}' sudah terdaftar.`);
  }
  // Cek case-insensitive conflict (noPeserta berbeda case tapi sama normalizednya)
  await _checkNoPesertaConflict(data.noPeserta);

  const payload = {
    ...data,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
    createdBy:  auth.currentUser?.email ?? null,
    deleted:    false,
    deletedAt:  null,
    pendaftarIdOrigin: null,
    tahunSiklusOrigin: null,
  };

  await setDoc(doc(db, COL_NAME, data.noPeserta), payload);

  await logAudit({
    action: 'create_peserta',
    entityType: 'peserta',
    entityId: data.noPeserta,
    metadata: { nama: data.nama }
  });

  return data.noPeserta;
}

// ─── Update ───────────────────────────────────────────────────

export async function updatePeserta(noPeserta, rawData) {
  const data = normalizePeserta({ ...rawData, noPeserta });
  const { valid, errors } = validatePeserta(data);
  if (!valid) throw new Error(errors.join(' '));

  await updateDoc(doc(db, COL_NAME, noPeserta), {
    ...data,
    updatedAt: serverTimestamp()
  });

  await logAudit({
    action: 'update_peserta',
    entityType: 'peserta',
    entityId: noPeserta,
    metadata: { nama: data.nama }
  });
}

// ─── Soft delete ──────────────────────────────────────────────

export async function deletePeserta(noPeserta) {
  await updateDoc(doc(db, COL_NAME, noPeserta), {
    deleted:   true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await logAudit({
    action: 'delete_peserta',
    entityType: 'peserta',
    entityId: noPeserta
  });
}

// ─── Bulk import ──────────────────────────────────────────────

/**
 * Import array peserta dari Excel/CSV.
 * @param {object[]} rows       - sudah dinormalisasi
 * @param {boolean}  skipDupes  - kalau true, duplikat di-skip (tidak error)
 * @returns {Promise<{created: number, skipped: number, errors: object[]}>}
 */
export async function bulkImportPeserta(rows, { skipDupes = false } = {}) {
  let created = 0, skipped = 0;
  const errors = [];
  const BATCH_SIZE = 450; // Firestore max 500, kasih buffer

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = rows.slice(i, i + BATCH_SIZE);

    for (const row of chunk) {
      const data = normalizePeserta(row);
      const { valid, errors: rowErrors } = validatePeserta(data);

      if (!valid) {
        errors.push({ noPeserta: data.noPeserta, nama: data.nama, errors: rowErrors });
        continue;
      }

      const ref = doc(db, COL_NAME, data.noPeserta);
      const existing = await getDoc(ref);

      if (existing.exists() && !existing.data().deleted) {
        if (skipDupes) { skipped++; continue; }
        errors.push({ noPeserta: data.noPeserta, nama: data.nama, errors: ['Duplikat — sudah terdaftar.'] });
        continue;
      }

      batch.set(ref, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: auth.currentUser?.email ?? null,
        deleted: false, deletedAt: null,
        pendaftarIdOrigin: null, tahunSiklusOrigin: null,
      });
      created++;
    }

    await batch.commit();
  }

  await logAudit({
    action: 'bulk_import_peserta',
    entityType: 'peserta',
    metadata: { created, skipped, errorCount: errors.length }
  });

  return { created, skipped, errors };
}

// ─── Export all ───────────────────────────────────────────────

export async function exportAllPeserta() {
  const snap = await getDocs(
    query(collection(db, COL_NAME), where('deleted', '==', false), orderBy('nama'))
  );
  return snapToArray(snap);
}

// ─── Internal ─────────────────────────────────────────────────

async function _checkNoPesertaConflict(noPeserta) {
  // Cek apakah ada dokumen dengan noPeserta yang sama secara case-insensitive
  // Firestore tidak support case-insensitive query, jadi kita store normalized version
  const normalized = normalizeNoPeserta(noPeserta);
  const snap = await getDocs(
    query(collection(db, COL_NAME), where('noPesertaNormalized', '==', normalized), where('deleted', '==', false))
  );
  if (!snap.empty) {
    throw new Error(`Nomor peserta '${noPeserta}' konflik dengan '${snap.docs[0].id}' (case-insensitive).`);
  }
}

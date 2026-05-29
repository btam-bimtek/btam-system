// admin/js/modules/master-uk/api.js
// CRUD untuk collection unit_kompetensi (Master UK Global).

import {
  db, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  collection, query, where, orderBy, limit, startAfter,
  serverTimestamp, getCountFromServer,
  snapToArray, snapToDoc
} from '../../../../shared/db.js';
import { logAudit } from '../../../../shared/logger.js';
import { COL } from '../../../../shared/constants.js';

const COL_NAME = COL.UNIT_KOMPETENSI;

// ─── LIST ─────────────────────────────────────────────────────────────────────

/**
 * List UK dengan opsional filter.
 * @param {object} opts
 * @param {string}   [opts.search]     - filter nama/kode
 * @param {string}   [opts.bidangId]   - filter bidang (array-contains)
 * @param {string}   [opts.status]     - 'aktif' | 'nonaktif' | '' (semua)
 * @param {number}   [opts.pageSize]
 * @param {any}      [opts.lastDoc]
 */
export async function listUK({ search = '', bidangId = '', status = '', pageSize = 50, lastDoc = null } = {}) {
  let q = query(
    collection(db, COL_NAME),
    where('deleted', '==', false),
    orderBy('nama')        // order by nama agar non-SKKNI (kode null) tidak aneh
  );
  if (lastDoc) q = query(q, startAfter(lastDoc), limit(pageSize));
  else q = query(q, limit(pageSize));

  const snap = await getDocs(q);
  let data = snapToArray(snap);

  // Client-side filter
  if (status) data = data.filter(ek => ek.status === status);
  if (bidangId) data = data.filter(ek => !ek.bidangIds?.length || ek.bidangIds.includes(bidangId));
  if (search) {
    const s = search.toLowerCase();
    data = data.filter(ek =>
      ek.kode?.toLowerCase().includes(s) ||
      ek.nama?.toLowerCase().includes(s)
    );
  }

  return { data, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
}

/** Ambil semua UK aktif (untuk picker di bimtek/soal). */
export async function listUKAktif({ bidangId = '' } = {}) {
  const snap = await getDocs(
    query(collection(db, COL_NAME), where('deleted', '==', false), where('status', '==', 'aktif'), orderBy('nama'))
  );
  let data = snapToArray(snap);
  if (bidangId) {
    data = data.filter(ek => !ek.bidangIds?.length || ek.bidangIds.includes(bidangId));
  }
  return data;
}

/** Ambil semua kode UK aktif sebagai Set — untuk validasi di bank soal. */
export async function getUKKodeSet() {
  const snap = await getDocs(
    query(collection(db, COL_NAME), where('deleted', '==', false), where('status', '==', 'aktif'))
  );
  return new Set(snapToArray(snap).map(ek => ek.kode?.toLowerCase()));
}

export async function countUK() {
  const snap = await getCountFromServer(
    query(collection(db, COL_NAME), where('deleted', '==', false))
  );
  return snap.data().count;
}

export async function getUK(id) {
  const snap = await getDoc(doc(db, COL_NAME, id));
  return snapToDoc(snap);
}

/**
 * Ambil beberapa UK by array of doc IDs (bimtek.ukIds menyimpan doc ID).
 * Untuk SKKNI: doc ID = kode.toLowerCase().
 * Untuk non-SKKNI: doc ID bisa kode.toLowerCase() atau Firestore auto-ID.
 * Return map: { docId: ekDoc } + alias { kode.toLowerCase(): ekDoc } jika ada kode.
 */
export async function getUKByKodes(ukIds = []) {
  if (!ukIds.length) return {};
  const uniqueIds = [...new Set(ukIds.map(k => k.toLowerCase()))];
  const snaps = await Promise.all(uniqueIds.map(k => getDoc(doc(db, COL_NAME, k))));
  const map = {};
  snaps.forEach(snap => {
    if (snap.exists()) {
      const d = { id: snap.id, ...snap.data() };
      map[snap.id.toLowerCase()] = d;                   // index by doc ID (selalu ada)
      if (d.kode) map[d.kode.toLowerCase()] = d;        // alias by kode jika ada
    }
  });
  return map;
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createUK(rawData) {
  const data = _normalize(rawData);
  const { valid, errors } = _validate(data);
  if (!valid) throw new Error(errors.join(' '));

  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deleted:   false,
    deletedAt: null,
  };

  let docId;

  if (data.kode) {
    // Kode tersedia (SKKNI atau non-SKKNI dengan kode internal) → pakai sebagai doc ID
    docId = data.kode.toLowerCase();
    const existing = await getDoc(doc(db, COL_NAME, docId));
    if (existing.exists() && !existing.data().deleted) {
      throw new Error(`Kode "${data.kode}" sudah digunakan UK lain.`);
    }
    await setDoc(doc(db, COL_NAME, docId), { ...payload, ukId: docId });
  } else {
    // Non-SKKNI tanpa kode → Firestore auto-generate ID
    const ref = await addDoc(collection(db, COL_NAME), { ...payload, ukId: null });
    docId = ref.id;
  }

  await logAudit({ action: 'create_ek', entityType: 'unit_kompetensi', entityId: docId, metadata: { kode: data.kode, nama: data.nama, isSKKNI: data.isSKKNI } });
  return docId;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateUK(id, rawData) {
  // Kode tidak boleh diubah (karena kode = doc ID)
  const data = _normalize(rawData);
  delete data.kode; // immutable
  const { valid, errors } = _validateUpdate(data);
  if (!valid) throw new Error(errors.join(' '));

  await updateDoc(doc(db, COL_NAME, id), { ...data, updatedAt: serverTimestamp() });
  await logAudit({ action: 'update_ek', entityType: 'unit_kompetensi', entityId: id, metadata: { nama: data.nama } });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteUK(id) {
  await updateDoc(doc(db, COL_NAME, id), {
    deleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await logAudit({ action: 'delete_ek', entityType: 'unit_kompetensi', entityId: id });
}

// ─── BULK IMPORT ──────────────────────────────────────────────────────────────

/**
 * Import batch dari array hasil parse Excel.
 * @param {object[]} rows - sudah dinormalisasi dari import.js
 * @returns {{ imported: number, skipped: number, errors: string[] }}
 */
export async function bulkImportUK(rows) {
  let imported = 0; const errors = [];
  for (const row of rows) {
    try {
      // Import Excel: default isSKKNI = true (UK Excel biasanya dari SKKNI)
      const data = _normalize({ isSKKNI: true, ...row });
      const { valid, errors: errs } = _validate(data);
      if (!valid) { errors.push(`${data.kode || '?'}: ${errs.join(', ')}`); continue; }

      if (!data.kode) { errors.push(`(baris tanpa kode): kode wajib untuk import Excel.`); continue; }

      const id = data.kode.toLowerCase();
      const snap = await getDoc(doc(db, COL_NAME, id));
      if (snap.exists() && !snap.data().deleted) {
        // Update jika sudah ada
        await updateDoc(doc(db, COL_NAME, id), { ...data, updatedAt: serverTimestamp() });
      } else {
        await setDoc(doc(db, COL_NAME, id), {
          ...data, ukId: id,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          deleted: false, deletedAt: null,
        });
      }
      imported++;
    } catch (err) {
      errors.push(`${row.kode || '?'}: ${err.message}`);
    }
  }
  return { imported, skipped: rows.length - imported - errors.length, errors };
}

// ─── INTERNAL ─────────────────────────────────────────────────────────────────

function _normalize(raw) {
  const isSKKNI = raw.isSKKNI !== false && raw.isSKKNI !== 'false'; // default: true
  const kodeRaw = String(raw.kode ?? '').trim().toUpperCase();
  return {
    isSKKNI,
    kode:       kodeRaw || null,         // null jika kosong (non-SKKNI tanpa kode)
    nama:       String(raw.nama ?? '').trim(),
    deskripsi:  raw.deskripsi ? String(raw.deskripsi).trim() : null,
    bidangIds:  Array.isArray(raw.bidangIds) ? raw.bidangIds.filter(Boolean) : [],
    status:     raw.status === 'nonaktif' ? 'nonaktif' : 'aktif',
  };
}

function _validate(data) {
  const errors = [];
  if (data.isSKKNI && !data.kode) errors.push('Kode SKKNI wajib diisi untuk UK dari SKKNI.');
  if (data.kode && !/^[A-Z0-9\-_.]+$/.test(data.kode)) errors.push('Kode hanya boleh huruf kapital, angka, tanda hubung (-), titik (.), atau underscore (_).');
  if (!data.nama) errors.push('Nama UK wajib diisi.');
  return { valid: errors.length === 0, errors };
}

function _validateUpdate(data) {
  const errors = [];
  if ('nama' in data && !data.nama) errors.push('Nama UK tidak boleh kosong.');
  return { valid: errors.length === 0, errors };
}


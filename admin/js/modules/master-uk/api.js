// admin/js/modules/master-uk/api.js
// CRUD untuk collection unit_kompetensi (Master UK Global).

import {
  db, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  collection, query, where, orderBy, limit, startAfter,
  serverTimestamp, getCountFromServer, writeBatch,
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

  // Sync unitKompetensi + ekNama di bank_soal yang mereferensikan UK ini
  // Ambil kode canonical dari doc yang baru diupdate
  if (data.nama) {
    const ukSnap = await getDoc(doc(db, COL_NAME, id));
    const kode   = ukSnap.exists() ? ukSnap.data().kode : null;
    await _syncSoalEkNama(id, kode, data.nama);
  }
}

/**
 * Sync ekNama di bank_soal untuk satu UK (dipanggil setelah updateUK).
 * Query dua kali: lowercase dan uppercase, karena data lama mungkin tidak konsisten.
 * @param {string} ukId  - doc ID UK (= kode.toLowerCase())
 * @param {string} kode  - kode canonical uppercase dari master
 * @param {string} nama  - nama terbaru dari master
 */
async function _syncSoalEkNama(ukId, kode, nama) {
  // Query dengan kedua kemungkinan nilai yang tersimpan
  const variants = [...new Set([ukId, kode, ukId.toUpperCase(), kode?.toLowerCase()].filter(Boolean))];
  const allDocs = [];
  for (const v of variants) {
    const snap = await getDocs(
      query(collection(db, COL.BANK_SOAL),
        where('deleted', '==', false),
        where('unitKompetensi', '==', v)
      )
    );
    snap.docs.forEach(d => {
      if (!allDocs.find(x => x.id === d.id)) allDocs.push(d);
    });
  }
  if (!allDocs.length) return;

  const CHUNK = 500;
  for (let i = 0; i < allDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    allDocs.slice(i, i + CHUNK).forEach(d => {
      batch.update(d.ref, {
        unitKompetensi: kode ?? ukId.toUpperCase(),
        ekNama:         nama,
        updatedAt:      serverTimestamp()
      });
    });
    await batch.commit();
  }
}

/**
 * Sync massal unitKompetensi + ekNama di seluruh bank_soal berdasarkan master UK.
 * Soal yang match → unitKompetensi dinormalisasi ke kode canonical + ekNama diupdate.
 * Soal yang tidak match → dibiarkan.
 * @returns {{ updated: number, skipped: number }}
 */
export async function syncBankSoalUK() {
  // 1. Load semua UK master → map lowercase key → { kode canonical, nama }
  const ukSnap = await getDocs(
    query(collection(db, COL_NAME), where('deleted', '==', false))
  );
  const ukMap = {}; // key lowercase → { kode, nama }
  ukSnap.docs.forEach(d => {
    const data = d.data();
    const entry = { kode: data.kode ?? d.id.toUpperCase(), nama: data.nama };
    if (data.kode) ukMap[data.kode.toLowerCase()] = entry;
    ukMap[d.id.toLowerCase()] = entry;
    // Match by nama juga — untuk soal yang menyimpan nama UK bukan kode
    if (data.nama) ukMap[data.nama.toLowerCase()] = entry;
  });
  // 2. Load semua soal
  const soalSnap = await getDocs(
    query(collection(db, COL.BANK_SOAL), where('deleted', '==', false))
  );

  const toUpdate = soalSnap.docs.filter(d => {
    const uk = d.data().unitKompetensi;
    return uk && ukMap[uk.toLowerCase()] !== undefined;
  });

  // 3. Batch update unitKompetensi (canonical) + ekNama
  let updated = 0;
  const CHUNK = 500;
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const batch = writeBatch(db);
    toUpdate.slice(i, i + CHUNK).forEach(d => {
      const uk    = d.data().unitKompetensi;
      const entry = ukMap[uk.toLowerCase()];
      batch.update(d.ref, {
        unitKompetensi: entry.kode,
        ekNama:         entry.nama,
        updatedAt:      serverTimestamp()
      });
      updated++;
    });
    await batch.commit();
  }

  // 4. Kelompokkan soal yang TIDAK match UK manapun ("asing") untuk direview admin.
  //    Dikelompokkan per nilai unitKompetensi unik (case-insensitive).
  const strayMap = {}; // key lowercase → { value, count, ekNamaSample }
  soalSnap.docs.forEach(d => {
    const uk = d.data().unitKompetensi;
    if (!uk) return;
    if (ukMap[uk.toLowerCase()] !== undefined) return; // sudah match
    const key = uk.toLowerCase();
    if (!strayMap[key]) strayMap[key] = { value: uk, count: 0, ekNamaSample: d.data().ekNama || null };
    strayMap[key].count++;
  });
  const strays = Object.values(strayMap).sort((a, b) => b.count - a.count);

  await logAudit({ action: 'sync_bank_soal_uk', entityType: 'bank_soal', entityId: 'all', metadata: { updated, skipped: soalSnap.size - updated, strayCount: strays.length } });
  return { updated, skipped: soalSnap.size - updated, strays };
}

/**
 * Selesaikan satu grup unitKompetensi "asing" yang ditemukan di bank_soal
 * (nilai yang tidak match UK manapun di Master) sesuai keputusan admin.
 * @param {string} value  - nilai unitKompetensi asli di soal (bukan lowercase)
 * @param {'create'|'map'|'ignore'} action
 * @param {object} [payload]
 * @param {object} [payload.newUK]   - { kode, nama, isSKKNI, bidangIds, status } — untuk action 'create'
 * @param {string} [payload.mapToId] - doc ID UK master tujuan — untuk action 'map'
 * @returns {{ action: string, affected: number, ukId?: string }}
 */
export async function resolveStrayUK(value, action, payload = {}) {
  if (action === 'ignore') {
    await logAudit({ action: 'sync_stray_uk_ignore', entityType: 'bank_soal', entityId: value, metadata: { value } });
    return { action: 'ignore', affected: 0 };
  }

  // Cari semua soal yang memakai nilai ini (persis, case-insensitive lewat query ganda)
  const variants = [...new Set([value, value.toUpperCase(), value.toLowerCase()])];
  const found = [];
  for (const v of variants) {
    const snap = await getDocs(
      query(collection(db, COL.BANK_SOAL), where('deleted', '==', false), where('unitKompetensi', '==', v))
    );
    snap.docs.forEach(d => { if (!found.find(x => x.id === d.id)) found.push(d); });
  }

  let targetKode, targetNama, ukId;

  if (action === 'create') {
    ukId = await createUK(payload.newUK);
    const ukSnap = await getDoc(doc(db, COL_NAME, ukId));
    targetKode = ukSnap.data().kode ?? ukId.toUpperCase();
    targetNama = ukSnap.data().nama;
  } else if (action === 'map') {
    ukId = payload.mapToId;
    const ukSnap = await getDoc(doc(db, COL_NAME, ukId));
    if (!ukSnap.exists()) throw new Error('UK tujuan mapping tidak ditemukan.');
    targetKode = ukSnap.data().kode ?? ukId.toUpperCase();
    targetNama = ukSnap.data().nama;
  } else {
    throw new Error(`Aksi tidak dikenal: ${action}`);
  }

  const CHUNK = 500;
  for (let i = 0; i < found.length; i += CHUNK) {
    const batch = writeBatch(db);
    found.slice(i, i + CHUNK).forEach(d => {
      batch.update(d.ref, { unitKompetensi: targetKode, ekNama: targetNama, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }

  await logAudit({
    action: `sync_stray_uk_${action}`, entityType: 'bank_soal', entityId: value,
    metadata: { value, targetKode, ukId, affected: found.length }
  });

  return { action, affected: found.length, ukId };
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


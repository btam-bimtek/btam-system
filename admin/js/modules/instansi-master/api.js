// admin/js/modules/instansi-master/api.js

import {
  db, doc, getDoc, getDocs, setDoc, updateDoc,
  collection, query, where, orderBy, limit, startAfter,
  serverTimestamp, writeBatch, getCountFromServer,
  snapToArray, snapToDoc
} from '../../../../shared/db.js';
import { auth } from '../../../../shared/firebase-config.js';
import { logAudit } from '../../../../shared/logger.js';
import { normalizeInstansi, slugify } from '../../../../shared/normalize.js';
import { validateInstansi } from '../../../../shared/validate.js';
import { COL } from '../../../../shared/constants.js';

const COL_NAME = COL.INSTANSI_MASTER;

export async function listInstansi({ search = '', pageSize = 25, lastDoc = null } = {}) {
  let q = query(
    collection(db, COL_NAME),
    where('deleted', '==', false),
    orderBy('nama'),
    limit(pageSize)
  );
  if (lastDoc) q = query(q, startAfter(lastDoc));

  const snap = await getDocs(q);
  let data = snapToArray(snap);

  if (search) {
    const s = search.toLowerCase();
    data = data.filter(i =>
      i.nama?.toLowerCase().includes(s) ||
      i.singkatan?.toLowerCase().includes(s) ||
      i.kabKotaKode?.includes(s) ||
      i.namaAlias?.some(a => a.toLowerCase().includes(s))
    );
  }

  return { data, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
}

export async function countInstansi() {
  const snap = await getCountFromServer(
    query(collection(db, COL_NAME), where('deleted', '==', false))
  );
  return snap.data().count;
}

export async function getInstansi(id) {
  const snap = await getDoc(doc(db, COL_NAME, id));
  return snapToDoc(snap);
}

export async function createInstansi(rawData) {
  const id = rawData.instansiId?.trim() || slugify(rawData.nama ?? '');
  const data = normalizeInstansi({ ...rawData, instansiId: id });
  const { valid, errors } = validateInstansi(data);
  if (!valid) throw new Error(errors.join(' '));

  const existing = await getDoc(doc(db, COL_NAME, id));
  if (existing.exists() && !existing.data().deleted)
    throw new Error(`ID instansi '${id}' sudah ada.`);

  await setDoc(doc(db, COL_NAME, id), {
    ...data,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    deleted: false, deletedAt: null
  });
  await logAudit({ action: 'create_instansi', entityType: 'instansi', entityId: id, metadata: { nama: data.nama } });
  return id;
}

export async function updateInstansi(id, rawData) {
  const data = normalizeInstansi({ ...rawData, instansiId: id });
  const { valid, errors } = validateInstansi(data);
  if (!valid) throw new Error(errors.join(' '));

  await updateDoc(doc(db, COL_NAME, id), { ...data, updatedAt: serverTimestamp() });
  await logAudit({ action: 'update_instansi', entityType: 'instansi', entityId: id });
}

export async function deleteInstansi(id) {
  await updateDoc(doc(db, COL_NAME, id), {
    deleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  await logAudit({ action: 'delete_instansi', entityType: 'instansi', entityId: id });
}

export async function exportAllInstansi() {
  const snap = await getDocs(
    query(collection(db, COL_NAME), where('deleted', '==', false), orderBy('nama'))
  );
  return snapToArray(snap);
}

/**
 * Hapus SEMUA dokumen instansi_master (hard delete, tidak soft-delete).
 * Dipakai sebelum replace bersih dari sumber lain.
 */
export async function deleteAllInstansi() {
  const snap = await getDocs(collection(db, COL_NAME));
  const BATCH = 400;
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.docs.length;
}

/**
 * Ganti seluruh isi instansi_master dengan daftar PDAM dari kinerja_instansi
 * (nama_bumd + provinsi). Menghapus semua data instansi_master yang ada sebelumnya.
 */
export async function replaceInstansiFromKinerja() {
  const deleted = await deleteAllInstansi();

  const kinerjaSnap = await getDocs(collection(db, COL.KINERJA_INSTANSI));
  let created = 0;
  const errors = [];
  const rows = kinerjaSnap.docs.map(d => d.data());
  const BATCH = 450;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + BATCH)) {
      const nama = (row.nama_bumd || '').trim();
      if (!nama) continue;
      const id = slugify(nama);
      try {
        const data = normalizeInstansi({ instansiId: id, nama, provinsiKode: row.provinsi || null });
        batch.set(doc(db, COL_NAME, id), {
          ...data,
          kinerjaSource: 'kinerja_instansi',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          deleted: false, deletedAt: null
        });
        created++;
      } catch (e) {
        errors.push({ nama, error: e.message });
      }
    }
    await batch.commit();
  }

  await logAudit({ action: 'replace_instansi_from_kinerja', entityType: 'instansi', metadata: { deleted, created } });
  return { deleted, created, errors };
}

export async function bulkImportInstansi(rows) {
  let created = 0, skipped = 0;
  const errors = [];
  const BATCH = 450;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + BATCH)) {
      const id = row.instansiId?.trim() || slugify(row.nama ?? '');
      const data = normalizeInstansi({ ...row, instansiId: id });
      const { valid, errs } = validateInstansi(data);
      if (!valid) { errors.push({ id, nama: data.nama, errors: errs }); continue; }
      const ref = doc(db, COL_NAME, id);
      const ex = await getDoc(ref);
      if (ex.exists() && !ex.data().deleted) { skipped++; continue; }
      batch.set(ref, {
        ...data,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        deleted: false, deletedAt: null
      });
      created++;
    }
    await batch.commit();
  }
  await logAudit({ action: 'bulk_import_instansi', entityType: 'instansi', metadata: { created, skipped } });
  return { created, skipped, errors };
}

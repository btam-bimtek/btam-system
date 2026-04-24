// admin/js/modules/pengajar-master/api.js

import {
  db, doc, getDoc, getDocs, setDoc, updateDoc,
  collection, query, where, orderBy, limit, startAfter,
  serverTimestamp, writeBatch, getCountFromServer,
  snapToArray, snapToDoc
} from '../../../../shared/db.js';
import { auth } from '../../../../shared/firebase-config.js';
import { logAudit } from '../../../../shared/logger.js';
import { normalizePengajar, generateId } from '../../../../shared/normalize.js';
import { validatePengajar } from '../../../../shared/validate.js';
import { COL } from '../../../../shared/constants.js';

const COL_NAME = COL.PENGAJAR_MASTER;

export async function listPengajar({ search = '', pageSize = 25, lastDoc = null } = {}) {
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
    data = data.filter(p =>
      p.nama?.toLowerCase().includes(s) ||
      p.keahlian?.some(k => k.toLowerCase().includes(s))
    );
  }

  return { data, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
}

export async function countPengajar() {
  const snap = await getCountFromServer(
    query(collection(db, COL_NAME), where('deleted', '==', false))
  );
  return snap.data().count;
}

export async function getPengajar(id) {
  const snap = await getDoc(doc(db, COL_NAME, id));
  return snapToDoc(snap);
}

export async function createPengajar(rawData) {
  const data = normalizePengajar(rawData);
  const { valid, errors } = validatePengajar(data);
  if (!valid) throw new Error(errors.join(' '));

  const id = generateId();
  await setDoc(doc(db, COL_NAME, id), {
    ...data,
    pengajarId: id,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
    deleted:    false,
    deletedAt:  null
  });

  await logAudit({ action: 'create_pengajar', entityType: 'pengajar', entityId: id, metadata: { nama: data.nama } });
  return id;
}

export async function updatePengajar(id, rawData) {
  const data = normalizePengajar(rawData);
  const { valid, errors } = validatePengajar(data);
  if (!valid) throw new Error(errors.join(' '));

  await updateDoc(doc(db, COL_NAME, id), { ...data, updatedAt: serverTimestamp() });
  await logAudit({ action: 'update_pengajar', entityType: 'pengajar', entityId: id, metadata: { nama: data.nama } });
}

export async function deletePengajar(id) {
  await updateDoc(doc(db, COL_NAME, id), {
    deleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  await logAudit({ action: 'delete_pengajar', entityType: 'pengajar', entityId: id });
}

export async function exportAllPengajar() {
  const snap = await getDocs(
    query(collection(db, COL_NAME), where('deleted', '==', false), orderBy('nama'))
  );
  return snapToArray(snap);
}

/**
 * Hitung skor matching pengajar untuk suatu Bimtek.
 * @param {object} pengajar
 * @param {string[]} requiredKeahlian - array keahlian yang dibutuhkan
 * @param {string}   bidangId
 */
export function hitungSkorPengajar(pengajar, requiredKeahlian = [], bidangId = '') {
  const keahlianMatch = requiredKeahlian.filter(k =>
    pengajar.keahlian?.some(pk => pk.toLowerCase().includes(k.toLowerCase()))
  ).length / Math.max(requiredKeahlian.length, 1);

  const bidangBonus = pengajar.bidangUtama?.includes(bidangId) ? 10 : 0;
  const pedagogiContrib = (pengajar.pedagogiScore ?? 0) * 0.30;
  const expContrib = Math.min(pengajar.experienceYears ?? 0, 20) * (20 / 20);

  return Math.round(keahlianMatch * 50 + pedagogiContrib + expContrib + bidangBonus);
}

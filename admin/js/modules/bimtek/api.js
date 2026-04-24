/**
 * bimtek/api.js
 * Lokasi: admin/js/modules/bimtek/api.js
 */

import {
  db,
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, Timestamp,
  snapToArray, snapToDoc
} from '../../../../shared/db.js';
import { logAudit } from '../../../../shared/logger.js';
import { auth } from '../../../../shared/firebase-config.js';

const COL       = 'bimtek';
const COL_MAPEL = 'mapel';
const COL_SESI  = 'sesi';

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS = {
  pretest: 10, posttest: 30, pengajar: 20,
  kehadiran: 20, keaktifan: 10, respek: 10,
  tugas: 0, presentasi: 0
};

export const DEFAULT_THRESHOLDS = {
  kehadiran: [{ min:90, label:'Sangat Baik' },{ min:75, label:'Baik' },{ min:60, label:'Cukup' },{ min:0, label:'Perlu Perhatian' }],
  keaktifan: [{ min:85, label:'Sangat Aktif' },{ min:70, label:'Aktif' },{ min:55, label:'Cukup Aktif' },{ min:0, label:'Perlu Didorong' }],
  respek:    [{ min:85, label:'Sangat Baik' },{ min:70, label:'Baik' },{ min:55, label:'Cukup' },{ min:0, label:'Perlu Perhatian' }]
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateKodeBimtek(tahun) {
  return `BIM-${tahun}-${String(Date.now()).slice(-4)}`;
}

export function validateWeights(weights, hasTugas, hasPresentasi) {
  const keys = ['pretest','posttest','pengajar','kehadiran','keaktifan','respek'];
  if (hasTugas) keys.push('tugas');
  if (hasPresentasi) keys.push('presentasi');
  const sum = keys.reduce((acc, k) => acc + (Number(weights[k]) || 0), 0);
  if (Math.abs(sum - 100) > 0.01) return { valid: false, message: `Total bobot harus 100. Saat ini: ${sum}` };
  return { valid: true };
}

// ─── Bimtek CRUD ──────────────────────────────────────────────────────────────

export async function listBimtek({ statusFilter = null, tipeFilter = null, bidangId = null } = {}) {
  const constraints = [where('deleted','==',false), orderBy('periode.mulai','desc')];
  if (statusFilter) constraints.splice(1, 0, where('status','==',statusFilter));
  if (tipeFilter)   constraints.splice(1, 0, where('tipe','==',tipeFilter));
  const snap = await getDocs(query(collection(db, COL), ...constraints));
  let result = snapToArray(snap);
  if (bidangId) result = result.filter(b => b.bidangIds?.includes(bidangId));
  return result;
}

export async function getBimtek(bimtekId) {
  const snap = await getDoc(doc(db, COL, bimtekId));
  if (!snap.exists()) throw new Error(`Bimtek ${bimtekId} tidak ditemukan`);
  return snapToDoc(snap);
}

export async function createBimtek(data) {
  const wv = validateWeights(data.weights, data.hasTugas, data.hasPresentasi);
  if (!wv.valid) throw new Error(wv.message);

  const payload = {
    nama:             data.nama.trim(),
    kodeBimtek:       generateKodeBimtek(new Date().getFullYear()),
    tipe:             data.tipe,
    mode:             data.mode,
    bidangIds:        data.bidangIds ?? [],
    clientInstansiId: data.clientInstansiId ?? null,
    periode: {
      mulai:   Timestamp.fromDate(new Date(data.periode.mulai)),
      selesai: Timestamp.fromDate(new Date(data.periode.selesai))
    },
    lokasi:           data.lokasi?.trim() ?? '',
    kapasitas:        data.kapasitas ?? (data.mode === 'online' ? 25 : 17),
    pesertaIds:       [],
    pengajarIds:      [],
    kkm:              data.kkm ?? 60,
    weights:          data.weights,
    hasTugas:         data.hasTugas ?? false,
    hasPresentasi:    data.hasPresentasi ?? false,
    preTestExamId:    null,
    postTestExamId:   null,
    reportThresholds: null,
    status:           'draft',
    cancelReason:     null,
    createdAt:        serverTimestamp(),
    updatedAt:        serverTimestamp(),
    createdBy:        auth.currentUser?.email ?? '',
    deleted:          false
  };

  const ref = await addDoc(collection(db, COL), payload);
  await logAudit('create', 'bimtek', ref.id, { nama: payload.nama });
  return { bimtekId: ref.id, ...payload };
}

export async function updateBimtek(bimtekId, fields) {
  if (fields.weights) {
    const existing = snapToDoc(await getDoc(doc(db, COL, bimtekId)));
    const wv = validateWeights(fields.weights, fields.hasTugas ?? existing.hasTugas, fields.hasPresentasi ?? existing.hasPresentasi);
    if (!wv.valid) throw new Error(wv.message);
  }
  if (fields.periode?.mulai && !(fields.periode.mulai instanceof Timestamp))
    fields.periode.mulai = Timestamp.fromDate(new Date(fields.periode.mulai));
  if (fields.periode?.selesai && !(fields.periode.selesai instanceof Timestamp))
    fields.periode.selesai = Timestamp.fromDate(new Date(fields.periode.selesai));

  await updateDoc(doc(db, COL, bimtekId), { ...fields, updatedAt: serverTimestamp() });
  await logAudit('update', 'bimtek', bimtekId, fields);
}

export async function deleteBimtek(bimtekId) {
  await updateDoc(doc(db, COL, bimtekId), { deleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await logAudit('delete', 'bimtek', bimtekId);
}

export async function cancelBimtek(bimtekId, reason) {
  await updateBimtek(bimtekId, { status: 'cancelled', cancelReason: reason ?? null });
}

// ─── Peserta & Pengajar ───────────────────────────────────────────────────────

export async function addPesertaToBimtek(bimtekId, noPesertaList) {
  const existing = new Set((snapToDoc(await getDoc(doc(db, COL, bimtekId)))).pesertaIds ?? []);
  noPesertaList.forEach(np => existing.add(np));
  await updateDoc(doc(db, COL, bimtekId), { pesertaIds: [...existing], updatedAt: serverTimestamp() });
}

export async function removePesertaFromBimtek(bimtekId, noPeserta) {
  const b = snapToDoc(await getDoc(doc(db, COL, bimtekId)));
  await updateDoc(doc(db, COL, bimtekId), { pesertaIds: (b.pesertaIds ?? []).filter(np => np !== noPeserta), updatedAt: serverTimestamp() });
}

export async function addPengajarToBimtek(bimtekId, pengajarIdList) {
  const existing = new Set((snapToDoc(await getDoc(doc(db, COL, bimtekId)))).pengajarIds ?? []);
  pengajarIdList.forEach(id => existing.add(id));
  await updateDoc(doc(db, COL, bimtekId), { pengajarIds: [...existing], updatedAt: serverTimestamp() });
}

// ─── Mapel ────────────────────────────────────────────────────────────────────

export async function listMapel(bimtekId) {
  const snap = await getDocs(query(collection(db, COL, bimtekId, COL_MAPEL), orderBy('urutan','asc')));
  return snapToArray(snap);
}

export async function getMapel(bimtekId, mapelId) {
  const snap = await getDoc(doc(db, COL, bimtekId, COL_MAPEL, mapelId));
  if (!snap.exists()) throw new Error(`Mapel tidak ditemukan`);
  return snapToDoc(snap);
}

export async function createMapel(bimtekId, data) {
  if (!data.pengajarIds.includes(data.pengajarPenilaiId))
    throw new Error('Pengajar penilai harus salah satu dari pengajar pengampu');
  if (!Number.isInteger(Number(data.totalJp)) || data.totalJp < 1 || data.totalJp > 9)
    throw new Error('Total JP harus bilangan bulat antara 1-9');

  const existing = await listMapel(bimtekId);
  const payload = {
    urutan: existing.length + 1,
    nama: data.nama.trim(),
    bidangId: data.bidangId,
    ekIds: data.ekIds ?? null,
    totalJp: Number(data.totalJp),
    pengajarIds: data.pengajarIds,
    pengajarPenilaiId: data.pengajarPenilaiId,
    jadwal: null,
    keterangan: data.keterangan?.trim() ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, COL, bimtekId, COL_MAPEL), payload);
  await addPengajarToBimtek(bimtekId, data.pengajarIds);
  await logAudit('create', 'mapel', docRef.id, { bimtekId, nama: payload.nama });
  return { mapelId: docRef.id, ...payload };
}

export async function updateMapel(bimtekId, mapelId, fields) {
  if (fields.pengajarIds || fields.pengajarPenilaiId) {
    const ex = await getMapel(bimtekId, mapelId);
    const ids = fields.pengajarIds ?? ex.pengajarIds;
    const pid = fields.pengajarPenilaiId ?? ex.pengajarPenilaiId;
    if (!ids.includes(pid)) throw new Error('Pengajar penilai harus salah satu dari pengajar pengampu');
    if (fields.pengajarIds) await addPengajarToBimtek(bimtekId, fields.pengajarIds);
  }
  if (fields.totalJp !== undefined) {
    if (!Number.isInteger(Number(fields.totalJp)) || fields.totalJp < 1 || fields.totalJp > 9)
      throw new Error('Total JP harus bilangan bulat antara 1-9');
    fields.totalJp = Number(fields.totalJp);
  }
  await updateDoc(doc(db, COL, bimtekId, COL_MAPEL, mapelId), { ...fields, updatedAt: serverTimestamp() });
  await logAudit('update', 'mapel', mapelId, { bimtekId });
}

export async function deleteMapel(bimtekId, mapelId) {
  await deleteDoc(doc(db, COL, bimtekId, COL_MAPEL, mapelId));
  const remaining = await listMapel(bimtekId);
  await Promise.all(remaining.map((m, i) =>
    updateDoc(doc(db, COL, bimtekId, COL_MAPEL, m.id), { urutan: i + 1 })
  ));
  await logAudit('delete', 'mapel', mapelId, { bimtekId });
}

export async function reorderMapel(bimtekId, mapelId, direction) {
  const all = await listMapel(bimtekId);
  const idx = all.findIndex(m => m.id === mapelId);
  if (idx === -1) return;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;
  await Promise.all([
    updateDoc(doc(db, COL, bimtekId, COL_MAPEL, all[idx].id),     { urutan: all[swapIdx].urutan }),
    updateDoc(doc(db, COL, bimtekId, COL_MAPEL, all[swapIdx].id), { urutan: all[idx].urutan })
  ]);
}

// ─── Sesi ─────────────────────────────────────────────────────────────────────

export async function listSesi(bimtekId) {
  const snap = await getDocs(query(
    collection(db, COL, bimtekId, COL_SESI),
    orderBy('tanggal','asc'), orderBy('jamMulai','asc')
  ));
  return snapToArray(snap);
}

export async function createSesi(bimtekId, data) {
  const existing = await listSesi(bimtekId);
  const payload = {
    urutan: existing.length + 1,
    tanggal: data.tanggal instanceof Timestamp ? data.tanggal : Timestamp.fromDate(new Date(data.tanggal)),
    jamMulai: data.jamMulai,
    jamSelesai: data.jamSelesai,
    tipe: data.tipe,
    mapelId: data.mapelId ?? null,
    jp: data.jp ?? null,
    keterangan: data.keterangan ?? null
  };
  const docRef = await addDoc(collection(db, COL, bimtekId, COL_SESI), payload);
  return { sesiId: docRef.id, ...payload };
}

export async function clearJadwal(bimtekId) {
  const allSesi = await listSesi(bimtekId);
  await Promise.all(allSesi.map(s => deleteDoc(doc(db, COL, bimtekId, COL_SESI, s.id))));
  const allMapel = await listMapel(bimtekId);
  await Promise.all(allMapel.map(m => updateDoc(doc(db, COL, bimtekId, COL_MAPEL, m.id), { jadwal: null })));
  await logAudit('clear_jadwal', 'bimtek', bimtekId);
}

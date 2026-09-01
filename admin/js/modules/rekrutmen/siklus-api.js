// admin/js/modules/rekrutmen/siklus-api.js

import {
  db, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp
} from '../../../../shared/db.js';
import { snapToArray, snapToDoc } from '../../../../shared/db.js';
import { logAudit } from '../../../../shared/logger.js';
import { COL } from '../../../../shared/constants.js';

// ─── List ────────────────────────────────────────────────────

export async function listSiklus() {
  const snap = await getDocs(
    query(collection(db, COL.SIKLUS_SELEKSI), orderBy('tahun', 'desc'))
  );
  return snapToArray(snap);
}

export async function getSiklus(tahun) {
  const snap = await getDoc(doc(db, COL.SIKLUS_SELEKSI, String(tahun)));
  return snapToDoc(snap);
}

// ─── Create ──────────────────────────────────────────────────

export async function createSiklus(data, adminEmail) {
  const tahun = data.tahun;
  const docRef = doc(db, COL.SIKLUS_SELEKSI, String(tahun));

  const existing = await getDoc(docRef);
  if (existing.exists()) throw new Error(`Siklus tahun ${tahun} sudah ada.`);

  const payload = {
    tahun,
    nama: data.nama || `Seleksi Bimtek BTAM ${tahun}`,
    status: 'planning',

    phases: {
      pendaftaran: {
        start: data.pendaftaranStart ? Timestamp.fromDate(new Date(data.pendaftaranStart)) : null,
        end:   data.pendaftaranEnd   ? Timestamp.fromDate(new Date(data.pendaftaranEnd))   : null,
        published: false
      },
      administrasi: {
        start: data.administrasiStart ? Timestamp.fromDate(new Date(data.administrasiStart)) : null,
        end:   data.administrasiEnd   ? Timestamp.fromDate(new Date(data.administrasiEnd))   : null,
      },
      tertulis: {
        start:   data.tertulisStart ? Timestamp.fromDate(new Date(data.tertulisStart)) : null,
        end:     data.tertulisEnd   ? Timestamp.fromDate(new Date(data.tertulisEnd))   : null,
        examId:  null,
        published: false
      },
      penentuan: {
        deadline:  data.penentuanDeadline ? Timestamp.fromDate(new Date(data.penentuanDeadline)) : null,
        published: false
      }
    },

    // Kuota dan aturan per bimtek (adminRules ada di dalam tiap item bimtekPilihan)
    kuotaBimtek: data.kuotaBimtek || {},

    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: adminEmail
  };

  await setDoc(docRef, payload);
  await logAudit({ action: 'create', entityType: 'siklus_seleksi', entityId: String(tahun), metadata: { tahun } });
  return { id: String(tahun), ...payload };
}

// ─── Update ──────────────────────────────────────────────────

export async function updateSiklus(tahun, changes, adminEmail) {
  const docRef = doc(db, COL.SIKLUS_SELEKSI, String(tahun));

  // Konversi string date ke Timestamp untuk field phases
  const payload = { ...changes, updatedAt: Timestamp.now() };
  _convertPhaseDates(payload);

  await updateDoc(docRef, payload);
  await logAudit({ action: 'update', entityType: 'siklus_seleksi', entityId: String(tahun), metadata: changes });
}

// ─── Delete ──────────────────────────────────────────────────

export async function deleteSiklus(tahun, adminEmail) {
  const docRef = doc(db, COL.SIKLUS_SELEKSI, String(tahun));

  const calonSnap = await getDocs(
    query(collection(db, COL.CALON_PESERTA), where('tahun', '==', tahun))
  );
  if (!calonSnap.empty) {
    throw new Error(`Siklus tahun ${tahun} tidak bisa dihapus: sudah ada ${calonSnap.size} calon peserta terdaftar.`);
  }

  await deleteDoc(docRef);
  await logAudit({ action: 'delete', entityType: 'siklus_seleksi', entityId: String(tahun), metadata: { tahun } });
}

// ─── Status Transition ───────────────────────────────────────

export async function setSiklusStatus(tahun, status, adminEmail) {
  const docRef = doc(db, COL.SIKLUS_SELEKSI, String(tahun));
  await updateDoc(docRef, { status, updatedAt: Timestamp.now() });
  await logAudit({ action: 'status_change', entityType: 'siklus_seleksi', entityId: String(tahun), metadata: { status } });
}

// Buka/tutup pendaftaran publik
export async function togglePendaftaran(tahun, published, adminEmail) {
  const docRef = doc(db, COL.SIKLUS_SELEKSI, String(tahun));
  await updateDoc(docRef, {
    'phases.pendaftaran.published': published,
    updatedAt: Timestamp.now()
  });
  await logAudit({ action: published ? 'buka_pendaftaran' : 'tutup_pendaftaran', entityType: 'siklus_seleksi', entityId: String(tahun) });
}

// ─── Kuota ───────────────────────────────────────────────────

export async function updateKuota(tahun, bimtekPilihan, adminEmail) {
  const docRef = doc(db, COL.SIKLUS_SELEKSI, String(tahun));
  await updateDoc(docRef, { bimtekPilihan, updatedAt: Timestamp.now() });
  await logAudit({ action: 'update_kuota', entityType: 'siklus_seleksi', entityId: String(tahun), metadata: { count: bimtekPilihan.length } });
}

// ─── Exam Tertulis per Bimtek ────────────────────────────────

/** Tautkan/ganti exam seleksi tertulis untuk satu bimtek dalam siklus. */
export async function setExamIdTertulis(tahun, bimtekId, examId, adminEmail) {
  const docRef = doc(db, COL.SIKLUS_SELEKSI, String(tahun));
  const snap   = await getDoc(docRef);
  if (!snap.exists()) throw new Error(`Siklus tahun ${tahun} tidak ditemukan`);

  const bimtekPilihan = (snap.data().bimtekPilihan || []).map(b =>
    b.bimtekId === bimtekId ? { ...b, examIdTertulis: examId } : b
  );

  await updateDoc(docRef, { bimtekPilihan, updatedAt: Timestamp.now() });
  await logAudit({ action: 'set_exam_tertulis', entityType: 'siklus_seleksi', entityId: String(tahun), metadata: { bimtekId, examId } });
}

// ─── Helpers ─────────────────────────────────────────────────

function _convertPhaseDates(payload) {
  const dateFields = [
    'phases.pendaftaran.start', 'phases.pendaftaran.end',
    'phases.administrasi.start', 'phases.administrasi.end',
    'phases.tertulis.start', 'phases.tertulis.end',
    'phases.penentuan.deadline'
  ];
  dateFields.forEach(path => {
    const val = _getPath(payload, path);
    if (val && typeof val === 'string') {
      _setPath(payload, path, Timestamp.fromDate(new Date(val)));
    }
  });
}

function _getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function _setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]]) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

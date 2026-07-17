// admin/js/modules/rekrutmen/calon-api.js

import { db } from '../../../../shared/firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, Timestamp
} from '../../../../shared/db.js';
import { snapToArray } from '../../../../shared/db.js';
import { logAudit } from '../../../../shared/logger.js';
import { COL, PENDIDIKAN_RANK } from '../../../../shared/constants.js';

const PER_PAGE = 30;

// ─── List ────────────────────────────────────────────────────

export async function listCalonPeserta({ tahun, statusAdmin = null, search = '', lastDoc = null } = {}) {
  const constraints = [
    where('tahun', '==', tahun),
    orderBy('submittedAt', 'desc'),
    limit(PER_PAGE)
  ];
  if (statusAdmin) constraints.splice(1, 0, where('statusAdmin', '==', statusAdmin));
  if (lastDoc)     constraints.push(startAfter(lastDoc));

  const snap = await getDocs(query(collection(db, COL.CALON_PESERTA), ...constraints));
  const data = snapToArray(snap);

  // Client-side search (nama / instansi)
  const filtered = search
    ? data.filter(d => {
        const q = search.toLowerCase();
        return d.nama?.toLowerCase().includes(q) || d.instansi?.toLowerCase().includes(q) || d.pendaftarId?.toLowerCase().includes(q);
      })
    : data;

  return { data: filtered, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
}

export async function getCalonPeserta(docId) {
  const snap = await getDoc(doc(db, COL.CALON_PESERTA, docId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ─── status_lookup (salinan ringkas untuk cek status publik) ─

async function _syncStatusLookup(docId, fields) {
  const snap = await getDoc(doc(db, COL.CALON_PESERTA, docId));
  if (!snap.exists()) return;
  const pendaftarId = snap.data().pendaftarId;
  await setDoc(doc(db, COL.STATUS_LOOKUP, pendaftarId), fields, { merge: true });
}

// ─── Seleksi Administrasi ────────────────────────────────────

export async function setStatusAdmin(docId, status, alasan, adminEmail) {
  const ts = Timestamp.now();
  await updateDoc(doc(db, COL.CALON_PESERTA, docId), {
    statusAdmin:       status,
    statusAdminReason: alasan || null,
    updatedAt:         ts
  });
  await _syncStatusLookup(docId, { statusAdmin: status, statusAdminReason: alasan || null, updatedAt: ts });
  await logAudit({ action: 'seleksi_admin', entityType: 'calon_peserta', entityId: docId, metadata: { status, alasan } });
}

/**
 * Terapkan rules administrasi ke semua calon yang masih pending.
 * Rules dievaluasi per bimtek pilihan calon — calon lulus jika memenuhi
 * rules minimal satu bimtek yang ia pilih.
 * @param {Array} bimtekPilihan - dari siklus.bimtekPilihan, masing-masing punya adminRules & larangRepeatBimtek3Tahun
 * @returns {{ lulus: number, gugur: number, errors: string[] }}
 */
export async function applyAdminRules(tahun, bimtekPilihan, adminEmail) {
  const snap = await getDocs(
    query(collection(db, COL.CALON_PESERTA),
      where('tahun', '==', tahun),
      where('statusAdmin', '==', 'pending'))
  );

  // Buat map bimtekId → config aturan untuk lookup cepat
  const bimtekMap = Object.fromEntries((bimtekPilihan || []).map(b => [b.bimtekId, b]));
  const totalRules = (bimtekPilihan || []).reduce((n, b) => n + (b.adminRules?.length || 0), 0);

  let lulus = 0, gugur = 0;
  const errors = [];

  for (const d of snap.docs) {
    const calon   = { id: d.id, ...d.data() };
    const pilihan = calon.pilihanBimtekIds || [];

    let passes = false;
    let reason = 'Tidak memenuhi kriteria administrasi untuk semua pilihan bimtek';

    // Jika tidak ada bimtek pilihan terkonfigurasi, semua lolos (tidak ada aturan)
    if (!bimtekPilihan?.length) {
      passes = true;
    } else {
      for (const bimtekId of pilihan) {
        const bimtek = bimtekMap[bimtekId];
        if (!bimtek) continue;

        const rules = bimtek.adminRules || [];
        if (!_evalRules(calon, rules)) continue;

        if (bimtek.larangRepeatBimtek3Tahun) {
          const repeat = await _pernahTerpilihDiBimtek(calon, bimtekId, tahun);
          if (repeat) {
            reason = `Pernah terpilih di ${bimtek.namaBimtek || bimtekId} pada tahun ${repeat.tahun}`;
            continue;
          }
        }

        passes = true;
        break;
      }
    }

    const ts = Timestamp.now();
    const statusAdmin       = passes ? 'lulus' : 'gugur';
    const statusAdminReason = passes ? null : reason;
    try {
      await updateDoc(doc(db, COL.CALON_PESERTA, d.id), { statusAdmin, statusAdminReason, updatedAt: ts });
      await setDoc(doc(db, COL.STATUS_LOOKUP, calon.pendaftarId), { statusAdmin, statusAdminReason, updatedAt: ts }, { merge: true });
      passes ? lulus++ : gugur++;
    } catch (e) {
      errors.push(`${calon.pendaftarId}: ${e.message}`);
    }
  }

  await logAudit({ action: 'apply_admin_rules', entityType: 'siklus_seleksi', entityId: String(tahun), metadata: { lulus, gugur, totalRules, bimtekCount: (bimtekPilihan||[]).length } });
  return { lulus, gugur, errors };
}

/**
 * Cek apakah pendaftar pernah terpilih (statusFinal='terpilih') di bimtek tertentu
 * dalam 3 tahun terakhir. Pencocokan orang berdasarkan email.
 */
async function _pernahTerpilihDiBimtek(calon, bimtekId, tahun) {
  if (!calon.email) return null;

  const snap = await getDocs(
    query(collection(db, COL.CALON_PESERTA),
      where('email', '==', calon.email),
      where('statusFinal', '==', 'terpilih'),
      where('bimtekIdTerpilih', '==', bimtekId))
  );

  for (const d of snap.docs) {
    const prev = d.data();
    if (prev.tahun >= tahun - 3 && prev.tahun < tahun) {
      return { tahun: prev.tahun, bimtekId };
    }
  }
  return null;
}

/**
 * Bulk update status administrasi untuk sekumpulan docId.
 */
export async function bulkSetStatusAdmin(docIds, status, alasan, adminEmail) {
  const ts = Timestamp.now();
  await Promise.all(docIds.map(async id => {
    await updateDoc(doc(db, COL.CALON_PESERTA, id), {
      statusAdmin: status, statusAdminReason: alasan || null, updatedAt: ts
    });
    await _syncStatusLookup(id, { statusAdmin: status, statusAdminReason: alasan || null, updatedAt: ts });
  }));
  await logAudit({ action: 'bulk_seleksi_admin', entityType: 'calon_peserta', entityId: 'batch', metadata: { count: docIds.length, status } });
}

// ─── Hapus Calon Peserta ──────────────────────────────────────

/**
 * Hapus permanen 1 calon peserta (beserta status_lookup-nya).
 * Hanya untuk pendaftar yang belum/tidak terpilih — gunakan dengan hati-hati,
 * tidak ada cara membatalkan tindakan ini.
 */
export async function deleteCalonPeserta(docId, adminEmail) {
  const snap = await getDoc(doc(db, COL.CALON_PESERTA, docId));
  const pendaftarId = snap.exists() ? snap.data().pendaftarId : null;

  await deleteDoc(doc(db, COL.CALON_PESERTA, docId));
  if (pendaftarId) await deleteDoc(doc(db, COL.STATUS_LOOKUP, pendaftarId)).catch(() => {});

  await logAudit({ action: 'delete', entityType: 'calon_peserta', entityId: docId, metadata: { pendaftarId } });
}

/**
 * Hapus permanen beberapa calon peserta sekaligus.
 */
export async function bulkDeleteCalonPeserta(docIds, adminEmail) {
  for (const id of docIds) {
    await deleteCalonPeserta(id, adminEmail);
  }
}

// ─── Nilai Tertulis ──────────────────────────────────────────

export async function updateNilaiTertulis(docId, nilai, adminEmail) {
  const statusTertulis = nilai >= 60 ? 'lulus' : 'gugur'; // threshold bisa dikonfigurasi
  const ts = Timestamp.now();
  await updateDoc(doc(db, COL.CALON_PESERTA, docId), {
    nilaiTertulis:   nilai,
    statusTertulis:  statusTertulis,
    updatedAt:       ts
  });
  await _syncStatusLookup(docId, { nilaiTertulis: nilai, statusTertulis, updatedAt: ts });
}

// ─── Helpers ─────────────────────────────────────────────────

function _evalRules(calon, rules) {
  for (const rule of rules) {
    let val   = calon[rule.field];
    let cmpTo = rule.value;

    // Pendidikan dievaluasi sebagai syarat ordinal (SMA < D3 < S1 < S2 < S3), bukan string biasa.
    if (rule.field === 'pendidikan') {
      val   = PENDIDIKAN_RANK[val] ?? null;
      cmpTo = PENDIDIKAN_RANK[cmpTo] ?? null;
    }

    switch (rule.operator) {
      case 'eq':     if (val !== cmpTo) return false; break;
      case 'not_eq': if (val === cmpTo) return false; break;
      case 'in':     if (!Array.isArray(cmpTo) || !cmpTo.includes(val)) return false; break;
      case 'gte':    if (val == null || cmpTo == null || val < cmpTo) return false; break;
      case 'lte':    if (val == null || cmpTo == null || val > cmpTo) return false; break;
    }
  }
  return true;
}

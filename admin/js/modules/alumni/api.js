// admin/js/modules/alumni/api.js
// Query gabungan alumni_historis + sistem baru untuk Tab Alumni.

import {
  db, collection, query, where, getDocs, doc, getDoc,
  writeBatch, serverTimestamp, updateDoc,
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';

/**
 * Ambil semua record riwayat keikutsertaan bimtek dari dua sumber.
 * Return: array of normalized record, sudah diurutkan tahun desc.
 */
export async function listRiwayat() {
  const [historis, sistem] = await Promise.all([
    _fetchHistoris(),
    _fetchSistem(),
  ]);
  const all = [...historis, ...sistem];
  all.sort((a, b) => b.tahun - a.tahun || (a.nama ?? '').localeCompare(b.nama ?? '', 'id'));
  return all;
}

// ─── Sumber 1: alumni_historis ────────────────────────────────

async function _fetchHistoris() {
  const snap = await getDocs(collection(db, COL.ALUMNI_HISTORIS));
  return snap.docs.map(d => {
    const r = d.data();
    return {
      _id:         d.id,
      _sumber:     'Historis',
      nama:        r.nama_peserta   ?? null,
      nik:         r.NIK            ?? null,
      instansi:    r.instansi       ?? null,
      kabKota:     r.kab_kota       ?? null,
      provinsi:    r.provinsi       ?? null,
      tahun:       r.tahun          ?? null,
      namaBimtek:  r.nama_bimtek    ?? null,
      bidang:      r.bidang         ?? null,
      tipe:        r.tipe           ?? null,
      // expandable
      jabatan:     r.kelas_jabatan  ?? null,
      pendidikan:  r.pendidikan     ?? null,
      jenisKelamin:r.jenis_kelamin  ?? null,
      mode:        r.mode           ?? null,
      jenisLokasi: r.jenis_lokasi   ?? null,
      tglMulai:    r.tanggal_mulai  ?? null,
      tglSelesai:  r.tanggal_selesai ?? null,
      lulus:       null,
      email:       r.email          ?? null,
      noHp:        r.noHP           ?? null,
    };
  });
}

// ─── Sumber 2: koleksi alumni (dari bimtek completed) ────────

async function _fetchSistem() {
  const snap = await getDocs(collection(db, COL.ALUMNI));
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ─── Sync alumni saat bimtek → completed ─────────────────────

/**
 * Tulis/timpa record alumni untuk semua peserta di bimtek ini.
 * Dipanggil dari bimtek/api.js saat status berubah ke 'completed'.
 */
export async function syncAlumniFromBimtek(bimtek) {
  const pesertaIds = bimtek.pesertaIds ?? [];
  if (!pesertaIds.length) return;

  // Fetch peserta_master (chunk 30)
  const pesertaMap = {};
  for (let i = 0; i < pesertaIds.length; i += 30) {
    const chunk = pesertaIds.slice(i, i + 30);
    const snap  = await getDocs(
      query(collection(db, COL.PESERTA_MASTER), where('noPeserta', 'in', chunk))
    );
    snap.docs.forEach(d => { pesertaMap[d.id] = d.data(); });
  }

  // Fetch bimtek_scores untuk lulus
  const scoresMap = {};
  for (let i = 0; i < pesertaIds.length; i += 30) {
    const chunk = pesertaIds.slice(i, i + 30);
    const snap  = await getDocs(
      query(collection(db, COL.BIMTEK_SCORES),
        where('bimtekId', '==', bimtek.id),
        where('noPeserta', 'in', chunk))
    );
    snap.docs.forEach(d => {
      const s = d.data();
      scoresMap[s.noPeserta] = s.lulus ?? null;
    });
  }

  const tglMulai   = _parseDate(bimtek.periode?.mulai);
  const tglSelesai = _parseDate(bimtek.periode?.selesai);
  const tahun      = tglMulai?.getFullYear() ?? null;

  // Tulis ke koleksi alumni (doc id = bimtekId_noPeserta)
  const BATCH_SIZE = 400; // Firestore max 500 ops per batch
  for (let i = 0; i < pesertaIds.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = pesertaIds.slice(i, i + BATCH_SIZE);
    chunk.forEach(np => {
      const p = pesertaMap[np];
      if (!p) return;
      const ref = doc(db, COL.ALUMNI, `${bimtek.id}_${np}`);
      batch.set(ref, {
        _sumber:     'Sistem',
        noPeserta:   np,
        bimtekId:    bimtek.id,
        nama:        p.nama          ?? null,
        nik:         p.NIK           ?? null,
        instansi:    p.instansi      ?? null,
        kabKota:     p.kabKota       ?? null,
        provinsi:    p.provinsi      ?? null,
        tahun,
        namaBimtek:  bimtek.nama     ?? null,
        bidang:      bimtek.bidangIds?.[0] ?? null,
        tipe:        bimtek.tipe     ?? null,
        jabatan:     p.jabatan       ?? null,
        pendidikan:  p.pendidikan    ?? null,
        jenisKelamin:p.jenisKelamin  ?? null,
        mode:        bimtek.mode     ?? null,
        jenisLokasi: null,
        tglMulai:    tglMulai   ? _fmtDate(tglMulai)   : null,
        tglSelesai:  tglSelesai ? _fmtDate(tglSelesai) : null,
        lulus:       scoresMap[np] ?? null,
        email:       p.email         ?? null,
        noHp:        p.noHp          ?? null,
        syncedAt:    serverTimestamp(),
      });
    });
    await batch.commit();
  }

  // Flag isAlumni di peserta_master
  for (let i = 0; i < pesertaIds.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    pesertaIds.slice(i, i + BATCH_SIZE).forEach(np => {
      batch.update(doc(db, COL.PESERTA_MASTER, np), { isAlumni: true });
    });
    await batch.commit();
  }
}

// ─── Hapus alumni saat bimtek dihapus / di-revert ────────────

/**
 * Hapus semua record alumni dari bimtek ini, dan lepas flag isAlumni
 * pada peserta yang tidak lagi punya record alumni lain.
 */
export async function deleteAlumniByBimtek(bimtekId) {
  const snap = await getDocs(
    query(collection(db, COL.ALUMNI), where('bimtekId', '==', bimtekId))
  );
  if (snap.empty) return;

  const affectedNoPeserta = snap.docs.map(d => d.data().noPeserta);

  // Hapus record alumni
  const BATCH_SIZE = 400;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // Untuk setiap peserta, cek apakah masih punya alumni record lain
  // Firestore 'in' max 30
  for (let i = 0; i < affectedNoPeserta.length; i += 30) {
    const chunk = affectedNoPeserta.slice(i, i + 30);
    const remaining = await getDocs(
      query(collection(db, COL.ALUMNI), where('noPeserta', 'in', chunk))
    );
    const stillAlumni = new Set(remaining.docs.map(d => d.data().noPeserta));

    const toUnset = chunk.filter(np => !stillAlumni.has(np));
    if (!toUnset.length) continue;

    for (let j = 0; j < toUnset.length; j += BATCH_SIZE) {
      const batch = writeBatch(db);
      toUnset.slice(j, j + BATCH_SIZE).forEach(np => {
        batch.update(doc(db, COL.PESERTA_MASTER, np), { isAlumni: false });
      });
      await batch.commit();
    }
  }
}

function _parseDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function _fmtDate(d) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

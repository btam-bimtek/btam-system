// admin/js/modules/alumni/api.js
// Query gabungan alumni_historis + sistem baru untuk Tab Alumni.

import { db, collection, query, where, getDocs, doc, getDoc } from '../../../../shared/db.js';
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

// ─── Sumber 2: sistem baru (bimtek completed) ─────────────────

async function _fetchSistem() {
  // Ambil semua bimtek completed
  const snapBimtek = await getDocs(
    query(collection(db, COL.BIMTEK), where('status', '==', 'completed'))
  );
  if (snapBimtek.empty) return [];

  const bimteks = snapBimtek.docs.map(d => ({ id: d.id, ...d.data() }));

  // Kumpulkan semua noPeserta unik dari bimtek completed
  const pesertaSet = new Set();
  bimteks.forEach(b => (b.pesertaIds ?? []).forEach(np => pesertaSet.add(np)));
  if (!pesertaSet.size) return [];

  // Fetch peserta_master (chunk 30)
  const allIds  = [...pesertaSet];
  const pesertaMap = {};
  for (let i = 0; i < allIds.length; i += 30) {
    const chunk = allIds.slice(i, i + 30);
    const snap  = await getDocs(
      query(collection(db, COL.PESERTA_MASTER), where('noPeserta', 'in', chunk))
    );
    snap.docs.forEach(d => { pesertaMap[d.id] = d.data(); });
  }

  // Fetch bimtek_scores untuk status lulus
  const scoresMap = {}; // `${bimtekId}_${noPeserta}` → lulus
  const snapScores = await getDocs(
    query(collection(db, COL.BIMTEK_SCORES),
      where('bimtekId', 'in', bimteks.map(b => b.id).slice(0, 30))) // Firestore in max 30
  );
  snapScores.docs.forEach(d => {
    const s = d.data();
    scoresMap[`${s.bimtekId}_${s.noPeserta}`] = s.lulus ?? null;
  });

  // Jika bimtek > 30, fetch sisa scores
  if (bimteks.length > 30) {
    for (let i = 30; i < bimteks.length; i += 30) {
      const chunk = bimteks.slice(i, i + 30).map(b => b.id);
      const snap  = await getDocs(
        query(collection(db, COL.BIMTEK_SCORES), where('bimtekId', 'in', chunk))
      );
      snap.docs.forEach(d => {
        const s = d.data();
        scoresMap[`${s.bimtekId}_${s.noPeserta}`] = s.lulus ?? null;
      });
    }
  }

  // Bangun satu record per peserta per bimtek
  const records = [];
  bimteks.forEach(b => {
    const tglMulai   = b.periode?.mulai?.toDate?.() ?? (b.periode?.mulai ? new Date(b.periode.mulai) : null);
    const tglSelesai = b.periode?.selesai?.toDate?.() ?? (b.periode?.selesai ? new Date(b.periode.selesai) : null);
    const tahun      = tglMulai?.getFullYear() ?? null;

    (b.pesertaIds ?? []).forEach(np => {
      const p = pesertaMap[np];
      if (!p) return;
      records.push({
        _id:         `${b.id}_${np}`,
        _sumber:     'Sistem',
        nama:        p.nama         ?? null,
        nik:         p.NIK          ?? null,
        instansi:    p.instansi     ?? null,
        kabKota:     p.kabKota      ?? null,
        provinsi:    p.provinsi     ?? null,
        tahun,
        namaBimtek:  b.nama         ?? null,
        bidang:      b.bidangIds?.[0] ?? null,
        tipe:        b.tipe         ?? null,
        // expandable
        jabatan:     p.jabatan      ?? null,
        pendidikan:  p.pendidikan   ?? null,
        jenisKelamin:p.jenisKelamin ?? null,
        mode:        b.mode         ?? null,
        jenisLokasi: null,
        tglMulai:    tglMulai   ? _fmtDate(tglMulai)   : null,
        tglSelesai:  tglSelesai ? _fmtDate(tglSelesai) : null,
        lulus:       scoresMap[`${b.id}_${np}`] ?? null,
        email:       p.email        ?? null,
        noHp:        p.noHp         ?? null,
      });
    });
  });

  return records;
}

function _fmtDate(d) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

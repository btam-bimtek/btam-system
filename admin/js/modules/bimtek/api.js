// admin/js/modules/bimtek/api.js
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp, writeBatch,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../../../../shared/db.js';
import { logAudit } from '../../../../shared/logger.js';
import { getCurrentUser } from '../../../../shared/auth.js';

const COL = 'bimtek';

// ─── DEFAULT WEIGHTS ────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS = {
  pretest:    0.10,
  posttest:   0.25,
  pengajar:   0.20,
  kehadiran:  0.15,
  keaktifan:  0.10,
  respek:     0.10,
  tugas:      0.05,
  presentasi: 0.05,
};

export const DEFAULT_KKM = 60;

// ─── GENERATE KODE BIMTEK ───────────────────────────────────────────────────

export function generateKodeBimtek(tahun, urutan) {
  const pad = String(urutan).padStart(2, '0');
  return `BIM-${tahun}-${pad}`;
}

// ─── LIST BIMTEK ────────────────────────────────────────────────────────────

export async function listBimtek({ tipe, status, bidangId } = {}) {
  let q = query(
    collection(db, COL),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Client-side filter (Firestore butuh composite index kalau di-chain)
  if (tipe) results = results.filter(b => b.tipe === tipe);
  if (status) results = results.filter(b => b.status === status);
  if (bidangId) results = results.filter(b => b.bidangIds?.includes(bidangId));

  return results;
}

// ─── GET SINGLE BIMTEK ──────────────────────────────────────────────────────

export async function getBimtek(bimtekId) {
  const snap = await getDoc(doc(db, COL, bimtekId));
  if (!snap.exists()) throw new Error('Bimtek tidak ditemukan');
  return { id: snap.id, ...snap.data() };
}

// ─── CREATE BIMTEK ──────────────────────────────────────────────────────────

export async function createBimtek(data) {
  const user = getCurrentUser();
  const kapasitasDefault = data.mode === 'online' ? 25 : 17;

  const payload = {
    nama: data.nama.trim(),
    kodeBimtek: data.kodeBimtek?.trim() || '',
    tipe: data.tipe,
    mode: data.mode,
    bidangIds: data.bidangIds || [],
    clientInstansiId: data.clientInstansiId || null,
    periode: {
      mulai: data.periode.mulai,
      selesai: data.periode.selesai,
    },
    lokasi: data.lokasi?.trim() || '',
    kapasitas: data.kapasitas ?? kapasitasDefault,
    pesertaIds: [],
    pengajarIds: data.pengajarIds || [],
    kkm: data.kkm ?? DEFAULT_KKM,
    weights: data.weights || { ...DEFAULT_WEIGHTS },
    hasTugas: data.hasTugas ?? false,
    hasPresentasi: data.hasPresentasi ?? false,
    preTestExamId: null,
    postTestExamId: null,
    reportThresholds: null,
    status: 'draft',
    cancelReason: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid,
    deleted: false,
  };

  const ref = await addDoc(collection(db, COL), payload);
  await logAudit('bimtek', 'create', ref.id, { nama: payload.nama });
  return ref.id;
}

// ─── UPDATE BIMTEK ──────────────────────────────────────────────────────────

export async function updateBimtek(bimtekId, data) {
  const allowed = [
    'nama', 'kodeBimtek', 'tipe', 'mode', 'bidangIds', 'clientInstansiId',
    'periode', 'lokasi', 'kapasitas', 'pengajarIds', 'kkm', 'weights',
    'hasTugas', 'hasPresentasi', 'reportThresholds', 'status', 'cancelReason',
    'preTestExamId', 'postTestExamId',
  ];
  const payload = {};
  for (const key of allowed) {
    if (key in data) payload[key] = data[key];
  }
  payload.updatedAt = serverTimestamp();

  await updateDoc(doc(db, COL, bimtekId), payload);
  await logAudit('bimtek', 'update', bimtekId, { fields: Object.keys(payload) });
}

// ─── SOFT DELETE BIMTEK ─────────────────────────────────────────────────────

export async function deleteBimtek(bimtekId) {
  await updateDoc(doc(db, COL, bimtekId), {
    deleted: true,
    updatedAt: serverTimestamp(),
  });
  await logAudit('bimtek', 'delete', bimtekId, {});
}

// ─── UPDATE STATUS ──────────────────────────────────────────────────────────

export async function updateStatus(bimtekId, status, cancelReason = null) {
  const validStatuses = ['draft', 'planned', 'ongoing', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) throw new Error(`Status tidak valid: ${status}`);
  await updateDoc(doc(db, COL, bimtekId), {
    status,
    cancelReason: status === 'cancelled' ? (cancelReason || null) : null,
    updatedAt: serverTimestamp(),
  });
  await logAudit('bimtek', 'status_change', bimtekId, { status });
}

// ─── PESERTA ────────────────────────────────────────────────────────────────

export async function addPeserta(bimtekId, noPesertaList) {
  const bimtek = await getBimtek(bimtekId);
  const existing = bimtek.pesertaIds || [];
  const toAdd = noPesertaList.filter(n => !existing.includes(n));
  if (toAdd.length === 0) return;

  const merged = [...existing, ...toAdd];
  await updateDoc(doc(db, COL, bimtekId), {
    pesertaIds: merged,
    updatedAt: serverTimestamp(),
  });
  await logAudit('bimtek', 'peserta_add', bimtekId, { count: toAdd.length });
}

export async function removePeserta(bimtekId, noPeserta) {
  const bimtek = await getBimtek(bimtekId);
  const updated = (bimtek.pesertaIds || []).filter(n => n !== noPeserta);
  await updateDoc(doc(db, COL, bimtekId), {
    pesertaIds: updated,
    updatedAt: serverTimestamp(),
  });
  await logAudit('bimtek', 'peserta_remove', bimtekId, { noPeserta });
}

// ─── MAPEL SUB-COLLECTION ───────────────────────────────────────────────────

export async function listMapel(bimtekId) {
  const snap = await getDocs(
    query(
      collection(db, COL, bimtekId, 'mapel'),
      orderBy('urutan', 'asc')
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMapel(bimtekId, mapelId) {
  const snap = await getDoc(doc(db, COL, bimtekId, 'mapel', mapelId));
  if (!snap.exists()) throw new Error('Mapel tidak ditemukan');
  return { id: snap.id, ...snap.data() };
}

export async function createMapel(bimtekId, data) {
  validateMapel(data);
  const user = getCurrentUser();

  // Hitung urutan berikutnya
  const existing = await listMapel(bimtekId);
  const nextUrutan = existing.length + 1;

  const payload = {
    urutan: nextUrutan,
    nama: data.nama.trim(),
    bidangId: data.bidangId,
    ekIds: data.ekIds || null,
    totalJp: data.totalJp,
    pengajarIds: data.pengajarIds || [],
    pengajarPenilaiId: data.pengajarPenilaiId,
    jadwal: null,
    keterangan: data.keterangan?.trim() || null,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  };

  const ref = await addDoc(collection(db, COL, bimtekId, 'mapel'), payload);
  await logAudit('bimtek_mapel', 'create', `${bimtekId}/${ref.id}`, { nama: payload.nama });
  return ref.id;
}

export async function updateMapel(bimtekId, mapelId, data) {
  validateMapel(data);
  const allowed = [
    'urutan', 'nama', 'bidangId', 'ekIds', 'totalJp',
    'pengajarIds', 'pengajarPenilaiId', 'jadwal', 'keterangan',
  ];
  const payload = {};
  for (const key of allowed) {
    if (key in data) payload[key] = data[key];
  }
  payload.updatedAt = serverTimestamp();

  await updateDoc(doc(db, COL, bimtekId, 'mapel', mapelId), payload);
  await logAudit('bimtek_mapel', 'update', `${bimtekId}/${mapelId}`, {});
}

export async function deleteMapel(bimtekId, mapelId) {
  await deleteDoc(doc(db, COL, bimtekId, 'mapel', mapelId));
  await logAudit('bimtek_mapel', 'delete', `${bimtekId}/${mapelId}`, {});
}

// Reorder urutan mapel setelah delete
export async function reorderMapel(bimtekId) {
  const mapels = await listMapel(bimtekId);
  const batch = writeBatch(db);
  mapels.forEach((m, i) => {
    batch.update(doc(db, COL, bimtekId, 'mapel', m.id), { urutan: i + 1 });
  });
  await batch.commit();
}

// ─── SESI SUB-COLLECTION ────────────────────────────────────────────────────

export async function listSesi(bimtekId) {
  const snap = await getDocs(
    query(
      collection(db, COL, bimtekId, 'sesi'),
      orderBy('urutan', 'asc')
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createSesi(bimtekId, data) {
  const user = getCurrentUser();
  const existing = await listSesi(bimtekId);
  const nextUrutan = existing.length + 1;

  const payload = {
    urutan: nextUrutan,
    tanggal: data.tanggal,
    jamMulai: data.jamMulai,
    jamSelesai: data.jamSelesai,
    tipe: data.tipe, // 'mapel'|'break'|'ishoma'|'pembukaan'|'penutupan'
    mapelId: data.mapelId || null,
    jp: data.jp || null,
    segmenKe: data.segmenKe ?? null,
    totalSegmen: data.totalSegmen ?? null,
    keterangan: data.keterangan || null,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  };

  const ref = await addDoc(collection(db, COL, bimtekId, 'sesi'), payload);
  return ref.id;
}

export async function deleteSesi(bimtekId, sesiId) {
  await deleteDoc(doc(db, COL, bimtekId, 'sesi', sesiId));
}

// Hapus semua segmen sesi dari satu mapel di satu tanggal
export async function deleteSesiByMapel(bimtekId, mapelId, tanggalStr) {
  const all = await listSesi(bimtekId);
  const [y, m, d] = tanggalStr.split('-').map(Number);
  const tglDate = new Date(y, m - 1, d).toDateString();

  const toDelete = all.filter(s => {
    if (s.mapelId !== mapelId) return false;
    const t = s.tanggal?.toDate?.() ?? new Date(s.tanggal);
    return t.toDateString() === tglDate;
  });

  const batch = writeBatch(db);
  toDelete.forEach(s => batch.delete(doc(db, COL, bimtekId, 'sesi', s.id)));
  await batch.commit();
  return toDelete.length;
}

// ─── JADWAL INISIALISASI ─────────────────────────────────────────────────────

// Break templates (internal) — dipakai oleh initSesiHari
const _BR = {
  regular: [
    { tipe: 'break',  jamMulai: '10:15', jamSelesai: '10:30', keterangan: 'Break pagi' },
    { tipe: 'ishoma', jamMulai: '12:00', jamSelesai: '13:00', keterangan: 'ISHOMA' },
    { tipe: 'break',  jamMulai: '14:30', jamSelesai: '14:45', keterangan: 'Break sore' },
  ],
  jumat: [
    { tipe: 'break',  jamMulai: '10:15', jamSelesai: '10:30', keterangan: 'Break pagi' },
    { tipe: 'ishoma', jamMulai: '11:15', jamSelesai: '13:45', keterangan: 'ISHOMA Jumat' },
  ],
};
const _tm = s => { const [h,m] = s.split(':').map(Number); return h*60+m; };
const _ts = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');

/**
 * Inisialisasi 1 hari: buat semua slot (break, ishoma, kosong) sekaligus.
 * Kosong slot = 1 JP per slot, 45 menit.
 * @param {string} tanggalStr - YYYY-MM-DD local
 * @param {number} totalJp    - jumlah JP hari ini (max 9)
 */
export async function initSesiHari(bimtekId, tanggalStr, totalJp) {
  const [y, mo, d] = tanggalStr.split('-').map(Number);
  const dateObj = new Date(y, mo - 1, d);
  const isJumat = dateObj.getDay() === 5;
  const tanggalTs = Timestamp.fromDate(dateObj);

  const breaksTemplate = isJumat ? _BR.jumat : _BR.regular;
  const sortedBreaks = [...breaksTemplate].sort((a, b) => _tm(a.jamMulai) - _tm(b.jamMulai));

  const slots = [];
  let cursor = _tm('08:00');
  let jpCount = 0;
  let bIdx = 0;

  while (jpCount < totalJp) {
    const nb = sortedBreaks[bIdx];
    // Insert break kalau mulainya <= cursor atau memotong slot berikutnya
    if (nb && _tm(nb.jamMulai) <= cursor) {
      slots.push(nb);
      cursor = _tm(nb.jamSelesai);
      bIdx++;
      continue;
    }
    const slotEnd = cursor + 45;
    if (nb && _tm(nb.jamMulai) < slotEnd) {
      slots.push(nb);
      cursor = _tm(nb.jamSelesai);
      bIdx++;
      continue;
    }
    // Tambah slot kosong
    jpCount++;
    slots.push({ tipe: 'kosong', jamMulai: _ts(cursor), jamSelesai: _ts(slotEnd), jp: 1, keterangan: `JP ${jpCount}` });
    cursor = slotEnd;
  }
  // Break yang tersisa (misal break sore muncul setelah JP penuh)
  while (bIdx < sortedBreaks.length) slots.push(sortedBreaks[bIdx++]);

  const user = getCurrentUser();
  const colRef = collection(db, COL, bimtekId, 'sesi');
  const batch = writeBatch(db);
  for (const slot of slots) {
    const ref = doc(colRef);
    batch.set(ref, {
      tanggal: tanggalTs,
      jamMulai: slot.jamMulai,
      jamSelesai: slot.jamSelesai,
      tipe: slot.tipe,
      mapelId: null,
      jp: slot.jp ?? null,
      segmenKe: null,
      totalSegmen: null,
      keterangan: slot.keterangan || null,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  }
  await batch.commit();
  return slots.length;
}

/**
 * Tambah 1 slot kosong di akhir hari.
 * @param {object[]} sesiHariIni - sesi hari ini dari S.sesis (sudah terfilter)
 */
export async function tambahJpKosong(bimtekId, sesiHariIni) {
  const sorted = [...sesiHariIni].sort((a, b) => b.jamSelesai.localeCompare(a.jamSelesai));
  const last = sorted[0];
  if (!last) return;
  const jamMulai   = last.jamSelesai;
  const jamSelesai = _ts(_tm(jamMulai) + 45);
  const jpCount    = sesiHariIni.filter(s => s.tipe === 'kosong').length + 1;
  const user = getCurrentUser();
  await addDoc(collection(db, COL, bimtekId, 'sesi'), {
    tanggal: last.tanggal,
    jamMulai, jamSelesai,
    tipe: 'kosong', mapelId: null, jp: 1,
    segmenKe: null, totalSegmen: null,
    keterangan: `JP ${jpCount}`,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });
}

/**
 * Hapus slot kosong terakhir dari hari ini.
 * Return false kalau slot terakhir bukan tipe kosong.
 */
export async function kurangJpKosong(bimtekId, sesiHariIni) {
  const sorted = [...sesiHariIni].sort((a, b) => b.jamSelesai.localeCompare(a.jamSelesai));
  const last = sorted[0];
  if (!last || last.tipe !== 'kosong') return false;
  await deleteDoc(doc(db, COL, bimtekId, 'sesi', last.id));
  return true;
}

// ─── VALIDASI MAPEL ─────────────────────────────────────────────────────────

export function validateMapel(data) {
  const errors = [];

  if (!data.nama?.trim()) errors.push('Nama mapel wajib diisi');
  if (!data.bidangId) errors.push('Bidang wajib dipilih');
  if (!data.totalJp || data.totalJp < 1 || data.totalJp > 9) {
    errors.push('Total JP harus antara 1-9');
  }
  if (!data.pengajarIds || data.pengajarIds.length === 0) {
    errors.push('Minimal 1 pengajar pengampu');
  }
  if (!data.pengajarPenilaiId) {
    errors.push('Pengajar penilai wajib dipilih');
  }
  if (data.pengajarPenilaiId && !data.pengajarIds?.includes(data.pengajarPenilaiId)) {
    errors.push('Pengajar penilai harus salah satu dari pengajar pengampu');
  }

  if (errors.length > 0) throw new Error(errors.join('; '));
}

// ─── VALIDASI WEIGHTS ───────────────────────────────────────────────────────

/**
 * Validasi total bobot penilaian.
 * Returns { valid: bool, message: string }
 */
export function validateWeights(weights, hasTugas, hasPresentasi) {
  const keys = ['pretest', 'posttest', 'pengajar', 'kehadiran', 'keaktifan', 'respek'];
  if (hasTugas) keys.push('tugas');
  if (hasPresentasi) keys.push('presentasi');

  const total = keys.reduce((sum, k) => sum + (Number(weights[k]) || 0), 0);
  const ok = Math.abs(total - 100) < 0.01;
  return {
    valid: ok,
    message: ok ? '' : `Total bobot harus 100% (sekarang ${total}%)`,
  };
}

// ─── VALIDASI JADWAL ────────────────────────────────────────────────────────

/**
 * Validasi jadwal sebelum disimpan.
 * Returns { valid: bool, errors: string[], warnings: string[] }
 */
export function validateJadwalMapel(mapel, tanggal, jamMulai, jamSelesai, allSesi) {
  const errors = [];
  const warnings = [];

  const date = tanggal instanceof Date ? tanggal : tanggal.toDate();
  const dayOfWeek = date.getDay(); // 0=Minggu, 5=Jumat, 6=Sabtu
  const isJumat = dayOfWeek === 5;

  // Blocker: mapel >7 JP tidak boleh di hari Jumat
  if (isJumat && mapel.totalJp > 7) {
    errors.push(`Mapel "${mapel.nama}" (${mapel.totalJp} JP) tidak bisa dijadwalkan hari Jumat. ISHOMA Jumat 11:15-13:45 membuat waktu aktif terbatas.`);
  }

  // Warning: total JP hari Senin-Kamis > 8
  if (!isJumat) {
    const sesiHariIni = allSesi.filter(s => {
      if (s.tipe !== 'mapel') return false;
      const tgl = s.tanggal instanceof Date ? s.tanggal : s.tanggal.toDate();
      return tgl.toDateString() === date.toDateString();
    });
    const totalJpHariIni = sesiHariIni.reduce((sum, s) => sum + (s.jp || 0), 0);
    if (totalJpHariIni + mapel.totalJp > 8) {
      warnings.push(`Total JP di hari ini akan menjadi ${totalJpHariIni + mapel.totalJp} JP. Hari padat — hati-hati kelelahan peserta.`);
    }
  }

  // Blocker: overlap jam dengan sesi lain di hari yang sama
  const [mulaiH, mulaiM] = jamMulai.split(':').map(Number);
  const [selesaiH, selesaiM] = jamSelesai.split(':').map(Number);
  const mulaiMenit = mulaiH * 60 + mulaiM;
  const selesaiMenit = selesaiH * 60 + selesaiM;

  // Hanya cek overlap dengan mapel/pembukaan/penutupan — bukan break/ISHOMA
  // karena segmen mapel memang sengaja melewati break/ISHOMA
  const sesiHariIniSemua = allSesi.filter(s => {
    if (!['mapel', 'pembukaan', 'penutupan'].includes(s.tipe)) return false;
    const tgl = s.tanggal instanceof Date ? s.tanggal : s.tanggal.toDate();
    return tgl.toDateString() === date.toDateString();
  });

  for (const s of sesiHariIniSemua) {
    const [sH, sM] = s.jamMulai.split(':').map(Number);
    const [eH, eM] = s.jamSelesai.split(':').map(Number);
    const sMenit = sH * 60 + sM;
    const eMenit = eH * 60 + eM;

    const overlap = mulaiMenit < eMenit && selesaiMenit > sMenit;
    if (overlap) {
      errors.push(`Jadwal bertabrakan dengan sesi "${s.keterangan || s.mapelId || s.tipe}" (${s.jamMulai}-${s.jamSelesai})`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── HITUNG JAM SELESAI ─────────────────────────────────────────────────────

/**
 * Hitung jamSelesai berdasarkan jamMulai + totalJp, dengan melewati jeda break/ISHOMA.
 * breaks = [{ mulai: "10:15", selesai: "10:30" }, ...]
 */
/**
 * Hitung segmen-segmen sesi ketika mapel dipecah oleh break/ISHOMA.
 * Return array segmen: [{ jamMulai, jamSelesai, jp }, ...]
 */
export function hitungSegmenMapel(jamMulai, totalJp, breaks = []) {
  const toMenit = (str) => { const [h, m] = str.split(':').map(Number); return h * 60 + m; };
  const toStr = (menit) => {
    const h = Math.floor(menit / 60);
    const m = menit % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  const sortedBreaks = [...breaks].sort((a, b) => toMenit(a.mulai) - toMenit(b.mulai));
  let sisa = totalJp * 45;
  let cursor = toMenit(jamMulai);
  const segmen = [];
  let segStart = cursor;

  while (sisa > 0) {
    const jedaSekarang = sortedBreaks.find(b => toMenit(b.mulai) === cursor);
    if (jedaSekarang) {
      if (cursor > segStart) {
        segmen.push({ jamMulai: toStr(segStart), jamSelesai: toStr(cursor), menitAktif: cursor - segStart });
      }
      cursor = toMenit(jedaSekarang.selesai);
      segStart = cursor;
      continue;
    }
    const nextBreak = sortedBreaks.find(b => toMenit(b.mulai) > cursor);
    if (nextBreak && toMenit(nextBreak.mulai) - cursor < sisa) {
      const menitSebelumBreak = toMenit(nextBreak.mulai) - cursor;
      sisa -= menitSebelumBreak;
      cursor = toMenit(nextBreak.mulai);
      segmen.push({ jamMulai: toStr(segStart), jamSelesai: toStr(cursor), menitAktif: menitSebelumBreak });
      cursor = toMenit(nextBreak.selesai);
      segStart = cursor;
    } else {
      cursor += sisa;
      sisa = 0;
      segmen.push({ jamMulai: toStr(segStart), jamSelesai: toStr(cursor), menitAktif: cursor - segStart });
    }
  }

  const totalMenit = segmen.reduce((s, sg) => s + sg.menitAktif, 0);
  let jpTerpakai = 0;
  return segmen.map((sg, i) => {
    let jp = i === segmen.length - 1
      ? totalJp - jpTerpakai
      : Math.round((sg.menitAktif / totalMenit) * totalJp);
    jpTerpakai += jp;
    return { jamMulai: sg.jamMulai, jamSelesai: sg.jamSelesai, jp };
  });
}

export function hitungJamSelesai(jamMulai, totalJp, breaks = []) {
  const toMenit = (str) => {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  };
  const toStr = (menit) => {
    const h = Math.floor(menit / 60);
    const m = menit % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  let sisa = totalJp * 45; // menit aktif yang harus diisi
  let cursor = toMenit(jamMulai);

  while (sisa > 0) {
    // Cek apakah cursor saat ini kena break
    const jeda = breaks.find(b => toMenit(b.mulai) === cursor);
    if (jeda) {
      cursor = toMenit(jeda.selesai);
      continue;
    }

    // Cek apakah ada break yang dimulai dalam interval berikutnya
    const nextBreak = breaks
      .filter(b => toMenit(b.mulai) > cursor)
      .sort((a, b) => toMenit(a.mulai) - toMenit(b.mulai))[0];

    if (nextBreak && toMenit(nextBreak.mulai) - cursor < sisa) {
      const sebelumBreak = toMenit(nextBreak.mulai) - cursor;
      sisa -= sebelumBreak;
      cursor = toMenit(nextBreak.selesai);
    } else {
      cursor += sisa;
      sisa = 0;
    }
  }

  return toStr(cursor);
}

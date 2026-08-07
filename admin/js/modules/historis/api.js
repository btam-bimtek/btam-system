// admin/js/modules/historis/api.js
// CRUD untuk alumni_historis dan kinerja_instansi.

import {
  db, collection, doc, getDoc, getDocs, setDoc, writeBatch,
  query, orderBy, limit, where, getCountFromServer, snapToArray
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { logAudit } from '../../../../shared/logger.js';

// ─── Alumni Historis ──────────────────────────────────────────────────────────

/**
 * Hitung jumlah dokumen di alumni_historis.
 */
export async function countAlumniHistoris() {
  const snap = await getCountFromServer(collection(db, COL.ALUMNI_HISTORIS));
  return snap.data().count;
}

/**
 * Batch import alumni historis dari array data yang sudah dinormalisasi.
 * Gunakan docId deterministik untuk deduplication.
 * @param {object[]} rows - array dokumen siap simpan (sudah dinormalisasi)
 * @param {string}   sourceFile - nama file Excel sumber
 * @param {string}   performedBy - email admin
 * @returns {{ imported: number, skipped: number }}
 */
export async function batchImportAlumni(rows, sourceFile, performedBy) {
  const BATCH_SIZE = 400; // Firestore max 500 per batch
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(row => {
      const id  = _buildAlumniId(row);
      const ref = doc(db, COL.ALUMNI_HISTORIS, id);
      batch.set(ref, { ...row, alumniId: id, sourceFile, importedBy: performedBy }, { merge: true });
    });
    await batch.commit();
    imported += chunk.length;
  }

  await logAudit({
    action:     'import_alumni_historis',
    entityType: 'alumni_historis',
    entityId:   sourceFile,
    metadata:   { count: imported, sourceFile },
  });

  return { imported };
}

/**
 * Hapus semua dokumen di alumni_historis.
 * @returns {number} jumlah dokumen yang dihapus
 */
export async function clearAlumniHistoris() {
  const snap = await getDocs(collection(db, COL.ALUMNI_HISTORIS));
  if (snap.empty) return 0;
  const BATCH_SIZE = 400;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  await logAudit({
    action:     'clear_alumni_historis',
    entityType: 'alumni_historis',
    entityId:   'all',
    metadata:   { count: snap.docs.length },
  });
  return snap.docs.length;
}

/**
 * Ambil sample alumni (untuk preview list setelah import).
 */
export async function listAlumniSample(limitN = 20) {
  const snap = await getDocs(query(
    collection(db, COL.ALUMNI_HISTORIS),
    orderBy('tahun', 'desc'),
    limit(limitN)
  ));
  return snapToArray(snap);
}

/**
 * Statistik lengkap alumni_historis untuk dashboard.
 * Membaca semua dokumen sekali, aggregasi semua dimensi yang diperlukan.
 */
export async function getAlumniStats() {
  const snap = await getDocs(collection(db, COL.ALUMNI_HISTORIS));
  if (snap.empty) return null;

  const rows = snapToArray(snap);

  const pesertaByYear     = {};  // { tahun: jumlah_baris }
  const bimtekByYear      = {};  // { tahun: Set<nama_bimtek> } → unique bimtek per tahun
  const bidangCount       = {};  // { bidang: count }
  const provinsiCount     = {};  // { provinsi: count }
  const provinsiByYear    = {};  // { tahun: { provinsi: count } }
  const provinsiByYearTipe = { all: {}, reguler: {}, pnbp: {} }; // { tipe: { tahun: { provinsi: count } } }
  const instansiCount     = {};  // { instansi: count }
  const instansiByYearTipe = { all: {}, reguler: {}, pnbp: {} }; // { tipe: { tahun: { instansi: count } } }

  rows.forEach(r => {
    const yr = r.tahun;
    if (!yr) return;

    // Peserta per tahun
    pesertaByYear[yr] = (pesertaByYear[yr] || 0) + 1;

    // Bimtek unik per tahun (approx: distinct nama_bimtek)
    if (r.nama_bimtek) {
      if (!bimtekByYear[yr]) bimtekByYear[yr] = new Set();
      bimtekByYear[yr].add(r.nama_bimtek.toLowerCase().trim());
    }

    // Bidang
    if (r.bidang) bidangCount[r.bidang] = (bidangCount[r.bidang] || 0) + 1;

    // Provinsi (aggregate + per-tahun + per-tipe)
    if (r.provinsi) {
      provinsiCount[r.provinsi] = (provinsiCount[r.provinsi] || 0) + 1;
      if (!provinsiByYear[yr]) provinsiByYear[yr] = {};
      provinsiByYear[yr][r.provinsi] = (provinsiByYear[yr][r.provinsi] || 0) + 1;

      const tipeKey = r.tipe === 'pnbp' ? 'pnbp' : 'reguler';
      for (const key of ['all', tipeKey]) {
        if (!provinsiByYearTipe[key][yr]) provinsiByYearTipe[key][yr] = {};
        provinsiByYearTipe[key][yr][r.provinsi] = (provinsiByYearTipe[key][yr][r.provinsi] || 0) + 1;
      }
    }

    // Instansi (aggregate + per-tahun + per-tipe)
    if (r.instansi) {
      instansiCount[r.instansi] = (instansiCount[r.instansi] || 0) + 1;
      const tipeKey = r.tipe === 'pnbp' ? 'pnbp' : 'reguler';
      for (const key of ['all', tipeKey]) {
        if (!instansiByYearTipe[key][yr]) instansiByYearTipe[key][yr] = {};
        instansiByYearTipe[key][yr][r.instansi] = (instansiByYearTipe[key][yr][r.instansi] || 0) + 1;
      }
    }
  });

  // Convert bimtekByYear Set → count
  const bimtekCountByYear = Object.fromEntries(
    Object.entries(bimtekByYear).map(([yr, s]) => [yr, s.size])
  );

  const years = Object.keys(pesertaByYear).map(Number).filter(Boolean);

  return {
    totalRows:        rows.length,
    tahunRange:       years.length ? [Math.min(...years), Math.max(...years)] : null,
    pesertaByYear,
    bimtekCountByYear,
    bidangCount,
    provinsiCount,
    provinsiByYear,
    provinsiByYearTipe,
    instansiCount,
    instansiByYearTipe,
  };
}

// ─── Export Master Data ───────────────────────────────────────────────────────

/**
 * Kumpulkan semua data untuk export master:
 * (1) alumni_historis — semua record historis
 * (2) bimtek completed — peserta dari sistem baru, dikonversi ke format alumni
 *
 * Return: array of flat objects, kolom sama persis dengan schema alumni_historis.
 */
export async function buildMasterExportRows() {
  // Load paralel
  const [alumniSnap, bimtekSnap] = await Promise.all([
    getDocs(collection(db, COL.ALUMNI_HISTORIS)),
    getDocs(query(collection(db, COL.BIMTEK), where('status', '==', 'completed'))),
  ]);

  const rows = [];

  // (1) Data historis — sudah dalam format yang benar
  alumniSnap.docs.forEach(d => {
    const r = d.data();
    rows.push(_flattenAlumni(r));
  });

  // (2) Data sistem baru — bimtek completed, baca pesertaIds lalu enriched dari peserta_master
  const bimteks = bimtekSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Batch read semua peserta yang terlibat
  const allPesertaIds = [...new Set(bimteks.flatMap(b => b.pesertaIds || []))];
  const pesertaMap    = await _batchGetPeserta(allPesertaIds);

  bimteks.forEach(b => {
    const tahun = b.periode?.mulai
      ? (b.periode.mulai.toDate ? b.periode.mulai.toDate() : new Date(b.periode.mulai)).getFullYear()
      : null;
    if (!tahun) return;

    const bidang = b.bidangIds?.length === 1
      ? b.bidangIds[0]
      : (b.bidangIds?.length > 1 ? 'multi_bidang' : null);

    (b.pesertaIds || []).forEach(noPeserta => {
      const p = pesertaMap[noPeserta];
      if (!p) return; // peserta sudah dihapus dari sistem — jangan ikut dihitung sebagai alumni
      rows.push({
        tahun,
        tanggal_mulai:   _fmtDate(b.periode?.mulai),
        tanggal_selesai: _fmtDate(b.periode?.selesai),
        nama_bimtek:     b.nama  || '',
        bidang:          bidang  || '',
        tipe:            b.tipe  || '',
        mode:            b.mode  || '',
        instansi:        p?.instansi  || '',
        jenis_lokasi:    '',
        provinsi:        p?.provinsi  || '',
        kab_kota:        p?.kabKota   || '',
        nama_peserta:    p?.nama      || noPeserta,
        jabatan:         p?.jabatan   || '',
        kelas_jabatan:   '',
        pendidikan:      p?.pendidikan || '',
        jenis_kelamin:   p?.jenisKelamin || '',
        email:           p?.email  || '',
        noHP:            p?.noHp   || '',
        NIK:             p?.NIK    || '',
        _sumber:         'sistem_baru',
      });
    });
  });

  // Sort: tahun asc, nama_bimtek asc
  rows.sort((a, b) => (a.tahun - b.tahun) || a.nama_bimtek.localeCompare(b.nama_bimtek));
  return rows;
}

function _flattenAlumni(r) {
  return {
    tahun:           r.tahun           ?? '',
    tanggal_mulai:   r.tanggal_mulai   ?? '',
    tanggal_selesai: r.tanggal_selesai ?? '',
    nama_bimtek:     r.nama_bimtek     ?? '',
    bidang:          r.bidang          ?? '',
    tipe:            r.tipe            ?? '',
    mode:            r.mode            ?? '',
    instansi:        r.instansi        ?? '',
    jenis_lokasi:    r.jenis_lokasi    ?? '',
    provinsi:        r.provinsi        ?? '',
    kab_kota:        r.kab_kota        ?? '',
    nama_peserta:    r.nama_peserta    ?? '',
    jabatan:         r.jabatan         ?? '',
    kelas_jabatan:   r.kelas_jabatan   ?? '',
    pendidikan:      r.pendidikan      ?? '',
    jenis_kelamin:   r.jenis_kelamin   ?? '',
    email:           r.email           ?? '',
    noHP:            r.noHP            ?? '',
    NIK:             r.NIK             ?? '',
    _sumber:         'historis',
  };
}

async function _batchGetPeserta(ids) {
  if (!ids.length) return {};
  const snaps = await Promise.all(ids.map(id => getDoc(doc(db, COL.PESERTA_MASTER, id))));
  const map = {};
  snaps.forEach(snap => { if (snap.exists() && !snap.data().deleted) map[snap.id] = snap.data(); });
  return map;
}

function _fmtDate(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

// ─── Kinerja Instansi ─────────────────────────────────────────────────────────

/**
 * Hapus semua dokumen di kinerja_instansi (untuk reset sebelum import ulang).
 * @returns {number} jumlah dokumen yang dihapus
 */
export async function clearKinerjaInstansi() {
  const snap = await getDocs(collection(db, COL.KINERJA_INSTANSI));
  if (snap.empty) return 0;
  const BATCH_SIZE = 400;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.docs.length;
}

/**
 * Batch import kinerja instansi dari CSV BPPSPAM (schema baru).
 * DocId = slug nama_bumd. Selalu set (bukan merge) — panggil clearKinerjaInstansi() dulu.
 */
export async function batchImportKinerja(rows, sourceFile, performedBy) {
  const BATCH_SIZE = 400;
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(row => {
      const id  = _slugifyBumd(row.nama_bumd);
      const ref = doc(db, COL.KINERJA_INSTANSI, id);
      batch.set(ref, { ...row, kinerjaId: id });
    });
    await batch.commit();
    imported += chunk.length;
  }

  await logAudit({
    action:     'import_kinerja_instansi',
    entityType: 'kinerja_instansi',
    entityId:   sourceFile,
    metadata:   { count: imported, sourceFile },
  });

  return { imported };
}

/**
 * Batch import klaster struktural (K-means, riset terpisah) ke field `klaster`
 * pada dokumen kinerja_instansi yang match. Merge (bukan overwrite dokumen),
 * bisa diulang kapan saja kalau cluster di-refresh.
 * @param {{nama: string, cluster: number, nama_klaster: string}[]} rows
 * @returns {{ matched: number, unmatched: string[] }}
 */
export async function batchImportKlaster(rows, sourceFile, performedBy) {
  const snap = await getDocs(collection(db, COL.KINERJA_INSTANSI));
  const exactMap = {};
  const normMap  = {};
  snap.docs.forEach(d => {
    const nama_bumd = d.data().nama_bumd;
    if (!nama_bumd) return;
    exactMap[nama_bumd] = d.ref;
    const nk = _normInstansi(nama_bumd);
    if (nk) normMap[nk] = d.ref;
  });

  const matches   = [];
  const unmatched = [];
  rows.forEach(row => {
    const ref = exactMap[row.nama] || normMap[_normInstansi(row.nama)] || null;
    if (ref) matches.push({ ref, row });
    else     unmatched.push(row.nama);
  });

  const BATCH_SIZE = 400;
  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const chunk = matches.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(({ ref, row }) => {
      batch.set(ref, { klaster: { cluster: row.cluster, nama_klaster: row.nama_klaster } }, { merge: true });
    });
    await batch.commit();
  }

  await logAudit({
    action:     'import_klaster_struktural',
    entityType: 'kinerja_instansi',
    entityId:   sourceFile,
    metadata:   { matched: matches.length, unmatched: unmatched.length, sourceFile, performedBy },
  });

  return { matched: matches.length, unmatched };
}

export async function listKinerjaInstansi() {
  const snap = await getDocs(query(
    collection(db, COL.KINERJA_INSTANSI),
    orderBy('nama_bumd')
  ));
  return snapToArray(snap);
}

// ─── Korelasi ─────────────────────────────────────────────────────────────────

/**
 * Gabungkan alumni_historis + kinerja_instansi untuk analisis korelasi.
 * Join key: normalisasi nama (strip PDAM/PERUMDAM, kabupaten/kota).
 *
 * alumni:  { total, total5yr, eventUnik, byYear, byBidang, byBimtek } | null
 * kinerja: { nama_bumd, wilayah, pulau, byYear, tarif, pelanggan, pegawai } | null
 *   byYear: { "2021": { total, kategori, bobot_keuangan, bobot_pelayanan,
 *                       bobot_operasi, bobot_sdm, nrw, cakupan, ratio_diklat } }
 */
export async function getKorelasiData() {
  const [alumniSnap, kinerjaSnap] = await Promise.all([
    getDocs(collection(db, COL.ALUMNI_HISTORIS)),
    getDocs(collection(db, COL.KINERJA_INSTANSI)),
  ]);

  // Tahun kinerja terbaru — untuk cutoff 5 tahun ke belakang
  const KINERJA_YEARS = [2021, 2022, 2023];
  const LATEST_KINERJA = Math.max(...KINERJA_YEARS);
  const CUTOFF_5YR = LATEST_KINERJA - 4;  // 2019

  // ── Agregasi alumni per instansi ──────────────────────────────
  const alumniMap = {};
  alumniSnap.docs.forEach(d => {
    const r = d.data();
    if (!r.instansi) return;
    if (!alumniMap[r.instansi]) {
      alumniMap[r.instansi] = {
        total: 0, total5yr: 0,
        byYear: {}, byBidang: {}, byBimtek: {},
        byYearBidang: {},
        bimtekEvents: new Set(),
        provinsi: null, kab_kota: null,
      };
    }
    const a = alumniMap[r.instansi];
    a.total++;
    if (r.tahun >= CUTOFF_5YR) a.total5yr++;
    if (r.tahun) a.byYear[r.tahun] = (a.byYear[r.tahun] || 0) + 1;
    if (r.bidang) a.byBidang[r.bidang] = (a.byBidang[r.bidang] || 0) + 1;
    if (r.tahun && r.bidang) {
      if (!a.byYearBidang[r.tahun]) a.byYearBidang[r.tahun] = {};
      a.byYearBidang[r.tahun][r.bidang] = (a.byYearBidang[r.tahun][r.bidang] || 0) + 1;
    }
    if (r.nama_bimtek) {
      a.byBimtek[r.nama_bimtek] = (a.byBimtek[r.nama_bimtek] || 0) + 1;
      a.bimtekEvents.add(`${r.nama_bimtek}|${r.tahun}`);
    }
    if (!a.provinsi  && r.provinsi)  a.provinsi  = r.provinsi;
    if (!a.kab_kota  && r.kab_kota)  a.kab_kota  = r.kab_kota;
  });

  // ── Map kinerja per nama_bumd ──────────────────────────────────
  const kinerjaMap = {};
  kinerjaSnap.docs.forEach(d => {
    const r = d.data();
    if (r.nama_bumd) kinerjaMap[r.nama_bumd] = r;
  });

  // Normalized lookup: normKey → nama_bumd asli
  const kinerjaByNorm = {};
  Object.keys(kinerjaMap).forEach(nama => {
    const key = _normInstansi(nama);
    if (key) kinerjaByNorm[key] = nama;
  });

  const _toKinerja = k => k ? {
    nama_bumd: k.nama_bumd,
    wilayah:   k.wilayah   || null,
    pulau:     k.pulau     || null,
    byYear:    k.kinerja   || {},
    tarif:     k.tarif_rp_m3      ?? null,
    pelanggan: k.jumlah_pelanggan ?? null,
    pegawai:   k.jumlah_pegawai   ?? null,
  } : null;

  // ── Gabungkan ──────────────────────────────────────────────────
  const result = [];
  const usedKinerja = new Set();

  Object.entries(alumniMap).forEach(([nama, a]) => {
    let kNama = kinerjaMap[nama] ? nama : null;
    if (!kNama) {
      const nk = _normInstansi(nama);
      kNama = nk && kinerjaByNorm[nk] ? kinerjaByNorm[nk] : null;
    }
    const k = kNama ? kinerjaMap[kNama] : null;
    if (kNama) usedKinerja.add(kNama);

    result.push({
      instansi:        nama,
      instansiKinerja: kNama,
      provinsi:        a.provinsi || k?.provinsi || null,
      kab_kota:        a.kab_kota || null,
      alumni: {
        total:        a.total,
        total5yr:     a.total5yr,
        eventUnik:    a.bimtekEvents.size,
        byYear:       a.byYear,
        byBidang:     a.byBidang,
        byBimtek:     a.byBimtek,
        byYearBidang: a.byYearBidang,
      },
      kinerja: _toKinerja(k),
    });
  });

  // Kinerja tanpa pasangan alumni
  Object.keys(kinerjaMap).forEach(kNama => {
    if (usedKinerja.has(kNama)) return;
    const k = kinerjaMap[kNama];
    result.push({
      instansi:        kNama,
      instansiKinerja: kNama,
      provinsi:        k.provinsi || null,
      kab_kota:        null,
      alumni:          null,
      kinerja:         _toKinerja(k),
    });
  });

  const matched = result.filter(r => r.alumni && r.kinerja).length;
  console.log('[korelasi] instansi:', result.length, '| matched:', matched);

  result.sort((a, b) => a.instansi.localeCompare(b.instansi, 'id'));
  return result;
}

function _normInstansi(nama) {
  return String(nama ?? '')
    .toLowerCase()
    .replace(/\b(perumdam|pdam|pudam|pd\.?)\b/g, '')
    .replace(/\b(kabupaten|kota|kab\.?|kec\.?)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _buildAlumniId(row) {
  // ID deterministik untuk deduplication: tahun+bimtek+peserta+instansi
  const raw = [
    String(row.tahun ?? ''),
    (row.nama_bimtek  ?? '').toLowerCase().trim(),
    (row.nama_peserta ?? '').toLowerCase().trim(),
    (row.instansi     ?? '').toLowerCase().trim(),
  ].join('|');
  return _hashStr(raw);
}

function _slugify(str) {
  return String(str ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function _slugifyBumd(nama) {
  return String(nama ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

// FNV-1a 32-bit hash → hex string (deterministik, tidak butuh crypto)
function _hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

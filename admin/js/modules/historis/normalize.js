// admin/js/modules/historis/normalize.js
// Normalisasi dan validasi satu baris Excel → format alumni_historis.

import {
  HISTORIS_BIDANG, HISTORIS_TIPE, HISTORIS_MODE, HISTORIS_LOKASI
} from '../../../../shared/constants.js';

// Alias normalisasi — typo / singkatan umum yang mungkin ada di data lama
const _BIDANG_ALIAS = {
  'produksi': 'produksi', 'production': 'produksi',
  'trandis':  'trandis',  'transmisi': 'trandis', 'distribusi': 'trandis', 'trans': 'trandis',
  'me':       'me', 'mekanikal': 'me', 'elektrikal': 'me', 'mekanikal elektrikal': 'me',
  'pendukung': 'pendukung', 'supporting': 'pendukung',
  'multi_bidang': 'multi_bidang', 'multi bidang': 'multi_bidang', 'multibidang': 'multi_bidang',
};

const _TIPE_ALIAS = {
  'reguler': 'reguler', 'regular': 'reguler', 'apbn': 'reguler',
  'pnbp': 'pnbp', 'kerjasama': 'pnbp', 'kerja sama': 'pnbp', 'berbayar': 'pnbp',
  'elearning': 'elearning', 'e-learning': 'elearning', 'e learning': 'elearning', 'daring': 'elearning',
};

const _MODE_ALIAS = {
  'offline': 'offline', 'tatap muka': 'offline', 'luring': 'offline',
  'online': 'online', 'daring': 'online', 'e-learning': 'online', 'elearning': 'online',
};

const _LOKASI_ALIAS = {
  'kabupaten': 'kabupaten', 'kab': 'kabupaten', 'kab_kota': 'kabupaten', 'kab/kota': 'kabupaten',
  'kota': 'kota',
  'regional': 'regional', 'provinsi': 'regional', 'province': 'regional',
  'pusat': 'pusat', 'nasional': 'pusat', 'central': 'pusat',
};

/**
 * Normalisasi satu baris Excel yang sudah di-mapping ke field schema.
 * @param {object} raw - { tahun, nama_bimtek, bidang, tipe, ... }
 * @returns {{ data: object|null, errors: string[] }}
 *   data: dokumen siap simpan (null jika ada error di field wajib)
 *   errors: daftar pesan error/warning
 */
export function normalizeAlumniRow(raw) {
  const errors   = [];  // fatal — baris ditolak
  const warnings = [];  // non-fatal — baris tetap masuk

  // ── Wajib (fatal kalau kosong) ────────────────────────────────
  const tahun = _parseYear(raw.tahun);
  if (!tahun) errors.push('tahun tidak valid atau kosong');

  const nama_peserta = _str(raw.nama_peserta);
  if (!nama_peserta) errors.push('nama_peserta kosong');

  if (errors.length > 0) return { data: null, errors };

  // ── Sangat disarankan (warning kalau kosong) ──────────────────
  const instansi = _str(raw.instansi) || null;
  if (!instansi) warnings.push('instansi kosong');

  const nama_bimtek = _str(raw.nama_bimtek) || null;
  if (!nama_bimtek) warnings.push('nama_bimtek kosong');

  const provinsi = _str(raw.provinsi) || null;
  if (!provinsi) warnings.push('provinsi kosong');

  // ── Opsional — enum (warning hanya kalau ada nilai tapi tidak dikenal) ──
  const bidang = _resolve(raw.bidang, _BIDANG_ALIAS) || null;
  if (_str(raw.bidang) && !bidang)
    warnings.push(`bidang tidak dikenal: "${raw.bidang}"`);

  const tipe = _resolve(raw.tipe, _TIPE_ALIAS) || null;
  if (_str(raw.tipe) && !tipe)
    warnings.push(`tipe tidak dikenal: "${raw.tipe}"`);

  const mode = _resolve(raw.sifat_bimtek ?? raw.mode, _MODE_ALIAS) || null;
  if (_str(raw.sifat_bimtek ?? raw.mode) && !mode)
    warnings.push(`mode tidak dikenal: "${raw.sifat_bimtek ?? raw.mode}"`);

  const jenis_lokasi = _resolve(raw.jenis_lokasi, _LOKASI_ALIAS) || null;
  if (_str(raw.jenis_lokasi) && !jenis_lokasi)
    warnings.push(`jenis_lokasi tidak dikenal: "${raw.jenis_lokasi}"`);

  // ── Opsional lainnya ──────────────────────────────────────────
  const kab_kota       = _str(raw.kab_kota)       || null;
  const tanggal_mulai  = _str(raw.tanggal_mulai)  || null;
  const tanggal_selesai = _str(raw.tanggal_selesai) || null;
  const kelas_jabatan  = _str(raw.kelas_jabatan)  || null;
  const jabatan        = _str(raw.jabatan)         || null;
  const pendidikan     = _normPendidikan(raw.pendidikan);
  const jenis_kelamin  = _normJK(raw.jenis_kelamin);
  const email          = _str(raw.email)           || null;
  const noHP           = _str(raw.noHP || raw.no_hp || raw.nohp) || null;
  const NIK            = _str(raw.NIK  || raw.nik) || null;

  const data = {
    tahun,
    nama_peserta,
    ...(instansi       && { instansi }),
    ...(nama_bimtek    && { nama_bimtek }),
    ...(provinsi       && { provinsi }),
    ...(bidang         && { bidang }),
    ...(tipe           && { tipe }),
    ...(mode           && { mode }),
    ...(jenis_lokasi   && { jenis_lokasi }),
    ...(kab_kota       && { kab_kota }),
    ...(tanggal_mulai  && { tanggal_mulai }),
    ...(tanggal_selesai && { tanggal_selesai }),
    ...(kelas_jabatan  && { kelas_jabatan }),
    ...(jabatan        && { jabatan }),
    ...(pendidikan     && { pendidikan }),
    ...(jenis_kelamin  && { jenis_kelamin }),
    ...(email          && { email }),
    ...(noHP           && { noHP }),
    ...(NIK            && { NIK }),
  };

  return { data, errors: warnings };
}

/**
 * Normalisasi satu baris Excel kinerja PDAM.
 * Format kolom: instansi, provinsi, 2019, 2020, 2021, …, metrik_x_2019, …
 * @param {object} raw - satu baris dari Excel
 * @param {string[]} tahunCols - kolom yang berisi tahun (misal ['2019','2020'])
 * @param {object} metrikCols - { 'layanan': ['layanan_2019','layanan_2020'], ... }
 */
export function normalizeKinerjaRow(raw, tahunCols, metrikCols = {}) {
  const errors = [];

  const instansi = _str(raw.instansi);
  if (!instansi) { errors.push('instansi kosong'); return { data: null, errors }; }

  const provinsi  = _str(raw.provinsi)  || null;
  const kab_kota  = _str(raw.kab_kota || raw.kab || raw.kota) || null;

  // Skor per tahun: { "2019": 3.2, "2020": 4.0, ... }
  // Ekstrak tahun 4-digit dari nama kolom (handle "2019", "2019.0", "Tahun 2019", dll.)
  const skor = {};
  tahunCols.forEach(col => {
    const tahun = String(col).match(/((?:19|20)\d{2})/)?.[1];
    const val   = parseFloat(String(raw[col]).replace(',', '.'));
    if (tahun && !isNaN(val) && val >= 0) skor[tahun] = val;
  });

  // Metrik tambahan (fleksibel)
  const metrik = {};
  Object.entries(metrikCols).forEach(([metrikNama, cols]) => {
    metrik[metrikNama] = {};
    cols.forEach(col => {
      const tahun = col.match(/\d{4}/)?.[0];
      const val   = parseFloat(raw[col]);
      if (tahun && !isNaN(val)) metrik[metrikNama][tahun] = val;
    });
  });

  return {
    data: {
      instansi,
      ...(provinsi  && { provinsi }),
      ...(kab_kota  && { kab_kota }),
      skor,
      ...(Object.keys(metrik).length > 0 && { metrik }),
    },
    errors,
  };
}

/**
 * Normalisasi satu baris CSV kinerja BUMD dari Buku Kinerja BPPSPAM (113 kolom).
 * Tahun tersedia: 2021, 2022, 2023.
 * @param {object} raw - satu baris dari CSV
 * @returns {{ data: object|null, errors: string[] }}
 */
export function normalizeKinerjaBPPSPAM(raw) {
  const errors = [];

  const nama_bumd = _str(raw.nama_bumd);
  if (!nama_bumd) { errors.push('nama_bumd kosong'); return { data: null, errors }; }

  const wilayah  = _str(raw.wilayah)  || null;
  const pulau    = _str(raw.pulau)    || null;
  const provinsi = _str(raw.provinsi) || null;

  const kinerja = {};
  ['2021', '2022', '2023'].forEach(y => {
    const total    = _parseId(raw[`total_kinerja_${y}`]);
    const kategori = _normKategori(raw[`kategori_${y}`]);
    if (total === null && !kategori) return;

    const obj = {};
    if (total    !== null) obj.total           = total;
    if (kategori)          obj.kategori        = kategori;

    const bk = _parseId(raw[`bobot_keuangan_${y}`]);
    const bp = _parseId(raw[`bobot_pelayanan_${y}`]);
    const bo = _parseId(raw[`bobot_operasi_${y}`]);
    const bs = _parseId(raw[`bobot_sdm_${y}`]);
    const nw = _parseId(raw[`nrw_kehilangan_air_${y}`]);
    const ck = _parseId(raw[`cakupan_pelayanan_${y}`]);
    const rd = _parseId(raw[`ratio_diklat_${y}`]);

    if (bk !== null) obj.bobot_keuangan  = bk;
    if (bp !== null) obj.bobot_pelayanan = bp;
    if (bo !== null) obj.bobot_operasi   = bo;
    if (bs !== null) obj.bobot_sdm       = bs;
    if (nw !== null) obj.nrw             = nw;
    if (ck !== null) obj.cakupan         = ck;
    if (rd !== null) obj.ratio_diklat    = rd;

    kinerja[y] = obj;
  });

  const tarif     = _parseId(raw.tarif_rata2_rp_m3);
  const pelanggan = _parseIdInt(raw.pelanggan_domestik_aktif_sr);
  const pegawai   = _parseIdInt(raw.jumlah_pegawai);

  return {
    data: {
      nama_bumd,
      ...(wilayah  && { wilayah }),
      ...(pulau    && { pulau }),
      ...(provinsi && { provinsi }),
      kinerja,
      ...(tarif     !== null && { tarif_rp_m3:      tarif }),
      ...(pelanggan !== null && { jumlah_pelanggan: pelanggan }),
      ...(pegawai   !== null && { jumlah_pegawai:   pegawai }),
    },
    errors,
  };
}

/**
 * Normalisasi satu baris CSV hasil clustering struktural PDAM (K-means, sumber:
 * riset terpisah "Relasi Kinerja PDAM"). Kolom: nama, cluster, nama_klaster.
 * Provisional — lihat docs/superpowers/specs/2026-08-07-klaster-struktural-dampak-design.md.
 * @param {object} raw - satu baris dari CSV
 * @returns {{ data: object|null, errors: string[] }}
 */
export function normalizeKlasterRow(raw) {
  const errors = [];

  const nama = _str(raw.nama);
  if (!nama) { errors.push('nama kosong'); return { data: null, errors }; }

  const cluster = parseInt(raw.cluster, 10);
  if (isNaN(cluster)) { errors.push(`cluster tidak valid: "${raw.cluster}"`); return { data: null, errors }; }

  const nama_klaster = _str(raw.nama_klaster);
  if (!nama_klaster) { errors.push('nama_klaster kosong'); return { data: null, errors }; }

  return { data: { nama, cluster, nama_klaster }, errors };
}

// ─── Helpers internal ────────────────────────────────────────────────────────

function _str(val) {
  const s = String(val ?? '').trim();
  return s === '' || s === '-' || s.toLowerCase() === 'n/a' ? '' : s;
}

function _parseYear(val) {
  const n = parseInt(String(val ?? '').replace(/\D/g, '').slice(0, 4));
  return n >= 1990 && n <= 2100 ? n : null;
}

function _resolve(val, aliasMap) {
  const key = String(val ?? '').toLowerCase().trim();
  return aliasMap[key] ?? null;
}

function _normPendidikan(val) {
  const s = _str(val).toUpperCase();
  const map = {
    'SMA': 'SMA', 'SMK': 'SMA', 'STM': 'SMA', 'SLTA': 'SMA',
    'D1': 'D1', 'D2': 'D2', 'D3': 'D3',
    'D4': 'S1', 'S1': 'S1',
    'S2': 'S2', 'S3': 'S3',
    'SMP': 'SMP', 'SD': 'SD',
  };
  return map[s] || (s ? 'Lainnya' : null);
}

function _normJK(val) {
  const s = String(val ?? '').trim().toUpperCase().slice(0, 1);
  if (s === 'L' || s === 'M') return 'L';
  if (s === 'P' || s === 'F' || s === 'W') return 'P';
  return null;
}

/**
 * Parse angka format Indonesia:
 *   koma=desimal, titik=ribuan, %=bagi100, (x)=negatif, "-"=null
 * Contoh: "27,83%" → 0.2783 | "8.654" → 8654 | "(409.619)" → -409619
 *
 * SheetJS auto-parse: nilai unquoted di CSV (mis. "3.11") → JS number 3.11.
 * Kalau sudah jadi number, kembalikan langsung tanpa re-parse.
 */
function _parseId(val) {
  // SheetJS sudah parse jadi number — kembalikan apa adanya
  if (typeof val === 'number') return isNaN(val) ? null : val;

  const s = String(val ?? '').trim();
  if (!s || s === '-') return null;

  const isNeg = s.startsWith('(') && s.endsWith(')');
  const isPct = s.includes('%');

  let clean = s.replace('%', '').trim();
  if (isNeg) clean = clean.slice(1, -1).trim();

  let num;
  if (clean.includes(',')) {
    // Ada koma → koma=desimal, titik=ribuan  (format Indonesia standar)
    num = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  } else {
    const dots = (clean.match(/\./g) || []).length;
    if (dots > 1) {
      // Banyak titik → semua ribuan: "1.234.567" → 1234567
      num = parseFloat(clean.replace(/\./g, ''));
    } else if (dots === 1) {
      const afterDot = clean.split('.')[1] || '';
      if (afterDot.length === 3) {
        // Tepat 3 digit setelah titik → ribuan Indonesia: "8.654" → 8654
        num = parseFloat(clean.replace(/\./g, ''));
      } else {
        // 1–2 digit setelah titik → desimal: "3.11" → 3.11
        num = parseFloat(clean);
      }
    } else {
      num = parseFloat(clean);
    }
  }

  if (isNaN(num)) return null;
  const result = isNeg ? -num : num;
  return isPct ? result / 100 : result;
}

function _parseIdInt(val) {
  const n = _parseId(val);
  return n !== null ? Math.round(n) : null;
}

function _normKategori(val) {
  const s = String(val ?? '').trim().toUpperCase();
  if (s === 'SEHAT') return 'SEHAT';
  if (s.startsWith('KURANG')) return 'KURANG SEHAT';
  if (s === 'SAKIT') return 'SAKIT';
  return null;
}

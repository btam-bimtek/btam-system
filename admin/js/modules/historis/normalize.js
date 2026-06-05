// admin/js/modules/historis/normalize.js
// Normalisasi dan validasi satu baris Excel → format alumni_historis.

import {
  HISTORIS_BIDANG, HISTORIS_TIPE, HISTORIS_SIFAT, HISTORIS_LOKASI
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
};

const _SIFAT_ALIAS = {
  'tatap muka': 'tatap muka', 'offline': 'tatap muka', 'luring': 'tatap muka',
  'online': 'online', 'daring': 'online', 'e-learning': 'online', 'elearning': 'online',
};

const _LOKASI_ALIAS = {
  'kab_kota': 'kab_kota', 'kabupaten': 'kab_kota', 'kota': 'kab_kota', 'kab/kota': 'kab_kota',
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
  const errors = [];

  // ── Grup A (wajib) ────────────────────────────────────────────
  const tahun = _parseYear(raw.tahun);
  if (!tahun) errors.push('tahun tidak valid atau kosong');

  const nama_bimtek = _str(raw.nama_bimtek);
  if (!nama_bimtek) errors.push('nama_bimtek kosong');

  const nama_peserta = _str(raw.nama_peserta);
  if (!nama_peserta) errors.push('nama_peserta kosong');

  const instansi = _str(raw.instansi);
  if (!instansi) errors.push('instansi kosong');

  const provinsi = _str(raw.provinsi);
  // provinsi boleh kosong untuk jenis_lokasi=pusat

  const kab_kota = _str(raw.kab_kota) || null;

  const bidang = _resolve(raw.bidang, _BIDANG_ALIAS);
  if (!bidang) errors.push(`bidang tidak dikenal: "${raw.bidang}" — gunakan: ${HISTORIS_BIDANG.join(', ')}`);

  const tipe = _resolve(raw.tipe, _TIPE_ALIAS);
  if (!tipe) errors.push(`tipe tidak dikenal: "${raw.tipe}" — gunakan: ${HISTORIS_TIPE.join(', ')}`);

  const sifat_bimtek = _resolve(raw.sifat_bimtek, _SIFAT_ALIAS) || null;
  // sifat_bimtek boleh kosong (data lama mungkin tidak ada)

  const jenis_lokasi = _resolve(raw.jenis_lokasi, _LOKASI_ALIAS) || null;

  // Jika ada error di field wajib → tolak baris
  const fatalErrors = errors.filter(e =>
    e.includes('tahun') || e.includes('nama_bimtek') ||
    e.includes('nama_peserta') || e.includes('instansi')
  );
  if (fatalErrors.length > 0) return { data: null, errors };

  // ── Grup B (opsional) ─────────────────────────────────────────
  const tanggal_mulai  = _str(raw.tanggal_mulai)  || null;
  const tanggal_selesai = _str(raw.tanggal_selesai) || null;
  const kelas_jabatan  = _str(raw.kelas_jabatan)  || null;
  const jabatan        = _str(raw.jabatan)         || null;
  const pendidikan     = _normPendidikan(raw.pendidikan);
  const jenis_kelamin  = _normJK(raw.jenis_kelamin);

  // ── Grup C (simpan apa adanya) ────────────────────────────────
  const email = _str(raw.email) || null;
  const noHP  = _str(raw.noHP || raw.no_hp || raw.nohp) || null;
  const NIK   = _str(raw.NIK  || raw.nik)  || null;

  const data = {
    tahun,
    nama_bimtek,
    bidang,
    tipe,
    ...(sifat_bimtek  && { sifat_bimtek }),
    ...(jenis_lokasi  && { jenis_lokasi }),
    instansi,
    provinsi: provinsi || null,
    kab_kota,
    nama_peserta,
    ...(tanggal_mulai   && { tanggal_mulai }),
    ...(tanggal_selesai && { tanggal_selesai }),
    ...(kelas_jabatan   && { kelas_jabatan }),
    ...(jabatan         && { jabatan }),
    ...(pendidikan      && { pendidikan }),
    ...(jenis_kelamin   && { jenis_kelamin }),
    ...(email           && { email }),
    ...(noHP            && { noHP }),
    ...(NIK             && { NIK }),
  };

  return { data, errors };
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

  const provinsi = _str(raw.provinsi) || null;

  // Skor per tahun: { "2019": 3.2, "2020": 4.0, ... }
  const skor = {};
  tahunCols.forEach(col => {
    const val = parseFloat(raw[col]);
    if (!isNaN(val) && val >= 0) skor[col] = val;
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
      ...(provinsi && { provinsi }),
      skor,
      ...(Object.keys(metrik).length > 0 && { metrik }),
    },
    errors,
  };
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

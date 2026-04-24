// shared/validate.js
// Validasi data sebelum disimpan. Return { valid: boolean, errors: string[] }.
// Semua fungsi pure — tidak ada Firestore call.

import { PENDIDIKAN_OPTIONS, BIDANG_LIST } from './constants.js';
import { normalizeNoPeserta } from './normalize.js';

// ─── Peserta ─────────────────────────────────────────────────

export function validatePeserta(data) {
  const errors = [];

  if (!data.noPeserta?.trim())
    errors.push('Nomor Peserta wajib diisi.');
  else if (data.noPeserta.trim().length > 50)
    errors.push('Nomor Peserta maksimal 50 karakter.');

  if (!data.nama?.trim())
    errors.push('Nama wajib diisi.');
  else if (data.nama.trim().length < 2)
    errors.push('Nama minimal 2 karakter.');

  if (data.jenisKelamin && !['L','P'].includes(data.jenisKelamin))
    errors.push('Jenis kelamin tidak valid (L/P).');

  if (data.pendidikan && !PENDIDIKAN_OPTIONS.includes(data.pendidikan))
    errors.push(`Pendidikan tidak valid. Pilihan: ${PENDIDIKAN_OPTIONS.join(', ')}.`);

  if (data.email && !_isValidEmail(data.email))
    errors.push('Format email tidak valid.');

  if (data.noHp && !/^[\d\s+\-().]{6,20}$/.test(data.noHp))
    errors.push('Format nomor HP tidak valid.');

  return { valid: errors.length === 0, errors };
}

// ─── Pengajar ─────────────────────────────────────────────────

export function validatePengajar(data) {
  const errors = [];

  if (!data.nama?.trim())
    errors.push('Nama wajib diisi.');

  if (!data.noHp?.trim())
    errors.push('Nomor HP wajib diisi (untuk outreach WhatsApp).');
  else if (!/^[\d\s+\-().]{6,20}$/.test(data.noHp))
    errors.push('Format nomor HP tidak valid.');

  if (data.email && !_isValidEmail(data.email))
    errors.push('Format email tidak valid.');

  if (data.pedagogiScore < 0 || data.pedagogiScore > 100)
    errors.push('Skor pedagogi harus antara 0-100.');

  if (data.experienceYears < 0)
    errors.push('Tahun pengalaman tidak boleh negatif.');

  const validBidang = BIDANG_LIST.map(b => b.bidangId);
  for (const b of (data.bidangUtama ?? [])) {
    if (!validBidang.includes(b))
      errors.push(`Bidang '${b}' tidak valid.`);
  }

  return { valid: errors.length === 0, errors };
}

// ─── Instansi ─────────────────────────────────────────────────

const VALID_KATEGORI = ['PDAM','PERUMDAM','PERUMDA','PT','UPTD','Dinas PUPR','Pusat','Regional','Lainnya'];
const VALID_JENIS_LOKASI = ['Kabupaten','Kota','Pusat','Regional'];

export function validateInstansi(data) {
  const errors = [];

  if (!data.instansiId?.trim())
    errors.push('ID Instansi wajib diisi.');
  else if (!/^[a-z0-9-_]+$/.test(data.instansiId))
    errors.push('ID Instansi hanya boleh huruf kecil, angka, tanda hubung, dan underscore.');

  if (!data.nama?.trim())
    errors.push('Nama instansi wajib diisi.');

  if (data.kategori && !VALID_KATEGORI.includes(data.kategori))
    errors.push(`Kategori tidak valid. Pilihan: ${VALID_KATEGORI.join(', ')}.`);

  if (data.jenisLokasi && !VALID_JENIS_LOKASI.includes(data.jenisLokasi))
    errors.push(`Jenis lokasi tidak valid. Pilihan: ${VALID_JENIS_LOKASI.join(', ')}.`);

  return { valid: errors.length === 0, errors };
}

// ─── Admin User ───────────────────────────────────────────────

export function validateAdminUser(data) {
  const errors = [];

  if (!data.email?.trim())
    errors.push('Email wajib diisi.');
  else if (!_isValidEmail(data.email))
    errors.push('Format email tidak valid.');

  if (!data.nama?.trim())
    errors.push('Nama wajib diisi.');

  if (!['superadmin','admin','viewer'].includes(data.role))
    errors.push('Role tidak valid.');

  return { valid: errors.length === 0, errors };
}

// ─── Import row (bulk) ────────────────────────────────────────

/**
 * Validasi satu row hasil import Excel/CSV.
 * Return { valid, errors, rowIndex } — rowIndex untuk pesan error ke user.
 */
export function validateImportRowPeserta(raw, rowIndex) {
  const result = validatePeserta(raw);
  return { ...result, rowIndex, noPeserta: raw.noPeserta };
}

// ─── Internal ─────────────────────────────────────────────────

function _isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// shared/normalize.js
// Normalisasi data sebelum disimpan ke Firestore.
// Semua fungsi pure — tidak ada side effect, tidak ada Firestore call.

import { PENDIDIKAN_OPTIONS } from './constants.js';

// ─── noPeserta ───────────────────────────────────────────────

/**
 * Normalize noPeserta untuk keperluan matching (case-insensitive, trim).
 * Preserve case untuk display — gunakan ini HANYA untuk perbandingan.
 */
export function normalizeNoPeserta(val) {
  return String(val ?? '').trim().toUpperCase();
}

/**
 * Cek apakah dua noPeserta merujuk peserta yang sama.
 */
export function isSamePeserta(a, b) {
  return normalizeNoPeserta(a) === normalizeNoPeserta(b);
}

// ─── Peserta ─────────────────────────────────────────────────

/**
 * Normalize satu row data peserta (dari form atau import CSV/Excel).
 * Return object siap simpan ke Firestore — semua field opsional → null kalau kosong.
 */
export function normalizePeserta(raw) {
  return {
    noPeserta:    String(raw.noPeserta ?? '').trim(),
    nama:         String(raw.nama ?? '').trim(),
    jenisKelamin: _normalizeJK(raw.jenisKelamin),
    jabatan:      _str(raw.jabatan),
    pendidikan:   _normalizePendidikan(raw.pendidikan),
    email:        _email(raw.email),
    noHp:         _str(raw.noHp),
    instansiId:   _str(raw.instansiId),
    instansi:     _str(raw.instansi),
    unitKerja:    _str(raw.unitKerja),
    provinsiKode: _str(raw.provinsiKode),
    provinsi:     _str(raw.provinsi),
    kabKotaKode:  _str(raw.kabKotaKode),
    kabKota:      _str(raw.kabKota),
    customFields: raw.customFields ?? null,
    pendaftarIdOrigin: _str(raw.pendaftarIdOrigin),
    tahunSiklusOrigin: raw.tahunSiklusOrigin ? Number(raw.tahunSiklusOrigin) : null,
  };
}

// ─── Pengajar ─────────────────────────────────────────────────

export function normalizePengajar(raw) {
  return {
    nama:            String(raw.nama ?? '').trim(),
    email:           _email(raw.email),
    noHp:            String(raw.noHp ?? '').trim(),
    bidangUtama:     Array.isArray(raw.bidangUtama) ? raw.bidangUtama : [],
    keahlian:        _normalizeTagArray(raw.keahlian),
    pedagogiScore:   _clamp(Number(raw.pedagogiScore ?? 0), 0, 100),
    experienceYears: Math.max(0, Math.floor(Number(raw.experienceYears ?? 0))),
    available:       raw.available !== false,
    catatanKhusus:   _str(raw.catatanKhusus),
  };
}

// ─── Instansi ─────────────────────────────────────────────────

export function normalizeInstansi(raw) {
  return {
    instansiId:      String(raw.instansiId ?? '').trim(),
    nama:            String(raw.nama ?? '').trim(),
    namaAlias:       _normalizeTagArray(raw.namaAlias),
    singkatan:       _str(raw.singkatan),
    alamat:          _str(raw.alamat),
    provinsiKode:    _str(raw.provinsiKode),
    kabKotaKode:     _str(raw.kabKotaKode),
    kategori:        _str(raw.kategori),
    jenisLokasi:     _str(raw.jenisLokasi),
    idLegacy:        _str(raw.idLegacy),
    isPnbpClient:    raw.isPnbpClient === true,
    kinerjaHistoris: raw.kinerjaHistoris ?? null,
    kinerjaSource:   _str(raw.kinerjaSource),
  };
}

// ─── Utilities ────────────────────────────────────────────────

/** Buat instansiId slug dari nama. "PERUMDAM Tirta Meulaboh" → "perumdam-tirta-meulaboh" */
export function slugify(str) {
  return String(str).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

/** UUID v4 tanpa library */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Internal helpers ─────────────────────────────────────────
function _str(val) {
  const s = String(val ?? '').trim();
  return s === '' ? null : s;
}
function _email(val) {
  const s = String(val ?? '').trim().toLowerCase();
  return s === '' ? null : s;
}
function _normalizeJK(val) {
  const s = String(val ?? '').trim().toUpperCase();
  if (['L','LAKI','LAKI-LAKI','M','MALE'].includes(s)) return 'L';
  if (['P','PEREMPUAN','WANITA','F','FEMALE'].includes(s)) return 'P';
  return null;
}
function _normalizePendidikan(val) {
  const s = String(val ?? '').trim().toUpperCase();
  const map = { SMA:'SMA', SMK:'SMA', D3:'D3', DIII:'D3', S1:'S1', 'S-1':'S1',
                SARJANA:'S1', S2:'S2', 'S-2':'S2', MAGISTER:'S2', S3:'S3', 'S-3':'S3', DOKTOR:'S3' };
  return map[s] ?? (PENDIDIKAN_OPTIONS.includes(s) ? s : null);
}
function _normalizeTagArray(val) {
  if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
  if (typeof val === 'string') return val.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  return [];
}
function _clamp(n, min, max) {
  return Math.min(max, Math.max(min, isNaN(n) ? min : n));
}

// shared/kompetensi.js
// Logika murni pemetaan kognitif: pembagian butir soal per level Bloom dan
// penilaian capaian peserta terhadap SKL.
//
// Tanpa import Firestore atau DOM — dipakai admin app, dan bisa diuji
// langsung dengan `npm test`.

import { BLOOM_LEVELS } from './constants.js';

/**
 * Bagi sejumlah butir soal ke level C1..target, condong ke level target.
 *
 * Bobot level ke-i adalah i, sehingga level target selalu mendapat porsi
 * terbesar — di situlah pembuktian pencapaian target berlangsung, jadi di
 * situ pula butir terbanyak diperlukan.
 *
 * Sisa pembulatan dibagikan dengan metode sisa terbesar agar jumlahnya
 * persis sama dengan yang diminta; seri dimenangkan level yang lebih tinggi.
 *
 * @param {string} targetBloom - 'C1'..'C6'
 * @param {number} jumlahSoal  - bilangan bulat >= 1
 * @returns {Object.<string, number>} mis. { C1: 1, C2: 3, C3: 4 }
 */
export function bagiSoalPerLevel(targetBloom, jumlahSoal) {
  const targetIdx = BLOOM_LEVELS.findIndex(b => b.level === targetBloom);
  if (targetIdx < 0) throw new Error(`Level Bloom '${targetBloom}' tidak dikenal.`);
  if (!Number.isInteger(jumlahSoal)) throw new Error('jumlahSoal harus bilangan bulat.');
  if (jumlahSoal < 1) throw new Error('jumlahSoal minimal 1.');

  const levels = BLOOM_LEVELS.slice(0, targetIdx + 1).map(b => b.level);
  const bobot  = levels.map((_, i) => i + 1);
  const total  = bobot.reduce((a, b) => a + b, 0);

  const kuota = levels.map((lv, i) => {
    const persis = (bobot[i] / total) * jumlahSoal;
    const dasar  = Math.floor(persis);
    return { lv, idx: i, dasar, sisa: persis - dasar };
  });

  const hasil = {};
  kuota.forEach(k => { hasil[k.lv] = k.dasar; });

  const kurang = jumlahSoal - kuota.reduce((a, k) => a + k.dasar, 0);
  const urut   = [...kuota].sort((a, b) => (b.sisa - a.sisa) || (b.idx - a.idx));
  for (let i = 0; i < kurang; i++) hasil[urut[i % urut.length].lv]++;

  return hasil;
}

/**
 * Label level Bloom untuk ditampilkan: 'C3' → 'C3 Menerapkan'.
 *
 * Catatan: JANGAN memakai mapToLabel() dari report-narrative.js untuk ini.
 * Fungsi itu memetakan nilai numerik ke label ambang, sama sekali bukan
 * level kognitif.
 *
 * @param {string|null} level
 * @returns {string}
 */
export function labelBloom(level) {
  if (!level) return '—';
  const b = BLOOM_LEVELS.find(x => x.level === level);
  return b ? `${b.level} ${b.nama}` : String(level);
}

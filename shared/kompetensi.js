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

/**
 * Nilai capaian kognitif seorang peserta pada satu unit kompetensi.
 *
 * Aturan levelTercapai: level tertinggi L yang persentase benarnya >= ambang
 * DAN seluruh level di bawah L juga >= ambang. Syarat berjenjang ini penting —
 * tanpa itu, satu tebakan beruntung di level tinggi cukup untuk mengklaim
 * penguasaan yang tidak dimiliki.
 *
 * Level tanpa soal memutus rantai: tidak bisa diklaim dikuasai, tidak juga
 * dianggap lulus diam-diam.
 *
 * @param {Object} detail    - exam_results.detail: { soalId: { benar, bobot, skor } }
 * @param {Object} soalMap   - { soalId: { unitKompetensi, bloomLevel, ... } }
 * @param {Object} sklRow    - satu baris bimtek.skl
 * @param {Object} [blueprint] - exams.blueprint, untuk melaporkan defisit stok
 */
export function calcLevelAttainment(detail, soalMap, sklRow, blueprint = null) {
  const { ukId, ukKode, ukNama, targetBloom, ambang } = sklRow;
  const kodeUK = String(ukKode ?? '').toUpperCase();

  const perLevel = {};
  for (const [soalId, d] of Object.entries(detail ?? {})) {
    const soal = soalMap?.[soalId];
    if (!soal) continue;
    if (String(soal.unitKompetensi ?? '').toUpperCase() !== kodeUK) continue;
    const lv = soal.bloomLevel;
    if (!lv) continue;
    if (!perLevel[lv]) perLevel[lv] = { benar: 0, total: 0, pct: 0 };
    perLevel[lv].total++;
    if (d?.benar) perLevel[lv].benar++;
  }
  for (const v of Object.values(perLevel)) {
    v.pct = v.total > 0 ? Math.round((v.benar / v.total) * 100) : 0;
  }

  const targetIdx = BLOOM_LEVELS.findIndex(b => b.level === targetBloom);
  if (targetIdx < 0) throw new Error(`Level Bloom '${targetBloom}' tidak dikenal.`);
  const urutan = BLOOM_LEVELS.slice(0, targetIdx + 1).map(b => b.level);

  let levelTercapai = null;
  let levelPemutus  = null;
  for (const lv of urutan) {
    const s = perLevel[lv];
    if (!s || s.total === 0 || s.pct < ambang) { levelPemutus = lv; break; }
    levelTercapai = lv;
  }

  // Kesimpulan ditandai tipis bila level yang menentukannya — entah yang
  // dicapai terakhir atau yang menggagalkan — hanya diwakili satu butir.
  const levelPenentu = levelPemutus ?? levelTercapai;
  const totalPenentu = levelPenentu ? (perLevel[levelPenentu]?.total ?? 0) : 0;
  const tipis        = totalPenentu === 1;

  const defisit = (blueprint?.komposisi ?? [])
    .filter(k => k.ukId === ukId && k.terpenuhi < k.diminta)
    .map(k => ({ bloomLevel: k.bloomLevel, diminta: k.diminta, terpenuhi: k.terpenuhi }));

  return {
    ukId, ukKode, ukNama: ukNama ?? ukKode,
    target: targetBloom, ambang,
    perLevel,
    levelTercapai,
    memenuhiTarget: levelTercapai === targetBloom,
    tipis,
    defisit,
  };
}

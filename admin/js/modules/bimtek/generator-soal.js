// admin/js/modules/bimtek/generator-soal.js
// Menyusun set soal dari Standar Kompetensi Lulusan bimtek.
//
// Kekurangan stok TIDAK digeser ke level lain. Menambal sel C4 yang kosong
// dengan butir C2 akan membuat laporan mengklaim pengukuran yang tidak
// pernah terjadi. Kekurangan dicatat di blueprint dan ditampilkan apa adanya.

import { bagiSoalPerLevel } from '../../../../shared/kompetensi.js';
import { pickSoalRandom } from '../bank-soal/api.js';

/**
 * @param {object[]}          skl       - bimtek.skl
 * @param {string|string[]}   bidangIds - bidang bimtek, membatasi kolam soal. String
 *   tunggal tetap didukung (backward-compat); bimtek PNBP bisa punya >1 bidang.
 * @returns {Promise<{ soalIds: string[], blueprint: object, adaDefisit: boolean }>}
 */
export async function susunDariSKL(skl, bidangIds) {
  if (!skl?.length) throw new Error('Bimtek ini belum punya SKL.');
  const list = Array.isArray(bidangIds) ? bidangIds : [bidangIds];
  if (!list.length || !list[0]) throw new Error('Bidang bimtek belum ditentukan.');

  const komposisi = [];
  const terpakai  = [];   // lintas UK, supaya satu butir tidak terambil dua kali

  for (const baris of skl) {
    const bagi = bagiSoalPerLevel(baris.targetBloom, baris.jumlahSoal);

    for (const [bloomLevel, diminta] of Object.entries(bagi)) {
      if (diminta < 1) continue;

      const pool = await pickSoalRandom({
        bidangId:       list,
        unitKompetensi: baris.ukKode,
        bloomLevels:    [bloomLevel],
        jumlah:         diminta,
        excludeIds:     terpakai,
      });

      const ids = pool.map(s => s.soalId);
      terpakai.push(...ids);

      komposisi.push({
        ukId:       baris.ukId,
        ukKode:     baris.ukKode,
        bloomLevel,
        diminta,
        terpenuhi:  ids.length,
        soalIds:    ids,
      });
    }
  }

  return {
    soalIds:  terpakai,
    blueprint: {
      dibuatDari: 'skl',
      dibuatPada: new Date().toISOString(),
      komposisi,
    },
    adaDefisit: komposisi.some(k => k.terpenuhi < k.diminta),
  };
}

/** Ringkas komposisi menjadi baris siap tampil di pratinjau. */
export function ringkasKomposisi(blueprint) {
  const perUK = new Map();
  for (const k of blueprint.komposisi) {
    if (!perUK.has(k.ukKode)) perUK.set(k.ukKode, { ukKode: k.ukKode, sel: [], diminta: 0, terpenuhi: 0 });
    const e = perUK.get(k.ukKode);
    e.sel.push(k);
    e.diminta   += k.diminta;
    e.terpenuhi += k.terpenuhi;
  }
  return [...perUK.values()];
}

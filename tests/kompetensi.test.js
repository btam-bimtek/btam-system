// tests/kompetensi.test.js
// Unit test logika murni kompetensi. Jalankan: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOOM_LEVELS } from '../shared/constants.js';
import { bagiSoalPerLevel, labelBloom, calcLevelAttainment } from '../shared/kompetensi.js';

test('BLOOM_LEVELS memuat enam level C1..C6 berurutan', () => {
  assert.equal(BLOOM_LEVELS.length, 6);
  assert.deepEqual(
    BLOOM_LEVELS.map(b => b.level),
    ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']
  );
});

test('bagiSoalPerLevel: target C3 dengan 8 soal condong ke level target', () => {
  assert.deepEqual(bagiSoalPerLevel('C3', 8), { C1: 1, C2: 3, C3: 4 });
});

test('bagiSoalPerLevel: target C4 dengan 6 soal', () => {
  assert.deepEqual(bagiSoalPerLevel('C4', 6), { C1: 1, C2: 1, C3: 2, C4: 2 });
});

test('bagiSoalPerLevel: target C1 menaruh semua di C1', () => {
  assert.deepEqual(bagiSoalPerLevel('C1', 5), { C1: 5 });
});

test('bagiSoalPerLevel: hasilnya selalu berjumlah persis jumlahSoal', () => {
  for (const target of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) {
    for (let n = 1; n <= 40; n++) {
      const bagi  = bagiSoalPerLevel(target, n);
      const total = Object.values(bagi).reduce((a, b) => a + b, 0);
      assert.equal(total, n, `target ${target}, jumlah ${n} menghasilkan ${total}`);
    }
  }
});

test('bagiSoalPerLevel: tidak pernah menghasilkan level di atas target', () => {
  const bagi = bagiSoalPerLevel('C2', 10);
  assert.deepEqual(Object.keys(bagi), ['C1', 'C2']);
});

test('bagiSoalPerLevel: menolak level tidak dikenal', () => {
  assert.throws(() => bagiSoalPerLevel('C9', 5), /tidak dikenal/);
});

test('bagiSoalPerLevel: menolak jumlah soal tidak sah', () => {
  assert.throws(() => bagiSoalPerLevel('C3', 0),   /minimal 1/);
  assert.throws(() => bagiSoalPerLevel('C3', 2.5), /bilangan bulat/);
});

test('labelBloom: menggabungkan kode dan nama level', () => {
  assert.equal(labelBloom('C1'), 'C1 Mengingat');
  assert.equal(labelBloom('C4'), 'C4 Menganalisis');
});

test('labelBloom: nilai kosong atau asing tidak melempar galat', () => {
  assert.equal(labelBloom(null), '—');
  assert.equal(labelBloom('C9'), 'C9');
});

// Kerangka data uji: soalMap meniru dokumen bank_soal, detail meniru
// exam_results.detail yang ditulis scorer.js.
const SKL_ROW = {
  ukId: 'uk1', ukKode: 'UK.001', ukNama: 'Mengoperasikan Pompa',
  targetBloom: 'C3', ambang: 70, jumlahSoal: 8,
};

function buatSoal(spec) {
  // spec: [[soalId, level, benar], ...]
  const soalMap = {};
  const detail  = {};
  spec.forEach(([id, lv, benar]) => {
    soalMap[id] = { soalId: id, unitKompetensi: 'UK.001', bloomLevel: lv };
    detail[id]  = { benar, bobot: 1, skor: benar ? 1 : 0 };
  });
  return { soalMap, detail };
}

test('calcLevelAttainment: lolos seluruh level sampai target', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', true], ['b', 'C1', true],
    ['c', 'C2', true], ['d', 'C2', true],
    ['e', 'C3', true], ['f', 'C3', true],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, 'C3');
  assert.equal(h.memenuhiTarget, true);
  assert.equal(h.tipis, false);
});

test('calcLevelAttainment: berhenti di level sebelum yang gagal', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', true],  ['b', 'C1', true],
    ['c', 'C2', true],  ['d', 'C2', true],
    ['e', 'C3', false], ['f', 'C3', false],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, 'C2');
  assert.equal(h.memenuhiTarget, false);
});

test('calcLevelAttainment: gagal di level bawah membatalkan klaim level atas', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', false], ['b', 'C1', false],
    ['c', 'C2', true],  ['d', 'C2', true],
    ['e', 'C3', true],  ['f', 'C3', true],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, null,
    'benar di C3 tanpa lolos C1 bukan bukti penguasaan C3');
  assert.equal(h.memenuhiTarget, false);
});

test('calcLevelAttainment: level tanpa soal memutus rantai', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', true], ['b', 'C1', true],
    ['e', 'C3', true], ['f', 'C3', true],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, 'C1', 'C2 tidak diuji, jadi C3 tidak bisa diklaim');
});

test('calcLevelAttainment: menandai kesimpulan yang bersandar satu butir', () => {
  const { soalMap, detail } = buatSoal([
    ['a', 'C1', true], ['b', 'C1', true],
    ['c', 'C2', true], ['d', 'C2', true],
    ['e', 'C3', true],
  ]);
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.levelTercapai, 'C3');
  assert.equal(h.tipis, true, 'C3 hanya diwakili satu butir');
});

test('calcLevelAttainment: mengabaikan soal dari UK lain', () => {
  const { soalMap, detail } = buatSoal([['a', 'C1', true], ['b', 'C1', true]]);
  soalMap['x'] = { soalId: 'x', unitKompetensi: 'UK.999', bloomLevel: 'C1' };
  detail['x']  = { benar: false, bobot: 1, skor: 0 };
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW);
  assert.equal(h.perLevel.C1.total, 2, 'soal UK lain tidak boleh ikut terhitung');
});

test('calcLevelAttainment: melaporkan defisit dari blueprint', () => {
  const { soalMap, detail } = buatSoal([['a', 'C1', true]]);
  const blueprint = { komposisi: [
    { ukId: 'uk1', ukKode: 'UK.001', bloomLevel: 'C3', diminta: 4, terpenuhi: 1, soalIds: ['e'] },
    { ukId: 'uk1', ukKode: 'UK.001', bloomLevel: 'C1', diminta: 1, terpenuhi: 1, soalIds: ['a'] },
  ] };
  const h = calcLevelAttainment(detail, soalMap, SKL_ROW, blueprint);
  assert.equal(h.defisit.length, 1);
  assert.deepEqual(h.defisit[0], { bloomLevel: 'C3', diminta: 4, terpenuhi: 1 });
});

test('calcLevelAttainment: detail kosong tidak melempar galat', () => {
  const h = calcLevelAttainment({}, {}, SKL_ROW);
  assert.equal(h.levelTercapai, null);
  assert.deepEqual(h.perLevel, {});
});

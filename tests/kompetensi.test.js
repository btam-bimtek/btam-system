// tests/kompetensi.test.js
// Unit test logika murni kompetensi. Jalankan: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOOM_LEVELS } from '../shared/constants.js';
import { bagiSoalPerLevel, labelBloom } from '../shared/kompetensi.js';

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

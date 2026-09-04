// tests/kompetensi.test.js
// Unit test logika murni kompetensi. Jalankan: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOOM_LEVELS } from '../shared/constants.js';

test('BLOOM_LEVELS memuat enam level C1..C6 berurutan', () => {
  assert.equal(BLOOM_LEVELS.length, 6);
  assert.deepEqual(
    BLOOM_LEVELS.map(b => b.level),
    ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']
  );
});

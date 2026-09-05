// admin/js/modules/bank-soal/api.js
// Firestore operations untuk bank_soal dan bank_soal_answers.
// Dua collection terpisah — kunci jawaban tidak pernah bisa diakses exam app.

import {
  db, doc, getDoc, getDocs, setDoc, updateDoc,
  collection, query, where, orderBy, limit, startAfter,
  serverTimestamp, writeBatch, getCountFromServer,
  snapToArray, snapToDoc
} from '../../../../shared/db.js';
import { auth } from '../../../../shared/firebase-config.js';
import { logAudit } from '../../../../shared/logger.js';
import { generateId } from '../../../../shared/normalize.js';
import { COL, BLOOM_MAP, BLOOM_LEVELS } from '../../../../shared/constants.js';

// ─── List ─────────────────────────────────────────────────────

export async function listSoal({
  search      = '',
  bidangId    = '',
  bloomLevel  = '',
  activeOnly  = true,
  noUkOnly    = false,
  pageSize    = 25,
  lastDoc     = null
} = {}) {
  const constraints = [where('deleted', '==', false)];
  if (activeOnly)  constraints.push(where('active', '==', true));
  if (bidangId)    constraints.push(where('bidangId', '==', bidangId));
  if (bloomLevel)  constraints.push(where('bloomLevel', '==', bloomLevel));
  constraints.push(orderBy('createdAt', 'desc'));

  // search/noUkOnly are client-side — must fetch all matching records first
  const needsClientFilter = !!search || noUkOnly;
  if (!needsClientFilter) {
    constraints.push(limit(pageSize));
    if (lastDoc) constraints.push(startAfter(lastDoc));
  }

  const q    = query(collection(db, COL.BANK_SOAL), ...constraints);
  const snap = await getDocs(q);
  let data   = snapToArray(snap);

  if (search) {
    const s = search.toLowerCase();
    data = data.filter(s2 =>
      s2.pertanyaan?.toLowerCase().includes(s) ||
      s2.unitKompetensi?.toLowerCase().includes(s) ||
      s2.tags?.some(t => t.toLowerCase().includes(s))
    );
  }
  if (noUkOnly) data = data.filter(s2 => !s2.unitKompetensi);

  if (needsClientFilter) {
    return { data, lastDoc: null, clientFiltered: true, filteredTotal: data.length };
  }
  return { data, lastDoc: snap.docs[snap.docs.length - 1] ?? null, clientFiltered: false };
}

export async function countSoal({ bidangId = '', bloomLevel = '', activeOnly = true } = {}) {
  const constraints = [where('deleted', '==', false)];
  if (activeOnly) constraints.push(where('active', '==', true));
  if (bidangId)   constraints.push(where('bidangId', '==', bidangId));
  if (bloomLevel) constraints.push(where('bloomLevel', '==', bloomLevel));

  const snap = await getCountFromServer(
    query(collection(db, COL.BANK_SOAL), ...constraints)
  );
  return snap.data().count;
}

export async function getSoal(soalId) {
  const [soalSnap, answerSnap] = await Promise.all([
    getDoc(doc(db, COL.BANK_SOAL, soalId)),
    getDoc(doc(db, COL.BANK_SOAL_ANSWERS, soalId))
  ]);
  const soal   = snapToDoc(soalSnap);
  const answer = snapToDoc(answerSnap);
  return soal ? { ...soal, kunci: answer?.kunci ?? null, pembahasan: answer?.pembahasan ?? null } : null;
}

// ─── Create ───────────────────────────────────────────────────

export async function createSoal(data, preGeneratedId = null) {
  _validateSoal(data);

  const soalId = preGeneratedId ?? generateId();
  const bobot  = _hitungBobot(data.bloomLevel);
  const now    = serverTimestamp();

  const batch = writeBatch(db);

  // Soal (tanpa kunci)
  batch.set(doc(db, COL.BANK_SOAL, soalId), {
    soalId,
    pertanyaan:              data.pertanyaan.trim(),
    pertanyaanImage:         data.pertanyaanImage ?? null,
    opsi:                    _normalizeOpsi(data.opsi),
    bidangId:                data.bidangId,
    unitKompetensi:        data.unitKompetensi?.trim().toUpperCase() ?? '',
    ekNama:                  data.ekNama?.trim() ?? null,
    bloomLevel:              data.bloomLevel,
    bobot,
    tags:                    _normalizeTags(data.tags),
    jenisPelatihanPreferensi: data.jenisPelatihanPreferensi ?? null,
    usedCount:               0,
    correctRate:             null,
    active:                  data.active !== false,
    createdAt:               now,
    updatedAt:               now,
    createdBy:               auth.currentUser?.email ?? null,
    deleted:                 false,
    deletedAt:               null
  });

  // Kunci jawaban (collection terpisah)
  batch.set(doc(db, COL.BANK_SOAL_ANSWERS, soalId), {
    soalId,
    kunci:       data.kunci,
    pembahasan:  data.pembahasan?.trim() ?? null,
    updatedAt:   now,
    updatedBy:   auth.currentUser?.email ?? null
  });

  await batch.commit();

  await logAudit({
    action: 'create_soal',
    entityType: 'bank_soal',
    entityId: soalId,
    metadata: { bidangId: data.bidangId, bloomLevel: data.bloomLevel }
  });

  return soalId;
}

// ─── Update ───────────────────────────────────────────────────

export async function updateSoal(soalId, data) {
  _validateSoal(data);

  const bobot = _hitungBobot(data.bloomLevel);
  const now   = serverTimestamp();
  const batch = writeBatch(db);

  batch.update(doc(db, COL.BANK_SOAL, soalId), {
    pertanyaan:              data.pertanyaan.trim(),
    pertanyaanImage:         data.pertanyaanImage ?? null,
    opsi:                    _normalizeOpsi(data.opsi),
    bidangId:                data.bidangId,
    unitKompetensi:        data.unitKompetensi?.trim().toUpperCase() ?? '',
    ekNama:                  data.ekNama?.trim() ?? null,
    bloomLevel:              data.bloomLevel,
    bobot,
    tags:                    _normalizeTags(data.tags),
    jenisPelatihanPreferensi: data.jenisPelatihanPreferensi ?? null,
    active:                  data.active !== false,
    updatedAt:               now
  });

  batch.set(doc(db, COL.BANK_SOAL_ANSWERS, soalId), {
    soalId,
    kunci:      data.kunci,
    pembahasan: data.pembahasan?.trim() ?? null,
    updatedAt:  now,
    updatedBy:  auth.currentUser?.email ?? null
  });

  await batch.commit();

  await logAudit({
    action: 'update_soal',
    entityType: 'bank_soal',
    entityId: soalId
  });
}

// ─── Toggle active ────────────────────────────────────────────

export async function toggleSoalActive(soalId, active) {
  await updateDoc(doc(db, COL.BANK_SOAL, soalId), {
    active, updatedAt: serverTimestamp()
  });
  await logAudit({ action: active ? 'activate_soal' : 'deactivate_soal', entityType: 'bank_soal', entityId: soalId });
}

// ─── Soft delete ──────────────────────────────────────────────

export async function deleteSoal(soalId) {
  await updateDoc(doc(db, COL.BANK_SOAL, soalId), {
    deleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp(), active: false
  });
  await logAudit({ action: 'delete_soal', entityType: 'bank_soal', entityId: soalId });
}

// ─── Random picker (untuk exam engine) ───────────────────────

/**
 * Ambil soal secara acak berdasarkan kriteria.
 * @param {object} opts
 * @param {string}   opts.bidangId
 * @param {string}   [opts.unitKompetensi]
 * @param {string[]} [opts.bloomLevels]   - filter bloom level
 * @param {number}   opts.jumlah          - berapa soal yang diambil
 * @param {string[]} [opts.excludeIds]    - soal yang sudah dipakai sebelumnya
 * @returns {Promise<object[]>}
 */
export async function pickSoalRandom({ bidangId, unitKompetensi, bloomLevels, jumlah, excludeIds = [] }) {
  // bidangId bisa string tunggal (perilaku lama) atau array (bimtek multi-bidang,
  // mis. tipe PNBP). Query per nilai — bukan operator 'in' Firestore, yang butuh
  // index gabungan baru yang belum tentu ada di produksi.
  const bidangList = Array.isArray(bidangId) ? bidangId : [bidangId];

  let pool = [];
  for (const bid of bidangList) {
    const constraints = [
      where('deleted', '==', false),
      where('active', '==', true),
      where('bidangId', '==', bid)
    ];
    if (unitKompetensi) constraints.push(where('unitKompetensi', '==', unitKompetensi));
    if (bloomLevels?.length === 1) constraints.push(where('bloomLevel', '==', bloomLevels[0]));

    const snap = await getDocs(query(collection(db, COL.BANK_SOAL), ...constraints));
    pool.push(...snapToArray(snap));
  }

  // Dedupe (satu soal seharusnya cuma 1 bidangId, tapi jaga-jaga) + buang excludeIds
  const seen = new Set();
  pool = pool.filter(s => {
    if (seen.has(s.soalId) || excludeIds.includes(s.soalId)) return false;
    seen.add(s.soalId);
    return true;
  });

  // Filter multi bloom kalau lebih dari 1
  if (bloomLevels?.length > 1) pool = pool.filter(s => bloomLevels.includes(s.bloomLevel));

  // Fisher-Yates shuffle lalu slice
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, jumlah);
}

// ─── Export ───────────────────────────────────────────────────

export async function exportSoalWithAnswers(bidangId = '') {
  // Bangun constraints secara eksplisit — hindari splice yang error-prone
  const constraints = [where('deleted', '==', false)];
  if (bidangId) constraints.push(where('bidangId', '==', bidangId));
  constraints.push(orderBy('bidangId'), orderBy('bloomLevel'));

  const [soalSnap, answerSnap] = await Promise.all([
    getDocs(query(collection(db, COL.BANK_SOAL), ...constraints)),
    getDocs(collection(db, COL.BANK_SOAL_ANSWERS))
  ]);

  const answers = Object.fromEntries(answerSnap.docs.map(d => [d.id, d.data()]));
  return snapToArray(soalSnap).map(s => ({
    ...s,
    kunci:      answers[s.soalId]?.kunci ?? '',
    pembahasan: answers[s.soalId]?.pembahasan ?? ''
  }));
}

// ─── Stats ────────────────────────────────────────────────────

/**
 * Hitung ulang usedCount dan correctRate untuk soalIds yang diberikan.
 * Dipanggil setelah exam dibuat/diubah/dihapus atau setelah scoring selesai.
 *
 * usedCount  = jumlah exam yang menyertakan soal ini di soalIds
 * correctRate = % jawaban benar di seluruh exam_results yang memuat soal ini
 */
export async function recalcSoalStats(soalIds) {
  if (!soalIds?.length) return;

  const idSet = new Set(soalIds);

  // Fetch semua exams dan exam_results secara paralel
  const [examsSnap, resultsSnap] = await Promise.all([
    getDocs(collection(db, COL.EXAMS)),
    getDocs(collection(db, COL.EXAM_RESULTS)),
  ]);

  // Hitung usedCount: berapa exam yang menyertakan soal ini
  const usedCount = {};
  soalIds.forEach(id => { usedCount[id] = 0; });
  examsSnap.docs.forEach(d => {
    const examSoalIds = d.data().soalIds ?? [];
    examSoalIds.forEach(sid => { if (idSet.has(sid)) usedCount[sid]++; });
  });

  // Hitung correctRate: benar/dijawab di semua exam_results
  const answered = {};
  const correct  = {};
  soalIds.forEach(id => { answered[id] = 0; correct[id] = 0; });
  resultsSnap.docs.forEach(d => {
    const detail = d.data().detail ?? {};
    for (const sid of soalIds) {
      if (detail[sid] !== undefined) {
        answered[sid]++;
        if (detail[sid].benar) correct[sid]++;
      }
    }
  });

  // Batch update bank_soal — chunk 400 agar tidak melebihi batas batch
  const CHUNK = 400;
  for (let i = 0; i < soalIds.length; i += CHUNK) {
    const chunk = soalIds.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach(sid => {
      const rate = answered[sid] > 0
        ? Math.round((correct[sid] / answered[sid]) * 100)
        : null;
      batch.update(doc(db, COL.BANK_SOAL, sid), {
        usedCount:   usedCount[sid],
        correctRate: rate,
      });
    });
    await batch.commit();
  }
}

// ─── Stok per UK x Bloom ──────────────────────────────────────

/**
 * Hitung sebaran soal aktif per Unit Kompetensi per level Bloom.
 * Dipakai matriks stok di Bank Soal dan kolom Stok di form SKL bimtek.
 * @returns {{ rows: object[], totalSoal: number, selKosong: number,
 *             selTipis: number, selSiap: number }}
 *   rows: [{ ukKode, ukNama, lv: {C1..C6}, total }] urut total menurun
 */
export async function buildStokMatrix() {
  const snap = await getDocs(query(
    collection(db, COL.BANK_SOAL),
    where('deleted', '==', false),
    where('active',  '==', true)
  ));

  const LEVELS = BLOOM_LEVELS.map(b => b.level);
  const map = new Map();

  snapToArray(snap).forEach(s => {
    const kode = (s.unitKompetensi || '').toUpperCase().trim();
    if (!kode) return; // soal tanpa UK tidak masuk matriks
    if (!map.has(kode)) {
      map.set(kode, {
        ukKode: kode,
        ukNama: s.ekNama || kode,
        lv:     Object.fromEntries(LEVELS.map(l => [l, 0])),
        tanpaLevel: 0,
        total:  0,
      });
    }
    const e = map.get(kode);
    e.total++;
    if (LEVELS.includes(s.bloomLevel)) e.lv[s.bloomLevel]++;
    else e.tanpaLevel++;
    if (!e.ukNama && s.ekNama) e.ukNama = s.ekNama;
  });

  const rows = [...map.values()].sort((a, b) => b.total - a.total);

  let selKosong = 0, selTipis = 0, selSiap = 0;
  rows.forEach(r => LEVELS.forEach(l => {
    const n = r.lv[l];
    if (n === 0)      selKosong++;
    else if (n === 1) selTipis++;
    else              selSiap++;
  }));

  return {
    rows,
    totalSoal: rows.reduce((a, r) => a + r.total, 0),
    selKosong, selTipis, selSiap,
  };
}

// ─── Usulan level Bloom (backfill) ────────────────────────────

/** Ambil usulan yang masih menunggu peninjauan, digabung dengan isi soalnya. */
export async function listBloomSuggestions() {
  const snap = await getDocs(query(
    collection(db, COL.BLOOM_SUGGESTIONS),
    where('status', '==', 'pending')
  ));
  const usulan = snapToArray(snap);
  if (!usulan.length) return [];

  // Ambil soal per potongan 30 — batas operator 'in' Firestore
  const soalMap = {};
  const ids = usulan.map(u => u.soalId);
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const s = await getDocs(query(
      collection(db, COL.BANK_SOAL),
      where('soalId', 'in', chunk)
    ));
    snapToArray(s).forEach(d => { soalMap[d.soalId] = d; });
  }

  return usulan
    .filter(u => soalMap[u.soalId])
    .map(u => ({ ...u, soal: soalMap[u.soalId] }));
}

export async function countPendingBloom() {
  const snap = await getCountFromServer(query(
    collection(db, COL.BLOOM_SUGGESTIONS),
    where('status', '==', 'pending')
  ));
  return snap.data().count;
}

/**
 * Terapkan keputusan admin: tulis bloomLevel + bobot ke bank_soal dan
 * tandai usulannya selesai.
 * @param {{soalId: string, level: string, status: 'disetujui'|'diubah'|'ditolak'}[]} keputusan
 * @returns {{ diterapkan: number, ditolak: number }}
 */
export async function applyBloomSuggestions(keputusan) {
  const email = auth.currentUser?.email ?? null;
  let diterapkan = 0, ditolak = 0;

  const CHUNK = 200; // 2 tulisan per keputusan, aman di bawah batas 500
  for (let i = 0; i < keputusan.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const k of keputusan.slice(i, i + CHUNK)) {
      if (k.status === 'ditolak') {
        ditolak++;
      } else {
        if (!BLOOM_MAP[k.level]) throw new Error(`Level '${k.level}' tidak dikenal untuk soal ${k.soalId}.`);
        batch.update(doc(db, COL.BANK_SOAL, k.soalId), {
          bloomLevel: k.level,
          bobot:      _hitungBobot(k.level),
          updatedAt:  serverTimestamp(),
        });
        diterapkan++;
      }
      batch.update(doc(db, COL.BLOOM_SUGGESTIONS, k.soalId), {
        status:       k.status,
        levelDipakai: k.status === 'ditolak' ? null : k.level,
        ditinjauPada: serverTimestamp(),
        ditinjauOleh: email,
      });
    }
    await batch.commit();
  }

  await logAudit({
    action: 'apply_bloom_suggestions', entityType: 'bank_soal', entityId: 'batch',
    metadata: { diterapkan, ditolak }
  });

  return { diterapkan, ditolak };
}

// ─── Internal ─────────────────────────────────────────────────

function _validateSoal(data) {
  const errors = [];
  if (!data.pertanyaan?.trim())           errors.push('Pertanyaan wajib diisi.');
  if (!data.bidangId)                     errors.push('Bidang wajib dipilih.');
  // Level Bloom menentukan bobot soal dan seluruh pemetaan kognitif. Soal
  // tanpa level diam-diam dihitung berbobot 1 (setara C1) oleh scorer, yang
  // membuat soal analisis dinilai seringan soal hafalan.
  if (!data.bloomLevel)                   errors.push('Level Bloom wajib dipilih.');
  else if (!BLOOM_MAP[data.bloomLevel])   errors.push(`Level Bloom '${data.bloomLevel}' tidak dikenal.`);
  if (!data.kunci)                        errors.push('Kunci jawaban wajib dipilih.');
  if (!data.opsi || data.opsi.length < 2) errors.push('Minimal 2 opsi jawaban.');

  const opsiIds = (data.opsi ?? []).map(o => o.id);
  if (!opsiIds.includes(data.kunci)) errors.push(`Kunci '${data.kunci}' tidak ada di opsi.`);

  data.opsi?.forEach((o, i) => {
    if (!o.text?.trim() && !o.image) errors.push(`Opsi ${o.id ?? i+1} tidak boleh kosong.`);
  });

  if (errors.length) throw new Error(errors.join(' '));
}

function _normalizeOpsi(opsi) {
  const ids = ['a','b','c','d','e','f'];
  return (opsi ?? []).map((o, i) => ({
    id:    o.id ?? ids[i],
    text:  o.text?.trim() ?? '',
    image: o.image ?? null
  }));
}

function _normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(/[,;]/).map(t => t.trim()).filter(Boolean);
  return [];
}

function _hitungBobot(bloomLevel) {
  return BLOOM_MAP[bloomLevel]?.defaultBobot ?? 1;
}

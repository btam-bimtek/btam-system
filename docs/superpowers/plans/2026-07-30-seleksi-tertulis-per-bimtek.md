# Seleksi Tertulis Per-Bimtek + Distribusi Mandiri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ujian seleksi tertulis rekrutmen dibedakan per bimtek tujuan, kelulusan administrasi dievaluasi per bimtek, dan calon peserta mengakses link ujiannya sendiri lewat halaman "Cek Status Pendaftaran" publik yang sudah ada — tanpa admin perlu mendistribusikan link satu per satu.

**Architecture:** Data model rekrutmen (`calon_peserta.statusAdmin`, `calon_peserta.nilaiTertulis`, `siklus_seleksi.bimtekPilihan[]`) diubah dari nilai tunggal jadi map/field per-bimtek. Modul exam yang sudah ada (`exams`, `exam_sessions`, `exam_results` — dari sistem Bimtek pretest/posttest) dipakai apa adanya karena sudah scoped per `bimtekId`; hanya lapisan rekrutmen di atasnya yang perlu tahu "exam mana untuk bimtek mana" dan "calon mana lolos di bimtek mana". `status_lookup` (koleksi publik tanpa auth) diperluas dengan array `ujianTertulis[]` sebagai satu-satunya kanal distribusi link ujian.

**Tech Stack:** Vanilla JS ES modules, Firebase Firestore SDK v10 (via CDN, tanpa bundler), Tailwind (CDN). **Tidak ada test framework** di project ini — modul-modul mengimpor Firebase langsung dari `https://www.gstatic.com/...` sehingga tidak bisa di-`import` lewat Node biasa. Siklus verifikasi tiap task: (1) `node --check --input-type=module < file.js` sebagai gate sintaks, (2) langkah verifikasi manual di browser (via local static server) sesuai instruksi konkret di tiap task.

## Global Constraints

- Baca file dulu sebelum edit (aturan project, lihat `feedback_coding.md`).
- Tailwind only, no bundler — semua file tetap ES module murni, import lewat path relatif atau CDN URL persis seperti pola yang sudah ada.
- Kunci Firestore terpisah per collection sesuai `shared/constants.js` (`COL.*`) — jangan hardcode nama collection string literal baru.
- Belum ada siklus seleksi berjalan dengan data lama — tidak perlu migrasi/fallback format lama di kode manapun.
- Window waktu ujian tertulis tetap satu untuk semua bimtek dalam siklus (`siklus.phases.tertulis.start/end`) — jangan buat per-bimtek.
- Tidak ada auto-kirim email/WA dari sistem manapun di plan ini.
- `exam/` app (runner, anti-cheat, submit flow) tidak disentuh sama sekali.

---

## File Structure

| File | Perubahan |
|---|---|
| `admin/js/modules/rekrutmen/calon-api.js` | `applyAdminRules`, `setStatusAdmin`, `bulkSetStatusAdmin`, `listCalonPeserta`, `updateNilaiTertulis` — jadi per-bimtek; tambah field derivasi `statusAdminOverall` untuk query filter |
| `admin/js/modules/rekrutmen/calon-peserta.js` | Render status per bimtek (badge tabel + dropdown per bimtek di modal detail) |
| `admin/js/modules/rekrutmen/siklus-api.js` | Tambah `setExamIdTertulis(tahun, bimtekId, examId, adminEmail)` |
| `admin/js/modules/rekrutmen/seleksi-exam-api.js` | Tambah `generateSeleksiSessionsBulk` (loop semua bimtek) dan `scoreSeleksiSubmissionsBulk`; `updateNilaiTertulis` (di calon-api.js) terima `bimtekId` |
| `admin/js/modules/rekrutmen/seleksi-tertulis.js` | UI kartu exam jadi daftar per bimtek; tombol generate jadi bulk; tabel monitoring dikelompokkan per bimtek |
| `admin/js/modules/rekrutmen/penentuan.js` | Baca `c.nilaiTertulis[bimtekId]` per blok bimtek |
| `pendaftar/js/pages/status.js` | Step "Seleksi Tertulis" render daftar per bimtek dengan tombol "Mulai Ujian →" |

Tidak ada file baru dibuat — semua perubahan masuk ke file yang sudah ada, mengikuti pola yang sudah dipakai di tiap modul.

---

### Task 1: `calon-api.js` — evaluasi administrasi & nilai tertulis per bimtek

**Files:**
- Modify: `admin/js/modules/rekrutmen/calon-api.js`

**Interfaces:**
- Konsumsi: `_evalRules(calon, rules)` (helper yang sudah ada, tidak berubah), `_syncStatusLookup(docId, fields)` (helper yang sudah ada, tidak berubah signature)
- Diproduksi untuk task lain:
  - `applyAdminRules(tahun, bimtekPilihan, adminEmail)` — signature sama, tapi sekarang menulis `statusAdmin` sebagai map `{ [bimtekId]: { status, reason } }` dan field `statusAdminOverall: 'pending'|'lulus'|'gugur'`.
  - `setStatusAdmin(docId, bimtekId, status, alasan, adminEmail)` — **signature berubah**, tambah param `bimtekId` di posisi kedua.
  - `bulkSetStatusAdmin(ids, bimtekId, status, alasan, adminEmail)` — **signature berubah**, tambah param `bimtekId`.
  - `listCalonPeserta({ tahun, statusAdminOverall, search, lastDoc })` — **param rename** `statusAdmin` → `statusAdminOverall`.
  - `updateNilaiTertulis(docId, bimtekId, nilai, adminEmail)` — **signature berubah**, tambah param `bimtekId` di posisi kedua. Menulis ke `nilaiTertulis.{bimtekId}` dan `statusTertulis.{bimtekId}` (dot-path update Firestore).

- [ ] **Step 1: Baca seluruh file untuk konteks penuh**

Baca `admin/js/modules/rekrutmen/calon-api.js` (sudah pernah dibaca sebagian di sesi brainstorm — baca ulang penuh untuk memastikan tidak ada bagian terlewat sebelum edit).

- [ ] **Step 2: Ubah `applyAdminRules` — evaluasi per bimtek, bukan berhenti di kecocokan pertama**

Ganti isi fungsi (baris ~73-129 pada versi sebelum perubahan) jadi:

```js
export async function applyAdminRules(tahun, bimtekPilihan, adminEmail) {
  const snap = await getDocs(
    query(collection(db, COL.CALON_PESERTA),
      where('tahun', '==', tahun),
      where('statusAdminOverall', '==', 'pending'))
  );

  const bimtekMap = Object.fromEntries((bimtekPilihan || []).map(b => [b.bimtekId, b]));

  let lulus = 0, gugur = 0;
  const errors = [];

  for (const d of snap.docs) {
    const calon   = { id: d.id, ...d.data() };
    const pilihan = calon.pilihanBimtekIds || [];

    const statusAdmin = {};
    let anyLulus = false;

    if (!bimtekPilihan?.length) {
      // Tidak ada bimtek terkonfigurasi — tidak ada yang bisa dievaluasi, biarkan pending.
      continue;
    }

    for (const bimtekId of pilihan) {
      const bimtek = bimtekMap[bimtekId];
      if (!bimtek) continue;

      const rules = bimtek.adminRules || [];
      let passes = _evalRules(calon, rules);
      let reason = passes ? null : 'Tidak memenuhi kriteria administrasi bimtek ini';

      if (passes && bimtek.larangRepeatBimtek3Tahun) {
        const repeat = await _pernahTerpilihDiBimtek(calon, bimtekId, tahun);
        if (repeat) {
          passes = false;
          reason = `Pernah terpilih di ${bimtek.namaBimtek || bimtekId} pada tahun ${repeat.tahun}`;
        }
      }

      statusAdmin[bimtekId] = { status: passes ? 'lulus' : 'gugur', reason };
      if (passes) anyLulus = true;
    }

    const statusAdminOverall = anyLulus ? 'lulus' : 'gugur';
    const ts = Timestamp.now();
    try {
      await updateDoc(doc(db, COL.CALON_PESERTA, d.id), { statusAdmin, statusAdminOverall, updatedAt: ts });
      await setDoc(doc(db, COL.STATUS_LOOKUP, calon.pendaftarId), { statusAdmin, statusAdminOverall, updatedAt: ts }, { merge: true });
      anyLulus ? lulus++ : gugur++;
    } catch (e) {
      errors.push(`${calon.pendaftarId}: ${e.message}`);
    }
  }

  await logAudit({ action: 'apply_admin_rules', entityType: 'siklus_seleksi', entityId: String(tahun), metadata: { lulus, gugur, bimtekCount: (bimtekPilihan||[]).length } });
  return { lulus, gugur, errors };
}
```

Catatan: `statusAdminOverall` adalah field **derivasi** tambahan (bukan bagian dari spec asli secara eksplisit) yang dibutuhkan supaya `listCalonPeserta` tetap bisa query Firestore dengan `where(...)` — Firestore tidak bisa query "salah satu value di dalam map sama dengan X". `statusAdmin` (map) tetap sumber kebenaran untuk detail per bimtek; `statusAdminOverall` cuma untuk filter tab yang sudah ada (Pending/Lulus/Gugur).

- [ ] **Step 3: Ubah `setStatusAdmin` — set status untuk satu bimtek**

Cari fungsi `setStatusAdmin(docId, status, alasan, adminEmail)`, ganti jadi:

```js
export async function setStatusAdmin(docId, bimtekId, status, alasan, adminEmail) {
  const ts = Timestamp.now();
  const calonSnap = await getDoc(doc(db, COL.CALON_PESERTA, docId));
  if (!calonSnap.exists()) throw new Error('Calon tidak ditemukan');
  const calon = calonSnap.data();

  const statusAdmin = { ...(calon.statusAdmin || {}) };
  statusAdmin[bimtekId] = { status, reason: alasan || null };
  const statusAdminOverall = Object.values(statusAdmin).some(s => s.status === 'lulus') ? 'lulus'
    : Object.values(statusAdmin).some(s => s.status === 'gugur') ? 'gugur' : 'pending';

  await updateDoc(doc(db, COL.CALON_PESERTA, docId), { statusAdmin, statusAdminOverall, updatedAt: ts });
  await _syncStatusLookup(docId, { statusAdmin, statusAdminOverall, updatedAt: ts });
  await logAudit({ action: 'seleksi_admin', entityType: 'calon_peserta', entityId: docId, metadata: { bimtekId, status, alasan } });
}
```

- [ ] **Step 4: Ubah `bulkSetStatusAdmin` — sama seperti Step 3 tapi untuk banyak docId**

Cari fungsi `bulkSetStatusAdmin(ids, status, alasan, adminEmail)`. Ganti signature jadi `bulkSetStatusAdmin(ids, bimtekId, status, alasan, adminEmail)`, dan isi implementasinya memanggil `setStatusAdmin(id, bimtekId, status, alasan, adminEmail)` untuk tiap `id` di `ids` (pakai `Promise.all`).

```js
export async function bulkSetStatusAdmin(ids, bimtekId, status, alasan, adminEmail) {
  await Promise.all(ids.map(id => setStatusAdmin(id, bimtekId, status, alasan, adminEmail)));
}
```

- [ ] **Step 5: Ubah `listCalonPeserta` — filter pakai `statusAdminOverall`**

Cari fungsi `listCalonPeserta({ tahun, statusAdmin = null, search = '', lastDoc = null } = {})`. Ganti parameter `statusAdmin` jadi `statusAdminOverall`, dan baris query-nya:

```js
export async function listCalonPeserta({ tahun, statusAdminOverall = null, search = '', lastDoc = null } = {}) {
  const constraints = [
    where('tahun', '==', tahun),
    orderBy('submittedAt', 'desc'),
    limit(PER_PAGE)
  ];
  if (statusAdminOverall) constraints.splice(1, 0, where('statusAdminOverall', '==', statusAdminOverall));
  if (lastDoc)            constraints.push(startAfter(lastDoc));
  // ... sisa isi fungsi tidak berubah
```

- [ ] **Step 6: Ubah `updateNilaiTertulis` — tulis ke map per bimtek**

Cari fungsi `updateNilaiTertulis(docId, nilai, adminEmail)`. Ganti jadi:

```js
export async function updateNilaiTertulis(docId, bimtekId, nilai, adminEmail) {
  const statusTertulisVal = nilai >= 60 ? 'lulus' : 'gugur'; // threshold bisa dikonfigurasi
  const ts = Timestamp.now();
  await updateDoc(doc(db, COL.CALON_PESERTA, docId), {
    [`nilaiTertulis.${bimtekId}`]:  nilai,
    [`statusTertulis.${bimtekId}`]: statusTertulisVal,
    updatedAt: ts
  });
  await _syncStatusLookup(docId, {
    [`nilaiTertulis.${bimtekId}`]:  nilai,
    [`statusTertulis.${bimtekId}`]: statusTertulisVal,
    updatedAt: ts
  });
}
```

- [ ] **Step 7: Cek referensi `data.pilihanBimtekIds`-driven default saat calon baru dibuat**

Grep referensi `statusAdmin: 'pending'` di seluruh codebase (kemungkinan besar hanya di `pendaftar/js/api.js` saat submit pendaftaran baru):

Run: `grep -rn "statusAdmin.*pending" "admin/js/modules/rekrutmen" "pendaftar/js"`

Untuk tiap kemunculan di luar `calon-api.js` yang sudah diedit (kemungkinan `pendaftar/js/api.js`), ganti nilai default jadi:
```js
statusAdmin: {},
statusAdminOverall: 'pending',
```
(field lama `statusAdmin: 'pending'` dan turunannya di `status_lookup` diganti sepasang field di atas). Ini akan ditangani detail di Task 7 karena file itu juga disentuh untuk `ujianTertulis`.

- [ ] **Step 8: Validasi sintaks**

Run: `node --check --input-type=module < "admin/js/modules/rekrutmen/calon-api.js"`
Expected: tidak ada output (exit 0), artinya sintaks valid.

- [ ] **Step 9: Commit**

```bash
git add admin/js/modules/rekrutmen/calon-api.js
git commit -m "feat: evaluasi kelulusan administrasi & nilai tertulis per bimtek"
```

---

### Task 2: `siklus-api.js` — tautkan exam per bimtek

**Files:**
- Modify: `admin/js/modules/rekrutmen/siklus-api.js`

**Interfaces:**
- Konsumsi: `updateKuota` (sudah ada, tidak berubah), `getSiklus` (sudah ada)
- Diproduksi untuk Task 5: `setExamIdTertulis(tahun, bimtekId, examId, adminEmail)` — resolve-modify-write satu item `bimtekPilihan[]`.

- [ ] **Step 1: Tambah fungsi `setExamIdTertulis`**

Tambahkan di bagian "─── Kuota ───" (setelah `updateKuota`):

```js
// ─── Exam Tertulis per Bimtek ────────────────────────────────

/** Tautkan/ganti exam seleksi tertulis untuk satu bimtek dalam siklus. */
export async function setExamIdTertulis(tahun, bimtekId, examId, adminEmail) {
  const docRef = doc(db, COL.SIKLUS_SELEKSI, String(tahun));
  const snap   = await getDoc(docRef);
  if (!snap.exists()) throw new Error(`Siklus tahun ${tahun} tidak ditemukan`);

  const bimtekPilihan = (snap.data().bimtekPilihan || []).map(b =>
    b.bimtekId === bimtekId ? { ...b, examIdTertulis: examId } : b
  );

  await updateDoc(docRef, { bimtekPilihan, updatedAt: Timestamp.now() });
  await logAudit({ action: 'set_exam_tertulis', entityType: 'siklus_seleksi', entityId: String(tahun), metadata: { bimtekId, examId } });
}
```

- [ ] **Step 2: Validasi sintaks**

Run: `node --check --input-type=module < "admin/js/modules/rekrutmen/siklus-api.js"`
Expected: exit 0, tidak ada output.

- [ ] **Step 3: Commit**

```bash
git add admin/js/modules/rekrutmen/siklus-api.js
git commit -m "feat: tambah setExamIdTertulis untuk tautkan exam per bimtek"
```

---

### Task 3: `seleksi-exam-api.js` — generate & score bulk per bimtek

**Files:**
- Modify: `admin/js/modules/rekrutmen/seleksi-exam-api.js`

**Interfaces:**
- Konsumsi: `generateSeleksiSessions(exam, calonList, expiredAt)` (sudah ada, **tidak diubah** — sudah bimtek-scoped lewat `exam.bimtekId`), `updateNilaiTertulis(docId, bimtekId, nilai, adminEmail)` (dari Task 1, signature baru)
- Diproduksi untuk Task 5:
  - `generateSeleksiSessionsBulk(siklus, calonList, expiredAt)` — loop semua bimtek di `siklus.bimtekPilihan` yang punya `examIdTertulis`, filter calon yang `statusAdmin[bimtekId].status === 'lulus'`, panggil `generateSeleksiSessions` per bimtek. Return `{ created, skipped, byBimtek: [{ bimtekId, created, skipped }] }`.
  - `scoreSeleksiSubmissionsBulk(siklus)` — loop semua bimtek yang punya `examIdTertulis`, panggil `scoreSeleksiSubmissions(examId)` per bimtek (dengan `bimtekId` diteruskan ke `updateNilaiTertulis`). Return `{ processed, failed, byBimtek: [...] }`.
  - `syncUjianTertulisStatusLookup(calonDocId)` — baca semua `exam_sessions` tipe `seleksi_tertulis` milik satu calon (`noPeserta == pendaftarId`), tulis ringkasannya ke `status_lookup.ujianTertulis`.

- [ ] **Step 1: Baca seluruh file untuk konteks penuh**

Baca `admin/js/modules/rekrutmen/seleksi-exam-api.js` (sudah dibaca penuh sebelumnya di sesi brainstorm — baca ulang untuk pastikan tidak ada perubahan sejak itu).

- [ ] **Step 2: Ubah `scoreSeleksiSubmissions` — teruskan `bimtekId` ke `updateNilaiTertulis`**

Cari baris:
```js
      if (calonSnap.empty) throw new Error('Calon peserta tidak ditemukan');
      await updateNilaiTertulis(calonSnap.docs[0].id, skor);
```
Ganti jadi:
```js
      if (calonSnap.empty) throw new Error('Calon peserta tidak ditemukan');
      await updateNilaiTertulis(calonSnap.docs[0].id, exam.bimtekId, skor);
      await syncUjianTertulisStatusLookup(calonSnap.docs[0].id);
```

- [ ] **Step 3: Tambah `syncUjianTertulisStatusLookup`**

Tambahkan fungsi baru (sebelum bagian `// ─── Helpers ───` di akhir file):

```js
/**
 * Sinkronkan ringkasan semua sesi ujian seleksi_tertulis milik satu calon
 * ke status_lookup.ujianTertulis, supaya calon bisa lihat & akses link
 * ujiannya sendiri lewat halaman Cek Status Pendaftaran (tanpa distribusi manual).
 */
export async function syncUjianTertulisStatusLookup(calonDocId) {
  const calonSnap = await getDoc(doc(db, COL.CALON_PESERTA, calonDocId));
  if (!calonSnap.exists()) return;
  const calon = calonSnap.data();

  const sessSnap = await getDocs(
    query(
      collection(db, COL.EXAM_SESSIONS),
      where('noPeserta', '==', calon.pendaftarId),
      where('tipeSession', '==', TIPE_SESSION)
    )
  );

  const nilaiTertulis = calon.nilaiTertulis || {};
  const ujianTertulis = snapToArray(sessSnap).map(s => ({
    bimtekId:   s.bimtekId,
    namaBimtek: s.examJudul || s.bimtekId,
    token:      s.token,
    status:     s.status,
    nilai:      nilaiTertulis[s.bimtekId] ?? null,
  }));

  await setDoc(doc(db, COL.STATUS_LOOKUP, calon.pendaftarId), { ujianTertulis }, { merge: true });
}
```

- [ ] **Step 4: Tambah `generateSeleksiSessionsBulk`**

Tambahkan setelah `generateSeleksiSessions`:

```js
/**
 * Generate sesi ujian untuk SEMUA bimtek yang punya examIdTertulis, ke SEMUA
 * calon yang lolos administrasi di bimtek itu. Dipanggil sekali dari UI,
 * menggantikan generate satu-per-satu.
 * @param {object} siklus - doc siklus_seleksi (butuh bimtekPilihan)
 * @param {object[]} calonList - semua calon (statusAdminOverall lulus)
 * @param {Date} expiredAt
 */
export async function generateSeleksiSessionsBulk(siklus, calonList, expiredAt) {
  const bimtekWithExam = (siklus.bimtekPilihan || []).filter(b => b.examIdTertulis);
  let created = 0, skipped = 0;
  const byBimtek = [];

  for (const b of bimtekWithExam) {
    const examSnap = await getDoc(doc(db, COL.EXAMS, b.examIdTertulis));
    if (!examSnap.exists()) { byBimtek.push({ bimtekId: b.bimtekId, created: 0, skipped: 0, error: 'Exam tidak ditemukan' }); continue; }
    const exam = { id: examSnap.id, ...examSnap.data() };

    const eligible = calonList.filter(c => c.statusAdmin?.[b.bimtekId]?.status === 'lulus');
    const { created: c, skipped: s } = await generateSeleksiSessions(exam, eligible, expiredAt);
    created += c; skipped += s;
    byBimtek.push({ bimtekId: b.bimtekId, created: c, skipped: s });
  }

  // Sinkronkan status_lookup untuk semua calon yang barusan dapat sesi baru.
  const touchedIds = new Set(
    bimtekWithExam.flatMap(b => calonList.filter(c => c.statusAdmin?.[b.bimtekId]?.status === 'lulus').map(c => c.id))
  );
  for (const id of touchedIds) await syncUjianTertulisStatusLookup(id);

  return { created, skipped, byBimtek };
}
```

- [ ] **Step 5: Tambah `scoreSeleksiSubmissionsBulk`**

Tambahkan setelah `scoreSeleksiSubmissions`:

```js
/** Sinkronkan nilai untuk SEMUA bimtek yang punya examIdTertulis sekaligus. */
export async function scoreSeleksiSubmissionsBulk(siklus) {
  const bimtekWithExam = (siklus.bimtekPilihan || []).filter(b => b.examIdTertulis);
  let processed = 0, failed = 0;
  const byBimtek = [];

  for (const b of bimtekWithExam) {
    try {
      const { processed: p, failed: f } = await scoreSeleksiSubmissions(b.examIdTertulis);
      processed += p; failed += f;
      byBimtek.push({ bimtekId: b.bimtekId, processed: p, failed: f });
    } catch (e) {
      byBimtek.push({ bimtekId: b.bimtekId, processed: 0, failed: 0, error: e.message });
    }
  }

  return { processed, failed, byBimtek };
}
```

- [ ] **Step 6: Update import `getDoc`/`setDoc`/`snapToArray` sudah lengkap**

Cek baris import di puncak file — pastikan `setDoc` dan `snapToArray` sudah ada di daftar import dari `../../../../shared/db.js` (dipakai Step 3). Kalau belum ada, tambahkan ke daftar import yang sudah ada.

- [ ] **Step 7: Validasi sintaks**

Run: `node --check --input-type=module < "admin/js/modules/rekrutmen/seleksi-exam-api.js"`
Expected: exit 0, tidak ada output.

- [ ] **Step 8: Commit**

```bash
git add admin/js/modules/rekrutmen/seleksi-exam-api.js
git commit -m "feat: generate sesi & sinkron nilai ujian tertulis bulk per bimtek"
```

---

### Task 4: `calon-peserta.js` — UI status admin per bimtek

**Files:**
- Modify: `admin/js/modules/rekrutmen/calon-peserta.js`

**Interfaces:**
- Konsumsi: `setStatusAdmin(docId, bimtekId, status, alasan, adminEmail)`, `bulkSetStatusAdmin(ids, bimtekId, status, alasan, adminEmail)`, `listCalonPeserta({ tahun, statusAdminOverall, search, lastDoc })` (semua dari Task 1)

- [ ] **Step 1: Ubah badge status di `_renderRow`**

Cari:
```js
  const statusBadge = {
    pending: '<span class="badge badge-yellow">Pending</span>',
    lulus:   '<span class="badge badge-green">Lulus</span>',
    gugur:   '<span class="badge badge-red">Gugur</span>'
  }[d.statusAdmin] ?? d.statusAdmin;
```
Ganti jadi (pakai `statusAdminOverall`, dan tampilkan hitungan bimtek lulus sebagai detail):
```js
  const lulusCount = Object.values(d.statusAdmin || {}).filter(s => s.status === 'lulus').length;
  const statusBadge = {
    pending: '<span class="badge badge-yellow">Pending</span>',
    lulus:   `<span class="badge badge-green">Lulus (${lulusCount} bimtek)</span>`,
    gugur:   '<span class="badge badge-red">Gugur</span>'
  }[d.statusAdminOverall] ?? d.statusAdminOverall;
```

- [ ] **Step 2: Ubah filter query call di `_load`**

Cari:
```js
    const { data, lastDoc } = await listCalonPeserta({
      tahun: _S.tahun,
      statusAdmin: _S.filter !== 'all' ? _S.filter : null,
      search: _S.search,
      lastDoc: reset ? null : _S.lastDoc
    });
```
Ganti param jadi `statusAdminOverall: _S.filter !== 'all' ? _S.filter : null,`.

- [ ] **Step 3: Ubah modal detail — dropdown status per bimtek pilihan**

Cari blok "Seleksi admin" di `_openDetailModal` (mulai dari komentar `<!-- Seleksi admin -->` sampai penutup `</div>` sebelum akhir template literal `body`). Ganti seluruh blok itu jadi loop per bimtek pilihan calon:

```js
      <!-- Seleksi admin per bimtek -->
      <div class="border-t border-gray-800 pt-4 space-y-3">
        <p class="text-xs font-medium text-gray-400 mb-2">Keputusan Administrasi per Bimtek</p>
        ${(calon.pilihanBimtekIds || []).map(bimtekId => {
          const b = bimteks.find(x => x.bimtekId === bimtekId);
          const cur = calon.statusAdmin?.[bimtekId] || { status: 'pending', reason: null };
          return `
          <div class="bg-gray-800/50 rounded-lg p-3">
            <p class="text-xs text-gray-300 font-medium mb-2">${_esc(b?.namaBimtek ?? bimtekId)}</p>
            <div class="flex gap-2 flex-wrap items-end">
              <div class="flex-1">
                <select class="sel-status-admin-bimtek form-input text-sm py-1.5" data-bimtek-id="${_esc(bimtekId)}">
                  <option value="pending" ${cur.status === 'pending' ? 'selected' : ''}>Pending</option>
                  <option value="lulus"   ${cur.status === 'lulus'   ? 'selected' : ''}>Lulus Administrasi</option>
                  <option value="gugur"   ${cur.status === 'gugur'   ? 'selected' : ''}>Gugur Administrasi</option>
                </select>
              </div>
              <div class="flex-1">
                <input type="text" class="inp-alasan-bimtek form-input text-sm py-1.5" data-bimtek-id="${_esc(bimtekId)}"
                       placeholder="Alasan (opsional)" value="${_esc(cur.reason ?? '')}" />
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
```

- [ ] **Step 4: Ubah handler "Simpan Keputusan" — simpan tiap bimtek**

Cari action `{ label: 'Simpan Keputusan', ... }` di `_openDetailModal`. Ganti isi `onClick` jadi loop atas semua elemen `.sel-status-admin-bimtek`:

```js
        onClick: async () => {
          try {
            const selects = document.querySelectorAll('.sel-status-admin-bimtek');
            for (const sel of selects) {
              const bimtekId = sel.dataset.bimtekId;
              const status   = sel.value;
              const alasan   = document.querySelector(`.inp-alasan-bimtek[data-bimtek-id="${bimtekId}"]`)?.value.trim();
              await setStatusAdmin(docId, bimtekId, status, alasan, email);
            }
            showToast('Status diperbarui', 'success');
            modal.close();
            await _load();
          } catch (e) { showToast(e.message, 'error'); }
        }
```

- [ ] **Step 5: Ubah `_bulkAction` — perlu pilih bimtek dulu**

Bulk lulus/gugur sekarang butuh tahu bimtek mana yang di-set. Cari fungsi `_bulkAction(status)`. Ganti supaya menampilkan pilihan bimtek di dalam `confirmDialog` — cara paling sederhana yang konsisten dengan pola `openModal` yang sudah dipakai di file ini: ganti `_bulkAction` untuk membuka `openModal` kecil berisi `<select>` bimtek (dari `_S.siklus.bimtekPilihan`) sebelum konfirmasi:

```js
async function _bulkAction(status) {
  if (!requireWrite()) return;
  const ids = [..._S.selected];
  const bimteks = _S.siklus?.bimtekPilihan || [];
  if (!bimteks.length) { showToast('Belum ada bimtek dikonfigurasi di siklus ini.', 'error'); return; }

  const body = `
    <div class="space-y-3">
      <p class="text-sm text-gray-400">Set status administrasi ${ids.length} pendaftar untuk bimtek yang dipilih.</p>
      <select id="sel-bulk-bimtek" class="form-input w-full">
        ${bimteks.map(b => `<option value="${_esc(b.bimtekId)}">${_esc(b.namaBimtek)}</option>`).join('')}
      </select>
    </div>`;

  const modal = openModal({
    title: `Set ${ids.length} pendaftar → ${status === 'lulus' ? 'Lulus' : 'Gugur'}`,
    body,
    size: 'sm',
    actions: [
      { label: 'Batal', type: 'secondary', onClick: () => modal.close() },
      {
        label: status === 'lulus' ? 'Lulus' : 'Gugur', type: 'primary',
        onClick: async () => {
          const bimtekId = document.getElementById('sel-bulk-bimtek')?.value;
          if (!bimtekId) return;
          const email = getState('auth')?.user?.email;
          try {
            await bulkSetStatusAdmin(ids, bimtekId, status, null, email);
            modal.close();
            showToast(`${ids.length} pendaftar di-set ${status}`, 'success');
            await _load();
          } catch (e) { showToast(e.message, 'error'); }
        }
      }
    ]
  });
}
```

- [ ] **Step 6: Validasi sintaks**

Run: `node --check --input-type=module < "admin/js/modules/rekrutmen/calon-peserta.js"`
Expected: exit 0, tidak ada output.

- [ ] **Step 7: Verifikasi manual di browser**

Jalankan static server lokal dan buka admin panel:
```bash
cd "D:/ClaudeProjects/btam-system" && python -m http.server 8791
```
Buka `http://localhost:8791/admin/` (login sebagai admin), masuk ke Rekrutmen → Calon Peserta. Cek: (a) badge status di tabel menampilkan "Lulus (N bimtek)" bukan error, (b) buka Detail salah satu calon, pastikan muncul satu blok dropdown per bimtek pilihan, (c) ubah salah satu ke "Lulus", simpan, reload, pastikan tersimpan. Matikan server setelah selesai: `pkill -f "http.server 8791"`.

- [ ] **Step 8: Commit**

```bash
git add admin/js/modules/rekrutmen/calon-peserta.js
git commit -m "feat: UI keputusan administrasi per bimtek di Calon Peserta"
```

---

### Task 5: `seleksi-tertulis.js` — UI exam & generate per bimtek

**Files:**
- Modify: `admin/js/modules/rekrutmen/seleksi-tertulis.js`

**Interfaces:**
- Konsumsi: `setExamIdTertulis` (Task 2), `generateSeleksiSessionsBulk`, `scoreSeleksiSubmissionsBulk` (Task 3), `listExams(bimtekId)` (sudah ada di `admin/js/modules/bimtek/exam-api.js`, filter tipe `seleksi_tertulis` di sisi client)

- [ ] **Step 1: Tambah import `listExams` dan fungsi baru dari Task 2 & 3**

Ganti baris import di puncak file:
```js
import { generateSeleksiSessions, listSeleksiSessions, scoreSeleksiSubmissions } from './seleksi-exam-api.js';
```
jadi:
```js
import { generateSeleksiSessionsBulk, listSeleksiSessions, scoreSeleksiSubmissionsBulk } from './seleksi-exam-api.js';
import { setExamIdTertulis } from './siklus-api.js';
import { listExams } from '../bimtek/exam-api.js';
```

- [ ] **Step 2: Ganti kartu "Ujian Seleksi Tertulis" tunggal jadi daftar per bimtek**

Di `_renderContent`, cari deklarasi:
```js
  const examId   = _S.siklus.phases?.tertulis?.examId ?? null;
  const window_s = _S.siklus.phases?.tertulis?.start;
  const window_e = _S.siklus.phases?.tertulis?.end;
```
Ganti jadi (hapus baris `examId` lama, tidak dipakai lagi):
```js
  const window_s = _S.siklus.phases?.tertulis?.start;
  const window_e = _S.siklus.phases?.tertulis?.end;
  const bimtekPilihan = _S.siklus.bimtekPilihan || [];
```

Cari blok HTML "Konfigurasi Exam" (`<!-- Konfigurasi Exam -->` sampai penutup `</div>` sebelum "Window waktu ujian"). Ganti jadi daftar per bimtek, satu baris per bimtek dengan `<select>` exam:

```js
      <!-- Konfigurasi Exam per Bimtek -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white mb-4">Ujian Seleksi Tertulis per Bimtek</h2>
        ${bimtekPilihan.length === 0 ? `
          <p class="text-sm text-gray-500">Belum ada bimtek dikonfigurasi. Atur di tab Kuota &amp; Aturan Bimtek.</p>` : `
          <div class="space-y-2" id="bimtek-exam-list">
            ${bimtekPilihan.map(b => `
              <div class="flex items-center justify-between gap-3 bg-gray-800/50 rounded-lg px-3 py-2">
                <p class="text-sm text-gray-200 flex-1 truncate">${_esc(b.namaBimtek)}</p>
                <select class="sel-exam-bimtek form-input text-sm py-1 w-64" data-bimtek-id="${_esc(b.bimtekId)}">
                  <option value="">— Belum dipilih —</option>
                </select>
              </div>`).join('')}
          </div>
          <div class="flex justify-end mt-4">
            <button id="btn-gen-links-bulk" class="px-3 py-1.5 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors">
              Generate Magic Link (Semua Bimtek)
            </button>
          </div>`}
      </div>
```

- [ ] **Step 3: Isi `<select>` exam per bimtek secara async setelah render**

Di akhir `_renderContent` (sebelum baris `_bindContentEvents();`), tambahkan pengisian opsi tiap `<select>` (dipisah dari template string karena butuh fetch async per bimtek):

```js
  for (const b of bimtekPilihan) {
    const sel = document.querySelector(`.sel-exam-bimtek[data-bimtek-id="${b.bimtekId}"]`);
    if (!sel) continue;
    const exams = (await listExams(b.bimtekId)).filter(e => e.tipe === 'seleksi_tertulis');
    sel.innerHTML = `<option value="">— Belum dipilih —</option>` +
      exams.map(e => `<option value="${_esc(e.id)}" ${e.id === b.examIdTertulis ? 'selected' : ''}>${_esc(e.judul)}</option>`).join('');
    sel.addEventListener('change', async () => {
      const email = getState('auth')?.user?.email;
      try {
        await setExamIdTertulis(_S.tahun, b.bimtekId, sel.value || null, email);
        _S.siklus = await getSiklus(_S.tahun);
        showToast('Exam ditautkan', 'success');
      } catch (e) { showToast(e.message, 'error'); }
    });
  }
```

- [ ] **Step 4: Ganti bagian "Hasil ujian" / monitoring jadi dikelompokkan per bimtek**

Cari blok `${examId ? \`...\` : ''}` (Monitor Ujian + Link Ujian per Calon). Ganti kondisi `examId` jadi `bimtekPilihan.some(b => b.examIdTertulis)`, dan isi ulang stat/tabel per bimtek:

```js
      ${bimtekPilihan.some(b => b.examIdTertulis) ? `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-white">Monitor Ujian</h2>
            <div class="flex gap-2">
              <button id="btn-sync-nilai" class="px-3 py-1.5 rounded-lg text-xs bg-green-700 hover:bg-green-600 text-white transition-colors">
                Sinkronkan Nilai (Semua Bimtek)
              </button>
              <button id="btn-refresh-stat" class="text-xs text-gray-500 hover:text-gray-300 transition-colors">↻ Refresh</button>
            </div>
          </div>
          ${await _renderMonitorPerBimtek(bimtekPilihan)}
        </div>` : ''}
    </div>`;
```

Tambahkan fungsi helper baru (di dekat fungsi private lain di file ini):

```js
async function _renderMonitorPerBimtek(bimtekPilihan) {
  const blocks = [];
  for (const b of bimtekPilihan) {
    if (!b.examIdTertulis) continue;
    const sesiList = await listSeleksiSessions(b.examIdTertulis);
    const statSesi = { issued: 0, started: 0, submitted: 0, expired: 0 };
    sesiList.forEach(s => { statSesi[s.status] = (statSesi[s.status] ?? 0) + 1; });
    blocks.push(`
      <div class="mb-3 last:mb-0">
        <p class="text-xs text-gray-400 font-medium mb-1.5">${_esc(b.namaBimtek)}</p>
        <div class="grid grid-cols-4 gap-2 text-center text-xs">
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-lg font-bold text-gray-300">${statSesi.issued}</p><p class="text-gray-500">Belum Mulai</p></div>
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-lg font-bold text-yellow-400">${statSesi.started}</p><p class="text-gray-500">Sedang Ujian</p></div>
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-lg font-bold text-green-400">${statSesi.submitted}</p><p class="text-gray-500">Selesai</p></div>
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-lg font-bold text-gray-600">${statSesi.expired}</p><p class="text-gray-500">Kadaluarsa</p></div>
        </div>
      </div>`);
  }
  return blocks.join('') || '<p class="text-sm text-gray-500">Belum ada bimtek dengan exam tertaut.</p>';
}
```

Hapus blok lama "Link Ujian per Calon" (tabel copy-link satu-satu) sepenuhnya — sudah digantikan oleh self-service di halaman status pendaftar (Task 7). `_S.lulusAdminList`, `_S.examId`, `_S.examInfo` yang di-assign di akhir `_renderContent` dihapus juga (tidak dipakai lagi).

- [ ] **Step 5: Ganti event binding di `_bindContentEvents`**

Hapus binding lama: `btn-change-exam`, `btn-link-exam`, `btn-gen-links` (modal `_openGenerateLinksModal`), `.btn-copy-link` (dan fungsi `_openGenerateLinksModal`, `_openExamPicker` dihapus seluruhnya — tidak dipakai lagi).

Ganti binding `btn-sync-nilai` jadi:
```js
  document.getElementById('btn-sync-nilai')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-nilai');
    btn.disabled = true; btn.textContent = 'Memproses...';
    try {
      const { processed, failed } = await scoreSeleksiSubmissionsBulk(_S.siklus);
      showToast(`${processed} nilai disinkronkan${failed ? `, ${failed} gagal` : ''}`, failed ? 'info' : 'success');
      _renderContent();
    } catch (e) {
      showToast('Gagal sinkronkan nilai: ' + e.message, 'error');
      btn.disabled = false; btn.textContent = 'Sinkronkan Nilai (Semua Bimtek)';
    }
  });
```

Tambah binding baru untuk `btn-gen-links-bulk`:
```js
  document.getElementById('btn-gen-links-bulk')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-gen-links-bulk');
    const lulusAdminList = await _fetchLulusAdminList();
    if (!lulusAdminList.length) { showToast('Belum ada calon yang lolos administrasi di bimtek manapun.', 'info'); return; }
    btn.disabled = true; btn.textContent = 'Memproses...';
    try {
      const expiredAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const { created, skipped } = await generateSeleksiSessionsBulk(_S.siklus, lulusAdminList, expiredAt);
      showToast(`${created} sesi dibuat, ${skipped} sudah ada (dilewati)`, 'success');
      _renderContent();
    } catch (e) {
      showToast('Gagal: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Generate Magic Link (Semua Bimtek)';
    }
  });
```

Tambahkan helper `_fetchLulusAdminList` (query `calon_peserta` dengan `statusAdminOverall == 'lulus'` untuk tahun aktif — mirip query yang tadinya di `_renderContent` untuk `lulusAdminList`, sekarang dipindah jadi fungsi terpisah dipanggil on-demand):

```js
async function _fetchLulusAdminList() {
  try {
    const snap = await getDocs(query(
      collection(db, COL.CALON_PESERTA),
      where('tahun', '==', _S.tahun),
      where('statusAdminOverall', '==', 'lulus')
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}
```

Cek import di puncak file — `collection`, `doc`, `getDoc`, `getDocs`, `query`, `where`, `orderBy`, `updateDoc`, `Timestamp` dari `shared/db.js` sudah ada (dipakai versi lama), pastikan tetap lengkap untuk query di atas.

- [ ] **Step 6: Hapus stat card grid lama yang sudah usang**

Blok stat card di puncak `_renderContent` (sebelum "Konfigurasi Exam") memakai `lulusAdminCount` dan `statSesi` dari satu sesi/exam tunggal — sudah tidak relevan karena sesi sekarang per bimtek (digantikan `_renderMonitorPerBimtek` di Step 4). Cari dan hapus seluruh blok ini:

```js
      <!-- Stat cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${[
          ['Lulus Administrasi', lulusAdminCount, 'text-green-400'],
          ['Link Dikirim',  statSesi.issued,    'text-blue-400'],
          ['Sedang Ujian',  statSesi.started,   'text-yellow-400'],
          ['Selesai',       statSesi.submitted, 'text-gray-300'],
        ].map(([label, val, color]) => `
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p class="text-2xl font-bold ${color}">${val}</p>
            <p class="text-xs text-gray-500 mt-1">${label}</p>
          </div>`).join('')}
      </div>
```

Hapus juga deklarasi yang cuma dipakai blok ini dan sudah tidak dipakai di tempat lain: `examId` (sudah dihapus di Step 2), `examInfo`, `sesiList`, `sesiByNoPeserta`, `statSesi` di level atas `_renderContent`, serta baris `_S.examId = examId; _S.examInfo = examInfo; _S.lulusAdminList = lulusAdminList;` di akhir fungsi.

Verifikasi tidak ada sisa referensi field yang sudah dihapus:

Run: `grep -n "examInfo\|_S\.examId\|_S\.lulusAdminList\|lulusAdminCount\b" "admin/js/modules/rekrutmen/seleksi-tertulis.js"`
Expected: tidak ada output (semua referensi lama sudah bersih).

- [ ] **Step 7: Validasi sintaks**

Run: `node --check --input-type=module < "admin/js/modules/rekrutmen/seleksi-tertulis.js"`
Expected: exit 0, tidak ada output.

- [ ] **Step 8: Verifikasi manual di browser**

Server masih di `http://localhost:8791` (dari Task 4, restart kalau sudah dimatikan). Masuk Rekrutmen → Seleksi Tertulis. Cek: (a) kartu exam sekarang berupa daftar per bimtek dengan dropdown, (b) pilih exam untuk satu bimtek, pastikan tersimpan (reload halaman, cek dropdown masih terpilih), (c) klik "Generate Magic Link (Semua Bimtek)", pastikan toast sukses muncul dan tidak error di console (`read_console_messages` kalau tersedia), (d) bagian Monitor Ujian menampilkan blok per bimtek.

- [ ] **Step 9: Commit**

```bash
git add admin/js/modules/rekrutmen/seleksi-tertulis.js
git commit -m "feat: UI seleksi tertulis per bimtek — exam picker, generate & monitor bulk"
```

---

### Task 6: `penentuan.js` — ranking baca nilai per bimtek

**Files:**
- Modify: `admin/js/modules/rekrutmen/penentuan.js`

**Interfaces:**
- Konsumsi: `c.nilaiTertulis` sekarang map (dari Task 1), bukan angka

- [ ] **Step 1: Baca seluruh file untuk konteks penuh**

Baca `admin/js/modules/rekrutmen/penentuan.js` penuh (sebelumnya cuma di-grep sebagian saat brainstorm).

- [ ] **Step 2: Ubah query `orderBy('nilaiTertulis', 'desc')`**

Firestore tidak bisa `orderBy` pada field map. Cari baris (sekitar baris 59 versi lama):
```js
    orderBy('nilaiTertulis', 'desc')
```
Hapus `orderBy` ini dari query constraints (sorting dipindah ke client-side per bimtek, karena nilai yang relevan beda-beda tergantung bimtek yang sedang di-rank — lihat Step 3).

- [ ] **Step 3: Ubah logika ranking — baca nilai per bimtek**

Cari baris yang mengurutkan (sekitar baris 112 versi lama):
```js
    ranked[b.bimtekId].sort((a, z) => (z.nilaiTertulis ?? 0) - (a.nilaiTertulis ?? 0));
```
Ganti jadi:
```js
    ranked[b.bimtekId].sort((a, z) => (z.nilaiTertulis?.[b.bimtekId] ?? 0) - (a.nilaiTertulis?.[b.bimtekId] ?? 0));
```

Cari juga tampilan nilai di tabel (sekitar baris 182 versi lama):
```js
                <td class="px-4 py-2 text-right font-mono text-gray-300">${c.nilaiTertulis ?? '—'}</td>
```
Ganti jadi:
```js
                <td class="px-4 py-2 text-right font-mono text-gray-300">${c.nilaiTertulis?.[b.bimtekId] ?? '—'}</td>
```

Dan baris sekitar 210 versi lama:
```js
            <span class="text-gray-600">${c.nilaiTertulis ?? 'Tidak ujian'}</span>
```
Ganti jadi (perlu tahu `bimtekId` yang relevan di konteks baris ini — cek variabel yang tersedia di scope function tersebut, biasanya parameter `b`/`bimtek` dari loop luar; kalau context-nya beda, sesuaikan referensi bimtekId yang tersedia di scope situ):
```js
            <span class="text-gray-600">${c.nilaiTertulis?.[b.bimtekId] ?? 'Tidak ujian'}</span>
```

- [ ] **Step 4: Validasi sintaks**

Run: `node --check --input-type=module < "admin/js/modules/rekrutmen/penentuan.js"`
Expected: exit 0, tidak ada output.

- [ ] **Step 5: Verifikasi manual di browser**

Masuk Rekrutmen → Penentuan. Cek: tabel ranking per bimtek tampil tanpa error, nilai yang ditampilkan sesuai bimtek masing-masing blok (bukan angka yang sama di semua blok kalau calon punya nilai beda per bimtek).

- [ ] **Step 6: Commit**

```bash
git add admin/js/modules/rekrutmen/penentuan.js
git commit -m "fix: penentuan.js baca nilaiTertulis per bimtek, bukan field flat"
```

---

### Task 7: `pendaftar/js/api.js` + `pendaftar/js/pages/status.js` — self-service link ujian

**Files:**
- Modify: `pendaftar/js/api.js`
- Modify: `pendaftar/js/pages/status.js`

**Interfaces:**
- Konsumsi: `status_lookup.ujianTertulis[]` (ditulis oleh Task 3 `syncUjianTertulisStatusLookup`), `status_lookup.statusAdmin`/`statusAdminOverall` (ditulis oleh Task 1)

- [ ] **Step 1: Ubah default field saat submit pendaftaran baru**

Di `pendaftar/js/api.js`, cari payload `STATUS_LOOKUP` (sekitar baris 81-97 versi lama):
```js
  await setDoc(doc(db, COL.STATUS_LOOKUP, pendaftarId), {
    pendaftarId,
    email:             data.email.toLowerCase(),
    tahun,
    calonPesertaDocId: docId,
    nama:              payload.nama,
    instansi:          payload.instansi,
    provinsi:          payload.provinsi,
    statusAdmin:       payload.statusAdmin,
    statusAdminReason: null,
    statusTertulis:    null,
    nilaiTertulis:     null,
    statusFinal:       payload.statusFinal,
    bimtekIdTerpilih:  null,
    submittedAt:       payload.submittedAt,
    updatedAt:         payload.updatedAt
  });
```
Ganti field terkait status jadi format baru:
```js
  await setDoc(doc(db, COL.STATUS_LOOKUP, pendaftarId), {
    pendaftarId,
    email:              data.email.toLowerCase(),
    tahun,
    calonPesertaDocId:  docId,
    nama:               payload.nama,
    instansi:           payload.instansi,
    provinsi:           payload.provinsi,
    statusAdmin:        {},
    statusAdminOverall: 'pending',
    ujianTertulis:      [],
    statusFinal:        payload.statusFinal,
    bimtekIdTerpilih:   null,
    submittedAt:        payload.submittedAt,
    updatedAt:          payload.updatedAt
  });
```

Cari juga payload `CALON_PESERTA` di atasnya (sekitar baris 60-76 versi lama) yang set `statusAdmin: 'pending'` — ganti jadi:
```js
    statusAdmin:        {},
    statusAdminOverall: 'pending',
```

- [ ] **Step 2: Validasi sintaks `api.js`**

Run: `node --check --input-type=module < "pendaftar/js/api.js"`
Expected: exit 0, tidak ada output.

- [ ] **Step 3: Ubah `_renderResult` di `status.js` — step Seleksi Administrasi & Seleksi Tertulis**

Di `pendaftar/js/pages/status.js`, cari deklarasi `statusAdmin` mapping (baris ~71-75 versi lama):
```js
  const statusAdmin = {
    pending: { label: 'Menunggu Verifikasi', color: 'bg-yellow-100 text-yellow-700' },
    lulus:   { label: 'Lulus Administrasi',  color: 'bg-green-100 text-green-700' },
    gugur:   { label: 'Gugur Administrasi',  color: 'bg-red-100 text-red-700' }
  }[d.statusAdmin] ?? { label: d.statusAdmin, color: 'bg-gray-100 text-gray-600' };
```
Ganti jadi (pakai `statusAdminOverall`):
```js
  const statusAdmin = {
    pending: { label: 'Menunggu Verifikasi', color: 'bg-yellow-100 text-yellow-700' },
    lulus:   { label: 'Lulus Administrasi',  color: 'bg-green-100 text-green-700' },
    gugur:   { label: 'Gugur Administrasi',  color: 'bg-red-100 text-red-700' }
  }[d.statusAdminOverall] ?? { label: d.statusAdminOverall, color: 'bg-gray-100 text-gray-600' };
```

Hapus deklarasi `statusTertulis` lama (baris ~77-82 versi lama, tidak dipakai lagi — digantikan render per bimtek).

Cari langkah `steps` array (baris ~90-115 versi lama), ganti step "Seleksi Tertulis":
```js
    {
      label: 'Seleksi Tertulis',
      done: !!d.statusTertulis,
      detail: d.nilaiTertulis != null ? `Nilai: ${d.nilaiTertulis}` : null,
      status: statusTertulis ?? null
    },
```
jadi:
```js
    {
      label: 'Seleksi Tertulis',
      done: (d.ujianTertulis || []).length > 0 && d.ujianTertulis.every(u => u.status === 'submitted'),
      detail: null,
      status: null,
      customBody: _renderUjianTertulisList(d.ujianTertulis || [])
    },
```

- [ ] **Step 4: Render `customBody` di dalam loop `steps.map`**

Cari blok render tiap step (baris ~132-148 versi lama):
```js
        ${steps.map((step, i) => `
          <div class="flex gap-3">
            ...
            <div class="flex-1 pb-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-medium text-gray-700">${step.label}</p>
                ${step.status ? `<span class="text-xs px-2 py-0.5 rounded-full font-medium ${step.status.color}">${step.status.label}</span>` : ''}
              </div>
              ${step.detail ? `<p class="text-xs text-gray-500 mt-0.5">${_esc(step.detail)}</p>` : ''}
            </div>
          </div>`).join('')}
```
Tambahkan `${step.customBody || ''}` setelah baris `step.detail`:
```js
              ${step.detail ? `<p class="text-xs text-gray-500 mt-0.5">${_esc(step.detail)}</p>` : ''}
              ${step.customBody || ''}
```

- [ ] **Step 5: Tambah fungsi `_renderUjianTertulisList`**

Tambahkan fungsi baru (dekat `_esc`/`_fmtDate` di akhir file):

```js
function _renderUjianTertulisList(list) {
  if (!list.length) return '';
  return `
    <div class="mt-2 space-y-1.5">
      ${list.map(u => {
        if (u.status === 'submitted') {
          return `
            <div class="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <span class="text-xs text-gray-600">${_esc(u.namaBimtek)}</span>
              <span class="text-xs font-medium text-gray-700">${u.nilai != null ? `Nilai: ${u.nilai}` : 'Menunggu Penilaian'}</span>
            </div>`;
        }
        return `
          <div class="flex items-center justify-between gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <span class="text-xs text-gray-700">${_esc(u.namaBimtek)}</span>
            <a href="exam/?token=${encodeURIComponent(u.token)}" target="_blank"
               class="text-xs font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap">
              Mulai Ujian →
            </a>
          </div>`;
      }).join('')}
    </div>`;
}
```

- [ ] **Step 6: Validasi sintaks `status.js`**

Run: `node --check --input-type=module < "pendaftar/js/pages/status.js"`
Expected: exit 0, tidak ada output.

- [ ] **Step 7: Verifikasi manual di browser**

Server di `http://localhost:8791`. Buka `http://localhost:8791/pendaftar/#/status`. Masukkan nomor pendaftaran calon yang sudah punya sesi ujian tertulis (dari Task 5 langkah generate bulk). Cek: (a) step "Seleksi Administrasi" tampil status per keseluruhan (Lulus/Gugur/Pending), (b) step "Seleksi Tertulis" menampilkan daftar per bimtek dengan tombol "Mulai Ujian →" yang linknya mengandung token yang benar, (c) klik tombol itu, pastikan membuka `exam/?token=...` di tab baru dan exam app bisa load sesi.

- [ ] **Step 8: Commit**

```bash
git add pendaftar/js/api.js pendaftar/js/pages/status.js
git commit -m "feat: tampilkan link ujian tertulis self-service di Cek Status Pendaftaran"
```

---

### Task 8: Verifikasi end-to-end manual

**Files:** tidak ada perubahan file — task ini murni verifikasi alur penuh setelah semua task sebelumnya selesai.

- [ ] **Step 1: Susun skenario data uji**

Di admin panel (`http://localhost:8791/admin/`), pastikan sudah ada: satu siklus seleksi aktif dengan minimal 2 bimtek di `bimtekPilihan`, masing-masing punya `adminRules` dan satu exam bertipe `seleksi_tertulis` (dibuat lewat modul Bimtek → Bank Soal → Tab Ujian seperti biasa, published). Kalau belum ada, buat via UI admin yang sudah ada (bukan bagian dari plan ini, murni data setup).

- [ ] **Step 2: Alur penuh**

1. Submit satu pendaftaran baru lewat `http://localhost:8791/pendaftar/#/daftar` dengan `pilihanBimtekIds` mencakup kedua bimtek uji. Catat nomor pendaftarannya.
2. Di admin → Rekrutmen → Calon Peserta, klik "Terapkan Rules Otomatis" (atau set manual lewat modal Detail per bimtek).
3. Cek badge status calon itu jadi "Lulus (N bimtek)" sesuai rules yang dipenuhi.
4. Di admin → Rekrutmen → Seleksi Tertulis, pastikan kedua bimtek sudah punya exam tertaut (Task 5 Step 3), klik "Generate Magic Link (Semua Bimtek)".
5. Buka `http://localhost:8791/pendaftar/#/status`, masukkan nomor pendaftaran dari langkah 1. Pastikan muncul tombol "Mulai Ujian →" untuk tiap bimtek yang lolos administrasinya.
6. Klik salah satu tombol, kerjakan ujian sampai submit di `exam/` app (pakai flow yang sudah ada, tidak berubah).
7. Kembali ke admin → Seleksi Tertulis, klik "Sinkronkan Nilai (Semua Bimtek)".
8. Cek halaman status pendaftar lagi — bimtek yang sudah disubmit sekarang menampilkan nilai, bukan tombol "Mulai Ujian →".
9. Buka admin → Rekrutmen → Penentuan, pastikan calon itu muncul di blok bimtek yang sesuai dengan nilai yang benar (bukan tercampur dengan bimtek lain).

- [ ] **Step 3: Matikan server**

```bash
pkill -f "http.server 8791"
```

- [ ] **Step 4: Laporkan hasil**

Kalau semua langkah di Step 2 berhasil tanpa error console, laporkan ke user bahwa end-to-end verification lulus. Kalau ada langkah gagal, JANGAN commit apa pun di task ini — kembali ke task terkait, perbaiki, ulangi dari Step 1 task ini.

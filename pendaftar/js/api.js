// pendaftar/js/api.js
// Query Firestore untuk app pendaftar (publik, tanpa Firebase Auth).

import { db }     from '../../shared/firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, Timestamp
} from '../../shared/db.js';
import { COL } from '../../shared/constants.js';

// ─── Siklus Aktif ────────────────────────────────────────────

/** Ambil siklus yang pendaftarannya sedang dibuka (published=true). */
export async function getSiklusAktif() {
  const snap = await getDocs(
    query(
      collection(db, COL.SIKLUS_SELEKSI),
      where('phases.pendaftaran.published', '==', true)
    )
  );
  if (snap.empty) return null;
  // Ambil yang paling baru (tahun terbesar)
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => b.tahun - a.tahun);
  const siklus = list[0];

  // Merge deskripsi langsung dari bimtek docs agar selalu up-to-date
  const bimtekPilihan = siklus.bimtekPilihan || [];
  if (bimtekPilihan.length) {
    const bimtekDocs = await Promise.all(
      bimtekPilihan.map(b => getDoc(doc(db, COL.BIMTEK, b.bimtekId)))
    );
    siklus.bimtekPilihan = bimtekPilihan.map((b, i) => ({
      ...b,
      deskripsi: bimtekDocs[i].exists() ? (bimtekDocs[i].data().deskripsi || '') : (b.deskripsi || ''),
    }));
  }

  return siklus;
}

// ─── Submit Pendaftaran ───────────────────────────────────────

/**
 * Simpan pendaftar baru ke Firestore.
 * @param {object} data - data calon peserta lengkap
 * @returns {string} pendaftarId
 */
export async function submitPendaftaran(data) {
  const tahun       = data.tahun;
  const pendaftarId = _generatePendaftarId(tahun);
  const docId       = `${tahun}__${pendaftarId}`;

  const payload = {
    tahun,
    pendaftarId,
    nama:        data.nama,
    jenisKelamin: data.jenisKelamin || null,
    tempatLahir: data.tempatLahir || null,
    tanggalLahir: data.tanggalLahir || null,
    pendidikan:  data.pendidikan || null,
    jabatan:     data.jabatan || null,
    pengalamanTahun: data.pengalamanTahun ?? null,
    noHp:        data.noHp,
    email:       data.email,
    instansi:    data.instansi || null,
    unitKerja:   data.unitKerja || null,
    provinsi:    data.provinsi || null,
    kabKota:     data.kabKota || null,
    pilihanBimtekIds: data.pilihanBimtekIds || [],
    ktpUrl:      data.ktpUrl || null,
    statusAdmin: {},
    statusAdminOverall: 'pending',
    statusFinal: null,
    noPesertaAssigned: null,
    submittedAt: Timestamp.now(),
    updatedAt:   Timestamp.now()
  };

  await setDoc(doc(db, COL.CALON_PESERTA, docId), payload);

  // Salinan ringkas (tanpa data sensitif: noHp, ktpUrl) untuk lookup status publik tanpa login.
  await setDoc(doc(db, COL.STATUS_LOOKUP, pendaftarId), {
    pendaftarId,
    email:             data.email.toLowerCase(),
    tahun,
    calonPesertaDocId: docId,
    nama:              payload.nama,
    instansi:          payload.instansi,
    provinsi:          payload.provinsi,
    statusAdmin:       payload.statusAdmin,
    statusAdminOverall: payload.statusAdminOverall,
    statusTertulis:    null,
    nilaiTertulis:     null,
    statusFinal:       payload.statusFinal,
    bimtekIdTerpilih:  null,
    submittedAt:       payload.submittedAt,
    updatedAt:         payload.updatedAt
  });

  return pendaftarId;
}

// ─── Cek Status ──────────────────────────────────────────────

/**
 * Cari calon peserta berdasarkan pendaftarId atau email.
 * @param {string} query - pendaftarId atau email
 * @returns {object|null}
 */
export async function cekStatus(input) {
  input = input.trim();

  // Coba by pendaftarId dulu (format REG-YYYY-XXXXXX)
  if (/^REG-\d{4}-/i.test(input)) {
    const snap = await getDoc(doc(db, COL.STATUS_LOOKUP, input.toUpperCase()));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  }

  // Coba by email
  const snap = await getDocs(
    query(collection(db, COL.STATUS_LOOKUP), where('email', '==', input.toLowerCase()))
  );
  if (!snap.empty) {
    // Ambil yang terbaru
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
    return list[0];
  }

  return null;
}

// ─── Instansi (untuk autocomplete form pendaftaran) ──────────

/** Ambil daftar instansi_master yang berada di provinsi tertentu. */
export async function getInstansiByProvinsi(provinsi) {
  const snap = await getDocs(
    query(
      collection(db, COL.INSTANSI_MASTER),
      where('provinsiKode', '==', provinsi),
      where('deleted', '==', false)
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Upload KTP ──────────────────────────────────────────────

export async function uploadKtp(file, tahun, pendaftarId) {
  const { storage } = await import('../../shared/firebase-config.js');
  const { ref, uploadBytes, getDownloadURL } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js'
  );
  const ext     = file.name.split('.').pop();
  const path    = `ktp/${tahun}/${pendaftarId}.${ext}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

// ─── Helper ──────────────────────────────────────────────────

function _generatePendaftarId(tahun) {
  const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `REG-${tahun}-${suffix}`;
}

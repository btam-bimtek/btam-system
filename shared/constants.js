// shared/constants.js
// Konstanta global yang dipakai di admin app dan exam app.
// Jangan taruh logika bisnis di sini — hanya data statis.

// ─── Bidang ──────────────────────────────────────────────────
// Mirror dari collection bidang/{bidangId} di Firestore.
// Seed ini dipakai saat UI butuh list bidang sebelum Firestore load
// atau untuk validasi di-client tanpa query.
export const BIDANG_LIST = [
  { bidangId: 'produksi', nama: 'Produksi', color: '#3b82f6', active: true },
  { bidangId: 'trandis',  nama: 'Trandis',  color: '#10b981', active: true },
  { bidangId: 'me',       nama: 'ME',        color: '#f59e0b', active: true },
  { bidangId: 'pendukung',nama: 'Pendukung', color: '#8b5cf6', active: true }
];

export const BIDANG_MAP = Object.fromEntries(
  BIDANG_LIST.map(b => [b.bidangId, b])
);

// ─── Provinsi ───────────────────────────────────────────────────
// Daftar 38 provinsi RI. Dipakai di form pendaftar & instansi-master.
// Catatan: belum ada collection provinsi_master terisi, jadi dipakai sebagai
// daftar statis (bukan kode) — instansi_master.provinsiKode menyimpan nama ini langsung.
export const PROVINSI_LIST = [
  'Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi',
  'Bengkulu','Sumatera Selatan','Kepulauan Bangka Belitung','Lampung',
  'Banten','DKI Jakarta','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur',
  'Bali','Nusa Tenggara Barat','Nusa Tenggara Timur',
  'Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara',
  'Sulawesi Utara','Gorontalo','Sulawesi Tengah','Sulawesi Barat','Sulawesi Selatan','Sulawesi Tenggara',
  'Maluku','Maluku Utara','Papua Barat','Papua Barat Daya','Papua','Papua Tengah',
  'Papua Pegunungan','Papua Selatan'
];

// ─── Taksonomi Bloom ──────────────────────────────────────────
export const BLOOM_LEVELS = [
  { level: 'C1', nama: 'Mengingat',     defaultBobot: 1 },
  { level: 'C2', nama: 'Memahami',      defaultBobot: 2 },
  { level: 'C3', nama: 'Menerapkan',    defaultBobot: 3 },
  { level: 'C4', nama: 'Menganalisis',  defaultBobot: 4 },
  { level: 'C5', nama: 'Mengevaluasi',  defaultBobot: 5 },
  { level: 'C6', nama: 'Mencipta',      defaultBobot: 6 }
];

export const BLOOM_MAP = Object.fromEntries(
  BLOOM_LEVELS.map(b => [b.level, b])
);

// ─── Bimtek ───────────────────────────────────────────────────
export const BIMTEK_TIPE = {
  REGULER: 'reguler',
  PNBP:    'pnbp'
};

export const BIMTEK_MODE = {
  ONLINE:  'online',
  OFFLINE: 'offline'
};

export const BIMTEK_KAPASITAS = {
  online:  25,
  offline: 17
};

export const BIMTEK_STATUS = {
  DRAFT:      'draft',
  AKTIF:      'aktif',
  SELESAI:    'selesai',
  DIBATALKAN: 'dibatalkan'
};

// ─── Penilaian — Komponen & Bobot Default ────────────────────
// Bobot dalam persen, total harus 100 saat semua komponen aktif.
// Kalau komponen opsional (tugas/presentasi) dinonaktifkan,
// bobot didistribusikan ke komponen lain secara proporsional.
export const KOMPONEN_NILAI = [
  { id: 'pretest',     nama: 'Pre-Test',     bobotDefault: 10, opsional: false },
  { id: 'posttest',    nama: 'Post-Test',    bobotDefault: 30, opsional: false },
  { id: 'kehadiran',   nama: 'Kehadiran',    bobotDefault: 20, opsional: false },
  { id: 'pengajar',    nama: 'Nilai Pengajar', bobotDefault: 20, opsional: false },
  { id: 'keaktifan',   nama: 'Keaktifan',    bobotDefault: 10, opsional: false },
  { id: 'respek',      nama: 'Sikap & Respek', bobotDefault: 5, opsional: false },
  { id: 'tugas',       nama: 'Tugas',        bobotDefault: 0,  opsional: true },
  { id: 'presentasi',  nama: 'Presentasi',   bobotDefault: 0,  opsional: true }
];

// ─── Threshold Kelulusan Default ─────────────────────────────
export const DEFAULT_THRESHOLDS = {
  lulus:            70,  // nilai akhir >= 70 → LULUS
  kehadiranMinPct:  80,  // kehadiran >= 80% (syarat wajib ikut posttest)

  // Label deskriptif per rentang nilai (tidak boleh kata negatif)
  deskriptif: [
    { min: 90, max: 100, label: 'Sangat Kompeten' },
    { min: 80, max: 89,  label: 'Kompeten Unggul' },
    { min: 70, max: 79,  label: 'Kompeten' },
    { min: 60, max: 69,  label: 'Perlu Peningkatan' },
    { min: 0,  max: 59,  label: 'Perlu Pembinaan Lanjutan' }
  ]
};

// ─── Jadwal — Default Durasi ──────────────────────────────────
export const JADWAL_DEFAULTS = {
  JP_PER_MENIT:          45,   // 1 JP = 45 menit
  JP_MAX_SENIN_KAMIS:    9,
  JP_MAX_JUMAT:          7,    // karena ISHOMA Jumat panjang
  JP_MAPEL_MAX_JUMAT:    7,    // mapel > 7 JP tidak boleh di hari Jumat
  ISHOMA_JUMAT_START:   '11:15',
  ISHOMA_JUMAT_END:     '13:45',
  BREAK_PAGI_START:     '10:15',
  BREAK_PAGI_END:       '10:30',
  ISHOMA_NORMAL_START:  '12:00',
  ISHOMA_NORMAL_END:    '13:00',
  BREAK_SORE_START:     '15:30',
  BREAK_SORE_END:       '15:45',
  JAM_MULAI_DEFAULT:    '08:00'
};

// ─── Admin Roles ──────────────────────────────────────────────
export const ADMIN_ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN:      'admin',
  VIEWER:     'viewer'
};

// ─── Exam ─────────────────────────────────────────────────────
export const EXAM_TIPE = {
  PRETEST:           'pretest',
  POSTTEST:          'posttest',
  SELEKSI_TERTULIS:  'seleksi_tertulis'
};

export const EXAM_SESSION_STATUS = {
  ISSUED:    'issued',
  STARTED:   'started',
  SUBMITTED: 'submitted',
  EXPIRED:   'expired'
};

export const EXAM_DEFAULTS = {
  DURASI_MENIT:    60,
  MAX_WARNINGS:    5,
  AUTOSAVE_DETIK:  30
};

// ─── Pendidikan ───────────────────────────────────────────────
export const PENDIDIKAN_OPTIONS = ['SMA', 'D3', 'S1', 'S2', 'S3', 'Lainnya'];

// ─── Jenis Kelamin ────────────────────────────────────────────
export const JENIS_KELAMIN = { L: 'Laki-laki', P: 'Perempuan' };

// ─── Instansi Kategori ────────────────────────────────────────
export const INSTANSI_KATEGORI = [
  'pemerintah_pusat',
  'pemerintah_daerah',
  'bumn',
  'swasta',
  'lainnya'
];

export const INSTANSI_KATEGORI_LABEL = {
  pemerintah_pusat:  'Pemerintah Pusat',
  pemerintah_daerah: 'Pemerintah Daerah',
  bumn:              'BUMN',
  swasta:            'Swasta',
  lainnya:           'Lainnya'
};

// ─── Firestore collection names (single source of truth) ─────
export const COL = {
  ADMIN_USERS:        'admin_users',
  PESERTA_MASTER:     'peserta_master',
  PENGAJAR_MASTER:    'pengajar_master',
  INSTANSI_MASTER:    'instansi_master',
  BIDANG:             'bidang',
  PROVINSI_MASTER:    'provinsi_master',
  KABKOTA_MASTER:     'kabkota_master',
  UNIT_KOMPETENSI:  'unit_kompetensi',
  BANK_SOAL:          'bank_soal',
  BANK_SOAL_ANSWERS:  'bank_soal_answers',
  BIMTEK:             'bimtek',
  BIMTEK_SCORES:      'bimtek_scores',
  BIMTEK_ATTENDANCE:  'bimtek_attendance',
  EXAMS:              'exams',
  EXAM_SESSIONS:      'exam_sessions',
  EXAM_SUBMISSIONS:   'exam_submissions',
  EXAM_RESULTS:       'exam_results',
  APP_SETTINGS:       'app_settings',
  AUDIT_LOG:          'audit_log',
  ALUMNI_HISTORIS:    'alumni_historis',
  ALUMNI:             'alumni',
  KINERJA_INSTANSI:   'kinerja_instansi',
  SIKLUS_SELEKSI:     'siklus_seleksi',
  CALON_PESERTA:      'calon_peserta',
  PENENTUAN_PESERTA:  'penentuan_peserta',
  STATUS_LOOKUP:      'status_lookup'
};

// ─── Alumni Historis — nilai enum yang valid ──────────────────
export const HISTORIS_BIDANG = ['produksi', 'trandis', 'me', 'pendukung', 'multi_bidang'];
export const HISTORIS_TIPE   = ['reguler', 'pnbp', 'elearning'];
export const HISTORIS_MODE   = ['offline', 'online'];
export const HISTORIS_LOKASI = ['kabupaten', 'kota', 'regional', 'pusat'];

// ─── Rekrutmen ────────────────────────────────────────────────
export const SIKLUS_STATUS = {
  PLANNING:       'planning',
  PENDAFTARAN:    'pendaftaran',
  ADMINISTRASI:   'administrasi',
  TERTULIS:       'tertulis',
  PENENTUAN:      'penentuan',
  SELESAI:        'selesai'
};

export const SIKLUS_STATUS_LABEL = {
  planning:       'Perencanaan',
  pendaftaran:    'Pendaftaran Dibuka',
  administrasi:   'Seleksi Administrasi',
  tertulis:       'Seleksi Tertulis',
  penentuan:      'Penentuan Peserta',
  selesai:        'Selesai'
};

export const CALON_STATUS_ADMIN = {
  PENDING: 'pending',
  LULUS:   'lulus',
  GUGUR:   'gugur'
};

export const CALON_STATUS_FINAL = {
  TERPILIH:         'terpilih',
  CADANGAN:         'cadangan',
  TIDAK_TERPILIH:   'tidak_terpilih'
};

// Urutan ordinal pendidikan — dipakai untuk evaluasi rule "pendidikan minimal"
export const PENDIDIKAN_RANK = { SMA: 1, D3: 2, S1: 3, S2: 4, S3: 5 };

// Kriteria administrasi — field yang bisa dipakai di rule builder
// Catatan: pendidikan dievaluasi sebagai syarat MINIMAL (ordinal SMA < D3 < S1 < S2 < S3),
// bukan exact match — operator yang relevan hanya 'gte'.
export const ADMIN_RULE_FIELDS = [
  { value: 'pendidikan', label: 'Pendidikan (minimal)', type: 'select',
    options: ['SMA', 'D3', 'S1', 'S2', 'S3'], operators: ['gte'] },
  { value: 'pengalamanTahun', label: 'Pengalaman Kerja di Bidang (minimal, tahun)', type: 'number',
    operators: ['gte'] }
];

export const ADMIN_RULE_OPERATORS = {
  eq:       'sama dengan',
  not_eq:   'tidak sama dengan',
  in:       'termasuk salah satu dari',
  gte:      'lebih besar atau sama dengan',
  lte:      'lebih kecil atau sama dengan'
};

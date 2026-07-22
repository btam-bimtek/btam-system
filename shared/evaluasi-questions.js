// shared/evaluasi-questions.js
// Definisi pertanyaan evaluasi (fixed, bukan template dinamis) — satu sumber
// kebenaran dipakai Portal Peserta (form isi evaluasi) dan admin (tab
// Evaluasi di detail bimtek, laporan lintas bimtek).

export const RATING_LABEL = { 1: 'Tidak Baik', 2: 'Kurang Baik', 3: 'Cukup Baik', 4: 'Baik', 5: 'Sangat Baik' };

export const PERTANYAAN_PENYELENGGARA = [
  { key: 'persiapan',  label: 'Persiapan dan kelengkapan sarana/prasarana bimtek' },
  { key: 'jadwal',     label: 'Ketepatan dan kesesuaian jadwal pelaksanaan' },
  { key: 'konsumsi',   label: 'Layanan konsumsi dan akomodasi' },
  { key: 'komunikasi', label: 'Kualitas komunikasi dan informasi dari panitia' },
];

export const PERTANYAAN_KEPUASAN = [
  { key: 'materi',       label: 'Kesesuaian materi dengan kebutuhan pekerjaan Anda' },
  { key: 'manfaat',      label: 'Manfaat bimtek ini bagi peningkatan kompetensi Anda' },
  { key: 'kepuasanUmum', label: 'Kepuasan Anda secara keseluruhan terhadap bimtek ini' },
];

export const PERTANYAAN_PENGAJAR = [
  { key: 'penguasaanMateri', label: 'Penguasaan materi oleh pengajar' },
  { key: 'caraPenyampaian',  label: 'Cara penyampaian materi (mudah dipahami)' },
  { key: 'interaksi',        label: 'Interaksi dan responsivitas terhadap pertanyaan peserta' },
];

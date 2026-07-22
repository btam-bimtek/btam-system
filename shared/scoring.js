// shared/scoring.js
// Kategori kelulusan berdasarkan nilai akhir — dipakai admin (scorer, report) dan
// portal peserta (sertifikat), jadi satu sumber kebenaran di shared/.

export const KATEGORI_NILAI = [
  { min: 86, kategori: 'Sangat Baik',   lulus: true  },
  { min: 71, kategori: 'Baik',          lulus: true  },
  { min: 61, kategori: 'Cukup',         lulus: true  },
  { min: 51, kategori: 'Kurang',        lulus: false },
  { min: 0,  kategori: 'Sangat Kurang', lulus: false },
];

/**
 * Dapatkan kategori kelulusan dari nilai akhir (0-100).
 * @returns {{ min: number, kategori: string, lulus: boolean }}
 */
export function kategoriNilai(nilaiAkhir) {
  const n = nilaiAkhir ?? 0;
  return KATEGORI_NILAI.find(k => n >= k.min);
}

/**
 * Cek kelulusan berdasarkan nilai akhir (batas tetap 60) dan syarat kehadiran minimum 90%.
 * Jika kehadiranPct tersedia dan < 90, peserta otomatis belum lulus.
 * Parameter kkm dipertahankan untuk kompatibilitas signature lama tapi tidak lagi
 * dipakai — kriteria kelulusan sekarang memakai kategori nilai dengan batas tetap.
 */
export function cekKelulusan(nilaiAkhir, kkm, kehadiranPct = null) {
  if (kehadiranPct !== null && kehadiranPct < 90) return false;
  return kategoriNilai(nilaiAkhir).lulus;
}

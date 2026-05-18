// admin/js/modules/bimtek/report-narrative.js
// Utility: mapToLabel + generator narasi otomatis Section C peserta report.

/**
 * Petakan nilai numerik ke label deskriptif berdasarkan threshold array.
 * @param {number|null} value
 * @param {Array<{min: number, label: string}>} thresholds - sorted desc by min
 * @returns {string}
 */
export function mapToLabel(value, thresholds) {
  if (value == null) return 'Data tidak tersedia';
  const sorted = [...thresholds].sort((a, b) => b.min - a.min);
  for (const t of sorted) {
    if (value >= t.min) return t.label;
  }
  return sorted[sorted.length - 1]?.label ?? '-';
}

/**
 * Bangun narasi otomatis untuk Section C dari data per-EK.
 * Bahasa: "Peserta" atau "Bapak/Ibu [Nama]", formal, tidak menghakimi.
 *
 * @param {Array<{ekKey, ekNama, prePct, postPct, delta}>} ekComparison
 * @param {number|null} totalPre  - skor pretest keseluruhan (0-100)
 * @param {number|null} totalPost - skor posttest keseluruhan (0-100)
 * @param {string} pesertaNama
 * @returns {string} narasi HTML-escaped
 */
export function generateNarasi(ekComparison, totalPre, totalPost, pesertaNama) {
  const subjek = pesertaNama ? `Bapak/Ibu ${_esc(pesertaNama)}` : 'Peserta';

  // Edge case: tidak ada data EK
  if (!ekComparison || ekComparison.length === 0) {
    return `${subjek} telah mengikuti seluruh rangkaian kegiatan bimbingan teknis. Data perbandingan kompetensi per elemen belum tersedia.`;
  }

  const hasPredata  = ekComparison.some(ek => ek.prePct  != null);
  const hasPostdata = ekComparison.some(ek => ek.postPct != null);

  // Edge case: pre/post keduanya tidak ada
  if (!hasPredata && !hasPostdata) {
    return `${subjek} telah menyelesaikan kegiatan bimbingan teknis. Data evaluasi kompetensi belum tersedia untuk dianalisis.`;
  }

  // Edge case: hanya pretest (belum ada posttest)
  if (hasPredata && !hasPostdata) {
    const ekSorted = ekComparison.filter(ek => ek.prePct != null).sort((a, b) => (b.prePct ?? 0) - (a.prePct ?? 0));
    const tertinggi = ekSorted[0];
    const terendah  = ekSorted[ekSorted.length - 1];
    let narasi = `Berdasarkan hasil pre test, ${subjek} menunjukkan penguasaan tertinggi pada Elemen Kompetensi <strong>${_esc(tertinggi.ekNama)}</strong> (${tertinggi.prePct}%).`;
    if (terendah && terendah.ekKey !== tertinggi.ekKey) {
      narasi += ` Elemen Kompetensi <strong>${_esc(terendah.ekNama)}</strong> (${terendah.prePct}%) masih memerlukan pendalaman lebih lanjut.`;
    }
    return narasi;
  }

  // Edge case: hanya posttest (tidak ada pretest)
  if (!hasPredata && hasPostdata) {
    const ekSorted = ekComparison.filter(ek => ek.postPct != null).sort((a, b) => (b.postPct ?? 0) - (a.postPct ?? 0));
    const tertinggi = ekSorted[0];
    return `Berdasarkan hasil post test, ${subjek} menunjukkan penguasaan tertinggi pada Elemen Kompetensi <strong>${_esc(tertinggi.ekNama)}</strong> (${tertinggi.postPct}%).`;
  }

  // Normal: ada pre dan post
  const withDelta = ekComparison.filter(ek => ek.delta != null);

  // Edge case: hanya 1 EK
  if (withDelta.length === 1) {
    const ek = withDelta[0];
    const peningkatan = ek.delta >= 0
      ? `meningkat dari ${ek.prePct}% menjadi ${ek.postPct}%`
      : `berubah dari ${ek.prePct}% menjadi ${ek.postPct}%`;
    return `${subjek} menunjukkan penguasaan Elemen Kompetensi <strong>${_esc(ek.ekNama)}</strong> yang ${peningkatan}.`;
  }

  // Edge case: semua EK turun
  const allDown = withDelta.every(ek => ek.delta < 0);
  if (allDown) {
    return `Hasil post test ${subjek} menunjukkan penurunan pada sebagian besar elemen kompetensi. Disarankan untuk memperdalam penguasaan materi dan mengikuti bimbingan teknis pada periode berikutnya.`;
  }

  // Edge case: semua EK sama (delta = 0 semua)
  const allFlat = withDelta.every(ek => ek.delta === 0);
  if (allFlat) {
    return `Kompetensi ${subjek} relatif stabil dari awal hingga akhir kegiatan. Nilai pre test dan post test menunjukkan hasil yang konsisten di seluruh elemen kompetensi.`;
  }

  // Normal case: ada peningkatan
  const sortedByDelta = [...withDelta].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const top    = sortedByDelta[0];
  const bottom = sortedByDelta[sortedByDelta.length - 1];

  const deltaTotal = totalPost != null && totalPre != null ? totalPost - totalPre : null;
  const totalStr   = deltaTotal != null
    ? ` Secara keseluruhan, nilai post test ${deltaTotal >= 0 ? 'meningkat' : 'berubah'} ${Math.abs(deltaTotal)} poin dibanding pre test.`
    : '';

  let narasi = `${subjek} menunjukkan peningkatan paling signifikan pada Elemen Kompetensi <strong>${_esc(top.ekNama)}</strong> (dari ${top.prePct}% menjadi ${top.postPct}%).`;

  // Tambahkan EK yang masih perlu ditingkatkan (hanya yang nilai postPct rendah atau delta negatif)
  if (bottom.delta != null && (bottom.delta < 0 || (bottom.postPct != null && bottom.postPct < 60))) {
    if (bottom.ekKey !== top.ekKey) {
      narasi += ` Elemen Kompetensi <strong>${_esc(bottom.ekNama)}</strong> masih perlu didalami lebih lanjut (penguasaan akhir ${bottom.postPct ?? '-'}%).`;
    }
  }

  narasi += totalStr;
  return narasi;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

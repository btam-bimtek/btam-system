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
 * Bangun narasi analisis kompetensi Section C.4 — 5 paragraf mendalam.
 * Bahasa: formal, tidak menghakimi, berbasis data konkret per-EK.
 *
 * @param {Array<{ekKey, ekNama, prePct, postPct, delta}>} ekComparison
 * @param {number|null} totalPre  - skor pretest keseluruhan (0-100)
 * @param {number|null} totalPost - skor posttest keseluruhan (0-100)
 * @param {string} pesertaNama
 * @param {boolean|null} lulus   - status kelulusan (untuk rekomendasi)
 * @param {number|null} nilaiAkhir
 * @returns {string} narasi HTML (paragraf <p> dengan <strong>)
 */
export function generateNarasi(ekComparison, totalPre, totalPost, pesertaNama, lulus, nilaiAkhir) {
  const subjek = pesertaNama ? `Peserta ${_esc(pesertaNama)}` : 'Peserta';
  const p = s => `<p style="margin:0 0 10px 0; text-align:justify;">${s}</p>`;

  // ── Edge case: tidak ada data EK ───────────────────────────────────────────
  if (!ekComparison || ekComparison.length === 0) {
    return p(`${subjek} telah mengikuti seluruh rangkaian kegiatan bimbingan teknis. Data perbandingan kompetensi per elemen belum tersedia untuk dianalisis lebih lanjut.`);
  }

  const hasPredata  = ekComparison.some(ek => ek.prePct  != null);
  const hasPostdata = ekComparison.some(ek => ek.postPct != null);

  if (!hasPredata && !hasPostdata) {
    return p(`${subjek} telah menyelesaikan kegiatan bimbingan teknis. Data evaluasi kompetensi belum tersedia untuk dianalisis.`);
  }

  // ── Edge case: hanya pretest ───────────────────────────────────────────────
  if (hasPredata && !hasPostdata) {
    const sorted   = ekComparison.filter(ek => ek.prePct != null).sort((a, b) => b.prePct - a.prePct);
    const kuat     = sorted.filter(ek => ek.prePct >= 70);
    const lemah    = sorted.filter(ek => ek.prePct < 70);
    const jml      = sorted.length;

    let isi = `Berdasarkan hasil pre test terhadap ${jml} Elemen Kompetensi, ${subjek} menunjukkan profil kompetensi awal sebelum mengikuti kegiatan bimbingan teknis.`;
    if (kuat.length > 0) {
      isi += ` Penguasaan yang sudah baik (≥70%) terlihat pada ${kuat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}.`;
    }
    if (lemah.length > 0) {
      isi += ` Elemen kompetensi yang masih memerlukan penguatan meliputi ${lemah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}, dan menjadi fokus utama kegiatan bimbingan teknis yang akan diikuti.`;
    }
    return p(isi);
  }

  // ── Edge case: hanya posttest ──────────────────────────────────────────────
  if (!hasPredata && hasPostdata) {
    const sorted = ekComparison.filter(ek => ek.postPct != null).sort((a, b) => b.postPct - a.postPct);
    const kuat   = sorted.filter(ek => ek.postPct >= 70);
    const lemah  = sorted.filter(ek => ek.postPct < 70);

    let isi = `Berdasarkan hasil post test, ${subjek} menunjukkan profil penguasaan kompetensi akhir setelah mengikuti kegiatan bimbingan teknis.`;
    if (kuat.length > 0) {
      isi += ` Penguasaan yang baik (≥70%) dicapai pada ${kuat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.postPct}%)`).join(', ')}.`;
    }
    if (lemah.length > 0) {
      isi += ` Elemen kompetensi yang masih perlu ditingkatkan meliputi ${lemah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.postPct}%)`).join(', ')}.`;
    }
    const rekStr = lemah.length > 0
      ? ` Pendalaman mandiri pada elemen-elemen tersebut sangat dianjurkan.`
      : ` Seluruh kompetensi yang telah dicapai diharapkan dapat diterapkan dalam pelaksanaan tugas sehari-hari.`;
    return p(isi + rekStr);
  }

  // ── Kasus normal: ada pre dan post ────────────────────────────────────────
  const withDelta  = ekComparison.filter(ek => ek.delta != null);
  const deltaTotal = (totalPost != null && totalPre != null) ? totalPost - totalPre : null;
  const meningkat  = withDelta.filter(ek => ek.delta > 0).sort((a, b) => b.delta - a.delta);
  const stabil     = withDelta.filter(ek => ek.delta === 0);
  const menurun    = withDelta.filter(ek => ek.delta < 0).sort((a, b) => a.delta - b.delta);
  const paragraphs = [];

  // ── ¶1 Gambaran Umum ──────────────────────────────────────────────────────
  {
    const jml = withDelta.length;
    let isi = `Evaluasi kompetensi dilakukan terhadap ${jml} Elemen Kompetensi melalui mekanisme pre test dan post test.`;

    if (totalPre != null && totalPost != null) {
      const delta   = deltaTotal ?? 0;
      const pctChg  = totalPre > 0 ? Math.round(Math.abs(delta / totalPre) * 100) : 0;
      const arahStr = delta > 0
        ? `meningkat sebesar <strong>${delta} poin</strong> (+${pctChg}%)`
        : delta < 0
          ? `menurun sebesar <strong>${Math.abs(delta)} poin</strong> (${pctChg}%)`
          : `relatif stabil`;
      isi += ` Secara keseluruhan, ${subjek} memperoleh nilai post test sebesar <strong>${totalPost}</strong> dari sebelumnya <strong>${totalPre}</strong> pada saat pre test, ${arahStr}.`;
    }

    const jmlNaik = meningkat.length;
    const jmlTurun = menurun.length;
    if (jmlNaik === withDelta.length) {
      isi += ` Seluruh elemen kompetensi menunjukkan perkembangan positif, mengindikasikan efektivitas proses pembelajaran selama kegiatan berlangsung.`;
    } else if (jmlTurun === withDelta.length) {
      isi += ` Hasil evaluasi menunjukkan adanya penurunan pada seluruh elemen kompetensi, yang perlu mendapat perhatian dan tindak lanjut yang tepat.`;
    } else {
      isi += ` Dari ${withDelta.length} elemen yang dievaluasi, ${jmlNaik} elemen menunjukkan peningkatan${jmlTurun > 0 ? `, ${jmlTurun} elemen mengalami penurunan` : ''}${stabil.length > 0 ? `, dan ${stabil.length} elemen menunjukkan nilai yang stabil` : ''}.`;
    }
    paragraphs.push(p(isi));
  }

  // ── ¶2 Profil Penguasaan Awal ─────────────────────────────────────────────
  {
    const sorted  = withDelta.filter(ek => ek.prePct != null).sort((a, b) => b.prePct - a.prePct);
    const kuat    = sorted.filter(ek => ek.prePct >= 70);
    const lemah   = sorted.filter(ek => ek.prePct < 70);

    if (sorted.length > 0) {
      let isi = `Pada tahap awal sebelum kegiatan bimbingan teknis (pre test), `;
      if (kuat.length > 0 && lemah.length > 0) {
        isi += `${subjek} telah menunjukkan penguasaan yang baik (≥70%) pada ${kuat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}. `;
        isi += `Adapun ${lemah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')} teridentifikasi sebagai area yang masih memerlukan penguatan, sehingga menjadi sasaran utama pembelajaran dalam kegiatan bimbingan teknis.`;
      } else if (kuat.length > 0) {
        isi += `${subjek} telah menunjukkan penguasaan yang baik pada seluruh elemen kompetensi: ${kuat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}. Kegiatan bimbingan teknis berperan dalam memperdalam dan memperkuat kompetensi yang telah dimiliki.`;
      } else {
        isi += `seluruh elemen kompetensi masih memerlukan penguatan, yaitu ${lemah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}. Kondisi ini menjadikan kegiatan bimbingan teknis sebagai sarana yang sangat penting bagi ${subjek} untuk membangun fondasi kompetensi yang diperlukan.`;
      }
      paragraphs.push(p(isi));
    }
  }

  // ── ¶3 Pencapaian & Peningkatan ───────────────────────────────────────────
  if (meningkat.length > 0) {
    const signifikan = meningkat.filter(ek => ek.delta >= 15);
    const moderat    = meningkat.filter(ek => ek.delta >= 5 && ek.delta < 15);
    const kecil      = meningkat.filter(ek => ek.delta > 0  && ek.delta < 5);

    let isi = meningkat.length === withDelta.length
      ? `Setelah mengikuti kegiatan bimbingan teknis, ${subjek} berhasil menunjukkan peningkatan pada seluruh ${withDelta.length} elemen kompetensi yang dievaluasi.`
      : `Setelah mengikuti kegiatan bimbingan teknis, ${subjek} menunjukkan peningkatan pada ${meningkat.length} dari ${withDelta.length} elemen kompetensi.`;

    if (signifikan.length > 0) {
      isi += ` Peningkatan yang sangat signifikan (≥15 poin) terjadi pada ${signifikan.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (+${ek.delta} poin, dari ${ek.prePct}% menjadi ${ek.postPct}%)`).join('; ')}.`;
      // Interpretasi kualitatif
      const dariLemah = signifikan.filter(ek => ek.prePct < 70);
      if (dariLemah.length > 0) {
        isi += ` Peningkatan signifikan pada elemen yang sebelumnya masih lemah ini mengindikasikan keberhasilan proses pembelajaran dalam memperkuat fondasi kompetensi peserta.`;
      }
    }
    if (moderat.length > 0) {
      isi += ` Peningkatan moderat (5–14 poin) tercatat pada ${moderat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (+${ek.delta} poin, ${ek.prePct}% → ${ek.postPct}%)`).join('; ')}.`;
    }
    if (kecil.length > 0) {
      isi += ` Peningkatan kecil (<5 poin) terjadi pada ${kecil.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (+${ek.delta} poin, ${ek.prePct}% → ${ek.postPct}%)`).join('; ')}, yang menunjukkan adanya perkembangan meskipun masih perlu diperkuat lebih lanjut.`;
    }
    paragraphs.push(p(isi));
  }

  // ── ¶4 Area Perhatian ─────────────────────────────────────────────────────
  if (stabil.length > 0 || menurun.length > 0) {
    let isi = '';
    if (stabil.length > 0) {
      isi += `${stabil.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}% → ${ek.postPct}%)`).join(', ')} menunjukkan nilai yang relatif konsisten antara pre test dan post test. `;
      isi += `Stabilitas ini dapat dimaknai sebagai penguasaan yang sudah terbentuk sebelumnya, namun tetap memerlukan pendalaman lebih lanjut agar dapat berkembang secara optimal.`;
    }
    if (menurun.length > 0) {
      if (isi) isi += ` `;
      isi += `Di sisi lain, ${menurun.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}% → ${ek.postPct}%, ${ek.delta} poin)`).join('; ')} menunjukkan adanya penurunan nilai dari pre test ke post test. `;
      isi += menurun.length === 1
        ? `Kondisi ini perlu mendapat perhatian khusus dan pendalaman mandiri agar penguasaan elemen kompetensi tersebut dapat ditingkatkan kembali.`
        : `Kondisi ini perlu mendapat perhatian lebih lanjut. Pendalaman mandiri maupun keikutsertaan dalam kegiatan peningkatan kompetensi sejenis pada periode berikutnya sangat dianjurkan.`;
    }
    if (isi) paragraphs.push(p(isi));
  }

  // ── ¶5 Rekomendasi ────────────────────────────────────────────────────────
  {
    const ekPerlu   = [...stabil, ...menurun].sort((a, b) => (a.postPct ?? 0) - (b.postPct ?? 0));
    const ekTerbaik = [...meningkat].sort((a, b) => (b.postPct ?? 0) - (a.postPct ?? 0)).slice(0, 2);
    let isi = '';

    if (lulus === false) {
      isi = `Berdasarkan hasil evaluasi kompetensi di atas, ${subjek} disarankan untuk memperdalam materi bimbingan teknis secara mandiri`;
      if (ekPerlu.length > 0) {
        isi += `, dengan memprioritaskan penguatan pada ${ekPerlu.slice(0, 3).map(ek => `<strong>${_esc(ek.ekNama)}</strong>`).join(', ')}`;
      }
      isi += `. Keikutsertaan kembali dalam kegiatan bimbingan teknis pada periode berikutnya sangat dianjurkan guna mencapai standar kompetensi yang ditetapkan dan memperoleh sertifikat kelulusan.`;
    } else {
      isi = `Berdasarkan hasil evaluasi kompetensi di atas, ${subjek} diharapkan dapat mengaplikasikan penguasaan kompetensi yang telah dicapai`;
      if (ekTerbaik.length > 0) {
        isi += `—terutama pada ${ekTerbaik.map(ek => `<strong>${_esc(ek.ekNama)}</strong>`).join(' dan ')}—`;
      }
      isi += `dalam pelaksanaan tugas dan pekerjaan sehari-hari di instansi masing-masing. `;
      if (ekPerlu.length > 0) {
        isi += `Pendalaman lebih lanjut pada ${ekPerlu.slice(0, 2).map(ek => `<strong>${_esc(ek.ekNama)}</strong>`).join(' dan ')} tetap disarankan untuk memperkuat penguasaan kompetensi secara menyeluruh. `;
      }
      isi += `Semangat belajar dan komitmen terhadap peningkatan kompetensi yang ditunjukkan selama kegiatan ini diharapkan dapat terus dijaga sebagai bagian dari pengembangan profesionalisme di bidang air minum.`;
    }
    paragraphs.push(p(isi));
  }

  return paragraphs.join('');
}

/**
 * Bangun narasi deskriptif untuk komponen B.2 (Kehadiran, Keaktifan, Sikap & Respek).
 *
 * @param {'kehadiran'|'keaktifan'|'respek'} komponen
 * @param {string} label   - label kualitatif dari mapToLabel (misal "Sangat Baik")
 * @param {number|null} nilaiRaw - nilai numerik (0-100) untuk menentukan sentimen narasi
 * @param {string|null} fakta   - fakta tambahan (khusus kehadiran: "8 dari 10 sesi (80%)")
 * @returns {string} narasi (bisa mengandung <strong> tag)
 */
export function generateNarasiDeskriptif(komponen, label, nilaiRaw, fakta) {
  const v = nilaiRaw ?? 0;

  if (komponen === 'kehadiran') {
    const faktaStr = fakta ? `sebanyak ${fakta}` : `dengan tingkat kehadiran yang tercatat`;
    let elaborasi;
    if (v >= 90) {
      elaborasi = 'Konsistensi kehadiran yang sangat tinggi ini mencerminkan komitmen penuh peserta terhadap kegiatan bimbingan teknis dan mendukung penyerapan materi secara optimal.';
    } else if (v >= 75) {
      elaborasi = 'Kehadiran yang baik ini berkontribusi positif terhadap penyerapan materi dan pencapaian kompetensi selama kegiatan berlangsung.';
    } else if (v >= 60) {
      elaborasi = 'Meskipun beberapa sesi tidak dapat diikuti, peserta telah memenuhi persyaratan kehadiran minimum yang ditetapkan. Peningkatan kehadiran pada kegiatan berikutnya sangat dianjurkan.';
    } else {
      elaborasi = 'Tingkat kehadiran yang masih perlu ditingkatkan ini dapat mempengaruhi penyerapan materi secara keseluruhan. Diharapkan pada kegiatan bimbingan teknis berikutnya peserta dapat lebih konsisten mengikuti seluruh rangkaian kegiatan.';
    }
    return `Peserta mengikuti kegiatan bimbingan teknis ${faktaStr}. Tingkat kehadiran ini tergolong <strong>${_esc(label)}</strong>. ${elaborasi}`;
  }

  if (komponen === 'keaktifan') {
    let elaborasi;
    if (v >= 85) {
      elaborasi = 'Peserta secara aktif berpartisipasi dalam sesi diskusi, tanya jawab, dan kegiatan kelompok yang diselenggarakan. Keaktifan yang tinggi ini berkontribusi positif terhadap dinamika pembelajaran di kelas dan mencerminkan antusiasme yang kuat terhadap materi yang disampaikan.';
    } else if (v >= 70) {
      elaborasi = 'Peserta menunjukkan partisipasi yang baik dalam kegiatan diskusi dan tanya jawab, serta berkontribusi dalam kegiatan kelompok yang dilaksanakan selama bimbingan teknis berlangsung.';
    } else if (v >= 55) {
      elaborasi = 'Peserta cukup terlibat dalam kegiatan pembelajaran. Peningkatan partisipasi aktif dalam sesi diskusi dan tanya jawab diharapkan dapat memperdalam pemahaman dan penguasaan materi pada kegiatan mendatang.';
    } else {
      elaborasi = 'Partisipasi aktif peserta dalam kegiatan diskusi dan tanya jawab masih perlu ditingkatkan guna memaksimalkan manfaat yang dapat diperoleh dari kegiatan bimbingan teknis.';
    }
    return `Selama mengikuti kegiatan bimbingan teknis, peserta menunjukkan tingkat keaktifan yang tergolong <strong>${_esc(label)}</strong>. ${elaborasi}`;
  }

  if (komponen === 'respek') {
    let elaborasi;
    if (v >= 85) {
      elaborasi = 'Peserta senantiasa memperlihatkan etika komunikasi yang baik, menghargai pendapat pengajar dan panitia maupun sesama peserta, serta menjaga ketertiban dan kekondusifan suasana pembelajaran sepanjang kegiatan berlangsung.';
    } else if (v >= 70) {
      elaborasi = 'Peserta memperlihatkan sikap yang baik dalam berinteraksi dengan pengajar dan panitia dan sesama peserta, serta menjaga kekondusifan suasana selama kegiatan bimbingan teknis berlangsung.';
    } else if (v >= 55) {
      elaborasi = 'Peserta cukup menjaga etika dan sikap selama kegiatan. Peningkatan dalam hal menghargai sesi dan menjaga ketertiban diharapkan dapat mendukung suasana pembelajaran yang lebih kondusif bagi seluruh peserta.';
    } else {
      elaborasi = 'Terdapat beberapa aspek terkait sikap dan respek yang perlu mendapatkan perhatian lebih lanjut guna menciptakan suasana pembelajaran yang kondusif dan produktif bagi seluruh peserta kegiatan.';
    }
    return `Selama kegiatan bimbingan teknis berlangsung, peserta menunjukkan sikap dan respek yang tergolong <strong>${_esc(label)}</strong> terhadap pengajar dan panitia maupun sesama peserta. ${elaborasi}`;
  }

  return `Komponen ini tergolong <strong>${_esc(label)}</strong>.`;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

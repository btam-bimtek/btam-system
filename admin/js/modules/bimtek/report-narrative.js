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
    const stabilTinggi = stabil.filter(ek => (ek.postPct ?? 0) >= 70);
    const stabilRendah = stabil.filter(ek => (ek.postPct ?? 0) < 70);
    let isi = '';

    if (stabilTinggi.length > 0) {
      isi += `${stabilTinggi.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.postPct}%)`).join(', ')} menunjukkan nilai yang konsisten dan sudah berada pada level yang baik. `;
      isi += `Penguasaan yang telah dicapai pada elemen ini perlu terus dipertahankan melalui penerapan langsung di lapangan.`;
    }
    if (stabilRendah.length > 0) {
      if (isi) isi += ` `;
      isi += `${stabilRendah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}% → ${ek.postPct}%)`).join(', ')} menunjukkan nilai yang belum berkembang dan masih memerlukan pendalaman lebih lanjut.`;
    }
    if (menurun.length > 0) {
      if (isi) isi += ` `;
      isi += `Di sisi lain, ${menurun.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}% → ${ek.postPct}%, ${ek.delta} poin)`).join('; ')} menunjukkan penurunan nilai dari pre test ke post test. `;
      isi += menurun.length === 1
        ? `Kondisi ini perlu mendapat perhatian khusus dan pendalaman mandiri agar penguasaan elemen kompetensi tersebut dapat ditingkatkan kembali.`
        : `Kondisi ini perlu mendapat perhatian lebih lanjut. Pendalaman mandiri maupun keikutsertaan dalam kegiatan peningkatan kompetensi sejenis pada periode berikutnya sangat dianjurkan.`;
    }
    if (isi) paragraphs.push(p(isi));
  }

  return paragraphs.join('');
}

/**
 * Bangun narasi rekomendasi tindak lanjut Section C.5 — elaboratif, 4 paragraf.
 *
 * @param {Array<{ekKey, ekNama, prePct, postPct, delta}>} ekComparison
 * @param {boolean|null} lulus
 * @param {number|null}  nilaiAkhir
 * @param {string}       pesertaNama
 * @returns {string} HTML paragraf
 */
export function generateRekomendasi(ekComparison, lulus, nilaiAkhir, pesertaNama) {
  const subjek = pesertaNama ? `Peserta ${_esc(pesertaNama)}` : 'Peserta';
  const p  = s => `<p style="margin:0 0 10px 0; text-align:justify;">${s}</p>`;
  const li = s => `<li style="margin-bottom:6px;">${s}</li>`;

  const withDelta = (ekComparison || []).filter(ek => ek.delta != null);
  const meningkat = withDelta.filter(ek => ek.delta > 0).sort((a, b) => b.postPct - a.postPct);
  const stabil    = withDelta.filter(ek => ek.delta === 0);
  const menurun   = withDelta.filter(ek => ek.delta < 0).sort((a, b) => a.postPct - b.postPct);
  // Hanya EK yang menurun, atau stabil tapi skornya masih rendah (<70%)
  const ekPerlu   = [...menurun, ...stabil.filter(ek => (ek.postPct ?? 0) < 70)]
                      .sort((a, b) => (a.postPct ?? 0) - (b.postPct ?? 0));
  const ekTerbaik = meningkat.slice(0, 2);
  const paragraphs = [];

  // ── LULUS ─────────────────────────────────────────────────────────────────
  if (lulus !== false) {
    // ¶1 — Apresiasi & capaian
    let p1 = `${subjek} telah berhasil menyelesaikan kegiatan bimbingan teknis`;
    p1 += nilaiAkhir != null ? ` dengan nilai akhir <strong>${nilaiAkhir}</strong> dan dinyatakan <strong>LULUS</strong>.` : ` dan dinyatakan lulus.`;
    p1 += ` Pencapaian ini merupakan bukti nyata dari kesungguhan, komitmen, dan kerja keras yang ditunjukkan selama mengikuti seluruh rangkaian kegiatan. Penyelenggara mengucapkan apresiasi yang setinggi-tingginya atas dedikasi yang telah diperlihatkan.`;
    paragraphs.push(p(p1));

    // ¶2 — Penerapan kompetensi di tempat kerja
    let p2 = `Kompetensi yang telah dikuasai melalui kegiatan ini diharapkan dapat segera diimplementasikan secara nyata dalam pelaksanaan tugas dan tanggung jawab sehari-hari di instansi masing-masing.`;
    if (ekTerbaik.length > 0) {
      p2 += ` Khususnya pada ${ekTerbaik.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (penguasaan akhir ${ek.postPct}%)`).join(' dan ')}, penguasaan yang telah dicapai perlu dikonsolidasikan melalui penerapan langsung di lapangan.`;
    }
    p2 += ` Penerapan langsung merupakan cara paling efektif untuk mengukuhkan pemahaman teoretis yang telah diperoleh selama kegiatan bimbingan teknis menjadi keterampilan teknis yang melekat dan dapat diandalkan.`;
    paragraphs.push(p(p2));

    // ¶3 — Pendalaman lanjutan (jika ada EK yang perlu perhatian)
    if (ekPerlu.length > 0) {
      const ekList = ekPerlu.slice(0, 3).map(ek =>
        `<strong>${_esc(ek.ekNama)}</strong> (penguasaan akhir ${ek.postPct ?? '-'}%${ek.delta < 0 ? ', mengalami penurunan' : ', stabil'})`
      ).join('; ');
      let p3 = `Meskipun telah dinyatakan lulus, terdapat beberapa elemen kompetensi yang masih memerlukan perhatian dan pendalaman lebih lanjut, yaitu ${ekList}. `;
      p3 += `Beberapa langkah yang dapat dilakukan untuk memperkuat penguasaan pada elemen-elemen tersebut antara lain: `;
      p3 += `<ol style="margin:8px 0 0 0; padding-left:20px;">`;
      p3 += li(`Mempelajari kembali materi dan modul bimbingan teknis yang berkaitan dengan elemen kompetensi tersebut secara mandiri.`);
      p3 += li(`Berdiskusi dan berkonsultasi dengan rekan kerja atau atasan yang memiliki pengalaman dan keahlian di bidang terkait.`);
      p3 += li(`Mengidentifikasi kasus atau permasalahan nyata di tempat kerja yang berkaitan dengan elemen kompetensi tersebut, dan berupaya menyelesaikannya dengan mengacu pada materi yang telah dipelajari.`);
      p3 += li(`Mengikuti kegiatan peningkatan kompetensi lanjutan, seminar teknis, atau forum diskusi yang relevan.`);
      p3 += `</ol>`;
      paragraphs.push(p(p3));
    }

    // ¶4 — Pengembangan profesional berkelanjutan
    let p4 = `Sebagai bagian dari upaya pengembangan profesionalisme yang berkelanjutan, ${subjek} didorong untuk senantiasa memperbarui pengetahuan dan keterampilan teknis di bidang air minum, `;
    p4 += `seiring dengan perkembangan regulasi, standar teknis, teknologi, dan praktik terbaik yang terus berkembang. `;
    p4 += `Komitmen terhadap pembelajaran sepanjang hayat merupakan fondasi penting bagi setiap insan teknis yang ingin memberikan kontribusi terbaik bagi pelayanan air minum yang berkualitas di Indonesia.`;
    paragraphs.push(p(p4));

  // ── BELUM LULUS ───────────────────────────────────────────────────────────
  } else {
    // ¶1 — Kondisi & non-judgmental
    let p1 = `Berdasarkan hasil evaluasi, ${subjek} memperoleh nilai akhir`;
    p1 += nilaiAkhir != null ? ` <strong>${nilaiAkhir}</strong>` : '';
    p1 += ` dan dinyatakan belum memenuhi standar kelulusan yang ditetapkan. `;
    p1 += `Kondisi ini bukan merupakan hambatan yang bersifat final, melainkan merupakan petunjuk yang sangat berharga mengenai area-area kompetensi yang masih dapat dan perlu ditingkatkan. `;
    p1 += `Penyelenggara meyakini bahwa dengan upaya pendalaman yang lebih intensif dan terstruktur, ${subjek} memiliki potensi yang sangat baik untuk mencapai standar kompetensi yang ditetapkan.`;
    paragraphs.push(p(p1));

    // ¶2 — Prioritas penguatan
    if (ekPerlu.length > 0) {
      const sorted = ekPerlu.slice(0, 4);
      let p2 = `Berdasarkan profil hasil evaluasi, elemen kompetensi yang perlu mendapatkan perhatian lebih lanjut adalah: `;
      p2 += `<ul style="margin:8px 0 0 0; padding-left:20px;">`;
      p2 += sorted.map(ek => {
        const kondisi = ek.delta < 0
          ? `mengalami penurunan dari ${ek.prePct}% menjadi ${ek.postPct}%`
          : `masih berada di angka ${ek.postPct}% dan memerlukan penguatan`;
        return li(`<strong>${_esc(ek.ekNama)}</strong> — ${kondisi}.`);
      }).join('');
      p2 += `</ul>`;
      paragraphs.push(p(p2));
    } else if (withDelta.length > 0) {
      // Semua EK nilainya sudah baik — kegagalan dari komponen penilaian lain
      const p2 = `Penguasaan elemen kompetensi ${subjek} secara keseluruhan sudah menunjukkan hasil yang baik. Peningkatan nilai akhir pada kegiatan berikutnya dapat difokuskan pada komponen penilaian lainnya seperti kehadiran, keaktifan, tugas, dan presentasi selama kegiatan berlangsung.`;
      paragraphs.push(p(p2));
    }

    // ¶3 — Langkah konkret
    let p3 = `Untuk mempersiapkan diri mengikuti kegiatan bimbingan teknis pada periode berikutnya, berikut adalah langkah-langkah konkret yang disarankan: `;
    p3 += `<ol style="margin:8px 0 0 0; padding-left:20px;">`;
    p3 += li(`<strong>Pendalaman mandiri:</strong> Pelajari kembali seluruh modul dan materi bimbingan teknis yang telah diberikan, dengan memberikan penekanan khusus pada elemen-elemen kompetensi yang nilainya masih di bawah standar.`);
    p3 += li(`<strong>Konsultasi dan diskusi:</strong> Manfaatkan kesempatan untuk berdiskusi dengan rekan kerja, atasan, atau tenaga ahli yang berpengalaman di bidang yang relevan guna mendapatkan pemahaman yang lebih mendalam dan praktis.`);
    p3 += li(`<strong>Praktik di lapangan:</strong> Coba terapkan konsep dan materi yang telah dipelajari dalam pekerjaan sehari-hari. Pengalaman praktis langsung akan sangat membantu memperkuat pemahaman yang diperoleh secara teoretis.`);
    p3 += li(`<strong>Referensi tambahan:</strong> Pelajari regulasi, standar nasional (SNI), dan pedoman teknis terkait bidang air minum yang berlaku sebagai referensi tambahan untuk memperluas wawasan dan penguasaan teknis.`);
    p3 += li(`<strong>Keikutsertaan kembali:</strong> Daftarkan diri untuk mengikuti kegiatan bimbingan teknis pada periode penyelenggaraan berikutnya. Informasi mengenai jadwal dan pendaftaran dapat diperoleh dari penyelenggara.`);
    p3 += `</ol>`;
    paragraphs.push(p(p3));

    // ¶4 — Motivasi & harapan
    let p4 = `Penyelenggara sangat mengapresiasi kesediaan dan semangat ${subjek} dalam mengikuti kegiatan bimbingan teknis ini. `;
    p4 += `Setiap proses pembelajaran memiliki dinamikanya masing-masing, dan kegigihan untuk terus berkembang merupakan kualitas yang paling menentukan dalam perjalanan peningkatan kompetensi. `;
    p4 += `Penyelenggara berharap ${subjek} tidak berkecil hati, dan menyambut keikutsertaan kembali pada kesempatan berikutnya dengan persiapan yang lebih matang demi mencapai standar kompetensi yang ditetapkan.`;
    paragraphs.push(p(p4));
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

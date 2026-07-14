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

 * Bahasa: formal, tidak menghakimi, berbasis data konkret per-UK.

 *

 * @param {Array<{ekKey, ekNama, prePct, postPct, delta}>} ekComparison

 * @param {number|null} totalPre  - skor pretest keseluruhan (0-100)

 * @param {number|null} totalPost - skor posttest keseluruhan (0-100)

 * @param {string} pesertaNama

 * @param {boolean|null} lulus   - status kelulusan (untuk rekomendasi)

 * @param {number|null} nilaiAkhir

 * @returns {string} narasi HTML (paragraf <p> dengan <strong>)

 */

export function generateNarasi(ekComparison, totalPre, totalPost, pesertaNama, lulus, nilaiAkhir, kkm = 60) {

  const subjek = pesertaNama ? `Peserta ${_esc(pesertaNama)}` : 'Peserta';

  const p = s => `<p style="margin:0 0 10px 0; text-align:justify;">${s}</p>`;



  // ── Edge case: tidak ada data UK ───────────────────────────────────────────

  if (!ekComparison || ekComparison.length === 0) {

    return p(`${subjek} telah mengikuti seluruh rangkaian kegiatan bimbingan teknis ini. Data perbandingan penguasaan kompetensi per unit belum tersedia sehingga analisis lebih lanjut tidak dapat dilakukan pada saat ini.`);

  }



  const hasPredata  = ekComparison.some(ek => ek.prePct  != null);

  const hasPostdata = ekComparison.some(ek => ek.postPct != null);



  if (!hasPredata && !hasPostdata) {

    return p(`${subjek} telah menyelesaikan kegiatan bimbingan teknis. Data hasil penilaian kompetensi belum tersedia sehingga analisis capaian tidak dapat disajikan pada saat ini.`);

  }



  // ── Edge case: hanya pretest ───────────────────────────────────────────────

  if (hasPredata && !hasPostdata) {

    const sorted   = ekComparison.filter(ek => ek.prePct != null).sort((a, b) => b.prePct - a.prePct);

    const kuat     = sorted.filter(ek => ek.prePct >= 70);

    const lemah    = sorted.filter(ek => ek.prePct < 70);

    const jml      = sorted.length;



    let isi = `Berdasarkan hasil pre test pada ${jml} Unit Kompetensi, ${subjek} memperlihatkan profil penguasaan kompetensi awal sebelum mengikuti kegiatan bimbingan teknis.`;

    if (kuat.length > 0) {

      isi += ` Penguasaan yang telah memadai (≥70%) terlihat pada ${kuat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}.`;

    }

    if (lemah.length > 0) {

      isi += ` Adapun unit kompetensi yang masih memerlukan penguatan meliputi ${lemah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}, yang menjadi fokus utama pembelajaran dalam kegiatan bimbingan teknis ini.`;

    }

    return p(isi);

  }



  // ── Edge case: hanya posttest ──────────────────────────────────────────────

  if (!hasPredata && hasPostdata) {

    const sorted = ekComparison.filter(ek => ek.postPct != null).sort((a, b) => b.postPct - a.postPct);

    const kuat   = sorted.filter(ek => ek.postPct >= 70);

    const lemah  = sorted.filter(ek => ek.postPct < 70);



    let isi = `Berdasarkan hasil post test, ${subjek} memperlihatkan profil penguasaan kompetensi akhir setelah mengikuti seluruh rangkaian kegiatan bimbingan teknis.`;

    if (kuat.length > 0) {

      isi += ` Penguasaan yang memadai (≥70%) berhasil dicapai pada ${kuat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.postPct}%)`).join(', ')}.`;

    }

    if (lemah.length > 0) {

      isi += ` Sementara itu, unit kompetensi yang masih perlu ditingkatkan meliputi ${lemah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.postPct}%)`).join(', ')}.`;

    }

    const rekStr = lemah.length > 0

      ? ` Pendalaman secara mandiri pada unit-unit tersebut sangat dianjurkan guna memperkuat penguasaan kompetensi.`

      : ` Seluruh kompetensi yang telah dicapai diharapkan dapat segera diterapkan dalam pelaksanaan tugas dan tanggung jawab sehari-hari.`;

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

    let isi = `Evaluasi kompetensi dilakukan terhadap ${jml} Unit Kompetensi menggunakan instrumen pre test dan post test.`;



    if (totalPre != null && totalPost != null) {

      const delta   = deltaTotal ?? 0;

      const pctChg  = totalPre > 0 ? Math.round(Math.abs(delta / totalPre) * 100) : 0;

      const arahStr = delta > 0

        ? `meningkat sebesar <strong>${delta} poin</strong> (+${pctChg}%)`

        : delta < 0

          ? `menurun sebesar <strong>${Math.abs(delta)} poin</strong> (${pctChg}%)`

          : `relatif stabil`;

      isi += ` Secara keseluruhan, ${subjek} memperoleh nilai post test sebesar <strong>${totalPost}</strong>, dibandingkan nilai pre test sebelumnya sebesar <strong>${totalPre}</strong>, dengan perubahan yang ${arahStr}.`;

    }



    const jmlNaik = meningkat.length;

    const jmlTurun = menurun.length;

    if (jmlNaik === withDelta.length) {

      isi += ` Seluruh unit kompetensi menunjukkan perkembangan yang positif, mencerminkan efektivitas proses pembelajaran selama kegiatan berlangsung.`;

    } else if (jmlTurun === withDelta.length) {

      isi += ` Hasil penilaian menunjukkan adanya penurunan pada seluruh unit kompetensi, sehingga diperlukan perhatian dan tindak lanjut yang tepat.`;

    } else {

      isi += ` Dari ${withDelta.length} unit yang dinilai, ${jmlNaik} unit menunjukkan peningkatan${jmlTurun > 0 ? `, ${jmlTurun} unit mengalami penurunan` : ''}${stabil.length > 0 ? `, dan ${stabil.length} unit menunjukkan nilai yang stabil` : ''}.`;

    }

    paragraphs.push(p(isi));

  }



  // ── ¶2 Profil Penguasaan Awal ─────────────────────────────────────────────

  {

    const sorted  = withDelta.filter(ek => ek.prePct != null).sort((a, b) => b.prePct - a.prePct);

    const kuat    = sorted.filter(ek => ek.prePct >= 70);

    const lemah   = sorted.filter(ek => ek.prePct < 70);



    if (sorted.length > 0) {

      let isi = `Berdasarkan hasil pre test yang dilaksanakan sebelum kegiatan bimbingan teknis, `;

      if (kuat.length > 0 && lemah.length > 0) {

        isi += `${subjek} telah memperlihatkan penguasaan yang memadai (≥70%) pada ${kuat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}. `;

        isi += `Sementara itu, ${lemah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')} teridentifikasi sebagai materi yang masih memerlukan penguatan, sehingga menjadi sasaran utama pembelajaran dalam kegiatan ini.`;

      } else if (kuat.length > 0) {

        isi += `${subjek} telah memperlihatkan penguasaan yang memadai pada seluruh unit kompetensi, yaitu ${kuat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}. Kegiatan bimbingan teknis berperan dalam memperdalam dan memperkuat kompetensi yang telah dimiliki tersebut.`;

      } else {

        isi += `seluruh unit kompetensi masih memerlukan penguatan, yaitu ${lemah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}%)`).join(', ')}. Hal ini menjadikan kegiatan bimbingan teknis sebagai sarana yang sangat penting bagi ${subjek} untuk membangun fondasi kompetensi yang diperlukan.`;

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

      ? `Setelah mengikuti kegiatan bimbingan teknis, ${subjek} berhasil menunjukkan peningkatan pada seluruh ${withDelta.length} unit kompetensi yang dinilai.`

      : `Setelah mengikuti kegiatan bimbingan teknis, ${subjek} menunjukkan peningkatan pada ${meningkat.length} dari ${withDelta.length} unit kompetensi yang dinilai.`;



    if (signifikan.length > 0) {

      isi += ` Peningkatan yang signifikan (≥15 poin) tercatat pada ${signifikan.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (+${ek.delta} poin, dari ${ek.prePct}% menjadi ${ek.postPct}%)`).join('; ')}.`;

      const dariLemah = signifikan.filter(ek => ek.prePct < 70);

      if (dariLemah.length > 0) {

        isi += ` Peningkatan pada unit yang sebelumnya berada di bawah standar ini mencerminkan keberhasilan proses pembelajaran dalam membangun dan memperkuat fondasi kompetensi peserta.`;

      }

    }

    if (moderat.length > 0) {

      isi += ` Peningkatan yang cukup berarti (5–14 poin) tercatat pada ${moderat.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (+${ek.delta} poin, ${ek.prePct}% → ${ek.postPct}%)`).join('; ')}.`;

    }

    if (kecil.length > 0) {

      isi += ` Peningkatan yang relatif kecil (kurang dari 5 poin) tercatat pada ${kecil.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (+${ek.delta} poin, ${ek.prePct}% → ${ek.postPct}%)`).join('; ')}, yang menunjukkan adanya perkembangan positif meskipun masih diperlukan penguatan lebih lanjut.`;

    }

    paragraphs.push(p(isi));

  }



  // ── ¶4 Area Perhatian ─────────────────────────────────────────────────────

  if (stabil.length > 0 || menurun.length > 0) {

    const stabilTinggi = stabil.filter(ek => (ek.postPct ?? 0) >= 70);

    const stabilRendah = stabil.filter(ek => (ek.postPct ?? 0) < 70);

    let isi = '';



    const adaBagus = stabilTinggi.length > 0;
    const adaMasalah = stabilRendah.length > 0 || menurun.length > 0;

    if (adaBagus && adaMasalah) {
      isi += `Hasil penilaian menunjukkan gambaran yang beragam di antara unit-unit kompetensi yang diukur.`;
    } else if (adaMasalah) {
      isi += `Terdapat beberapa unit kompetensi yang masih memerlukan perhatian dan penguatan lebih lanjut.`;
    } else {
      isi += `Beberapa unit kompetensi menunjukkan penguasaan yang stabil dan perlu terus dipertahankan.`;
    }

    if (stabilTinggi.length > 0) {

      isi += ` Unit kompetensi ${stabilTinggi.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.postPct}%)`).join(' dan ')} menunjukkan nilai yang konsisten dan telah berada pada tingkat yang baik. Penguasaan pada unit-unit tersebut perlu terus dipertahankan dan diperkuat melalui penerapan langsung di lapangan.`;

    }

    if (stabilRendah.length > 0) {

      isi += ` Adapun unit kompetensi ${stabilRendah.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}% → ${ek.postPct}%)`).join(' dan ')} belum menunjukkan perkembangan yang berarti sehingga masih memerlukan pendalaman lebih lanjut.`;

    }

    if (menurun.length > 0) {

      isi += ` Sementara itu, unit kompetensi ${menurun.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (${ek.prePct}% → ${ek.postPct}%)`).join(' dan ')} mengalami penurunan nilai dari pre test ke post test. `;

      isi += menurun.length === 1

        ? `Unit ini perlu mendapat perhatian khusus dan pendalaman secara mandiri agar penguasaannya dapat ditingkatkan kembali.`

        : `Unit-unit ini perlu mendapat perhatian serius dan ditindaklanjuti dengan pendalaman secara mandiri yang lebih terstruktur.`;

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

export function generateRekomendasi(ekComparison, lulus, nilaiAkhir, pesertaNama, kkm = 60) {

  const subjek = pesertaNama ? `Peserta ${_esc(pesertaNama)}` : 'Peserta';

  const p  = s => `<p style="margin:0 0 10px 0; text-align:justify;">${s}</p>`;

  const li = s => `<li style="margin-bottom:6px;">${s}</li>`;



  const withDelta = (ekComparison || []).filter(ek => ek.delta != null);

  const meningkat = withDelta.filter(ek => ek.delta > 0).sort((a, b) => b.postPct - a.postPct);

  const stabil    = withDelta.filter(ek => ek.delta === 0);

  const menurun   = withDelta.filter(ek => ek.delta < 0).sort((a, b) => a.postPct - b.postPct);

  // Hanya UK yang menurun, atau stabil tapi skornya masih rendah (<70%)

  const ekPerlu   = [...menurun, ...stabil.filter(ek => (ek.postPct ?? 0) < 70)]

                      .sort((a, b) => (a.postPct ?? 0) - (b.postPct ?? 0));

  const ekTerbaik = meningkat.slice(0, 2);

  const paragraphs = [];



  // ── LULUS ─────────────────────────────────────────────────────────────────

  if (lulus !== false) {

    // ¶1 — Apresiasi & capaian

    let p1 = `${subjek} telah berhasil menyelesaikan kegiatan bimbingan teknis`;

    p1 += nilaiAkhir != null ? ` dengan nilai akhir <strong>${nilaiAkhir}</strong> dan dinyatakan <strong>LULUS</strong>.` : ` dan dinyatakan lulus.`;

    p1 += ` Capaian ini merupakan cerminan dari kesungguhan, komitmen, dan kerja keras yang ditunjukkan selama mengikuti seluruh rangkaian kegiatan. Penyelenggara menyampaikan apresiasi yang sebesar-besarnya atas dedikasi yang telah diperlihatkan.`;

    paragraphs.push(p(p1));



    // ¶2 — Penerapan kompetensi di tempat kerja

    let p2 = `Kompetensi yang telah diperoleh melalui kegiatan ini diharapkan dapat segera diterapkan dalam pelaksanaan tugas dan tanggung jawab sehari-hari di instansi masing-masing.`;

    if (ekTerbaik.length > 0) {

      p2 += ` Khususnya pada ${ekTerbaik.map(ek => `<strong>${_esc(ek.ekNama)}</strong> (penguasaan akhir ${ek.postPct}%)`).join(' dan ')}, penguasaan yang telah dicapai perlu terus diperkuat melalui praktik langsung di lapangan.`;

    }

    p2 += ` Penerapan secara langsung merupakan cara yang paling efektif untuk memperkuat pemahaman yang telah diperoleh selama kegiatan bimbingan teknis sehingga menjadi keterampilan teknis yang melekat dan dapat diandalkan.`;

    paragraphs.push(p(p2));



    // ¶3 — Pendalaman lanjutan (jika ada UK yang perlu perhatian)

    if (ekPerlu.length > 0) {

      const ekList = ekPerlu.slice(0, 3).map(ek =>

        `<strong>${_esc(ek.ekNama)}</strong> (penguasaan akhir ${ek.postPct ?? '-'}%${ek.delta < 0 ? ', mengalami penurunan' : ', stabil'})`

      ).join('; ');

      let p3 = `Meskipun telah dinyatakan lulus, terdapat beberapa unit kompetensi yang masih memerlukan perhatian dan pendalaman lebih lanjut, yaitu ${ekList}. `;

      p3 += `Beberapa langkah yang dapat ditempuh untuk memperkuat penguasaan pada unit-unit tersebut antara lain: `;

      p3 += `<ol style="margin:8px 0 0 0; padding-left:20px;">`;

      p3 += li(`Mempelajari kembali materi dan modul bimbingan teknis yang berkaitan dengan unit kompetensi tersebut secara mandiri dan terstruktur.`);

      p3 += li(`Berdiskusi dan berkonsultasi dengan rekan kerja atau atasan yang memiliki pengalaman dan keahlian di bidang yang relevan.`);

      p3 += li(`Mengidentifikasi permasalahan nyata di tempat kerja yang berkaitan dengan unit kompetensi tersebut, dan berupaya menyelesaikannya dengan merujuk pada materi yang telah dipelajari.`);

      p3 += li(`Mengikuti kegiatan pengembangan kompetensi lanjutan, seminar teknis, atau forum diskusi yang relevan dengan bidang yang perlu diperkuat.`);

      p3 += `</ol>`;

      paragraphs.push(p(p3));

    }



    // ¶4 — Pengembangan profesional berkelanjutan

    let p4 = `Sebagai bagian dari upaya pengembangan kompetensi yang berkesinambungan, ${subjek} didorong untuk senantiasa memperbarui pengetahuan dan keterampilan teknis di bidang air minum, `;

    p4 += `seiring dengan perkembangan regulasi, standar teknis, teknologi, dan praktik terbaik yang terus mengalami kemajuan. `;

    p4 += `Komitmen terhadap pembelajaran sepanjang hayat merupakan landasan penting bagi setiap tenaga teknis yang ingin memberikan kontribusi terbaik bagi penyelenggaraan pelayanan air minum yang berkualitas di Indonesia.`;

    paragraphs.push(p(p4));



  // ── BELUM LULUS ───────────────────────────────────────────────────────────

  } else {

    // ¶1 — Kondisi & non-judgmental

    const tidakLulusKarenaKehadiran = nilaiAkhir != null && nilaiAkhir >= kkm;

    let p1 = `Berdasarkan hasil penilaian, ${subjek} memperoleh nilai akhir`;

    p1 += nilaiAkhir != null ? ` <strong>${nilaiAkhir}</strong>` : '';

    if (tidakLulusKarenaKehadiran) {
      p1 += ` yang telah memenuhi nilai minimum kelulusan (${kkm}), namun dinyatakan belum memenuhi standar kelulusan yang ditetapkan dikarenakan persentase kehadiran tidak mencapai syarat minimum 90%. `;
    } else {
      p1 += ` dan dinyatakan belum memenuhi standar kelulusan yang ditetapkan. `;
    }

    p1 += `Kondisi ini bukan merupakan hambatan yang bersifat final, melainkan menjadi petunjuk yang berharga mengenai materi yang masih perlu dipelajari dan ditingkatkan lebih lanjut. `;

    p1 += `Penyelenggara meyakini bahwa dengan upaya yang lebih terstruktur dan sungguh-sungguh, ${subjek} memiliki potensi yang sangat baik untuk mencapai standar kelulusan yang ditetapkan.`;

    paragraphs.push(p(p1));



    // ¶2 — Prioritas penguatan

    if (ekPerlu.length > 0) {

      const sorted = ekPerlu.slice(0, 4);

      let p2 = `Berdasarkan hasil penilaian, unit kompetensi yang perlu mendapat perhatian dan penguatan lebih lanjut adalah sebagai berikut: `;

      p2 += `<ul style="margin:8px 0 0 0; padding-left:20px;">`;

      p2 += sorted.map(ek => {

        const kondisi = ek.delta < 0

          ? `mengalami penurunan dari ${ek.prePct}% menjadi ${ek.postPct}%`

          : `masih berada pada tingkat ${ek.postPct}% dan memerlukan penguatan lebih lanjut`;

        return li(`<strong>${_esc(ek.ekNama)}</strong> — ${kondisi}.`);

      }).join('');

      p2 += `</ul>`;

      paragraphs.push(p(p2));

    } else if (withDelta.length > 0) {

      // Semua UK nilainya sudah baik — kegagalan dari komponen penilaian lain

      const p2 = `Penguasaan unit kompetensi ${subjek} secara keseluruhan telah menunjukkan hasil yang baik. Peningkatan nilai akhir pada kegiatan berikutnya dapat difokuskan pada komponen penilaian lainnya, seperti kehadiran, keaktifan, tugas, dan presentasi.`;

      paragraphs.push(p(p2));

    }



    // ¶3 — Langkah konkret

    let p3 = `Berikut adalah langkah-langkah yang disarankan untuk meningkatkan penguasaan kompetensi pada kegiatan berikutnya: `;

    p3 += `<ol style="margin:8px 0 0 0; padding-left:20px;">`;

    p3 += li(`<strong>Pendalaman secara mandiri:</strong> Pelajari kembali seluruh modul dan materi bimbingan teknis yang telah diberikan, dengan memberikan perhatian lebih pada unit-unit kompetensi yang masih berada di bawah standar.`);

    p3 += li(`<strong>Konsultasi dan diskusi:</strong> Manfaatkan kesempatan untuk berdiskusi dengan rekan kerja, atasan, atau tenaga ahli yang berpengalaman di bidang terkait guna memperoleh pemahaman yang lebih mendalam dan aplikatif.`);

    p3 += li(`<strong>Penerapan di lapangan:</strong> Terapkan konsep dan materi yang telah dipelajari dalam pelaksanaan pekerjaan sehari-hari. Pengalaman langsung di lapangan akan sangat membantu dalam mengukuhkan pemahaman yang telah diperoleh secara teoretis.`);

    p3 += li(`<strong>Pengayaan referensi:</strong> Pelajari regulasi, standar nasional (SNI), dan pedoman teknis terkait bidang air minum yang berlaku sebagai referensi tambahan guna memperluas wawasan dan memperkuat penguasaan teknis.`);

    p3 += `</ol>`;

    paragraphs.push(p(p3));



    // ¶4 — Motivasi & harapan

    let p4 = `Penyelenggara mengapresiasi kesediaan dan semangat ${subjek} dalam mengikuti kegiatan bimbingan teknis ini. `;

    p4 += `Setiap proses pembelajaran memiliki dinamikanya masing-masing, dan keteguhan untuk terus berupaya meningkatkan diri merupakan kualitas yang paling menentukan dalam perjalanan pengembangan kompetensi. `;

    p4 += `Penyelenggara berharap ${subjek} tidak berkecil hati dan dapat menyambut keikutsertaan kembali pada kesempatan berikutnya dengan persiapan yang lebih matang, demi mencapai standar kelulusan yang ditetapkan.`;

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

      elaborasi = 'Konsistensi kehadiran yang tinggi ini mencerminkan komitmen penuh peserta terhadap kegiatan bimbingan teknis dan mendukung penyerapan materi secara optimal.';

    } else if (v >= 80) {

      elaborasi = 'Kehadiran yang cukup baik ini memberikan kontribusi positif terhadap penyerapan materi. Namun demikian, tingkat kehadiran ini belum memenuhi syarat minimum 90% yang ditetapkan, sehingga peningkatan kehadiran pada kegiatan berikutnya sangat dianjurkan.';

    } else if (v >= 60) {

      elaborasi = 'Tingkat kehadiran ini belum memenuhi syarat minimum 90% yang ditetapkan sehingga berdampak pada status kelulusan. Diharapkan peserta dapat lebih konsisten mengikuti seluruh rangkaian kegiatan pada kesempatan berikutnya.';

    } else {

      elaborasi = 'Tingkat kehadiran yang rendah ini tidak memenuhi syarat minimum 90% yang ditetapkan dan berdampak langsung terhadap penyerapan materi serta status kelulusan. Pada kegiatan bimbingan teknis berikutnya, diharapkan peserta dapat mengikuti seluruh rangkaian kegiatan secara penuh dan konsisten.';

    }

    return `Peserta mengikuti kegiatan bimbingan teknis ${faktaStr}. Tingkat kehadiran ini tergolong <strong>${_esc(label)}</strong>. ${elaborasi}`;

  }



  if (komponen === 'keaktifan') {

    let elaborasi;

    if (v >= 85) {

      elaborasi = 'Peserta secara aktif berpartisipasi dalam sesi diskusi, tanya jawab, dan kegiatan kelompok yang diselenggarakan. Keaktifan yang tinggi ini memberikan kontribusi positif terhadap dinamika pembelajaran di kelas dan mencerminkan antusiasme yang kuat terhadap materi yang disampaikan.';

    } else if (v >= 70) {

      elaborasi = 'Peserta menunjukkan partisipasi yang baik dalam kegiatan diskusi dan tanya jawab, serta turut berkontribusi dalam kegiatan kelompok yang dilaksanakan selama bimbingan teknis berlangsung.';

    } else if (v >= 55) {

      elaborasi = 'Peserta cukup terlibat dalam kegiatan pembelajaran yang diselenggarakan. Peningkatan partisipasi aktif dalam sesi diskusi dan tanya jawab diharapkan dapat memperdalam pemahaman serta penguasaan materi pada kegiatan yang akan datang.';

    } else {

      elaborasi = 'Partisipasi aktif peserta dalam kegiatan diskusi dan tanya jawab masih perlu ditingkatkan agar manfaat yang diperoleh dari kegiatan bimbingan teknis dapat dirasakan secara optimal.';

    }

    return `Selama mengikuti kegiatan bimbingan teknis, peserta menunjukkan tingkat keaktifan yang tergolong <strong>${_esc(label)}</strong>. ${elaborasi}`;

  }



  if (komponen === 'respek') {

    let elaborasi;

    if (v >= 85) {

      elaborasi = 'Peserta senantiasa memperlihatkan etika komunikasi yang baik, menghargai pendapat pengajar, panitia, maupun sesama peserta, serta menjaga ketertiban dan kondusivitas suasana pembelajaran sepanjang kegiatan berlangsung.';

    } else if (v >= 70) {

      elaborasi = 'Peserta memperlihatkan sikap yang baik dalam berinteraksi dengan pengajar, panitia, maupun sesama peserta, serta turut menjaga kondusivitas suasana selama kegiatan bimbingan teknis berlangsung.';

    } else if (v >= 55) {

      elaborasi = 'Peserta cukup mampu menjaga etika dan sikap selama kegiatan berlangsung. Peningkatan dalam hal penghargaan terhadap jalannya sesi dan ketertiban diharapkan dapat mendukung terciptanya suasana pembelajaran yang lebih kondusif bagi seluruh peserta.';

    } else {

      elaborasi = 'Terdapat beberapa aspek terkait sikap dan penghargaan terhadap sesama yang masih perlu mendapat perhatian lebih lanjut, guna menciptakan suasana pembelajaran yang kondusif dan produktif bagi seluruh peserta kegiatan.';

    }

    return `Selama kegiatan bimbingan teknis berlangsung, peserta menunjukkan sikap dan respek yang tergolong <strong>${_esc(label)}</strong> terhadap pengajar, panitia, maupun sesama peserta. ${elaborasi}`;

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




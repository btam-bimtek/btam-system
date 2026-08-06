// shared/certificate.js
// Builder HTML sertifikat bimtek — dipakai admin (sub-report-peserta.js) dan
// Portal Peserta (peserta/js/pages/sertifikat.js). Fungsi murni: terima data,
// kembalikan HTML string, tidak menyentuh Firestore atau DOM global.

import { kategoriNilai } from './scoring.js';

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * @param {object} data          hasil getPesertaReportData(bimtekId, noPeserta, bimtek) — { peserta, scores }
 * @param {object} bimtek        dokumen bimtek (nama, periode, noSertifikat)
 * @param {object} lembagaSettings  app_settings.global.lembaga (nama, kota, penandaTangan, dst) — boleh {}
 * @param {object} opts          { variant: 'sertifikat' | 'suratKeterangan' } — layout & posisi identik,
 *                                hanya judul/intro/baris field/nomor yang beda per varian
 * @returns {string} HTML siap di-print (ukuran A4 landscape)
 */
export function buildCertHTML(data, bimtek, lembagaSettings = {}, opts = {}) {
  const { peserta, scores } = data;
  const b       = bimtek;
  const lembaga = lembagaSettings ?? {};
  const isSuratKet = opts.variant === 'suratKeterangan';

  const _fmtTs = ts => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const mulai   = _fmtTs(b.periode?.mulai);
  const selesai = _fmtTs(b.periode?.selesai);
  const periodeStr = mulai && selesai
    ? `${mulai} sampai dengan ${selesai}`
    : (mulai || selesai || '—');
  const tglTTD = selesai || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  // Tempat, Tanggal Lahir
  const ttl = (() => {
    const bagian = [];
    if (peserta?.tempatLahir) bagian.push(_esc(peserta.tempatLahir));
    if (peserta?.tanggalLahir) {
      const d = new Date(peserta.tanggalLahir);
      bagian.push(isNaN(d.getTime())
        ? _esc(peserta.tanggalLahir)
        : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));
    }
    return bagian.join(', ') || '—';
  })();

  const namaLemb         = lembaga.nama                || 'Balai Teknik Air Minum';
  const kota             = lembaga.kota                || 'Jakarta';
  const penanda          = lembaga.penandaTangan        || '';
  const jabatanPenanda   = lembaga.jabatanPenandaTangan || 'Direktur Bina Teknik Bangunan Gedung dan Penyehatan Lingkungan';
  const logoUrl          = lembaga.logoUrl              ?? null;
  // Surat Keterangan pakai background sendiri kalau sudah diupload (supaya judul "SURAT
  // KETERANGAN" bisa beda dari "SERTIFIKAT"), fallback ke background sertifikat biasa.
  const certBgUrl        = (isSuratKet ? lembaga.suratKeteranganBgUrl : null) || lembaga.certBgUrl || null;
  // Nomor sertifikat diisi manual oleh admin, berlaku untuk semua peserta bimtek ini — surat keterangan tidak pakai nomor
  const noCert           = b.noSertifikat || '—';
  // Kualifikasi diisi dari kategori kelulusan (Sangat Baik/Baik/Cukup/Kurang/Sangat Kurang) — surat keterangan tidak menampilkan kualifikasi
  const kualifikasi      = kategoriNilai(scores?.nilaiAkhir).kategori;
  // Judul & intro baris field beda per varian; layout/posisi identik
  const introText        = isSuratKet ? 'Menerangkan Bahwa :' : 'Diberikan Kepada :';
  const fieldRows         = [
    ['Nama',                  _esc(peserta?.nama)],
    ['NIK',                   _esc(peserta?.nik)],
    ['Tempat, Tanggal Lahir', ttl],
    ['Jabatan',               _esc(peserta?.jabatan)],
    ['Instansi',              _esc(peserta?.instansi)],
    ...(isSuratKet ? [] : [['Kualifikasi', _esc(kualifikasi)]]),
  ];

  const certRow = (label, val) => `
    <tr>
      <td style="padding:0.7mm 0;white-space:nowrap;color:#374151;vertical-align:top;">${label}</td>
      <td style="padding:0.7mm 3mm;color:#374151;vertical-align:top;">:</td>
      <td style="padding:0.7mm 0;color:#111827;font-weight:600;vertical-align:top;">${val || '—'}</td>
    </tr>`;

  // ── Mode: background image dari Canva ──
  if (certBgUrl) {
    // Load Open Sans dari Google Fonts (sekali saja)
    if (!document.getElementById('cert-font-opensans')) {
      const link = document.createElement('link');
      link.id = 'cert-font-opensans';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap';
      document.head.appendChild(link);
    }

    const F = "font-family:'Open Sans',sans-serif;font-size:16px;";

    return `
      <div style="width:297mm;height:210mm;position:relative;overflow:hidden;${F}box-sizing:border-box;">

        <!-- Background image (Canva export) -->
        <img src="${_esc(certBgUrl)}" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill;z-index:0;">

        <!-- Foto peserta (kiri) -->
        <div style="position:absolute;top:82mm;left:50mm;width:30mm;height:40mm;z-index:10;overflow:hidden;
          border:1px solid #ccc;background:rgba(240,240,240,0.5);">
          ${peserta?.fotoUrl
            ? `<img src="${_esc(peserta.fotoUrl)}" alt="Foto" style="width:100%;height:100%;object-fit:cover;">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                <span style="font-size:11px;color:#aaa;font-family:'Open Sans',sans-serif;">FOTO</span>
              </div>`}
        </div>

        ${isSuratKet ? '' : `
        <!-- Nomor Sertifikat -->
        <div style="position:absolute;top:63mm;left:130mm;${F}font-size:14px;color:#374151;z-index:10;">
          Nomor : ${_esc(noCert)}
        </div>`}

        <!-- Diberikan Kepada / Menerangkan Bahwa -->
        <div style="position:absolute;top:70mm;left:130mm;${F}font-weight:700;color:#111827;z-index:10;">
          ${introText}
        </div>

        <!-- Fields table -->
        <div style="position:absolute;top:85mm;left:104mm;width:155mm;${F}color:#111827;z-index:10;line-height:1.3;">
          <table style="border-collapse:collapse;width:100%;${F}line-height:1.3;">
            <colgroup><col style="width:44mm;"><col style="width:5mm;"><col></colgroup>
            ${fieldRows.map(([lbl, val]) => `
              <tr>
                <td style="padding:0;white-space:nowrap;color:#374151;vertical-align:top;">${lbl}</td>
                <td style="padding:0 3mm 0 0;color:#374151;vertical-align:top;">:</td>
                <td style="padding:0;color:#111827;vertical-align:top;">${val || '—'}</td>
              </tr>`).join('')}
          </table>
        </div>

        <!-- Bimtek text -->
        <div style="position:absolute;top:131mm;left:30mm;right:30mm;${F}line-height:1.6;color:#1a1a1a;text-align:center;z-index:10;">
          Pada Bimbingan Teknis <strong>${_esc(b.nama)}</strong>
          yang diselenggarakan oleh ${_esc(namaLemb)} pada tanggal ${_esc(periodeStr)}
        </div>

        <!-- TTD -->
        <div style="position:absolute;top:153mm;left:193mm;width:95mm;text-align:center;${F}color:#1a1a1a;z-index:10;">
          ${_esc(kota)}, ${_esc(tglTTD)}
        </div>
        <div style="position:absolute;top:162mm;left:193mm;width:95mm;text-align:center;${F}color:#1a1a1a;line-height:1.4;z-index:10;">
          ${_esc(jabatanPenanda)}
        </div>
        <div style="position:absolute;top:188mm;left:193mm;width:95mm;text-align:center;${F}font-weight:700;color:#1a1a1a;z-index:10;">
          ${_esc(penanda)}
        </div>
      </div>
    `;
  }

  // ── Mode: CSS fallback (belum ada background image) ──
  return `
    <div style="
      width:297mm; height:210mm;
      position:relative; overflow:hidden;
      background:#ffffff;
      font-family:Arial,Helvetica,sans-serif;
      box-sizing:border-box;
    ">
      <!-- BG: Blue top bar -->
      <div style="position:absolute;top:0;left:0;right:0;height:5mm;background:#1a3a8f;z-index:1;"></div>

      <!-- BG: Orange right diagonal panel -->
      <div style="position:absolute;top:0;right:0;width:105mm;height:100%;z-index:1;
        background:linear-gradient(160deg,#f59e0b 0%,#e07820 45%,#c05510 100%);
        clip-path:polygon(30% 0,100% 0,100% 100%,0 100%);"></div>

      <!-- BG: Blue bottom bar -->
      <div style="position:absolute;bottom:0;left:0;right:0;height:5mm;background:#1a3a8f;z-index:2;"></div>

      <!-- MAIN CONTENT (white area) -->
      <div style="
        position:absolute; top:5mm; left:0; right:105mm; bottom:5mm; z-index:10;
        padding:6mm 8mm 7mm 10mm;
        display:flex; flex-direction:column;
        box-sizing:border-box;
      ">
        <!-- Logo + header kementerian -->
        <div style="text-align:center;margin-bottom:2mm;line-height:1.4;">
          ${logoUrl
            ? `<img src="${_esc(logoUrl)}" style="height:11mm;width:auto;display:block;margin:0 auto 1.5mm;" alt="Logo">`
            : ''}
          <div style="font-size:7pt;font-weight:700;color:#1a3a8f;letter-spacing:0.2px;line-height:1.4;">
            KEMENTERIAN PEKERJAAN UMUM<br>DIREKTORAT JENDERAL CIPTA KARYA
          </div>
        </div>

        <!-- Divider -->
        <div style="border-top:1.5px solid #1a3a8f;margin:1mm 0 2mm;"></div>

        <!-- SERTIFIKAT / SURAT KETERANGAN -->
        <div style="text-align:center;margin-bottom:0.5mm;">
          <span style="font-size:${isSuratKet ? '15' : '20'}pt;font-weight:900;letter-spacing:${isSuratKet ? '2' : '5'}px;color:#e07820;">${isSuratKet ? 'SURAT KETERANGAN' : 'SERTIFIKAT'}</span>
        </div>

        ${isSuratKet ? '' : `
        <!-- Nomor -->
        <div style="text-align:center;font-size:7pt;color:#4b5563;margin-bottom:3mm;">
          Nomor : ${_esc(noCert)}
        </div>`}

        <!-- Diberikan Kepada / Menerangkan Bahwa -->
        <div style="font-size:7.5pt;font-weight:700;color:#111827;margin-bottom:1.5mm;">
          ${introText}
        </div>

        <!-- Fields table -->
        <div style="flex:1;font-size:7.5pt;overflow:hidden;">
          <table style="border-collapse:collapse;width:100%;">
            <colgroup><col style="width:42mm;"><col style="width:5mm;"><col></colgroup>
            ${fieldRows.map(([lbl, val]) => certRow(lbl, val)).join('')}
          </table>
        </div>

        <!-- Bimtek text -->
        <div style="font-size:7pt;line-height:1.65;color:#374151;text-align:justify;">
          Pada Bimbingan Teknis <strong style="color:#111827;">${_esc(b.nama)}</strong>
          yang diselenggarakan oleh ${_esc(namaLemb)} pada tanggal ${_esc(periodeStr)}
        </div>
      </div>

      <!-- TTD (on orange background, white text) -->
      <div style="
        position:absolute; right:5mm; bottom:12mm; width:88mm; z-index:20;
        text-align:center; color:#fff;
      ">
        <div style="font-size:7.5pt;">${_esc(kota)}, ${_esc(tglTTD)}</div>
        <div style="font-size:7.5pt;line-height:1.4;margin:1.5mm 0;">${_esc(jabatanPenanda)}</div>
        <div style="height:16mm;"></div>
        <div style="font-size:8.5pt;font-weight:700;border-top:1px solid rgba(255,255,255,0.55);padding-top:1.5mm;display:inline-block;min-width:55mm;">
          ${_esc(penanda)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Surat Keterangan — bentuk & posisi identik dengan buildCertHTML (mengikuti sertifikat
 * asli lembaga), hanya beda judul, kalimat intro, baris field (tanpa Kualifikasi), dan
 * tanpa nomor sertifikat.
 * @param {object} data          hasil getPesertaReportData(bimtekId, noPeserta, bimtek) — { peserta, scores }
 * @param {object} bimtek        dokumen bimtek (nama, periode)
 * @param {object} lembagaSettings  app_settings.global.lembaga
 * @returns {string} HTML siap di-print (ukuran A4 landscape)
 */
export function buildSuratKeteranganHTML(data, bimtek, lembagaSettings = {}) {
  return buildCertHTML(data, bimtek, lembagaSettings, { variant: 'suratKeterangan' });
}

/**
 * @param {Array} mapelList         Array of {id, urutan, nama, totalJp} already sorted by urutan
 * @param {object} lembagaSettings  app_settings.global.lembaga (kota, penandaTangan, jabatanPenandaTangan, etc.)
 * @param {object} bimtek           dokumen bimtek (periode.selesai) — dipakai supaya tanggal TTD sama dengan lembar 1
 * @returns {string} HTML siap di-print (ukuran A4 landscape) — page 2 dengan daftar mata pelajaran
 */
export function buildCertBackHTML(mapelList, lembagaSettings = {}, bimtek = {}) {
  const lembaga = lembagaSettings ?? {};
  const kota = lembaga.kota || 'Jakarta';
  // Penandatangan lembar 2 punya field terpisah (penandaTangan2/jabatanPenandaTangan2)
  // dari lembar 1, karena biasanya orang & jabatan berbeda (mis. Kepala Balai vs Direktur).
  const penanda        = lembaga.penandaTangan2        || '';
  const jabatanPenanda = lembaga.jabatanPenandaTangan2 || 'Kepala Balai Teknik Air Minum';

  // Tanggal TTD sama dengan lembar 1: tanggal selesai bimtek, fallback hari ini
  const _fmtTs = ts => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };
  const tglTTD = _fmtTs(bimtek?.periode?.selesai)
    || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  // Hitung total JP dari semua mapel
  const totalJp = (mapelList || []).reduce((sum, mapel) => sum + (mapel.totalJp || 0), 0);

  return `
    <div style="
      width:297mm; height:210mm;
      position:relative; overflow:hidden;
      background:#ffffff;
      font-family:Arial,Helvetica,sans-serif;
      box-sizing:border-box;
      color:#111827;
      padding:10mm;
      display:flex;
      flex-direction:column;
    ">
      <!-- Header: DAFTAR MATA PELAJARAN -->
      <div style="flex:0 0 auto;text-align:center;margin-bottom:5mm;font-size:14pt;font-weight:bold;color:#111827;">
        DAFTAR MATA PELAJARAN
      </div>

      <!-- Table container — flex:1 & overflow:hidden agar tabel yang menyusut (bukan tanda tangan)
           saat mapel terlalu banyak untuk muat 1 halaman A4 landscape -->
      <div style="flex:1 1 auto;min-height:0;overflow:hidden;margin-bottom:4mm;">
        <table style="
          width:100%;
          border-collapse:collapse;
          font-size:10pt;
          line-height:1.25;
        ">
          <colgroup>
            <col style="width:15mm;">
            <col style="width:155mm;">
            <col style="width:25mm;">
          </colgroup>

          <!-- Header row -->
          <thead>
            <tr style="border-bottom:1.5px solid #111827;">
              <th style="
                padding:2mm;
                text-align:center;
                font-weight:bold;
                color:#111827;
                border-bottom:1.5px solid #111827;
                border-right:1px solid #9ca3af;
              ">No.</th>
              <th style="
                padding:2mm;
                text-align:left;
                font-weight:bold;
                color:#111827;
                border-bottom:1.5px solid #111827;
                border-right:1px solid #9ca3af;
              ">Nama Mata Pelajaran</th>
              <th style="
                padding:2mm;
                text-align:center;
                font-weight:bold;
                color:#111827;
                border-bottom:1.5px solid #111827;
              ">JP</th>
            </tr>
          </thead>

          <!-- Data rows -->
          <tbody>
            ${(mapelList || []).map((mapel, idx) => `
              <tr style="border-bottom:0.5px solid #d1d5db;">
                <td style="
                  padding:1.2mm 2mm;
                  text-align:center;
                  color:#374151;
                  vertical-align:top;
                  border-right:1px solid #d1d5db;
                ">${idx + 1}</td>
                <td style="
                  padding:1.2mm 2mm;
                  text-align:left;
                  color:#374151;
                  vertical-align:top;
                  border-right:1px solid #d1d5db;
                ">${_esc(mapel.nama || '')}</td>
                <td style="
                  padding:1.2mm 2mm;
                  text-align:center;
                  color:#374151;
                  vertical-align:top;
                ">${mapel.totalJp || 0}</td>
              </tr>
            `).join('')}
          </tbody>

          <!-- Total row -->
          <tfoot>
            <tr style="border-top:1.5px solid #111827;">
              <td colspan="2" style="
                padding:2mm;
                text-align:right;
                font-weight:bold;
                color:#111827;
                border-top:1.5px solid #111827;
                border-right:1px solid #9ca3af;
              ">JUMLAH</td>
              <td style="
                padding:2mm;
                text-align:center;
                font-weight:bold;
                color:#111827;
                border-top:1.5px solid #111827;
              ">${totalJp}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Signature block — flex:0 0 auto: selalu tampil penuh, tidak pernah ikut terpotong -->
      <div style="
        flex:0 0 auto;
        display:flex;
        justify-content:flex-end;
        color:#111827;
        font-size:9pt;
      ">
        <div style="text-align:center;width:70mm;">
          <div style="margin-bottom:1mm;">${_esc(kota)}, ${_esc(tglTTD)}</div>
          <div style="margin-bottom:12mm;line-height:1.4;">${_esc(jabatanPenanda)}</div>
          <div style="height:12mm;"></div>
          <div style="font-weight:bold;border-top:1px solid #111827;padding-top:1mm;display:inline-block;min-width:50mm;">
            ${_esc(penanda)}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Trigger window.print() dengan ukuran halaman A4 landscape tanpa margin.
 * Elemen yang mau dicetak harus punya class "cert-doc" (lihat print.css),
 * elemen lain di halaman diberi class "no-print".
 */
export function printCert() {
  const style = document.createElement('style');
  style.id    = 'cert-print-style';
  style.textContent = '@page { size: A4 landscape; margin: 0; }';
  document.head.appendChild(style);
  document.body.classList.add('printing-cert');

  window.print();

  setTimeout(() => {
    const s = document.getElementById('cert-print-style');
    if (s) s.remove();
    document.body.classList.remove('printing-cert');
  }, 1000);
}

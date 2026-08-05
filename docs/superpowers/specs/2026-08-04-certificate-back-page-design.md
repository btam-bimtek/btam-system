# Design: Certificate Back Page (Lembar Belakang Sertifikat)

**Date:** 2026-08-04  
**Status:** Pending Implementation  
**Scope:** Add page 2 to certificate showing subjects & hours

---

## Overview

Sertifikat BTAM akan di-extend dari 1 halaman menjadi 2 halaman:
- **Lembar Depan (Page 1):** Data peserta, kualifikasi (existing)
- **Lembar Belakang (Page 2):** Daftar mata pelajaran dengan jam pelajaran (NEW)

Kedua halaman di-render dalam satu `.cert-doc` container dan di-print bersamaan.

---

## Requirements

### Page 2 Content

**Header:**
- Judul: "DAFTAR MATA PELAJARAN" (centered, bold)

**Table (3 columns):**
- No. | Nama Mapel | JP
- Diurutkan sesuai `urutan` field di Firestore (ascending)
- Row height: compact untuk fit multiple subjects

**Footer:**
- Total JP (summed dari semua mapel)
- Signature block: Kepala Balai Teknik Air Minum
  - Kota, Tanggal (same as page 1)
  - Jabatan: "Kepala Balai Teknik Air Minum"
  - Space untuk TTD + nama penanda

### Layout

- **Size:** A4 landscape (297mm × 210mm), consistent dengan page 1
- **Design:** Minimal/clean
  - Background: White
  - Font: Arial/Helvetica (match page 1)
  - Padding: 10mm all sides
- **Color:** Text #374151 (gray), headers #111827 (dark)

### Data Source

Mapel list dari Firestore subcollection:
- `bimtek/{bimtekId}/mapel` — ordered by `urutan` asc
- Each doc: `{ urutan, nama, totalJp, ... }`

### Print Behavior

- Saat user klik "Cetak Sertifikat" → trigger window.print() untuk kedua halaman
- Page break otomatis di CSS antara page 1 & page 2
- No margin di print settings

---

## Architecture

### New Function: `buildCertBackHTML(mapelList, lembagaSettings)`

**Location:** `shared/certificate.js`

**Signature:**
```javascript
export function buildCertBackHTML(mapelList, lembagaSettings = {})
  → returns HTML string (A4 landscape)
```

**Inputs:**
- `mapelList` — Array dari `{ id, urutan, nama, totalJp, ... }` (sudah sorted)
- `lembagaSettings` — App settings `{kota, penandaTangan, jabatanPenandaTangan, ...}`

**Output:**
- HTML string berisi page 2 (div dengan width 297mm, height 210mm)

**Responsibilities:**
- Format tabel mapel dengan kolom: No. | Nama | JP
- Calculate & display total JP
- Render signature block dengan data dari lembagaSettings
- Escape HTML untuk safety (same pattern seperti page 1)

### Update: `renderSertifikat()`

**Location:** `peserta/js/pages/sertifikat.js`

**Changes:**
1. Import `listMapel` dari `peserta/js/api.js`
2. Load mapel list setelah `getPesertaReportData()`:
   ```javascript
   const mapels = await listMapel(bimtekId);
   ```
3. Build page 2 HTML:
   ```javascript
   const backPageHtml = buildCertBackHTML(mapels, lembagaSettings);
   ```
4. Render kedua halaman di `.cert-doc`:
   ```html
   <div class="cert-doc">
     ${frontPageHtml}
     ${backPageHtml}
   </div>
   ```

### CSS (Print Styling)

**File:** Update existing print CSS (likely dalam inline styles atau print.css)

**Rules:**
```css
.cert-page {
  width: 297mm;
  height: 210mm;
  page-break-after: always;
  box-sizing: border-box;
}

.cert-page:last-child {
  page-break-after: avoid;
}

@page {
  size: A4 landscape;
  margin: 0;
}
```

---

## Data Flow Diagram

```
renderSertifikat()
  │
  ├─→ getBimtek(bimtekId)
  ├─→ getPeserta(session.noPeserta)
  ├─→ getPesertaReportData(bimtekId, noPeserta, bimtek)
  │   └─→ buildCertHTML() → PAGE 1
  │
  ├─→ listMapel(bimtekId) ← NEW
  │   └─→ returns sorted array of { id, urutan, nama, totalJp }
  │
  ├─→ getLembagaSettings()
  │
  ├─→ buildCertBackHTML(mapelList, lembagaSettings) ← NEW
  │   └─→ PAGE 2 HTML
  │
  └─→ render both pages dalam .cert-doc container
      └─→ printCert() handles window.print()
```

---

## Error Handling

### Edge Cases

1. **No mapel:** Display empty table dengan header + footer
2. **Very long mapel names:** Text wrap di table cell, auto height
3. **Many mapel (>20):** Should fit in A4 landscape; if overflow, tabel akan scroll/truncate (acceptable untuk print)
4. **No lembagaSettings:** Use defaults (same as page 1)

### Security

- HTML escape semua user-input (nama mapel, nama penanda, etc.)
- Same pattern seperti `buildCertHTML()` using `_esc()` helper

---

## Files Modified

| File | Changes |
|------|---------|
| `shared/certificate.js` | Add `buildCertBackHTML()` function |
| `peserta/js/pages/sertifikat.js` | Load mapel, render page 2, update cert-doc HTML |
| `peserta/js/api.js` | Already exports `listMapel` (no change needed) |
| Print CSS (TBD) | Add `.cert-page` rules for page break |

---

## Success Criteria

- ✓ Render page 2 dengan tabel mapel (No. | Nama | JP)
- ✓ Total JP dihitung dan ditampilkan
- ✓ Signature block dengan Kepala Balai info
- ✓ Print kedua halaman tanpa overlap
- ✓ Page 2 A4 landscape, minimal design
- ✓ No breaking changes ke page 1 atau existing features

---

## Dependencies

- `listMapel()` already exists in `peserta/js/api.js`
- `buildCertHTML()` pattern established; page 2 follows same approach
- Firestore `bimtek/{bimtekId}/mapel` collection populated

---

## Notes

- Print CSS may need inline styles (like page 1) if no separate print.css exists
- Page 2 HTML structure mirrors page 1 (inline styles, self-contained)
- Dapat di-extend di masa depan untuk show pengajar per mapel, notes, dll

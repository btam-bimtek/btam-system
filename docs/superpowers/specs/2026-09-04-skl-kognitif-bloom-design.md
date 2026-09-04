# Standar Kompetensi Lulusan & Pemetaan Kognitif Bloom

**Tanggal:** 4 September 2026
**File utama:** `admin/js/modules/bank-soal/`, `admin/js/modules/bimtek/{form,exam-modal,report-api,report-narrative,sub-report-*}.js`, `shared/constants.js`

## 1. Latar Belakang & Masalah

Bank soal sudah menyimpan dua penanda pada setiap butir: `unitKompetensi` (kode UK, tersinkron dengan Master UK) dan `bloomLevel` (C1–C6). Keduanya berdiri sendiri — tidak ada pernyataan di mana pun tentang *sampai level kognitif berapa* suatu UK harus dikuasai lulusan sebuah bimtek.

Akibatnya:

1. **Penyusunan ujian tidak berpedoman.** Admin memilih `soalIds` satu per satu di `exam-modal.js`; tidak ada mekanisme yang memastikan komposisi soal mencerminkan sasaran kompetensi bimtek.
2. **Laporan tidak bisa berbicara secara kognitif.** `calcEKComparison()` (`report-api.js:297`) menghasilkan persentase pre/post per UK, tapi tidak bisa menyatakan "peserta naik dari Mengingat ke Menerapkan" karena tidak ada sasaran pembanding.
3. **Tidak ada definisi kelulusan per kompetensi.** Kelulusan saat ini hanya nilai akhir agregat versus KKM (`shared/scoring.js`), tanpa pernyataan per unit kompetensi.

Permintaan pemilik produk: hubungkan kompetensi dengan level kognitif di bank soal, tetapkan standar minimal kompetensi lulusan per bimtek, generate set soal pre/post dari standar itu, dan laporkan capaian kognitif peserta.

## 2. Kondisi Data Saat Ini (hasil audit 3 September 2026)

Audit langsung ke Firestore koleksi `bank_soal` (`deleted == false`), 263 dokumen:

| Metrik | Nilai |
|---|---|
| Total soal | 263 (262 aktif, 1 nonaktif) |
| **Soal tanpa `bloomLevel`** | **154 (59%)** |
| Soal tanpa `unitKompetensi` | 29 |
| UK terpakai | 56 |
| UK dengan soal di ≥3 level Bloom berbeda | 6 dari 56 |

Sebaran level pada 109 soal yang sudah berlevel: C1=34, C2=26, C3=13, C4=23, C5=8, C6=5.
Sebaran bidang: trandis 78, me 76, pendukung 59, produksi 50.

Matriks UK × Bloom (56 UK × 6 level = 336 sel), soal aktif & ber-UK:

| Kondisi sel | Jumlah | Implikasi |
|---|---|---|
| Kosong (0 soal) | 274 | tidak bisa diuji |
| Tipis (1 soal) | 44 | cukup untuk satu tes, kesimpulan rapuh |
| Siap (≥2 soal) | 18 | cukup untuk set paralel |

Hanya satu UK yang berjenjang lengkap: `F.42AMI00.006.1` *Menyusun Rencana Teknis Terinci* (C1=9, C2=7, C3=8, C4=4, C5=3). Beberapa UK bervolume besar seluruh soalnya tanpa level: `E.360011.019.01` *Mengevaluasi unit produksi* (25 soal), seri `BTAM-SAKEP-01..06` (25 soal).

**Dua konsekuensi yang menentukan desain:**

- **Set soal pre/post paralel belum layak.** Hanya 18 dari 336 sel punya ≥2 soal. Pre dan post tetap memakai butir yang sama (perilaku `generateSessions()` sekarang), tapi model data disiapkan agar mode paralel bisa dinyalakan tanpa migrasi.
- **`bloomLevel` kosong sudah memengaruhi nilai hari ini.** `_validateSoal()` (`bank-soal/api.js:315`) tidak mewajibkan `bloomLevel`, dan `_getBloomBobot()` (`scorer.js:76`) memberi bobot 1 untuk level tak dikenal — setara C1. 154 soal saat ini dihitung sebagai soal hafalan paling ringan, termasuk soal yang secara isi berada di C4–C5.

## 3. Ruang Lingkup

**Masuk:**
- Pengisian `bloomLevel` untuk 154 soal, dengan layar peninjauan
- `bloomLevel` menjadi wajib pada form input soal
- Tampilan stok bank soal sebagai matriks UK × Bloom
- Standar Kompetensi Lulusan (SKL) per bimtek: target level + ambang + jumlah soal per UK
- Generator set soal dari SKL, mengisi pemilih soal yang sudah ada
- Peningkatan Laporan Peserta (bagian C) dan Laporan Penyelenggara (blok pemenuhan SKL)
- Pembekuan nilai bimtek berstatus `selesai`

**Tidak masuk:**
- Laporan per instansi peserta — satuan yang tepat adalah per tahun lintas bimtek, bukan per bimtek; lebih dekat ke modul Alumni. Ditunda tanpa jadwal.
- Set soal pre/post paralel — stok belum memungkinkan (§2). Model data disiapkan, fitur tidak dibangun.
- Perubahan formula nilai akhir (`hitungNilaiAkhir`) dan aturan kelulusan agregat.

## 4. Model Data

### 4.1 Perubahan pada koleksi yang sudah ada

```
bank_soal.bloomLevel        sudah ada, tipe string 'C1'..'C6'
                            → menjadi WAJIB di _validateSoal()

bimtek.skl                  BARU — array standar kompetensi lulusan
  [{
    ukId:        string,   // doc ID unit_kompetensi (lowercase)
    ukKode:      string,   // kode canonical, disalin untuk tampilan
    targetBloom: string,   // 'C1'..'C6'
    ambang:      number,   // persen benar minimal PER LEVEL, default 70
    jumlahSoal:  number    // butir yang diminta untuk UK ini
  }]

exams.blueprint             BARU — rekaman maksud generator
  {
    dibuatDari: 'skl',
    dibuatPada: Timestamp,
    komposisi: [{
      ukId:       string,
      ukKode:     string,
      bloomLevel: string,
      diminta:    number,   // yang dikehendaki SKL
      terpenuhi:  number,   // yang benar-benar tersedia di bank
      soalIds:    string[]
    }]
  }
```

`blueprint` adalah satu-satunya cara laporan bisa membedakan "peserta tidak diuji di C4" dari "bank soal tidak punya butir C4". Tanpa itu, laporan hanya melihat soal yang ada dan menganggap memang segitu rencananya. Selisih `diminta` versus `terpenuhi` adalah dasar penandaan defisit di §8.

`bimtek.skl` disimpan sebagai array pada dokumen bimtek, mengikuti pola `ukIds` dan `weights` yang sudah ada (`bimtek/api.js:119,146`). Jumlah UK per bimtek berkisar 3–10, jauh di bawah batas ukuran dokumen Firestore.

`updateBimtek()` menyaring field yang boleh diubah lewat daftar putih (`bimtek/api.js:146`). `'skl'` **harus ditambahkan ke daftar itu**, jika tidak SKL akan tersimpan saat pembuatan tapi diam-diam terbuang saat penyuntingan.

**Arti `ambang`:** persentase jawaban benar minimal pada **satu level**, bukan pada agregat UK. UK dengan `ambang: 70` dinyatakan mencapai C3 bila peserta benar ≥70% di C3 *dan* ≥70% di C2 *dan* ≥70% di C1. Persentase agregat per UK tetap dihitung dan ditampilkan (jalur `calcEKComparison()` yang sudah ada), tapi tidak dibandingkan dengan `ambang`.

### 4.2 Koleksi sementara

```
bloom_suggestions           doc ID = soalId
  { soalId, usulLevel, alasan, status, ditinjauPada, ditinjauOleh }
  status: 'pending' | 'disetujui' | 'diubah' | 'ditolak'
```

Dipakai hanya untuk backfill Tahap 1. Setelah seluruh 154 soal ditinjau, koleksi ini boleh dihapus. Rules: baca/tulis admin saja.

## 5. Tahap 1 — Pengisian Level Bloom

### 5.1 Sumber usulan

Klasifikasi dikerjakan oleh Claude di dalam sesi Claude Code, bukan lewat integrasi API. Alasan: proyek tidak punya backend (`firebase.json` hanya memuat rules Firestore & Storage — tidak ada Hosting maupun Functions), sehingga panggilan API memerlukan Cloud Functions plus upgrade Firebase ke paket Blaze, ditambah akun API Anthropic berbayar terpisah. Untuk backfill sekali jalan atas 154 butir, biaya perawatan itu tidak sebanding.

Prosedurnya: baca soal tanpa `bloomLevel` dari Firestore, klasifikasi berdasarkan tuntutan kognitif pertanyaan dan opsi jawabannya, tulis ke `bloom_suggestions` dengan alasan singkat per butir.

Konsekuensi yang diterima: ini bukan fitur berulang. Untuk soal baru, pengisian bersifat manual dan diwajibkan oleh form (§5.3). Jika suatu saat menumpuk lagi, prosedur yang sama diulang.

### 5.2 Layar peninjauan

Sub-tab baru di modul Bank Soal: **Usulan Level Bloom**, hanya muncul bila ada dokumen `bloom_suggestions` berstatus `pending`.

Per butir ditampilkan: pertanyaan, opsi jawaban, UK, usulan level, alasan. Aksi: setuju · ubah level · tolak. Tersedia "setujui semua sisa" setelah admin meninjau sebagian, karena meninjau 154 butir satu per satu dalam satu duduk tidak realistis.

Penerapan menulis `bloomLevel` **dan** `bobot` ke `bank_soal` dalam batch (chunk 400, mengikuti pola `recalcSoalStats()` di `bank-soal/api.js:296`), memakai `_hitungBobot()` yang sudah ada supaya konsisten dengan jalur create/update.

### 5.3 Pewajiban pada form

`_validateSoal()` (`bank-soal/api.js:315`) menambah aturan: `bloomLevel` wajib dan harus salah satu dari `BLOOM_LEVELS`. Form (`bank-soal/form.js`) menandai field sebagai wajib.

Import massal (`bank-soal/import.js`) menolak baris tanpa level dan melaporkannya sebagai galat baris, bukan mengisi diam-diam dengan default — pengisian senyap itulah yang melahirkan 154 soal bermasalah.

### 5.4 Matriks stok UK × Bloom

Tampilan baru di modul Bank Soal: tabel UK sebagai baris, C1–C6 sebagai kolom, jumlah soal sebagai isi sel. Sel bernilai 0 dan 1 ditandai berbeda. Ini yang menjadikan hubungan kompetensi–kognitif kasatmata, dan menjadi rujukan admin saat menyusun SKL: target C4 pada UK yang kolom C4-nya kosong tidak akan pernah bisa dibuktikan.

## 6. Tahap 2 — SKL pada Form Bimtek

Bagian baru pada form bimtek, muncul setelah `ukIds` terisi. Satu baris per UK terpilih:

| UK | Target | Ambang | Jumlah soal | Stok |
|---|---|---|---|---|
| Mengoperasikan Pompa | C3 ▾ | 70 | 8 | ✓ |
| Menganalisis Vibrasi | C4 ▾ | 60 | 6 | ⚠ C4 hanya 1 butir |

Kolom Stok dihitung langsung dari bank soal saat form dibuka, memakai data yang sama dengan §5.4. Peringatan bersifat informatif — admin tetap boleh menyimpan SKL yang stoknya belum memadai, karena SKL adalah pernyataan sasaran yang sah didahulukan sebelum banknya dilengkapi.

Nilai bawaan: `targetBloom` = C3, `ambang` = 70, `jumlahSoal` = 8.

SKL bersifat opsional. Bimtek tanpa `skl` berjalan persis seperti sekarang — generator tidak tersedia dan laporan memakai jalur lama. Tidak ada alur yang dimatikan.

## 7. Tahap 3 — Generator Set Soal

### 7.1 Pembagian butir per level

Admin hanya menetapkan target dan jumlah. Pembagian ke tiap level memakai bobot yang condong ke level target, karena yang hendak dibuktikan adalah peserta sampai di level tersebut — di situlah butir terbanyak diperlukan.

Bobot level ke-*i* (untuk *i* = 1..target) adalah *i*, lalu dinormalkan terhadap `jumlahSoal` dan dibulatkan dengan sisa dialokasikan ke level tertinggi:

```
target C3, 8 soal  → bobot 1:2:3  → C1=1  C2=3  C3=4
target C4, 6 soal  → bobot 1:2:3:4 → C1=1  C2=1  C3=2  C4=2
```

Hasil pembagian **ditampilkan sebelum dieksekusi** dan boleh disunting admin per sel. Ini keputusan yang diambil tanpa preseden di praktik BTAM; bila komposisi baku yang dipakai berbentuk lain (mis. piramida dengan butir terbanyak di level bawah), yang berubah hanya fungsi pembagi.

### 7.2 Pengambilan butir

Untuk tiap sel (UK, level): ambil acak sejumlah yang diminta dari soal aktif yang cocok, memakai `pickSoalRandom()` yang sudah ada (`bank-soal/api.js:208`) dengan `excludeIds` diisi butir yang sudah terpilih di sel lain agar tidak ada duplikasi antar-UK.

Bila stok kurang dari yang diminta: ambil semuanya, catat `terpenuhi < diminta` di `blueprint`, tampilkan defisit di layar. **Tidak menggeser ke level lain** — menutupi kekurangan dengan butir level berbeda akan membuat laporan mengklaim pengukuran yang tidak pernah terjadi.

### 7.3 Integrasi

Tombol **Susun dari SKL** di `exam-modal.js`. Hasilnya mengisi `soalIds` pada pemilih soal yang sudah ada; admin masih bebas menambah dan mengurangi setelahnya. `blueprint` ikut tersimpan saat exam disimpan.

Tombol tidak muncul bila `bimtek.skl` kosong.

## 8. Tahap 4 — Laporan

### 8.1 Fungsi penilaian capaian

Fungsi baru di `report-api.js`:

```
calcLevelAttainment(detail, soalMap, sklRow, blueprint) → {
  ukKode, ukNama, target, ambang,
  perLevel: { C1: { benar, total, pct }, ... },
  levelTercapai,    // 'C1'..'C6' | null
  memenuhiTarget,   // boolean
  tipis,            // true bila level penentu bersandar < 2 butir
  defisit           // level yang diminta SKL tapi tak tersedia di bank
}
```

**Aturan `levelTercapai`:** level tertinggi *L* yang persentase benarnya ≥ `ambang`, **dan** seluruh level di bawah *L* juga ≥ `ambang`. Bila tidak ada level yang lolos, `levelTercapai = null` dan dilaporkan sebagai belum tercapai — bukan dibulatkan ke level terendah.

Syarat berjenjang itu penting: peserta yang gagal C1 tapi kebetulan benar di C3 belum menunjukkan penguasaan C3, ia menunjukkan tebakan yang beruntung.

**Penandaan `tipis`:** bernilai `true` bila level yang menentukan `levelTercapai` (atau level yang menggagalkannya) hanya diwakili < 2 butir. Dari §2, ini kondisi mayoritas — 44 sel berisi tepat satu butir. Ditampilkan terbuka di semua laporan.

### 8.2 Laporan Peserta — bagian C

Bagian "C. Perubahan Kompetensi" (`sub-report-peserta.js:954`) mempertahankan persentase yang sudah ada, ditambah level tercapai dan narasinya:

```
Mengoperasikan Pompa                    target: C3 Menerapkan
  sebelum  C1 Mengingat  →  sesudah  C3 Menerapkan     ✓ tercapai
  Saudara kini mampu menerapkan prosedur pengoperasian
  pompa pada situasi kerja nyata, tidak sekadar menghafalkan.

Menganalisis Vibrasi                    target: C4 Menganalisis
  sebelum  —             →  sesudah  C2 Memahami       ✗ belum
  Saudara memahami konsep vibrasi, namun belum menunjukkan
  kemampuan menguraikan penyebab kelainan vibrasi.
  ⚠ Penilaian level C3 ke atas bersandar pada 1 butir soal.
```

Kalimat naratif disusun di `report-narrative.js` memakai `BLOOM_LEVELS[].nama` dan kata kerja per level, mengikuti pola `generateNarasiDeskriptif()` yang sudah ada (`report-narrative.js:566`).

### 8.3 Laporan Penyelenggara — blok pemenuhan SKL

Blok baru setelah "Perbandingan Pre/Post per Unit Kompetensi" (`sub-report-penyelenggara.js:274`):

```
PEMENUHAN STANDAR KOMPETENSI LULUSAN

  UK                    target  capai ≥ target   rata-rata akhir
  Mengoperasikan Pompa    C3      22/28   79%          C3
  Merawat Pipa            C3      19/28   68%          C2
  Menganalisis Vibrasi    C4       4/28   14%   ⚠      C2

  ⚠ Menganalisis Vibrasi jauh di bawah sasaran.
    Bank soal hanya menyediakan 1 butir C4 dari 2 yang
    diminta SKL — kesimpulan ini perlu diperkuat sebelum
    dijadikan dasar evaluasi materi.
```

Defisit dibaca dari `blueprint`, bukan disimpulkan dari soal yang kebetulan ada.

### 8.4 Perilaku tanpa SKL

Bimtek tanpa `bimtek.skl` menampilkan laporan persis seperti sekarang. Seluruh tambahan di §8.2 dan §8.3 bersyarat pada keberadaan SKL.

## 9. Pembekuan Nilai Bimtek Selesai

Persyaratan: mengisi `bloomLevel` tidak boleh mengubah nilai peserta pada bimtek yang sudah selesai.

**Nilai lama sudah beku secara struktural.** Bobot tiap butir ikut tersimpan ke `exam_results.detail[soalId].bobot` saat scoring (`scorer.js:49-55`), dan laporan membaca bobot tersimpan itu, bukan menghitung ulang dari bank soal (`report-api.js:394`). `bimtek_scores.pretest/posttest` juga berupa angka tersimpan. Mengubah `bank_soal.bloomLevel` tidak menyentuh satu pun di antaranya.

Satu-satunya jalur penulisan ulang adalah `scoreAllSubmissions()`, yang di seluruh proyek hanya dipanggil dari tombol Sinkronisasi (`sub-prepost.js:195`). Tidak ada penghitungan ulang otomatis.

**Pengaman yang ditambahkan:** tombol Sinkronisasi dinonaktifkan untuk bimtek berstatus `selesai` (`BIMTEK_STATUS.SELESAI`), disertai penjelasan alasannya. Tersedia buka paksa lewat dialog konfirmasi yang menyebut akibatnya, tercatat di audit log dengan aksi `force_resync_completed_bimtek`.

**Efek samping yang diterima:** 29 soal tanpa `unitKompetensi` dikelompokkan di laporan memakai `bloomLevel` sebagai pengganti kunci UK (`report-api.js:392`). Untuk butir-butir itu, label baris pada laporan lama berubah dari `unknown` menjadi `C4` dan seterusnya. Angkanya tetap; yang bergeser hanya teks pengelompokan. Tidak dikompensasi — memberi label yang benar lebih baik daripada mempertahankan `unknown`.

## 10. Keputusan Desain & Alasannya

| Keputusan | Alasan |
|---|---|
| SKL bersatuan per UK, bukan per bimtek atau per sel UK×level | Per bimtek terlalu kasar untuk membedakan UK berat dan ringan; per sel menuntut admin mengisi hingga 336 angka. Per UK cukup ekspresif dengan dua isian per baris. |
| Pre dan post memakai butir yang sama | Hanya 18 dari 336 sel punya ≥2 butir (§2). Set paralel akan menghasilkan defisit di hampir semua sel. |
| Pembagian butir condong ke level target | Yang hendak dibuktikan adalah pencapaian level target, sehingga di situ butir terbanyak diperlukan. Dapat disunting admin. |
| `levelTercapai` mensyaratkan seluruh level di bawah juga lolos | Tanpa syarat itu, satu tebakan beruntung di level tinggi cukup untuk mengklaim penguasaan. |
| Defisit stok dicatat, tidak digeser ke level lain | Menutupi kekurangan dengan butir level berbeda membuat laporan mengklaim pengukuran yang tidak terjadi. |
| Penandaan `tipis` ditampilkan, bukan disembunyikan | 44 sel berisi satu butir. Menyembunyikannya berarti menerbitkan angka yang tampak pasti padahal tidak. |
| Klasifikasi Bloom dikerjakan dalam sesi, bukan integrasi API | Proyek tidak punya backend; API menuntut Cloud Functions, upgrade Blaze, dan akun berbayar terpisah — tidak sebanding untuk backfill sekali jalan. |
| SKL opsional | Bimtek lama dan bimtek sederhana tetap berjalan tanpa perubahan. |

## 11. Urutan Pengerjaan

| Tahap | Isi | Nilainya bila berhenti di sini |
|---|---|---|
| 1 | Pengisian Bloom, pewajiban form, matriks stok | Memperbaiki bobot nilai yang sekarang keliru untuk 154 soal |
| 2 | SKL pada form bimtek | Sasaran bimtek terdokumentasi dan stok banknya terlihat |
| 3 | Generator | Menghemat waktu penyusunan ujian |
| 4 | Peningkatan dua laporan | Tujuan akhir: capaian kognitif terpetakan |

Tiap tahap berdiri sendiri dan bernilai tanpa tahap berikutnya.

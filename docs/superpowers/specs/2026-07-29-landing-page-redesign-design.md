# Redesign Landing Page Publik (root `index.html`)

## Konteks

`index.html` di root repo adalah halaman gateway sebelum masuk ke salah satu dari 4 aplikasi terpisah (`admin/`, `exam/`, `pendaftar/`, `peserta/`). Halaman ini belum pernah melalui proses desain yang disengaja — versi sebelumnya adalah hero + 3 kartu (Admin/Ujian/Pendaftar) dengan tema biru terang generik, dan bahkan tidak menyertakan kartu ke-4 (**Portal Peserta**, aplikasi `peserta/` untuk cek sertifikat & evaluasi bintang pengajar) yang sudah ada di kode tapi tidak pernah ditautkan dari sini.

Ini bukan bagian dari scope `DESIGN.md` (yang khusus Dashboard admin dengan tema P&ID gelap teknis) — tapi karena seluruh admin app sudah dikomit ke satu warna dominan cyan-teal sepanjang redesign sebelumnya, landing page ini (sebagai pintu masuk pertama ke seluruh sistem) mewarisi hue yang sama untuk konsistensi identitas, meski tetap punya karakter visual sendiri sebagai halaman publik pertama.

## Keputusan Desain

### 1. Struktur — Split asimetris berdasarkan audiens

Landing page dibagi 2 sisi berdasarkan siapa yang memakainya, bukan ditampilkan sebagai grid kartu setara:

- **Sisi kiri — "Staff BTAM"** (≈30% lebar): 1 kartu besar tunggal ("Admin Panel") yang mengisi seluruh tinggi kolom.
- **Sisi kanan — "Peserta & Publik"** (≈70% lebar): 3 baris kartu bertumpuk vertikal (bukan sejajar horizontal) — Pendaftar, Ujian, Portal Peserta — masing-masing baris berisi judul+deskripsi di kiri, tombol aksi di kanan.

Proporsi 30/70 dipilih karena sisi staff cuma punya 1 tujuan (Admin), sedangkan sisi publik punya 3 tujuan berbeda — memberi ruang sejajar dengan jumlah konten, bukan 50/50 yang menyisakan banyak ruang kosong di sisi staff.

### 2. Header/topbar — identitas kelembagaan wajib

Topbar penuh membentang di atas kedua sisi, berisi logo instansi (Kementerian PU/Ditjen Cipta Karya) + nama "Balai Teknik Air Minum" + badge "SI-SABAT". Ini memenuhi `PRODUCT.md` Brand Commitments: identitas kelembagaan wajib tampil jelas, bukan elemen dekoratif yang bisa dihilangkan. Topbar pakai dasar gelap `#0b0f10` — identik dengan shell admin — supaya brand terlihat konsisten sejak detik pertama.

### 3. Warna — cyan-teal, konsisten dengan seluruh sistem

- **Sisi Staff**: dasar gelap `linear-gradient(160deg, #0d1416, #0b0f10)` (sama dengan gradien shell admin), teks putih, label `#5eead4`, kartu kaca `rgba(45,212,191,.08)` dengan border `rgba(45,212,191,.25)`, tombol solid `#0d9488` teks `#f0fdfa`.
- **Sisi Publik**: dasar terang teal-tint `linear-gradient(160deg, #ecfdf9, #f0fdfa)`, label `#0d9488`, kartu kaca putih semi-transparan `rgba(255,255,255,.75)` dengan border teal tipis `rgba(45,212,191,.25)` dan shadow lembut `rgba(13,148,136,.08)`, tombol gradien `linear-gradient(135deg, #0d9488, #14b8a6)` teks `#f0fdfa`.
- **Tidak dipakai**: warna indigo/ungu yang sempat dieksplorasi di draft awal — ditolak eksplisit karena membentuk identitas warna baru yang tidak konsisten dengan seluruh admin app yang sudah direstyle cyan-teal.

### 4. Gaya visual — glassmorphism lembut

Kartu di kedua sisi memakai efek kaca (`backdrop-filter: blur`, border tipis semi-transparan, radius besar ~10-12px) — bukan gradien teks, bukan flat solid kaku. Tombol berbentuk pill (`border-radius: 999px`).

### 5. Responsif — mobile

Split kiri-kanan berubah jadi tumpukan vertikal penuh di layar sempit: **3 baris kartu Publik tampil dulu** (karena mayoritas pengunjung landing page pertama kali adalah calon pendaftar/peserta, bukan staff), lalu kartu besar Staff BTAM menyusul di bagian bawah sebagai jalur cepat non-intrusif untuk yang sudah familiar dengan sistem.

## Scope

- **Termasuk**: hanya `index.html` di root repo (markup + CSS inline, sama seperti struktur file saat ini — tidak perlu file terpisah karena halaman ini kecil dan berdiri sendiri).
- **Tidak termasuk**: isi ke-4 aplikasi tujuan (`admin/`, `exam/`, `pendaftar/`, `peserta/`) itu sendiri — landing page murni pintu masuk, tidak mengubah apa pun di dalam masing-masing aplikasi.
- **Perbaikan sekalian**: menambahkan kartu "Portal Peserta" (`peserta/`) yang sebelumnya hilang dari landing page meski aplikasinya sudah ada dan berfungsi.

## Testing

Verifikasi manual di browser:
- Buka `index.html` di layar desktop lebar — cek proporsi split 30/70, topbar logo+nama tampil jelas, 4 kartu (1 Staff + 3 Publik) semua bisa diklik ke tujuan yang benar (`admin/`, `exam/`, `pendaftar/`, `peserta/`).
- Resize ke lebar mobile (~375px) — cek split berubah jadi tumpukan vertikal, urutan Publik (3 baris) dulu baru Staff di bawah.
- Console bersih dari error.

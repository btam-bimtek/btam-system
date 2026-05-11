# RESUME Implementasi & Setup — Sesi 24 Apr 2026

**Cakupan:** GitHub setup, deployment, workflow planning, testing M1.1-1.3
**Status:** M1.1 ✅ M1.2 ✅ M1.3 ✅ — live di GitHub Pages, siap lanjut M1.4
**Repo:** `btam-system` (private) di GitHub
**URL Live:** `https://[username].github.io/btam-system/`
**Firebase project:** `bimtek-27fe5`

---

## 1. Keputusan Infrastruktur

### 1.1. Hosting: GitHub Pages
- Dipilih karena gratis, familiar (drag-and-drop upload), dan bisa jadi hosting
- Alternatif yang dipertimbangkan: GitLab, Codeberg, Google Drive — tidak dipilih karena tidak ada keunggulan nyata
- Private repo → credentials Firebase tidak exposed ke publik

### 1.2. Struktur Multi-App (Opsi 2: Landing Page)
Dipilih karena URL panjang GitHub Pages tidak perlu dihafal user — cukup ingat root URL:
```
https://[username].github.io/btam-system/          ← Landing page
https://[username].github.io/btam-system/admin/    ← Admin app
https://[username].github.io/btam-system/exam/     ← Exam app (M1.5)
https://[username].github.io/btam-system/pendaftar/ ← Pendaftar (Phase 2b)
```

### 1.3. Nama Repo: `btam-system`
- Sebelumnya `btam-system`, diganti sebelum upload (timing terbaik — tidak ada file yang terlanjur)
- Semua import JS harus pakai **relative path** agar tidak terikat nama repo

---

## 2. Struktur Repo Final

```
btam-system/
├── index.html                    ← Landing page dengan 3 button
├── PROGRESS.md                   ← Catatan milestone status
├── shared/                       ← 7 file shared (firebase-config, auth, db, normalize, validate, constants, logger)
├── admin/
│   ├── index.html
│   ├── styles/
│   └── js/
│       ├── main.js, router.js, store.js, auth-guard.js
│       ├── modules/ (auth, dashboard, peserta-master, pengajar-master, instansi-master, admin-users, bank-soal)
│       ├── components/ (modal, data-table, toast)
│       └── layouts/ (sidebar, navbar)
├── exam/
│   └── index.html                ← Placeholder "Coming Soon" (M1.5)
└── pendaftar/
    └── index.html                ← Placeholder "Coming Soon" (Phase 2b)
```

---

## 3. Proses Upload ke GitHub

### Cara upload yang berhasil:
- **Opsi C** (drag seluruh folder dari file explorer) — berhasil untuk semua folder
- Urutan: `shared/` → `admin/` → placeholder `exam/` dan `pendaftar/`

### Catatan penting:
- GitHub Pages tidak bisa diaktifkan saat repo kosong — harus upload minimal 1 file dulu
- Setelah upload `index.html` pertama, baru enable Pages di Settings → Pages → Branch: main, folder: / (root)
- Build time 1-2 menit setelah commit

---

## 4. Testing M1.1-1.3 di GitHub Pages

Semua fitur ditest di environment live (bukan localhost):

| Test | Hasil |
|---|---|
| Login admin | ✅ Berhasil |
| Routing ke admin panel | ✅ Berhasil |
| Add peserta | ✅ Berhasil |
| Import Excel peserta | ✅ Berhasil |
| Search peserta | ✅ Berhasil |
| Add soal bank soal | ✅ Berhasil |
| Filter soal per bidang | ✅ Berhasil |

**Kesimpulan:** Tidak ada perbedaan behavior antara localhost dan GitHub Pages.

---

## 5. Evaluasi Kecepatan & Testing

### Temuan penting:
- M1.1-1.3 selesai dalam **2 hari kerja** (~10 jam), jauh lebih cepat dari estimasi awal 53-73 jam
- Kemungkinan: testing longgar (happy path only), code reuse dari aplikasi existing, scope lebih narrow dari estimasi

### Framework testing yang disepakati:
**3 layer testing per fitur:**
- **Layer A — Happy path:** data valid, user benar → harus 100%
- **Layer B — Edge case:** data ekstrem, input tidak terduga → minimal 80%
- **Layer C — Error path:** user salah, sistem gagal → minimal 60%

**Checklist selesai per milestone:**
```
[ ] Semua fitur di definisi selesai OPUSPLAN sudah jalan?
[ ] Happy path semua fitur sudah ditest?
[ ] Edge case utama sudah ditest (minimal 3 per fitur)?
[ ] Error handling ada — user dapat feedback kalau ada yang salah?
[ ] Data persist benar di Firestore?
[ ] Tidak ada console error merah saat normal usage?
[ ] File sudah di-commit ke GitHub?
[ ] Tidak ada fitur work-in-progress di-commit?
```

---

## 6. Revised Workflow Harian

```
Pagi    → Review scope hari ini (30 menit)
Siang   → Coding + test per fitur (3-4 jam)
Sore    → Commit + catat bug/blockers (30 menit)

Per milestone:
Hari 1-N   → Coding + testing per fitur
Hari N+1   → Full checklist + edge case testing
Hari N+2   → Fix bug + commit + dokumentasi mini (catatan di PROGRESS.md)
Hari N+3   → Mulai milestone berikutnya
```

---

## 7. Revised Timeline (Realistis, 5 jam/hari)

Berdasarkan kecepatan aktual M1.1-1.3, estimasi direvisi turun 25-30%:

| Phase | Estimasi Jam | Minggu | Target Selesai |
|---|---|---|---|
| Phase 1 (M1.4-1.10) | 130-160 | 6-8 | End Juni/Early Juli 2026 |
| Phase 2a (Alumni) | 40-60 | 2-3 | Mid Juli 2026 |
| Phase 2b (Rekrutmen) | 40-55 | 2-3 | End Juli/Early Aug 2026 |
| Phase 3 (Features) | 30-45 | 1-2 | Mid-Late Aug 2026 |
| Final Testing | 15-20 | 1 | Sept 2026 |
| **Total** | **~265-355** | **~14-19** | **Go-live Feb 2027 ✅** |

---

## 8. Pekerjaan Rumah Sebelum M1.4

1. **Firebase CLI** — selesaikan `firebase login` + `firebase use --add` + `firebase deploy --only firestore:indexes` agar tidak perlu buat index manual satu-satu
2. **PROGRESS.md** — update dengan tanggal selesai M1.1-1.3 yang sebenarnya
3. **Test edge case** yang belum sempat ditest di M1.2-1.3:
   - Import 100+ peserta → apakah timeout?
   - Duplicate noPeserta case-insensitive → block?
   - Non-superadmin akses delete → block?

---

## 9. Next: Milestone 1.4 — Bimtek CRUD

File yang akan dibuat:
- `bimtek/api.js` — CRUD bimtek + sub-collection mapel
- `bimtek/list.js` — list dengan filter status + tipe
- `bimtek/detail.js` — form create/edit bimtek + tab mapel + tab peserta
- `bimtek/form-mapel.js` — modal add/edit mapel (JP, pengajar, jadwal)

Constraint penting yang harus ditest di M1.4:
- Mapel 1-9 JP
- Mapel > 7 JP di hari Jumat → warning (ISHOMA 11:15-13:45)
- Total JP > 8 dalam 1 hari → warning "hari padat"
- Mapel tidak boleh lintas hari → blocker

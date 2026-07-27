# BTAM System

## Knowledge Graph (graphify)

Project ini punya knowledge graph hasil `/graphify` di `graphify-out/graph.json` (1231 node, 3873 edge, 48 komunitas — mencakup semua kode admin/exam/pendaftar/peserta + dokumen resume sesi + DESIGN.md/PRODUCT.md).

- Sebelum menjawab pertanyaan soal arsitektur, alur data, atau relasi antar modul, cek dulu `graphify-out/graph.json` ada — kalau ada, jalankan `/graphify query "<pertanyaan>"` dulu sebelum menjawab dari ingatan/asumsi.
- Graph di-update otomatis lewat post-commit hook setiap ada commit baru (lihat `.git/hooks/post-commit`). Kalau ternyata graph terasa basi (menyebut file yang sudah dihapus/berubah drastis), jalankan `/graphify --update` manual.
- Report lengkap ada di `graphify-out/GRAPH_REPORT.md` (god nodes, surprising connections, daftar komunitas).

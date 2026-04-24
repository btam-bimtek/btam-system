/**
 * PATCH untuk admin/js/main.js atau router.js
 * Tambahkan route-route berikut ke registerRoutes() yang sudah ada.
 *
 * Copy-paste bagian ini ke dalam fungsi registerRoutes() di main.js / router.js
 * di bawah route bank-soal yang sudah ada.
 */

// ─── Tambah ke registerRoutes() di main.js ────────────────────────────────────

/*
  router.register('/bimtek', async (container) => {
    setPageTitle('Daftar Bimtek');
    const { renderBimtekList } = await import('./modules/bimtek/list.js');
    await renderBimtekList(container);
  });

  router.register('/bimtek/create', async (container) => {
    setPageTitle('Bimtek Baru');
    const { renderBimtekForm } = await import('./modules/bimtek/form.js');
    await renderBimtekForm(container, null);
  });

  router.register('/bimtek/:id', async (container, params) => {
    setPageTitle('Detail Bimtek');
    const { renderBimtekDetail } = await import('./modules/bimtek/detail.js');
    await renderBimtekDetail(container, params.id);
  });

  router.register('/bimtek/:id/edit', async (container, params) => {
    setPageTitle('Edit Bimtek');
    const { renderBimtekForm } = await import('./modules/bimtek/form.js');
    await renderBimtekForm(container, params.id);
  });
*/

// ─── Tambah ke sidebar.js (di dalam buildSidebarItems()) ─────────────────────

/*
  Tambahkan item ini di sidebar setelah 'Bank Soal':

  { href: '#/bimtek', icon: 'bi-calendar-event', label: 'Bimtek' },
*/

// ─── Tambah ke firestore.indexes.json (tambahkan ke array "indexes") ──────────

/*
  {
    "collectionGroup": "bimtek",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted", "order": "ASCENDING" },
      { "fieldPath": "periode.mulai", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "bimtek",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "periode.mulai", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "bimtek",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "deleted", "order": "ASCENDING" },
      { "fieldPath": "tipe", "order": "ASCENDING" },
      { "fieldPath": "periode.mulai", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "mapel",
    "queryScope": "COLLECTION_GROUP",
    "fields": [
      { "fieldPath": "urutan", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "sesi",
    "queryScope": "COLLECTION_GROUP",
    "fields": [
      { "fieldPath": "tanggal", "order": "ASCENDING" },
      { "fieldPath": "jamMulai", "order": "ASCENDING" }
    ]
  }
*/

// ─── Setelah update firestore.indexes.json, deploy: ──────────────────────────
// firebase deploy --only firestore:indexes

export const PATCH_NOTE = 'Lihat komentar di atas untuk patch yang perlu diterapkan manual';

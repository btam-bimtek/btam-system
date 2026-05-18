// admin/js/modules/settings/api.js
// CRUD untuk app_settings dan audit_log.

import {
  db, doc, getDoc, getDocs, setDoc, updateDoc,
  collection, query, orderBy, limit,
  serverTimestamp, snapToArray
} from '../../../../shared/db.js';
import { COL } from '../../../../shared/constants.js';
import { logAudit } from '../../../../shared/logger.js';
import { ref as storageRef, uploadBytes, getDownloadURL }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { storage } from '../../../../shared/firebase-config.js';

// ─── APP SETTINGS CRUD ───────────────────────────────────────────────────────

/**
 * Get satu doc settings. Tidak throw jika tidak ada — return null.
 * @param {'lembaga'|'bloom_bobot'|'thresholds'} docId
 */
export async function getAppSetting(docId) {
  const snap = await getDoc(doc(db, COL.APP_SETTINGS, docId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Save/overwrite satu doc settings (set + merge).
 */
export async function saveAppSetting(docId, data) {
  const ref = doc(db, COL.APP_SETTINGS, docId);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({
    action: `save_settings_${docId}`,
    entityType: 'app_settings',
    entityId: docId,
    metadata: { fields: Object.keys(data) }
  });
}

/**
 * Load semua settings sekaligus (3 parallel reads).
 */
export async function loadAllSettings() {
  const [lembaga, bloomBobot, thresholds] = await Promise.all([
    getAppSetting('lembaga'),
    getAppSetting('bloom_bobot'),
    getAppSetting('thresholds')
  ]);
  return { lembaga, bloomBobot, thresholds };
}

// ─── LOGO UPLOAD ─────────────────────────────────────────────────────────────

/**
 * Upload logo ke Firebase Storage, simpan URL ke app_settings/lembaga.
 * @param {File} file
 * @returns {string} downloadURL
 */
export async function uploadLogo(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `settings/logo.${ext}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  const url = await getDownloadURL(ref);

  // Simpan URL ke lembaga settings
  await setDoc(
    doc(db, COL.APP_SETTINGS, 'lembaga'),
    { logoUrl: url, updatedAt: serverTimestamp() },
    { merge: true }
  );

  await logAudit({
    action: 'upload_logo',
    entityType: 'app_settings',
    entityId: 'lembaga',
    metadata: { ext }
  });

  return url;
}

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────

/**
 * Ambil audit log terbaru (max 150 entries, client-side filter).
 */
export async function listAuditLog(maxEntries = 150) {
  const snap = await getDocs(
    query(
      collection(db, COL.AUDIT_LOG),
      orderBy('performedAt', 'desc'),
      limit(maxEntries)
    )
  );
  return snapToArray(snap);
}

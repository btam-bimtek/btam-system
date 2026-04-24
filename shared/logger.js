// shared/logger.js
// Audit log helper — catat setiap write operation penting ke Firestore.
// Log bersifat IMMUTABLE (rules melarang update/delete audit_log).

import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { COL } from './constants.js';

/**
 * Tulis satu entri audit log.
 *
 * @param {object} params
 * @param {string} params.action       - Verb singkat: 'create_peserta', 'delete_bimtek', dst
 * @param {string} params.entityType   - Collection terkait: 'peserta', 'bimtek', 'soal', dst
 * @param {string} [params.entityId]   - Document ID yang dimodifikasi (opsional)
 * @param {object} [params.metadata]   - Data tambahan bebas (jangan taruh PII sensitif)
 * @returns {Promise<void>}            - Non-blocking; error di-swallow supaya tidak ganggu UI
 */
export async function logAudit({ action, entityType, entityId = null, metadata = {} }) {
  try {
    const user = getCurrentUser();
    await addDoc(collection(db, COL.AUDIT_LOG), {
      action,
      entityType,
      entityId,
      metadata,
      performedBy: user?.email ?? 'system',
      performedAt: serverTimestamp(),
      userAgent:   navigator.userAgent.slice(0, 200) // trim panjang
    });
  } catch (err) {
    // Log ke console tapi tidak throw — audit gagal tidak boleh break UI
    console.warn('[logger] Gagal tulis audit log:', err.message);
  }
}

/**
 * Helper khusus untuk log error dari catch block.
 */
export async function logError({ action, entityType, entityId = null, error }) {
  return logAudit({
    action,
    entityType,
    entityId,
    metadata: { error: error?.message ?? String(error), stack: error?.stack?.slice(0, 500) }
  });
}

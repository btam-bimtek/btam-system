// shared/db.js
// Thin wrapper di atas Firestore SDK.
// Tujuan: satu tempat untuk import Firestore, konsistensi error handling,
// dan kemudahan mock saat testing.

export {
  // Document operations
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,

  // Collection & queries
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  limitToLast,
  startAfter,
  endBefore,
  getCountFromServer,

  // Sub-collection
  // (pakai doc() + collection() bertingkat)

  // Real-time
  onSnapshot,

  // Batch & transaction
  writeBatch,
  runTransaction,

  // Timestamps
  serverTimestamp,
  Timestamp,

  // Sentinel values
  increment,
  arrayUnion,
  arrayRemove,
  deleteField
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export { db } from './firebase-config.js';

// ─── Helper: snapshot → array of {id, ...data} ──────────────
/**
 * Ubah QuerySnapshot menjadi array object dengan id.
 * @param {QuerySnapshot} snap
 * @returns {object[]}
 */
export function snapToArray(snap) {
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

/**
 * Ubah DocumentSnapshot menjadi object dengan id, atau null.
 * @param {DocumentSnapshot} snap
 * @returns {object|null}
 */
export function snapToDoc(snap) {
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

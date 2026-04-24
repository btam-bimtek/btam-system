// shared/auth.js
// Helper autentikasi admin (Firebase Auth email/password).
// Peserta TIDAK menggunakan modul ini — mereka pakai magic link.

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { auth, db } from './firebase-config.js';

// ─── State ───────────────────────────────────────────────────
let _currentUser   = null; // Firebase User object
let _adminProfile  = null; // Dokumen admin_users/{email}

// ─── Login ───────────────────────────────────────────────────
/**
 * Login admin.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object, profile: object}>}
 * @throws jika kredensial salah atau akun non-aktif
 */
export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
  const profile    = await _loadAdminProfile(credential.user.email);

  if (!profile) {
    await firebaseSignOut(auth);
    throw new Error('Akun tidak terdaftar sebagai admin sistem.');
  }
  if (!profile.active) {
    await firebaseSignOut(auth);
    throw new Error('Akun dinonaktifkan. Hubungi superadmin.');
  }

  // Catat waktu login terakhir (non-blocking)
  updateDoc(doc(db, 'admin_users', profile.email), {
    lastLoginAt: serverTimestamp()
  }).catch(console.warn);

  _currentUser  = credential.user;
  _adminProfile = profile;

  return { user: _currentUser, profile: _adminProfile };
}

// ─── Logout ──────────────────────────────────────────────────
export async function signOut() {
  await firebaseSignOut(auth);
  _currentUser  = null;
  _adminProfile = null;
}

// ─── Password Reset ──────────────────────────────────────────
export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(auth, email.toLowerCase().trim());
}

// ─── Observers ───────────────────────────────────────────────
/**
 * Subscribe ke perubahan auth state.
 * Callback menerima { user, profile } atau null saat logout.
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export function onAuthChange(callback) {
  return firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      _currentUser  = null;
      _adminProfile = null;
      callback(null);
      return;
    }

    // Re-load profile dari Firestore saat halaman di-refresh
    const profile = await _loadAdminProfile(firebaseUser.email);
    if (!profile || !profile.active) {
      // Akun dihapus/dinonaktifkan saat sesi aktif
      await firebaseSignOut(auth);
      callback(null);
      return;
    }

    _currentUser  = firebaseUser;
    _adminProfile = profile;
    callback({ user: _currentUser, profile: _adminProfile });
  });
}

// ─── Getters ─────────────────────────────────────────────────
export function getCurrentUser()    { return _currentUser; }
export function getAdminProfile()   { return _adminProfile; }
export function isAuthenticated()   { return _currentUser !== null; }
export function isSuperAdmin()      { return _adminProfile?.role === 'superadmin'; }
export function isViewer()          { return _adminProfile?.role === 'viewer'; }
export function canWrite()          { return isAuthenticated() && !isViewer(); }

// ─── Internal ────────────────────────────────────────────────
async function _loadAdminProfile(email) {
  const snap = await getDoc(doc(db, 'admin_users', email.toLowerCase()));
  return snap.exists() ? { ...snap.data(), _id: snap.id } : null;
}

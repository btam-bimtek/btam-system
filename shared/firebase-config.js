// shared/firebase-config.js
// ─────────────────────────────────────────────────────────────
// Ganti semua nilai YOUR_* dengan credentials dari Firebase Console:
//   Project Settings → General → Your apps → Web app → SDK setup
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBaMOaqhHJ2DnIDsepunwZevidWWveOr7g',
  authDomain:        'bimtek-27fe5.firebaseapp.com',
  projectId:         'bimtek-27fe5',
  storageBucket:     'bimtek-27fe5.firebasestorage.app',
  messagingSenderId: '176268102387',
  appId:             '1:176268102387:web:ba809b01efdd06ac184586'
};

const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

// ─── Emulator (development only) ────────────────────────────
// Uncomment bagian ini saat develop lokal dengan Firebase Emulator Suite.
// Jangan di-commit dalam kondisi aktif ke production branch.
//
// const IS_EMULATOR = location.hostname === 'localhost';
// if (IS_EMULATOR) {
//   connectFirestoreEmulator(db, 'localhost', 8080);
//   connectAuthEmulator(auth, 'http://localhost:9099');
//   connectStorageEmulator(storage, 'localhost', 9199);
//   console.info('[Firebase] Menggunakan emulator lokal');
// }

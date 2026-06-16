// ═══════════════════════════════════════════════
//  AUTH.JS — Login con Google, sesión, avatar
// ═══════════════════════════════════════════════

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import { auth, STATE, showToast, esc } from './config.js';
import { subscribeToDocuments }        from './db.js';
import { renderList }                  from './ui.js';
import { setAccessToken }              from './drive.js';

// ─── PROVIDER ────────────────────────────────────────────────────────────────
const provider = new GoogleAuthProvider();
// Pedir permiso de Drive en el mismo login de Google
provider.addScope('https://www.googleapis.com/auth/drive.file');

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
export function initAuth() {
  document.getElementById('btnGoogle').addEventListener('click', signIn);
  document.getElementById('btnSignOut').addEventListener('click', signOut);
  document.getElementById('btnSignOutSettings')?.addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('open');
    signOut();
  });
  onAuthStateChanged(auth, handleAuthChange);
}

// ═══════════════════════════════════════════════
//  SIGN IN
// ═══════════════════════════════════════════════
async function signIn() {
  const btn = document.getElementById('btnGoogle');
  btn.disabled = true;
  btn.textContent = 'Conectando…';

  try {
    // signInWithPopup devuelve el credential con el access token de Google
    const result = await signInWithPopup(auth, provider);

    // ── Capturar el access token de Google para Drive ──
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setAccessToken(credential.accessToken);
      // Guardarlo en sessionStorage por si se recarga la página
      try {
        sessionStorage.setItem('google_access_token', credential.accessToken);
      } catch (_) {}
    }

    // handleAuthChange se dispara automáticamente por onAuthStateChanged

  } catch (err) {
    console.error('[Auth] signIn error:', err);
    btn.disabled = false;
    btn.innerHTML = googleBtnHTML();

    if (err.code === 'auth/popup-closed-by-user') {
      showToast('Inicio cancelado');
    } else if (err.code === 'auth/popup-blocked') {
      showToast('El navegador bloqueó el popup. Permite ventanas emergentes e intenta de nuevo.');
    } else {
      showToast('Error al iniciar sesión: ' + (err.message ?? err.code));
    }
  }
}

// ═══════════════════════════════════════════════
//  SIGN OUT
// ═══════════════════════════════════════════════
export async function signOut() {
  try {
    sessionStorage.removeItem('google_access_token');
    await fbSignOut(auth);
  } catch (err) {
    console.error('[Auth] signOut error:', err);
    showToast('Error al cerrar sesión');
  }
}

// ═══════════════════════════════════════════════
//  AUTH STATE CHANGE
// ═══════════════════════════════════════════════
let _unsubDocs = null;

function handleAuthChange(user) {
  if (user) {
    STATE.user = user;
    showApp();
    setupAvatar(user);
    updateSettingsModal(user);

    // Intentar recuperar el access token de Drive de sessionStorage
    // (útil cuando se recarga la página sin hacer login de nuevo)
    const savedToken = sessionStorage.getItem('google_access_token');
    if (savedToken) {
      setAccessToken(savedToken);
    }

    // Suscribirse a documentos en Firestore
    if (_unsubDocs) _unsubDocs();
    _unsubDocs = subscribeToDocuments(user.uid, (docs) => {
      STATE.docs = docs;
      renderList();
    });

  } else {
    STATE.user = null;
    STATE.docs = [];
    STATE.driveReady  = false;
    STATE.driveRootId = null;

    if (_unsubDocs) { _unsubDocs(); _unsubDocs = null; }
    showAuthScreen();
  }
}

// ═══════════════════════════════════════════════
//  PANTALLAS
// ═══════════════════════════════════════════════
function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display  = '';
}

function showAuthScreen() {
  document.getElementById('authScreen').style.display = '';
  document.getElementById('appScreen').style.display  = 'none';
  const btn = document.getElementById('btnGoogle');
  if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
}

// ═══════════════════════════════════════════════
//  AVATAR
// ═══════════════════════════════════════════════
function setupAvatar(user) {
  const el = document.getElementById('userAvatar');
  if (!el) return;
  if (user.photoURL) {
    const img    = document.createElement('img');
    img.src      = user.photoURL;
    img.className = 'avatar';
    img.alt      = esc(user.displayName ?? '');
    img.title    = esc(user.displayName ?? user.email ?? '');
    el.replaceWith(img);
  } else {
    el.className   = 'avatar-placeholder';
    el.textContent = (user.displayName ?? user.email ?? '?')[0].toUpperCase();
    el.title       = user.displayName ?? user.email ?? '';
  }
}

function updateSettingsModal(user) {
  const el = document.getElementById('sessionUser');
  if (el) el.textContent = `${user.displayName ?? ''} · ${user.email ?? ''}`;
}

// ═══════════════════════════════════════════════
//  HTML BOTÓN GOOGLE
// ═══════════════════════════════════════════════
function googleBtnHTML() {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
    Continuar con Google`;
}

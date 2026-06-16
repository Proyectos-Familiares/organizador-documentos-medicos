// ═══════════════════════════════════════════════
//  DRIVE.JS — Google Drive: carpetas, subida, sync
//  Usa fetch directo con el access token de Firebase
//  Sin dependencia de google.accounts.oauth2
// ═══════════════════════════════════════════════

import {
  STATE, CAT, DRIVE_ROOT_NAME,
  showToast, esc, MESES,
} from './config.js';

import { saveDocument } from './db.js';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const DRIVE_FILES_API  = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

// Cache de IDs de carpetas para no recrearlas en cada subida
const _folderCache = {};

// Access token de Google (obtenido del resultado del signInWithPopup)
let _accessToken = null;

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
export function initDrive() {
  document.getElementById('btnSyncDrive').addEventListener('click', openSyncModal);
  document.getElementById('btnCloseSyncModal').addEventListener('click', closeSyncModal);
  document.getElementById('btnCloseSyncModal2').addEventListener('click', closeSyncModal);
  document.getElementById('syncModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('syncModal')) closeSyncModal();
  });
  document.getElementById('btnImportSelected').addEventListener('click', importSelected);
}

// ═══════════════════════════════════════════════
//  CARGAR TOKEN — llamado desde auth.js tras login
// ═══════════════════════════════════════════════
export async function loadDriveClient() {
  try {
    // Recuperar el access token que Firebase guarda internamente
    _accessToken = await getGoogleAccessToken();

    if (_accessToken) {
      STATE.driveReady = true;
      updateDriveStatus('Conectado — los archivos se guardan en tu Drive automáticamente.');
      console.log('[Drive] Ready with access token');
    } else {
      STATE.driveReady = false;
      updateDriveStatus('No conectado. Cierra sesión y vuelve a entrar.');
      console.warn('[Drive] No access token available');
    }
  } catch (err) {
    console.error('[Drive] loadDriveClient error:', err);
    STATE.driveReady = false;
    updateDriveStatus('Error al conectar con Drive.');
  }
}

// ─── OBTENER ACCESS TOKEN DE GOOGLE ──────────────────────────────────────────
async function getGoogleAccessToken() {
  // Firebase Auth guarda el credential en IndexedDB/localStorage
  // El access token de Google está en el OAuthCredential del resultado del popup
  // Lo buscamos en las claves de localStorage que Firebase usa

  // Método 1: buscar en localStorage (Firebase persistence)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    try {
      const val = localStorage.getItem(key);
      if (!val) continue;
      const data = JSON.parse(val);
      // Firebase guarda el access token de Google en stsTokenManager o credential
      if (data?.credential?.oauthAccessToken) return data.credential.oauthAccessToken;
      if (data?.oauthAccessToken) return data.oauthAccessToken;
    } catch (_) {}
  }

  // Método 2: usar el ID token de Firebase para intercambiar por access token
  // (No funciona directamente - el ID token de Firebase no es un access token de Drive)

  // Método 3: pedir el token directamente con getIdToken y usar el token almacenado
  const { auth } = await import('./config.js');
  const user = auth.currentUser;
  if (!user) return null;

  // Buscar en las claves de Firebase en IndexedDB
  // Firebase v10 puede guardar el token de Google aquí
  try {
    const token = await getUserGoogleToken(user);
    if (token) return token;
  } catch (_) {}

  return null;
}

async function getUserGoogleToken(user) {
  // En Firebase v10, el access token de Google se puede obtener
  // re-autenticando silenciosamente si el scope fue pedido en el login
  const { GoogleAuthProvider, getAuth, reauthenticateWithCredential } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
  );

  // Buscar en sessionStorage
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key) continue;
    try {
      const val = sessionStorage.getItem(key);
      if (!val) continue;
      const data = JSON.parse(val);
      if (data?.oauthAccessToken) return data.oauthAccessToken;
      if (data?.credential?.oauthAccessToken) return data.credential.oauthAccessToken;
    } catch (_) {}
  }
  return null;
}

// ─── SETTER PÚBLICO — auth.js lo llama con el token del popup ────────────────
export function setAccessToken(token) {
  _accessToken = token;
  if (token) {
    STATE.driveReady = true;
    updateDriveStatus('Conectado — los archivos se guardan en tu Drive automáticamente.');
    console.log('[Drive] Access token set from auth');
  }
}

// ─── OBTENER TOKEN ACTUAL ─────────────────────────────────────────────────────
function getToken() {
  if (!_accessToken) throw new Error('Sin token de acceso a Google Drive. Cierra sesión y vuelve a entrar.');
  return _accessToken;
}

// ═══════════════════════════════════════════════
//  CARPETAS — obtener o crear
// ═══════════════════════════════════════════════
async function getOrCreateFolder(name, parentId) {
  const cacheKey = `${parentId}::${name}`;
  if (_folderCache[cacheKey]) return _folderCache[cacheKey];

  const token = getToken();

  // Buscar carpeta existente
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const searchResp = await fetch(
    `${DRIVE_FILES_API}?q=${q}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!searchResp.ok) throw new Error(`Drive search error: ${searchResp.status}`);
  const searchData = await searchResp.json();

  if (searchData.files?.length > 0) {
    _folderCache[cacheKey] = searchData.files[0].id;
    return searchData.files[0].id;
  }

  // Crear carpeta
  const createResp = await fetch(`${DRIVE_FILES_API}?fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  if (!createResp.ok) throw new Error(`Drive create folder error: ${createResp.status}`);
  const createData = await createResp.json();

  _folderCache[cacheKey] = createData.id;
  return createData.id;
}

async function getRootFolder() {
  if (STATE.driveRootId) return STATE.driveRootId;
  const id = await getOrCreateFolder(DRIVE_ROOT_NAME, 'root');
  STATE.driveRootId = id;
  return id;
}

async function getTargetFolder(cat, fecha) {
  const rootId   = await getRootFolder();
  const catName  = CAT[cat]?.driveName ?? 'Otros';
  const catId    = await getOrCreateFolder(catName, rootId);
  const year     = fecha ? fecha.split('-')[0] : new Date().getFullYear().toString();
  const yearId   = await getOrCreateFolder(year, catId);
  const monthIdx = fecha ? parseInt(fecha.split('-')[1], 10) - 1 : new Date().getMonth();
  const monthName = MESES[monthIdx] ?? 'Enero';
  const monthId  = await getOrCreateFolder(monthName, yearId);
  return {
    folderId: monthId,
    path: `${DRIVE_ROOT_NAME} / ${catName} / ${year} / ${monthName}`,
  };
}

// ═══════════════════════════════════════════════
//  SUBIR ARCHIVO A DRIVE
// ═══════════════════════════════════════════════
export async function uploadToDrive(file, meta, onProgress) {
  if (!STATE.driveReady || !_accessToken) {
    throw new Error('Drive no disponible. Cierra sesión y vuelve a entrar.');
  }

  onProgress?.(5);
  const { folderId, path } = await getTargetFolder(meta.cat, meta.fecha);
  onProgress?.(15);

  const ext        = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const datePrefix = meta.fecha ?? new Date().toISOString().split('T')[0];
  const safeName   = meta.name.replace(/[/\\?%*:|"<>]/g, '-');
  const driveName  = `${datePrefix}_${safeName}.${ext}`;

  const token = getToken();

  // Multipart upload (funciona para cualquier tamaño razonable de documento médico)
  const metadata = JSON.stringify({ name: driveName, parents: [folderId] });
  const boundary = 'medicos_boundary_' + Date.now();

  // Construir el cuerpo multipart manualmente
  const metaBytes    = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`
  );
  const closingBytes = new TextEncoder().encode(`\r\n--${boundary}--`);
  const fileBytes    = await file.arrayBuffer();

  const body = new Uint8Array(metaBytes.length + fileBytes.byteLength + closingBytes.length);
  body.set(metaBytes, 0);
  body.set(new Uint8Array(fileBytes), metaBytes.length);
  body.set(closingBytes, metaBytes.length + fileBytes.byteLength);

  onProgress?.(40);

  const resp = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Drive upload error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const result = await resp.json();
  onProgress?.(100);

  return {
    fileId:      result.id ?? '',
    webViewLink: result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`,
    path,
  };
}

// ═══════════════════════════════════════════════
//  SYNC DESDE DRIVE
// ═══════════════════════════════════════════════
let _syncFiles = [];

export async function openSyncModal() {
  document.getElementById('syncModal').classList.add('open');
  document.getElementById('btnImportSelected').style.display = 'none';
  await loadDriveFilesForSync();
}

function closeSyncModal() {
  document.getElementById('syncModal').classList.remove('open');
  _syncFiles = [];
}

async function loadDriveFilesForSync() {
  const content = document.getElementById('syncModalContent');
  content.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  if (!STATE.driveReady || !_accessToken) {
    content.innerHTML = `<div class="sync-empty">Drive no está conectado.<br>Cierra sesión y vuelve a entrar para autorizar el acceso.</div>`;
    return;
  }

  try {
    const registeredIds = new Set(STATE.docs.filter((d) => d.driveFileId).map((d) => d.driveFileId));
    const rootId = await getRootFolder();
    const allFiles = await listFilesRecursive(rootId, DRIVE_ROOT_NAME);
    _syncFiles = allFiles.filter(
      (f) => f.mimeType !== 'application/vnd.google-apps.folder' && !registeredIds.has(f.id)
    );
    renderSyncList(_syncFiles);
  } catch (err) {
    console.error('[Drive] sync error:', err);
    content.innerHTML = `<div class="sync-empty">Error al leer Drive: ${esc(err.message)}</div>`;
  }
}

async function listFilesRecursive(folderId, pathSoFar) {
  const results = [];
  const token   = getToken();
  let pageToken = null;

  do {
    let url = `${DRIVE_FILES_API}?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&fields=nextPageToken,files(id,name,mimeType,webViewLink)&pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) break;
    const data = await resp.json();
    pageToken = data.nextPageToken ?? null;

    for (const f of (data.files ?? [])) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        const sub = await listFilesRecursive(f.id, `${pathSoFar} / ${f.name}`);
        results.push(...sub);
      } else {
        results.push({ ...f, drivePath: pathSoFar });
      }
    }
  } while (pageToken);

  return results;
}

function renderSyncList(files) {
  const content = document.getElementById('syncModalContent');
  const btn     = document.getElementById('btnImportSelected');

  if (!files.length) {
    content.innerHTML = `<div class="sync-empty">✓ Todos los archivos de Drive ya están registrados.</div>`;
    btn.style.display = 'none';
    return;
  }

  btn.style.display = '';
  content.innerHTML = `
    <p style="font-size:13px;color:var(--text3);margin-bottom:14px;">
      <strong>${files.length}</strong> archivo(s) en Drive no registrados. Selecciona los que quieres importar:
    </p>
    <div id="syncFileList">
      ${files.map((f, i) => `
        <div class="sync-file-item">
          <input type="checkbox" class="sync-file-check" id="sc_${i}" checked>
          <div class="sync-file-icon">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div class="sync-file-info">
            <div class="sync-file-name">${esc(f.name)}</div>
            <div class="sync-file-path">${esc(f.drivePath ?? '')}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

async function importSelected() {
  if (!_syncFiles.length) return;
  const btn = document.getElementById('btnImportSelected');
  btn.disabled = true;
  btn.textContent = 'Importando…';

  let imported = 0, errors = 0;
  for (let i = 0; i < _syncFiles.length; i++) {
    const cb = document.getElementById(`sc_${i}`);
    if (!cb?.checked) continue;
    const f = _syncFiles[i];
    try {
      const cat        = guessCatFromPath(f.drivePath ?? f.name);
      const fechaMatch = f.name.match(/^(\d{4}-\d{2}-\d{2})/);
      const fecha      = fechaMatch ? fechaMatch[1] : '';
      const cleanName  = f.name.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(/\.[^.]+$/, '');
      await saveDocument({
        name: cleanName || f.name, cat, fecha,
        medico: '', notas: 'Importado desde Google Drive',
        driveFileId: f.id,
        driveUrl: f.webViewLink ?? '',
        drivePath: f.drivePath ?? '',
      });
      imported++;
    } catch (err) {
      console.error('[Drive] import error:', f.name, err);
      errors++;
    }
  }

  closeSyncModal();
  if (imported > 0) showToast(`${imported} documento(s) importado(s) desde Drive ✓`);
  if (errors   > 0) showToast(`${errors} archivo(s) no se pudieron importar`);
}

function guessCatFromPath(path) {
  const p = (path ?? '').toLowerCase();
  if (p.includes('laboratorio'))               return 'lab';
  if (p.includes('fórmula') || p.includes('formula')) return 'formula';
  if (p.includes('historia'))                  return 'historia';
  if (p.includes('examen') || p.includes('resultado')) return 'examen';
  return 'orden';
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function updateDriveStatus(msg) {
  const el = document.getElementById('driveStatus');
  if (el) el.textContent = msg;
}

export function buildDriveOpenUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

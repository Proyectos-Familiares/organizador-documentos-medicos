// ═══════════════════════════════════════════════
//  DB.JS — Firestore CRUD + lógica del modal de subida
// ═══════════════════════════════════════════════

import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import {
  db, STATE,
  showToast, esc, guessCategory, CAT,
} from './config.js';

import { classifyWithAI } from './ai.js';
import { uploadToDrive }  from './drive.js';
import { openDetail }     from './detail.js';
import { closeDetail } from './ui.js';

// ─── Leer API key siempre en el momento que se necesita ──────────────────────
function getApiKey() {
  return localStorage.getItem('anthropic_api_key') ?? '';
}

// ─── REFERENCIA A LA COLECCIÓN DEL USUARIO ───────────────────────────────────
function userDocsRef(userId) {
  return collection(db, 'users', userId, 'documents');
}

function userDocRef(userId, docId) {
  return doc(db, 'users', userId, 'documents', docId);
}

// ═══════════════════════════════════════════════
//  SUSCRIPCIÓN EN TIEMPO REAL
// ═══════════════════════════════════════════════
export function subscribeToDocuments(userId, callback) {
  const q = query(userDocsRef(userId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => {
      console.error('[DB] onSnapshot error:', err);
      showToast('Error al cargar documentos. Revisa tu conexión.');
    }
  );
}

// ═══════════════════════════════════════════════
//  GUARDAR DOCUMENTO
// ═══════════════════════════════════════════════
export async function saveDocument(data) {
  if (!STATE.user) throw new Error('No hay sesión activa');
  const ref = await addDoc(userDocsRef(STATE.user.uid), {
    name:        data.name        ?? '',
    cat:         data.cat         ?? 'orden',
    fecha:       data.fecha       ?? '',
    medico:      data.medico      ?? '',
    notas:       data.notas       ?? '',
    driveFileId: data.driveFileId ?? '',
    driveUrl:    data.driveUrl    ?? '',
    drivePath:   data.drivePath   ?? '',
    results:     data.results     ?? null,
    createdAt:   serverTimestamp(),
    updatedAt:   serverTimestamp(),
  });
  return ref.id;
}

// ═══════════════════════════════════════════════
//  ACTUALIZAR DOCUMENTO
// ═══════════════════════════════════════════════
export async function updateDocument(docId, data) {
  if (!STATE.user) throw new Error('No hay sesión activa');
  await updateDoc(userDocRef(STATE.user.uid, docId), {
    name:      data.name   ?? '',
    cat:       data.cat    ?? 'orden',
    fecha:     data.fecha  ?? '',
    medico:    data.medico ?? '',
    notas:     data.notas  ?? '',
    updatedAt: serverTimestamp(),
  });
}

// ═══════════════════════════════════════════════
//  ELIMINAR DOCUMENTO
// ═══════════════════════════════════════════════
export async function deleteDocument(docId) {
  if (!STATE.user) throw new Error('No hay sesión activa');
  await deleteDoc(userDocRef(STATE.user.uid, docId));
}

// ═══════════════════════════════════════════════
//  ESTADO INTERNO DEL MODAL
// ═══════════════════════════════════════════════
let _pendingFile = null;
let _uploadStep  = 1;

// ═══════════════════════════════════════════════
//  INIT — todos los eventos de UI
// ═══════════════════════════════════════════════
export function initUpload() {
  // Abrir modal
  document.getElementById('btnOpenUpload').addEventListener('click', openUploadModal);

  // Elegir archivo / cámara desde zona principal
  document.getElementById('btnPickFile').addEventListener('click', () =>
    document.getElementById('fileInput').click()
  );
  document.getElementById('btnCamera').addEventListener('click', () =>
    document.getElementById('cameraInput').click()
  );

  // Inputs de archivo
  document.getElementById('fileInput').addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  });
  document.getElementById('cameraInput').addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  });

  // Botones dentro del modal paso 1
  document.getElementById('modalBtnFile').addEventListener('click', () =>
    document.getElementById('fileInput').click()
  );
  document.getElementById('modalBtnCamera').addEventListener('click', () =>
    document.getElementById('cameraInput').click()
  );

  // Cerrar modal
  document.getElementById('btnCloseUpload').addEventListener('click', closeUploadModal);
  document.getElementById('btnCancelUpload').addEventListener('click', closeUploadModal);
  document.getElementById('uploadModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('uploadModal')) closeUploadModal();
  });

  // Acción principal
  document.getElementById('btnUploadAction').addEventListener('click', uploadAction);

  // Drag & drop zona principal
  const dropZone = document.getElementById('dropZone');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  // Drag & drop modal
  const modalDrop = document.getElementById('modalDropArea');
  if (modalDrop) {
    modalDrop.addEventListener('dragover', (e) => { e.preventDefault(); modalDrop.classList.add('dragover'); });
    modalDrop.addEventListener('dragleave', () => modalDrop.classList.remove('dragover'));
    modalDrop.addEventListener('drop', (e) => {
      e.preventDefault();
      modalDrop.classList.remove('dragover');
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    });
  }

  // ── Settings ──
  document.getElementById('btnSettings').addEventListener('click', openSettingsModal);
  document.getElementById('btnCloseSettings').addEventListener('click', closeSettingsModal);
  document.getElementById('btnCloseSettings2').addEventListener('click', closeSettingsModal);
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('settingsModal')) closeSettingsModal();
  });
  document.getElementById('btnToggleKey').addEventListener('click', () => {
    const input = document.getElementById('inputApiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // ── Edit modal ──
  document.getElementById('btnCloseEdit').addEventListener('click', closeEditModal);
  document.getElementById('btnCloseEdit2').addEventListener('click', closeEditModal);
  document.getElementById('btnSaveEdit').addEventListener('click', saveEdit);
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editModal')) closeEditModal();
  });
}

// ═══════════════════════════════════════════════
//  ABRIR / CERRAR UPLOAD MODAL
// ═══════════════════════════════════════════════
export function openUploadModal() {
  resetUploadModal();
  document.getElementById('uploadModal').classList.add('open');
}

export function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('open');
  resetUploadModal();
}

function resetUploadModal() {
  _pendingFile = null;
  _uploadStep  = 1;

  document.getElementById('uploadStep1').style.display = '';
  document.getElementById('uploadStep2').style.display = 'none';
  document.getElementById('previewGrid').style.display = 'none';
  document.getElementById('previewGrid').innerHTML     = '';
  document.getElementById('processingArea').innerHTML  = '';
  document.getElementById('fileInput').value           = '';
  document.getElementById('cameraInput').value         = '';

  const btn = document.getElementById('btnUploadAction');
  btn.textContent = 'Continuar';
  btn.disabled    = false;

  document.getElementById('uploadProgressWrap').style.display = 'none';
  document.getElementById('progressFill').style.width         = '0%';
  document.getElementById('aiResultBox').style.display        = 'none';

  ['fName', 'fMedico', 'fNotas'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  document.getElementById('fCat').value   = 'orden';
  document.getElementById('fFecha').value = todayISO();
  document.getElementById('uploadModalTitle').textContent = 'Subir documento';
}

// ═══════════════════════════════════════════════
//  MANEJAR ARCHIVO
// ═══════════════════════════════════════════════
function handleFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showToast('El archivo supera los 10 MB. Elige uno más pequeño.');
    return;
  }

  // Aceptar cualquier imagen o PDF
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    showToast('Formato no soportado. Usa JPG, PNG, HEIC o PDF.');
    return;
  }

  _pendingFile = file;

  if (!document.getElementById('uploadModal').classList.contains('open')) {
    openUploadModal();
  }

  showPreview(file);
  startAIClassification(file);
}

function showPreview(file) {
  const grid = document.getElementById('previewGrid');
  grid.style.display = 'grid';

  if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    const thumb = document.createElement('div');
    thumb.className = 'preview-thumb';
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'preview';
    img.addEventListener('load', () => URL.revokeObjectURL(url));
    const label = document.createElement('div');
    label.className = 'preview-thumb-label';
    label.textContent = 'Vista previa';
    thumb.appendChild(img);
    thumb.appendChild(label);
    grid.innerHTML = '';
    grid.appendChild(thumb);
  } else {
    grid.innerHTML = `
      <div class="preview-thumb">
        <svg viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <div class="preview-thumb-label">PDF</div>
      </div>`;
  }
}

// ═══════════════════════════════════════════════
//  CLASIFICACIÓN CON IA
// ═══════════════════════════════════════════════
async function startAIClassification(file) {
  const area = document.getElementById('processingArea');
  area.innerHTML = `
    <div class="processing-bar">
      <div class="spinner"></div>
      <div class="processing-text">La IA está analizando el documento…</div>
    </div>`;

  // ── LEER LA KEY EN ESTE MOMENTO (no al importar el módulo) ──
  const apiKey = localStorage.getItem('anthropic_api_key') ?? '';

  try {
    let result;

    if (apiKey) {
      result = await classifyWithAI(file, apiKey);
    } else {
      // Sin API key — fallback por nombre de archivo
      // Si el nombre es un UUID (iOS/cámara) ponemos nombre genérico
      const rawName = file.name.replace(/\.[^.]+$/, '');
      const isUUID  = /^[0-9A-F-]{8,}$/i.test(rawName);
      result = {
        categoria: guessCategory(file.name),
        nombre:    isUUID ? 'Documento médico' : rawName,
        medico:    '',
        fecha:     '',
        notas:     '',
      };
    }

    area.innerHTML = '';
    fillForm(result, !!apiKey);
    goToStep2();

  } catch (err) {
    console.error('[DB] AI error:', err);
    area.innerHTML = '';

    // Fallback — nombre limpio aunque venga UUID
    const rawName = file.name.replace(/\.[^.]+$/, '');
    const isUUID  = /^[0-9A-F-]{8,}$/i.test(rawName);
    fillForm({
      categoria: guessCategory(file.name),
      nombre:    isUUID ? 'Documento médico' : rawName,
      medico:    '',
      fecha:     '',
      notas:     '',
    }, false, err.message);

    goToStep2();
  }
}

function fillForm(result, aiUsed, errorMsg) {
  // BUG FIX: nunca poner UUID como nombre — siempre usar el de la IA
  const rawName = (_pendingFile?.name ?? '').replace(/\.[^.]+$/, '');
  const isUUID  = /^[0-9A-F-]{8,}$/i.test(rawName);

  document.getElementById('fName').value   = result.nombre || (isUUID ? 'Documento médico' : rawName);
  document.getElementById('fMedico').value = result.medico ?? '';
  document.getElementById('fNotas').value  = result.notas  ?? '';

  if (result.fecha && /^\d{4}-\d{2}-\d{2}$/.test(result.fecha)) {
    document.getElementById('fFecha').value = result.fecha;
  }
  if (CAT[result.categoria]) {
    document.getElementById('fCat').value = result.categoria;
  }

  const box = document.getElementById('aiResultBox');
  const currentKey = localStorage.getItem('anthropic_api_key') ?? '';

  if (aiUsed) {
    box.className = 'info-box success';
    box.innerHTML = `✓ Clasificado por IA como <strong>${CAT[result.categoria]?.label ?? result.categoria}</strong>. Revisa y ajusta si es necesario.`;
  } else if (!currentKey) {
    box.className = 'info-box warn';
    box.innerHTML = `⚙️ No hay API Key configurada. Ve a <strong>Configuración (⚙️)</strong> en la barra superior para agregar tu clave de Anthropic y clasificar automáticamente.`;
  } else {
    box.className = 'info-box warn';
    box.innerHTML = `⚠️ No se pudo conectar con la IA${errorMsg ? ': ' + esc(errorMsg) : ''}. Por favor revisa y completa los campos manualmente.`;
  }
  box.style.display = '';
}

function goToStep2() {
  document.getElementById('uploadStep1').style.display    = 'none';
  document.getElementById('uploadStep2').style.display    = '';
  document.getElementById('btnUploadAction').textContent  = 'Guardar documento';
  document.getElementById('uploadModalTitle').textContent = 'Confirmar datos';
  _uploadStep = 2;
}

// ═══════════════════════════════════════════════
//  GUARDAR — acción botón principal
// ═══════════════════════════════════════════════
async function uploadAction() {
  if (_uploadStep === 1) {
    document.getElementById('fileInput').click();
    return;
  }

  const name = document.getElementById('fName').value.trim();
  if (!name) {
    showToast('El nombre del documento es obligatorio');
    document.getElementById('fName').focus();
    return;
  }

  const btn = document.getElementById('btnUploadAction');
  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    const cat    = document.getElementById('fCat').value;
    const fecha  = document.getElementById('fFecha').value;
    const medico = document.getElementById('fMedico').value.trim();
    const notas  = document.getElementById('fNotas').value.trim();

    let driveFileId = '', driveUrl = '', drivePath = '';

    if (_pendingFile && STATE.driveReady) {
      document.getElementById('uploadProgressWrap').style.display = '';
      setProgress(10, 'Subiendo a Google Drive…');
      try {
        const dr = await uploadToDrive(
          _pendingFile,
          { name, cat, fecha },
          (pct) => setProgress(10 + pct * 0.8, `Subiendo a Google Drive… ${pct}%`)
        );
        driveFileId = dr.fileId;
        driveUrl    = dr.webViewLink;
        drivePath   = dr.path;
        setProgress(90, 'Guardando metadatos…');
      } catch (drErr) {
        console.warn('[DB] Drive error:', drErr);
        showToast('No se pudo subir a Drive. Documento guardado sin archivo.');
      }
    } else if (_pendingFile && !STATE.driveReady) {
      showToast('Drive no conectado. Documento guardado sin archivo adjunto.');
    }

    await saveDocument({ name, cat, fecha, medico, notas, driveFileId, driveUrl, drivePath });
    setProgress(100, '¡Guardado!');
    await sleep(300);
    closeUploadModal();
    showToast('Documento guardado correctamente ✓');

  } catch (err) {
    console.error('[DB] uploadAction error:', err);
    showToast('Error al guardar: ' + err.message);
    btn.disabled    = false;
    btn.textContent = 'Guardar documento';
  }
}

function setProgress(pct, label) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = label;
}

// ═══════════════════════════════════════════════
//  SETTINGS MODAL
// ═══════════════════════════════════════════════
function openSettingsModal() {
  const stored = localStorage.getItem('anthropic_api_key') ?? '';
  document.getElementById('inputApiKey').value = stored;

  // Mostrar usuario en settings
  const sessionEl = document.getElementById('sessionUser');
  if (sessionEl && STATE.user) {
    sessionEl.textContent = `${STATE.user.displayName ?? ''} · ${STATE.user.email ?? ''}`;
  }

  // Estado de Drive
  const driveEl = document.getElementById('driveStatus');
  if (driveEl) {
    driveEl.textContent = STATE.driveReady
      ? 'Conectado — los archivos se guardan en tu Drive automáticamente.'
      : 'No conectado. Cierra sesión y vuelve a entrar para autorizar.';
  }

  document.getElementById('settingsModal').classList.add('open');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('open');
}

function saveSettings() {
  const key = document.getElementById('inputApiKey').value.trim();
  if (key && !key.startsWith('sk-ant-')) {
    showToast('La API key debe empezar con sk-ant-');
    return;
  }
  localStorage.setItem('anthropic_api_key', key);
  STATE.apiKey = key;
  closeSettingsModal();
  showToast(key ? 'API Key guardada ✓' : 'API Key eliminada');
}

// ═══════════════════════════════════════════════
//  EDIT MODAL
// ═══════════════════════════════════════════════
export function openEditModal(docId) {
  const d = STATE.docs.find((x) => x.id === docId);
  if (!d) return;

  document.getElementById('editDocId').value = docId;
  document.getElementById('eName').value     = d.name   ?? '';
  document.getElementById('eCat').value      = d.cat    ?? 'orden';
  document.getElementById('eMedico').value   = d.medico ?? '';
  document.getElementById('eFecha').value    = d.fecha  ?? '';
  document.getElementById('eNotas').value    = d.notas  ?? '';

  document.getElementById('editModal').classList.add('open');
}

export function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

async function saveEdit() {
  const docId = document.getElementById('editDocId').value;
  const name  = document.getElementById('eName').value.trim();
  if (!name) {
    showToast('El nombre es obligatorio');
    document.getElementById('eName').focus();
    return;
  }

  const btn = document.getElementById('btnSaveEdit');
  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    await updateDocument(docId, {
      name,
      cat:    document.getElementById('eCat').value,
      medico: document.getElementById('eMedico').value.trim(),
      fecha:  document.getElementById('eFecha').value,
      notas:  document.getElementById('eNotas').value.trim(),
    });
    closeEditModal();
    showToast('Cambios guardados ✓');
    if (STATE.currentDetail === docId) openDetail(docId);
  } catch (err) {
    console.error('[DB] saveEdit error:', err);
    showToast('Error al guardar: ' + err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Guardar cambios';
  }
}

// ═══════════════════════════════════════════════
//  ELIMINAR
// ═══════════════════════════════════════════════
export async function handleDelete(docId) {
  if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
  try {
    await deleteDocument(docId);
    showToast('Documento eliminado');
    if (STATE.currentDetail === docId) closeDetail();
  } catch (err) {
    console.error('[DB] delete error:', err);
    showToast('Error al eliminar: ' + err.message);
  }
}

// ═══════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

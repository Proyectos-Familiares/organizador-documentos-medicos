// ═══════════════════════════════════════════════
//  CONFIG.JS — Firebase init + constantes globales
// ═══════════════════════════════════════════════

import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }                               from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage }                            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

import { initAuth }   from './auth.js';
import { initUI }     from './ui.js';
import { initUpload } from './db.js';
import { initDrive }  from './drive.js';

// ─── FIREBASE CONFIG ─────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyBkeyQ2PgMTV2Nj49dy-1yhPx8J7ou1sus',
  authDomain:        'organizador-documentos-medicos.firebaseapp.com',
  projectId:         'organizador-documentos-medicos',
  storageBucket:     'organizador-documentos-medicos.firebasestorage.app',
  messagingSenderId: '819780849056',
  appId:             '1:819780849056:web:3bbacce2350b86b9ad28c5',
};

// ─── FIREBASE INSTANCES ───────────────────────────────────────────────────────
const firebaseApp = initializeApp(firebaseConfig);
export const auth    = getAuth(firebaseApp);
export const db      = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// ─── GOOGLE OAUTH / DRIVE ────────────────────────────────────────────────────
export const GOOGLE_CLIENT_ID = '141585309311-j0uigbgjpclll5631edn6a5mqjf3mnjt.apps.googleusercontent.com';
export const DRIVE_SCOPES     = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_ROOT_NAME  = 'Mi Carpeta de Salud';

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
export const CAT = {
  orden: {
    label:       'Orden médica',
    driveName:   'Órdenes médicas',
    tagBg:       '#9FE1CB',
    tagText:     '#085041',
    iconBg:      '#E1F5EE',
    iconStroke:  '#0F6E56',
  },
  lab: {
    label:       'Laboratorio',
    driveName:   'Laboratorio',
    tagBg:       '#B5D4F4',
    tagText:     '#0C447C',
    iconBg:      '#E6F1FB',
    iconStroke:  '#185FA5',
  },
  formula: {
    label:       'Fórmula médica',
    driveName:   'Fórmulas médicas',
    tagBg:       '#FAC775',
    tagText:     '#633806',
    iconBg:      '#FAEEDA',
    iconStroke:  '#854F0B',
  },
  historia: {
    label:       'Historia clínica',
    driveName:   'Historias clínicas',
    tagBg:       '#CECBF6',
    tagText:     '#26215C',
    iconBg:      '#EEEDFE',
    iconStroke:  '#534AB7',
  },
  examen: {
    label:       'Resultado de examen',
    driveName:   'Resultados de exámenes',
    tagBg:       '#F5C4B3',
    tagText:     '#712B13',
    iconBg:      '#FAECE7',
    iconStroke:  '#993C1D',
  },
};

// ─── ICONOS SVG POR CATEGORÍA ─────────────────────────────────────────────────
export const CAT_ICONS = {
  orden:
    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>' +
    '<polyline points="14 2 14 8 20 8"/>' +
    '<line x1="16" y1="13" x2="8" y2="13"/>' +
    '<line x1="16" y1="17" x2="8" y2="17"/>',

  lab:
    '<path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11l-4 4h14l-4-4V3"/>',

  formula:
    '<path d="M8 21h12a2 2 0 002-2v-2H10v2a2 2 0 01-2 2z"/>' +
    '<path d="M8 21a2 2 0 01-2-2v-2m0 0V5a2 2 0 012-2h12a2 2 0 012 2v2"/>' +
    '<path d="M12 11v6M9 14h6"/>',

  historia:
    '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>' +
    '<path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>',

  examen:
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<circle cx="8.5" cy="8.5" r="1.5"/>' +
    '<polyline points="21 15 16 10 5 21"/>',
};

// ─── MESES EN ESPAÑOL ─────────────────────────────────────────────────────────
export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export const MESES_CORTOS = [
  'ene','feb','mar','abr','may','jun',
  'jul','ago','sep','oct','nov','dic',
];

// ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
export const STATE = {
  user:          null,   // firebase user
  docs:          [],     // array de documentos cargados
  activeCat:     'all',  // filtro activo
  currentDetail: null,   // id del documento abierto en detalle
  driveReady:    false,  // si el cliente de Drive está autenticado
  driveRootId:   null,   // id de la carpeta raíz en Drive
  apiKey:        '',     // Anthropic API key (desde localStorage)
};

// ─── HELPERS GLOBALES ─────────────────────────────────────────────────────────

/** Escapa HTML para prevenir XSS */
export function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Genera un ID único */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Formatea fecha YYYY-MM-DD → "20 mar 2025" */
export function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

/** Retorna el año de una fecha YYYY-MM-DD */
export function getYear(s) {
  if (!s) return 'Sin fecha';
  return s.split('-')[0];
}

/** Retorna nombre del mes de una fecha YYYY-MM-DD */
export function getMonthName(s) {
  if (!s) return '';
  const m = parseInt(s.split('-')[1], 10);
  return MESES[m - 1] || '';
}

/** Construye el SVG de icono de categoría */
export function catIconSvg(cat, size = 20, strokeColor) {
  const cfg  = CAT[cat] ?? CAT.orden;
  const stroke = strokeColor ?? cfg.iconStroke;
  return (
    `<svg style="width:${size}px;height:${size}px;stroke:${stroke};fill:none;` +
    `stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24">` +
    (CAT_ICONS[cat] ?? CAT_ICONS.orden) +
    `</svg>`
  );
}

/** Convierte File a base64 data URL */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Error leyendo el archivo'));
    reader.readAsDataURL(file);
  });
}

/** Muestra un toast de notificación */
export function showToast(msg, duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity    = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 320);
  }, duration);
}

/** Adivina la categoría por nombre de archivo (fallback sin IA) */
export function guessCategory(filename) {
  const n = filename.toLowerCase();
  if (/lab|hemo|sangu|orina|glucos|colest|perfil|tiroid|creatinin/.test(n)) return 'lab';
  if (/formula|receta|medic|farmac|prescri/.test(n))                         return 'formula';
  if (/historia|clinica|epicrisis|anamnesis/.test(n))                        return 'historia';
  if (/rx|radio|eco|scan|tac|mri|resonan|result|examen|imagen/.test(n))      return 'examen';
  return 'orden';
}

/** Carga y devuelve el API key de Anthropic desde localStorage */
export function getApiKey() {
  return localStorage.getItem('anthropic_api_key') ?? '';
}

/** Guarda el API key de Anthropic en localStorage */
export function saveApiKey(key) {
  localStorage.setItem('anthropic_api_key', key.trim());
  STATE.apiKey = key.trim();
}

// ─── PUNTO DE ENTRADA ─────────────────────────────────────────────────────────
export function initApp() {
  // Cargar API key guardada
  STATE.apiKey = getApiKey();

  // Inicializar módulos en orden
  initAuth();    // maneja login/logout y arranca el resto
  initUI();      // eventos de UI (filtros, búsqueda, modales)
  initUpload();  // eventos del modal de subida
  initDrive();   // carga el cliente de Google Drive API
}

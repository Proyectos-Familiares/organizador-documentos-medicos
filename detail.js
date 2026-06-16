// ═══════════════════════════════════════════════
//  DETAIL.JS — Vista de detalle de un documento
// ═══════════════════════════════════════════════

import {
  STATE, CAT, CAT_ICONS,
  esc, fmtDate, catIconSvg, showToast,
} from './config.js';

import { handleDelete, openEditModal } from './db.js';
import { showDetailView, showListView } from './ui.js';
import { buildDriveOpenUrl }           from './drive.js';

// ═══════════════════════════════════════════════
//  ABRIR DETALLE
// ═══════════════════════════════════════════════
export function openDetail(docId) {
  const doc = STATE.docs.find((d) => d.id === docId);
  if (!doc) {
    showToast('Documento no encontrado');
    return;
  }

  STATE.currentDetail = docId;

  const html = buildDetailHTML(doc);
  document.getElementById('detailContent').innerHTML = html;

  // Attach events
  attachDetailEvents(doc);

  showDetailView();
}

// ═══════════════════════════════════════════════
//  CONSTRUIR HTML DEL DETALLE
// ═══════════════════════════════════════════════
function buildDetailHTML(doc) {
  const cfg = CAT[doc.cat] ?? CAT.orden;

  return `
    ${buildHeader(doc, cfg)}
    ${buildMetaGrid(doc, cfg)}
    ${buildDriveCard(doc)}
    ${buildPreviewImage(doc)}
    ${buildLabResults(doc)}
    ${buildNotes(doc)}
    ${buildActions(doc)}
  `;
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function buildHeader(doc, cfg) {
  return `
    <div class="detail-header">
      <div class="detail-icon" style="background:${cfg.iconBg}">
        ${catIconSvg(doc.cat, 28, cfg.iconStroke)}
      </div>
      <div>
        <div class="detail-title">${esc(doc.name)}</div>
        <div class="detail-sub">
          ${esc(doc.medico || 'Sin médico')} · ${fmtDate(doc.fecha)}
        </div>
        <span class="detail-tag" style="background:${cfg.tagBg};color:${cfg.tagText}">
          ${cfg.label}
        </span>
      </div>
    </div>`;
}

// ─── META GRID ────────────────────────────────────────────────────────────────
function buildMetaGrid(doc, cfg) {
  // Estado de almacenamiento
  const storageStatus = doc.driveFileId
    ? `<span style="color:var(--green-400)">☁ Guardado en Drive</span>`
    : `<span style="color:var(--text3)">Solo en Firestore</span>`;

  return `
    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Médico / Institución</div>
        <div class="meta-val">${esc(doc.medico || '—')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Fecha</div>
        <div class="meta-val">${fmtDate(doc.fecha)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Categoría</div>
        <div class="meta-val">${cfg.label}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Archivo</div>
        <div class="meta-val">${storageStatus}</div>
      </div>
    </div>`;
}

// ─── TARJETA DE DRIVE ─────────────────────────────────────────────────────────
function buildDriveCard(doc) {
  if (!doc.driveFileId && !doc.driveUrl) return '';

  const url  = doc.driveUrl || buildDriveOpenUrl(doc.driveFileId);
  const path = doc.drivePath || 'Mi Carpeta de Salud';

  // Truncar ruta larga para que quepa en pantalla
  const shortPath = path.length > 55
    ? '…' + path.slice(path.length - 52)
    : path;

  return `
    <div class="section-h">Archivo en Google Drive</div>
    <a
      href="${esc(url)}"
      target="_blank"
      rel="noopener noreferrer"
      class="drive-link-card"
      id="driveLinkCard">
      <svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
        <path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.5 1.2L3.5 31.5h27.1z" fill="#00ac47"/>
        <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H60L73.55 76.8z" fill="#ea4335"/>
        <path d="M43.65 25L57.4 1.2C56 .4 54.45 0 52.9 0H34.4c-1.55 0-3.1.4-4.5 1.2z" fill="#00832d"/>
        <path d="M60 53H27.1L13.35 76.8c1.4.8 2.95 1.2 4.5 1.2h52.6c1.55 0 3.1-.4 4.5-1.2z" fill="#2684fc"/>
        <path d="M59.8 32.5L46.05 8.7c-1.35-.8-2.9-1.2-4.45-1.2s-3.1.4-4.5 1.2L23.35 32.5 37.1 56.2h27.1z" fill="#ffba00"/>
      </svg>
      <div class="drive-link-info">
        <div class="drive-link-title">Abrir archivo en Google Drive</div>
        <div class="drive-link-path" title="${esc(path)}">📁 ${esc(shortPath)}</div>
      </div>
      <svg class="drive-link-arrow" viewBox="0 0 24 24">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>`;
}

// ─── IMAGEN DE VISTA PREVIA ───────────────────────────────────────────────────
function buildPreviewImage(doc) {
  // Solo mostrar si hay imagen directa (raro, ya que usamos Drive)
  if (!doc.imgUrl) return '';

  return `
    <div class="section-h">Vista previa</div>
    <img
      src="${esc(doc.imgUrl)}"
      class="preview-img"
      alt="${esc(doc.name)}"
      loading="lazy">`;
}

// ─── RESULTADOS DE LABORATORIO ────────────────────────────────────────────────
function buildLabResults(doc) {
  if (!doc.results || !Array.isArray(doc.results) || doc.results.length === 0) {
    return '';
  }

  const rows = doc.results.map((r) => buildResultRow(r)).join('');

  return `
    <div class="section-h">Resultados</div>
    <div class="result-table">
      <div class="result-head">
        <div>Parámetro</div>
        <div>Valor</div>
        <div>Rango ref.</div>
        <div>Estado</div>
      </div>
      ${rows}
    </div>`;
}

function buildResultRow(r) {
  const range = (r.max ?? 0) - (r.min ?? 0);
  const pct   = range > 0
    ? Math.min(100, Math.max(0, Math.round(((r.val - r.min) / range) * 100)))
    : 50;

  let status  = 'Normal';
  let statBg  = '#9FE1CB';
  let statTx  = '#085041';
  let barColor = '#1D9E75';

  if (r.val > r.max) {
    status   = 'Alto';
    statBg   = '#FAC775';
    statTx   = '#633806';
    barColor = '#BA7517';
  } else if (r.val < r.min) {
    status   = 'Bajo';
    statBg   = '#B5D4F4';
    statTx   = '#0C447C';
    barColor = '#378ADD';
  }

  return `
    <div class="result-item">
      <div class="rname">
        ${esc(r.name)}
        <small>${esc(r.abbr ?? '')}</small>
      </div>
      <div>
        <span style="font-size:14px;font-weight:500;">${r.val}</span>
        <span style="font-size:11px;color:var(--text3);margin-left:2px;">${esc(r.unit ?? '')}</span>
      </div>
      <div>
        <div class="rbar-track">
          <div class="rbar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="rbar-range">
          <span>${r.min ?? ''}</span>
          <span>${r.max ?? ''}</span>
        </div>
      </div>
      <div>
        <span class="rstatus" style="background:${statBg};color:${statTx}">
          ${status}
        </span>
      </div>
    </div>`;
}

// ─── NOTAS ────────────────────────────────────────────────────────────────────
function buildNotes(doc) {
  if (!doc.notas) return '';

  return `
    <div class="section-h">Notas</div>
    <div class="notes-box">${esc(doc.notas)}</div>`;
}

// ─── ACCIONES ────────────────────────────────────────────────────────────────
function buildActions(doc) {
  const driveBtn = (doc.driveFileId || doc.driveUrl)
    ? `<a
         href="${esc(doc.driveUrl || buildDriveOpenUrl(doc.driveFileId))}"
         target="_blank"
         rel="noopener noreferrer"
         class="btn btn-sm"
         id="btnOpenDrive">
         <svg viewBox="0 0 24 24">
           <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
           <polyline points="15 3 21 3 21 9"/>
           <line x1="10" y1="14" x2="21" y2="3"/>
         </svg>
         Abrir en Drive
       </a>`
    : '';

  return `
    <div class="section-h">Acciones</div>
    <div class="action-row">
      <button class="btn btn-sm" id="btnDetailEdit">
        <svg viewBox="0 0 24 24">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Editar
      </button>
      ${driveBtn}
      <button class="btn btn-sm" id="btnShareDoc">
        <svg viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Compartir
      </button>
      <button class="btn btn-sm btn-danger" id="btnDetailDelete">
        <svg viewBox="0 0 24 24">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
        Eliminar
      </button>
    </div>`;
}

// ═══════════════════════════════════════════════
//  EVENTOS DEL DETALLE
// ═══════════════════════════════════════════════
function attachDetailEvents(doc) {
  // Editar
  document.getElementById('btnDetailEdit')?.addEventListener('click', () => {
    openEditModal(doc.id);
  });

  // Eliminar
  document.getElementById('btnDetailDelete')?.addEventListener('click', async () => {
    await handleDelete(doc.id);
    // handleDelete llama closeDetail si currentDetail === doc.id
  });

  // Compartir (Web Share API si disponible, si no copiar link de Drive)
  document.getElementById('btnShareDoc')?.addEventListener('click', () => {
    shareDoc(doc);
  });
}

// ═══════════════════════════════════════════════
//  COMPARTIR
// ═══════════════════════════════════════════════
async function shareDoc(doc) {
  const driveUrl = doc.driveUrl || (doc.driveFileId ? buildDriveOpenUrl(doc.driveFileId) : null);

  // Intentar Web Share API (móvil)
  if (navigator.share && driveUrl) {
    try {
      await navigator.share({
        title: doc.name,
        text:  `Documento médico: ${doc.name} — ${fmtDate(doc.fecha)}`,
        url:   driveUrl,
      });
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[Detail] share error:', err);
      }
      return; // usuario canceló
    }
  }

  // Fallback: copiar link al portapapeles
  if (driveUrl) {
    try {
      await navigator.clipboard.writeText(driveUrl);
      showToast('Link de Drive copiado al portapapeles ✓');
    } catch (_) {
      showToast('No se pudo copiar el link');
    }
    return;
  }

  // Sin archivo en Drive
  showToast('Este documento no tiene archivo en Drive para compartir');
}

// ═══════════════════════════════════════════════
//  CERRAR DETALLE (exportado para btnBack)
// ═══════════════════════════════════════════════
export function closeDetail() {
  showListView();
}

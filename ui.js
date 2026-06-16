// ═══════════════════════════════════════════════
//  UI.JS — Lista, stats, filtros, búsqueda, navegación
// ═══════════════════════════════════════════════

import {
  STATE, CAT, CAT_ICONS,
  esc, fmtDate, getYear, catIconSvg, showToast,
} from './config.js';

import { handleDelete, openEditModal } from './db.js';
import { openDetail }                  from './detail.js';

// ═══════════════════════════════════════════════
//  INIT — eventos de UI
// ═══════════════════════════════════════════════
export function initUI() {
  // Búsqueda
  document.getElementById('searchInput').addEventListener('input', renderList);

  // Ordenar
  document.getElementById('sortSelect').addEventListener('change', renderList);

  // Botón volver en detalle
  document.getElementById('btnBack').addEventListener('click', closeDetail);
}

// ═══════════════════════════════════════════════
//  RENDER PRINCIPAL
// ═══════════════════════════════════════════════
export function renderList() {
  renderStats();
  renderFilters();
  renderDocList();
}

// ═══════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════
function renderStats() {
  const docs    = STATE.docs;
  const year    = new Date().getFullYear().toString();
  const thisYr  = docs.filter((d) => d.fecha?.startsWith(year)).length;
  const cats    = new Set(docs.map((d) => d.cat)).size;
  const recent  = docs.filter((d) => {
    if (!d.fecha) return false;
    const diff = (Date.now() - new Date(d.fecha + 'T12:00:00').getTime()) / 86400000;
    return diff >= 0 && diff <= 30;
  }).length;

  const items = [
    { val: docs.length, label: 'Documentos',  color: '#1D9E75' },
    { val: thisYr,      label: 'Este año',     color: '#378ADD' },
    { val: cats,        label: 'Categorías',   color: '#7F77DD' },
    { val: recent,      label: 'Último mes',   color: '#D85A30' },
  ];

  document.getElementById('statsRow').innerHTML = items
    .map(({ val, label, color }) => `
      <div class="stat">
        <div class="stat-val" style="color:${color}">${val}</div>
        <div class="stat-label">${label}</div>
      </div>`)
    .join('');

  // Actualizar subtítulo topbar
  const total = docs.length;
  document.getElementById('topbarCount').textContent =
    `${total} documento${total === 1 ? '' : 's'}`;
}

// ═══════════════════════════════════════════════
//  FILTROS DE CATEGORÍA
// ═══════════════════════════════════════════════
function renderFilters() {
  const docs = STATE.docs;

  // Contar por categoría
  const counts = {};
  for (const cat of Object.keys(CAT)) {
    counts[cat] = docs.filter((d) => d.cat === cat).length;
  }

  const pills = [
    { key: 'all', label: 'Todos', count: docs.length },
    ...Object.entries(CAT).map(([k, v]) => ({
      key:   k,
      label: v.label,
      count: counts[k] ?? 0,
    })),
  ];

  document.getElementById('filtersRow').innerHTML = pills
    .map(({ key, label, count }) => `
      <button
        class="filter-pill${STATE.activeCat === key ? ' active' : ''}"
        data-cat="${key}">
        ${label}
        <span class="filter-count">${count}</span>
      </button>`)
    .join('');

  // Eventos en los pills
  document.getElementById('filtersRow')
    .querySelectorAll('.filter-pill')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        STATE.activeCat = btn.dataset.cat;
        renderFilters();
        renderDocList();
      });
    });
}

// ═══════════════════════════════════════════════
//  LISTA DE DOCUMENTOS
// ═══════════════════════════════════════════════
function renderDocList() {
  const container = document.getElementById('docList');
  const filtered  = getFilteredDocs();

  if (!filtered.length) {
    container.innerHTML = buildEmpty();
    return;
  }

  // Agrupar por año
  const byYear = groupByYear(filtered);
  let html = '';

  for (const [year, yearDocs] of Object.entries(byYear)) {
    html += `<div class="year-label">${year}</div>`;
    html += yearDocs.map((doc) => buildDocRow(doc)).join('');
  }

  container.innerHTML = html;

  // Attach events
  container.querySelectorAll('.doc-row').forEach((row) => {
    row.addEventListener('click', () => openDetail(row.dataset.id));
  });

  container.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(btn.dataset.id);
    });
  });

  container.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete(btn.dataset.id);
    });
  });
}

// ─── BUILD DOC ROW ────────────────────────────────────────────────────────────
function buildDocRow(doc) {
  const cfg     = CAT[doc.cat] ?? CAT.orden;
  const driveBadge = doc.driveFileId
    ? `<span class="drive-badge">
         <svg style="width:10px;height:8px;fill:none;" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
           <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
           <path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.5 1.2L3.5 31.5h27.1z" fill="#00ac47"/>
           <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H60L73.55 76.8z" fill="#ea4335"/>
           <path d="M43.65 25L57.4 1.2C56 .4 54.45 0 52.9 0H34.4c-1.55 0-3.1.4-4.5 1.2z" fill="#00832d"/>
           <path d="M60 53H27.1L13.35 76.8c1.4.8 2.95 1.2 4.5 1.2h52.6c1.55 0 3.1-.4 4.5-1.2z" fill="#2684fc"/>
           <path d="M59.8 32.5L46.05 8.7c-1.35-.8-2.9-1.2-4.45-1.2s-3.1.4-4.5 1.2L23.35 32.5 37.1 56.2h27.1z" fill="#ffba00"/>
         </svg>
         Drive
       </span>`
    : '';

  const metaParts = [
    doc.medico  ? esc(doc.medico)       : 'Sin médico',
    doc.fecha   ? fmtDate(doc.fecha)    : '',
    doc.notas   ? esc(doc.notas.slice(0, 40)) : '',
  ].filter(Boolean);

  return `
    <div class="doc-row" data-id="${esc(doc.id)}">
      <div class="doc-row-icon" style="background:${cfg.iconBg}">
        ${catIconSvg(doc.cat, 20, cfg.iconStroke)}
      </div>
      <div class="doc-row-info">
        <div class="doc-row-name">
          ${esc(doc.name)}${driveBadge}
        </div>
        <div class="doc-row-meta">${metaParts.join(' · ')}</div>
      </div>
      <span class="doc-row-tag" style="background:${cfg.tagBg};color:${cfg.tagText}">
        ${cfg.label}
      </span>
      <div class="doc-row-actions">
        <button class="btn btn-icon btn-sm btn-edit" data-id="${esc(doc.id)}" title="Editar">
          <svg viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn btn-icon btn-sm btn-danger btn-delete" data-id="${esc(doc.id)}" title="Eliminar">
          <svg viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>`;
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
function buildEmpty() {
  const q = document.getElementById('searchInput').value.trim();

  if (STATE.docs.length === 0) {
    return `
      <div class="empty">
        <svg viewBox="0 0 24 24">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        <p>Aún no hay documentos.<br>¡Sube el primero!</p>
      </div>`;
  }

  if (q) {
    return `
      <div class="empty">
        <svg viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <p>No se encontraron resultados para <strong>"${esc(q)}"</strong></p>
      </div>`;
  }

  return `
    <div class="empty">
      <svg viewBox="0 0 24 24">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
      </svg>
      <p>No hay documentos en esta categoría.</p>
    </div>`;
}

// ═══════════════════════════════════════════════
//  FILTRADO Y ORDENAMIENTO
// ═══════════════════════════════════════════════
function getFilteredDocs() {
  const q    = document.getElementById('searchInput').value.toLowerCase().trim();
  const sort = document.getElementById('sortSelect').value;

  let list = STATE.docs.filter((d) => {
    // Filtro de categoría
    if (STATE.activeCat !== 'all' && d.cat !== STATE.activeCat) return false;

    // Búsqueda full-text
    if (!q) return true;

    const haystack = [
      d.name,
      d.medico,
      d.fecha,
      d.notas,
      d.cat,
      CAT[d.cat]?.label,
      d.drivePath,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });

  // Ordenar
  list = sortDocs(list, sort);

  return list;
}

function sortDocs(list, sort) {
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'date-asc':
        return (a.fecha ?? '').localeCompare(b.fecha ?? '');
      case 'name':
        return (a.name ?? '').localeCompare(b.name ?? '', 'es');
      case 'cat':
        return (a.cat ?? '').localeCompare(b.cat ?? '');
      case 'date-desc':
      default:
        return (b.fecha ?? '').localeCompare(a.fecha ?? '');
    }
  });
}

// ═══════════════════════════════════════════════
//  AGRUPAR POR AÑO
// ═══════════════════════════════════════════════
function groupByYear(docs) {
  const grouped = {};

  for (const doc of docs) {
    const year = getYear(doc.fecha);
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(doc);
  }

  // Ordenar años descendente
  const sorted = Object.keys(grouped).sort((a, b) => {
    if (a === 'Sin fecha') return 1;
    if (b === 'Sin fecha') return -1;
    return b.localeCompare(a);
  });

  const result = {};
  for (const y of sorted) result[y] = grouped[y];
  return result;
}

// ═══════════════════════════════════════════════
//  NAVEGACIÓN LISTA ↔ DETALLE
// ═══════════════════════════════════════════════
export function showListView() {
  document.getElementById('listView').style.display   = '';
  document.getElementById('detailView').classList.remove('open');
  STATE.currentDetail = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function showDetailView() {
  document.getElementById('listView').style.display = 'none';
  document.getElementById('detailView').classList.add('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function closeDetail() {
  showListView();
}

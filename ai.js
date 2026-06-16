// ═══════════════════════════════════════════════
//  AI.JS — Clasificación con Anthropic API + visión
// ═══════════════════════════════════════════════

import { fileToBase64, guessCategory } from './config.js';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const MODEL          = 'claude-sonnet-4-6';
const MAX_TOKENS     = 400;

// ─── PROMPT PARA IMÁGENES ─────────────────────────────────────────────────────
const PROMPT_IMAGE = `Eres un asistente especializado en documentos médicos colombianos.
Analiza esta imagen y extrae la información del documento médico que aparece.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código, sin explicaciones.
El JSON debe tener exactamente estas claves:

{
  "categoria": "orden" | "lab" | "formula" | "historia" | "examen",
  "nombre": "nombre descriptivo del documento (máximo 60 caracteres)",
  "medico": "nombre completo del médico o institución, cadena vacía si no se ve",
  "fecha": "fecha en formato YYYY-MM-DD si aparece en el documento, cadena vacía si no se ve",
  "notas": "observación clínica breve relevante si la hay, cadena vacía si no hay"
}

Guía de categorías:
- "orden": órdenes de consulta, remisiones, autorizaciones
- "lab": hemograma, uroanálisis, perfil lipídico, cualquier resultado de laboratorio
- "formula": fórmulas médicas, recetas, prescripciones de medicamentos
- "historia": historia clínica, epicrisis, resumen de hospitalización
- "examen": radiografías, ecografías, TAC, resonancias, resultados de imágenes diagnósticas`;

// ─── PROMPT PARA PDFs / SOLO NOMBRE ──────────────────────────────────────────
const PROMPT_FILENAME = (filename) =>
  `Eres un asistente especializado en documentos médicos colombianos.
El archivo se llama: "${filename}"

Basándote únicamente en el nombre del archivo, infiere la categoría más probable.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional:
{
  "categoria": "orden" | "lab" | "formula" | "historia" | "examen",
  "nombre": "nombre descriptivo limpio (máximo 60 caracteres, sin extensión)",
  "medico": "",
  "fecha": "",
  "notas": ""
}`;

// ═══════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════

/**
 * Clasifica un documento médico usando la API de Anthropic.
 *
 * @param {File}   file   - archivo (imagen o PDF)
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<{categoria, nombre, medico, fecha, notas}>}
 */
export async function classifyWithAI(file, apiKey) {
  if (!apiKey) throw new Error('API key requerida');

  const isImage = file.type.startsWith('image/');

  // Intentar con visión si es imagen, si no usar solo el nombre
  if (isImage) {
    return await classifyImage(file, apiKey);
  } else {
    return await classifyByFilename(file.name, apiKey);
  }
}

// ─── CLASIFICAR IMAGEN ────────────────────────────────────────────────────────
async function classifyImage(file, apiKey) {
  // Comprimir imagen si es muy grande para no gastar tokens
  const b64Data = await prepareImage(file);
  const mediaType = normalizeMediaType(file.type);

  const body = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          {
            type:   'image',
            source: {
              type:       'base64',
              media_type: mediaType,
              data:       b64Data,
            },
          },
          {
            type: 'text',
            text: PROMPT_IMAGE,
          },
        ],
      },
    ],
  };

  const result = await callAPI(body, apiKey);
  return parseResult(result);
}

// ─── CLASIFICAR POR NOMBRE ────────────────────────────────────────────────────
async function classifyByFilename(filename, apiKey) {
  const body = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role:    'user',
        content: PROMPT_FILENAME(filename),
      },
    ],
  };

  const result = await callAPI(body, apiKey);
  return parseResult(result);
}

// ═══════════════════════════════════════════════
//  LLAMADA A LA API
// ═══════════════════════════════════════════════
async function callAPI(body, apiKey) {
  const resp = await fetch(ANTHROPIC_API, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      // Necesario para llamadas desde el navegador
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err?.error?.message ?? `HTTP ${resp.status}`;

    if (resp.status === 401) throw new Error('API Key inválida. Verifica tu clave en Configuración.');
    if (resp.status === 429) throw new Error('Límite de uso alcanzado. Intenta en unos minutos.');
    if (resp.status === 400) throw new Error('Solicitud inválida: ' + msg);

    throw new Error('Error de la API: ' + msg);
  }

  const data = await resp.json();

  // Extraer texto de la respuesta
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return text;
}

// ═══════════════════════════════════════════════
//  PARSEAR RESULTADO JSON
// ═══════════════════════════════════════════════
const VALID_CATS = new Set(['orden', 'lab', 'formula', 'historia', 'examen']);

function parseResult(text) {
  // Extraer JSON — puede venir con o sin bloques de código
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Buscar el primer objeto JSON válido
  const match = cleaned.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('La IA no devolvió JSON válido');

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (_) {
    throw new Error('JSON malformado en la respuesta de la IA');
  }

  // Validar y normalizar campos
  const categoria = VALID_CATS.has(parsed.categoria) ? parsed.categoria : 'orden';

  return {
    categoria,
    nombre: sanitize(parsed.nombre, 60),
    medico: sanitize(parsed.medico),
    fecha:  validateDate(parsed.fecha),
    notas:  sanitize(parsed.notas, 200),
  };
}

// ═══════════════════════════════════════════════
//  PREPARAR IMAGEN
// ═══════════════════════════════════════════════

/**
 * Convierte la imagen a base64 y la comprime si supera 1.5 MB
 * para reducir el consumo de tokens.
 */
async function prepareImage(file) {
  const MAX_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

  if (file.size <= MAX_SIZE) {
    // Sin comprimir — solo base64
    const dataUrl = await fileToBase64(file);
    return dataUrl.split(',')[1];
  }

  // Comprimir con canvas
  try {
    const compressed = await compressImage(file, 1200, 0.82);
    return compressed.split(',')[1];
  } catch (_) {
    // Si falla la compresión, enviar sin comprimir
    const dataUrl = await fileToBase64(file);
    return dataUrl.split(',')[1];
  }
}

/**
 * Comprime una imagen usando Canvas.
 * @param {File}   file    - imagen original
 * @param {number} maxDim  - dimensión máxima (ancho o alto)
 * @param {number} quality - calidad JPEG (0-1)
 * @returns {Promise<string>} data URL comprimida
 */
function compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Escalar manteniendo proporción
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width  = maxDim;
      } else if (height > maxDim) {
        width  = Math.round((width * maxDim) / height);
        height = maxDim;
      }

      const canvas  = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen para comprimir'));
    };

    img.src = url;
  });
}

// ═══════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════

/** Normaliza media type para la API de Anthropic */
function normalizeMediaType(type) {
  const map = {
    'image/jpg':  'image/jpeg',
    'image/jpeg': 'image/jpeg',
    'image/png':  'image/png',
    'image/gif':  'image/gif',
    'image/webp': 'image/webp',
    'image/heic': 'image/jpeg', // HEIC no soportado — convertir
    'image/heif': 'image/jpeg',
  };
  return map[type] ?? 'image/jpeg';
}

/** Limpia y recorta un string */
function sanitize(val, maxLen = 300) {
  if (!val || typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

/** Valida que la fecha tenga formato YYYY-MM-DD */
function validateDate(val) {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  // Acepta YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + 'T12:00:00');
    if (!isNaN(d.getTime())) return trimmed;
  }
  // Intentar parsear formatos comunes colombianos: DD/MM/YYYY o DD-MM-YYYY
  const altMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (altMatch) {
    const [, d, m, y] = altMatch;
    const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const date = new Date(iso + 'T12:00:00');
    if (!isNaN(date.getTime())) return iso;
  }
  return '';
}

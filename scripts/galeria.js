/**************
 * GALERÍA JS *
 **************/

// === Config ===
const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6cre7Bo-j0cG95YYKcto4A8j_1aTFLNbHoBruTmpUTm29Koc6vRVbdh6bCArj9SjWPM549TDYBAxu/pub?gid=0&single=true&output=csv';

// A=foto, B=video, C=alt
const HEADERS = { foto: 0, video: 1, alt: 2 };
const DEBUG_NO_LAZY = false; // poné true si querés desactivar lazy para depurar

// === Lightbox refs ===
const lb = {
  root: document.getElementById('lightbox'),
  img: document.getElementById('lightboxImg'),
  vid: document.getElementById('lightboxVid'),
  caption: document.getElementById('lightboxCaption'),
  closeBtn: document.getElementById('lightboxClose'),
  content: document.getElementById('lightboxContent')
};

// Abrir/Cerrar lightbox
function openLightbox({ type, src, alt }) {
  // limpiar estado
  lb.img.style.display = 'none';
  lb.vid.style.display = 'none';
  lb.caption.style.display = 'none';
  lb.vid.pause();

  if (type === 'image') {
    lb.img.src = src;
    lb.img.alt = alt || '';
    lb.img.style.display = 'block';
  } else if (type === 'video') {
    lb.vid.src = src;
    lb.vid.style.display = 'block';
  }

  if (alt && alt.trim()) {
    lb.caption.textContent = alt;
    lb.caption.style.display = 'block';
  }

  lb.root.classList.add('open');
  lb.root.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lb.root.classList.remove('open');
  lb.root.setAttribute('aria-hidden', 'true');
  lb.vid.pause();
  // liberar para que no siga consumiendo datos
  lb.img.src = '';
  lb.vid.src = '';
  document.body.style.overflow = '';
}

// Cerrar con click afuera, botón y tecla Esc
lb.root.addEventListener('click', (e) => {
  if (e.target === lb.root) closeLightbox(); // click en overlay
});
lb.closeBtn.addEventListener('click', closeLightbox);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lb.root.classList.contains('open')) closeLightbox();
});

// === Utilidades Google Drive ===
function extractDriveId(raw) {
  if (!raw) return '';
  const link = String(raw).trim();

  // Solo procesar si es de Drive/Docs
  if (!/drive\.google\.com|docs\.google\.com/i.test(link)) return '';

  // /file/d/ID/...
  const m1 = link.match(/\/d\/([-\w]{20,})/);
  if (m1 && m1[1]) return m1[1];

  // ?id=ID
  const m2 = link.match(/[?&]id=([-\w]{20,})/);
  if (m2 && m2[1]) return m2[1];

  // uc?id=ID
  const m3 = link.match(/uc\?[^#]*[?&]id=([-\w]{20,})/);
  if (m3 && m3[1]) return m3[1];

  // Fallback, primer token largo que parezca ID
  const m4 = link.match(/([-\w]{20,})/);
  return (m4 && m4[1]) || '';
}

// Directo confiable (imagen o video)
function driveDirect(raw) {
  const id = extractDriveId(raw);
  if (!id) return '';
  // Este endpoint suele andar mejor que /download?id=...
  return `https://drive.usercontent.google.com/uc?export=download&id=${id}`;
}

// Fallback a thumbnail (para imágenes)
function driveThumb(raw) {
  const id = extractDriveId(raw);
  if (!id) return '';
  return `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;
}

// === CSV parser (simple, tolerante a comillas) ===
function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v && String(v).trim() !== ''));
}

function isEmpty(v) { return !v || String(v).trim() === '' || String(v).toLowerCase() === 'null'; }

// === Lazy loading ===
function lazyLoadify(el, src) {
  if (DEBUG_NO_LAZY) {
    if (el.tagName === 'IMG') el.src = src;
    if (el.tagName === 'VIDEO') { el.src = src; el.load(); }
    return;
  }
  el.dataset.src = src;
  el.classList.add('skeleton');
  observer.observe(el);
}

const observer = new IntersectionObserver((entries, obs) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const src = el.dataset.src;
    if (!src) { obs.unobserve(el); return; }
    if (el.tagName === 'IMG') el.src = src;
    if (el.tagName === 'VIDEO') { el.src = src; el.load(); }
    el.classList.remove('skeleton');
    obs.unobserve(el);
  });
}, { rootMargin: '200px' });

// === Render helpers (agregan click para abrir lightbox) ===
function attachImage(card, src, alt, originalLinkForLog) {
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.alt = alt || 'foto';

  img.addEventListener('error', () => {
    const thumb = driveThumb(originalLinkForLog);
    if (thumb && img.src !== thumb) { img.src = thumb; return; }
    const warn = document.createElement('div');
    warn.className = 'caption';
    warn.textContent = '⚠️ No se pudo cargar (permisos o formato)';
    card.appendChild(warn);
  }, { once: true });

  // Abrir visor al click
  img.addEventListener('click', () => {
    const big = img.src || src;
    openLightbox({ type: 'image', src: big, alt });
  });

  lazyLoadify(img, src);
  card.appendChild(img);
}

function attachVideo(card, src, originalLinkForLog, alt) {
  const vid = document.createElement('video');
  vid.controls = true;
  vid.preload = 'none';
  vid.playsInline = true;

  vid.addEventListener('error', () => {
    const warn = document.createElement('div');
    warn.className = 'caption';
    warn.textContent = '⚠️ No se pudo cargar el video (revisá permisos o probá YouTube no listado)';
    card.appendChild(warn);
  }, { once: true });

  // Click en la tarjeta para abrir en visor (más cómodo en mobile)
  card.addEventListener('click', (e) => {
    // Evitar conflicto si el usuario tocó los controles del video en miniatura
    if (e.target.tagName.toLowerCase() === 'video' || e.target.closest('button')) return;
    const current = vid.currentSrc || src;
    openLightbox({ type: 'video', src: current, alt });
  });

  lazyLoadify(vid, src);
  card.appendChild(vid);
}

// === App ===
async function main() {
  const gridEl = document.getElementById('grid');
  gridEl.innerHTML = '';

  const res = await fetch(CSV_URL + ((CSV_URL.includes('?') ? '&' : '?') + 'cb=' + Date.now()));
  if (!res.ok) throw new Error(`No se pudo cargar CSV (${res.status})`);
  const csv = await res.text();
  const rows = parseCSV(csv);

  const headerLooksLikeHeader = rows[0] && rows[0].some(cell => /foto|video|alt/i.test(String(cell || '')));
  const data = headerLooksLikeHeader ? rows.slice(1) : rows;

  let total = 0;

  data.forEach(cols => {
    const fotoLink = cols[HEADERS.foto] || '';
    const videoLink = cols[HEADERS.video] || '';
    const alt = cols[HEADERS.alt] || '';

    if (isEmpty(fotoLink) && isEmpty(videoLink)) return;

    const card = document.createElement('div');
    card.className = 'item';

    if (!isEmpty(fotoLink)) {
      const direct = driveDirect(fotoLink);
      attachImage(card, direct || fotoLink, alt, fotoLink);
    } else if (!isEmpty(videoLink)) {
      const direct = driveDirect(videoLink);
      attachVideo(card, direct || videoLink, videoLink, alt);
    }

    if (alt && String(alt).trim()) {
      const cap = document.createElement('div');
      cap.className = 'caption';
      cap.textContent = alt;
      card.appendChild(cap);
    }

    gridEl.appendChild(card);
    total++;
  });

  const countEl = document.getElementById('count');
  if (countEl) countEl.textContent = `${total} ítems`;
}

main().catch(err => {
  console.error('Error en galería:', err);
  const grid = document.getElementById('grid');
  if (grid) grid.innerHTML = '<p>⚠️ No se pudo cargar la galería. Revisá el enlace CSV y permisos.</p>';
});

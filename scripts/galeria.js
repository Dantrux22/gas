/**************
 * GALERÍA JS *
 * v3.0: Ordena primero FOTOS y al final VIDEOS (col B)
 *         + soporte Google Drive + YouTube + MP4 directo
 **************/

// === Config ===
const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6cre7Bo-j0cG95YYKcto4A8j_1aTFLNbHoBruTmpUTm29Koc6vRVbdh6bCArj9SjWPM549TDYBAxu/pub?gid=0&single=true&output=csv';

// A=foto, B=video, C=alt
const HEADERS = { foto: 0, video: 1, alt: 2 };
const DEBUG_NO_LAZY = false; // true para desactivar lazy en debug

// === Lightbox refs ===
const lb = {
  root: document.getElementById('lightbox'),
  img: document.getElementById('lightboxImg'),
  vid: document.getElementById('lightboxVid'),
  frame: document.getElementById('lightboxFrame'), // iframe para Drive / YouTube
  caption: document.getElementById('lightboxCaption'),
  closeBtn: document.getElementById('lightboxClose'),
  content: document.getElementById('lightboxContent')
};

// Abrir/Cerrar lightbox
function openLightbox({ type, src, alt }) {
  // limpiar estado
  lb.img.style.display = 'none';
  lb.vid.style.display = 'none';
  lb.frame.style.display = 'none';
  lb.caption.style.display = 'none';

  lb.vid.pause?.();
  lb.img.src = '';
  lb.vid.src = '';
  lb.frame.src = '';

  if (type === 'image') {
    lb.img.src = src;
    lb.img.alt = alt || '';
    lb.img.style.display = 'block';
  } else if (type === 'video') {
    lb.vid.src = src;
    lb.vid.style.display = 'block';
  } else if (type === 'frame') {
    // Player embebido (Drive o YouTube)
    lb.frame.src = src;
    lb.frame.style.display = 'block';
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
  lb.vid.pause?.();
  lb.img.src = '';
  lb.vid.src = '';
  lb.frame.src = '';
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

// === Utilidades ===
function isEmpty(v) { return !v || String(v).trim() === '' || String(v).toLowerCase() === 'null'; }
function isDriveLink(u){ return /drive\.google\.com|docs\.google\.com/i.test(String(u||'')); }
function isYouTubeLink(u){ return /youtu\.be|youtube\.com/i.test(String(u||'')); }
function isLikelyVideoUrl(u){ return /\.(mp4|webm|ogg)(\?|$)/i.test(String(u||'')); }

function extractDriveId(raw) {
  if (!raw) return '';
  const link = String(raw).trim();
  if (!/drive\.google\.com|docs\.google\.com/i.test(link)) return '';
  const m1 = link.match(/\/d\/([-\w]{25,})/);
  const m2 = link.match(/[?&]id=([-\w]{25,})/);
  const m3 = link.match(/([-\w]{25,})/);
  return (m1 && m1[1]) || (m2 && m2[1]) || (m3 && m3[1]) || '';
}
function driveDirect(raw){ const id = extractDriveId(raw); return id ? `https://drive.usercontent.google.com/download?id=${id}&export=view` : ''; }
function driveThumb(raw, size=2000){ const id = extractDriveId(raw); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : ''; }
function drivePreview(raw, autoplay=false){ const id = extractDriveId(raw); return id ? `https://drive.google.com/file/d/${id}/preview${autoplay ? '?autoplay=1' : ''}` : ''; }

function extractYouTubeId(u){
  if (!u) return '';
  const s = String(u);
  let m = s.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  m = s.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  m = s.match(/\/embed\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : '';
}
function youtubeThumb(u){ const id = extractYouTubeId(u); return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''; }
function youtubeEmbed(u, autoplay=false){
  const id = extractYouTubeId(u);
  return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${autoplay ? '&autoplay=1' : ''}` : '';
}

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

// === Render helpers ===
function attachImage(card, src, alt, originalLinkForLog) {
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = alt || 'foto';

  img.addEventListener('error', () => {
    const thumb = driveThumb(originalLinkForLog);
    if (thumb && img.src !== thumb) { img.src = thumb; return; }
    const warn = document.createElement('div');
    warn.className = 'caption';
    warn.textContent = '⚠️ No se pudo cargar (permisos o formato)';
    card.appendChild(warn);
  }, { once: true });

  img.addEventListener('click', () => {
    const big = img.src || src;
    openLightbox({ type: 'image', src: big, alt });
  });

  lazyLoadify(img, src);
  card.appendChild(img);
}

// Miniatura + badge para videos de Google Drive (abre iframe preview)
function attachDriveVideo(card, driveLink, alt) {
  const thumb = driveThumb(driveLink, 1600);
  const preview = drivePreview(driveLink, true);

  const wrap = document.createElement('div');
  wrap.className = 'video-thumb';

  const img = document.createElement('img');
  img.alt = alt || 'video';

  img.addEventListener('error', () => {
    const warn = document.createElement('div');
    warn.className = 'caption';
    warn.innerHTML = '⚠️ Revisá permisos del archivo de Drive (debe ser "Cualquiera con el enlace"). ' +
                     `<a href="${driveLink}" target="_blank" rel="noopener">Abrir en Drive</a>`;
    card.appendChild(warn);
  }, { once:true });

  lazyLoadify(img, thumb);

  const badge = document.createElement('div');
  badge.className = 'play-badge';
  badge.textContent = '▶';

  wrap.appendChild(img);
  wrap.appendChild(badge);
  wrap.addEventListener('click', () => openLightbox({ type:'frame', src: preview, alt }));

  card.appendChild(wrap);
}

// Videos de YouTube (miniatura + player embebido)
function attachYouTubeVideo(card, link, alt){
  const thumb = youtubeThumb(link);
  const preview = youtubeEmbed(link, true);

  const wrap = document.createElement('div');
  wrap.className = 'video-thumb';

  const img = document.createElement('img');
  img.alt = alt || 'video';
  img.addEventListener('error', () => {
    const warn = document.createElement('div');
    warn.className = 'caption';
    warn.innerHTML = '⚠️ No se pudo cargar miniatura de YouTube. ' +
                     `<a href="${link}" target="_blank" rel="noopener">Abrir</a>`;
    card.appendChild(warn);
  }, { once:true });
  lazyLoadify(img, thumb);

  const badge = document.createElement('div');
  badge.className = 'play-badge';
  badge.textContent = '▶';

  wrap.appendChild(img);
  wrap.appendChild(badge);
  wrap.addEventListener('click', () => openLightbox({ type:'frame', src: preview, alt }));

  card.appendChild(wrap);
}

// Videos directos (mp4/webm/ogg) con <video> nativo
function attachDirectVideo(card, src, alt) {
  const vid = document.createElement('video');
  vid.controls = true;
  vid.preload = 'none';
  vid.playsInline = true;

  vid.addEventListener('error', () => {
    const warn = document.createElement('div');
    warn.className = 'caption';
    warn.textContent = '⚠️ No se pudo cargar el video (revisá permisos o probá Google Drive/YouTube)';
    card.appendChild(warn);
  }, { once: true });

  // Click en la tarjeta abre el video grande
  card.addEventListener('click', (e) => {
    if (e.target.tagName.toLowerCase() === 'video' || e.target.closest('button')) return;
    const current = vid.currentSrc || src;
    openLightbox({ type: 'video', src: current, alt });
  });

  lazyLoadify(vid, src);
  card.appendChild(vid);
}

// --- CSV parser chiquito (soporta comillas) ---
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

// === App ===
async function main() {
  const gridEl = document.getElementById('grid');
  gridEl.innerHTML = '';

  const res = await fetch(CSV_URL + ((CSV_URL.includes('?') ? '&' : '?') + 'cb=' + Date.now()));
  const csv = await res.text();
  const rows = parseCSV(csv);

  const headerLooksLikeHeader = rows[0] && rows[0].some(cell => /foto|video|alt/i.test(String(cell || '')));
  const data = headerLooksLikeHeader ? rows.slice(1) : rows;

  // 👉 Particionamos: primero FOTOS, después VIDEOS
  const photos = [];
  const videos = [];

  data.forEach(cols => {
    const fotoLink  = cols[HEADERS.foto]  || '';
    const videoLink = cols[HEADERS.video] || '';
    const alt       = cols[HEADERS.alt]   || '';

    const hasFoto  = !isEmpty(fotoLink);
    const hasVideo = !isEmpty(videoLink);

    if (!hasFoto && !hasVideo) return;

    // Si hay video en la fila, lo tratamos como "video" (irá al final)
    if (hasVideo) {
      videos.push({ fotoLink, videoLink, alt });
    } else {
      photos.push({ fotoLink, videoLink: '', alt });
    }
  });

  const ordered = [...photos, ...videos]; // ✅ fotos primero, videos al final
  let total = 0;

  ordered.forEach(({ fotoLink, videoLink, alt }) => {
    const card = document.createElement('div');
    card.className = 'item';

    if (videoLink && !isEmpty(videoLink)) {
      if (isDriveLink(videoLink)) {
        attachDriveVideo(card, videoLink, alt);
      } else if (isYouTubeLink(videoLink)) {
        attachYouTubeVideo(card, videoLink, alt);
      } else if (isLikelyVideoUrl(videoLink)) {
        attachDirectVideo(card, videoLink, alt);
      } else {
        const warn = document.createElement('div');
        warn.className = 'caption';
        warn.innerHTML = '⚠️ Enlace de video no compatible. ' +
                         `<a href="${videoLink}" target="_blank" rel="noopener">Abrir</a>`;
        card.appendChild(warn);
      }
    } else {
      const src = isDriveLink(fotoLink) ? driveDirect(fotoLink) : fotoLink;
      attachImage(card, src, alt, fotoLink);
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

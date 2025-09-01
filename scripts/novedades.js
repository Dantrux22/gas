/******************************************************
 * Novedades desde Google Sheets (Hoja "novedades")
 * Columnas: A=link | B=titulo | C=descripcion | D=imagen | E=fecha | F=etiqueta
 * - OG para TODAS las tarjetas (estilo WhatsApp)
 * - Si imagen OG es mala → screenshot; siempre renderiza descripción
 ******************************************************/

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6cre7Bo-j0cG95YYKcto4A8j_1aTFLNbHoBruTmpUTm29Koc6vRVbdh6bCArj9SjWPM549TDYBAxu/pub?gid=2128533657&single=true&output=csv';

const COL = { link:0, titulo:1, descripcion:2, imagen:3, fecha:4, etiqueta:5 };

// ==== Config ====
const MICROLINK_URL     = 'https://api.microlink.io';
const ALWAYS_TRY_OG     = true;   // intentar OG en todas
const PREFER_OG_TITLE   = false;  // no pisar título del Sheet
const PREFER_OG_DESC    = true;   // sí pisar descripción con OG
const FETCH_TIMEOUT_MS  = 8000;
const CONCURRENCY       = 4;
const DEBUG_LOG         = false;

// ===== Utils =====
const $ = (id) => document.getElementById(id);
const newsEl = $('news');

const isEmpty = v => !v || String(v).trim()==='' || String(v).toLowerCase()==='null';

function domainFrom(url){ try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; } }
function faviconFor(url){ const d = domainFrom(url); return d ? `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent('https://'+d)}` : ''; }

function isYouTube(u){ return /youtu\.be|youtube\.com/i.test(String(u||'')); }
function ytId(u){
  const s = String(u||'');
  let m = s.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/); if (m) return m[1];
  m = s.match(/[?&]v=([A-Za-z0-9_-]{6,})/); if (m) return m[1];
  m = s.match(/\/embed\/([A-Za-z0-9_-]{6,})/); if (m) return m[1];
  return '';
}
const ytThumb = u => (ytId(u) ? `https://img.youtube.com/vi/${ytId(u)}/hqdefault.jpg` : '');

function parseDate(s){ if (isEmpty(s)) return null; const d = new Date(s); return isNaN(+d) ? null : d; }

// Fallback visual (degradé por dominio)
function hueFromString(str){ let h=0; for (let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return h%360; }
function gradientFor(url){
  const seed = domainFrom(url) || url;
  const h = hueFromString(seed), h2=(h+32)%360;
  return `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${h2} 70% 35%))`;
}

// Lazy images
function lazy(el, src){ el.dataset.src = src; el.classList.add('skeleton'); io.observe(el); }
const io = new IntersectionObserver((entries, obs)=>{
  entries.forEach(e=>{
    if (!e.isIntersecting) return;
    const el=e.target, src=el.dataset.src;
    if (src){ el.src=src; el.classList.remove('skeleton'); }
    obs.unobserve(el);
  });
},{ rootMargin:'200px' });

// CSV parser (con comillas)
function parseCSV(text){
  const rows=[]; let i=0, field='', row=[], inQ=false;
  while(i<text.length){
    const c=text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQ=false; }
      else field+=c;
    }else{
      if(c==='"') inQ=true;
      else if(c===','){ row.push(field); field=''; }
      else if(c===`\n`){ row.push(field); rows.push(row); row=[]; field=''; }
      else if(c!=='\r') field+=c;
    }
    i++;
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v && String(v).trim()!==''));
}

/* =========== Microlink (OG + screenshot) =========== */

const META_CACHE = new Map();

function withTimeout(promise, ms = FETCH_TIMEOUT_MS){
  return Promise.race([
    promise,
    new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout')), ms))
  ]);
}
async function callMicrolink(url, opts = {}){
  const { screenshot=false } = opts;
  const params = new URLSearchParams({
    url,
    meta: 'true',
    audio: 'false',
    video: 'false',
    screenshot: screenshot ? 'true' : 'false'
  });
  const api = `${MICROLINK_URL}/?${params}`;
  const res = await withTimeout(fetch(api));
  return res.json();
}
function isBadOGImage(meta){
  const t = (meta.imageType||'').toLowerCase();
  const w = meta.imageWidth, h = meta.imageHeight;
  if (!meta.image) return true;
  if (t.includes('svg')) return true;
  if (w && h){
    const minDim = Math.min(w,h);
    const area   = w*h;
    if (minDim < 200) return true;
    if (area < 600*315*0.5) return true;
    const ratio = w/h;
    if (ratio > 0.9 && ratio < 1.1 && Math.max(w,h) < 320) return true;
  }
  return false;
}
async function fetchOG(url){
  if (META_CACHE.has(url)) return META_CACHE.get(url);
  let meta = { title:'', description:'', image:'', imageType:'', imageWidth:null, imageHeight:null };
  try{
    let json = await callMicrolink(url, { screenshot:false });
    if (DEBUG_LOG) console.log('OG meta', domainFrom(url), json);
    if (json?.status === 'success' && json.data){
      const d = json.data, img = d.image || d.logo || null;
      meta.title = d.title || '';
      meta.description = d.description || '';
      if (img){
        meta.image = (img.url || img) || '';
        meta.imageType = img.type || '';
        meta.imageWidth = img.width || null;
        meta.imageHeight = img.height || null;
      }
    }
    if (isBadOGImage(meta)){
      try{
        const scr = await callMicrolink(url, { screenshot:true });
        if (scr?.status === 'success' && scr.data?.screenshot){
          const s = scr.data.screenshot;
          meta.image = (s.url || s) || meta.image;
          meta.imageType = 'image/jpeg';
          meta.imageWidth = s.width || meta.imageWidth;
          meta.imageHeight = s.height || meta.imageHeight;
        }
      }catch(_){}
    }
  }catch(_){}
  META_CACHE.set(url, meta);
  return meta;
}

/* ============== Render ============== */

function renderFallbackThumb(container, link){
  container.classList.add('fallback');
  container.style.background = gradientFor(link);
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'fallback-wrap';

  const fav = document.createElement('img');
  fav.className = 'site-favicon';
  fav.src = faviconFor(link);
  fav.alt = '';

  const dom = document.createElement('div');
  dom.className = 'fallback-domain';
  dom.textContent = domainFrom(link) || 'Vista previa';

  wrap.appendChild(fav);
  wrap.appendChild(dom);
  container.appendChild(wrap);
}

function renderCardDOM(item){
  const { link } = item;

  const a = document.createElement('a');
  a.href = link; a.target = '_blank'; a.rel = 'noopener'; a.className = 'news-link';

  const card = document.createElement('article');
  card.className = 'news-card';

  // THUMB
  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'news-thumb';

  const fallbackImg = isYouTube(link) ? ytThumb(link) : '';
  const chosenImg = !isEmpty(item.imagen) ? item.imagen : fallbackImg;

  if (chosenImg){
    const img = document.createElement('img');
    img.alt = item.titulo || domainFrom(link) || 'Noticia';
    img.onerror = () => renderFallbackThumb(thumbWrap, link);
    lazy(img, chosenImg);
    thumbWrap.appendChild(img);
  } else {
    renderFallbackThumb(thumbWrap, link);
  }

  // BODY
  const body = document.createElement('div'); body.className = 'news-body';

  const meta = document.createElement('div'); meta.className = 'news-meta';
  const fav = document.createElement('img'); fav.src = faviconFor(link); fav.alt = '';
  const metaText = document.createElement('span');
  const d = parseDate(item.fecha);
  metaText.textContent = [domainFrom(link), d ? d.toLocaleDateString('es-AR') : null].filter(Boolean).join(' • ');
  meta.appendChild(fav); meta.appendChild(metaText);

  const h3 = document.createElement('h3'); h3.className = 'news-title';
  h3.textContent = !isEmpty(item.titulo) ? item.titulo : (domainFrom(link) || 'Ver noticia');

  const p = document.createElement('p'); p.className = 'news-desc';
  // 👇 SIEMPRE agregamos el elemento al DOM.
  if (!isEmpty(item.descripcion)) { p.textContent = item.descripcion; p.style.display = ''; }
  else { p.textContent = ''; p.style.display = 'none'; }

  const tags = document.createElement('div'); tags.className = 'news-tags';
  if (!isEmpty(item.etiqueta)){
    const t = document.createElement('span'); t.className = 'tag'; t.textContent = item.etiqueta;
    tags.appendChild(t);
  }

  body.appendChild(meta);
  body.appendChild(h3);
  body.appendChild(p);          // <-- siempre presente
  if (tags.children.length) body.appendChild(tags);

  card.appendChild(thumbWrap);
  card.appendChild(body);
  a.appendChild(card);

  return { root:a, thumbWrap, titleEl:h3, descEl:p, item };
}

function applyOGToCard(card, og){
  const { thumbWrap, titleEl, descEl, item } = card;

  // Título
  if (PREFER_OG_TITLE && og.title) titleEl.textContent = og.title;
  else if (isEmpty(item.titulo) && og.title) titleEl.textContent = og.title;

  // Descripción (mostrar aunque antes no existiera texto)
  if (PREFER_OG_DESC && og.description){
    descEl.textContent = og.description;
    descEl.style.display = '';
  } else if (isEmpty(item.descripcion) && og.description){
    descEl.textContent = og.description;
    descEl.style.display = '';
  }

  // Imagen
  const hasRealImg = !!thumbWrap.querySelector('img') && !thumbWrap.classList.contains('fallback');
  if (!hasRealImg && og.image){
    thumbWrap.classList.remove('fallback');
    thumbWrap.style.background = '';
    thumbWrap.innerHTML = '';
    const img = document.createElement('img');
    img.alt = titleEl.textContent || domainFrom(item.link) || 'Noticia';
    img.onerror = () => renderFallbackThumb(thumbWrap, item.link);
    lazy(img, og.image);
    thumbWrap.appendChild(img);
  }
}

/* ============== App ============== */

async function main(){
  newsEl.innerHTML = '';

  const res = await fetch(CSV_URL + (CSV_URL.includes('?') ? '&' : '?') + 'cb=' + Date.now());
  const csv = await res.text();
  const rows = parseCSV(csv);

  const headerish = rows[0] && rows[0].some(c => /link|titulo|descrip|imagen|img|fecha|etiq/i.test(String(c||'')));
  const data = headerish ? rows.slice(1) : rows;

  const items = data.map(r => ({
    link:        r[COL.link] || '',
    titulo:      r[COL.titulo] || '',
    descripcion: r[COL.descripcion] || '',
    imagen:      r[COL.imagen] || '',
    fecha:       r[COL.fecha] || '',
    etiqueta:    r[COL.etiqueta] || ''
  })).filter(x => !isEmpty(x.link));

  items.sort((a,b)=>{
    const da = parseDate(a.fecha), db = parseDate(b.fecha);
    if (da && db) return db - da;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });

  const cards = items.map(it => {
    const c = renderCardDOM(it);
    newsEl.appendChild(c.root);
    return c;
  });

  const queue = ALWAYS_TRY_OG
    ? [...cards]
    : cards.filter(c => isEmpty(c.item.titulo) || isEmpty(c.item.descripcion) || c.thumbWrap.classList.contains('fallback'));

  let idx = 0;
  async function worker(){
    while (idx < queue.length){
      const i = idx++;
      const card = queue[i];
      try{
        const og = await fetchOG(card.item.link);
        if (DEBUG_LOG) console.log('OG result', domainFrom(card.item.link), og);
        if (og && (og.title || og.description || og.image)){
          applyOGToCard(card, og);
        }
      }catch(err){
        if (DEBUG_LOG) console.warn('OG error', card.item.link, err);
      }
    }
  }
  await Promise.all(Array(Math.min(CONCURRENCY, queue.length)).fill(0).map(worker));

  if (!items.length){
    newsEl.innerHTML = '<p>No hay novedades por el momento.</p>';
  }
}

main().catch(err=>{
  console.error('Novedades:', err);
  newsEl.innerHTML = '<p>⚠️ No se pudo cargar Novedades. Revisá el <em>gid</em> y que la pestaña esté publicada como CSV.</p>';
});

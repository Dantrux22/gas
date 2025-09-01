/******************************************************
 * Novedades (Hoja "novedades")
 * A=link | B=titulo | C=descripcion | D=imagen | E=fecha | F=etiqueta
 ******************************************************/

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6cre7Bo-j0cG95YYKcto4A8j_1aTFLNbHoBruTmpUTm29Koc6vRVbdh6bCArj9SjWPM549TDYBAxu/pub?gid=2128533657&single=true&output=csv';

const COL = { link:0, titulo:1, descripcion:2, imagen:3, fecha:4, etiqueta:5 };

// ---------- Config ----------
const MICROLINK_URL    = 'https://api.microlink.io';
const ALWAYS_TRY_OG    = true;   // intenta OG para todas
const PREFER_OG_TITLE  = false;  // no pisar título del sheet
const PREFER_OG_DESC   = true;   // sí pisar desc con OG si hay
const FETCH_TIMEOUT_MS = 8000;
const CONCURRENCY      = 4;
const DEBUG_LOG        = false;
const DESC_MAX_CHARS   = 160;    // recorte suave

// ---------- Utils ----------
const $ = id => document.getElementById(id);
const newsEl = $('news');

const isEmpty = v => !v || String(v).trim()==='' || String(v).toLowerCase()==='null';
const clampText = (s, n=160) => (s && s.length > n ? s.slice(0, n-1).trimEnd() + '…' : s);

function domainFrom(url){ try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; } }
function faviconFor(url){ const d = domainFrom(url); return d ? `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent('https://'+d)}` : ''; }

function isYouTube(u){ return /youtu\.be|youtube\.com/i.test(String(u||'')); }
function ytId(u){ const s=String(u||''); return (s.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)||s.match(/[?&]v=([A-Za-z0-9_-]{6,})/)||s.match(/\/embed\/([A-Za-z0-9_-]{6,})/)||[])[1]||''; }
const ytThumb = u => (ytId(u) ? `https://img.youtube.com/vi/${ytId(u)}/hqdefault.jpg` : '');

function parseDate(s){ if (isEmpty(s)) return null; const d = new Date(s); return isNaN(+d) ? null : d; }

// Fallback mini
function hueFromString(str){ let h=0; for (let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return h%360; }
function gradientFor(url){
  const seed = domainFrom(url) || url;
  const h = hueFromString(seed), h2=(h+32)%360;
  return `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${h2} 70% 35%))`;
}

// Lazy
function lazy(el, src){ el.dataset.src = src; el.classList.add('skeleton'); io.observe(el); }
const io = new IntersectionObserver((ents, obs)=>{
  ents.forEach(e=>{
    if (!e.isIntersecting) return;
    const el=e.target, src=el.dataset.src;
    if (src){ el.src=src; el.classList.remove('skeleton'); }
    obs.unobserve(el);
  });
},{ rootMargin:'200px' });

// CSV
function parseCSV(text){
  const rows=[]; let i=0, field='', row=[], inQ=false;
  while(i<text.length){
    const c=text[i];
    if(inQ){ if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQ=false; } else field+=c; }
    else { if(c==='"') inQ=true; else if(c===','){ row.push(field); field=''; }
           else if(c===`\n`){ row.push(field); rows.push(row); row=[]; field=''; }
           else if(c!=='\r') field+=c; }
    i++;
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v && String(v).trim()!==''));
}

// ---------- Microlink ----------
const META_CACHE = new Map();
const withTimeout = (p, ms=FETCH_TIMEOUT_MS) =>
  Promise.race([p, new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout')), ms))]);

async function callMicrolink(url, { screenshot=false } = {}){
  const params = new URLSearchParams({ url, meta:'true', audio:'false', video:'false', screenshot: screenshot?'true':'false' });
  const res = await withTimeout(fetch(`${MICROLINK_URL}/?${params}`));
  return res.json();
}
function isBadOGImage(meta){
  const t=(meta.imageType||'').toLowerCase(), w=meta.imageWidth, h=meta.imageHeight;
  if (!meta.image) return true;
  if (t.includes('svg')) return true;
  if (w && h){
    const minDim=Math.min(w,h), area=w*h, ratio=w/h;
    if (minDim < 200) return true;
    if (area < 600*315*0.5) return true;
    if (ratio>0.9 && ratio<1.1 && Math.max(w,h)<320) return true;
  }
  return false;
}
async function fetchOG(url){
  if (META_CACHE.has(url)) return META_CACHE.get(url);
  let meta = { title:'', description:'', image:'', imageType:'', imageWidth:null, imageHeight:null };
  try{
    let j = await callMicrolink(url, { screenshot:false });
    if (DEBUG_LOG) console.log('OG meta', domainFrom(url), j);
    if (j?.status==='success' && j.data){
      const d=j.data, img=d.image||d.logo||null;
      meta.title = d.title || '';
      meta.description = d.description || '';
      if (img){
        meta.image = (img.url||img)||'';
        meta.imageType = img.type||'';
        meta.imageWidth = img.width||null;
        meta.imageHeight = img.height||null;
      }
    }
    if (isBadOGImage(meta)){
      try{
        const s = await callMicrolink(url, { screenshot:true });
        if (s?.status==='success' && s.data?.screenshot){
          const sc=s.data.screenshot;
          meta.image = (sc.url||sc)||meta.image;
          meta.imageType = 'image/jpeg';
          meta.imageWidth = sc.width||meta.imageWidth;
          meta.imageHeight = sc.height||meta.imageHeight;
        }
      }catch(_){}
    }
  }catch(_){}
  META_CACHE.set(url, meta);
  return meta;
}

// ---------- Render ----------
function renderFallbackThumb(container, link){
  container.classList.add('fallback');
  container.style.background = gradientFor(link);
  container.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className='fallback-wrap';
  const fav = document.createElement('img'); fav.className='site-favicon'; fav.src=faviconFor(link); fav.alt='';
  const dom = document.createElement('div'); dom.className='fallback-domain'; dom.textContent = domainFrom(link) || 'Vista previa';
  wrap.appendChild(fav); wrap.appendChild(dom); container.appendChild(wrap);
}

function renderCardDOM(item){
  const { link } = item;
  const a = document.createElement('a'); a.href=link; a.target='_blank'; a.rel='noopener'; a.className='news-link';
  const card = document.createElement('article'); card.className='news-card';

  const thumb = document.createElement('div'); thumb.className='news-thumb';
  const fallbackImg = isYouTube(link) ? ytThumb(link) : '';
  const chosenImg = !isEmpty(item.imagen) ? item.imagen : fallbackImg;
  if (chosenImg){
    const img=document.createElement('img'); img.alt=item.titulo||domainFrom(link)||'Noticia';
    img.onerror=()=>renderFallbackThumb(thumb, link); lazy(img, chosenImg); thumb.appendChild(img);
  } else { renderFallbackThumb(thumb, link); }

  const body = document.createElement('div'); body.className='news-body';

  const meta = document.createElement('div'); meta.className='news-meta';
  const fav=document.createElement('img'); fav.src=faviconFor(link); fav.alt='';
  const metaText=document.createElement('span');
  const d=parseDate(item.fecha);
  metaText.textContent=[domainFrom(link), d? d.toLocaleDateString('es-AR'):null].filter(Boolean).join(' • ');
  meta.appendChild(fav); meta.appendChild(metaText);

  const h3=document.createElement('h3'); h3.className='news-title';
  h3.textContent = !isEmpty(item.titulo) ? item.titulo : (domainFrom(link) || 'Ver noticia');

  // 👇 SIEMPRE creo el <p> de descripción
  const p=document.createElement('p'); p.className='news-desc';
  if (!isEmpty(item.descripcion)){ p.textContent = clampText(item.descripcion, DESC_MAX_CHARS); p.style.display=''; }
  else { p.textContent=''; p.style.display='none'; }

  const tags=document.createElement('div'); tags.className='news-tags';
  if (!isEmpty(item.etiqueta)){ const t=document.createElement('span'); t.className='tag'; t.textContent=item.etiqueta; tags.appendChild(t); }

  body.appendChild(meta); body.appendChild(h3); body.appendChild(p); if (tags.children.length) body.appendChild(tags);

  card.appendChild(thumb); card.appendChild(body); a.appendChild(card);
  return { root:a, thumbWrap:thumb, titleEl:h3, descEl:p, item };
}

function applyOGToCard(card, og){
  const { thumbWrap, titleEl, descEl, item } = card;

  // título
  if (PREFER_OG_TITLE && og.title) titleEl.textContent = og.title;
  else if (isEmpty(item.titulo) && og.title) titleEl.textContent = og.title;

  // descripción (mostrar siempre que exista)
  const ogDesc = clampText(og.description || '', DESC_MAX_CHARS);
  if (PREFER_OG_DESC && ogDesc){
    descEl.textContent = ogDesc;
    descEl.style.display = '';
  } else if (isEmpty(item.descripcion) && ogDesc){
    descEl.textContent = ogDesc;
    descEl.style.display = '';
  }

  // imagen
  const hasRealImg = !!thumbWrap.querySelector('img') && !thumbWrap.classList.contains('fallback');
  if (!hasRealImg && og.image){
    thumbWrap.classList.remove('fallback'); thumbWrap.style.background=''; thumbWrap.innerHTML='';
    const img=document.createElement('img');
    img.alt = titleEl.textContent || domainFrom(item.link) || 'Noticia';
    img.onerror=()=>renderFallbackThumb(thumbWrap, item.link);
    lazy(img, og.image);
    thumbWrap.appendChild(img);
  }
}

// ---------- App ----------
async function main(){
  newsEl.innerHTML = '';

  const res = await fetch(CSV_URL + (CSV_URL.includes('?')?'&':'?') + 'cb=' + Date.now());
  const rows = parseCSV(await res.text());
  const headerish = rows[0] && rows[0].some(c => /link|titulo|descrip|imagen|img|fecha|etiq/i.test(String(c||'')));
  const data = headerish ? rows.slice(1) : rows;

  const items = data.map(r => ({
    link:r[COL.link]||'', titulo:r[COL.titulo]||'', descripcion:r[COL.descripcion]||'',
    imagen:r[COL.imagen]||'', fecha:r[COL.fecha]||'', etiqueta:r[COL.etiqueta]||''
  })).filter(x => !isEmpty(x.link));

  items.sort((a,b)=>{
    const da=parseDate(a.fecha), db=parseDate(b.fecha);
    if (da && db) return db-da; if (da) return -1; if (db) return 1; return 0;
  });

  const cards = items.map(it => { const c=renderCardDOM(it); newsEl.appendChild(c.root); return c; });

  const queue = ALWAYS_TRY_OG ? [...cards] :
    cards.filter(c => isEmpty(c.item.titulo) || isEmpty(c.item.descripcion) || c.thumbWrap.classList.contains('fallback'));

  let idx=0;
  async function worker(){
    while(idx < queue.length){
      const i=idx++, card=queue[i];
      try{
        const og = await fetchOG(card.item.link);
        if (DEBUG_LOG) console.log('OG result', domainFrom(card.item.link), og);
        if (og && (og.title || og.description || og.image)) applyOGToCard(card, og);
      }catch(err){ if (DEBUG_LOG) console.warn('OG error', card.item.link, err); }
    }
  }
  await Promise.all(Array(Math.min(CONCURRENCY, queue.length)).fill(0).map(worker));

  if (!items.length) newsEl.innerHTML = '<p>No hay novedades por el momento.</p>';
}

main().catch(err=>{
  console.error('Novedades:', err);
  newsEl.innerHTML = '<p>⚠️ No se pudo cargar Novedades.</p>';
});

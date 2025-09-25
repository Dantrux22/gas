/* Novedades – render agrupado por Mes/Año
   Requiere un array de items con al menos: { title, url, date, description?, image?, tags? }
   - date: cadena ISO o parseable por Date (p.ej. "2025-08-14", "2023-08-01T10:00:00Z")
   - Si no tenés una fuente externa, podés usar el array NEWS de ejemplo de abajo.
*/

// ---------------------------------------------------------------------------
// 1) DATA (ejemplo). Si ya cargás tus noticias desde otro script, borrá/ignora esto.
// ---------------------------------------------------------------------------
const NEWS = (typeof window.NEWS !== "undefined" && Array.isArray(window.NEWS))
  ? window.NEWS
  : [
      {
        title: "Paritaria: acuerdo y nuevos tramos",
        url: "https://example.com/nota-paritaria",
        date: "2025-08-14",
        description: "Resumen del acta y próximos pasos.",
        image: "https://picsum.photos/seed/paritaria/800/450",
        tags: ["Paritaria","Acta"]
      },
      {
        title: "Jornada de capacitación sindical",
        url: "https://example.com/capacitacion",
        date: "2025-08-05",
        description: "Temario y materiales disponibles.",
        image: "https://picsum.photos/seed/capacitacion/800/450",
        tags: ["Capacitación"]
      },
      {
        title: "Beneficios de obra social",
        url: "https://example.com/obra-social",
        date: "2025-07-22",
        description: "Nuevos convenios y prestadores.",
        image: "https://picsum.photos/seed/obra/800/450",
        tags: ["Obra Social"]
      },
      {
        title: "Inauguración de sede",
        url: "https://example.com/sede",
        date: "2023-08-10",
        description: "Galería de fotos y palabras de apertura.",
        image: "https://picsum.photos/seed/sede/800/450",
        tags: ["Institucional"]
      }
    ];

// ---------------------------------------------------------------------------
// 2) Helpers
// ---------------------------------------------------------------------------
const $root = document.getElementById("news-root");

function toDate(d) {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function monthKey(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(dt) {
  // Ej.: "agosto de 2025" -> capitalizamos primer letra de mes
  const str = dt.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function faviconFrom(url) {
  try {
    const u = new URL(url);
    return `${u.origin}/favicon.ico`;
  } catch { return null; }
}

function domainFrom(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

// Crea el DOM de una card
function createCard(item) {
  const a = document.createElement("a");
  a.className = "news-link";
  a.href = item.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const card = document.createElement("article");
  card.className = "news-card";

  // Thumb
  const thumb = document.createElement("div");
  thumb.className = "news-thumb";

  if (item.image) {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = "";
    thumb.appendChild(img);
  } else {
    // Fallback visual con favicon + dominio
    thumb.classList.add("fallback");
    const wrap = document.createElement("div");
    wrap.className = "fallback-wrap";

    const fav = document.createElement("img");
    fav.className = "site-favicon";
    const fv = faviconFrom(item.url);
    if (fv) fav.src = fv;
    fav.alt = "";

    const dom = document.createElement("div");
    dom.className = "fallback-domain";
    dom.textContent = domainFrom(item.url);

    wrap.appendChild(fav);
    wrap.appendChild(dom);
    thumb.appendChild(wrap);
  }

  // Body
  const body = document.createElement("div");
  body.className = "news-body";

  // Meta (fecha corta)
  const meta = document.createElement("div");
  meta.className = "news-meta";
  const dt = toDate(item.date);
  if (dt) {
    const span = document.createElement("span");
    span.textContent = dt.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
    meta.appendChild(span);
  }

  // Título
  const h3 = document.createElement("h3");
  h3.className = "news-title";
  h3.textContent = item.title || "";

  // Descripción
  const p = document.createElement("p");
  p.className = "news-desc";
  p.textContent = item.description || "";

  // Tags
  let tagsWrap = null;
  if (Array.isArray(item.tags) && item.tags.length) {
    tagsWrap = document.createElement("div");
    tagsWrap.className = "news-tags";
    item.tags.forEach(t => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t;
      tagsWrap.appendChild(tag);
    });
  }

  body.appendChild(meta);
  body.appendChild(h3);
  if (p.textContent) body.appendChild(p);
  if (tagsWrap) body.appendChild(tagsWrap);

  card.appendChild(thumb);
  card.appendChild(body);
  a.appendChild(card);
  return a;
}

// ---------------------------------------------------------------------------
// 3) Agrupar por Mes/Año y renderizar
// ---------------------------------------------------------------------------
function renderNews(items) {
  if (!$root) return;

  // Sanitizar + ordenar desc por fecha
  const clean = items
    .map(it => ({ ...it, _date: toDate(it.date) }))
    .filter(it => it._date instanceof Date)
    .sort((a, b) => b._date - a._date);

  // Agrupar
  const groups = new Map();
  for (const it of clean) {
    const key = monthKey(it._date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  // Limpiar root
  $root.innerHTML = "";

  // Render por grupo
  for (const [key, arr] of groups) {
    const dt = arr[0]._date; // cualquiera del grupo sirve para el título
    const section = document.createElement("section");
    section.className = "month-group";
    section.id = `m-${key}`; // ancla

    const h2 = document.createElement("h2");
    h2.className = "month-title";
    h2.textContent = monthTitle(dt); // Ej.: "Agosto de 2025"

    const grid = document.createElement("div");
    grid.className = "news-list";

    arr.forEach(item => grid.appendChild(createCard(item)));

    section.appendChild(h2);
    section.appendChild(grid);
    $root.appendChild(section);
  }
}

// Inicializar
renderNews(NEWS);

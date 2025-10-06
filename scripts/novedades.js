/* novedades.js - carga noticias desde CSV y obtiene metadata de los links via Microlink */

// ----------------------------- Config -------------------------------------
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTtvsVesumUVUQgoMy_rwAilVvShXE9rtsdxga9EYtMaWRUfhxcP1qHVLz07TO_VBXq7dnP9mBbQ91/pub?output=csv";

const $root = document.getElementById("news-root");

// --------------------------- Utilidades -----------------------------------
function normalizeKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_]/g, "");
}

function toDate(d) {
  if (!d) return null;
  if (typeof d === "number") {
    const jsDate = new Date(Math.round((d - 25569) * 86400 * 1000));
    return isNaN(jsDate.getTime()) ? null : jsDate;
  }
  const str = String(d).trim();
  if (!str) return null;
  const dm = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dm) {
    let day = dm[1].padStart(2, "0");
    let mon = dm[2].padStart(2, "0");
    let year = dm[3];
    if (year.length === 2) year = "20" + year;
    const iso = `${year}-${mon}-${day}`;
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dt;
  return null;
}

function monthKey(dt) { return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; }
function monthTitle(dt) {
  const str = dt.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// --------------------------- Render (mantiene tu diseño) -------------------
function createCard(item) {
  const a = document.createElement("a");
  a.className = "news-link";
  a.href = item.url || "#";
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const card = document.createElement("article");
  card.className = "news-card";

  const thumb = document.createElement("div");
  thumb.className = "news-thumb";

  if (item.image) {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.title || "";
    thumb.appendChild(img);
  } else {
    thumb.classList.add("fallback");
    thumb.textContent = "Sin imagen";
  }

  const body = document.createElement("div");
  body.className = "news-body";

  const meta = document.createElement("div");
  meta.className = "news-meta";
  const dt = item._date instanceof Date ? item._date : null;
  const span = document.createElement("span");
  span.textContent = dt ? dt.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "Fecha desconocida";
  meta.appendChild(span);

  const h3 = document.createElement("h3");
  h3.className = "news-title";
  h3.textContent = item.title || "(Sin título)";

  const p = document.createElement("p");
  p.className = "news-desc";
  p.textContent = item.description || "";

  body.appendChild(meta);
  body.appendChild(h3);
  if (p.textContent) body.appendChild(p);

  card.appendChild(thumb);
  card.appendChild(body);
  a.appendChild(card);
  return a;
}

function renderNews(items) {
  if (!$root) return;
  const withDates = items.map(it => ({ ...it, _date: toDate(it.date) }));
  withDates.sort((a, b) => {
    if (a._date && b._date) return b._date - a._date;
    if (a._date && !b._date) return -1;
    if (!a._date && b._date) return 1;
    return 0;
  });

  const groups = new Map();
  for (const it of withDates) {
    const key = it._date ? monthKey(it._date) : "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  $root.innerHTML = "";
  for (const [key, arr] of groups) {
    const section = document.createElement("section");
    section.className = "month-group";
    section.id = key === "unknown" ? "m-unknown" : `m-${key}`;
    const h2 = document.createElement("h2");
    h2.className = "month-title";
    h2.textContent = key === "unknown" ? "Sin fecha" : monthTitle(arr[0]._date);
    const grid = document.createElement("div");
    grid.className = "news-list";
    arr.forEach(item => grid.appendChild(createCard(item)));
    section.appendChild(h2);
    section.appendChild(grid);
    $root.appendChild(section);
  }
}

// --------------------------- CSV Parsing ----------------------------------
function parseCSV(text) {
  const rows = [];
  let cur = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nxt = text[i + 1];
    if (ch === '"') {
      if (inQuotes && nxt === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === "," && !inQuotes) { row.push(cur); cur = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i+1] === "\n") { i++; }
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function csvRowsToObjects(rows) {
  if (!rows || !rows.length) return [];
  const headers = rows[0].map(h => normalizeKey(String(h || "")));
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    if (!line || line.length === 0) continue;
    const obj = {};
    for (let c = 0; c < Math.max(headers.length, line.length); c++) {
      const key = headers[c] || ("col" + c);
      obj[key] = line[c] !== undefined ? line[c] : "";
    }
    out.push(obj);
  }
  return out;
}

// --------------------------- Microlink fetch --------------------------------
async function fetchLinkData(url){
  if(!url) return {};
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    return {
      title: data.data.title || "",
      description: data.data.description || "",
      image: data.data.image?.url || ""
    };
  } catch(e){
    console.warn("Error fetchLinkData:", e);
    return {};
  }
}

async function mapRowToItemWithMeta(rowObj){
  const url = rowObj['url'] || rowObj['link'] || rowObj['col0'] || "";
  if(!url) return null;
  const meta = await fetchLinkData(url);
  const date = rowObj['date'] || rowObj['fecha'] || "";
  return {
    url,
    title: meta.title || rowObj['title'] || "(Sin título)",
    description: meta.description || rowObj['description'] || "",
    image: meta.image || "",
    date
  };
}

// --------------------------- Load News -----------------------------------
async function loadNews(){
  try {
    const text = await fetch(CSV_URL).then(r=>r.text());
    const rows = parseCSV(text);
    const objs = csvRowsToObjects(rows);

    const items = [];
    for(let i=0; i<objs.length; i++){
      const item = await mapRowToItemWithMeta(objs[i]);
      if(item) items.push(item);
    }

    renderNews(items);

  } catch(e){
    console.error("Error al cargar novedades:", e);
    if($root) $root.innerHTML = `<div style="padding:24px; color:var(--TEXTO_SECUNDARIO,#9ca3af)">Error al cargar novedades. Revisa consola.</div>`;
  }
}

loadNews();

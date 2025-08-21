// /scripts/load-header.js
(function () {
  const PLACEHOLDER_ID = 'header-placeholder';

  // Base = carpeta donde vive ESTE script (p.ej. /scripts/)
  const SCRIPT_URL = document.currentScript?.src || '';
  const BASE = new URL('.', SCRIPT_URL || location.href);

  // Rutas del parcial y del CSS, relativas al script
  const PARTIAL_URL = new URL('../partials/header.html', BASE).href; // -> /partials/header.html
  const CSS_URL     = new URL('../css/header.css', BASE).href;       // -> /css/header.css

  async function injectHeader() {
    // si ya hay un header, no hagas nada
    if (document.querySelector('[data-header]')) {
      ensureHeaderStylesheet();
      wireUpHeaderInteractions();
      markActiveLink();
      return;
    }

    // buscar placeholder si existe
    const target = document.getElementById(PLACEHOLDER_ID);

    try {
      const res = await fetch(PARTIAL_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`No se pudo cargar ${PARTIAL_URL}`);
      const html = await res.text();

      if (target) {
        // Reemplaza placeholder por el header
        target.outerHTML = html;
      } else {
        // Inserta el header como primer hijo del <body>
        document.body.insertAdjacentHTML('afterbegin', html);
      }

      ensureHeaderStylesheet();
      wireUpHeaderInteractions();
      markActiveLink();
    } catch (e) {
      console.error('load-header:', e);
    }
  }

  function ensureHeaderStylesheet() {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const hasHeaderCss = links.some(l => (l.getAttribute('href') || '').includes('header.css'));
    if (!hasHeaderCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_URL + `?v=${Date.now()}`; // anti-caché en dev
      document.head.appendChild(link);
    }
  }

  function wireUpHeaderInteractions() {
    const header = document.querySelector('[data-header]');
    if (!header) return;

    // Toggle menú mobile
    const toggle = header.querySelector('[data-menu-toggle]');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = header.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    // Mega menú (primer item)
    const megaHost = header.querySelector('[data-has-mega]');
    const megaBtn  = header.querySelector('[data-mega-toggle]');
    if (megaHost && megaBtn) {
      const open = (state) => {
        megaHost.classList.toggle('open', state);
        megaBtn.setAttribute('aria-expanded', String(state));
      };
      megaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        open(!megaHost.classList.contains('open'));
      });
      document.addEventListener('click', (e) => {
        if (!megaHost.contains(e.target) && !megaBtn.contains(e.target)) open(false);
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
    }
  }

  function markActiveLink() {
    const path = location.pathname.replace(/\/index\.html?$/, '/');
    document.querySelectorAll('.nav-list a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (href !== '/' && path.startsWith(href)) a.classList.add('is-active');
      else if (href === '/' && (path === '/' || path.endsWith('/index.html'))) a.classList.add('is-active');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHeader);
  } else {
    injectHeader();
  }
})();

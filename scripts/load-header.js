// /scripts/load-header.js
(function () {
  const PLACEHOLDER_ID = 'header-placeholder';

  // Base = carpeta donde vive ESTE script (p.ej. https://user.github.io/REPO/scripts/)
  const SCRIPT_URL = document.currentScript?.src || '';
  const BASE = new URL('.', SCRIPT_URL || location.href);

  // Rutas del parcial y del CSS, relativas al script
  const PARTIAL_URL = new URL('../partials/header.html', BASE).href; // -> .../partials/header.html
  const CSS_URL     = new URL('../css/header.css', BASE).href;       // -> .../css/header.css

  // Repo base (con subcarpeta) p.ej. "https://user.github.io/REPO/"
  const REPO_BASE_URL = new URL('..', BASE);

  function repoRootPath() {
    let p = REPO_BASE_URL.pathname || '/';
    if (!p.endsWith('/')) p += '/';
    return p; // p.ej. "/REPO/" o "/"
  }

  async function injectHeader() {
    // si ya hay un header, no hagas nada
    if (document.querySelector('[data-header]')) {
      ensureHeaderStylesheet();
      wireUpHeaderInteractions();
      patchInternalLinks();
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
      // 👇 también reescribimos ENLACES de toda la página (header + contenido)
      patchInternalLinks();
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

  /**
   * Reescribe cualquier href que empiece con "/" para que incluya el subpath del repo.
   * Ej.: "/pages/historia.html" -> "/REPO/pages/historia.html" en GitHub Pages.
   * También corrige el favicon si estaba absoluto.
   */
  function patchInternalLinks() {
    const root = repoRootPath();                 // "/REPO/" o "/"
    const origin = location.origin;              // "https://user.github.io"

    // Enlaces <a>
    document.querySelectorAll('a[href^="/"]').forEach(a => {
      const raw = a.getAttribute('href') || '/';
      if (raw === '/') {
        a.setAttribute('href', origin + root);
        return;
      }
      const clean = raw.replace(/^\//, '');      // "pages/historia.html"
      a.setAttribute('href', origin + root + clean);
    });

    // Favicon / iconos
    document.querySelectorAll('link[rel="icon"][href^="/"]').forEach(l => {
      const clean = (l.getAttribute('href') || '').replace(/^\//, '');
      l.href = origin + root + clean;
    });
  }

  function markActiveLink() {
    const path = location.pathname; // p.ej. "/REPO/pages/historia.html"
    document.querySelectorAll('.nav-list a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      let hrefPath = href;
      try {
        hrefPath = new URL(href, location.origin).pathname;
      } catch (_) {}
      // Home
      if (hrefPath === '/' || hrefPath.endsWith('/index.html')) {
        if (path === hrefPath || path === repoRootPath() || path.endsWith('/index.html')) {
          a.classList.add('is-active');
        }
        return;
      }
      // Coincidencia por prefijo (sección activa)
      if (hrefPath !== '/' && path.startsWith(hrefPath)) {
        a.classList.add('is-active');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHeader);
  } else {
    injectHeader();
  }
})();

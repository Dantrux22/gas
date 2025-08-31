// /scripts/load-header.js
(function () {
  const PLACEHOLDER_ID = 'header-placeholder';

  // Base = carpeta donde vive ESTE script (p.ej. https://usuario.github.io/gas/scripts/)
  const SCRIPT_URL = document.currentScript?.src || '';
  const BASE = new URL('.', SCRIPT_URL || location.href);

  // Rutas del parcial y del CSS, relativas al script
  const PARTIAL_URL = new URL('../partials/header.html', BASE).href; // -> .../partials/header.html
  const CSS_URL     = new URL('../css/header.css', BASE).href;       // -> .../css/header.css

  // Repo base (con subcarpeta), ej. "/gas/"
  const REPO_BASE_URL = new URL('..', BASE);
  function repoRootPath() {
    let p = REPO_BASE_URL.pathname || '/';
    if (!p.endsWith('/')) p += '/';
    return p;
  }

  async function injectHeader() {
    // si ya hay un header, no hagas nada
    if (document.querySelector('[data-header]')) {
      ensureHeaderStylesheet();
      wireUpHeaderInteractions();
      patchInternalLinksAndMedia();
      markActiveLink();
      return;
    }

    const target = document.getElementById(PLACEHOLDER_ID);

    try {
      const res = await fetch(PARTIAL_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`No se pudo cargar ${PARTIAL_URL}`);
      const html = await res.text();

      if (target) {
        target.outerHTML = html; // Reemplaza placeholder por el header
      } else {
        document.body.insertAdjacentHTML('afterbegin', html);
      }

      ensureHeaderStylesheet();
      wireUpHeaderInteractions();
      // 👇 Corrige enlaces del header y del resto del DOM ya presente
      patchInternalLinksAndMedia();
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
   * Reescribe URLs absolutas (que empiezan con "/") para incluir el subpath del repo.
   * Aplica a:
   *  - <a href>
   *  - <link rel="icon"/"apple-touch-icon"/"manifest" href>
   *  - <img src>, <img srcset>, <source src/srcset>, <video src/poster>
   */
  function patchInternalLinksAndMedia() {
    const root = repoRootPath();    // "/gas/" o "/"
    const origin = location.origin; // "https://usuario.github.io"

    const fixUrl = (u) => {
      if (!u || typeof u !== 'string') return u;
      if (/^(https?:)?\/\//i.test(u)) return u; // ya es absoluta/externa
      if (u === '/') return origin + root;      // home
      if (u.startsWith('/')) return origin + root + u.replace(/^\//, '');
      return u;
    };

    // <a href="/...">
    document.querySelectorAll('a[href^="/"]').forEach(a => {
      a.setAttribute('href', fixUrl(a.getAttribute('href') || '/'));
    });

    // favicon / manifest
    document.querySelectorAll('link[rel="icon"][href^="/"], link[rel="apple-touch-icon"][href^="/"], link[rel="manifest"][href^="/"]').forEach(l => {
      l.setAttribute('href', fixUrl(l.getAttribute('href') || ''));
    });

    // <img src="/...">, <source src="/...">, <video src="/...">
    document.querySelectorAll('img[src^="/"], source[src^="/"], video[src^="/"]').forEach(el => {
      el.setAttribute('src', fixUrl(el.getAttribute('src') || ''));
    });

    // <video poster="/...">
    document.querySelectorAll('video[poster^="/"]').forEach(v => {
      v.setAttribute('poster', fixUrl(v.getAttribute('poster') || ''));
    });

    // srcset en <img> y <source>
    const rewriteSrcset = (val) => {
      if (!val) return val;
      return val.split(',').map(part => {
        const p = part.trim();
        const m = p.match(/^(\S+)(\s+.+)?$/); // URL [espacio descriptor]
        if (!m) return p;
        const url = m[1];
        const desc = m[2] || '';
        return (fixUrl(url) + desc);
      }).join(', ');
    };
    document.querySelectorAll('img[srcset], source[srcset]').forEach(el => {
      const v = el.getAttribute('srcset');
      if (v && /^\s*\/\S/.test(v)) {
        el.setAttribute('srcset', rewriteSrcset(v));
      }
    });

    // SVG <use href="/...">
    document.querySelectorAll('use[href^="/"]').forEach(u => {
      u.setAttribute('href', fixUrl(u.getAttribute('href') || ''));
    });
  }

  function markActiveLink() {
    const path = location.pathname; // ej. "/gas/pages/historia.html"
    const root = repoRootPath();
    document.querySelectorAll('.nav-list a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      let hrefPath = href;
      try { hrefPath = new URL(href, location.origin).pathname; } catch (_) {}

      // Home
      if (hrefPath === '/' || hrefPath.endsWith('/index.html') || hrefPath === root) {
        if (path === hrefPath || path === root || path.endsWith('/index.html')) {
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

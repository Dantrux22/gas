(function () {
  const PLACEHOLDER_ID = 'header-placeholder';

  const SCRIPT_URL = document.currentScript?.src || '';
  const BASE = new URL('.', SCRIPT_URL || location.href);

  const PARTIAL_URL = new URL('../partials/header.html', BASE).href;
  const CSS_URL     = new URL('../css/header.css', BASE).href;

  const REPO_BASE_URL = new URL('..', BASE);
  function repoRootPath() {
    let p = REPO_BASE_URL.pathname || '/';
    if (!p.endsWith('/')) p += '/';
    return p;
  }

  async function injectHeader() {
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

      if (target) target.outerHTML = html;
      else document.body.insertAdjacentHTML('afterbegin', html);

      ensureHeaderStylesheet();
      wireUpHeaderInteractions();
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
      link.href = CSS_URL + `?v=${Date.now()}`;
      document.head.appendChild(link);
    }
  }

  function wireUpHeaderInteractions() {
    const header = document.querySelector('[data-header]');
    if (!header) return;

    const toggle = header.querySelector('[data-menu-toggle]');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = header.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

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

  function patchInternalLinksAndMedia() {
    const root = repoRootPath();
    const origin = location.origin;

    const fixUrl = (u) => {
      if (!u || typeof u !== 'string') return u;
      if (/^(https?:)?\/\//i.test(u)) return u;
      if (u === '/') return origin + root;
      if (u.startsWith('/')) return origin + root + u.replace(/^\//, '');
      return u;
    };

    document.querySelectorAll('a[href^="/"]').forEach(a => {
      a.setAttribute('href', fixUrl(a.getAttribute('href') || '/'));
    });

    document.querySelectorAll('link[rel="icon"][href^="/"], link[rel="apple-touch-icon"][href^="/"], link[rel="manifest"][href^="/"]').forEach(l => {
      l.setAttribute('href', fixUrl(l.getAttribute('href') || ''));
    });

    document.querySelectorAll('img[src^="/"], source[src^="/"], video[src^="/"]').forEach(el => {
      el.setAttribute('src', fixUrl(el.getAttribute('src') || ''));
    });

    document.querySelectorAll('video[poster^="/"]').forEach(v => {
      v.setAttribute('poster', fixUrl(v.getAttribute('poster') || ''));
    });

    const rewriteSrcset = (val) => {
      if (!val) return val;
      return val.split(',').map(part => {
        const p = part.trim();
        const m = p.match(/^(\S+)(\s+.+)?$/);
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

    document.querySelectorAll('use[href^="/"]').forEach(u => {
      u.setAttribute('href', fixUrl(u.getAttribute('href') || ''));
    });
  }

  function markActiveLink() {
    const path = location.pathname;
    const root = repoRootPath();
    document.querySelectorAll('.nav-list a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      let hrefPath = href;
      try { hrefPath = new URL(href, location.origin).pathname; } catch (_) {}

      if (hrefPath === '/' || hrefPath.endsWith('/index.html') || hrefPath === root) {
        if (path === hrefPath || path === root || path.endsWith('/index.html')) {
          a.classList.add('is-active');
        }
        return;
      }
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

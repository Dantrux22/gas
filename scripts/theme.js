(function(){
  // 🎨 Paleta base
  const palette = {
    '--bg':        '#0B0B0B',  // fondo oscuro
    '--fg':        '#FFFFFF',  // texto claro
    '--muted':     '#9AA0A6',  // texto gris
    '--card':      '#111111',  // fondos de tarjetas
    '--border':    '#1E1E1E',  // bordes/grillas

    // Marca (azules del logo)
    '--brand-600': '#085e75',  // azul principal del logo
    '--brand-500': '#0a6e89',  // azul secundario
    '--brand-400': '#4E86FF',  // azul claro para links/hover

    // Acento (rojo)
    '--accent-500': '#E53935',
    '--accent-700': '#B71C1C'
  };

  // Paleta clara (fondo blanco)
  const light = {
    '--bg':    '#FFFFFF',
    '--fg':    '#102027', // tu --text actual
    '--card':  '#F8F9FA',
    '--border':'#E6E6E6',
    '--muted': '#5F6368'
  };

  function apply(vars){
    const root = document.documentElement;
    Object.entries(vars).forEach(([k,v]) => root.style.setProperty(k, v));
  }

  // API global
  window.Theme = {
    applyDark(){ apply(palette); document.documentElement.dataset.theme='dark'; },
    applyLight(){ apply({...palette, ...light}); document.documentElement.dataset.theme='light'; },
    set(custom){ apply(custom); }
  };

  // Por defecto: oscuro
  window.Theme.applyDark();
})();

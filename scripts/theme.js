(function(){
  // ========== PALETA DE MARCA (referencias base) ==========
  const marca = {
    azul600: '#085e75',   // azul principal (logo)
    azul500: '#0a6e89',   // azul secundario
    azul400: '#4E86FF',   // azul claro (links/hover)
    rojo500: '#E53935',   // acento (para estados, NO para botón primario)
    blanco:  '#FFFFFF',
    negro:   '#0B0B0B',
    gris900: '#111111',
    gris800: '#1E1E1E',
    gris500: '#9AA0A6',
    gris200: '#E6E6E6',
    gris050: '#F8F9FA',
    tinta:   '#0f2230'
  };

  // ========== TOKENS DEL SITIO (EDITÁ SOLO ESTO PARA CAMBIAR TODO) ==========
  // Elegimos un esquema uniforme (ejemplo: fondo oscuro + textos claros)
  const tokens = {
    // Fondo y texto
    '--color-fondo':           marca.negro,
    '--color-texto':           marca.blanco,
    '--color-texto-secundario':marca.gris500,

    // Detalles / superficies / bordes / sombra
    '--color-detalle':         marca.gris900,  // tarjetas / cajas
    '--color-superficie':      '#121417',      // variante sutil
    '--color-borde':           marca.gris800,
    '--color-sombra':          '0 12px 28px rgba(0,0,0,.28)',

    // Marca / enlaces
    '--color-marca':           marca.azul600,
    '--color-marca-2':         marca.azul500,
    '--color-enlace':          marca.azul400,
    '--color-enlace-hover':    marca.azul500,

    // Botones primarios (acción positiva)
    '--color-boton':           marca.azul600,
    '--color-boton-texto':     marca.blanco,
    '--color-boton-hover':     marca.azul500,
    '--color-boton-borde':     'transparent',

    // Header / Footer (si usás fondos dedicados)
    '--color-header-fondo':    marca.negro,
    '--color-header-texto':    marca.blanco,
    '--color-footer-fondo':    marca.tinta,
    '--color-footer-texto':    '#cfe7ef',

    // Radios, contenedores, etc.
    '--radius':                '14px',
    '--ancho-contenedor':      'min(1200px, 94vw)'
  };

  // ====== Motor ======
  function aplicar(obj){
    const root = document.documentElement;
    Object.entries(obj).forEach(([k,v]) => root.style.setProperty(k, v));
  }

  // API pública
  window.Theme = {
    /** Reaplica los tokens por defecto (por si querés resetear) */
    aplicarPorDefecto(){ aplicar(tokens); },
    /** Cambios puntuales por página: Theme.set({'--color-boton':'#123456'}) */
    set(custom){ aplicar(custom); }
  };

  // Aplicamos una vez al cargar
  aplicar(tokens);
})();

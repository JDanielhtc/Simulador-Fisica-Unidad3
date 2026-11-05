/* ============================================================
 * ui.js — Caja de herramientas de interfaz: controles, lienzos,
 * interacción con el puntero, reproductor de animaciones y estado compartido.
 * ============================================================ */
(function (global) {
  'use strict';
  var Sim = global.Sim = global.Sim || {};
  var Num = global.Fisica.Num, Electro = global.Fisica.Electro;
  var UI = Sim.UI = {};

  /** Paleta usada en los lienzos (coincide con las variables CSS). */
  Sim.Color = {
    fondo: '#0c111d', panel: '#151b2b', borde: '#2b3552', texto: '#e8ecf6', suave: '#9aa6c6',
    pos: '#ff6b6b', neg: '#4dabf7', campo: '#d7defa', equi: '#f4c95d', equiNeg: '#8ce99a',
    mag: '#ff9f5a', acento: '#5ee0c1', electrico: '#b197fc', rejilla: 'rgba(255,255,255,0.07)'
  };

  /* ------------------------------------------------------------------ DOM */
  function agregar(e, h) {
    if (h === null || h === undefined || h === false) return;
    if (Array.isArray(h)) { h.forEach(function (x) { agregar(e, x); }); return; }
    if (h.nodeType) e.appendChild(h); else e.appendChild(document.createTextNode(String(h)));
  }
  UI.el = function (tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) agregar(e, arguments[i]);
    return e;
  };
  var el = UI.el;

  UI.vaciar = function (e) { while (e.firstChild) e.removeChild(e.firstChild); };

  /** Texto numérico apto para un campo de entrada (sin ruido de decimales). */
  UI.txtNum = function (x) {
    if (!isFinite(x)) return '';
    if (x === 0) return '0';
    var a = Math.abs(x);
    if (a >= 1e6 || a < 1e-3) return Number(x.toPrecision(6)).toExponential().replace('e+', 'e');
    return String(Number(x.toPrecision(7)));
  };

  UI.panel = function (titulo) {
    var hijos = Array.prototype.slice.call(arguments, 1);
    return el('section', { class: 'panel' }, titulo ? el('h3', null, titulo) : null, hijos);
  };

  UI.boton = function (texto, alClic, clase, titulo) {
    return el('button', { type: 'button', class: 'btn ' + (clase || ''), onclick: alClic, title: titulo || null }, texto);
  };

  /** Deslizador con lectura numérica. o: {etiqueta,min,max,paso,valor,unidad,fmt,log,alCambiar} */
  UI.slider = function (o) {
    var log = !!o.log, val = o.valor;
    function aPos(v) { return log ? Math.round(1000 * Math.log(v / o.min) / Math.log(o.max / o.min)) : v; }
    function dePos(p) { return log ? o.min * Math.pow(o.max / o.min, p / 1000) : parseFloat(p); }
    var entrada = el('input', { type: 'range', min: log ? 0 : o.min, max: log ? 1000 : o.max, step: log ? 1 : (o.paso || 'any'), value: aPos(val), 'aria-label': o.etiqueta });
    var salida = el('span', { class: 'valor' });
    var fmt = o.fmt || function (v) { return Num.fmt(v, 3) + (o.unidad ? ' ' + o.unidad : ''); };
    function pintar() { salida.textContent = fmt(val); }
    entrada.addEventListener('input', function () {
      val = dePos(entrada.value); pintar();
      if (o.alCambiar) o.alCambiar(val);
    });
    pintar();
    var raiz = el('label', { class: 'ctl' }, el('div', { class: 'ctl-cab' }, el('span', null, o.etiqueta), salida), entrada);
    return {
      el: raiz, entrada: entrada,
      get: function () { return val; },
      set: function (v) { val = v; entrada.value = aPos(v); pintar(); },
      activar: function (si) { entrada.disabled = !si; raiz.classList.toggle('desactivado', !si); }
    };
  };

  /** Campo numérico de texto (acepta notación científica). o: {etiqueta,valor,unidad,min,max,alCambiar} */
  UI.num = function (o) {
    var val = o.valor;
    var entrada = el('input', { type: 'text', inputmode: 'decimal', value: UI.txtNum(val), 'aria-label': o.etiqueta || 'valor', class: o.clase || '' });
    function leer() {
      var t = entrada.value.trim().replace(',', '.');
      var v = Number(t);
      var ok = t !== '' && isFinite(v) && (o.min === undefined || v >= o.min) && (o.max === undefined || v <= o.max);
      entrada.classList.toggle('invalido', !ok);
      return ok ? v : null;
    }
    entrada.addEventListener('input', function () {
      var v = leer();
      if (v !== null) { val = v; if (o.alCambiar) o.alCambiar(v); }
    });
    entrada.addEventListener('blur', function () { if (leer() === null) { entrada.value = UI.txtNum(val); entrada.classList.remove('invalido'); } });
    var raiz = o.etiqueta
      ? el('label', { class: 'ctl ctl-num' }, el('span', null, o.etiqueta), el('span', { class: 'ctl-in' }, entrada, o.unidad ? el('span', { class: 'unidad' }, o.unidad) : null))
      : entrada;
    return {
      el: raiz, entrada: entrada,
      get: function () { return val; },
      set: function (v) { val = v; if (document.activeElement !== entrada) entrada.value = UI.txtNum(v); entrada.classList.remove('invalido'); },
      activar: function (si) { entrada.disabled = !si; }
    };
  };

  /** Campo numérico con selector de unidades. unidades: [{t:'µF', f:1e-6}, ...]; valor en unidades SI. */
  UI.numU = function (o) {
    var idx = o.idx || 0, val = o.valor;
    var entrada = el('input', { type: 'text', inputmode: 'decimal', 'aria-label': o.etiqueta });
    var sel = el('select', { 'aria-label': 'unidad de ' + o.etiqueta });
    o.unidades.forEach(function (u, i) { sel.appendChild(el('option', { value: i }, u.t)); });
    sel.value = String(idx);
    function mostrar() { entrada.value = UI.txtNum(val / o.unidades[idx].f); entrada.classList.remove('invalido'); }
    function leer() {
      var t = entrada.value.trim().replace(',', '.'), v = Number(t);
      var ok = t !== '' && isFinite(v) && (o.min === undefined || v * o.unidades[idx].f >= o.min);
      entrada.classList.toggle('invalido', !ok);
      return ok ? v * o.unidades[idx].f : null;
    }
    entrada.addEventListener('input', function () { var v = leer(); if (v !== null) { val = v; if (o.alCambiar) o.alCambiar(v); } });
    entrada.addEventListener('blur', function () { if (leer() === null) mostrar(); });
    sel.addEventListener('change', function () { idx = parseInt(sel.value, 10); val = leer() === null ? val : leer(); if (o.alCambiar) o.alCambiar(val); });
    mostrar();
    var raiz = el('label', { class: 'ctl ctl-num' }, el('span', null, o.etiqueta), el('span', { class: 'ctl-in' }, entrada, sel));
    return {
      el: raiz,
      get: function () { return val; },
      set: function (v) { val = v; mostrar(); },
      valido: function () { return leer() !== null; }
    };
  };

  /** Lista desplegable. opciones: [{v,t}] */
  UI.select = function (o) {
    var sel = el('select', { 'aria-label': o.etiqueta });
    o.opciones.forEach(function (op) { sel.appendChild(el('option', { value: op.v }, op.t)); });
    sel.value = o.valor;
    sel.addEventListener('change', function () { if (o.alCambiar) o.alCambiar(sel.value); });
    return {
      el: el('label', { class: 'ctl' }, el('div', { class: 'ctl-cab' }, el('span', null, o.etiqueta)), sel),
      get: function () { return sel.value; },
      set: function (v) { sel.value = v; },
      select: sel
    };
  };

  UI.check = function (o) {
    var c = el('input', { type: 'checkbox' });
    c.checked = !!o.valor;
    c.addEventListener('change', function () { if (o.alCambiar) o.alCambiar(c.checked); });
    return { el: el('label', { class: 'check' }, c, el('span', null, o.etiqueta)), get: function () { return c.checked; }, set: function (v) { c.checked = !!v; } };
  };

  /** Grupo de botones excluyentes (segmented). opciones: [{v,t}] */
  UI.segmentos = function (o) {
    var val = o.valor, botones = {};
    var raiz = el('div', { class: 'segmentos', role: 'group', 'aria-label': o.etiqueta || '' });
    function pintar() { Object.keys(botones).forEach(function (k) { botones[k].classList.toggle('activo', k === String(val)); botones[k].setAttribute('aria-pressed', k === String(val)); }); }
    o.opciones.forEach(function (op) {
      var b = el('button', { type: 'button', class: 'seg', onclick: function () { val = op.v; pintar(); if (o.alCambiar) o.alCambiar(val); } }, op.t);
      botones[String(op.v)] = b; raiz.appendChild(b);
    });
    pintar();
    return { el: raiz, get: function () { return val; }, set: function (v) { val = v; pintar(); } };
  };

  /** Fila etiqueta/valor para resultados. */
  UI.lectura = function (etiqueta, clase) {
    var v = el('span', { class: 'lec-v' }, '—');
    return {
      el: el('div', { class: 'lectura ' + (clase || '') }, el('span', { class: 'lec-e' }, etiqueta), v),
      set: function (t, estado) { v.textContent = t; v.className = 'lec-v' + (estado ? ' ' + estado : ''); }
    };
  };

  UI.aviso = function () {
    var e = el('div', { class: 'aviso oculto', role: 'status' });
    return {
      el: e,
      poner: function (txt, tipo) { e.textContent = txt || ''; e.className = 'aviso ' + (tipo || 'warn') + (txt ? '' : ' oculto'); },
      limpiar: function () { e.textContent = ''; e.className = 'aviso oculto'; }
    };
  };

  UI.tabla = function (cabeceras, filas, clase) {
    return el('table', { class: 'tabla ' + (clase || '') },
      el('thead', null, el('tr', null, cabeceras.map(function (c) { return el('th', null, c); }))),
      el('tbody', null, filas.map(function (f) { return el('tr', null, f.map(function (c) { return el('td', null, c); })); })));
  };

  /** Mensaje flotante breve (errores inesperados). */
  UI.toast = function (txt, tipo) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = txt; t.className = 'toast ' + (tipo || 'error') + ' visible';
    clearTimeout(UI._tt); UI._tt = setTimeout(function () { t.className = 'toast'; }, 6000);
  };
  UI.error = function (e) { UI.toast('Error interno: ' + (e && e.message ? e.message : e), 'error'); };
  UI.seguro = function (fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { console.error(e); UI.error(e); } }; };

  /* ------------------------------------------------------------------ Lienzo */
  /** Crea un <canvas> que ocupa su contenedor, con soporte HiDPI y redibujado diferido. */
  UI.lienzo = function (caja, dibujar) {
    var canvas = el('canvas', { role: 'img' });
    caja.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var L = { canvas: canvas, ctx: ctx, w: 300, h: 300, dpr: 1, pendiente: false };
    function pintar() {
      L.pendiente = false;
      try {
        ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
        ctx.clearRect(0, 0, L.w, L.h);
        dibujar(ctx, L.w, L.h);
      } catch (e) { console.error(e); UI.error(e); }
    }
    L.pedir = function () { if (L.pendiente) return; L.pendiente = true; requestAnimationFrame(pintar); };
    L.ahora = pintar;
    function ajustar() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      var w = Math.max(50, Math.round(r.width)), h = Math.max(50, Math.round(r.height));
      if (w === L.w && h === L.h && dpr === L.dpr && canvas.width === Math.round(w * dpr)) return;
      L.w = w; L.h = h; L.dpr = dpr;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      if (L.alRedimensionar) L.alRedimensionar(w, h);
      L.pedir();
    }
    if ('ResizeObserver' in global) new ResizeObserver(ajustar).observe(canvas);
    else global.addEventListener('resize', ajustar);
    setTimeout(ajustar, 0);
    return L;
  };

  /** Eventos de puntero unificados (ratón y táctil). Las coordenadas son relativas al lienzo. */
  UI.punteros = function (canvas, h) {
    var activo = false, ult = null;
    function pos(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', function (e) {
      var p = pos(e);
      if (h.abajo && h.abajo(p[0], p[1], e) === false) return;
      activo = true; ult = p;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = pos(e);
      if (activo) { if (h.mover) h.mover(p[0], p[1], p[0] - ult[0], p[1] - ult[1], e); ult = p; }
      else if (h.pasar) h.pasar(p[0], p[1], e);
    });
    function fin(e) { if (!activo) return; activo = false; if (h.arriba) h.arriba(e); }
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    canvas.addEventListener('pointerleave', function (e) { if (!activo && h.salir) h.salir(e); });
    if (h.rueda) canvas.addEventListener('wheel', function (e) { e.preventDefault(); h.rueda(e.deltaY, e); }, { passive: false });
  };

  UI.descargarPNG = function (lienzo, nombre) {
    try {
      var a = el('a', { href: lienzo.canvas.toDataURL('image/png'), download: (nombre || 'simulacion') + '.png' });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { UI.error(e); }
  };

  /** Contenedor estándar de lienzo con altura definida por CSS. */
  UI.cajaLienzo = function (clase) { return el('div', { class: 'caja-lienzo ' + (clase || '') }); };

  /* ------------------------------------------------------------------ Reproductor de trayectorias */
  UI.reproductor = function (alFrame, duracion) {
    var R = { frac: 0, activo: false, vel: 1, duracion: duracion || 8, bucle: false, alTerminar: null };
    var ultimo = 0, id = 0;
    function paso(ts) {
      if (!R.activo) return;
      if (!ultimo) ultimo = ts;
      var dt = Math.min(0.1, (ts - ultimo) / 1000); ultimo = ts;
      R.frac += dt * R.vel / R.duracion;
      if (R.frac >= 1) { if (R.bucle) R.frac = 0; else { R.frac = 1; R.activo = false; } }
      try { alFrame(R.frac); } catch (e) { console.error(e); UI.error(e); R.activo = false; }
      if (R.activo) id = requestAnimationFrame(paso); else if (R.alTerminar) R.alTerminar();
    }
    R.iniciar = function () { if (R.frac >= 1) R.frac = 0; R.activo = true; ultimo = 0; cancelAnimationFrame(id); id = requestAnimationFrame(paso); };
    R.pausar = function () { R.activo = false; cancelAnimationFrame(id); };
    R.reiniciar = function () { R.pausar(); R.frac = 0; alFrame(0); };
    R.poner = function (f) { R.frac = Num.limitar(f, 0, 1); alFrame(R.frac); };
    return R;
  };

  /** Estado (t, r, v) de una trayectoria { t, r, v } para una fracción 0..1 del tiempo total (interpolación lineal). */
  UI.muestrear = function (s, frac) {
    var n = s.t.length;
    if (n === 1) return { t: 0, r: s.r[0], v: s.v[0], i: 0 };
    var T = s.t[n - 1] * Num.limitar(frac, 0, 1), lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (s.t[m] <= T) lo = m; else hi = m; }
    var d = s.t[hi] - s.t[lo], u = d > 0 ? (T - s.t[lo]) / d : 0;
    function mez(a, b) { return [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]), a[2] + u * (b[2] - a[2])]; }
    return { t: T, r: mez(s.r[lo], s.r[hi]), v: mez(s.v[lo], s.v[hi]), i: lo };
  };

  /* ------------------------------------------------------------------ Dibujo auxiliar */
  UI.flecha = function (ctx, x1, y1, x2, y2, color, ancho, cab) {
    var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 1) return;
    cab = cab || 8;
    var ux = dx / L, uy = dy / L;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho || 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * cab * 0.6, y2 - uy * cab * 0.6); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * cab + uy * cab * 0.45, y2 - uy * cab - ux * cab * 0.45);
    ctx.lineTo(x2 - ux * cab - uy * cab * 0.45, y2 - uy * cab + ux * cab * 0.45);
    ctx.closePath(); ctx.fill();
  };

  UI.texto = function (ctx, txt, x, y, color, tam, alin, base) {
    ctx.fillStyle = color || Sim.Color.texto;
    ctx.font = (tam || 12) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = alin || 'left'; ctx.textBaseline = base || 'alphabetic';
    ctx.fillText(txt, x, y);
  };

  /** Carga puntual dibujada como esfera con signo. */
  UI.dibujarCarga = function (ctx, x, y, q, radio, resaltar) {
    var c = q > 0 ? Sim.Color.pos : q < 0 ? Sim.Color.neg : '#888';
    var g = ctx.createRadialGradient(x - radio * 0.35, y - radio * 0.35, radio * 0.1, x, y, radio);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, c); g.addColorStop(1, q > 0 ? '#8f1f2c' : q < 0 ? '#1b4b8a' : '#444');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, radio, 0, 2 * Math.PI); ctx.fill();
    if (resaltar) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, radio * 0.14); ctx.lineCap = 'round';
    var s = radio * 0.45;
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
    if (q > 0) { ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); }
    ctx.stroke();
  };

  /** Mapa de color divergente (negativo azul, cero oscuro, positivo rojo). t en [-1,1]. */
  UI.colorDiv = function (t) {
    var a = Math.min(1, Math.abs(t));
    var base = [14, 20, 34], r = t >= 0 ? [255, 107, 107] : [77, 171, 247];
    var k = Math.pow(a, 0.8);
    return [Math.round(base[0] + (r[0] - base[0]) * k), Math.round(base[1] + (r[1] - base[1]) * k), Math.round(base[2] + (r[2] - base[2]) * k)];
  };

  /** Escala secuencial para intensidad (oscuro → ámbar → blanco). t en [0,1]. */
  UI.colorSeq = function (t) {
    t = Num.limitar(t, 0, 1);
    var c0 = [14, 20, 34], c1 = [255, 159, 90], c2 = [255, 244, 214];
    var u = t < 0.6 ? t / 0.6 : (t - 0.6) / 0.4, a = t < 0.6 ? c0 : c1, b = t < 0.6 ? c1 : c2;
    return [Math.round(a[0] + (b[0] - a[0]) * u), Math.round(a[1] + (b[1] - a[1]) * u), Math.round(a[2] + (b[2] - a[2]) * u)];
  };

  /* ------------------------------------------------------------------ Estado compartido de cargas (Unidad 1) */
  var Estado = Sim.Estado = {
    cargas: [{ x: -1, y: 0, z: 0, q: 2e-9 }, { x: 1, y: 0, z: 0, q: -2e-9 }],
    _susc: [],
    suscribir: function (fn) { this._susc.push(fn); },
    emitir: function (origen) { this._susc.forEach(function (fn) { try { fn(origen); } catch (e) { console.error(e); UI.error(e); } }); },
    ESCENAS: {
      dipolo: { t: 'Dipolo (+2 nC / −2 nC)', c: function () { return [{ x: -1, y: 0, z: 0, q: 2e-9 }, { x: 1, y: 0, z: 0, q: -2e-9 }]; } },
      iguales: { t: 'Dos cargas positivas', c: function () { return [{ x: -1, y: 0, z: 0, q: 2e-9 }, { x: 1, y: 0, z: 0, q: 2e-9 }]; } },
      unica: { t: 'Una carga puntual', c: function () { return [{ x: 0, y: 0, z: 0, q: 2e-9 }]; } },
      asimetrico: { t: 'Cargas desiguales (+4 nC / −1 nC)', c: function () { return [{ x: -1, y: 0, z: 0, q: 4e-9 }, { x: 1, y: 0, z: 0, q: -1e-9 }]; } },
      lineal: { t: 'Tres cargas en línea (+, −, +)', c: function () { return [{ x: -1.5, y: 0, z: 0, q: 2e-9 }, { x: 0, y: 0, z: 0, q: -4e-9 }, { x: 1.5, y: 0, z: 0, q: 2e-9 }]; } },
      cuadrupolo: { t: 'Cuadrupolo (4 cargas)', c: function () { return [{ x: -1, y: -1, z: 0, q: 2e-9 }, { x: 1, y: -1, z: 0, q: -2e-9 }, { x: 1, y: 1, z: 0, q: 2e-9 }, { x: -1, y: 1, z: 0, q: -2e-9 }]; } },
      triangulo: { t: 'Triángulo (+, +, −) en 3D', c: function () { return [{ x: -1.2, y: -0.8, z: 0.6, q: 2e-9 }, { x: 1.2, y: -0.8, z: -0.6, q: 2e-9 }, { x: 0, y: 1.2, z: 0, q: -3e-9 }]; } }
    },
    cargarEscena: function (id) {
      var e = this.ESCENAS[id]; if (!e) return;
      this.cargas.length = 0;
      e.c().forEach(function (c) { Estado.cargas.push(c); });
      this.emitir('escena');
    },
    posicionLibre: function () {
      var cand = [[0, 0, 0], [0, 1.5, 0], [0, -1.5, 0], [2, 1.5, 0], [-2, 1.5, 0], [2, -1.5, 0], [-2, -1.5, 0], [0, 2.4, 0], [0, -2.4, 0], [2.6, 0, 0], [-2.6, 0, 0], [1, 2, 1], [-1, -2, -1]];
      for (var i = 0; i < cand.length; i++) {
        var ok = true;
        for (var j = 0; j < this.cargas.length; j++) {
          var c = this.cargas[j];
          if (Math.hypot(c.x - cand[i][0], c.y - cand[i][1], c.z - cand[i][2]) < 0.4) { ok = false; break; }
        }
        if (ok) return cand[i];
      }
      return [Math.random() * 4 - 2, Math.random() * 4 - 2, 0];
    }
  };

  /** Editor de la lista de cargas (compartido por varios módulos). */
  UI.listaCargas = function (opciones) {
    opciones = opciones || {};
    var raiz = el('div', { class: 'lista-cargas' });
    var filas = el('div', { class: 'cargas-filas' });
    var btnAdd = UI.boton('+ Agregar carga', function () {
      if (Estado.cargas.length >= Electro.MAX_CARGAS) return;
      var p = Estado.posicionLibre();
      Estado.cargas.push({ x: p[0], y: p[1], z: p[2], q: 1e-9 });
      Estado.emitir('lista'); reconstruir();
    }, 'btn-sec');
    var cont = el('span', { class: 'suave' });
    var sel = UI.select({
      etiqueta: 'Escena predefinida', valor: 'dipolo',
      opciones: Object.keys(Estado.ESCENAS).map(function (k) { return { v: k, t: Estado.ESCENAS[k].t }; }),
      alCambiar: function (v) { Estado.cargarEscena(v); }
    });
    var avisoErr = UI.aviso();
    raiz.appendChild(sel.el);
    raiz.appendChild(el('div', { class: 'cargas-cab' }, el('span'), el('span', null, 'x (m)'), el('span', null, 'y (m)'), el('span', null, 'z (m)'), el('span', null, 'q (nC)'), el('span')));
    raiz.appendChild(filas);
    raiz.appendChild(el('div', { class: 'fila-botones' }, btnAdd, cont));
    raiz.appendChild(avisoErr.el);
    var campos = [];

    function reconstruir() {
      UI.vaciar(filas); campos = [];
      Estado.cargas.forEach(function (c, i) {
        var punto = el('span', { class: 'punto-carga' });
        var cx = UI.num({ valor: c.x, clase: 'chico', alCambiar: function (v) { c.x = v; cambio(); } });
        var cy = UI.num({ valor: c.y, clase: 'chico', alCambiar: function (v) { c.y = v; cambio(); } });
        var cz = UI.num({ valor: c.z, clase: 'chico', alCambiar: function (v) { c.z = v; cambio(); } });
        var cq = UI.num({ valor: c.q * 1e9, clase: 'chico', alCambiar: function (v) { c.q = v * 1e-9; pintarPunto(); cambio(); } });
        function pintarPunto() { punto.style.background = c.q > 0 ? Sim.Color.pos : c.q < 0 ? Sim.Color.neg : '#888'; punto.textContent = c.q > 0 ? '+' : c.q < 0 ? '−' : '0'; }
        pintarPunto();
        var del = el('button', { type: 'button', class: 'btn-x', title: 'Eliminar carga ' + (i + 1), 'aria-label': 'Eliminar carga ' + (i + 1), onclick: function () { Estado.cargas.splice(i, 1); Estado.emitir('lista'); reconstruir(); } }, '✕');
        filas.appendChild(el('div', { class: 'carga-fila' }, punto, cx.el, cy.el, cz.el, cq.el, del));
        campos.push({ cx: cx, cy: cy, cz: cz, cq: cq, pintar: pintarPunto });
      });
      btnAdd.disabled = Estado.cargas.length >= Electro.MAX_CARGAS;
      cont.textContent = Estado.cargas.length + ' / ' + Electro.MAX_CARGAS + ' cargas';
      validar();
    }
    function validar() { avisoErr.poner(Electro.validar(Estado.cargas) || '', 'error'); }
    function cambio() { validar(); Estado.emitir('lista'); }
    function refrescar() {
      if (campos.length !== Estado.cargas.length) { reconstruir(); return; }
      Estado.cargas.forEach(function (c, i) { var f = campos[i]; f.cx.set(c.x); f.cy.set(c.y); f.cz.set(c.z); f.cq.set(c.q * 1e9); f.pintar(); });
      validar();
    }
    Estado.suscribir(function (origen) { if (origen !== 'lista') refrescar(); else validar(); });
    reconstruir();
    return { el: raiz, refrescar: refrescar };
  };

})(window);

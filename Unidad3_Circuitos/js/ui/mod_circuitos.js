/* ============================================================
 * mod_circuitos.js — Unidad 3 · Ley de Ohm y analizador de circuitos
 * ============================================================ */
(function (global) {
  'use strict';
  var Sim = global.Sim, UI = Sim.UI, el = UI.el, C = Sim.Color;
  var Circ = global.Fisica.Circ, Num = global.Fisica.Num;
  Sim.Modulos = Sim.Modulos || {};

  /* ======================= Ley de Ohm ======================= */
  Sim.Modulos.ohm = {
    id: 'ohm', unidad: 3, titulo: 'Ley de Ohm',
    resumen: 'Relaciona V, I, R y P; calcula la resistencia de un conductor a partir de su geometría.',
    crear: function (cont) {
      var cfg = { V: 12, R: 100, modo: 'VR', I: 0.12, mat: 'cu', L: 10, d: 1e-3 };
      var aviso = UI.aviso(), lienzo, st = null;
      var U_R = [{ t: 'Ω', f: 1 }, { t: 'kΩ', f: 1e3 }, { t: 'MΩ', f: 1e6 }, { t: 'mΩ', f: 1e-3 }];
      var U_I = [{ t: 'mA', f: 1e-3 }, { t: 'A', f: 1 }, { t: 'µA', f: 1e-6 }];
      var segM = UI.segmentos({ etiqueta: 'Datos conocidos', valor: 'VR', opciones: [{ v: 'VR', t: 'V y R' }, { v: 'VI', t: 'V e I' }, { v: 'IR', t: 'I y R' }], alCambiar: function (v) { cfg.modo = v; actualizarCampos(); calcular(); } });
      var vIn = UI.num({ etiqueta: 'Tensión V', valor: cfg.V, unidad: 'V', alCambiar: function (v) { cfg.V = v; calcular(); } });
      var rIn = UI.numU({ etiqueta: 'Resistencia R', valor: cfg.R, unidades: U_R, min: 1e-9, alCambiar: function (v) { cfg.R = v; calcular(); } });
      var iIn = UI.numU({ etiqueta: 'Corriente I', valor: cfg.I, unidades: U_I, alCambiar: function (v) { cfg.I = v; calcular(); } });
      function actualizarCampos() { vIn.el.style.display = cfg.modo === 'IR' ? 'none' : ''; rIn.el.style.display = cfg.modo === 'VI' ? 'none' : ''; iIn.el.style.display = cfg.modo === 'VR' ? 'none' : ''; }
      var selMat = UI.select({ etiqueta: 'Material del conductor', valor: 'cu', opciones: Circ.RESISTIVIDADES.map(function (m) { return { v: m.id, t: m.nombre + ' (ρ = ' + m.rho + ' Ω·m)' }; }), alCambiar: function (v) { cfg.mat = v; geometria(); } });
      var lIn = UI.num({ etiqueta: 'Longitud L', valor: cfg.L, unidad: 'm', min: 1e-9, alCambiar: function (v) { cfg.L = v; geometria(); } });
      var dIn = UI.num({ etiqueta: 'Diámetro del hilo', valor: cfg.d * 1e3, unidad: 'mm', min: 1e-9, alCambiar: function (v) { cfg.d = v * 1e-3; geometria(); } });
      var rGeo = UI.lectura('R = ρ L / A'), bUsar = UI.boton('Usar esta R en la ley de Ohm', function () { var m = mat(); var R = Circ.resistenciaGeometrica(m.rho, cfg.L, Math.PI * cfg.d * cfg.d / 4); cfg.R = R; rIn.set(R); segM.set('VR'); cfg.modo = 'VR'; actualizarCampos(); calcular(); }, 'btn-sec');
      function mat() { return Circ.RESISTIVIDADES.filter(function (m) { return m.id === cfg.mat; })[0]; }
      function geometria() { if (!(cfg.L > 0) || !(cfg.d > 0)) { rGeo.set('—'); return; } rGeo.set(Num.fmtSI(Circ.resistenciaGeometrica(mat().rho, cfg.L, Math.PI * cfg.d * cfg.d / 4), 'Ω', 4)); }
      var controles = el('div', { class: 'controles' }, UI.panel('Ley de Ohm  V = I R', segM.el, vIn.el, rIn.el, iIn.el, aviso.el), UI.panel('Resistencia de un conductor', selMat.el, lIn.el, dIn.el, rGeo.el, bUsar));
      var rV = UI.lectura('Tensión V', 'grande'), rI = UI.lectura('Corriente I', 'grande'), rR = UI.lectura('Resistencia R', 'grande'), rP = UI.lectura('Potencia P = V I', 'grande'), rE = UI.lectura('Energía disipada en 1 hora');
      var caja = UI.cajaLienzo();
      cont.appendChild(el('div', { class: 'modulo-grid' }, controles, el('div', { class: 'escena' }, caja, el('div', { class: 'resultados dos-col' }, rV.el, rI.el, rR.el, rP.el, rE.el),
        el('p', { class: 'formula' }, 'V = I R   ·   P = V I = I² R = V² / R   ·   R = ρ L / A'))));
      function calcular() {
        var V, I, R;
        if (cfg.modo === 'VR') { V = cfg.V; R = cfg.R; if (!(R > 0)) { aviso.poner('La resistencia debe ser positiva.', 'error'); return; } I = V / R; }
        else if (cfg.modo === 'VI') { V = cfg.V; I = cfg.I; if (I === 0) { aviso.poner('Con I = 0 la resistencia no está definida (circuito abierto).', 'error'); return; } R = V / I; if (R < 0) { aviso.poner('V e I tienen signos opuestos: R sería negativa. Revisa los datos.', 'error'); return; } }
        else { I = cfg.I; R = cfg.R; if (!(R > 0)) { aviso.poner('La resistencia debe ser positiva.', 'error'); return; } V = I * R; }
        aviso.limpiar(); st = { V: V, I: I, R: R, P: V * I };
        rV.set(Num.fmtSI(V, 'V', 4)); rI.set(Num.fmtSI(I, 'A', 4)); rR.set(Num.fmtSI(R, 'Ω', 4)); rP.set(Num.fmtSI(Math.abs(st.P), 'W', 4)); rE.set(Num.fmtSI(Math.abs(st.P) * 3600, 'J', 4) + '  (' + Num.fmt(Math.abs(st.P) * 3600 / 3.6e6, 3) + ' kWh)');
        lienzo.pedir();
      }
      lienzo = UI.lienzo(caja, function (ctx, w, h) {
        ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, w, h); if (!st) return;
        var Vm = Math.max(Math.abs(st.V) * 1.6, 1e-9), xs = [], ys = [];
        for (var i = 0; i <= 100; i++) { var v = Vm * i / 100; xs.push(v); ys.push(v / st.R); }
        Sim.Grafica.dibujar(ctx, w, h, { titulo: 'Característica I–V del resistor (pendiente = 1/R)', xlab: 'V (V)', ylab: 'I (A)', series: [{ x: xs, y: ys, color: C.acento }],
          puntos: [{ x: Math.abs(st.V), y: Math.abs(st.I), etiqueta: 'P = ' + Num.fmtSI(Math.abs(st.P), 'W', 3) }], fmtY: function (v) { return Num.fmtSI(v, '', 2); } });
      });
      actualizarCampos(); geometria(); calcular();
      return { activar: function () { lienzo.pedir(); }, desactivar: function () { } };
    }
  };

  /* ======================= Analizador de circuitos ======================= */
  var U_RES = [{ t: 'Ω', f: 1 }, { t: 'kΩ', f: 1e3 }, { t: 'MΩ', f: 1e6 }];
  var U_CAP = [{ t: 'µF', f: 1e-6 }, { t: 'nF', f: 1e-9 }, { t: 'pF', f: 1e-12 }, { t: 'mF', f: 1e-3 }];

  Sim.Modulos.circuitos = {
    id: 'circuitos', unidad: 3, titulo: 'Analizador de circuitos',
    resumen: 'Resuelve redes serie/paralelo (con capacitores) y circuitos generales por análisis nodal.',
    crear: function (cont) {
      var modo = 'arbol';
      var seg = UI.segmentos({ etiqueta: 'Método', valor: 'arbol', opciones: [{ v: 'arbol', t: 'Serie / paralelo' }, { v: 'mna', t: 'Red general (netlist)' }], alCambiar: function (v) { modo = v; pA.style.display = v === 'arbol' ? '' : 'none'; pB.style.display = v === 'mna' ? '' : 'none'; } });
      var pA = el('div'), pB = el('div'); pB.style.display = 'none';
      cont.appendChild(el('div', { class: 'barra-modo' }, seg.el)); cont.appendChild(pA); cont.appendChild(pB);

      /* ---------- Árbol serie/paralelo ---------- */
      (function () {
        var circ = { fem: 12, rInt: 0, red: { tipo: 'serie', hijos: [{ tipo: 'R', valor: 100 }, { tipo: 'paralelo', hijos: [{ tipo: 'R', valor: 200 }, { tipo: 'R', valor: 300 }] }] } };
        var aviso = UI.aviso(), arbolCaja = el('div', { class: 'arbol' }), tablaCaja = el('div', { class: 'tabla-caja' }), caja = UI.cajaLienzo('baja'), lienzo, anal = null;
        var fIn = UI.num({ etiqueta: 'Fuente (fem) ε', valor: 12, unidad: 'V', min: 0, alCambiar: function (v) { circ.fem = v; calcular(); } });
        var riIn = UI.num({ etiqueta: 'Resistencia interna r', valor: 0, unidad: 'Ω', min: 0, alCambiar: function (v) { circ.rInt = v; calcular(); } });
        var ej = UI.select({ etiqueta: 'Ejemplos', valor: 'mixto', opciones: [{ v: 'mixto', t: 'R en serie con dos R en paralelo' }, { v: 'serie', t: 'Tres resistencias en serie' }, { v: 'par', t: 'Tres resistencias en paralelo' }, { v: 'cap', t: 'Divisor capacitivo (2 C en serie)' }, { v: 'rc', t: 'Resistencia con capacitor en paralelo' }],
          alCambiar: function (v) { var R = function (x) { return { tipo: 'R', valor: x }; }, Cc = function (x) { return { tipo: 'C', valor: x }; };
            circ.red = v === 'serie' ? { tipo: 'serie', hijos: [R(100), R(220), R(330)] } : v === 'par' ? { tipo: 'paralelo', hijos: [R(100), R(200), R(300)] } : v === 'cap' ? { tipo: 'serie', hijos: [Cc(2e-6), Cc(4e-6)] } : v === 'rc' ? { tipo: 'serie', hijos: [R(100), { tipo: 'paralelo', hijos: [R(200), Cc(1e-6)] }] } : { tipo: 'serie', hijos: [R(100), { tipo: 'paralelo', hijos: [R(200), R(300)] }] };
            dibujarArbol(); calcular(); } });
        var panel = el('div', { class: 'controles' }, UI.panel('Fuente', fIn.el, riIn.el), UI.panel('Red de elementos', ej.el, el('p', { class: 'suave' }, 'Cada grupo es una conexión en serie o en paralelo; puedes anidar grupos.'), arbolCaja), aviso.el);
        var rI = UI.lectura('Corriente total I', 'grande'), rVt = UI.lectura('Tensión en terminales', 'grande'), rReq = UI.lectura('Resistencia equivalente'), rPf = UI.lectura('Potencia de la fuente'), rPd = UI.lectura('Potencia disipada en R'), rPi = UI.lectura('Pérdida en r interna'), rBal = UI.lectura('Balance de potencia');
        var res = el('div', { class: 'resultados dos-col' }, rI.el, rVt.el, rReq.el, rPf.el, rPd.el, rPi.el, rBal.el);
        pA.appendChild(el('div', { class: 'modulo-grid' }, panel, el('div', { class: 'escena' }, res, tablaCaja, caja, el('p', { class: 'formula' }, 'Serie: R = ΣRᵢ (misma I) · Paralelo: 1/R = Σ1/Rᵢ (misma V) · En CC un capacitor es un circuito abierto'))));

        function dibujarArbol() { UI.vaciar(arbolCaja); arbolCaja.appendChild(nodoUI(circ.red, function (n) { circ.red = n; dibujarArbol(); calcular(); }, true)); }
        function nodoUI(n, reemplazar, raiz) {
          if (n.tipo === 'R' || n.tipo === 'C') {
            var f = UI.numU({ etiqueta: n.tipo === 'R' ? 'Resistencia' : 'Capacitor', valor: n.valor, unidades: n.tipo === 'R' ? U_RES : U_CAP, min: 1e-15, alCambiar: function (v) { n.valor = v; calcular(); } });
            var tipoSel = el('select', { 'aria-label': 'Tipo de elemento' }, el('option', { value: 'R' }, 'R'), el('option', { value: 'C' }, 'C')); tipoSel.value = n.tipo;
            tipoSel.addEventListener('change', function () { n.tipo = tipoSel.value; n.valor = n.tipo === 'R' ? 100 : 1e-6; dibujarArbol(); calcular(); });
            var fila = el('div', { class: 'nodo hoja' }, tipoSel, f.el);
            if (!raiz) { /* la eliminación la maneja el grupo */ }
            return fila;
          }
          var caja2 = el('div', { class: 'nodo grupo ' + n.tipo }, el('div', { class: 'grupo-cab' }, el('strong', null, n.tipo === 'serie' ? 'En serie' : 'En paralelo'),
            UI.boton('+ R', function () { n.hijos.push({ tipo: 'R', valor: 100 }); dibujarArbol(); calcular(); }, 'btn-mini'),
            UI.boton('+ C', function () { n.hijos.push({ tipo: 'C', valor: 1e-6 }); dibujarArbol(); calcular(); }, 'btn-mini'),
            UI.boton('+ grupo', function () { n.hijos.push({ tipo: n.tipo === 'serie' ? 'paralelo' : 'serie', hijos: [{ tipo: 'R', valor: 100 }, { tipo: 'R', valor: 100 }] }); dibujarArbol(); calcular(); }, 'btn-mini'),
            UI.boton('⇄', function () { n.tipo = n.tipo === 'serie' ? 'paralelo' : 'serie'; dibujarArbol(); calcular(); }, 'btn-mini', 'Cambiar entre serie y paralelo')));
          n.hijos.forEach(function (h, i) {
            var fila = el('div', { class: 'hijo' }, nodoUI(h, function (x) { n.hijos[i] = x; }, false),
              el('button', { type: 'button', class: 'btn-x', 'aria-label': 'Quitar elemento', onclick: function () { if (n.hijos.length > 1 || !raiz) { n.hijos.splice(i, 1); dibujarArbol(); calcular(); } } }, '✕'));
            caja2.appendChild(fila);
          });
          return caja2;
        }
        function listarHojas(n, a, ruta) { if (n.tipo === 'R' || n.tipo === 'C') a.push({ n: n, ruta: ruta }); else n.hijos.forEach(function (h, i) { listarHojas(h, a, ruta + '.' + (i + 1)); }); return a; }
        function hojasAnot(n, a) { if (n.tipo === 'R' || n.tipo === 'C') a.push(n); else n.hijos.forEach(function (h) { hojasAnot(h, a); }); return a; }

        function calcular() {
          var r = Circ.analizar(circ);
          if (r.error) { aviso.poner(r.error, 'error'); anal = null; [rI, rVt, rReq, rPf, rPd, rPi, rBal].forEach(function (x) { x.set('—'); }); UI.vaciar(tablaCaja); lienzo && lienzo.pedir(); return; }
          if (!(circ.fem >= 0) || !(circ.rInt >= 0)) { aviso.poner('ε y r deben ser no negativas.', 'error'); return; }
          aviso.limpiar(); anal = r;
          rI.set(Num.fmtSI(r.I, 'A', 4)); rVt.set(Num.fmtSI(r.Vterminal, 'V', 4)); rReq.set(r.Req === Infinity ? '∞ (circuito abierto en CC)' : Num.fmtSI(r.Req, 'Ω', 4));
          rPf.set(Num.fmtSI(r.Pfuente, 'W', 4)); rPd.set(Num.fmtSI(r.Pdisipada, 'W', 4)); rPi.set(Num.fmtSI(r.Pinterna, 'W', 3));
          var dif = Math.abs(r.Pfuente - r.Pdisipada - r.Pinterna); rBal.set(dif < 1e-9 * (Math.abs(r.Pfuente) + 1e-30) ? 'P fuente = P disipada + P interna ✔' : 'desbalance ' + Num.fmt(dif, 3) + ' W', dif < 1e-9 * (Math.abs(r.Pfuente) + 1e-30) ? 'ok' : 'mal');
          var nr = 0, nc = 0, filas = hojasAnot(r.red, []).map(function (h) {
            var nombre = h.tipo === 'R' ? 'R' + (++nr) : 'C' + (++nc);
            return h.tipo === 'R' ? [nombre, Num.fmtSI(h.valor, 'Ω', 3), Num.fmtSI(h.V, 'V', 3), Num.fmtSI(h.I, 'A', 3), Num.fmtSI(h.P, 'W', 3)] : [nombre, Num.fmtSI(h.valor, 'F', 3), Num.fmtSI(h.V, 'V', 3), '0 (CC)', 'Q = ' + Num.fmtSI(h.Q, 'C', 3)];
          });
          UI.vaciar(tablaCaja); tablaCaja.appendChild(UI.tabla(['Elemento', 'Valor', 'V', 'I', 'P / Q'], filas));
          lienzo && lienzo.pedir();
        }
        lienzo = UI.lienzo(caja, function (ctx, w, h) {
          ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, w, h); if (!anal) return;
          var hs = hojasAnot(anal.red, []), n = hs.length, mg = 50, bw = (w - 2 * mg) / n, Pm = 0, nr = 0, nc = 0;
          UI.texto(ctx, 'Tensión en cada elemento', mg, 18, C.texto, 13);
          var Vm = Math.max.apply(null, hs.map(function (x) { return Math.abs(x.V); }).concat([1e-12]));
          hs.forEach(function (x, j) {
            var hh = (h - 90) * Math.abs(x.V) / Vm, xx = mg + j * bw + bw * 0.2;
            ctx.fillStyle = x.tipo === 'R' ? C.acento : C.electrico; ctx.fillRect(xx, h - 42 - hh, bw * 0.6, hh);
            UI.texto(ctx, x.tipo === 'R' ? 'R' + (++nr) : 'C' + (++nc), xx + bw * 0.3, h - 24, C.suave, 12, 'center');
            UI.texto(ctx, Num.fmtSI(x.V, 'V', 3), xx + bw * 0.3, h - 48 - hh, C.texto, 11, 'center');
          });
        });
        dibujarArbol(); calcular();
      })();

      /* ---------- MNA ---------- */
      (function () {
        var ejemplo = '* Puente de Wheatstone con fuente de 10 V\nV1 1 0 10\nR1 1 2 100\nR2 2 0 200\nR3 1 3 150\nR4 3 0 300\nR5 2 3 470';
        var ta = el('textarea', { rows: 12, spellcheck: 'false', 'aria-label': 'Descripción del circuito' }, ejemplo);
        var aviso = UI.aviso(), tablaCaja = el('div', { class: 'tabla-caja' }), tablaNodos = el('div', { class: 'tabla-caja' });
        var bRes = UI.boton('Resolver circuito', function () { resolver(); }, 'btn-prim');
        var ej2 = UI.select({ etiqueta: 'Ejemplos', valor: 'wheat', opciones: [{ v: 'wheat', t: 'Puente de Wheatstone' }, { v: 'dos', t: 'Dos fuentes de tensión' }, { v: 'corr', t: 'Fuente de corriente' }],
          alCambiar: function (v) { ta.value = v === 'wheat' ? ejemplo : v === 'dos' ? '* Dos baterías alimentan un nodo común\nV1 1 0 10\nV2 3 0 4\nR1 1 2 100\nR2 2 3 100\nR3 2 0 100' : '* 10 mA entran al nodo 1\nI1 0 1 0.01\nR1 1 0 500\nR2 1 2 300\nR3 2 0 200'; resolver(); } });
        var ayuda = el('p', { class: 'suave' }, 'Una línea por elemento: NOMBRE nodoA nodoB valor. Tipos: R (Ω), V (fuente, + en A), I (de A hacia B), C (circuito abierto en CC). El nodo 0 es tierra. Las líneas que empiezan con * son comentarios.');
        pB.appendChild(el('div', { class: 'modulo-grid' }, el('div', { class: 'controles' }, UI.panel('Circuito (formato tipo SPICE)', ej2.el, ta, bRes, ayuda, aviso.el)), el('div', { class: 'escena' }, tablaNodos, tablaCaja, el('p', { class: 'formula' }, 'Análisis nodal modificado: G·v = i  (leyes de Kirchhoff de corrientes en cada nodo)'))));
        function resolver() {
          var p = Circ.parsearNetlist(ta.value);
          if (p.error) { aviso.poner(p.error, 'error'); UI.vaciar(tablaCaja); UI.vaciar(tablaNodos); return; }
          var r = Circ.resolverMNA(p.elementos);
          if (r.error) { aviso.poner(r.error, 'error'); UI.vaciar(tablaCaja); UI.vaciar(tablaNodos); return; }
          aviso.limpiar();
          UI.vaciar(tablaNodos); UI.vaciar(tablaCaja);
          var nodos = Object.keys(r.V).sort(function (a, b) { return a === '0' ? -1 : b === '0' ? 1 : (isNaN(a) || isNaN(b)) ? a.localeCompare(b) : a - b; });
          tablaNodos.appendChild(UI.tabla(['Nodo', 'Tensión respecto a tierra'], nodos.map(function (n) { return [n === '0' ? '0 (tierra)' : n, Num.fmtSI(r.V[n], 'V', 4)]; })));
          tablaCaja.appendChild(UI.tabla(['Elemento', 'Nodos', 'Valor', 'V entre A y B', 'Corriente', 'Potencia'], r.elementos.map(function (e) {
            var u = e.tipo === 'R' ? 'Ω' : e.tipo === 'V' ? 'V' : e.tipo === 'I' ? 'A' : 'F';
            var pot = e.tipo === 'V' ? Num.fmtSI(e.P, 'W', 3) + (e.P > 0 ? ' (entrega)' : ' (absorbe)') : e.tipo === 'I' ? Num.fmtSI(e.P, 'W', 3) : Num.fmtSI(e.P, 'W', 3);
            return [e.nombre, e.a + ' → ' + e.b, Num.fmtSI(e.valor, u, 3), Num.fmtSI(e.V, 'V', 3), e.tipo === 'C' ? '0 (CC)' : Num.fmtSI(e.I, 'A', 3), e.tipo === 'C' ? '—' : pot];
          })));
        }
        resolver();
      })();

      return { activar: function () { }, desactivar: function () { } };
    }
  };
})(window);

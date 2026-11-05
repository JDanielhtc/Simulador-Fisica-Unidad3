/* ============================================================
 * circuits.js — Unidad 3: ley de Ohm y circuitos
 *  - Reducción de árboles serie/paralelo (resistencias y capacitores en CC)
 *  - Análisis nodal modificado (MNA) para redes generales con varias fuentes
 * ============================================================ */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('./core.js') : root.Fisica);
  if (isNode) { module.exports = api; }
  else { root.Fisica = Object.assign(root.Fisica || {}, api); }
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';
  var Num = F.Num;
  var Circ = {};

  /* ---------- Ley de Ohm ---------- */
  Circ.ohm = function (V, R) { var I = V / R; return { V: V, R: R, I: I, P: V * I }; };
  Circ.resistenciaGeometrica = function (rho, L, A) { return rho * L / A; };
  Circ.RESISTIVIDADES = [
    { id: 'cu', nombre: 'Cobre', rho: 1.68e-8 },
    { id: 'ag', nombre: 'Plata', rho: 1.59e-8 },
    { id: 'au', nombre: 'Oro', rho: 2.44e-8 },
    { id: 'al', nombre: 'Aluminio', rho: 2.65e-8 },
    { id: 'w', nombre: 'Tungsteno', rho: 5.6e-8 },
    { id: 'fe', nombre: 'Hierro', rho: 9.71e-8 },
    { id: 'pt', nombre: 'Platino', rho: 1.06e-7 },
    { id: 'nicr', nombre: 'Nicromo', rho: 1.5e-6 },
    { id: 'c', nombre: 'Carbono (grafito)', rho: 3.5e-5 }
  ];

  /* ---------- Árbol serie/paralelo ----------
   * Nodo: { tipo:'R'|'C', valor, nombre } | { tipo:'serie'|'paralelo', hijos:[...] }
   * Circuito: { fem, rInt, red }
   * En CC estacionaria un capacitor es un circuito abierto (R = ∞).
   */

  /** Calcula { R, Cq } equivalentes: R = resistencia equivalente (Infinity si el nodo está abierto),
   *  Cq = capacitancia equivalente del nodo cuando está abierto. */
  function equivalente(n) {
    if (n.tipo === 'R') return { R: n.valor, Cq: undefined };
    if (n.tipo === 'C') return { R: Infinity, Cq: n.valor };
    var eqs = n.hijos.map(equivalente), i;
    if (n.tipo === 'serie') {
      var abierto = eqs.some(function (e) { return e.R === Infinity; });
      if (!abierto) { var s = 0; for (i = 0; i < eqs.length; i++) s += eqs[i].R; return { R: s, Cq: undefined }; }
      var inv = 0;
      for (i = 0; i < eqs.length; i++) if (eqs[i].R === Infinity) inv += 1 / eqs[i].Cq;
      return { R: Infinity, Cq: 1 / inv };
    }
    var g = 0, hayFinito = false, cs = 0;
    for (i = 0; i < eqs.length; i++) {
      if (eqs[i].R !== Infinity) { hayFinito = true; g += 1 / eqs[i].R; } else cs += eqs[i].Cq;
    }
    return hayFinito ? { R: 1 / g, Cq: undefined } : { R: Infinity, Cq: cs };
  }

  /** Copia profunda anotando V, I, P (y Q, U en capacitores) en cada nodo para una tensión V aplicada. */
  function asignar(n, V) {
    var out = { tipo: n.tipo, nombre: n.nombre, valor: n.valor, V: V };
    var eq = equivalente(n);
    out.Req = eq.R; out.Ceq = eq.Cq;
    if (n.tipo === 'R') { out.I = V / n.valor; out.P = V * out.I; return out; }
    if (n.tipo === 'C') { out.I = 0; out.P = 0; out.Q = n.valor * V; out.U = 0.5 * n.valor * V * V; return out; }
    var eqs = n.hijos.map(equivalente);
    if (n.tipo === 'serie') {
      if (eq.R !== Infinity) {
        out.I = V / eq.R;
        out.hijos = n.hijos.map(function (h, k) { return asignar(h, out.I * eqs[k].R); });
      } else {
        out.I = 0;
        var invTot = 0, k;
        for (k = 0; k < eqs.length; k++) if (eqs[k].R === Infinity) invTot += 1 / eqs[k].Cq;
        out.hijos = n.hijos.map(function (h, kk) {
          var vi = eqs[kk].R === Infinity ? V * (1 / eqs[kk].Cq) / invTot : 0;
          return asignar(h, vi);
        });
      }
    } else {
      out.hijos = n.hijos.map(function (h) { return asignar(h, V); });
      out.I = 0;
      out.hijos.forEach(function (h) { out.I += h.I; });
    }
    out.P = V * out.I;
    return out;
  }

  /** Valida un árbol; devuelve mensaje de error o null. */
  Circ.validarArbol = function (n, ruta) {
    ruta = ruta || 'raíz';
    if (!n) return 'Falta un elemento en ' + ruta + '.';
    if (n.tipo === 'R' || n.tipo === 'C') {
      if (!(n.valor > 0) || !isFinite(n.valor)) return 'El valor de ' + (n.nombre || n.tipo) + ' debe ser positivo.';
      return null;
    }
    if (!n.hijos || n.hijos.length === 0) return 'El grupo ' + n.tipo + ' no tiene elementos.';
    for (var i = 0; i < n.hijos.length; i++) {
      var e = Circ.validarArbol(n.hijos[i], ruta + '>' + i);
      if (e) return e;
    }
    return null;
  };

  /**
   * Analiza un circuito { fem, rInt, red } en estado estacionario.
   * Devuelve { I, Vterminal, Req, Rtotal, Pfuente, Pdisipada, Pinterna, red:(árbol anotado) }
   */
  Circ.analizar = function (c) {
    var err = Circ.validarArbol(c.red);
    if (err) return { error: err };
    var rInt = c.rInt || 0, eq = equivalente(c.red), I, Vt;
    if (eq.R === Infinity) { I = 0; Vt = c.fem; }
    else { I = c.fem / (rInt + eq.R); Vt = c.fem - I * rInt; }
    var red = asignar(c.red, Vt), Pd = 0;
    (function suma(n) {
      if (n.tipo === 'R') Pd += n.P;
      else if (n.hijos) n.hijos.forEach(suma);
    })(red);
    return { I: I, Vterminal: Vt, Req: eq.R, Rtotal: eq.R + rInt, Pfuente: c.fem * I, Pdisipada: Pd, Pinterna: I * I * rInt, red: red };
  };

  /* ---------- Análisis nodal modificado (MNA) ----------
   * Elementos: { tipo:'R'|'V'|'I'|'C', nombre, a, b, valor }
   *   R: resistencia entre a y b
   *   V: fuente de tensión, terminal + en a, terminal − en b
   *   I: fuente de corriente que impulsa 'valor' de a hacia b a través de la fuente (convención SPICE)
   *   C: capacitor (circuito abierto en CC; se informa su tensión)
   * El nodo '0' es tierra.
   */
  Circ.resolverMNA = function (elementos) {
    var nodos = {}, lista = [], i;
    function idx(n) {
      n = String(n);
      if (n === '0') return -1;
      if (!(n in nodos)) { nodos[n] = lista.length; lista.push(n); }
      return nodos[n];
    }
    elementos.forEach(function (e) { e._a = idx(e.a); e._b = idx(e.b); });
    var fuentes = elementos.filter(function (e) { return e.tipo === 'V'; });
    var n = lista.length, m = fuentes.length, N = n + m;
    if (N === 0) return { error: 'El circuito está vacío.' };
    var A = [], b = [];
    for (i = 0; i < N; i++) { A.push(new Array(N).fill(0)); b.push(0); }
    elementos.forEach(function (e) {
      if (e.tipo === 'R') {
        if (!(e.valor > 0)) { e._err = true; return; }
        var g = 1 / e.valor;
        if (e._a >= 0) A[e._a][e._a] += g;
        if (e._b >= 0) A[e._b][e._b] += g;
        if (e._a >= 0 && e._b >= 0) { A[e._a][e._b] -= g; A[e._b][e._a] -= g; }
      } else if (e.tipo === 'I') {
        if (e._a >= 0) b[e._a] -= e.valor;
        if (e._b >= 0) b[e._b] += e.valor;
      }
    });
    var errR = elementos.filter(function (e) { return e._err; });
    if (errR.length) return { error: 'La resistencia ' + errR[0].nombre + ' debe ser positiva.' };
    fuentes.forEach(function (e, k) {
      var row = n + k;
      if (e._a >= 0) { A[e._a][row] += 1; A[row][e._a] += 1; }
      if (e._b >= 0) { A[e._b][row] -= 1; A[row][e._b] -= 1; }
      b[row] = e.valor;
    });
    var x = Num.resolverLineal(A, b);
    if (!x) return { error: 'No se pudo resolver: hay nodos flotantes, fuentes de tensión en lazo o falta conexión a tierra (nodo 0).' };
    var V = { '0': 0 };
    lista.forEach(function (nm, k) { V[nm] = x[k]; });
    function vn(k) { return k < 0 ? 0 : x[k]; }
    var res = elementos.map(function (e) {
      var Vab = vn(e._a) - vn(e._b), I = 0;
      if (e.tipo === 'R') I = Vab / e.valor;
      else if (e.tipo === 'I') I = e.valor;
      else if (e.tipo === 'V') I = -x[n + fuentes.indexOf(e)]; // corriente entregada por la fuente (de + hacia fuera)
      var P = e.tipo === 'V' ? Vab * I : e.tipo === 'I' ? -Vab * I : Vab * I;
      // P>0: disipada/absorbida (R); para fuentes P>0 significa que entrega potencia
      return { nombre: e.nombre, tipo: e.tipo, a: e.a, b: e.b, valor: e.valor, V: Vab, I: I, P: e.tipo === 'R' || e.tipo === 'C' ? Vab * I : P };
    });
    return { V: V, elementos: res };
  };

  /** Convierte texto estilo SPICE en elementos. Líneas: "R1 1 2 100", "V1 1 0 12", "I1 0 2 0.01", "C1 2 0 1e-6". */
  Circ.parsearNetlist = function (texto) {
    var el = [], lineas = texto.split(/\r?\n/), nombres = {};
    for (var i = 0; i < lineas.length; i++) {
      var ln = lineas[i].replace(/[*;#].*$/, '').trim();
      if (!ln) continue;
      var t = ln.split(/\s+/);
      if (t.length !== 4) return { error: 'Línea ' + (i + 1) + ': formato esperado "NOMBRE nodoA nodoB valor".' };
      var tipo = t[0][0].toUpperCase();
      if ('RVIC'.indexOf(tipo) < 0) return { error: 'Línea ' + (i + 1) + ': el nombre debe empezar con R, V, I o C.' };
      var val = Number(t[3]);
      if (!isFinite(val)) return { error: 'Línea ' + (i + 1) + ': valor no numérico "' + t[3] + '".' };
      if (t[0].toUpperCase() in nombres) return { error: 'Línea ' + (i + 1) + ': nombre repetido ' + t[0] + '.' };
      nombres[t[0].toUpperCase()] = 1;
      if (t[1] === t[2]) return { error: 'Línea ' + (i + 1) + ': ' + t[0] + ' tiene ambos terminales en el mismo nodo.' };
      el.push({ tipo: tipo, nombre: t[0], a: t[1], b: t[2], valor: val });
    }
    if (!el.length) return { error: 'Escribe al menos un elemento.' };
    return { elementos: el };
  };

  /** Convierte un circuito en árbol a netlist (para validar el método del árbol con MNA). */
  Circ.aNetlist = function (c) {
    var el = [], cont = { n: 1, r: 0, c: 0 };
    el.push({ tipo: 'V', nombre: 'V1', a: 'n0', b: '0', valor: c.fem });
    var top = 'n0';
    if (c.rInt > 0) { el.push({ tipo: 'R', nombre: 'Rint', a: 'n0', b: 'ni', valor: c.rInt }); top = 'ni'; }
    function nuevo() { return 'x' + (cont.n++); }
    (function rec(n, a, b) {
      if (n.tipo === 'R') { el.push({ tipo: 'R', nombre: 'R' + (++cont.r), a: a, b: b, valor: n.valor }); }
      else if (n.tipo === 'C') { el.push({ tipo: 'C', nombre: 'C' + (++cont.c), a: a, b: b, valor: n.valor }); }
      else if (n.tipo === 'paralelo') { n.hijos.forEach(function (h) { rec(h, a, b); }); }
      else {
        var prev = a;
        n.hijos.forEach(function (h, k) {
          var sig = k === n.hijos.length - 1 ? b : nuevo();
          rec(h, prev, sig); prev = sig;
        });
      }
    })(c.red, top, '0');
    return el;
  };

  return { Circ: Circ };
});

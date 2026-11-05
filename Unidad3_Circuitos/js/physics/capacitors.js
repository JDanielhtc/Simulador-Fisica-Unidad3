/* ============================================================
 * capacitors.js — Unidad 2: capacitores, dieléctricos y energía
 * ============================================================ */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('./core.js') : root.Fisica);
  if (isNode) { module.exports = api; }
  else { root.Fisica = Object.assign(root.Fisica || {}, api); }
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';
  var EPS0 = F.Const.EPS0;

  var Cap = {};

  /** Materiales: constante dieléctrica κ y rigidez dieléctrica [V/m] (valores de tablas de texto). */
  Cap.MATERIALES = [
    { id: 'vacio', nombre: 'Vacío', kappa: 1, rigidez: Infinity },
    { id: 'aire', nombre: 'Aire', kappa: 1.00059, rigidez: 3e6 },
    { id: 'teflon', nombre: 'Teflón', kappa: 2.1, rigidez: 60e6 },
    { id: 'poliestireno', nombre: 'Poliestireno', kappa: 2.56, rigidez: 24e6 },
    { id: 'mylar', nombre: 'Mylar', kappa: 3.2, rigidez: 7e6 },
    { id: 'nylon', nombre: 'Nylon', kappa: 3.4, rigidez: 14e6 },
    { id: 'pvc', nombre: 'Cloruro de polivinilo (PVC)', kappa: 3.4, rigidez: 40e6 },
    { id: 'papel', nombre: 'Papel', kappa: 3.7, rigidez: 16e6 },
    { id: 'baquelita', nombre: 'Baquelita', kappa: 4.9, rigidez: 24e6 },
    { id: 'pirex', nombre: 'Vidrio pirex', kappa: 5.6, rigidez: 14e6 },
    { id: 'porcelana', nombre: 'Porcelana', kappa: 6, rigidez: 12e6 },
    { id: 'neopreno', nombre: 'Neopreno', kappa: 6.7, rigidez: 12e6 },
    { id: 'agua', nombre: 'Agua', kappa: 80, rigidez: Infinity }
  ];

  Cap.material = function (id) {
    for (var i = 0; i < Cap.MATERIALES.length; i++) if (Cap.MATERIALES[i].id === id) return Cap.MATERIALES[i];
    return Cap.MATERIALES[0];
  };

  /**
   * Capacitancia de placas paralelas (sin efecto de bordes).
   * A [m²], d [m], kappa del dieléctrico, f = fracción de longitud ocupada por el dieléctrico (0..1).
   * Las dos regiones (con y sin dieléctrico) están en paralelo: C = ε0 A (1 + (κ−1) f) / d
   */
  Cap.capacitancia = function (A, d, kappa, f) {
    if (kappa === undefined) kappa = 1;
    if (f === undefined) f = 1;
    return EPS0 * A * (1 + (kappa - 1) * f) / d;
  };

  /** Energía almacenada U = ½ C V² [J] */
  Cap.energiaCV = function (C, V) { return 0.5 * C * V * V; };

  /**
   * Estado de un capacitor al cambiar su capacitancia de C0 a C1.
   *  - modo 'bateria': V constante → Q = C1 V
   *  - modo 'aislado': Q constante → V = Q / C1
   * Devuelve { C, V, Q, U }
   */
  Cap.estado = function (modo, C0, C1, V0) {
    if (modo === 'aislado') {
      var Q = C0 * V0, V = Q / C1;
      return { C: C1, V: V, Q: Q, U: 0.5 * Q * V };
    }
    return { C: C1, V: V0, Q: C1 * V0, U: 0.5 * C1 * V0 * V0 };
  };

  /** Campo en el capacitor E = V/d y densidad de energía u = ½ ε0 κ E² */
  Cap.campo = function (V, d) { return V / d; };
  Cap.densidadEnergia = function (E, kappa) { return 0.5 * EPS0 * (kappa || 1) * E * E; };

  /**
   * Dadas dos magnitudes entre {C, V, Q, U}, calcula las otras dos.
   * p: objeto con exactamente dos claves definidas (>0). Devuelve { C, V, Q, U } o { error }.
   */
  Cap.resolver = function (p) {
    var claves = ['C', 'V', 'Q', 'U'].filter(function (k) { return p[k] !== undefined && p[k] !== null && !isNaN(p[k]); });
    if (claves.length !== 2) return { error: 'Indica exactamente dos de las cuatro magnitudes (C, V, Q, U).' };
    for (var i = 0; i < claves.length; i++) {
      if (!(p[claves[i]] > 0) || !isFinite(p[claves[i]])) return { error: 'Los valores deben ser positivos y finitos.' };
    }
    var C = p.C, V = p.V, Q = p.Q, U = p.U, key = claves.join('');
    switch (key) {
      case 'CV': Q = C * V; U = 0.5 * C * V * V; break;
      case 'CQ': V = Q / C; U = Q * Q / (2 * C); break;
      case 'CU': V = Math.sqrt(2 * U / C); Q = Math.sqrt(2 * U * C); break;
      case 'VQ': C = Q / V; U = 0.5 * Q * V; break;
      case 'VU': C = 2 * U / (V * V); Q = 2 * U / V; break;
      case 'QU': C = Q * Q / (2 * U); V = 2 * U / Q; break;
      default: return { error: 'Combinación no válida.' };
    }
    return { C: C, V: V, Q: Q, U: U };
  };

  /** Capacitores en serie: devuelve Ceq y la distribución de Q y V para una tensión total V. */
  Cap.serie = function (Cs, V) {
    var inv = 0; Cs.forEach(function (c) { inv += 1 / c; });
    var Ceq = 1 / inv, Q = Ceq * V;
    return { Ceq: Ceq, Q: Q, V: Cs.map(function (c) { return Q / c; }), Qs: Cs.map(function () { return Q; }), U: 0.5 * Ceq * V * V };
  };

  /** Capacitores en paralelo. */
  Cap.paralelo = function (Cs, V) {
    var Ceq = 0; Cs.forEach(function (c) { Ceq += c; });
    return { Ceq: Ceq, Q: Ceq * V, V: Cs.map(function () { return V; }), Qs: Cs.map(function (c) { return c * V; }), U: 0.5 * Ceq * V * V };
  };

  /** Carga/descarga de un circuito RC. Devuelve funciones del tiempo. */
  Cap.RC = function (R, C, V0) {
    var tau = R * C;
    return {
      tau: tau,
      vCarga: function (t) { return V0 * (1 - Math.exp(-t / tau)); },
      vDescarga: function (t) { return V0 * Math.exp(-t / tau); },
      iCarga: function (t) { return V0 / R * Math.exp(-t / tau); },
      uCarga: function (t) { var v = V0 * (1 - Math.exp(-t / tau)); return 0.5 * C * v * v; },
      eFuente: function (t) { return C * V0 * V0 * (1 - Math.exp(-t / tau)); },          // energía entregada por la batería hasta t
      eResistencia: function (t) { return 0.5 * C * V0 * V0 * (1 - Math.exp(-2 * t / tau)); }, // energía disipada en R hasta t
      energiaFuente: C * V0 * V0,       // energía entregada por la batería
      energiaFinal: 0.5 * C * V0 * V0,  // energía almacenada al final
      energiaDisipada: 0.5 * C * V0 * V0 // energía disipada en R (igual a la almacenada)
    };
  };

  /** ¿Hay ruptura dieléctrica? Compara E = V/d con la rigidez del material y del aire (región sin dieléctrico). */
  Cap.ruptura = function (V, d, material, f) {
    var E = Math.abs(V) / d, motivos = [];
    if (f > 0 && E > material.rigidez) motivos.push(material.nombre);
    if (f < 1 && E > Cap.material('aire').rigidez) motivos.push('Aire');
    return { E: E, ruptura: motivos.length > 0, en: motivos };
  };

  return { Cap: Cap };
});

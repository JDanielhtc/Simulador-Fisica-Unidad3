/* ============================================================
 * core.js — Constantes, utilidades vectoriales y métodos numéricos
 * Funciona en el navegador (window.Fisica) y en Node (require).
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.Fisica = Object.assign(root.Fisica || {}, api); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Constantes físicas (SI, CODATA 2018) */
  var Const = {
    K: 8.9875517923e9,        // constante de Coulomb  [N·m²/C²]
    EPS0: 8.8541878128e-12,   // permitividad del vacío [F/m]
    MU0: 1.25663706212e-6,    // permeabilidad del vacío [T·m/A]
    E: 1.602176634e-19,       // carga elemental [C]
    ME: 9.1093837015e-31,     // masa del electrón [kg]
    MP: 1.67262192369e-27,    // masa del protón [kg]
    MALFA: 6.6446573357e-27,  // masa de la partícula alfa [kg]
    C: 299792458              // velocidad de la luz [m/s]
  };

  /** Operaciones con vectores 3D representados como arreglos [x, y, z] */
  var Vec = {
    sum: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    res: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    esc: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    punto: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cruz: function (a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    },
    norma: function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
  };

  var Num = {};

  Num.limitar = function (x, a, b) { return Math.min(b, Math.max(a, x)); };

  Num.linspace = function (a, b, n) {
    var r = [];
    for (var i = 0; i < n; i++) r.push(n === 1 ? a : a + (b - a) * i / (n - 1));
    return r;
  };

  /** Formato con prefijo SI: 1.5e-6, 'F' → "1.5 µF" */
  Num.fmtSI = function (x, unidad, dig) {
    unidad = unidad || ''; dig = dig || 3;
    if (x === 0) return '0 ' + unidad;
    if (typeof x !== 'number' || isNaN(x)) return '— ' + unidad;
    if (!isFinite(x)) return (x > 0 ? '∞ ' : '−∞ ') + unidad;
    var pref = ['f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T'];
    var e = Math.floor(Math.log10(Math.abs(x)) / 3);
    var idx = Math.max(-5, Math.min(4, e));
    var v = x / Math.pow(10, 3 * idx);
    var txt = String(Number(v.toPrecision(dig)));
    return txt + ' ' + pref[idx + 5] + unidad;
  };

  /** Formato numérico general (notación científica para valores extremos) */
  Num.fmt = function (x, dig) {
    dig = dig || 4;
    if (typeof x !== 'number' || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    var a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) return x.toExponential(Math.max(1, dig - 1)).replace('e+', 'e');
    return String(Number(x.toPrecision(dig)));
  };

  /**
   * Resuelve A·x = b por eliminación gaussiana con pivoteo parcial.
   * A: arreglo de filas (se copia). Devuelve null si la matriz es singular.
   */
  Num.resolverLineal = function (A, b) {
    var n = b.length, M = [], i, j, k;
    for (i = 0; i < n; i++) { M.push(A[i].slice()); M[i].push(b[i]); }
    for (i = 0; i < n; i++) {
      var piv = i, mx = Math.abs(M[i][i]);
      for (k = i + 1; k < n; k++) { if (Math.abs(M[k][i]) > mx) { mx = Math.abs(M[k][i]); piv = k; } }
      if (mx < 1e-14) return null;
      if (piv !== i) { var tmp = M[i]; M[i] = M[piv]; M[piv] = tmp; }
      for (k = i + 1; k < n; k++) {
        var f = M[k][i] / M[i][i];
        if (f === 0) continue;
        for (j = i; j <= n; j++) M[k][j] -= f * M[i][j];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  };

  /**
   * Traza una línea de campo siguiendo la dirección del campo vectorial F(x,y,z).
   * Usa el método del punto medio (RK2) sobre el campo normalizado.
   * op: { dir:+1|-1, h, maxPasos, caja:[xmin,xmax,ymin,ymax,zmin,zmax], parar(p,i), cerrar }
   * Devuelve { puntos:[[x,y,z],...], motivo }
   */
  Num.trazarLinea = function (F, p0, op) {
    op = op || {};
    var dir = op.dir || 1, h = op.h || 0.03, maxPasos = op.maxPasos || 1500;
    var caja = op.caja || [-3, 3, -3, 3, -3, 3];
    var pts = [p0.slice()], p = p0.slice(), motivo = 'pasos';
    function f(q) {
      var v = F(q[0], q[1], q[2]);
      var n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      if (!(n > 1e-300) || !isFinite(n)) return null;
      return [dir * v[0] / n, dir * v[1] / n, dir * v[2] / n];
    }
    for (var i = 0; i < maxPasos; i++) {
      var k1 = f(p); if (!k1) { motivo = 'nulo'; break; }
      var k2 = f([p[0] + 0.5 * h * k1[0], p[1] + 0.5 * h * k1[1], p[2] + 0.5 * h * k1[2]]);
      if (!k2) { motivo = 'nulo'; break; }
      p = [p[0] + h * k2[0], p[1] + h * k2[1], p[2] + h * k2[2]];
      pts.push(p);
      if (p[0] < caja[0] || p[0] > caja[1] || p[1] < caja[2] || p[1] > caja[3] || p[2] < caja[4] || p[2] > caja[5]) { motivo = 'fuera'; break; }
      if (op.parar && op.parar(p, i)) { motivo = 'parada'; break; }
      if (op.cerrar && i > 8) {
        var dx = p[0] - p0[0], dy = p[1] - p0[1], dz = p[2] - p0[2];
        if (dx * dx + dy * dy + dz * dz < 1.44 * h * h) { motivo = 'cerrada'; pts.push(p0.slice()); break; }
      }
    }
    return { puntos: pts, motivo: motivo };
  };

  /**
   * Integra el movimiento de una partícula cargada (no relativista):
   *     m dv/dt = q (E + v × B)
   * op: { q, m, r0, v0, E(r,t), B(r,t), dt(r,v,t) | dtFijo, tMax, maxPasos,
   *       metodo: 'rk4' | 'boris', parar(r,v,t) → motivo|falsy }
   * Devuelve { t:[], r:[[x,y,z]], v:[[vx,vy,vz]], motivo }
   */
  Num.integrarParticula = function (op) {
    var qm = op.q / op.m;
    var Ef = op.E || function () { return [0, 0, 0]; };
    var Bf = op.B || function () { return [0, 0, 0]; };
    var metodo = op.metodo || 'rk4';
    var maxPasos = op.maxPasos || 20000;
    var tMax = op.tMax === undefined ? Infinity : op.tMax;
    var r = op.r0.slice(), v = op.v0.slice(), t = 0;
    var out = { t: [0], r: [r.slice()], v: [v.slice()], motivo: 'pasos' };

    function acc(rr, vv, tt) {
      var e = Ef(rr, tt), b = Bf(rr, tt);
      return [
        qm * (e[0] + vv[1] * b[2] - vv[2] * b[1]),
        qm * (e[1] + vv[2] * b[0] - vv[0] * b[2]),
        qm * (e[2] + vv[0] * b[1] - vv[1] * b[0])
      ];
    }
    function sumar(a, b, s) { return [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]]; }

    /* Paso de Boris para la velocidad: media patada de E, rotación exacta alrededor de B,
       media patada de E. Conserva |v| exactamente cuando solo hay campo magnético. */
    function borisV(vv, e, b, dtt) {
      var h = 0.5 * qm * dtt;
      var vm = [vv[0] + h * e[0], vv[1] + h * e[1], vv[2] + h * e[2]];
      var tv = [h * b[0], h * b[1], h * b[2]];
      var t2 = tv[0] * tv[0] + tv[1] * tv[1] + tv[2] * tv[2];
      var s = [2 * tv[0] / (1 + t2), 2 * tv[1] / (1 + t2), 2 * tv[2] / (1 + t2)];
      var vp = [
        vm[0] + (vm[1] * tv[2] - vm[2] * tv[1]),
        vm[1] + (vm[2] * tv[0] - vm[0] * tv[2]),
        vm[2] + (vm[0] * tv[1] - vm[1] * tv[0])
      ];
      var vq = [
        vm[0] + (vp[1] * s[2] - vp[2] * s[1]),
        vm[1] + (vp[2] * s[0] - vp[0] * s[2]),
        vm[2] + (vp[0] * s[1] - vp[1] * s[0])
      ];
      return [vq[0] + h * e[0], vq[1] + h * e[1], vq[2] + h * e[2]];
    }
    var vh = null; // velocidad en t − Δt/2 (esquema salto de rana)

    for (var i = 0; i < maxPasos; i++) {
      var dt = op.dt ? op.dt(r, v, t) : op.dtFijo;
      if (!(dt > 0) || !isFinite(dt)) { out.motivo = 'dt'; break; }
      if (t + dt >= tMax) dt = tMax - t;
      if (metodo === 'boris') {
        // Descentrado inicial: retrocede la velocidad medio paso para que v y r queden desfasados Δt/2.
        if (vh === null) vh = borisV(v, Ef(r, t), Bf(r, t), -dt / 2);
        vh = borisV(vh, Ef(r, t), Bf(r, t), dt);
        r = [r[0] + vh[0] * dt, r[1] + vh[1] * dt, r[2] + vh[2] * dt];
        // Velocidad sincronizada con r: medio paso adicional con los campos en la nueva posición.
        v = borisV(vh, Ef(r, t + dt), Bf(r, t + dt), dt / 2);
      } else {
        var a1 = acc(r, v, t);
        var r2 = sumar(r, v, dt / 2), v2 = sumar(v, a1, dt / 2);
        var a2 = acc(r2, v2, t + dt / 2);
        var r3 = sumar(r, v2, dt / 2), v3 = sumar(v, a2, dt / 2);
        var a3 = acc(r3, v3, t + dt / 2);
        var r4 = sumar(r, v3, dt), v4 = sumar(v, a3, dt);
        var a4 = acc(r4, v4, t + dt);
        r = [
          r[0] + dt / 6 * (v[0] + 2 * v2[0] + 2 * v3[0] + v4[0]),
          r[1] + dt / 6 * (v[1] + 2 * v2[1] + 2 * v3[1] + v4[1]),
          r[2] + dt / 6 * (v[2] + 2 * v2[2] + 2 * v3[2] + v4[2])
        ];
        v = [
          v[0] + dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]),
          v[1] + dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]),
          v[2] + dt / 6 * (a1[2] + 2 * a2[2] + 2 * a3[2] + a4[2])
        ];
      }
      t += dt;
      out.t.push(t); out.r.push(r.slice()); out.v.push(v.slice());
      if (!isFinite(r[0] + r[1] + r[2] + v[0] + v[1] + v[2])) { out.motivo = 'inestable'; break; }
      if (op.parar) { var mot = op.parar(r, v, t); if (mot) { out.motivo = mot; break; } }
      if (t >= tMax - 1e-300) { out.motivo = 'tiempo'; break; }
    }
    return out;
  };

  /**
   * Segmentos de una curva de nivel (marching squares) de una grilla escalar.
   * valores: arreglo plano de nx*ny (índice j*nx+i). Devuelve [x1,y1,x2,y2, ...].
   */
  Num.curvaDeNivel = function (valores, nx, ny, x0, y0, dx, dy, nivel) {
    var seg = [];
    function inter(v1, v2, a1, b1, a2, b2) {
      var t = (nivel - v1) / (v2 - v1);
      return [a1 + t * (a2 - a1), b1 + t * (b2 - b1)];
    }
    for (var j = 0; j < ny - 1; j++) {
      for (var i = 0; i < nx - 1; i++) {
        var va = valores[j * nx + i], vb = valores[j * nx + i + 1];
        var vc = valores[(j + 1) * nx + i + 1], vd = valores[(j + 1) * nx + i];
        if (!isFinite(va + vb + vc + vd)) continue;
        var caso = (va >= nivel ? 1 : 0) | (vb >= nivel ? 2 : 0) | (vc >= nivel ? 4 : 0) | (vd >= nivel ? 8 : 0);
        if (caso === 0 || caso === 15) continue;
        var xa = x0 + i * dx, xb = xa + dx, ya = y0 + j * dy, yc = ya + dy;
        var e = [
          function () { return inter(va, vb, xa, ya, xb, ya); },   // e0: borde inferior (a-b)
          function () { return inter(vb, vc, xb, ya, xb, yc); },   // e1: borde derecho (b-c)
          function () { return inter(vd, vc, xa, yc, xb, yc); },   // e2: borde superior (d-c)
          function () { return inter(va, vd, xa, ya, xa, yc); }    // e3: borde izquierdo (a-d)
        ];
        var pares;
        switch (caso) {
          case 1: case 14: pares = [[3, 0]]; break;
          case 2: case 13: pares = [[0, 1]]; break;
          case 3: case 12: pares = [[3, 1]]; break;
          case 4: case 11: pares = [[1, 2]]; break;
          case 6: case 9: pares = [[0, 2]]; break;
          case 7: case 8: pares = [[3, 2]]; break;
          case 5:
            pares = ((va + vb + vc + vd) / 4 >= nivel) ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
            break;
          case 10:
            pares = ((va + vb + vc + vd) / 4 >= nivel) ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]];
            break;
          default: pares = [];
        }
        for (var k = 0; k < pares.length; k++) {
          var p1 = e[pares[k][0]](), p2 = e[pares[k][1]]();
          seg.push(p1[0], p1[1], p2[0], p2[1]);
        }
      }
    }
    return seg;
  };

  /**
   * Niveles automáticos para equipotenciales: usa cuantiles de |V| para que
   * las curvas queden bien distribuidas aunque el potencial diverja cerca de las cargas.
   */
  Num.nivelesAuto = function (valores, n) {
    var pos = [], neg = [];
    for (var i = 0; i < valores.length; i++) {
      var v = valores[i];
      if (!isFinite(v)) continue;
      if (v > 0) pos.push(v); else if (v < 0) neg.push(-v);
    }
    pos.sort(function (a, b) { return a - b; });
    neg.sort(function (a, b) { return a - b; });
    var niveles = [];
    function cuantil(arr, p) { return arr[Math.min(arr.length - 1, Math.floor(p * arr.length))]; }
    for (var k = 1; k <= n; k++) {
      var p = 0.08 + 0.88 * (k - 1) / Math.max(1, n - 1);
      if (pos.length > 20) niveles.push(cuantil(pos, p));
      if (neg.length > 20) niveles.push(-cuantil(neg, p));
    }
    if (pos.length > 20 && neg.length > 20) niveles.push(0);
    niveles.sort(function (a, b) { return a - b; });
    var res = [];
    for (var m = 0; m < niveles.length; m++) {
      if (!res.length || Math.abs(niveles[m] - res[res.length - 1]) > 1e-9 * (Math.abs(niveles[m]) + 1e-30)) res.push(niveles[m]);
    }
    return res;
  };

  return { Const: Const, Vec: Vec, Num: Num };
});

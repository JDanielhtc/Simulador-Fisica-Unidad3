/* ============================================================
 * camara3d.js — Cámara orbital con proyección en perspectiva sobre canvas 2D.
 * Convención: z hacia arriba; x hacia la derecha cuando yaw = 0.
 * ============================================================ */
(function (global) {
  'use strict';
  var Sim = global.Sim = global.Sim || {};
  var UI = Sim.UI, Num = global.Fisica.Num;

  function Camara3D(o) {
    o = o || {};
    this.yaw = o.yaw !== undefined ? o.yaw : 0.7;
    this.pitch = o.pitch !== undefined ? o.pitch : 0.45;
    this.zoom = 1;
    this.R = o.R || 3;             // radio de la escena que debe quedar visible [unidades del mundo]
    this.centro = o.centro || [0, 0, 0];
    this.w = 400; this.h = 400;
    this._actualizar();
  }

  Camara3D.prototype._actualizar = function () {
    this.cy = Math.cos(this.yaw); this.sy = Math.sin(this.yaw);
    this.cp = Math.cos(this.pitch); this.sp = Math.sin(this.pitch);
    this.D = 3.4 * this.R;
    var s0 = 0.44 * Math.min(this.w, this.h) / this.R * this.zoom;
    this.f = s0 * this.D;
  };

  Camara3D.prototype.ajustar = function (w, h) { this.w = w; this.h = h; this._actualizar(); };
  Camara3D.prototype.fijarEscena = function (R, centro) { this.R = Math.max(R, 1e-30); if (centro) this.centro = centro; this._actualizar(); };

  /** Proyecta un punto del mundo. Devuelve [sx, sy, profundidad, factor de escala]. */
  Camara3D.prototype.proy = function (x, y, z) {
    x -= this.centro[0]; y -= this.centro[1]; z -= this.centro[2];
    var xr = this.cy * x + this.sy * y, yr = -this.sy * x + this.cy * y;
    var prof = yr * this.cp - z * this.sp, arriba = yr * this.sp + z * this.cp;
    var k = this.f / (this.D + prof);
    return [this.w / 2 + xr * k, this.h / 2 - arriba * k, prof, k];
  };

  Camara3D.prototype.arrastrar = function (dx, dy) {
    this.yaw -= dx * 0.008;
    this.pitch = Num.limitar(this.pitch + dy * 0.008, -1.5, 1.5);
    this._actualizar();
  };
  Camara3D.prototype.rueda = function (delta) {
    this.zoom = Num.limitar(this.zoom * Math.exp(-delta * 0.0012), 0.3, 6);
    this._actualizar();
  };
  Camara3D.prototype.vistas = {
    iso: [0.7, 0.45], frente: [0, 0.02], lado: [Math.PI / 2, 0.02], planta: [0, 1.5]
  };
  Camara3D.prototype.vista = function (nombre) {
    var v = this.vistas[nombre]; if (!v) return;
    this.yaw = v[0]; this.pitch = v[1]; this._actualizar();
  };

  /** Conecta el arrastre y la rueda del ratón a la cámara. 'cambio' se llama tras cada movimiento. */
  Camara3D.prototype.conectar = function (lienzo, cambio, extra) {
    var cam = this;
    extra = extra || {};
    UI.punteros(lienzo.canvas, {
      abajo: extra.abajo,
      mover: function (x, y, dx, dy, e) {
        if (extra.mover && extra.mover(x, y, dx, dy, e) === true) return;
        cam.arrastrar(dx, dy); cambio();
      },
      pasar: extra.pasar, salir: extra.salir, arriba: extra.arriba,
      rueda: function (d) { cam.rueda(d); cambio(); }
    });
    var viejo = lienzo.alRedimensionar;
    lienzo.alRedimensionar = function (w, h) { cam.ajustar(w, h); if (viejo) viejo(w, h); };
    cam.ajustar(lienzo.w, lienzo.h);
  };

  /** Ejes coordenados con marcas y etiquetas. L = longitud de los ejes. */
  Camara3D.prototype.dibujarEjes = function (ctx, L, unidad, factor) {
    var ejes = [['x', [L, 0, 0], '#ff8787'], ['y', [0, L, 0], '#8ce99a'], ['z', [0, 0, L], '#74c0fc']];
    var o = this.proy(0, 0, 0), cam = this;
    ctx.lineWidth = 1.2;
    ejes.forEach(function (e) {
      var a = cam.proy(-e[1][0], -e[1][1], -e[1][2]), b = cam.proy(e[1][0], e[1][1], e[1][2]);
      ctx.strokeStyle = e[2]; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.globalAlpha = 1;
      UI.texto(ctx, e[0], b[0] + 5, b[1] - 4, e[2], 12);
    });
    if (unidad) {
      var u = cam.proy(L, 0, 0);
      UI.texto(ctx, Num.fmt(L * (factor || 1), 3) + ' ' + unidad, u[0] + 5, u[1] + 12, Sim.Color.suave, 10);
    }
    return o;
  };

  /** Rejilla en el plano z = zc para dar sensación de profundidad. */
  Camara3D.prototype.dibujarRejilla = function (ctx, L, n, zc) {
    ctx.strokeStyle = Sim.Color.rejilla; ctx.lineWidth = 1;
    for (var i = -n; i <= n; i++) {
      var t = L * i / n, a = this.proy(t, -L, zc), b = this.proy(t, L, zc), c = this.proy(-L, t, zc), d = this.proy(L, t, zc);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
    }
  };

  /** Dibuja una polilínea 3D (arreglo de [x,y,z]); 'salto' permite submuestrear. */
  Camara3D.prototype.polilinea = function (ctx, pts, color, ancho, alfa, salto) {
    if (pts.length < 2) return;
    salto = salto || 1;
    ctx.strokeStyle = color; ctx.lineWidth = ancho || 1; ctx.globalAlpha = alfa === undefined ? 1 : alfa;
    ctx.beginPath();
    for (var i = 0; i < pts.length; i += salto) {
      var p = this.proy(pts[i][0], pts[i][1], pts[i][2]);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    if ((pts.length - 1) % salto !== 0) { var q = this.proy(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[pts.length - 1][2]); ctx.lineTo(q[0], q[1]); }
    ctx.stroke(); ctx.globalAlpha = 1;
  };

  /** Profundidad media de una polilínea (para ordenar de atrás hacia adelante). */
  Camara3D.prototype.profMedia = function (pts) {
    var s = 0, n = 0, paso = Math.max(1, Math.floor(pts.length / 6));
    for (var i = 0; i < pts.length; i += paso) { s += this.proy(pts[i][0], pts[i][1], pts[i][2])[2]; n++; }
    return s / Math.max(1, n);
  };

  /** Flecha 3D desde a hasta b. */
  Camara3D.prototype.flecha = function (ctx, a, b, color, ancho, cab) {
    var p = this.proy(a[0], a[1], a[2]), q = this.proy(b[0], b[1], b[2]);
    UI.flecha(ctx, p[0], p[1], q[0], q[1], color, ancho, cab);
  };

  Sim.Camara3D = Camara3D;
})(window);

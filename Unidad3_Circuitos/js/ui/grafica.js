/* ============================================================
 * grafica.js — Gráficas 2D de líneas y puntos sobre canvas (sin dependencias).
 * ============================================================ */
(function (global) {
  'use strict';
  var Sim = global.Sim = global.Sim || {};
  var UI = Sim.UI, Num = global.Fisica.Num;

  /** Marcas "bonitas" para un eje (1, 2, 5 × 10^k). */
  function marcas(min, max, n) {
    if (!(max > min)) return [min];
    var paso0 = (max - min) / Math.max(2, n), mag = Math.pow(10, Math.floor(Math.log10(paso0)));
    var r = paso0 / mag, paso = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
    var out = [];
    for (var v = Math.ceil(min / paso) * paso; v <= max + paso * 1e-9; v += paso) out.push(Math.abs(v) < paso * 1e-9 ? 0 : v);
    return out;
  }

  /**
   * Dibuja una gráfica completa.
   * cfg: { titulo, xlab, ylab, series:[{x:[],y:[],color,etiqueta,punteado,ancho}],
   *        puntos:[{x,y,color,etiqueta}], xmin,xmax,ymin,ymax, fmtX(v), fmtY(v), cero:bool }
   */
  function dibujarGrafica(ctx, w, h, cfg) {
    var C = Sim.Color;
    var mg = { l: 62, r: 14, t: cfg.titulo ? 28 : 12, b: 40 };
    var pw = w - mg.l - mg.r, ph = h - mg.t - mg.b;
    if (pw < 20 || ph < 20) return;
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    (cfg.series || []).forEach(function (s) {
      for (var i = 0; i < s.x.length; i++) {
        if (!isFinite(s.x[i]) || !isFinite(s.y[i])) continue;
        xmin = Math.min(xmin, s.x[i]); xmax = Math.max(xmax, s.x[i]);
        ymin = Math.min(ymin, s.y[i]); ymax = Math.max(ymax, s.y[i]);
      }
    });
    (cfg.puntos || []).forEach(function (p) {
      xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y);
    });
    if (cfg.xmin !== undefined) xmin = cfg.xmin; if (cfg.xmax !== undefined) xmax = cfg.xmax;
    if (cfg.ymin !== undefined) ymin = cfg.ymin; if (cfg.ymax !== undefined) ymax = cfg.ymax;
    if (!isFinite(xmin) || !isFinite(ymin)) { UI.texto(ctx, 'Sin datos', w / 2, h / 2, C.suave, 13, 'center'); return; }
    if (xmax <= xmin) { xmax = xmin + 1; }
    if (ymax <= ymin) { ymax = ymin + (Math.abs(ymin) || 1); }
    if (cfg.ymin === undefined) { var pad = (ymax - ymin) * 0.06; ymin -= pad; ymax += pad; if (cfg.cero0) ymin = Math.min(0, ymin); }
    var fx = function (v) { return mg.l + (v - xmin) / (xmax - xmin) * pw; };
    var fy = function (v) { return mg.t + ph - (v - ymin) / (ymax - ymin) * ph; };
    var fmtX = cfg.fmtX || function (v) { return Num.fmt(v, 3); };
    var fmtY = cfg.fmtY || function (v) { return Num.fmt(v, 3); };

    ctx.save();
    // rejilla y marcas
    ctx.lineWidth = 1; ctx.font = '11px system-ui, sans-serif';
    marcas(xmin, xmax, Math.max(3, Math.floor(pw / 90))).forEach(function (v) {
      var x = fx(v); ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x, mg.t); ctx.lineTo(x, mg.t + ph); ctx.stroke();
      UI.texto(ctx, fmtX(v), x, mg.t + ph + 15, C.suave, 11, 'center');
    });
    marcas(ymin, ymax, Math.max(3, Math.floor(ph / 45))).forEach(function (v) {
      var y = fy(v); ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(mg.l, y); ctx.lineTo(mg.l + pw, y); ctx.stroke();
      UI.texto(ctx, fmtY(v), mg.l - 6, y + 4, C.suave, 11, 'right');
    });
    // ejes
    ctx.strokeStyle = C.borde; ctx.lineWidth = 1.2;
    ctx.strokeRect(mg.l, mg.t, pw, ph);
    if (cfg.cero !== false && ymin < 0 && ymax > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.moveTo(mg.l, fy(0)); ctx.lineTo(mg.l + pw, fy(0)); ctx.stroke();
    }
    if (cfg.titulo) UI.texto(ctx, cfg.titulo, mg.l, 17, C.texto, 13, 'left');
    if (cfg.xlab) UI.texto(ctx, cfg.xlab, mg.l + pw / 2, h - 6, C.suave, 11.5, 'center');
    if (cfg.ylab) {
      ctx.save(); ctx.translate(13, mg.t + ph / 2); ctx.rotate(-Math.PI / 2);
      UI.texto(ctx, cfg.ylab, 0, 0, C.suave, 11.5, 'center'); ctx.restore();
    }
    // series
    ctx.save(); ctx.beginPath(); ctx.rect(mg.l, mg.t, pw, ph); ctx.clip();
    (cfg.series || []).forEach(function (s) {
      ctx.strokeStyle = s.color || C.acento; ctx.lineWidth = s.ancho || 2; ctx.lineJoin = 'round';
      ctx.setLineDash(s.punteado ? [6, 4] : []);
      ctx.beginPath();
      var abierto = false;
      for (var i = 0; i < s.x.length; i++) {
        if (!isFinite(s.x[i]) || !isFinite(s.y[i])) { abierto = false; continue; }
        var px = fx(s.x[i]), py = fy(s.y[i]);
        if (!abierto) { ctx.moveTo(px, py); abierto = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.restore();
    // puntos marcados
    (cfg.puntos || []).forEach(function (p) {
      var px = fx(p.x), py = fy(p.y);
      if (cfg.guias !== false) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, mg.t + ph); ctx.moveTo(px, py); ctx.lineTo(mg.l, py); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = p.color || C.pos; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      if (p.etiqueta) {
        var tx = px > mg.l + pw * 0.7 ? px - 9 : px + 9;
        UI.texto(ctx, p.etiqueta, tx, py - 9, C.texto, 11.5, px > mg.l + pw * 0.7 ? 'right' : 'left');
      }
    });
    // leyenda
    var ls = (cfg.series || []).filter(function (s) { return s.etiqueta; });
    if (ls.length) {
      var lx = mg.l + 10, ly = mg.t + 14;
      ls.forEach(function (s, i) {
        ctx.strokeStyle = s.color || C.acento; ctx.lineWidth = 3; ctx.setLineDash(s.punteado ? [5, 3] : []);
        ctx.beginPath(); ctx.moveTo(lx, ly + i * 16 - 4); ctx.lineTo(lx + 18, ly + i * 16 - 4); ctx.stroke(); ctx.setLineDash([]);
        UI.texto(ctx, s.etiqueta, lx + 24, ly + i * 16, C.texto, 11.5);
      });
    }
    ctx.restore();
  }

  Sim.Grafica = { dibujar: dibujarGrafica, marcas: marcas };
})(window);

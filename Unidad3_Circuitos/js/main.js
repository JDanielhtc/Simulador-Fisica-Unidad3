/* main.js — navegación entre unidades y módulos */
(function (global) {
  'use strict';
  var Sim = global.Sim, UI = Sim.UI, el = UI.el;
  var UNIDADES = [
    { n: 1, t: 'Unidad 1', s: 'Carga y campo eléctrico', mods: ['cargas', 'potencial', 'trayectoria'] },
    { n: 2, t: 'Unidad 2', s: 'Capacitores', mods: ['capacitor', 'energia'] },
    { n: 3, t: 'Unidad 3', s: 'Corriente y circuitos', mods: ['ohm', 'circuitos'] },
    { n: 4, t: 'Unidad 4', s: 'Magnetismo', mods: ['magnetico', 'lorentz'] }
  ];
  UNIDADES = UNIDADES.map(function (u) { return { n: u.n, t: u.t, s: u.s, mods: u.mods.filter(function (m) { return Sim.Modulos[m]; }) }; }).filter(function (u) { return u.mods.length; });
  var vista = document.getElementById('vista'), navU = document.getElementById('unidades'), navM = document.getElementById('modulos'), intro = document.getElementById('intro');
  var instancias = {}, paneles = {}, actual = null, uActual = 1;

  function mostrar(id) {
    var M = Sim.Modulos[id]; if (!M) return;
    if (actual && instancias[actual] && instancias[actual].desactivar) instancias[actual].desactivar();
    Object.keys(paneles).forEach(function (k) { paneles[k].style.display = 'none'; });
    if (!paneles[id]) {
      var p = el('div', { class: 'modulo', id: 'mod-' + id }); vista.appendChild(p); paneles[id] = p;
      try { instancias[id] = M.crear(p); } catch (e) { console.error(e); UI.error(e); }
    }
    paneles[id].style.display = ''; actual = id; uActual = M.unidad;
    intro.textContent = M.resumen;
    pintarNav();
    try { if (instancias[id] && instancias[id].activar) instancias[id].activar(); } catch (e) { console.error(e); UI.error(e); }
    try { history.replaceState(null, '', '#' + id); } catch (_) { /* sin historial */ }
  }
  function pintarNav() {
    UI.vaciar(navU); UI.vaciar(navM);
    UNIDADES.forEach(function (u) {
      navU.appendChild(el('button', { type: 'button', class: 'tab' + (u.n === uActual ? ' activo' : ''), 'aria-current': u.n === uActual ? 'page' : null, onclick: function () { mostrar(u.mods[0]); } }, el('strong', null, u.t), el('span', null, u.s)));
    });
    (UNIDADES.filter(function (u) { return u.n === uActual; })[0] || UNIDADES[0]).mods.forEach(function (id) {
      navM.appendChild(el('button', { type: 'button', class: 'subtab' + (id === actual ? ' activo' : ''), 'aria-current': id === actual ? 'page' : null, onclick: function () { mostrar(id); } }, Sim.Modulos[id].titulo));
    });
  }
  global.addEventListener('error', function (e) { UI.error(e.error || e.message); });
  var inicio = (location.hash || '').slice(1);
  mostrar(Sim.Modulos[inicio] ? inicio : UNIDADES[0].mods[0]);
})(window);

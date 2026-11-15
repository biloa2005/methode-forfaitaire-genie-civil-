(function () {
  'use strict';

  /* ---------- Utilitaires ---------- */
  var $ = function (s) { return document.querySelector(s); };
  var pn = function (v) { return parseFloat(String(v).trim().replace(',', '.')); };
  var fmt = function (x, d) {
    if (d === undefined) d = 2;
    return Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
  };
  var letter = function (i) { return String.fromCharCode(65 + i); };

  /* ---------- État ---------- */
  var state = {
    spans: [
      { l: '4,50', G: '12', Q: '5' },
      { l: '5,00', G: '12', Q: '5' },
      { l: '4,80', G: '12', Q: '5' }
    ],
    etat: 'ELU'
  };
  var MAX_SPANS = 10, MIN_SPANS = 2;

  /* ---------- Saisie ---------- */
  function renderRows() {
    $('#rows').innerHTML = state.spans.map(function (s, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><input type="text" inputmode="decimal" aria-label="Longueur travée ' + (i + 1) + '" data-i="' + i + '" data-k="l" value="' + s.l + '"></td>' +
        '<td><input type="text" inputmode="decimal" aria-label="G travée ' + (i + 1) + '" data-i="' + i + '" data-k="G" value="' + s.G + '"></td>' +
        '<td><input type="text" inputmode="decimal" aria-label="Q travée ' + (i + 1) + '" data-i="' + i + '" data-k="Q" value="' + s.Q + '"></td>' +
        '</tr>';
    }).join('');
  }

  /* ---------- Calcul ---------- */
  function compute(spans, etat) {
    var n = spans.length;
    var T = spans.map(function (s) { return { l: pn(s.l), G: pn(s.G), Q: pn(s.Q) }; });
    for (var k = 0; k < n; k++) {
      var t = T[k];
      if (!(t.l > 0) || !(t.G >= 0) || !(t.Q >= 0) || !(t.G + t.Q > 0)) return null;
    }
    T.forEach(function (t) {
      t.p = etat === 'ELU' ? 1.35 * t.G + 1.5 * t.Q : t.G + t.Q;
      t.M0 = t.p * t.l * t.l / 8;
      t.alpha = t.Q / (t.G + t.Q);
    });

    // Moments sur appuis (valeurs absolues)
    var coef = new Array(n + 1).fill(0);
    var Ma = new Array(n + 1).fill(0);
    for (var i = 1; i < n; i++) {
      coef[i] = n === 2 ? 0.6 : ((i === 1 || i === n - 1) ? 0.5 : 0.4);
      Ma[i] = coef[i] * Math.max(T[i - 1].M0, T[i].M0);
    }
    var chapeau = [0.15 * T[0].M0, 0.15 * T[n - 1].M0];

    // Majoration de l'effort tranchant
    var maj = new Array(n + 1).fill(1);
    for (var j = 1; j < n; j++) {
      if (n === 2) maj[j] = 1.15;
      else if (j === 1 || j === n - 1) maj[j] = 1.10;
    }

    // Moments en travée et efforts tranchants
    T.forEach(function (t, i) {
      var rive = (i === 0 || i === n - 1);
      t.rive = rive;
      t.Mw = Ma[i];
      t.Me = Ma[i + 1];
      t.minA = Math.max(1.05 * t.M0, (1 + 0.3 * t.alpha) * t.M0);
      t.a = t.minA - (t.Mw + t.Me) / 2;
      t.bCoef = rive ? (1.2 + 0.3 * t.alpha) : (1 + 0.3 * t.alpha);
      t.b = t.bCoef * t.M0 / 2;
      t.Mt = Math.max(t.a, t.b);
      t.V0 = t.p * t.l / 2;
      t.majW = maj[i];
      t.majE = maj[i + 1];
      t.Vw = t.V0 * t.majW;
      t.Ve = t.V0 * t.majE;
    });

    return { n: n, T: T, Ma: Ma, coef: coef, chapeau: chapeau, maj: maj, etat: etat };
  }

  function conditions(T, opts) {
    var list = [];
    var qOk = T.every(function (t) { return t.Q <= 2 * t.G; });
    if (qOk) list.push({ ok: true, txt: 'Charge d’exploitation modérée : Q ≤ 2G sur toutes les travées.' });
    else if (opts.qsurf) list.push({ ok: true, txt: 'Q > 2G sur au moins une travée, mais Q ≤ 5 kN/m² est confirmé.' });
    else list.push({ ok: false, txt: 'Q > 2G sur au moins une travée : confirmez Q ≤ 5 kN/m², sinon utilisez la méthode de Caquot.' });

    list.push(opts.inertie
      ? { ok: true, txt: 'Moment d’inertie constant dans toutes les travées.' }
      : { ok: false, txt: 'Moment d’inertie variable : la méthode forfaitaire ne s’applique pas.' });

    var bad = [];
    for (var i = 0; i < T.length - 1; i++) {
      var r = T[i].l / T[i + 1].l;
      if (r < 0.8 || r > 1.25) bad.push('travées ' + (i + 1) + ' et ' + (i + 2) + ' : ' + fmt(r));
    }
    list.push(bad.length
      ? { ok: false, txt: 'Rapport des portées successives hors de [0,8 ; 1,25] (' + bad.join(' ; ') + ').' }
      : { ok: true, txt: 'Rapport des portées successives compris entre 0,8 et 1,25.' });

    list.push(opts.fiss
      ? { ok: true, txt: 'Fissuration peu préjudiciable ou non préjudiciable.' }
      : { ok: false, txt: 'Fissuration très préjudiciable : la méthode forfaitaire ne s’applique pas.' });
    return list;
  }

  /* ---------- Géométrie des schémas ---------- */
  var W = 760, ML = 36, MR = 36;
  function abscissas(T) {
    var total = T.reduce(function (s, t) { return s + t.l; }, 0);
    var xs = [ML];
    T.forEach(function (t) { xs.push(xs[xs.length - 1] + t.l / total * (W - ML - MR)); });
    return xs;
  }
  function svgSupports(xs, y) {
    return xs.map(function (x) {
      return '<polygon class="sup" points="' + x + ',' + y + ' ' + (x - 9) + ',' + (y + 16) + ' ' + (x + 9) + ',' + (y + 16) + '"/>';
    }).join('');
  }
  function f1(x) { return x.toFixed(1); }

  function drawBeam(r) {
    var xs = abscissas(r.T), by = 62, h = 130;
    var s = '<svg viewBox="0 0 ' + W + ' ' + h + '" role="img" aria-label="Schéma de la poutre et de ses charges">';
    r.T.forEach(function (t, i) {
      s += '<rect class="load" x="' + f1(xs[i] + 2) + '" y="18" width="' + f1(xs[i + 1] - xs[i] - 4) + '" height="30"/>';
      s += '<text x="' + f1((xs[i] + xs[i + 1]) / 2) + '" y="38" text-anchor="middle">p = ' + fmt(t.p) + ' kN/m</text>';
      s += '<line class="thin" x1="' + f1(xs[i]) + '" y1="104" x2="' + f1(xs[i + 1]) + '" y2="104"/>';
      s += '<line class="thin" x1="' + f1(xs[i]) + '" y1="99" x2="' + f1(xs[i]) + '" y2="109"/>';
      s += '<line class="thin" x1="' + f1(xs[i + 1]) + '" y1="99" x2="' + f1(xs[i + 1]) + '" y2="109"/>';
      s += '<text class="dim" x="' + f1((xs[i] + xs[i + 1]) / 2) + '" y="121" text-anchor="middle">l' + (i + 1) + ' = ' + fmt(t.l) + ' m</text>';
    });
    s += '<line class="ax" x1="' + xs[0] + '" y1="' + by + '" x2="' + xs[xs.length - 1] + '" y2="' + by + '" style="stroke-width:3"/>';
    s += svgSupports(xs, by + 1);
    xs.forEach(function (x, i) {
      s += '<text x="' + f1(x) + '" y="' + (by + 34) + '" text-anchor="middle" style="font-weight:600">' + letter(i) + '</text>';
    });
    return s + '</svg>';
  }

  function sampleMoment(t, xa, xb, N) {
    var pts = [];
    for (var k = 0; k <= N; k++) {
      var e = k / N;
      var M = -t.Mw * (1 - e) - t.Me * e + 4 * (t.Mt + (t.Mw + t.Me) / 2) * e * (1 - e);
      pts.push({ x: xa + (xb - xa) * e, M: M });
    }
    return pts;
  }

  function drawMoments(r) {
    var xs = abscissas(r.T);
    var all = r.T.map(function (t, i) { return sampleMoment(t, xs[i], xs[i + 1], 40); });
    var mmax = 0, mmin = 0;
    all.forEach(function (pts) { pts.forEach(function (p) { mmax = Math.max(mmax, p.M); mmin = Math.min(mmin, p.M); }); });
    var span = mmax - mmin || 1;
    var sc = 130 / span;
    var base = 30 + (-mmin) * sc;
    var h = Math.round(base + mmax * sc + 34);
    var s = '<svg viewBox="0 0 ' + W + ' ' + h + '" role="img" aria-label="Diagramme des moments fléchissants">';
    all.forEach(function (pts) {
      var d = pts.map(function (p, k) { return (k ? 'L' : 'M') + f1(p.x) + ' ' + f1(base + p.M * sc); }).join(' ');
      d += ' L' + f1(pts[pts.length - 1].x) + ' ' + f1(base) + ' L' + f1(pts[0].x) + ' ' + f1(base) + ' Z';
      s += '<path class="mcurve" d="' + d + '"/>';
    });
    s += '<line class="ax" x1="' + xs[0] + '" y1="' + f1(base) + '" x2="' + xs[xs.length - 1] + '" y2="' + f1(base) + '"/>';
    xs.forEach(function (x) { s += '<line class="thin" x1="' + f1(x) + '" y1="' + f1(base - 8) + '" x2="' + f1(x) + '" y2="' + f1(base + 8) + '"/>'; });
    r.T.forEach(function (t, i) {
      var pts = all[i], top = 0;
      pts.forEach(function (p) { top = Math.max(top, p.M); });
      s += '<text x="' + f1((xs[i] + xs[i + 1]) / 2) + '" y="' + f1(base + top * sc + 16) + '" text-anchor="middle" style="font-weight:600">Mt = ' + fmt(t.Mt) + '</text>';
    });
    for (var i = 1; i < r.n; i++) {
      s += '<text x="' + f1(xs[i]) + '" y="' + f1(base - r.Ma[i] * sc - 8) + '" text-anchor="middle" style="font-weight:600">−' + fmt(r.Ma[i]) + '</text>';
    }
    s += '<text class="dim" x="' + (W - MR) + '" y="16" text-anchor="end">kN·m, côté fibre tendue</text>';
    return s + '</svg>';
  }

  function drawShear(r) {
    var xs = abscissas(r.T);
    var vmax = 0;
    r.T.forEach(function (t) { vmax = Math.max(vmax, t.Vw, t.Ve); });
    var sc = 70 / (vmax || 1);
    var base = 28 + vmax * sc;
    var h = Math.round(base + vmax * sc + 28);
    var s = '<svg viewBox="0 0 ' + W + ' ' + h + '" role="img" aria-label="Diagramme des efforts tranchants">';
    r.T.forEach(function (t, i) {
      var x0 = xs[i], x1 = xs[i + 1];
      var yw = base - t.Vw * sc, ye = base + t.Ve * sc;
      s += '<polygon class="vcurve" points="' + f1(x0) + ',' + f1(base) + ' ' + f1(x0) + ',' + f1(yw) + ' ' + f1(x1) + ',' + f1(ye) + ' ' + f1(x1) + ',' + f1(base) + '"/>';
      s += '<text x="' + f1(x0 + 5) + '" y="' + f1(yw - 6) + '" style="font-weight:600">+' + fmt(t.Vw) + '</text>';
      s += '<text x="' + f1(x1 - 5) + '" y="' + f1(ye + 15) + '" text-anchor="end" style="font-weight:600">−' + fmt(t.Ve) + '</text>';
    });
    s += '<line class="ax" x1="' + xs[0] + '" y1="' + f1(base) + '" x2="' + xs[xs.length - 1] + '" y2="' + f1(base) + '"/>';
    xs.forEach(function (x) { s += '<line class="thin" x1="' + f1(x) + '" y1="' + f1(base - 8) + '" x2="' + f1(x) + '" y2="' + f1(base + 8) + '"/>'; });
    s += '<text class="dim" x="' + (W - MR) + '" y="14" text-anchor="end">kN</text>';
    return s + '</svg>';
  }

  /* ---------- Tableaux et détail ---------- */
  function tableSpans(r) {
    var rows = r.T.map(function (t, i) {
      return '<tr><td>Travée ' + (i + 1) + ' (' + letter(i) + letter(i + 1) + ')</td>' +
        '<td data-label="l (m)">' + fmt(t.l) + '</td>' +
        '<td data-label="p (kN/m)">' + fmt(t.p) + '</td>' +
        '<td data-label="M₀ (kN·m)">' + fmt(t.M0) + '</td>' +
        '<td data-label="α">' + fmt(t.alpha, 3) + '</td>' +
        '<td data-label="Mw (kN·m)">' + fmt(t.Mw) + '</td>' +
        '<td data-label="Me (kN·m)">' + fmt(t.Me) + '</td>' +
        '<td class="key" data-label="Mt (kN·m)">' + fmt(t.Mt) + '</td>' +
        '<td data-label="Vw (kN)">' + fmt(t.Vw) + '</td>' +
        '<td data-label="Ve (kN)">' + fmt(t.Ve) + '</td></tr>';
    }).join('');
    return '<div class="scroll"><table class="data stack"><thead><tr>' +
      '<th>Travée</th><th>l (m)</th><th>p (kN/m)</th><th>M₀ (kN·m)</th><th>α</th>' +
      '<th>Mw (kN·m)</th><th>Me (kN·m)</th><th>Mt (kN·m)</th><th>Vw (kN)</th><th>Ve (kN)</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function tableSupports(r) {
    var rows = '';
    for (var i = 0; i <= r.n; i++) {
      var rive = (i === 0 || i === r.n);
      var m0 = rive ? r.T[i === 0 ? 0 : r.n - 1].M0 : Math.max(r.T[i - 1].M0, r.T[i].M0);
      var note = rive ? 'Appui de rive : chapeau de ' + fmt(r.chapeau[i === 0 ? 0 : 1]) + ' kN·m (0,15 M₀)' : 'Appui intermédiaire';
      rows += '<tr><td>Appui ' + letter(i) + '</td>' +
        '<td data-label="Coefficient">' + (rive ? '0' : fmt(r.coef[i], 1)) + '</td>' +
        '<td data-label="M₀ max adjacent (kN·m)">' + fmt(m0) + '</td>' +
        '<td class="key" data-label="|Ma| (kN·m)">' + fmt(rive ? 0 : r.Ma[i]) + '</td>' +
        '<td class="note" data-label="Remarque">' + note + '</td></tr>';
    }
    return '<div class="scroll"><table class="data stack"><thead><tr>' +
      '<th>Appui</th><th>Coefficient</th><th>M₀ max adjacent (kN·m)</th><th>|Ma| (kN·m)</th><th style="text-align:left">Remarque</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function detail(r) {
    var out = '';
    r.T.forEach(function (t, i) {
      out += '<div class="calc"><h4>Travée ' + (i + 1) + ' (' + letter(i) + letter(i + 1) + ') – ' + (t.rive ? 'travée de rive' : 'travée intermédiaire') + '</h4>' +
        '<p>p = ' + (r.etat === 'ELU' ? '1,35 G + 1,5 Q' : 'G + Q') + ' = ' + fmt(t.p) + ' kN/m</p>' +
        '<p>M₀ = p·l² / 8 = ' + fmt(t.p) + ' × ' + fmt(t.l) + '² / 8 = ' + fmt(t.M0) + ' kN·m</p>' +
        '<p>α = Q / (G + Q) = ' + fmt(t.alpha, 3) + '</p>' +
        '<p>Mt ≥ max(1,05 M₀ ; (1 + 0,3α) M₀) − (Mw + Me) / 2 = ' + fmt(t.minA) + ' − ' + fmt((t.Mw + t.Me) / 2) + ' = ' + fmt(t.a) + ' kN·m</p>' +
        '<p>Mt ≥ ' + (t.rive ? '(1,2 + 0,3α)' : '(1 + 0,3α)') + ' M₀ / 2 = ' + fmt(t.b) + ' kN·m</p>' +
        '<p class="res">Mt retenu = ' + fmt(t.Mt) + ' kN·m</p>' +
        '<p>V₀ = p·l / 2 = ' + fmt(t.V0) + ' kN' +
        (t.majW > 1 ? ' ; majoration de ' + Math.round((t.majW - 1) * 100) + ' % à gauche' : '') +
        (t.majE > 1 ? ' ; majoration de ' + Math.round((t.majE - 1) * 100) + ' % à droite' : '') + '</p>' +
        '<p class="res">Vw = ' + fmt(t.Vw) + ' kN ; Ve = ' + fmt(t.Ve) + ' kN</p></div>';
    });
    return '<details><summary>Détail du calcul, travée par travée</summary>' + out + '</details>';
  }

  /* ---------- Rendu ---------- */
  function update() {
    var opts = { inertie: $('#c-inertie').checked, fiss: $('#c-fiss').checked, qsurf: $('#c-qsurf').checked };
    var r = compute(state.spans, state.etat);
    var el = $('#results');
    if (!r) {
      el.innerHTML = '<div class="block"><p class="empty">Renseignez une longueur strictement positive et des charges G et Q positives pour chaque travée.</p></div>';
      return;
    }
    // Largeur des schémas : celle du conteneur, avec un minimum selon le nombre de travées
    var avail = el.clientWidth - 2;
    W = Math.min(1000, Math.max(avail > 0 ? avail : 760, r.n * 100 + 72));
    var conds = conditions(r.T, opts);
    var okAll = conds.every(function (c) { return c.ok; });

    var html = '';
    html += '<div class="block"><h2>Conditions d’application</h2>' +
      '<p class="verdict ' + (okAll ? 'ok' : 'bad') + '">' +
      (okAll ? 'La méthode forfaitaire est applicable.' : 'La méthode forfaitaire n’est pas applicable : utilisez la méthode de Caquot. Les résultats ci-dessous sont indicatifs.') + '</p>' +
      '<ul class="conds">' + conds.map(function (c) {
        return '<li class="' + (c.ok ? 'ok' : 'bad') + '"><span class="mark" aria-hidden="true">' + (c.ok ? '✓' : '✗') + '</span><span><span class="sr">' + (c.ok ? 'Vérifiée : ' : 'Non vérifiée : ') + '</span>' + c.txt + '</span></li>';
      }).join('') + '</ul></div>';

    html += '<div class="block"><h2>Poutre et charges (' + r.etat + ')</h2><div class="figure">' + drawBeam(r) + '</div></div>';
    html += '<div class="block"><h2>Moments fléchissants</h2><div class="figure">' + drawMoments(r) + '</div>' +
      '<p class="caption">Tracé schématique : parabole passant par les moments d’appui et par Mt à mi-travée.</p></div>';
    html += '<div class="block"><h2>Efforts tranchants</h2><div class="figure">' + drawShear(r) + '</div>' +
      '<p class="caption">Efforts de la poutre isostatique, majorés sur les appuis voisins des appuis de rive (15 % pour 2 travées, 10 % au-delà).</p></div>';
    html += '<div class="block"><h2>Résultats</h2>' +
      '<h3 class="sub">Travées</h3>' + tableSpans(r) +
      '<h3 class="sub">Appuis</h3>' + tableSupports(r) + '</div>';
    html += '<div class="block no-print">' + detail(r) + '</div>';
    el.innerHTML = html;
    el.querySelectorAll('.figure svg').forEach(function (svg) { svg.style.minWidth = W + 'px'; });
    lastWidth = el.clientWidth;
  }
  var lastWidth = 0, resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if ($('#results').clientWidth !== lastWidth) update();
    }, 150);
  });

  /* ---------- Événements ---------- */
  $('#rows').addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.i !== undefined) {
      state.spans[+t.dataset.i][t.dataset.k] = t.value;
      update();
    }
  });
  document.querySelectorAll('input[name="etat"]').forEach(function (r) {
    r.addEventListener('change', function () { state.etat = r.value; update(); });
  });
  ['#c-inertie', '#c-fiss', '#c-qsurf'].forEach(function (id) { $(id).addEventListener('change', update); });

  $('#add').addEventListener('click', function () {
    if (state.spans.length >= MAX_SPANS) return;
    var last = state.spans[state.spans.length - 1];
    state.spans.push({ l: last.l, G: last.G, Q: last.Q });
    renderRows(); update();
  });
  $('#remove').addEventListener('click', function () {
    if (state.spans.length <= MIN_SPANS) return;
    state.spans.pop();
    renderRows(); update();
  });
  $('#example').addEventListener('click', function () {
    state.spans = [
      { l: '4,50', G: '12', Q: '5' },
      { l: '5,00', G: '12', Q: '5' },
      { l: '4,80', G: '12', Q: '5' }
    ];
    renderRows(); update();
  });
  $('#print').addEventListener('click', function () { window.print(); });

  /* ---------- Démarrage ---------- */
  renderRows();
  update();
})();

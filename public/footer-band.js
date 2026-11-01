// Footer band: Epiphany's own things in a row (a map pin, candles, a flight, the weather, coins, the globe), cut like a line engraving in plain 2D canvas. Faint rules
// run across the band; inside the glyphs they thicken, and thicken again on the edge facing away from the light, so the
// glyphs look cut into the page. Drawn once per size and theme. Same engine as the Hermes landing; only the glyphs differ.
(function () {
  var band = document.querySelector('.word-band'), canvas = band && band.querySelector('canvas');
  if (!canvas) return;

  // Each glyph is drawn white on a 100 unit square.
  var GLYPHS = [
    function (c) { // a map pin
      c.beginPath(); c.arc(50, 38, 24, Math.PI, 0); c.lineTo(50, 90); c.closePath(); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(50, 38, 10, 0, 7); c.fill();
    },
    function (c) { // markets: candles on a rising line
      [[18, 52, 26], [36, 40, 30], [54, 46, 22], [72, 24, 34]].forEach(function (k) { c.fillRect(k[0], k[1], 12, k[2]); c.fillRect(k[0] + 5, k[1] - 8, 2.5, k[2] + 16); });
    },
    function (c) { // a flight overhead
      c.beginPath(); c.moveTo(50, 10); c.lineTo(56, 40); c.lineTo(90, 56); c.lineTo(90, 64); c.lineTo(56, 56); c.lineTo(54, 78); c.lineTo(64, 86); c.lineTo(64, 90);
      c.lineTo(50, 86); c.lineTo(36, 90); c.lineTo(36, 86); c.lineTo(46, 78); c.lineTo(44, 56); c.lineTo(10, 64); c.lineTo(10, 56); c.lineTo(44, 40); c.closePath(); c.fill();
    },
    function (c) { // weather: a cloud with rain
      c.beginPath(); c.arc(36, 46, 16, 0, 7); c.arc(56, 38, 20, 0, 7); c.arc(72, 50, 14, 0, 7); c.fill(); c.fillRect(22, 48, 52, 16);
      c.lineWidth = 5; c.lineCap = 'round'; [30, 48, 66].forEach(function (x) { c.beginPath(); c.moveTo(x, 72); c.lineTo(x - 5, 86); c.stroke(); });
    },
    function (c) { // money: a stack of coins
      for (var i = 0; i < 4; i++) { c.beginPath(); c.ellipse(50, 78 - i * 14, 30, 9, 0, 0, 7); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.ellipse(50, 74 - i * 14, 30, 9, 0, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; }
      c.beginPath(); c.ellipse(50, 26, 30, 9, 0, 0, 7); c.fill();
    },
    function (c) { // the world on one screen
      c.lineWidth = 6; c.beginPath(); c.arc(50, 50, 36, 0, 7); c.stroke();
      c.beginPath(); c.ellipse(50, 50, 15, 36, 0, 0, 7); c.stroke();
      c.beginPath(); c.moveTo(14, 50); c.lineTo(86, 50); c.moveTo(20, 32); c.lineTo(80, 32); c.moveTo(20, 68); c.lineTo(80, 68); c.stroke();
    }
  ];
  // Lays the glyphs out evenly across a w by h 2D context, in the given colour: one row, or two on a narrow band.
  function grid(w, h) {
    var n = GLYPHS.length, rows = w < h * 3 ? 2 : 1, per = Math.ceil(n / rows);
    return { rows: rows, per: per, cell: Math.min(h / rows * 0.86, w / per) };
  }
  function paint(c, w, h, colour) {
    var g = grid(w, h), gap = (w - g.cell * g.per) / g.per, rowH = h / g.rows;
    GLYPHS.forEach(function (draw, i) {
      var col = i % g.per, row = Math.floor(i / g.per);
      c.save(); c.translate(gap / 2 + col * (g.cell + gap), row * rowH + (rowH - g.cell) / 2 + rowH * 0.04); c.scale(g.cell / 100, g.cell / 100);
      c.fillStyle = c.strokeStyle = colour; draw(c); c.restore();
    });
  }

  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  function layer(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // Horizontal rules `t` px thick, one every `pitch` px, kept only where `mask` is drawn (everywhere when null).
  function rules(w, h, pitch, t, colour, mask) {
    var c = layer(w, h), x = c.getContext('2d');
    x.fillStyle = colour;
    for (var y = 0; y < h; y += pitch) x.fillRect(0, Math.round(y + (pitch - t) / 2), w, Math.max(1, Math.round(t)));
    if (mask) { x.globalCompositeOperation = 'destination-in'; x.drawImage(mask, 0, 0); }
    return c;
  }
  var drawnW = 0;
  function draw() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    drawnW = w; canvas.width = w; canvas.height = h;
    var colour = getComputedStyle(band).color, pitch = Math.min(5 * dpr, Math.max(3 * dpr, grid(w, h).cell / 22)), s = Math.max(2, h * 0.014);
    var glyphs = layer(w, h); paint(glyphs.getContext('2d'), w, h, '#fff');
    // the shadow side: glyph pixels whose neighbour down and right is outside the glyph (light from the top left)
    var shade = layer(w, h), sc = shade.getContext('2d');
    sc.drawImage(glyphs, 0, 0); sc.globalCompositeOperation = 'destination-out'; sc.drawImage(glyphs, -s, -s);
    ctx.globalAlpha = 0.28; ctx.drawImage(rules(w, h, pitch, dpr * 0.75, colour, null), 0, 0);
    ctx.globalAlpha = 1; ctx.drawImage(rules(w, h, pitch, pitch * 0.32, colour, glyphs), 0, 0);
    ctx.drawImage(rules(w, h, pitch, pitch * 0.6, colour, shade), 0, 0);
    // fade out toward the legal line
    var g = ctx.createLinearGradient(0, h * 0.88, 0, h);
    g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  band.classList.add('live');
  draw();
  // iOS fires resize as the toolbar slides; only a width change needs a redraw
  window.addEventListener('resize', function () { if (Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2)) !== drawnW) draw(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
})();

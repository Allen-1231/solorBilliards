/* ================= 太陽系撞球：場景、材質、球 ================= */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var DEG = Math.PI / 180, TAU = Math.PI * 2;
  var M4 = E.M, Q = E.Q;
  var DBG = /debug/.test(location.hash);

  var canvas = $('#scene'), eng;
  try { eng = new E.Engine(canvas); }
  catch (e) { $('#msg').textContent = '這個瀏覽器無法啟動 WebGL2，無法顯示 3D 撞球檯。'; return; }
  var gl = eng.gl;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- 球檯尺寸（單位：球半徑 R = 1.6） ---------- */
  var R = 1.6, HL = 62.5, HW = 31.25;            // 球檯半長 / 半寬（邊界線位置）
  var GC = 5.8, GS = 4.0, KR = 0.5;          // 角袋缺口、邊袋缺口、袋口擋角半徑
  var HEAD_X = -31, FOOT_X = 31;
  var RACK_D = Math.sqrt(3) * R;             // 相鄰兩排的間距
  var SUN_X = FOOT_X + 2 * RACK_D;           // 太陽（8 號）起始位置

  /* ---------- 天體資料 ---------- */
  var DEFS = [
    { n: 1, id: 'mercury', name: '水星', en: 'Mercury', grp: 'A', tex: 'mercury', bump: 'mercuryBump', bumpK: 2.0, bumpTexel: [1024, 512] },
    { n: 2, id: 'venus', name: '金星', en: 'Venus', grp: 'A', tex: 'venus', atmo: { c: [1.0, 0.80, 0.45], k: 0.95, s: 1.07 }, rim: [1.0, 0.85, 0.55], rimK: 0.45 },
    { n: 3, id: 'earth', name: '地球', en: 'Earth', grp: 'A', earth: true, atmo: { c: [0.30, 0.56, 1.0], k: 1.0, s: 1.085 } },
    { n: 4, id: 'mars', name: '火星', en: 'Mars', grp: 'A', tex: 'mars', bump: 'marsBump', bumpK: 2.4, bumpTexel: [1024, 512], atmo: { c: [0.95, 0.62, 0.42], k: 0.45, s: 1.05 }, rim: [0.95, 0.6, 0.4], rimK: 0.25 },
    { n: 5, id: 'moon', name: '月球', en: 'Moon', grp: 'A', tex: 'moon', bump: 'moonBump', bumpK: 2.6, bumpTexel: [1440, 720] },
    { n: 6, id: 'io', name: '木衛一', en: 'Io', grp: 'A', tex: 'io' },
    { n: 7, id: 'europa', name: '木衛二', en: 'Europa', grp: 'A', tex: 'europa' },
    { n: 8, id: 'sun', name: '太陽', en: 'Sun', grp: 'E', sun: true },
    { n: 9, id: 'jupiter', name: '木星', en: 'Jupiter', grp: 'B', tex: 'jupiter', atmo: { c: [0.85, 0.78, 0.66], k: 0.28, s: 1.035 } },
    { n: 10, id: 'saturn', name: '土星', en: 'Saturn', grp: 'B', tex: 'saturn', ring: true, atmo: { c: [0.95, 0.86, 0.62], k: 0.24, s: 1.035 } },
    { n: 11, id: 'uranus', name: '天王星', en: 'Uranus', grp: 'B', tex: 'uranus', atmo: { c: [0.55, 0.92, 0.96], k: 0.65, s: 1.05 } },
    { n: 12, id: 'neptune', name: '海王星', en: 'Neptune', grp: 'B', tex: 'neptune', atmo: { c: [0.30, 0.50, 1.0], k: 0.75, s: 1.05 } },
    { n: 13, id: 'pluto', name: '冥王星', en: 'Pluto', grp: 'B', tex: 'pluto', bump: 'plutoBump', bumpK: 1.6, bumpTexel: [1000, 500] },
    { n: 14, id: 'ganymede', name: '木衛三', en: 'Ganymede', grp: 'B', tex: 'ganymede' },
    { n: 15, id: 'callisto', name: '木衛四', en: 'Callisto', grp: 'B', tex: 'callisto' }
  ];
  var GCOL = { A: [0.35, 0.82, 1.0], B: [1.0, 0.71, 0.33], E: [0.79, 0.72, 1.0], C: [0.85, 0.93, 1.0] };
  var GNAME = { A: '類地組', B: '類木組' };

  /* ---------- 貼圖載入 ---------- */
  var T = {}, thumbs = {}, texTotal = Object.keys(TEX).length, texDone = 0, ready = false;
  var msgEl = $('#msg');
  Object.keys(TEX).forEach(function (k) {
    var img = new Image();
    img.onload = function () {
      T[k] = eng.texture(img, { repeatS: k !== 'ring' });
      texDone++; msgEl.textContent = '載入天體貼圖 ' + texDone + ' / ' + texTotal;
      if (texDone === texTotal) onTexturesReady();
    };
    img.onerror = function () { texDone++; if (texDone === texTotal) onTexturesReady(); };
    img.src = TEX[k];
  });

  /* ---------- 著色器程式 ---------- */
  var PRG = {};
  function buildPrograms() {
    PRG.planet = eng.program(PLANET_VS, PLANET_FS, 'planet');
    PRG.earth = eng.program(PLANET_VS, EARTH_FS, 'earth');
    PRG.cloud = eng.program(CLOUD_VS, CLOUD_FS, 'cloud');
    PRG.atmo = eng.program(ATMO_VS, ATMO_FS, 'atmo');
    PRG.ring = eng.program(RING_VS, RING_FS, 'ring');
    PRG.sun = eng.program(SUN_VS, SUN_FS, 'sun');
    PRG.field = eng.program(FLAT_VS, FIELD_FS, 'field');
    PRG.hole = eng.program(FLAT_VS, HOLE_FS, 'hole');
    PRG.decal = eng.program(FLAT_VS, DECAL_FS, 'decal');
    PRG.decalB = eng.program(BILLBOARD_VS, DECAL_FS, 'decalB');
    PRG.ribbon = eng.program(FLAT_VS, RIBBON_FS, 'ribbon');
    PRG.cue = eng.program(CUE_VS, CUE_FS, 'cue');
    PRG.points = eng.program(POINTS_VS, POINTS_FS, 'points');
    PRG.texq = eng.program(FLAT_VS, TEXQUAD_FS, 'texq');
    PRG.sky = eng.program(SKY_VS, SKY_FS, 'sky');
    PRG.glass = eng.program(BOX_VS, GLASS_FS, 'glass');
    PRG.dust = eng.program(DUST_VS, POINTS_FS, 'dust');
    PRG.stars = eng.program(STAR_VS, POINTS_FS, 'stars');
    PRG.pfx = eng.program(FLAT_VS, PFX_FS, 'pfx');
    PRG.surface = eng.program(FLAT_VS, SURFACE_FS, 'surface');
    PRG.comet = eng.program(FLAT_VS, COMET_FS, 'comet');
  }

  /* ---------- 幾何 ---------- */
  var GEO = {};
  function buildGeometry() {
    GEO.sphere = eng.geometry(E.geo.sphere(1, 96, 64));
    GEO.sphereHi = eng.geometry(E.geo.sphere(1, 160, 96));
    GEO.shell = eng.geometry(E.geo.sphere(1, 64, 40));
    GEO.flat = eng.geometry(E.geo.flat());
    GEO.upright = eng.geometry(E.geo.upright());
    GEO.ring = eng.geometry(E.geo.ring(1.22, 1.92, 128));
    GEO.box = eng.geometry(E.geo.box());
    GEO.cue = eng.geometry(E.geo.cue([
      { y: 0, r: 0.24, c: [0.45, 0.85, 1.0] },        // 皮頭（發光藍）
      { y: 0.4, r: 0.26, c: [0.55, 0.9, 1.0] },
      { y: 0.5, r: 0.3, c: [0.92, 0.95, 1.0] },       // 金屬套環
      { y: 1.6, r: 0.31, c: [0.9, 0.93, 1.0] },
      { y: 1.7, r: 0.33, c: [0.85, 0.66, 0.42] },     // 桿身（淺色木紋）
      { y: 20, r: 0.5, c: [0.75, 0.55, 0.33] },
      { y: 22, r: 0.52, c: [0.2, 0.22, 0.3] },        // 握把（深色）
      { y: 23.2, r: 0.58, c: [0.55, 0.78, 1.0] },     // 發光環
      { y: 23.6, r: 0.6, c: [0.12, 0.14, 0.2] },
      { y: 36, r: 0.78, c: [0.1, 0.12, 0.18] },
      { y: 36.4, r: 0.74, c: [0.4, 0.45, 0.6] }
    ], 16));
  }

  /* ---------- 繪製物件 ---------- */
  var SCENE = [];
  function mesh(geo, prog, u, opt) {
    var m = { geo: geo, prog: prog, u: u || {}, world: M4.ident(), loc: new Float32Array(16), pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [1, 1, 1], parent: null, visible: true, blend: 'none', order: 0 };
    if (opt) for (var k in opt) m[k] = opt[k];
    SCENE.push(m);
    return m;
  }
  function upd(m) {
    M4.trs(m.loc, m.pos, m.quat, m.scale);
    m.world = m.parent ? M4.mul(m.parent.world, m.loc) : m.loc;
  }
  function quatFromTo(a, b) {         // 單位向量 a → b 的旋轉
    var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    if (d > 0.99999) return [0, 0, 0, 1];
    var ax = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return Q.axis(ax[0], ax[1], ax[2], Math.acos(Math.max(-1, Math.min(1, d))));
  }

  /* ---------- 母球貼圖（冰晶彗星） ---------- */
  function makeCueTexture() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#eef6ff'; g.fillRect(0, 0, 512, 256);
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 1400; i++) {
      var x = rnd() * 512, y = rnd() * 256, r = 1 + rnd() * 5;
      g.fillStyle = 'rgba(' + (150 + rnd() * 60 | 0) + ',' + (190 + rnd() * 50 | 0) + ',255,' + (0.05 + rnd() * 0.12) + ')';
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(120,170,230,0.28)'; g.lineWidth = 1.2;
    for (i = 0; i < 26; i++) {
      var x0 = rnd() * 512, y0 = rnd() * 256; g.beginPath(); g.moveTo(x0, y0);
      for (var k = 0; k < 4; k++) { x0 += (rnd() - 0.5) * 60; y0 += (rnd() - 0.5) * 40; g.lineTo(x0, y0); }
      g.stroke();
    }
    for (i = 0; i < 9; i++) {
      var cx = rnd() * 512, cy = 40 + rnd() * 176, cr = 6 + rnd() * 14;
      var gr = g.createRadialGradient(cx - cr * 0.2, cy - cr * 0.2, 1, cx, cy, cr);
      gr.addColorStop(0, 'rgba(100,140,200,0.35)'); gr.addColorStop(1, 'rgba(100,140,200,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill();
    }
    return c;
  }

  /* ---------- 星空與星雲 ---------- */
  var sky = { meshes: [] };
  function buildSky() {
    function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.58; }
    function make(n, bandFrac, size, alpha) {
      var pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      var nrm = E.v.norm([0.32, 0.88, 0.34]);
      var q = quatFromTo([0, 1, 0], nrm);
      var rot = M4.trs(new Float32Array(16), [0, 0, 0], q, [1, 1, 1]);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * TAU, v;
        if (Math.random() < bandFrac) {
          var lat = gauss() * 0.13;
          v = [Math.cos(a) * Math.cos(lat), Math.sin(lat), Math.sin(a) * Math.cos(lat)];
          v = [rot[0] * v[0] + rot[4] * v[1] + rot[8] * v[2], rot[1] * v[0] + rot[5] * v[1] + rot[9] * v[2], rot[2] * v[0] + rot[6] * v[1] + rot[10] * v[2]];
        } else {
          var u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u);
          v = [s * Math.cos(a), u, s * Math.sin(a)];
        }
        pos[i * 3] = v[0] * 1500; pos[i * 3 + 1] = v[1] * 1500; pos[i * 3 + 2] = v[2] * 1500;
        var b = 0.3 + Math.pow(Math.random(), 3) * 0.7, w = Math.random();
        var tint = Math.random();
        if (tint < 0.3) { col[i * 3] = b * 0.78; col[i * 3 + 1] = b * 0.6; col[i * 3 + 2] = b; }                 // 淡紫星
        else if (tint < 0.4) { col[i * 3] = b; col[i * 3 + 1] = b * 0.62; col[i * 3 + 2] = b * 0.9; }            // 粉紫星
        else { col[i * 3] = b * (0.85 + 0.15 * w); col[i * 3 + 1] = b * 0.92; col[i * 3 + 2] = b * (1.0 - 0.18 * w); }
      }
      var geo = eng.geometry({ position: pos, aCol: col, mode: 'points' });
      var m = mesh(geo, PRG.stars, { uSize: size * DPR, uAlpha: alpha, uTime: 0 }, { blend: 'add', order: -9, depthTest: false });
      sky.meshes.push(m);
    }
    make(5000, 0.0, 1.7, 1.0);
    make(28000, 0.85, 1.1, 0.5);
    make(180, 0.0, 3.2, 0.9);
    // 流星：數顆交錯劃過背景（在球檯下方的遠處平面）
    sky.shoots = [];
    for (var si = 0; si < 4; si++) {
      var sm = mesh(GEO.flat, PRG.ribbon, { uColor: si % 2 ? [0.85, 0.93, 1.0] : [0.92, 0.82, 1.0], uAlpha: 0, uLen: 60, uDash: 0, uFade: 1, uTime: 0 }, { blend: 'add', order: -8, depthWrite: false, depthTest: false, visible: false });
      sm.next = 1 + si * 2.2 + Math.random() * 3; sm.t0 = -1; sky.shoots.push(sm);
    }
    // 星雲天球（跟著鏡頭移動，沒有視差）
    sky.dome = mesh(GEO.shell, PRG.sky, { uTime: 0 }, { order: -11, depthTest: false, depthWrite: false });
    sky.dome.scale = [1800, 1800, 1800];
    // 近處塵埃：有視差，讓人感覺到空間的深度
    function dust(n, size, alpha, box, flow) {
      var pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * box[0]; pos[i * 3 + 1] = -20 + Math.random() * box[1]; pos[i * 3 + 2] = (Math.random() - 0.5) * box[2];
        var b = 0.35 + Math.random() * 0.65;
        col[i * 3] = b * 0.8; col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b;
      }
      var m = mesh(eng.geometry({ position: pos, aCol: col, mode: 'points' }), PRG.dust, { uSize: size * DPR, uAlpha: alpha, uBox: [box[0], 0, box[2]], uOff: [0, 0, 0] }, { blend: 'add', order: 1, depthWrite: false });
      m.flow = flow; sky.dust = sky.dust || []; sky.dust.push(m);
    }
    dust(1500, 1.8, 0.4, [420, 90, 300], [4, 0, 1.4]);
    dust(380, 3.0, 0.55, [300, 70, 220], [8, 0, 3]);
  }

  /* ---------- 球檯：力場邊界、黑洞袋口、標線 ---------- */
  var FIELD = { hits: new Float32Array(32), hitIdx: 0, meshes: [] };
  var KNUCKLES = [];          // 袋口擋角（圓）
  var POCKETS = [];           // 袋口：{x,y（邊界上的錨點）, vx,vy（視覺中心）, corner, ox,oy（朝外的單位向量）}
  var decor = { holes: [], pylons: [] };


  /* 透明藍色玻璃框（參考「Cosmic Pool」：發光邊線的半透明球檯框）與星空桌面 */
  var RAILS = { surface: null };
  function buildRails() {
    var CT = 2.2, CH = 3.8, WW = 4.2, WH = 5.0, OFF = 0.07;
    function slab(x, y, z, sx, sy, sz, a, edge) {
      var m = mesh(GEO.box, PRG.glass, { uSize: [sx, sy, sz], uColor: [0.40, 0.76, 1.0], uAlpha: a, uEdge: edge }, { blend: 'add', order: 3, depthWrite: false });
      m.pos = [x, y, z]; m.scale = [sx, sy, sz]; upd(m); return m;
    }
    var surf = mesh(GEO.flat, PRG.surface, { uTime: 0 }, { blend: 'alpha', order: 1, depthWrite: false });
    surf.pos = [0, 0.02, 0]; surf.scale = [HL * 2, 1, HW * 2]; upd(surf); RAILS.surface = surf;
    var cx = (GS + HL - GC) / 2, ln = HL - GC - GS;
    var wx0 = GS + 1.0, wx1 = HL - GC, wcx = (wx0 + wx1) / 2, wln = wx1 - wx0;
    var zc = HW + CT + WW / 2, xc = HL + CT + WW / 2, zl = (HW - GC) * 2;
    [-1, 1].forEach(function (sz) {
      [-1, 1].forEach(function (sx) {
        slab(sx * cx, CH / 2, sz * (HW + OFF + CT / 2), ln, CH, CT, 0.5, 1.0);
        slab(sx * wcx, WH / 2, sz * zc, wln, WH, WW, 0.4, 0.9);
      });
    });
    [-1, 1].forEach(function (sx) {
      slab(sx * (HL + OFF + CT / 2), CH / 2, 0, CT, CH, zl, 0.5, 1.0);
      slab(sx * xc, WH / 2, 0, WW, WH, zl, 0.4, 0.9);
    });
  }

  function buildTable() {
    buildRails();
    // 力場邊界線段
    var segs = [];
    var xa = GS, xb = HL - GC, cx = (xa + xb) / 2, ln = xb - xa;
    [-1, 1].forEach(function (sz) {
      [-1, 1].forEach(function (sx) { segs.push({ x: sx * cx, z: sz * HW, len: ln, rot: 0 }); });
    });
    var zl = HW - GC;
    [-1, 1].forEach(function (sx) { segs.push({ x: sx * HL, z: 0, len: zl * 2, rot: Math.PI / 2 }); });
    segs.forEach(function (s) {
      var q = Q.axis(0, 1, 0, s.rot);
      var strip = mesh(GEO.flat, PRG.field, { uTime: 0, uHits: FIELD.hits, uColor: [0.42, 0.77, 1.0], uCurtain: 0 }, { blend: 'add', order: 2, depthWrite: false });
      strip.pos = [s.x, 0.06, s.z]; strip.quat = q; strip.scale = [s.len, 1, 2.2]; upd(strip);
      var cur = mesh(GEO.upright, PRG.field, { uTime: 0, uHits: FIELD.hits, uColor: [0.42, 0.77, 1.0], uCurtain: 1 }, { blend: 'add', order: 2, depthWrite: false });
      cur.pos = [s.x, 1.6, s.z]; cur.quat = q; cur.scale = [s.len, 3.2, 1]; upd(cur);
      FIELD.meshes.push(strip, cur);
    });
    // 擋角
    [-1, 1].forEach(function (sz) {
      [-1, 1].forEach(function (sx) {
        KNUCKLES.push({ x: sx * GS, y: sz * HW }, { x: sx * (HL - GC), y: sz * HW });
        KNUCKLES.push({ x: sx * HL, y: sz * (HW - GC) });
      });
    });
    // 袋口
    [-1, 1].forEach(function (sz) {
      [-1, 0, 1].forEach(function (sx) {
        var corner = sx !== 0;
        var ax = sx * HL, ay = sz * HW;
        var ox = corner ? sx * 0.7071 : 0, oy = corner ? sz * 0.7071 : sz;
        POCKETS.push({ x: ax, y: ay, vx: ax + ox * 1.1, vy: ay + oy * 1.1, corner: corner, ox: ox, oy: oy });
      });
    });
    POCKETS.forEach(function (p) {
      var D = p.corner ? 13 : 12;
      var h = mesh(GEO.flat, PRG.hole, { uTime: 0 }, { blend: 'premul', order: 3, depthWrite: false });
      h.pos = [p.vx, 0.08, p.vy]; h.scale = [D, 1, D]; upd(h);
      decor.holes.push(h);
      var gl1 = mesh(GEO.flat, PRG.decal, { uColor: [0.45, 0.7, 1.0], uAlpha: 0.22, uMode: 1, uR: 0.97, uW: 0.025, uPow: 1 }, { blend: 'add', order: 3, depthWrite: false });
      gl1.pos = [p.vx, 0.09, p.vy]; gl1.scale = [D * 1.08, 1, D * 1.08]; upd(gl1);
    });
    // 光柱（擋角處的能量樁）
    KNUCKLES.forEach(function (k) {
      var a = mesh(GEO.upright, PRG.decalB, { uCenter: [k.x, 1.0, k.y], uSize: 3.4, uColor: [0.45, 0.8, 1.0], uAlpha: 0.75, uMode: 0, uR: 0, uW: 1, uPow: 2.2 }, { blend: 'add', order: 5, depthWrite: false });
      var b = mesh(GEO.upright, PRG.decalB, { uCenter: [k.x, 1.0, k.y], uSize: 1.1, uColor: [1, 1, 1], uAlpha: 0.95, uMode: 0, uR: 0, uW: 1, uPow: 3 }, { blend: 'add', order: 5, depthWrite: false });
      decor.pylons.push(a, b);
    });
    // 標線：發球線（虛線）與環繞太陽起始位置的軌道圈
    var hs = mesh(GEO.flat, PRG.ribbon, { uColor: [0.55, 0.75, 1.0], uAlpha: 0.2, uLen: HW * 2 - 8, uDash: 2.2, uFade: 0, uTime: 0 }, { blend: 'add', order: 2, depthWrite: false });
    hs.pos = [HEAD_X, 0.05, 0]; hs.quat = Q.axis(0, 1, 0, Math.PI / 2); hs.scale = [HW * 2 - 8, 1, 0.22]; upd(hs);
    [6, 12, 18].forEach(function (r) {
      var o = mesh(GEO.flat, PRG.decal, { uColor: [0.56, 0.71, 0.91], uAlpha: 0.13, uMode: 1, uR: 0.992, uW: 0.006 + 0.002 * (18 / r), uPow: 1 }, { blend: 'add', order: 2, depthWrite: false });
      o.pos = [SUN_X, 0.04, 0]; o.scale = [r * 2, 1, r * 2]; upd(o);
    });
    decor.headLine = hs;
  }

  /* ---------- 球 ---------- */
  var balls = [], byN = {}, cue = null, sunBall = null;
  var sunDirDefault = E.v.norm([-0.4, 0.9, -0.3]);

  function planetMaterial(d) {
    var rim = d.rim || [0.5, 0.65, 0.9];
    var u = {
      map: T[d.tex], bumpMap: d.bump ? T[d.bump] : T[d.tex], ringMap: T.ring,
      useBump: d.bump ? 1 : 0, bumpK: d.bumpK || 0,
      bumpTexel: [1 / (d.bumpTexel ? d.bumpTexel[0] : 1024), 1 / (d.bumpTexel ? d.bumpTexel[1] : 512)],
      rimK: d.rim ? d.rimK : 0, rimColor: rim,
      sunDir: [0, 1, 0], ringOn: d.ring ? 1 : 0, ringN: [0, 1, 0], pc: [0, 0, 0],
      ringIn: R * 1.22, ringOut: R * 1.92, amb: 0.12
    };
    return u;
  }

  function createBall(d) {
    var b = {
      d: d, n: d.n, id: d.id, grp: d.grp, name: d.name,
      x: 0, y: 0, vx: 0, vy: 0, on: true, sunk: false, sink: null,
      q: Q.norm(Q.mul(Q.axis(1, 0, 0, Math.PI / 2), Q.axis(0, 1, 0, Math.random() * TAU))),
      dx: 0, dy: 0, meshes: [], sunDir: [0, 1, 0], ringA: 0.5, appear: 1
    };
    var u;
    if (d.sun) {
      u = { map: T.sun, time: 0 };
      b.body = mesh(GEO.sphere, PRG.sun, u, { order: 4 });
    } else if (d.earth) {
      u = { dayMap: T.earth_day, nightMap: T.earth_night, topoMap: T.earth_topo, waterMap: T.earth_water, sunDir: b.sunDir };
      b.body = mesh(GEO.sphereHi, PRG.earth, u, { order: 4 });
    } else if (d.cue) {
      u = planetMaterial({ tex: 'cue', rim: [0.7, 0.9, 1.0], rimK: 0.55 });
      u.sunDir = b.sunDir; u.amb = 0.2;
      b.body = mesh(GEO.sphere, PRG.planet, u, { order: 4 });
    } else {
      u = planetMaterial(d); u.sunDir = b.sunDir;
      b.body = mesh(GEO.sphere, PRG.planet, u, { order: 4 });
    }
    b.bu = u;
    b.meshes.push(b.body);
    if (!d.sun && !d.earth && !d.cue) { u.amb = 0.12; }
    if (d.earth) {
      b.clouds = mesh(GEO.sphereHi, PRG.cloud, { cloudMap: T.earth_clouds, sunDir: b.sunDir }, { blend: 'alpha', order: 6, depthWrite: false });
      b.clouds.parent = b.body; b.clouds.scale = [1.009, 1.009, 1.009]; b.cloudQ = [0, 0, 0, 1];
      b.meshes.push(b.clouds);
    }
    if (d.atmo) {
      b.atmo = mesh(GEO.shell, PRG.atmo, { sunDir: b.sunDir, color: d.atmo.c, k: d.atmo.k }, { blend: 'add', cull: 'front', order: 7, depthWrite: false });
      b.atmoS = d.atmo.s;
      b.meshes.push(b.atmo);
    }
    if (d.ring) {
      b.ringQ = Q.axis(1, 0, 0, 1.0);
      var rn = [0, Math.cos(1.0), Math.sin(1.0)];
      u.ringN = rn;
      b.ring = mesh(GEO.ring, PRG.ring, { ringMap: T.ring, sunDir: b.sunDir, pc: u.pc, ringN: rn, pr: R }, { blend: 'alpha', order: 6, depthWrite: false });
      b.ring.quat = b.ringQ;
      b.meshes.push(b.ring);
    }
    if (d.sun) {
      b.glowA = mesh(GEO.upright, PRG.decalB, { uCenter: [0, R, 0], uSize: R * 3.6, uColor: [1.0, 0.72, 0.38], uAlpha: 0.55, uMode: 0, uR: 0, uW: 1, uPow: 2.6 }, { blend: 'add', order: 8, depthWrite: false });
      b.glowB = mesh(GEO.upright, PRG.decalB, { uCenter: [0, R, 0], uSize: R * 8, uColor: [1.0, 0.55, 0.25], uAlpha: 0.2, uMode: 0, uR: 0, uW: 1, uPow: 2.4 }, { blend: 'add', order: 8, depthWrite: false });
      b.meshes.push(b.glowA, b.glowB);
    }
    // 腳下光暈與組別光環
    var gc = GCOL[d.grp] || GCOL.C;
    b.halo = mesh(GEO.flat, PRG.decal, { uColor: gc, uAlpha: 0.34, uMode: 0, uR: 0, uW: 1, uPow: 2.0 }, { blend: 'add', order: 3, depthWrite: false });
    b.halo.scale = [R * 4.4, 1, R * 4.4];
    b.hring = mesh(GEO.flat, PRG.decal, { uColor: gc, uAlpha: 0.6, uMode: 1, uR: 0.82, uW: 0.055, uPow: 1 }, { blend: 'add', order: 3, depthWrite: false });
    b.hring.scale = [R * 3.2, 1, R * 3.2];
    b.meshes.push(b.halo, b.hring);
    balls.push(b); if (d.n) byN[d.n] = b;
    return b;
  }

  function buildBalls() {
    DEFS.forEach(function (d) { var b = createBall(d); if (d.sun) sunBall = b; });
    cue = createBall({ n: 0, id: 'cue', name: '母球', grp: 'C', cue: true, tex: 'cue' });
    cue.name = '母球（彗星）';
  }

  /* 每幀把球的狀態同步到繪製物件 */
  var SPINW = { 0: 0.18, 1: 0.07, 2: -0.05, 3: 0.3, 4: 0.28, 5: 0.06, 6: 0.14, 7: 0.1, 8: 0.1, 9: 0.55, 10: 0.5, 11: -0.32, 12: 0.4, 13: 0.08, 14: 0.1, 15: 0.08 };
  function syncBall(b, t) {
    // 滾動
    if (b.lastT !== undefined) { var adt = Math.min(0.1, Math.max(0, t - b.lastT)); b.q = Q.norm(Q.mul(b.q, Q.axis(0, 1, 0, (SPINW[b.n] || 0.1) * adt))); }   // 自轉（純視覺，繞自己的極軸）
    b.lastT = t;
    var dd = Math.hypot(b.dx, b.dy) * (b.sl ? Math.max(-1.5, Math.min(1.5, b.w / (Math.hypot(b.vx, b.vy) + 1e-3))) : 1);
    if (dd > 1e-6) {
      var dq = Q.axis(b.dy, 0, -b.dx, dd / R);
      b.q = Q.norm(Q.mul(dq, b.q));
    }
    b.dx = 0; b.dy = 0;
    var px = b.x, py = R, pz = b.y, sc = 1, alpha = 1;
    if (b.sink) {
      var s = b.sink, k = Math.min(1, s.t / s.dur), e = k * k * (3 - 2 * k);
      px = s.x0 + (s.px - s.x0) * e; pz = s.y0 + (s.py - s.y0) * e;
      py = R * (1 - 0.55 * e); sc = Math.max(0.001, 1 - Math.pow(k, 1.4)); alpha = 1 - k;
      b.q = Q.norm(Q.mul(Q.axis(0, 1, 0, 0.45 + 18 * k * 0.016), b.q));
    }
    var vis = !b.hidden && (b.on || b.sink || b.ghost);
    var sd = lightDirFor(b, px, pz);
    b.sunDir[0] = sd[0]; b.sunDir[1] = sd[1]; b.sunDir[2] = sd[2];
    b.body.visible = vis;
    b.body.pos = [px, py, pz]; b.body.quat = b.q; b.body.scale = [R * sc, R * sc, R * sc];
    upd(b.body);
    if (b.d.sun) b.body.u.time = t;
    if (b.bu.pc) { b.bu.pc[0] = px; b.bu.pc[1] = py; b.bu.pc[2] = pz; }
    if (b.clouds) {
      b.cloudQ = Q.norm(Q.mul(Q.axis(0, 1, 0, 0.0008), b.cloudQ)); b.clouds.quat = b.cloudQ;
      b.clouds.visible = vis; upd(b.clouds);
    }
    if (b.atmo) {
      b.atmo.visible = vis; b.atmo.pos = [px, py, pz]; var as = R * b.atmoS * sc; b.atmo.scale = [as, as, as]; upd(b.atmo);
    }
    if (b.ring) {
      b.ring.visible = vis; b.ring.pos = [px, py, pz]; b.ring.scale = [R * sc, R * sc, R * sc]; upd(b.ring);
    }
    if (b.glowA) {
      b.glowA.visible = vis; b.glowB.visible = vis;
      b.glowA.u.uCenter[0] = px; b.glowA.u.uCenter[1] = py; b.glowA.u.uCenter[2] = pz; b.glowA.u.uSize = R * 3.6 * sc;
      b.glowB.u.uCenter[0] = px; b.glowB.u.uCenter[1] = py; b.glowB.u.uCenter[2] = pz; b.glowB.u.uSize = R * 8 * sc;
    }
    b.halo.visible = vis; b.hring.visible = false;
    b.halo.pos = [px, 0.05, pz]; b.hring.pos = [px, 0.07, pz];
    var hs = sc;
    b.halo.scale = [R * 4.4 * hs, 1, R * 4.4 * hs]; b.hring.scale = [R * 3.2 * hs, 1, R * 3.2 * hs];
    b.hring.u.uAlpha = b.ringA * alpha; b.halo.u.uAlpha = (0.16 + 0.3 * b.ringA) * alpha;
    upd(b.halo); upd(b.hring);
  }

  function lightDirFor(b, px, pz) {
    if (!sunBall || sunBall.sunk || !sunBall.on || b === sunBall) return sunDirDefault;
    var hx = sunBall.x - px, hz = sunBall.y - pz, hl = Math.hypot(hx, hz);
    if (hl < 0.01) return sunDirDefault;
    var v = E.v.norm([hx / hl * 0.62, 0.82, hz / hl * 0.62]);
    return v;
  }


  /* ================= 物理、規則、電腦對手、特效、音效 ================= */
  var FRIC_K = 0.25, FRIC_C = 8.0, STOP_V = 0.8;
  var CUSH_E = 0.8, BALL_E = 0.96;
  var VMIN = 8, VMAX = 260, SUB = 1 / 480;
  var D2 = 4 * R * R;
  var GRAV_R = 4.2, GRAV_A = 14;
  var SLIDE_A = 140;   // 母球剛被擊出時的滑動摩擦減速（滑動→純滾動）

  var G = {
    mode: 'pvp', state: 'menu', cur: 0, open: true, inHand: false, breakShot: true,
    players: [{ name: '玩家 1', ai: false, grp: null }, { name: '玩家 2', ai: false, grp: null }],
    log: null, aim: 0, power: 0, over: false, acc: 0, t: 0, ai: null, strike: null, settle: 0, placePos: null
  };

  /* ---------- 音效 ---------- */
  var AUD = { ctx: null, on: true, master: null, cnt: 0 };
  AUD.init = function () {
    if (AUD.ctx) { if (AUD.ctx.state === 'suspended') AUD.ctx.resume(); return; }
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      AUD.ctx = new C(); AUD.master = AUD.ctx.createGain(); AUD.master.gain.value = 0.8; var cmp = AUD.ctx.createDynamicsCompressor(); cmp.threshold.value = -14; cmp.ratio.value = 6; AUD.master.connect(cmp); cmp.connect(AUD.ctx.destination); AUD.build();
      var len = AUD.ctx.sampleRate * 0.5, buf = AUD.ctx.createBuffer(1, len, AUD.ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      AUD.noiseBuf = buf;
    } catch (e) { AUD.ctx = null; }
  };
  /* 以取樣合成：硬質球的「喀」是幾個快速衰減的高頻模態＋一點低頻本體；邊襯是低頻悶響；落袋是悶響＋滾動沙沙聲 */
  AUD.build = function () {
    var c = AUD.ctx, sr = c.sampleRate, seed = 12345;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function mk(dur, fn) {
      var n = Math.floor(sr * dur), b = c.createBuffer(1, n, sr), d = b.getChannelData(0), pk = 0, i;
      for (i = 0; i < n; i++) { d[i] = fn(i / sr, i); if (Math.abs(d[i]) > pk) pk = Math.abs(d[i]); }
      for (i = 0; i < n; i++) d[i] = d[i] / (pk || 1) * 0.9;
      return b;
    }
    function click(f0, body, jit) {
      var m = [[2300, .010, 1], [3700, .007, .8], [5400, .005, .5], [8200, .003, .3]].map(function (x) { return [x[0] * f0 * (1 + (rnd() - .5) * jit), x[1], x[2], rnd() * 6.28]; });
      return mk(0.14, function (t) {
        var s = (rnd() * 2 - 1) * Math.exp(-t / 0.0007) * 1.1;
        m.forEach(function (q) { s += q[2] * Math.exp(-t / q[1]) * Math.sin(6.2832 * q[0] * t + q[3]); });
        s += body * Math.exp(-t / 0.022) * Math.sin(6.2832 * 880 * f0 * t) + 0.75 * Math.exp(-t / 0.016) * Math.sin(6.2832 * 1500 * t) + 0.55 * Math.exp(-t / 0.032) * Math.sin(6.2832 * 620 * t);
        return s * Math.min(1, t / 0.0002);
      });
    }
    AUD.clicks = [click(1, 1.0, 0), click(1, 1.0, 0), click(1, 1.0, 0), click(1, 1.0, 0)];
    AUD.cueBuf = [click(1, 1.1, 0), click(1, 1.1, 0)];
    var lp = 0;
    AUD.railBuf = [0, 1].map(function (v) {
      lp = 0;
      return mk(0.22, function (t) {
        lp += ((rnd() * 2 - 1) - lp) * 0.12;
        return Math.exp(-t / 0.05) * Math.sin(6.2832 * (118 + v * 14) * t) + 0.6 * Math.exp(-t / 0.075) * Math.sin(6.2832 * 72 * t) + 1.6 * lp * Math.exp(-t / 0.014) + 0.18 * Math.exp(-t / 0.004) * Math.sin(6.2832 * 1900 * t);
      });
    });
    lp = 0;
    var bumps = [0.0, 0.11, 0.21, 0.30, 0.42];
    AUD.pocketBuf = mk(0.8, function (t) {
      lp += ((rnd() * 2 - 1) - lp) * 0.3;
      var e = 0; bumps.forEach(function (b, i) { var u = t - b; if (u >= 0) e += Math.exp(-u / (0.03 + i * 0.004)) * (0.7 - i * 0.1); });
      return Math.exp(-t / 0.07) * 1.2 * Math.sin(6.2832 * 150 * t) + 0.35 * Math.exp(-t / 0.18) * Math.sin(6.2832 * 260 * t) + lp * e * 1.3;
    });
  };
  AUD.play = function (bufs, gain, rate) {
    if (!AUD.ctx || !AUD.on || !bufs) return;
    var c = AUD.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = Array.isArray(bufs) ? bufs[Math.floor(Math.random() * bufs.length)] : bufs;
    s.playbackRate.value = rate || 1; g.gain.value = Math.max(0.0001, gain);
    s.connect(g); g.connect(AUD.master); s.start();
  };
  AUD.tone = function (f, dur, type, vol, f2, delay) {
    if (!AUD.ctx || !AUD.on) return;
    var c = AUD.ctx, t0 = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(AUD.master); o.start(t0); o.stop(t0 + dur + 0.02);
  };
  AUD.noise = function (dur, vol, freq, type) {
    if (!AUD.ctx || !AUD.on || !AUD.noiseBuf) return;
    var c = AUD.ctx, t0 = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = AUD.noiseBuf; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    g.gain.setValueAtTime(Math.max(0.0002, vol), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(AUD.master); s.start(t0); s.stop(t0 + dur + 0.02);
  };
  /* 音效：參考 8 Ball Pool——乾脆的「喀」、悶的邊襯「咚」、落袋「咕嚕」 */
  AUD.hit = function (v) {
    if (AUD.cnt > 6) return; AUD.cnt++;
    var u = Math.min(1, v / 120);
    AUD.play(AUD.clicks, 0.07 + 0.93 * Math.pow(u, 0.7), 1);
  };
  AUD.rail = function (v) {
    if (AUD.cnt > 6) return; AUD.cnt++;
    var u = Math.min(1, v / 110);
    AUD.play(AUD.railBuf, 0.08 + 0.85 * Math.pow(u, 0.8), 1);
  };
  AUD.pocket = function () { AUD.play(AUD.pocketBuf, 0.85, 1); };
  AUD.cue = function (p) { AUD.play(AUD.cueBuf, 0.3 + 0.7 * p, 1); };
  AUD.foul = function () { AUD.tone(220, 0.18, 'square', 0.1, 150); AUD.tone(160, 0.28, 'square', 0.1, 100, 0.17); };
  AUD.win = function () { [523, 659, 784, 1046].forEach(function (f, i) { AUD.tone(f, 0.35, 'triangle', 0.16, 0, i * 0.12); }); };
  AUD.ui = function () { AUD.tone(880, 0.07, 'sine', 0.08, 1100); };

  /* ---------- 特效 ---------- */
  var RIP = [], SPK = null;
  function buildFx() {
    for (var i = 0; i < 28; i++) {
      var m = mesh(GEO.flat, PRG.decal, { uColor: [0.8, 0.92, 1], uAlpha: 0, uMode: 1, uR: 0.8, uW: 0.1, uPow: 1 }, { blend: 'add', order: 9, depthWrite: false, visible: false });
      RIP.push({ m: m, t: 0, dur: 0.5, on: false, s0: 2, s1: 8, a: 1 });
    }
    var N = 220;
    SPK = { n: N, pos: new Float32Array(N * 3), col: new Float32Array(N * 3), p: [], i: 0 };
    for (i = 0; i < N; i++) { SPK.p.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, l: 0, m: 1, c: [1, 1, 1] }); SPK.pos[i * 3 + 1] = -999; }
    SPK.geo = eng.geometry({ position: SPK.pos, aCol: SPK.col, mode: 'points', dynamic: true });
    SPK.mesh = mesh(SPK.geo, PRG.points, { uSize: 3.2 * DPR, uAlpha: 1 }, { blend: 'add', order: 10, depthWrite: false, depthTest: false });
    SPK.mesh.world = M4.ident();
  }

  /* ---------- 行星被撞特效（純視覺） ---------- */
  var PFX = [], PFXI = 0;
  var PFXDEF = {
    2:  { kind: 5, col: [0.95, 0.85, 0.25], dur: 1.3, size: 9,  spk: [1.0, 0.95, 0.5], n: 4 },     // 金星：酸霧閃電
    3:  { kind: 7, col: [0.30, 1.00, 0.70], dur: 1.4, size: 10, spk: [0.4, 1.0, 0.8], n: 5 },      // 地球：極光與雲
    4:  { kind: 2, col: [0.85, 0.40, 0.20], dur: 1.5, size: 10, spk: [0.9, 0.5, 0.3], n: 4 },      // 火星：沙塵暴
    8:  { kind: 1, col: [1.0, 0.5, 0.1],    dur: 1.7, size: 13, spk: [1.0, 0.55, 0.15], n: 16 },  // 太陽：岩漿
    9:  { kind: 3, col: [0.95, 0.55, 0.25], dur: 1.3, size: 11, spk: [1.0, 0.7, 0.4], n: 4 },      // 木星：風暴漩渦
    10: { kind: 4, col: [1.0, 0.85, 0.50],  dur: 1.2, size: 12, spk: [1.0, 0.9, 0.6], n: 4 },      // 土星：光環震波
    11: { kind: 0, col: [0.45, 0.95, 1.0],  dur: 1.4, size: 12, spk: [0.6, 1.0, 1.0], n: 9 },      // 天王星：海浪
    12: { kind: 0, col: [0.15, 0.35, 1.0],  dur: 1.4, size: 12, spk: [0.3, 0.55, 1.0], n: 9 },     // 海王星：海浪
    13: { kind: 6, col: [0.70, 0.90, 1.0],  dur: 1.2, size: 10, spk: [0.85, 0.95, 1.0], n: 8 }     // 冥王星：冰晶
  };
  function buildPfx() {
    for (var i = 0; i < 14; i++) {
      var m = mesh(GEO.flat, PRG.pfx, { uKind: 0, uAge: 1, uSeed: 0, uAlpha: 1, uColor: [1, 1, 1] }, { blend: 'add', order: 8, depthWrite: false, visible: false });
      PFX.push({ m: m, on: false, t: 0, dur: 1 });
    }
  }
  function planetFx(b, vn) {
    var d = PFXDEF[b.n]; if (!d || vn < 7 || (b.fxCool || 0) > G.clock) return;
    b.fxCool = G.clock + 0.2;
    var u = Math.min(1, vn / 100), f = PFX[PFXI]; PFXI = (PFXI + 1) % PFX.length;
    var S = R * (d.size * (0.55 + 0.6 * u));
    f.on = true; f.t = 0; f.dur = d.dur; f.m.visible = true; f.m.pos = [b.x, 0.14, b.y]; f.m.scale = [S, 1, S];
    f.m.u.uKind = d.kind; f.m.u.uColor = d.col; f.m.u.uSeed = Math.random(); f.m.u.uAlpha = 0.55 + 0.45 * u; f.m.u.uAge = 0; upd(f.m);
    sparks(b.x, b.y, Math.round(d.n * (0.6 + u)), 10 + 24 * u, d.spk);
  }
  function updatePfx(dt) {
    PFX.forEach(function (f) {
      if (!f.on) return; f.t += dt; var k = f.t / f.dur;
      if (k >= 1) { f.on = false; f.m.visible = false; return; }
      f.m.u.uAge = k;
    });
  }
  function ripple(x, z, a, col, s0, s1, dur) {
    var r = null, i;
    for (i = 0; i < RIP.length; i++) if (!RIP[i].on) { r = RIP[i]; break; }
    if (!r) r = RIP[0];
    r.on = true; r.t = 0; r.dur = dur || 0.5; r.s0 = s0 || R * 1.5; r.s1 = s1 || R * 4.5; r.a = a;
    r.m.u.uColor = col || [0.8, 0.92, 1]; r.m.pos = [x, 0.12, z]; r.m.visible = true;
  }
  function sparks(x, z, n, speed, col) {
    for (var i = 0; i < n; i++) {
      var p = SPK.p[SPK.i]; SPK.i = (SPK.i + 1) % SPK.n;
      var a = Math.random() * TAU, s = speed * (0.4 + Math.random() * 0.8);
      p.x = x; p.y = R; p.z = z; p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = 6 + Math.random() * 14;
      p.l = p.m = 0.35 + Math.random() * 0.45; p.c = col || [0.8, 0.92, 1];
    }
  }
  function updateFx(dt, clock) {
    RIP.forEach(function (r) {
      if (!r.on) return;
      r.t += dt; var k = r.t / r.dur;
      if (k >= 1) { r.on = false; r.m.visible = false; return; }
      var e = 1 - (1 - k) * (1 - k), s = r.s0 + (r.s1 - r.s0) * e;
      r.m.scale = [s * 2, 1, s * 2]; r.m.u.uR = 0.8; r.m.u.uAlpha = r.a * (1 - k) * (1 - k); upd(r.m);
    });
    updatePfx(dt);
    var any = false;
    for (var i = 0; i < SPK.n; i++) {
      var p = SPK.p[i];
      if (p.l > 0) {
        p.l -= dt; any = true;
        p.vy -= 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.3; } p.z += p.vz * dt;
        var f = Math.max(0, p.l / p.m);
        SPK.pos[i * 3] = p.x; SPK.pos[i * 3 + 1] = p.y; SPK.pos[i * 3 + 2] = p.z;
        SPK.col[i * 3] = p.c[0] * f; SPK.col[i * 3 + 1] = p.c[1] * f; SPK.col[i * 3 + 2] = p.c[2] * f;
      } else if (SPK.pos[i * 3 + 1] > -900) {
        SPK.pos[i * 3 + 1] = -999; SPK.col[i * 3] = SPK.col[i * 3 + 1] = SPK.col[i * 3 + 2] = 0; any = true;
      }
    }
    if (any) { SPK.geo.set('position', SPK.pos); SPK.geo.set('aCol', SPK.col); }
    FIELD.meshes.forEach(function (m) { m.u.uTime = clock; });
    decor.holes.forEach(function (m) { m.u.uTime = clock; });
    decor.headLine.u.uTime = clock; RAILS.surface.u.uTime = clock;
    decor.headLine.u.uAlpha = (G.state === 'placing' && G.breakShot) ? 0.5 : 0.14;
  }
  function wallFlash(x, z, v) {
    var i = FIELD.hitIdx; FIELD.hitIdx = (i + 1) % 8;
    FIELD.hits[i * 4] = x; FIELD.hits[i * 4 + 1] = z; FIELD.hits[i * 4 + 2] = Math.min(1.4, 0.35 + v / 70); FIELD.hits[i * 4 + 3] = G.clock || 0;
  }

  /* ---------- 擺球 ---------- */
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.random() * (i + 1) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function resetBalls() {
    balls.forEach(function (b) { b.sl = false; b.slip = 0; b.on = true; b.sunk = false; b.sink = null; b.hidden = false; b.ghost = false; b.vx = b.vy = 0; b.dx = b.dy = 0; b.ringA = 0.5; });
    var A = shuffle(balls.filter(function (b) { return b.grp === 'A'; })), B = shuffle(balls.filter(function (b) { return b.grp === 'B'; }));
    var slots = [];
    for (var row = 0; row < 5; row++) for (var col = 0; col <= row; col++) slots.push({ row: row, col: col });
    var arr = new Array(15);
    arr[4] = sunBall;
    var coin = Math.random() < 0.5;
    arr[10] = coin ? A.pop() : B.pop(); arr[14] = coin ? B.pop() : A.pop();
    var rest = shuffle(A.concat(B));
    for (var i = 0; i < 15; i++) if (!arr[i]) arr[i] = rest.pop();
    arr.forEach(function (b, i) {
      var s = slots[i];
      b.x = FOOT_X + s.row * RACK_D * 1.003; b.y = (s.col - s.row / 2) * 2 * R * 1.003;
    });
    cue.x = HEAD_X; cue.y = 0;
    G.apex = arr[0];
  }

  /* ---------- 物理 ---------- */
  function nearestPocket(x, y) {
    var best = null, bd = 1e9;
    POCKETS.forEach(function (p) { var d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } });
    return best;
  }
  function capture(b) {
    b.on = false; b.sunk = true; b.vx = b.vy = 0;
    var p = nearestPocket(b.x, b.y);
    b.sink = { t: 0, dur: 0.65, x0: b.x, y0: b.y, px: p.vx, py: p.vy };
    if (G.log) { if (b === cue) G.log.cueSunk = true; else G.log.pocketed.push(b); }
    ripple(p.vx, p.vy, 0.9, GCOL[b.grp] || GCOL.C, R * 2, R * 6, 0.7);
    sparks(p.vx, p.vy, 14, 22, GCOL[b.grp] || GCOL.C);
    AUD.pocket(); updateTray();
  }
  function onBallHit(a, b, vn, x, y) {
    planetFx(a, vn); planetFx(b, vn);
    if (G.log && !G.log.first) { if (a === cue) G.log.first = b; else if (b === cue) G.log.first = a; }
    if (vn > 2.5) {
      ripple(x, y, Math.min(0.9, 0.25 + vn / 120), [0.85, 0.95, 1], R * 0.7, R * 2.4, 0.35);
      if (vn > 14) sparks(x, y, Math.min(8, 2 + (vn / 20 | 0)), Math.min(26, vn * 0.35), [0.9, 0.95, 1]);
      AUD.hit(vn);
    }
  }
  function onWallHit(b, x, z, vn) {
    if (G.log && G.log.first) G.log.railAfter = true;
    if (vn > 3) { wallFlash(x, z, vn); AUD.rail(vn); }
  }
  /* 簡化的加塞：上旋/下旋只在母球第一次碰到球時，沿出桿方向加減一點速度（跟球/縮球）；
     左右塞在母球撞邊襯時，沿邊襯方向加減一點切向速度。AI 不使用加塞。 */
  var SPIN_SIDE = 0.22;
  function sideSpinKick(b, tx, ty, vn) {
    if (b !== cue || !b.spin || !b.spin.x) return;
    var vt = b.vx * tx + b.vy * ty, sg = vt >= 0 ? 1 : -1;
    var k = b.spin.x * SPIN_SIDE * vn * sg;
    b.vx += tx * k; b.vy += ty * k; b.spin.x *= 0.6;
  }
  function collideBalls() {
    for (var i = 0; i < balls.length; i++) {
      var a = balls[i]; if (!a.on) continue;
      for (var j = i + 1; j < balls.length; j++) {
        var b = balls[j]; if (!b.on) continue;
        var dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= D2) continue;
        var d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, ov = (2 * R - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
        var vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vn > 0) {
          var J = (1 + BALL_E) / 2 * vn, cb = a === cue ? a : (b === cue ? b : null);
          if (cb && !cb.sl) { var sp0 = Math.hypot(cb.vx, cb.vy); cb.w = sp0; cb.ux = sp0 > 1e-3 ? cb.vx / sp0 : 1; cb.uy = sp0 > 1e-3 ? cb.vy / sp0 : 0; }   // 滾動中的球帶著前旋
          a.vx -= J * nx; a.vy -= J * ny; b.vx += J * nx; b.vy += J * ny;
          if (cb) cb.sl = true;                      // 撞擊不改變旋轉，之後摩擦會讓母球「跟」上去
          onBallHit(a, b, vn, (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
      }
    }
  }
  function cushE(vn) { return Math.max(0.6, 0.88 - 0.0009 * vn); }   // 撞得越快，邊襯吃掉越多能量
  function collideWalls(b) {
    var ax = HL - R, az = HW - R, s, vn;
    if (b.y > az || b.y < -az) {
      var X = Math.abs(b.x);
      if (X >= GS && X <= HL - GC) {
        s = b.y > 0 ? 1 : -1; b.y = s * az;
        if (b.vy * s > 0) { vn = Math.abs(b.vy); b.vy = -b.vy * cushE(vn); b.vx *= 0.985; sideSpinKick(b, 1, 0, vn); onWallHit(b, b.x, s * HW, vn); }
      }
    }
    if (b.x > ax || b.x < -ax) {
      var Y = Math.abs(b.y);
      if (Y <= HW - GC) {
        s = b.x > 0 ? 1 : -1; b.x = s * ax;
        if (b.vx * s > 0) { vn = Math.abs(b.vx); b.vx = -b.vx * cushE(vn); b.vy *= 0.985; sideSpinKick(b, 0, 1, vn); onWallHit(b, s * HW * 2, b.y, vn); }
      }
    }
    var rr = R + KR;
    for (var k = 0; k < KNUCKLES.length; k++) {
      var kn = KNUCKLES[k], dx = b.x - kn.x, dy = b.y - kn.y, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        var d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
        b.x = kn.x + nx * rr; b.y = kn.y + ny * rr;
        var v = b.vx * nx + b.vy * ny;
        if (v < 0) { var ce = cushE(-v); b.vx -= (1 + ce) * v * nx; b.vy -= (1 + ce) * v * ny; onWallHit(b, kn.x, kn.y, -v); }
      }
    }
  }
  function stepPhysics(dt) {
    var i, b;
    for (i = 0; i < balls.length; i++) {
      b = balls[i]; if (!b.on) continue;
      if (b === cue && b.sl) {                       // 滑動→滾動：桌面摩擦同時改變平移速度與旋轉（5/2 因子）
        var vu = b.vx * b.ux + b.vy * b.uy, sl = vu - b.w, as = Math.abs(sl);
        var dsl = Math.min(as, 3.5 * SLIDE_A * dt), sg = sl > 0 ? 1 : -1;
        b.vx -= b.ux * sg * dsl * 2 / 7; b.vy -= b.uy * sg * dsl * 2 / 7; b.w += sg * dsl * 5 / 7;
        b.slip = Math.min(1, (as - dsl) / (Math.hypot(b.vx, b.vy) + 20));
        if (as - dsl < 0.05) { b.sl = false; b.slip = 0; }
      } else if (b === cue) b.slip = 0;
      var sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        var ns = sp * Math.exp(-FRIC_K * dt) - (b.sl ? 0 : FRIC_C * dt);
        if (ns < STOP_V && !b.sl) { b.vx = 0; b.vy = 0; sp = 0; }
        else { var f = ns / sp; b.vx *= f; b.vy *= f; sp = ns; }
      }
      if (sp > 0) {
        for (var p = 0; p < POCKETS.length; p++) {
          var pk = POCKETS[p], gx = pk.x - b.x, gy = pk.y - b.y, gd = Math.hypot(gx, gy);
          if (gd < GRAV_R && gd > 0.01) {
            var a = GRAV_A * (1 - gd / GRAV_R) / (1 + (sp / 45) * (sp / 45));
            b.vx += gx / gd * a * dt; b.vy += gy / gd * a * dt;
          }
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.dx += b.vx * dt; b.dy += b.vy * dt;
    }
    collideBalls(); collideBalls();
    for (i = 0; i < balls.length; i++) {
      b = balls[i]; if (!b.on) continue;
      collideWalls(b);
      if (Math.abs(b.x) >= HL || Math.abs(b.y) >= HW) capture(b);
    }
  }
  function anyMoving() {
    for (var i = 0; i < balls.length; i++) { var b = balls[i]; if (b.on && (b.vx || b.vy)) return true; if (b.sink) return true; }
    return false;
  }
  function rollOnly(v0) { return v0 / FRIC_K - (FRIC_C / (FRIC_K * FRIC_K)) * Math.log(1 + FRIC_K * v0 / FRIC_C); }
  function rollDist(v0) { var v1 = v0 * 5 / 7; return 12 * v0 * v0 / (49 * SLIDE_A) + rollOnly(v1); }   // 滑動段 + 滾動段
  function powerToSpeed(p) { return VMIN + p * (VMAX - VMIN); }
  function speedToPower(v) { return Math.max(0, Math.min(1, (v - VMIN) / (VMAX - VMIN))); }

  /* ---------- 規則輔助 ---------- */
  function remaining(grp) { var n = 0; balls.forEach(function (b) { if (b.grp === grp && b.on) n++; }); return n; }
  function tableBalls() { return balls.filter(function (b) { return b.on && b !== cue; }); }
  function legalTargets(pl) {
    var tb = tableBalls();
    if (G.open) return tb.filter(function (b) { return b.n !== 8; });
    if (remaining(pl.grp) > 0) return tb.filter(function (b) { return b.grp === pl.grp; });
    return tb.filter(function (b) { return b.n === 8; });
  }
  function firstLegal(pl, b, remBefore) {      // remBefore：出桿前自己組別剩幾顆（落袋後再算會誤判打進最後一顆為犯規）
    if (G.open) return b.n !== 8;
    if ((remBefore === undefined ? remaining(pl.grp) : remBefore) > 0) return b.grp === pl.grp;
    return b.n === 8;
  }
  function otherGrp(g) { return g === 'A' ? 'B' : 'A'; }

  function freeSpot(x, y, ignore) {
    for (var i = 0; i < 40; i++) {
      var ok = true;
      for (var j = 0; j < balls.length; j++) { var b = balls[j]; if (b === ignore || !b.on) continue; if (Math.hypot(b.x - x, b.y - y) < 2 * R + 0.05) { ok = false; break; } }
      if (ok) return [x, y];
      x += 2 * R + 0.1;
      if (x > HL - 4) { x = FOOT_X; y += 2 * R + 0.1; }
    }
    return [x, y];
  }

  /* 一桿結束後的判定 */
  function resolveShot() {
    var p = G.players[G.cur], o = G.players[1 - G.cur], L = G.log, foul = null, i;
    var pk = L.pocketed, eight = null;
    pk.forEach(function (b) { if (b.n === 8) eight = b; });
    if (L.cueSunk) foul = '母球落袋';
    else if (!L.first) foul = '沒有擊中任何球';
    else if (!G.breakShot && !firstLegal(p, L.first, L.remBefore[p.grp])) {
      foul = L.first.n === 8 ? '先碰到太陽（8 號球）' : (G.open ? '犯規的第一次碰球' : '先碰到對方組別的球');
    } else if (!pk.length && !L.railAfter) foul = '擊球後沒有球碰到邊界';

    // 8 號球（太陽）
    if (eight) {
      if (G.breakShot) {
        var sp = freeSpot(FOOT_X, 0, eight);
        eight.on = true; eight.sunk = false; eight.sink = null; eight.hidden = false; eight.x = sp[0]; eight.y = sp[1]; eight.vx = eight.vy = 0;
        pk.splice(pk.indexOf(eight), 1); updateTray();
        toast('開球時太陽落袋，已放回球檯。', 'good');
      } else {
        var legalEight = !L.openBefore && L.remBefore[p.grp] === 0;
        if (legalEight && !foul) endGame(G.cur, '打光了自己組別的球，並把太陽（8 號黑球）打進黑洞。');
        else if (legalEight) endGame(1 - G.cur, p.name + ' 打進太陽時犯規（' + foul + '）。');
        else endGame(1 - G.cur, p.name + ' 太早把太陽（8 號黑球）打進黑洞。');
        return;
      }
    }

    var others = pk.filter(function (b) { return b.n !== 8; });
    var assigned = false;
    if (!foul && G.open && others.length && !G.breakShot) {
      p.grp = others[0].grp; o.grp = otherGrp(p.grp); G.open = false; assigned = true;
    }
    var cont = false;
    if (!foul) {
      if (G.breakShot) cont = others.length > 0;
      else if (!G.open) cont = others.some(function (b) { return b.grp === p.grp; });
    }
    G.breakShot = false;

    var msg, kind = '';
    if (foul) {
      cont = false; G.inHand = true; kind = 'foul'; AUD.foul();
      msg = '犯規：' + foul + '。' + o.name + ' 獲得自由球。';
    } else if (assigned) {
      msg = p.name + ' 是' + GNAME[p.grp] + '，' + o.name + ' 是' + GNAME[o.grp] + '。' + p.name + ' 繼續擊球。'; kind = 'good';
    } else if (cont) {
      msg = '進球！' + p.name + ' 繼續擊球。'; kind = 'good';
    } else {
      msg = '沒有進球，換 ' + o.name + '。';
    }
    if (!cont) G.cur = 1 - G.cur;
    if (G.inHand) { cue.on = false; cue.hidden = true; }
    toast(msg, kind, 3600);
    beginTurn();
  }

  function endGame(win, why) {
    G.over = true; G.state = 'over'; G.winner = win;
    AUD.win();
    setTimeout(function () {
      $('#oTitle').textContent = G.players[win].name + ' 獲勝！';
      $('#oWhy').textContent = why;
      $('#over').hidden = false;
    }, 900);
    renderHUD();
  }

  /* ---------- 電腦對手 ---------- */
  var AIM_POCKETS = [];
  function buildAimPockets() {
    POCKETS.forEach(function (p) {
      AIM_POCKETS.push({ x: p.x, y: p.y, ox: p.ox, oy: p.oy, minDot: p.corner ? 0.66 : 0.6 });
    });
  }
  function distSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function blocked(ax, ay, bx, by, ex1, ex2) {
    for (var i = 0; i < balls.length; i++) {
      var o = balls[i]; if (!o.on || o === ex1 || o === ex2) continue;
      if (distSeg(o.x, o.y, ax, ay, bx, by) < 2 * R * 0.99) return true;
    }
    return false;
  }
  function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.58; }
  function aiPlan(cx, cy) {
    var targets = legalTargets(G.players[G.cur]), best = null;
    targets.forEach(function (T) {
      AIM_POCKETS.forEach(function (P) {
        var ux = P.x - T.x, uy = P.y - T.y, dTP = Math.hypot(ux, uy);
        ux /= dTP; uy /= dTP;
        if (ux * P.ox + uy * P.oy < P.minDot) return;
        var gx = T.x - ux * 2 * R, gy = T.y - uy * 2 * R;
        if (Math.abs(gx) > HL - R - 0.2 || Math.abs(gy) > HW - R - 0.2) return;
        var cdx = gx - cx, cdy = gy - cy, dCG = Math.hypot(cdx, cdy);
        if (dCG < 0.05) return;
        var dCT = Math.hypot(T.x - cx, T.y - cy);
        var cosCut = ((T.x - cx) * ux + (T.y - cy) * uy) / dCT;
        if (cosCut < 0.22) return;
        if (blocked(cx, cy, gx, gy, cue, T)) return;
        if (blocked(T.x, T.y, P.x, P.y, T, cue)) return;
        var score = dCG + 1.3 * dTP + 55 * (1 - cosCut);
        if (!best || score < best.score) best = { score: score, ang: Math.atan2(cdy, cdx), T: T, D: dCG + dTP };
      });
    });
    return best;
  }
  function aiChoose() {
    var cx = cue.x, cy = cue.y, plan;
    if (G.breakShot) {
      var ap = G.apex;
      return { ang: Math.atan2(ap.y - cy, ap.x - cx) + gauss() * 0.01, power: 0.93 };
    }
    plan = aiPlan(cx, cy);
    if (plan) {
      var need = plan.D * 1.15 + 14, lo = VMIN, hi = VMAX;
      for (var i = 0; i < 24; i++) { var mid = (lo + hi) / 2; if (rollDist(mid) < need) lo = mid; else hi = mid; }
      var sig = 0.005 + 0.00012 * plan.D;
      return { ang: plan.ang + gauss() * sig, power: Math.min(0.97, Math.max(0.12, speedToPower(hi) + gauss() * 0.02)), T: plan.T };
    }
    var ts = legalTargets(G.players[G.cur]), pick = null, pd = 1e9, clear = false;
    ts.forEach(function (T) {
      var d = Math.hypot(T.x - cx, T.y - cy), c = !blocked(cx, cy, T.x, T.y, cue, T);
      if ((c && !clear) || (c === clear && d < pd)) { pick = T; pd = d; clear = c; }
    });
    if (!pick) return { ang: 0, power: 0.3 };
    return { ang: Math.atan2(pick.y - cy, pick.x - cx) + gauss() * 0.01, power: Math.min(0.7, 0.28 + pd / 140), T: pick };
  }
  function validCue(x, y, forBreak) {
    var mx = HL - R - 0.4, my = HW - R - 0.4;
    if (Math.abs(x) > mx || Math.abs(y) > my) return false;
    if (forBreak && x > HEAD_X) return false;
    for (var i = 0; i < balls.length; i++) { var b = balls[i]; if (b === cue || !b.on) continue; if (Math.hypot(b.x - x, b.y - y) < 2 * R + 0.1) return false; }
    for (i = 0; i < KNUCKLES.length; i++) if (Math.hypot(KNUCKLES[i].x - x, KNUCKLES[i].y - y) < R + KR + 0.3) return false;
    return true;
  }
  function nearestValidCue(x, y) {
    x = Math.max(-HL + R + 0.5, Math.min(HL - R - 0.5, x)); y = Math.max(-HW + R + 0.5, Math.min(HW - R - 0.5, y));
    if (validCue(x, y)) return [x, y];
    for (var r = 0.5; r < 20; r += 0.5) for (var a = 0; a < 24; a++) {
      var px = x + Math.cos(a / 24 * TAU) * r, py = y + Math.sin(a / 24 * TAU) * r;
      if (validCue(px, py)) return [px, py];
    }
    return null;
  }
  function aiPlaceCue() {
    var best = null;
    for (var x = -42; x <= 42; x += 4) for (var y = -17; y <= 17; y += 4) {
      if (!validCue(x, y)) continue;
      var pl = aiPlan(x, y);
      if (pl && (!best || pl.score < best.score)) best = { x: x, y: y, score: pl.score };
    }
    var pos = best ? [best.x, best.y] : nearestValidCue(-20, 0);
    cue.x = pos[0]; cue.y = pos[1]; cue.vx = cue.vy = 0;
    cue.on = true; cue.hidden = false; cue.ghost = false; G.inHand = false;
    ripple(cue.x, cue.y, 0.8, GCOL.C, R, R * 4, 0.5);
  }


  /* ================= 介面、鏡頭、輸入、主迴圈 ================= */
  var vp = { w: 1, h: 1 };
  var FOV = 35 * DEG, TANH = Math.tan(FOV / 2);
  var LAY = { topPx: 80, botPx: 90, side: 78, ax: 0.9, ay: 0.7, shy: 0 };
  var CAM = { tx: 0, tz: 0, d: 900, th: 0, ph: 0, gtx: 0, gtz: 0, gd: 150, gth: 0, gph: 0, auto: false, manual: false, fitD: 150, thUser: false };
  var cam = { view: M4.ident(), proj: M4.ident(), pos: [0, 100, 0], vp: M4.ident(), inv: null, right: [1, 0] };
  var menuOpen = true, hasGame = false;
  G.clock = 0;

  /* ---------- 提示訊息 ---------- */
  var toastEl = $('#toast'), toastTimer = 0;
  function toast(msg, kind, ms) {
    toastEl.textContent = msg; toastEl.className = 'on' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = ''; }, ms || 2600);
  }

  /* ---------- 縮圖與球況列 ---------- */
  function makeThumb(def) {
    var key = def.sun ? 'sun' : def.earth ? 'earth_day' : def.tex, t = T[key];
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(32, 32, 31, 0, TAU); g.clip();
    if (t && t.image) {
      var im = t.image, s = Math.min(im.width, im.height);
      g.drawImage(im, (im.width - s) / 2, 0, s, s, 0, 0, 64, 64);
    }
    var gr = g.createRadialGradient(22, 20, 4, 32, 32, 36);
    gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.restore();
    return c.toDataURL('image/png');
  }
  function thumbEl(d, size) {
    var el = document.createElement('span');
    el.className = 'th ' + (d.grp === 'A' ? 'a' : d.grp === 'B' ? 'b' : 'e');
    el.style.backgroundImage = 'url(' + thumbs[d.n] + ')';
    if (size) el.style.setProperty('--s', size + 'px');
    el.title = d.n + ' ' + d.name;
    var b = document.createElement('b'); b.textContent = d.n; el.appendChild(b);
    return el;
  }
  var trayEl = {}, trayLab = {};
  function buildTray() {
    DEFS.forEach(function (d) { thumbs[d.n] = makeThumb(d); });
    var tray = $('#tray'); tray.innerHTML = '';
    [['a', '類地組 1–7', 'A'], ['e', '8', 'E'], ['b', '類木組 9–15', 'B']].forEach(function (c) {
      var cl = document.createElement('div'); cl.className = 'cl ' + c[0];
      var lab = document.createElement('span'); lab.textContent = c[1]; lab.dataset.base = c[1]; trayLab[c[2]] = lab; cl.appendChild(lab);
      var row = document.createElement('div'); row.className = 'row'; cl.appendChild(row);
      DEFS.filter(function (d) { return d.grp === c[2]; }).forEach(function (d) { var e = thumbEl(d); trayEl[d.n] = e; row.appendChild(e); });
      tray.appendChild(cl);
    });
    [['#lgA', 'A'], ['#lgE', 'E'], ['#lgB', 'B']].forEach(function (c) {
      var row = $(c[0]); row.innerHTML = '';
      DEFS.filter(function (d) { return d.grp === c[1]; }).forEach(function (d) { row.appendChild(thumbEl(d, 30)); });
    });
    var bd = $('#badges'); bd.innerHTML = '';
    balls.forEach(function (b) {
      if (!b.n) return;
      var e = document.createElement('div'); e.className = 'bd ' + (b.grp === 'A' ? 'a' : b.grp === 'B' ? 'b' : 'e');
      e.textContent = b.n;
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = b.name; e.appendChild(nm);
      bd.appendChild(e); b.badge = e;
    });
  }
  function updateTray() {
    balls.forEach(function (b) { if (b.n && trayEl[b.n]) trayEl[b.n].classList.toggle('out', !b.on); });
  }

  var elTrack = $('#track'), elFill = $('#fill'), elThumb = $('#thumb'), elPval = $('#pval'), elHint = $('#phint'), elFire = $('#bFire');
  function renderHUD() {
    G.players.forEach(function (p, i) {
      $('#pn' + i).textContent = p.name;
      var g = $('#pg' + i);
      if (G.open) { g.textContent = '未分組'; g.className = 'pl-grp'; $('#pr' + i).textContent = ''; }
      else {
        g.textContent = GNAME[p.grp] + (p.grp === 'A' ? '（1–7）' : '（9–15）'); g.className = 'pl-grp ' + (p.grp === 'A' ? 'a' : 'b');
        var rem = remaining(p.grp);
        $('#pr' + i).textContent = rem > 0 ? '剩 ' + rem + ' 顆' : '下一個目標：太陽（8）';
      }
      var on = i === G.cur && !G.over && G.state !== 'menu';
      $('#pl' + i).classList.toggle('on', on);
      var st = '出手中';
      if (G.state === 'placing') st = '放置母球'; else if (G.state === 'aiThink') st = '思考中'; else if (G.state === 'moving' || G.state === 'striking') st = '擊球中'; else if (G.state === 'aiming') st = '瞄準';
      $('#ps' + i).textContent = st;
    });
    ['A', 'B'].forEach(function (k) {       // 球況列標出每組是誰的球
      var owner = G.open ? null : G.players.filter(function (p) { return p.grp === k; })[0];
      trayLab[k].textContent = trayLab[k].dataset.base + (owner ? ' · ' + owner.name : '');
    });
    var tgt8 = !G.open && G.players.filter(function (p) { return remaining(p.grp) === 0; })[0];
    trayLab.E.textContent = tgt8 ? '8 · ' + tgt8.name + ' 的目標' : '8';
    updateTray();
    var humanAim = G.state === 'aiming' && !G.players[G.cur].ai, placing = G.state === 'placing' && !G.players[G.cur].ai;
    $('#power').classList.toggle('off', !(humanAim || placing)); $('#spinbox').classList.toggle('off', !humanAim); $('#bFire').hidden = !placing;
    elFire.textContent = placing ? '放置母球' : '擊球';
    elHint.textContent = placing ? '點擊球檯或拖曳母球，再按「放置母球」' : '拖曳圓鈕，放開即擊球';
    elTrack.style.opacity = placing ? 0.4 : 1;
  }

  /* ---------- 回合流程 ---------- */
  function angleToward(tx, ty) { return Math.atan2(ty - cue.y, tx - cue.x); }
  function setAimDefault() {
    var ts = legalTargets(G.players[G.cur]);
    if (G.breakShot && G.apex) { G.aim = angleToward(G.apex.x, G.apex.y); return; }
    var best = null, bd = 1e9;
    ts.forEach(function (b) { var d = Math.hypot(b.x - cue.x, b.y - cue.y); if (d < bd) { bd = d; best = b; } });
    if (best) G.aim = angleToward(best.x, best.y);
  }
  function beginTurn() {
    var p = G.players[G.cur];
    setPower(0);
    G.strike = null; if (CAM.auto) CAM.manual = false; setSpin(0, 0);
    if (G.inHand) {
      if (p.ai) { aiPlaceCue(); G.state = 'aiThink'; G.ai = { t: 0, phase: 'wait', plan: null, a0: 0 }; }
      else { G.state = 'placing'; cue.on = false; cue.hidden = false; cue.ghost = true; G.placePos = [-20, 0]; var np = nearestValidCue(-20, 0); if (np) G.placePos = np; toast('自由球：點擊球檯或拖曳母球選位置，再按右側「放置母球」。', '', 4800); }
    } else if (p.ai) {
      G.state = 'aiThink'; G.ai = { t: 0, phase: 'wait', plan: null, a0: G.aim };
    } else { G.state = 'aiming'; }
    if (G.state === 'aiming' || G.state === 'aiThink') setAimDefault();
    focusShot();
    renderHUD();
  }
  function newGame(mode) {
    G.mode = mode; G.over = false; G.open = true; G.inHand = false; G.breakShot = true; G.cur = 0;
    G.players[0] = { name: mode === 'ai' ? '你' : '玩家 1', ai: false, grp: null };
    G.players[1] = { name: mode === 'ai' ? '電腦' : '玩家 2', ai: mode === 'ai', grp: null };
    resetBalls(); G.log = null; hasGame = true;
    CAM.manual = false; CAM.thUser = false; CAM.gph = 0; CAM.gth = baseTheta();
    $('#over').hidden = true; hideMenu();
    cue.on = true; cue.hidden = false; cue.ghost = false;
    toast('開球！點擊球檯設定方向，再抓住左側力道條的圓鈕往下拉、放開擊球。', '', 5200);
    beginTurn();
  }
  function fireShot(ang, power) {
    G.log = { first: null, pocketed: [], cueSunk: false, railAfter: false, openBefore: G.open, remBefore: { A: remaining('A'), B: remaining('B') } };
    G.aim = ang; G.power = power;
    G.strike = { t: 0, ang: ang, power: power, pull: power * 12 };
    G.state = 'striking'; renderHUD();
  }
  function strikeDone() {
    var s = G.strike, v = powerToSpeed(s.power);
    cue.vx = Math.cos(s.ang) * v; cue.vy = Math.sin(s.ang) * v;
    cue.shotAng = s.ang; cue.spinHit = false;
    var sy0 = G.players[G.cur].ai ? 0 : SPIN.y; cue.ux = Math.cos(s.ang); cue.uy = Math.sin(s.ang); cue.w = v * 1.2 * sy0; cue.sl = true; cue.slip = 1; cue.spin = G.players[G.cur].ai ? { x: 0, y: 0 } : { x: SPIN.x, y: SPIN.y };
    AUD.cue(s.power); ripple(cue.x, cue.y, 0.7, [0.6, 0.85, 1], R, R * 3.5, 0.4);
    G.state = 'moving'; G.settle = 0; G.acc = 0; G.moveT = 0; G.strike = null; renderHUD();
  }
  function placeCue() {
    if (G.state !== 'placing' || G.players[G.cur].ai) return;
    var p = G.placePos || [cue.x, cue.y], pos = nearestValidCue(p[0], p[1]);
    if (!pos) { toast('這裡放不下母球，換個位置。', 'foul', 1800); return; }
    cue.x = pos[0]; cue.y = pos[1]; cue.vx = cue.vy = 0; cue.on = true; cue.ghost = false; cue.hidden = false; G.inHand = false; G.placeBad = false;
    ripple(cue.x, cue.y, 0.8, GCOL.C, R, R * 4, 0.5);
    G.state = 'aiming'; setAimDefault(); G.placePos = null; if (CAM.auto) CAM.manual = false; focusShot(); renderHUD();
  }

  /* ---------- 力道、微調、擊球鈕 ---------- */
  function setPower(p) {
    G.power = p;
    elFill.style.height = (p * 100) + '%'; elThumb.style.top = (p * 100) + '%';
    elPval.textContent = Math.round(p * 100) + '%';
    elTrack.setAttribute('aria-valuenow', Math.round(p * 100));
    elTrack.classList.toggle('used', p > 0.01);
  }
  /* 加塞：x 左右、y 上（跟球）下（縮球），範圍 -1..1 */
  var SPIN = { x: 0, y: 0 }, elSpin = $('#spin'), elDot = $('#spinDot');
  function setSpin(x, y) {
    var l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    SPIN.x = x; SPIN.y = y; elDot.style.left = (50 + x * 38) + '%'; elDot.style.top = (50 - y * 38) + '%';
  }
  function spinFrom(e) { var r = elSpin.getBoundingClientRect(); setSpin((e.clientX - r.left - r.width / 2) / (r.width * 0.38), -(e.clientY - r.top - r.height / 2) / (r.height * 0.38)); }
  var spinDrag = false;
  elSpin.addEventListener('pointerdown', function (e) { if (G.state !== 'aiming') return; spinDrag = true; elSpin.setPointerCapture(e.pointerId); e.preventDefault(); spinFrom(e); });
  elSpin.addEventListener('pointermove', function (e) { if (spinDrag) spinFrom(e); });
  ['pointerup', 'pointercancel'].forEach(function (ev) { elSpin.addEventListener(ev, function () { spinDrag = false; }); });
  elSpin.addEventListener('dblclick', function () { setSpin(0, 0); });
  var drag = false, dragFire = false;
  function humanCanAim() { return G.state === 'aiming' && !G.players[G.cur].ai && !menuOpen; }
  function trackPos(e) { var r = elTrack.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); }
  elTrack.addEventListener('pointerdown', function (e) {
    if (!humanCanAim()) return;
    AUD.init(); drag = true; elTrack.setPointerCapture(e.pointerId); e.preventDefault();
    var tr = elThumb.getBoundingClientRect();
    dragFire = Math.hypot(e.clientX - (tr.left + tr.width / 2), e.clientY - (tr.top + tr.height / 2)) < 30;   // 抓住圓鈕才會「放開即擊球」
    setPower(trackPos(e));
  });
  elTrack.addEventListener('pointermove', function (e) { if (drag) setPower(trackPos(e)); });
  function endDrag(e) {
    if (!drag) return; drag = false;
    try { elTrack.releasePointerCapture(e.pointerId); } catch (_) { }
    if (e.type === 'pointercancel') { setPower(0); return; }
    if (humanCanAim() && dragFire && G.power > 0.04) fireShot(G.aim, G.power);
    else if (G.power <= 0.04) setPower(0);
  }
  elTrack.addEventListener('pointerup', endDrag);
  elTrack.addEventListener('pointercancel', endDrag);
  elFire.addEventListener('click', function () {
    AUD.init();
    if (G.state === 'placing') { placeCue(); return; }
    if (!humanCanAim()) return;
  });
  /* ---------- 鍵盤 ---------- */
  var keys = {}, charging = false, e_shift = false;
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Shift') e_shift = true;
    if (menuOpen) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { keys[e.key] = true; e.preventDefault(); }
    else if (e.code === 'Space') { if (humanCanAim() && !e.repeat) { charging = true; AUD.init(); } e.preventDefault(); }
    else if (e.key === 'Enter') { if (G.state === 'placing') placeCue(); else if (humanCanAim() && G.power > 0.04) fireShot(G.aim, G.power); }
    else if (e.key === 'Escape') { charging = false; setPower(0); }
  });
  window.addEventListener('keyup', function (e) {
    if (e.key === 'Shift') e_shift = false;
    keys[e.key] = false;
    if (e.code === 'Space' && charging) { charging = false; if (humanCanAim() && G.power > 0.04) fireShot(G.aim, G.power); else setPower(0); }
  });

  /* ---------- 鏡頭 ---------- */
  function baseTheta() { return vp.w / vp.h < 0.95 ? -Math.PI / 2 : 0; }
  function measureLayout() {
    var topR = $('#top').getBoundingClientRect(), botR = $('#bot').getBoundingClientRect(), w = vp.w, h = vp.h;
    LAY.topPx = topR.bottom + 8; LAY.botPx = h - botR.top + 6;
    LAY.side = w <= 520 ? 56 : 68; document.documentElement.style.setProperty('--pt', LAY.topPx + 'px'); document.documentElement.style.setProperty('--pb', LAY.botPx + 'px');
    LAY.ax = Math.max(0.2, (w - 2 * LAY.side) / w); LAY.ay = Math.max(0.2, (h - LAY.topPx - LAY.botPx) / h);
    LAY.shy = -((LAY.topPx - LAY.botPx) / 2) / (h / 2);
    toastEl.style.top = (topR.bottom + 10) + 'px';
  }
  function eyeFor(th, ph, d, tx, tz) { return [tx + d * Math.sin(ph) * Math.sin(th), d * Math.cos(ph), tz + d * Math.sin(ph) * Math.cos(th)]; }
  function viewFor(th, ph, d, tx, tz) { return M4.lookAt(eyeFor(th, ph, d, tx, tz), [tx, 0, tz], [-Math.sin(th), 0, -Math.cos(th)]); }
  var fitKey = '';
  function fitDistance(th0, ph0) {
    var th = th0 === undefined ? CAM.th : th0, ph = ph0 === undefined ? CAM.ph : ph0, key = [th.toFixed(3), ph.toFixed(3), vp.w, vp.h, LAY.topPx | 0, LAY.botPx | 0].join();
    if (key === fitKey) return CAM.fitD;
    fitKey = key;
    var proj = M4.perspective(FOV, vp.w / vp.h, 1, 5000, 0, 0), pts = [], ex = HL + 7, ez = HW + 7;
    [[-ex, -ez], [ex, -ez], [ex, ez], [-ex, ez], [0, -ez], [0, ez], [-ex, 0], [ex, 0]].forEach(function (p) { pts.push([p[0], 0, p[1]], [p[0], 4, p[1]]); });
    var lo = 30, hi = 1400;
    for (var i = 0; i < 22; i++) {
      var mid = (lo + hi) / 2, m = M4.mul(proj, viewFor(th, ph, mid, 0, 0));
      var ok = pts.every(function (q) { var r = M4.xform(m, q); return Math.abs(r[0]) <= LAY.ax && Math.abs(r[1]) <= LAY.ay; });
      if (ok) hi = mid; else lo = mid;
    }
    CAM.fitD = hi; return hi;
  }
  /* 聚焦到下一桿：母球與第一個目標之間 */
  function focusDistFor(sx, sz) {
    var th = CAM.gth, rx = [Math.cos(th), -Math.sin(th)], ux = [-Math.sin(th), -Math.cos(th)], asp = vp.w / vp.h;
    var er = Math.abs(sx * rx[0] + sz * rx[1]) / 2 + 17, eu = Math.abs(sx * ux[0] + sz * ux[1]) / 2 + 12;
    var d = Math.max(er / (TANH * asp * LAY.ax), eu / (TANH * LAY.ay));
    return Math.max(34, Math.min(d, fitDistance()));
  }
  function focusOn(x1, y1, x2, y2) {
    if (!CAM.auto || CAM.manual) return;
    CAM.gtx = (x1 + x2) / 2; CAM.gtz = (y1 + y2) / 2; CAM.gd = focusDistFor(Math.abs(x2 - x1), Math.abs(y2 - y1));
  }
  function focusShot() {
    if (G.state === 'placing') { if (CAM.auto && !CAM.manual) { CAM.gtx = 0; CAM.gtz = 0; CAM.gd = fitDistance() * 0.85; } return; }
    if (!cue.on) return;
    var a = computeAim(G.aim), tx = a.hit ? a.hit.x : cue.x + Math.cos(G.aim) * 30, ty = a.hit ? a.hit.y : cue.y + Math.sin(G.aim) * 30;
    focusOn(cue.x, cue.y, tx, ty);
  }
  function updateCamera(dt) {
    // 自動鏡頭：出桿與球移動時拉遠看全場
    var st = G.state;
    if (!CAM.auto && !CAM.manual) { CAM.gd = fitDistance(); CAM.gtx = 0; CAM.gtz = 0; }
    if (CAM.auto && !CAM.manual && (st === 'menu' || st === 'striking' || st === 'moving' || st === 'resolving' || st === 'over')) {
      CAM.gd = fitDistance(); CAM.gtx = 0; CAM.gtz = 0;
    }
    var k = 1 - Math.exp(-dt * 4.5);
    CAM.tx += (CAM.gtx - CAM.tx) * k; CAM.tz += (CAM.gtz - CAM.tz) * k;
    CAM.d += (CAM.gd - CAM.d) * (1 - Math.exp(-dt * 3.2));
    CAM.th += Math.atan2(Math.sin(CAM.gth - CAM.th), Math.cos(CAM.gth - CAM.th)) * k;
    CAM.ph += (CAM.gph - CAM.ph) * k;
    var d = CAM.d, eye = eyeFor(CAM.th, CAM.ph, d, CAM.tx, CAM.tz);
    cam.pos = eye; cam.view = viewFor(CAM.th, CAM.ph, d, CAM.tx, CAM.tz);
    cam.proj = M4.perspective(FOV, vp.w / vp.h, Math.max(1, d * 0.05), 5000, 0, LAY.shy);
    cam.vp = M4.mul(cam.proj, cam.view); cam.inv = M4.invert(cam.vp);
    var rx = cam.view[0], rz = cam.view[8], rl = Math.hypot(rx, rz) || 1;
    cam.right = [rx / rl, rz / rl];
  }
  function onResize() {
    vp.w = Math.max(1, window.innerWidth); vp.h = Math.max(1, window.innerHeight);
    eng.resize(vp.w, vp.h, DPR); measureLayout();
    if (!CAM.thUser) CAM.gth = baseTheta();
  }
  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(measureLayout).observe($('#top'));

  function pickPlane(cx, cy, py) {
    if (!cam.inv) return null;
    var rect = canvas.getBoundingClientRect();
    var nx = (cx - rect.left) / rect.width * 2 - 1, ny = -((cy - rect.top) / rect.height * 2 - 1);
    var a = M4.xform(cam.inv, [nx, ny, -1]), b = M4.xform(cam.inv, [nx, ny, 1]), dy = b[1] - a[1];
    if (Math.abs(dy) < 1e-9) return null;
    var t = (py - a[1]) / dy;
    if (t < 0) return null;
    return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function project(x, y, z) {
    var r = M4.xform(cam.vp, [x, y, z]);
    return [(r[0] * 0.5 + 0.5) * vp.w, (1 - (r[1] * 0.5 + 0.5)) * vp.h];
  }
  function ballPx(x, z) {
    var s = project(x, R, z), s2 = project(x + cam.right[0] * R, R, z + cam.right[1] * R);
    return Math.hypot(s2[0] - s[0], s2[1] - s[1]);
  }

  /* ---------- 指標輸入：旋轉 / 平移 / 縮放 / 瞄準 / 放球 ---------- */
  var tipEl = $('#tip'), pts = {}, mode = null, down0 = null, moved = false, pinch = null;
  function userCam() { CAM.manual = true; }
  function aimHandleHit(e) {
    if (!humanCanAim()) return false;
    var a = computeAim(G.aim), s = project(a.ex, R, a.ey), rad = Math.max(26, ballPx(a.ex, a.ey) * 1.5);
    return Math.hypot(e.clientX - s[0], e.clientY - s[1]) < rad;
  }
  function cueHit(e) {
    var s = project(cue.x, R, cue.y), rad = Math.max(28, ballPx(cue.x, cue.y) * 1.6);
    return Math.hypot(e.clientX - s[0], e.clientY - s[1]) < rad;
  }
  function setAimTo(p) { if (Math.hypot(p[0] - cue.x, p[1] - cue.y) > R * 1.2) G.aim = Math.atan2(p[1] - cue.y, p[0] - cue.x); }
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('pointerdown', function (e) {
    AUD.init(); if (menuOpen) return;
    canvas.setPointerCapture(e.pointerId);
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; mode = 'pinch'; return;
    }
    down0 = { x: e.clientX, y: e.clientY }; moved = false;
    if (e.button === 2 || e.shiftKey && e.button === 0 && false) mode = 'pan';
    else if (aimHandleHit(e)) mode = 'aim';
    else if (G.state === 'placing' && !G.players[G.cur].ai && cueHit(e)) mode = 'place';
    else mode = 'orbit';
    canvas.classList.add(mode === 'aim' || mode === 'place' ? 'aimh' : 'grabbing');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (pts[e.pointerId]) {
      var prev = pts[e.pointerId], dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (mode === 'pinch' && Object.keys(pts).length >= 2) {
        var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]], nd = Math.hypot(a.x - b.x, a.y - b.y), ncx = (a.x + b.x) / 2, ncy = (a.y + b.y) / 2;
        if (pinch.d > 0) CAM.gd = Math.max(22, Math.min(420, CAM.gd * pinch.d / nd));
        panBy(ncx - pinch.cx, ncy - pinch.cy);
        pinch.d = nd; pinch.cx = ncx; pinch.cy = ncy; userCam(); return;
      }
      if (down0 && Math.hypot(e.clientX - down0.x, e.clientY - down0.y) > 6) moved = true;
      if (mode === 'orbit' && moved) {
        CAM.gth -= dx * 0.0055; CAM.gph = Math.max(0, Math.min(1.3, CAM.gph - dy * 0.005)); CAM.thUser = true; userCam();
      } else if (mode === 'pan') { panBy(dx, dy); userCam(); }
      else if (mode === 'aim') { var p = pickPlane(e.clientX, e.clientY, R); if (p) setAimTo(p); }
      else if (mode === 'place') { var q = pickPlane(e.clientX, e.clientY, R); if (q) G.placePos = q; }
    } else if (e.pointerType === 'mouse') hover(e);
  });
  function panBy(dx, dy) {
    var th = CAM.gth, k = 2 * CAM.d * TANH / vp.h, rx = [Math.cos(th), -Math.sin(th)], ux = [-Math.sin(th), -Math.cos(th)];
    CAM.gtx = Math.max(-70, Math.min(70, CAM.gtx - (rx[0] * dx - ux[0] * dy) * k));
    CAM.gtz = Math.max(-45, Math.min(45, CAM.gtz - (rx[1] * dx - ux[1] * dy) * k));
  }
  function pointerEnd(e) {
    if (!pts[e.pointerId]) return;
    delete pts[e.pointerId];
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }
    canvas.classList.remove('grabbing', 'aimh');
    if (mode === 'pinch') { if (Object.keys(pts).length < 2) mode = null; return; }
    if (mode === 'orbit' && !moved && e.type === 'pointerup') {          // 單擊：設定瞄準方向 / 移動待放球
      var p = pickPlane(e.clientX, e.clientY, R);
      if (p && humanCanAim()) { setAimTo(p); focusShot(); }
      else if (p && G.state === 'placing' && !G.players[G.cur].ai) G.placePos = p;
    }
    mode = null; down0 = null;
  }
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('wheel', function (e) {
    if (menuOpen) return;
    e.preventDefault(); userCam();
    CAM.gd = Math.max(22, Math.min(420, CAM.gd * Math.exp(e.deltaY * 0.0014)));
  }, { passive: false });
  function hover(e) {
    if (menuOpen) return;
    var p = pickPlane(e.clientX, e.clientY, R);
    canvas.classList.toggle('aimh', !!(p && aimHandleHit(e)));
    if (!p) { tipEl.classList.remove('on'); return; }
    var best = null, bd = R * 1.25;
    balls.forEach(function (b) { if (!b.on) return; var d = Math.hypot(b.x - p[0], b.y - p[1]); if (d < bd) { bd = d; best = b; } });
    if (best) {
      tipEl.textContent = (best.n ? best.n + ' · ' : '') + best.name + (best.grp === 'A' || best.grp === 'B' ? ' · ' + GNAME[best.grp] : best.grp === 'E' ? ' · 黑球' : '');
      tipEl.style.transform = 'translate(' + (e.clientX + 14) + 'px,' + (e.clientY + 14) + 'px)'; tipEl.classList.add('on');
    } else tipEl.classList.remove('on');
  }
  canvas.addEventListener('pointerleave', function () { tipEl.classList.remove('on'); });

  /* ---------- 選單與按鈕 ---------- */
  function showMenu() { menuOpen = true; $('#menu').hidden = false; G.acc = 0; }
  function hideMenu() { menuOpen = false; $('#menu').hidden = true; }
  $('#mPvp').addEventListener('click', function () { AUD.init(); AUD.ui(); newGame('pvp'); });
  $('#mAi').addEventListener('click', function () { AUD.init(); AUD.ui(); newGame('ai'); });
  /* 線上配對：前端大廳介面。尚未部署即時服務時如實告知，並提供改打電腦。 */
  var ONLINE_URL = (window.SOLAR_POOL_WS || '').trim();
  $('#mOnline').addEventListener('click', function () {
    AUD.init(); AUD.ui();
    $('#lbMsg').textContent = ONLINE_URL
      ? '已設定服務位址，但此版本的前端尚未實作連線同步，無法配對真人。可先與電腦對戰。'
      : '線上配對服務尚未部署，目前無法與真人對戰（部署方式見 README）。你可以先與電腦對戰。';
    $('#lobby').hidden = false;
  });
  $('#lbAi').addEventListener('click', function () { $('#lobby').hidden = true; newGame('ai'); });
  $('#lbBack').addEventListener('click', function () { $('#lobby').hidden = true; });
  $('#bHelp').addEventListener('click', function () { AUD.ui(); hasGame = false; showMenu(); }); // 回主選單 = 放棄本局，沒有暫停
  $('#oAgain').addEventListener('click', function () { newGame(G.mode); });
  $('#oMenu').addEventListener('click', function () { $('#over').hidden = true; showMenu(); });
  /* 全螢幕 */
  var elFull = $('#bFull');
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  elFull.addEventListener('click', function () {
    try {
      if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      var el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!rq) { toast('這個瀏覽器不支援全螢幕。', '', 2200); return; }
      var pr = rq.call(el);
      if (pr && pr.catch) pr.catch(function () { toast('全螢幕被瀏覽器擋下了；若在嵌入視窗中，請先用新分頁開啟。', '', 3600); });
    } catch (_) { toast('無法切換全螢幕。', '', 2000); }
  });
  function onFsChange() { var f = isFull(); elFull.textContent = f ? '離開全螢幕' : '全螢幕'; elFull.setAttribute('aria-pressed', f); }
  document.addEventListener('fullscreenchange', onFsChange); document.addEventListener('webkitfullscreenchange', onFsChange);
  $('#bFit').addEventListener('click', function () {
    CAM.gph = 0; CAM.gth = baseTheta(); CAM.thUser = false; CAM.gtx = 0; CAM.gtz = 0; CAM.gd = fitDistance(CAM.gth, 0); CAM.manual = CAM.auto;
  });
  $('#bAuto').addEventListener('click', function (e) {
    CAM.auto = !CAM.auto; e.currentTarget.setAttribute('aria-pressed', CAM.auto);
    if (CAM.auto) { CAM.manual = false; if (G.state === 'aiming' || G.state === 'aiThink') focusShot(); }
  });
  $('#bName').addEventListener('click', function (e) { var on = !document.body.classList.contains('names'); document.body.classList.toggle('names', on); e.currentTarget.setAttribute('aria-pressed', on); });
  $('#bSnd').addEventListener('click', function (e) { AUD.init(); AUD.on = !AUD.on; e.currentTarget.setAttribute('aria-pressed', AUD.on); });
  var rsTimer = 0, bRs = $('#bRestart');
  bRs.addEventListener('click', function () {
    if (bRs.dataset.arm === '1') { bRs.dataset.arm = '0'; bRs.textContent = '重新開始'; clearTimeout(rsTimer); newGame(G.mode); return; }
    bRs.dataset.arm = '1'; bRs.textContent = '再按一次確認';
    rsTimer = setTimeout(function () { bRs.dataset.arm = '0'; bRs.textContent = '重新開始'; }, 2500);
  });

  /* ---------- 球桿與瞄準線 ---------- */
  var cueMesh, guide = {}, ghostRing, reachMark, comet;
  function buildAimObjects() {
    comet = mesh(GEO.flat, PRG.comet, { uTime: 0, uLen: 60, uAlpha: 1 }, { blend: 'add', order: 10, depthWrite: false, visible: false });
    cueMesh = mesh(GEO.cue, PRG.cue, { uAlpha: 1 }, { order: 5, visible: false, blend: 'alpha', depthWrite: true });
    function rib(col, dash, order) {
      return mesh(GEO.flat, PRG.ribbon, { uColor: col, uAlpha: 0.8, uLen: 1, uDash: dash, uFade: 0, uTime: 0 }, { blend: 'add', order: order, depthTest: false, depthWrite: false, visible: false });
    }
    guide.main = rib([0.85, 0.95, 1], 1.6, 11);
    guide.dim = rib([0.7, 0.8, 1], 1.6, 11);
    guide.tgt = rib([1, 0.85, 0.5], 0, 11); guide.tgt.u.uFade = 1;
    guide.cue = rib([0.6, 0.85, 1], 0, 11); guide.cue.u.uFade = 1;
    ghostRing = mesh(GEO.flat, PRG.decal, { uColor: [0.85, 0.95, 1], uAlpha: 0.95, uMode: 1, uR: 0.9, uW: 0.06, uPow: 1 }, { blend: 'add', order: 11, depthTest: false, depthWrite: false, visible: false });
    ghostRing.scale = [2 * R / 0.9, 1, 2 * R / 0.9];
    reachMark = mesh(GEO.flat, PRG.decal, { uColor: [1, 0.8, 0.45], uAlpha: 0.9, uMode: 1, uR: 0.8, uW: 0.12, uPow: 1 }, { blend: 'add', order: 11, depthTest: false, depthWrite: false, visible: false });
    reachMark.scale = [R * 1.5, 1, R * 1.5];
  }
  function computeAim(ang) {
    var dx = Math.cos(ang), dy = Math.sin(ang), cx = cue.x, cy = cue.y, best = Infinity, hit = null;
    balls.forEach(function (b) {
      if (!b.on || b === cue) return;
      var ox = b.x - cx, oy = b.y - cy, pr = ox * dx + oy * dy;
      if (pr <= 0) return;
      var d2 = ox * ox + oy * oy - pr * pr;
      if (d2 >= D2) return;
      var t = pr - Math.sqrt(D2 - d2);
      if (t < best) { best = t; hit = b; }
    });
    var tw = Infinity;
    if (Math.abs(dx) > 1e-6) tw = Math.min(tw, ((dx > 0 ? HL - R : -(HL - R)) - cx) / dx);
    if (Math.abs(dy) > 1e-6) tw = Math.min(tw, ((dy > 0 ? HW - R : -(HW - R)) - cy) / dy);
    var out = { dx: dx, dy: dy, hit: null, len: Math.min(best, tw) };
    if (hit && best <= tw) {
      var ex = cx + dx * best, ey = cy + dy * best, nx = hit.x - ex, ny = hit.y - ey, nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      var cosC = dx * nx + dy * ny, tx = dx - cosC * nx, ty = dy - cosC * ny;
      out.hit = hit; out.ex = ex; out.ey = ey; out.nx = nx; out.ny = ny; out.cosC = cosC; out.tx = tx; out.ty = ty;
    } else { out.ex = cx + dx * tw; out.ey = cy + dy * tw; }
    return out;
  }
  function setRib(m, ax, ay, bx, by, width, alpha) {
    var len = Math.hypot(bx - ax, by - ay);
    if (len < 0.05) { m.visible = false; return; }
    m.visible = true; m.pos = [(ax + bx) / 2, R, (ay + by) / 2];
    m.quat = Q.axis(0, 1, 0, -Math.atan2(by - ay, bx - ax)); m.scale = [len, 1, width];
    m.u.uLen = len; m.u.uAlpha = alpha; upd(m);
  }
  function hideAim() { cueMesh.visible = false; comet.visible = false; guide.main.visible = guide.dim.visible = guide.tgt.visible = guide.cue.visible = ghostRing.visible = reachMark.visible = false; }
  function updateAim(dt, clock) {
    var showAim = (G.state === 'aiming' || G.state === 'aiThink' || G.state === 'striking');
    if (!showAim || !cue.on) { if (G.state === 'moving' && cueMesh.u.uAlpha > 0.02) { cueMesh.u.uAlpha -= dt * 6; comet.u.uAlpha = cueMesh.u.uAlpha; } else { hideAim(); } return; }
    var ang = G.state === 'striking' ? G.strike.ang : G.aim, human = !G.players[G.cur].ai;
    var a = computeAim(ang), alpha = human ? 0.85 : 0.55;
    ['main', 'dim', 'tgt', 'cue'].forEach(function (k) { guide[k].u.uTime = clock; });
    var sx = cue.x + Math.cos(ang) * R * 1.15, sy = cue.y + Math.sin(ang) * R * 1.15;
    if (G.state !== 'striking') {
      // 預估滑行距離：到不了的部分用暗線表示
      var pw = G.power, reach = pw > 0.02 ? rollDist(powerToSpeed(pw)) : Infinity, total = Math.max(0, a.len - R * 1.15);
      if (reach < total) {
        var rx = cue.x + Math.cos(ang) * (R * 1.15 + reach), ry = cue.y + Math.sin(ang) * (R * 1.15 + reach);
        setRib(guide.main, sx, sy, rx, ry, 0.3, alpha); setRib(guide.dim, rx, ry, a.ex, a.ey, 0.22, 0.22);
        reachMark.visible = true; reachMark.pos = [rx, R, ry]; upd(reachMark);
      } else { setRib(guide.main, sx, sy, a.ex, a.ey, 0.3, alpha); guide.dim.visible = false; reachMark.visible = false; }
      ghostRing.visible = true; ghostRing.pos = [a.ex, R, a.ey]; upd(ghostRing);
      if (human) { var gp = ballPx(a.ex, a.ey); ghostRing.u.uAlpha = 0.75 + 0.25 * Math.sin(clock * 5); }
      if (a.hit) {
        var tl = 5 + 11 * Math.max(0, a.cosC);
        setRib(guide.tgt, a.hit.x, a.hit.y, a.hit.x + a.nx * tl, a.hit.y + a.ny * tl, 0.3, 0.9);
        var sn = Math.hypot(a.tx, a.ty), cl = 3 + 9 * sn;
        if (sn > 0.02) setRib(guide.cue, a.ex, a.ey, a.ex + a.tx / sn * cl, a.ey + a.ty / sn * cl, 0.26, 0.7); else guide.cue.visible = false;
      } else { guide.tgt.visible = false; guide.cue.visible = false; }
    } else { guide.main.visible = guide.dim.visible = guide.tgt.visible = guide.cue.visible = ghostRing.visible = reachMark.visible = false; }
    // 球桿
    var pull = G.state === 'striking' ? G.strike.pull * Math.max(0, 1 - Math.pow(G.strike.t / 0.12, 2)) : G.power * 12;
    var dist = R + 0.05 + pull, dx = Math.cos(ang), dy = Math.sin(ang);
    cueMesh.visible = false; cueMesh.u.uAlpha = 1;
    // 彗星尾焰：從球桿尾端向後拖出
    var butt = dist, TL = 70 + 30 * G.power;
    comet.visible = true; comet.u.uTime = clock; comet.u.uLen = TL; comet.u.uAlpha = 0.55 + 0.45 * Math.max(G.power, G.state === 'striking' ? 1 : 0);
    comet.pos = [cue.x - dx * (butt + TL / 2), R + 0.3, cue.y - dy * (butt + TL / 2)];
    comet.quat = Q.axis(0, 1, 0, -Math.atan2(-dy, -dx)); comet.scale = [TL, 1, 8]; upd(comet);
  }

  /* ---------- 狀態更新 ---------- */
  function lerpAng(a, b, k) { var d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * k; }
  function updateAI(dt) {
    var ai = G.ai; ai.t += dt;
    if (ai.phase === 'wait') {
      if (ai.t > 0.9) { ai.plan = aiChoose(); ai.phase = 'aim'; ai.t = 0; ai.a0 = G.aim; }
    } else if (ai.phase === 'aim') {
      var k = Math.min(1, ai.t / 0.8); G.aim = lerpAng(ai.a0, ai.plan.ang, k * k * (3 - 2 * k));
      if (ai.t > 0.95) { ai.phase = 'pull'; ai.t = 0; focusShot(); }
    } else if (ai.phase === 'pull') {
      var k2 = Math.min(1, ai.t / 0.7); setPower(ai.plan.power * k2);
      if (ai.t > 0.85) { ai.phase = 'done'; fireShot(ai.plan.ang, ai.plan.power); }
    }
  }
  function tick(dt) {
    G.clock += dt;
    balls.forEach(function (b) { if (b.sink) { b.sink.t += dt; if (b.sink.t >= b.sink.dur) { b.sink = null; b.hidden = true; } } });
    if (!menuOpen) {
      if (G.state === 'aiming' && !G.players[G.cur].ai) {
        var r = (keys.ArrowLeft ? -1 : 0) + (keys.ArrowRight ? 1 : 0) + (keys.ArrowUp ? -1 : 0) + (keys.ArrowDown ? 1 : 0);
        if (r) G.aim += r * dt * (e_shift ? 0.12 : 0.6);
        if (charging) setPower(Math.min(1, G.power + dt * 0.7));
      } else if (G.state === 'aiThink') updateAI(dt);
      else if (G.state === 'placing' && G.placePos) {
        cue.x = Math.max(-HL + R, Math.min(HL - R, G.placePos[0])); cue.y = Math.max(-HW + R, Math.min(HW - R, G.placePos[1]));
        G.placeBad = !validCue(cue.x, cue.y);
      } else if (G.state === 'striking') {
        G.strike.t += dt;
        if (G.strike.t >= 0.12) strikeDone();
      } else if (G.state === 'moving') {
        G.moveT += dt; G.acc += dt;
        var n = 0;
        while (G.acc >= SUB && n < 600) { stepPhysics(SUB); G.acc -= SUB; n++; }
        if (G.acc > SUB) G.acc = 0;
        if (!anyMoving()) { G.settle += dt; if (G.settle > 0.4) { G.state = 'resolving'; resolveShot(); } } else G.settle = 0;
        if (G.moveT > 40) { balls.forEach(function (b) { b.vx = b.vy = 0; }); }
      }
    }
    AUD.cnt = 0;
    updateFx(dt, G.clock);
  }

  function updateVisuals(dt) {
    var t = G.clock;
    var legal = (G.state === 'aiming' || G.state === 'aiThink' || G.state === 'placing') ? legalTargets(G.players[G.cur]) : null;
    balls.forEach(function (b) {
      var target = 0.5;
      if (b === cue) target = 0.38;
      else if (legal) target = legal.indexOf(b) >= 0 ? (0.8 + 0.2 * Math.sin(t * 4)) : 0.2;
      b.ringA += (target - b.ringA) * Math.min(1, dt * 8);
      if (b === cue) b.halo.u.uColor = G.placeBad && G.state === 'placing' ? [1, 0.4, 0.4] : GCOL.C;
      syncBall(b, t);
    });
    // 天空跟著鏡頭；塵埃與星點慢轉
    sky.dome.pos = cam.pos.slice(); sky.dome.u.uTime = t; upd(sky.dome);
    var sq = Q.axis(0.2, 1, 0.1, t * 0.02);
    sky.meshes.forEach(function (m) { m.pos = cam.pos.slice(); m.quat = sq; m.u.uTime = t; upd(m); });
    sky.shoots.forEach(function (sh) {
      if (sh.t0 < 0 && t > sh.next) {
        var a0 = Math.random() * TAU, cx0 = (Math.random() - 0.5) * 300, cz0 = (Math.random() - 0.5) * 240, L0 = 120 + Math.random() * 80, ln0 = 45 + Math.random() * 40;
        sh.dx = Math.cos(a0); sh.dz = Math.sin(a0); sh.ax = cx0 - sh.dx * L0 / 2; sh.az = cz0 - sh.dz * L0 / 2; sh.L0 = L0; sh.t0 = t; sh.dur = 0.7 + Math.random() * 0.6;
        sh.quat = Q.axis(0, 1, 0, -Math.atan2(sh.dz, sh.dx)); sh.scale = [ln0, 1, 0.8 + Math.random() * 0.5]; sh.u.uLen = ln0; sh.visible = true;
      }
      if (sh.t0 >= 0) {
        var k = (t - sh.t0) / sh.dur;
        if (k >= 1) { sh.t0 = -1; sh.visible = false; sh.next = t + 2.5 + Math.random() * 5.5; }
        else { sh.pos = [sh.ax + sh.dx * sh.L0 * k, -120, sh.az + sh.dz * sh.L0 * k]; sh.u.uAlpha = Math.sin(Math.PI * k) * 0.9; upd(sh); }
      }
    });
    (sky.dust || []).forEach(function (m) { m.u.uOff = [t * m.flow[0], 0, t * m.flow[2]]; });
    updateAim(dt, t);
    var rx = cam.right;
    balls.forEach(function (b) {
      if (!b.badge) return;
      var vis = !menuOpen && b.on && !b.hidden;
      b.badge.classList.toggle('hide', !vis);
      if (!vis) return;
      var s = project(b.x, R, b.y), s2 = project(b.x + rx[0] * R, R, b.y + rx[1] * R);
      var r = Math.hypot(s2[0] - s[0], s2[1] - s[1]), size = Math.max(14, Math.min(26, r * 0.7));
      b.badge.style.width = b.badge.style.height = size + 'px';
      b.badge.style.fontSize = Math.max(9, size * 0.5) + 'px';
      b.badge.style.transform = 'translate3d(' + (s[0] + r * 0.74 - size / 2).toFixed(1) + 'px,' + (s[1] - r * 0.74 - size / 2).toFixed(1) + 'px,0)';
    });
  }

  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    tick(dt); updateCamera(dt); updateVisuals(dt);
    eng.render(SCENE, cam);
  }

  /* ---------- 啟動 ---------- */
  function onTexturesReady() {
    try {
      T.cue = eng.texture(makeCueTexture(), { repeatS: true });
      buildPrograms(); buildGeometry(); buildSky(); buildTable(); buildBalls(); buildFx(); buildPfx(); buildAimObjects(); buildAimPockets();
      buildTray(); resetBalls(); renderHUD();
      onResize(); CAM.gth = CAM.th = baseTheta(); CAM.gd = fitDistance(); CAM.d = CAM.gd * 5; CAM.ph = 0.9; CAM.gph = 0;
      ready = true;
      msgEl.textContent = '準備好了。選擇對戰模式開始。';
      $('#mPvp').disabled = false; $('#mAi').disabled = false; $('#mOnline').disabled = false;
      G.state = 'menu';
      requestAnimationFrame(frame);
      if (DBG) {
        window.__dbg = { renderHUD: renderHUD, setSpin: setSpin, planetFx: planetFx, byN: byN, AUD: AUD, G: G, balls: balls, cue: cue, tick: tick, newGame: newGame, fireShot: fireShot, advance: function (s) { var n = Math.round(s * 60); for (var i = 0; i < n; i++) { tick(1 / 60); updateCamera(1 / 60); } }, aiChoose: aiChoose, aiPlan: aiPlan, CAM: CAM, cam: cam, project: project, pickPlane: pickPlane, resolveShot: resolveShot, hideMenu: hideMenu, eng: eng, setPower: setPower, computeAim: computeAim, focusShot: focusShot, fitDistance: fitDistance, ballPx: ballPx };
      }
    } catch (err) {
      msgEl.textContent = '初始化失敗：' + (err && err.message);
      console.error(err);
    }
  }
})();

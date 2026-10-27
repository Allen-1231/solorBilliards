/* ================= 迷你 WebGL2 引擎（取代 three.js，僅含本遊戲需要的部分） ================= */
var E = (function () {
  'use strict';

  /* ---------- 向量 / 矩陣 / 四元數（矩陣為 column-major） ---------- */
  var M = {};
  M.ident = function () { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };
  M.mul = function (a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      var s = 0;
      for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  };
  M.perspective = function (fovy, aspect, near, far, shx, shy) {
    var f = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = f / aspect; o[5] = f;
    o[10] = (far + near) / (near - far); o[11] = -1; o[14] = 2 * far * near / (near - far);
    o[8] = -(shx || 0); o[9] = -(shy || 0);          // 以 NDC 平移畫面
    return o;
  };
  function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm3(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  M.lookAt = function (eye, ctr, up) {
    var z = norm3(sub3(eye, ctr)), x = norm3(cross3(up, z)), y = cross3(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1]);
  };
  M.invert = function (a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    return new Float32Array([
      (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
      (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
      (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
      (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det]);
  };
  M.trs = function (o, p, q, s) {
    var x = q[0], y = q[1], z = q[2], w = q[3], x2 = x + x, y2 = y + y, z2 = z + z;
    var xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    var sx = s[0], sy = s[1], sz = s[2];
    o[0] = (1 - (yy + zz)) * sx; o[1] = (xy + wz) * sx; o[2] = (xz - wy) * sx; o[3] = 0;
    o[4] = (xy - wz) * sy; o[5] = (1 - (xx + zz)) * sy; o[6] = (yz + wx) * sy; o[7] = 0;
    o[8] = (xz + wy) * sz; o[9] = (yz - wx) * sz; o[10] = (1 - (xx + yy)) * sz; o[11] = 0;
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
    return o;
  };
  /* 以矩陣變換三維點（含透視除法），回傳 [x,y,z,w] */
  M.xform = function (m, p) {
    var x = p[0], y = p[1], z = p[2];
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w];
  };

  var Q = {};
  Q.axis = function (ax, ay, az, ang) { var s = Math.sin(ang / 2), l = Math.hypot(ax, ay, az) || 1; return [ax / l * s, ay / l * s, az / l * s, Math.cos(ang / 2)]; };
  Q.mul = function (a, b) {
    return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  };
  Q.norm = function (q) { var l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };

  /* ---------- 幾何 ---------- */
  function sphereData(r, ws, hs) {
    var pos = [], nrm = [], uv = [], idx = [], grid = [];
    for (var iy = 0; iy <= hs; iy++) {
      var row = [], v = iy / hs;
      for (var ix = 0; ix <= ws; ix++) {
        var u = ix / ws;
        var x = -Math.cos(u * Math.PI * 2) * Math.sin(v * Math.PI);
        var y = Math.cos(v * Math.PI);
        var z = Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI);
        pos.push(x * r, y * r, z * r); nrm.push(x, y, z); uv.push(u, 1 - v);
        row.push(pos.length / 3 - 1);
      }
      grid.push(row);
    }
    for (iy = 0; iy < hs; iy++) for (ix = 0; ix < ws; ix++) {
      var a = grid[iy][ix + 1], b = grid[iy][ix], c = grid[iy + 1][ix], d = grid[iy + 1][ix + 1];
      if (iy !== 0) idx.push(a, b, d);
      if (iy !== hs - 1) idx.push(b, c, d);
    }
    return { position: pos, normal: nrm, uv: uv, index: idx };
  }
  /* 位於 XZ 平面的單位方塊（x、z ∈ [-0.5,0.5]），uv=(x+.5, z+.5) */
  function flatQuadData() {
    return { position: [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], normal: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], uv: [0, 0, 1, 0, 1, 1, 0, 1], index: [0, 2, 1, 0, 3, 2] };
  }
  /* 位於 XY 平面的單位方塊（廣告牌 / 垂直光幕），uv y 向上 */
  function uprightQuadData() {
    return { position: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], normal: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], uv: [0, 0, 1, 0, 1, 1, 0, 1], index: [0, 1, 2, 0, 2, 3] };
  }
  /* 土星環：XZ 平面環，uv.x = 半徑比例（與原模型相同） */
  function ringData(inner, outer, segs) {
    var pos = [], nrm = [], uv = [], idx = [];
    for (var i = 0; i <= segs; i++) {
      var a = i / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(c * inner, 0, s * inner, c * outer, 0, s * outer);
      nrm.push(0, 1, 0, 0, 1, 0);
      uv.push(0, 0.5, 1, 0.5);
      if (i < segs) { var k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    return { position: pos, normal: nrm, uv: uv, index: idx };
  }
  /* 圓盤：XZ 平面，uv 以圓心 0.5 */
  function discData(r, segs) {
    var pos = [0, 0, 0], nrm = [0, 1, 0], uv = [0.5, 0.5], idx = [];
    for (var i = 0; i <= segs; i++) {
      var a = i / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(c * r, 0, s * r); nrm.push(0, 1, 0); uv.push(0.5 + c * 0.5, 0.5 + s * 0.5);
      if (i < segs) idx.push(0, i + 1, i + 2);
    }
    return { position: pos, normal: nrm, uv: uv, index: idx };
  }
  /* 單位方塊（中心在原點，各面 uv 0..1） */
  function boxData() {
    var F = [[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
    var pos = [], nrm = [], uv = [], idx = [];
    F.forEach(function (f, i) {
      var n = f[0], u = f[1], v = f[2], b = i * 4;
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function (q) {
        pos.push((n[0] + u[0] * q[0] + v[0] * q[1]) * 0.5, (n[1] + u[1] * q[0] + v[1] * q[1]) * 0.5, (n[2] + u[2] * q[0] + v[2] * q[1]) * 0.5);
        nrm.push(n[0], n[1], n[2]); uv.push(q[0] * 0.5 + 0.5, q[1] * 0.5 + 0.5);
      });
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    return { position: pos, normal: nrm, uv: uv, index: idx };
  }
  /* 球桿：沿 +y，桿尖在原點，stations = [{y, r, c:[r,g,b]}] */
  function cueData(stations, segs) {
    var pos = [], nrm = [], col = [], uv = [], idx = [];
    stations.forEach(function (st, si) {
      for (var i = 0; i <= segs; i++) {
        var a = i / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        pos.push(c * st.r, st.y, s * st.r); nrm.push(c, 0, s); col.push(st.c[0], st.c[1], st.c[2]); uv.push(i / segs, si);
      }
    });
    for (var si = 0; si < stations.length - 1; si++) for (var i = 0; i < segs; i++) {
      var a = si * (segs + 1) + i, b = a + 1, c2 = a + segs + 1, d = c2 + 1;
      idx.push(a, c2, b, b, c2, d);
    }
    return { position: pos, normal: nrm, uv: uv, aCol: col, index: idx };
  }

  /* ---------- 引擎 ---------- */
  function Engine(canvas) {
    var gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl; this.canvas = canvas;
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.maxAniso = this.aniso ? Math.min(8, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) : 1;
    this.white = this.texFromPixels([255, 255, 255, 255], 1, 1);
    this.state = {};
    gl.clearColor(0.016, 0.024, 0.043, 1);
    gl.enable(gl.DEPTH_TEST);
    this.drawCalls = 0;
  }
  var P = Engine.prototype;

  P.texFromPixels = function (px, w, h) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(px));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return { isTex: true, t: t };
  };
  /* 由 Image / Canvas 建立貼圖；repeatS 讓經度接縫可以重複取樣 */
  P.texture = function (img, opt) {
    opt = opt || {};
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opt.repeatS === false ? gl.CLAMP_TO_EDGE : gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, this.maxAniso);
    return { isTex: true, t: t, image: img };
  };

  P.geometry = function (d) {
    var gl = this.gl, g = { count: d.index ? d.index.length : d.position.length / 3, indexed: !!d.index, bufs: {} };
    g.vao = gl.createVertexArray();
    gl.bindVertexArray(g.vao);
    var self = this;
    function attr(name, loc, size) {
      if (!d[name]) return;
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d[name]), d.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      g.bufs[name] = b;
    }
    attr('position', 0, 3); attr('normal', 1, 3); attr('uv', 2, 2); attr('aCol', 3, 3);
    if (d.index) {
      var ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      var big = d.position.length / 3 > 65535;
      g.itype = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(d.index) : new Uint16Array(d.index), gl.STATIC_DRAW);
    }
    gl.bindVertexArray(null);
    g.mode = d.mode === 'points' ? gl.POINTS : gl.TRIANGLES;
    g.set = function (name, arr, count) {            // 動態更新（粒子）
      gl.bindBuffer(gl.ARRAY_BUFFER, g.bufs[name]);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
      if (count !== undefined) g.count = count;
    };
    return g;
  };

  var VPRE = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nuniform mat4 modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix;\nuniform vec3 cameraPosition;\nin vec3 position;\nin vec3 normal;\nin vec2 uv;\n';
  var FPRE = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nuniform mat4 viewMatrix;\nuniform vec3 cameraPosition;\nout vec4 outColor;\n';
  P.program = function (vs, fs, name) {
    var gl = this.gl;
    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        var log = gl.getShaderInfoLog(s);
        console.error('[shader ' + (name || '?') + '] ' + log);
        throw new Error('shader compile failed: ' + (name || '?') + ' ' + log);
      }
      return s;
    }
    var vsrc = VPRE + vs.replace(/\battribute\b/g, 'in').replace(/\bvarying\b/g, 'out');
    var fsrc = FPRE + fs.replace(/\bvarying\b/g, 'in').replace(/\btexture2D\b/g, 'texture').replace(/\bgl_FragColor\b/g, 'outColor');
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsrc));
    gl.bindAttribLocation(p, 0, 'position'); gl.bindAttribLocation(p, 1, 'normal'); gl.bindAttribLocation(p, 2, 'uv'); gl.bindAttribLocation(p, 3, 'aCol');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[program ' + (name || '?') + '] ' + gl.getProgramInfoLog(p));
      throw new Error('program link failed: ' + (name || '?'));
    }
    var prog = { p: p, u: {}, name: name };
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i), base = info.name.replace(/\[0\]$/, '');
      prog.u[base] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
    }
    return prog;
  };

  /* mesh = { geo, prog, u:{}, world:Float32Array, blend, depthTest, depthWrite, cull, order, visible } */
  P.setState = function (m) {
    var gl = this.gl, st = this.state;
    var blend = m.blend || 'none';
    if (st.blend !== blend) {
      st.blend = blend;
      if (blend === 'none') gl.disable(gl.BLEND);
      else {
        gl.enable(gl.BLEND);
        if (blend === 'alpha') gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        else if (blend === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else if (blend === 'premul') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
    }
    var dt = m.depthTest !== false, dw = m.depthWrite !== false && blend === 'none' ? true : (m.depthWrite === true);
    if (st.dt !== dt) { st.dt = dt; if (dt) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST); }
    if (st.dw !== dw) { st.dw = dw; gl.depthMask(dw); }
    var cull = m.cull || 'none';
    if (st.cull !== cull) {
      st.cull = cull;
      if (cull === 'none') gl.disable(gl.CULL_FACE);
      else { gl.enable(gl.CULL_FACE); gl.cullFace(cull === 'front' ? gl.FRONT : gl.BACK); }
    }
  };

  P.setUniform = function (info, v, unit) {
    var gl = this.gl;
    switch (info.type) {
      case gl.FLOAT: if (info.size > 1) gl.uniform1fv(info.loc, v); else gl.uniform1f(info.loc, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(info.loc, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(info.loc, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(info.loc, v); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(info.loc, false, v); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(info.loc, false, v); break;
      case gl.SAMPLER_2D:
        gl.activeTexture(gl.TEXTURE0 + unit.n);
        gl.bindTexture(gl.TEXTURE_2D, (v && v.isTex ? v : this.white).t);
        gl.uniform1i(info.loc, unit.n); unit.n++;
        break;
    }
  };

  /* cam = { view, proj, pos:[x,y,z] } */
  P.render = function (list, cam) {
    var gl = this.gl;
    gl.depthMask(true); this.state.dw = true;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var items = list.filter(function (m) { return m.visible !== false; });
    items = items.map(function (m, i) { return { m: m, i: i }; });
    items.sort(function (a, b) { return ((a.m.order || 0) - (b.m.order || 0)) || (a.i - b.i); });
    var cur = null, unit = { n: 0 }, self = this;
    this.drawCalls = 0;
    items.forEach(function (it) {
      var m = it.m;
      if (cur !== m.prog) { gl.useProgram(m.prog.p); cur = m.prog; }
      self.setState(m);
      var pu = m.prog.u, mv;
      unit.n = 0;
      if (pu.modelMatrix) gl.uniformMatrix4fv(pu.modelMatrix.loc, false, m.world);
      if (pu.viewMatrix) gl.uniformMatrix4fv(pu.viewMatrix.loc, false, cam.view);
      if (pu.projectionMatrix) gl.uniformMatrix4fv(pu.projectionMatrix.loc, false, cam.proj);
      if (pu.modelViewMatrix) { mv = M.mul(cam.view, m.world); gl.uniformMatrix4fv(pu.modelViewMatrix.loc, false, mv); }
      if (pu.cameraPosition) gl.uniform3fv(pu.cameraPosition.loc, cam.pos);
      var u = m.u;
      for (var k in u) { if (pu[k]) self.setUniform(pu[k], u[k], unit); }
      // 沒給值的 sampler 綁定預設白色貼圖，避免警告
      for (var k2 in pu) { if (pu[k2].type === gl.SAMPLER_2D && !(k2 in u)) self.setUniform(pu[k2], null, unit); }
      gl.bindVertexArray(m.geo.vao);
      if (m.geo.indexed) gl.drawElements(m.geo.mode, m.geo.count, m.geo.itype, 0);
      else gl.drawArrays(m.geo.mode, 0, m.geo.count);
      self.drawCalls++;
    });
    gl.bindVertexArray(null);
  };

  P.resize = function (w, h, dpr) {
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };

  return {
    Engine: Engine, M: M, Q: Q,
    geo: { sphere: sphereData, flat: flatQuadData, upright: uprightQuadData, ring: ringData, disc: discData, cue: cueData, box: boxData },
    v: { sub: sub3, dot: dot3, cross: cross3, norm: norm3 }
  };
})();

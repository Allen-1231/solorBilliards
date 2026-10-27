  var PLANET_VS = [
    'varying vec2 vUv; varying vec3 vN; varying vec3 vE; varying vec3 vNo; varying vec3 vW;',
    'void main(){',
    '  vUv = uv;',
    '  vec3 n = normalize(normal);',
    '  vec3 e = normalize(cross(vec3(0.,1.,0.), n));',
    '  vec3 no = cross(n, e);',
    '  mat3 m = mat3(modelMatrix);',
    '  vN = normalize(m * n); vE = normalize(m * e); vNo = normalize(m * no);',
    '  vec4 w = modelMatrix * vec4(position, 1.0);',
    '  vW = w.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * w;',
    '}'
  ].join('\n');

  var PLANET_FS = [
    'uniform sampler2D map, bumpMap, ringMap;',
    'uniform float useBump, bumpK, rimK, ringOn, ringIn, ringOut, amb;',
    'uniform vec2 bumpTexel;',
    'uniform vec3 sunDir, rimColor, ringN, pc;',
    'varying vec2 vUv; varying vec3 vN; varying vec3 vE; varying vec3 vNo; varying vec3 vW;',
    'void main(){',
    '  vec3 N = normalize(vN);',
    '  vec3 Nb = N;',
    '  if (useBump > 0.5) {',
    '    float hx = texture2D(bumpMap, vUv + vec2(bumpTexel.x,0.)).r - texture2D(bumpMap, vUv - vec2(bumpTexel.x,0.)).r;',
    '    float hy = texture2D(bumpMap, vUv + vec2(0.,bumpTexel.y)).r - texture2D(bumpMap, vUv - vec2(0.,bumpTexel.y)).r;',
    '    Nb = normalize(N - bumpK * (hx * normalize(vE) + hy * normalize(vNo)));',
    '  }',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  float ndl = dot(N, sunDir);',
    '  float soft = smoothstep(-0.07, 0.24, ndl);',
    '  float l = clamp(dot(Nb, sunDir), 0.0, 1.0);',
    '  vec3 c = texture2D(map, vUv).rgb;',
    '  float shade = 1.0;',
    '  if (ringOn > 0.5) {',
    '    float dn = dot(sunDir, ringN);',
    '    if (abs(dn) > 0.001) {',
    '      float t = dot(pc - vW, ringN) / dn;',
    '      if (t > 0.0) {',
    '        vec3 hit = vW + sunDir * t;',
    '        float rr = length(hit - pc);',
    '        float u = (rr - ringIn) / (ringOut - ringIn);',
    '        if (u > 0.0 && u < 1.0) shade = 1.0 - texture2D(ringMap, vec2(u, 0.5)).a * 0.88;',
    '      }',
    '    }',
    '  }',
    '  vec3 col = c * (amb + 1.12 * pow(l, 0.78) * soft * shade);',
    '  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '  col += rimColor * fres * (0.08 + 0.92 * clamp(ndl + 0.35, 0.0, 1.0)) * rimK;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var EARTH_FS = [
    'uniform sampler2D dayMap, nightMap, topoMap, waterMap;',
    'uniform vec3 sunDir;',
    'varying vec2 vUv; varying vec3 vN; varying vec3 vE; varying vec3 vNo; varying vec3 vW;',
    'void main(){',
    '  vec3 N = normalize(vN);',
    '  vec2 px = vec2(1.0/2048.0, 1.0/1024.0);',
    '  float hx = texture2D(topoMap, vUv + vec2(px.x,0.)).r - texture2D(topoMap, vUv - vec2(px.x,0.)).r;',
    '  float hy = texture2D(topoMap, vUv + vec2(0.,px.y)).r - texture2D(topoMap, vUv - vec2(0.,px.y)).r;',
    '  vec3 Nb = normalize(N - 3.2 * (hx * normalize(vE) + hy * normalize(vNo)));',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  float ndl = dot(N, sunDir);',
    '  float dayMix = smoothstep(-0.10, 0.20, ndl);',
    '  float diff = clamp(dot(Nb, sunDir), 0.0, 1.0);',
    '  vec3 dayC = texture2D(dayMap, vUv).rgb;',
    '  vec3 col = dayC * (0.10 + 1.02 * pow(diff, 0.7)) * dayMix;',
    '  float water = texture2D(waterMap, vUv).r;',
    '  vec3 H = normalize(sunDir + V);',
    '  float spec = pow(max(dot(Nb, H), 0.0), 70.0) * water;',
    '  col += vec3(1.0, 0.95, 0.85) * spec * 0.55 * dayMix;',
    '  vec3 nightC = texture2D(nightMap, vUv).rgb;',
    '  float nightMix = 1.0 - dayMix;',
    '  col += dayC * 0.028 * nightMix;',
    '  col += vec3(1.0, 0.82, 0.55) * pow(nightC, vec3(1.15)) * 1.5 * nightMix;',
    '  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '  float sunSide = clamp(ndl + 0.35, 0.0, 1.0);',
    '  col += vec3(0.28, 0.58, 1.0) * fres * (0.10 + 0.9 * sunSide) * 0.85;',
    '  col += vec3(1.0, 0.45, 0.2) * exp(-pow(ndl / 0.11, 2.0)) * 0.10 * (0.4 + fres);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var CLOUD_FS = [
    'uniform sampler2D cloudMap; uniform vec3 sunDir;',
    'varying vec2 vUv; varying vec3 vN;',
    'void main(){',
    '  float d = texture2D(cloudMap, vUv).r;',
    '  float ndl = dot(normalize(vN), sunDir);',
    '  float lit = 0.035 + 0.965 * smoothstep(-0.12, 0.28, ndl);',
    '  gl_FragColor = vec4(vec3(1.0) * lit, d * 0.92);',
    '}'
  ].join('\n');
  var CLOUD_VS = [
    'varying vec2 vUv; varying vec3 vN;',
    'void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');

  var ATMO_VS = [
    'varying vec3 vNw; varying vec3 vWp;',
    'void main(){ vNw = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vWp = w.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * w; }'
  ].join('\n');
  var ATMO_FS = [
    'uniform vec3 sunDir, color; uniform float k;',
    'varying vec3 vNw; varying vec3 vWp;',
    'void main(){',
    '  vec3 V = normalize(cameraPosition - vWp);',
    '  vec3 n = normalize(vNw);',
    '  float i = pow(clamp(0.60 - dot(n, V), 0.0, 1.0), 3.4);',
    '  float lit = clamp(dot(n, sunDir) + 0.55, 0.0, 1.0);',
    '  vec3 c = mix(color * 0.55, mix(color, vec3(1.0), 0.25), i);',
    '  gl_FragColor = vec4(c * i * (0.25 + 0.95 * lit) * 1.5 * k, 1.0);',
    '}'
  ].join('\n');

  var RING_VS = [
    'varying vec2 vUv; varying vec3 vW;',
    'void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * w; }'
  ].join('\n');
  var RING_FS = [
    'uniform sampler2D ringMap; uniform vec3 sunDir, pc, ringN; uniform float pr;',
    'varying vec2 vUv; varying vec3 vW;',
    'void main(){',
    '  vec4 t = texture2D(ringMap, vec2(vUv.x, 0.5));',
    '  vec3 oc = vW - pc;',
    '  float b = dot(oc, sunDir);',
    '  float c = dot(oc, oc) - pr * pr;',
    '  float disc = b * b - c;',
    '  float sh = 1.0;',
    '  if (disc > 0.0 && (-b - sqrt(disc)) > 0.0) sh = 1.0 - smoothstep(0.0, 0.10, disc / (pr * pr));',
    '  float lit = 0.10 + 0.90 * pow(abs(dot(ringN, sunDir)), 0.45);',
    '  gl_FragColor = vec4(t.rgb * lit * (0.06 + 0.94 * sh) * 1.05, t.a * 0.96);',
    '}'
  ].join('\n');

  var SUN_VS = [
    'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
    'void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * w; }'
  ].join('\n');
  var SUN_FS = [
    'uniform sampler2D map; uniform float time;',
    'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
    'void main(){',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  float mu = clamp(dot(normalize(vN), V), 0.0, 1.0);',
    '  vec3 a = texture2D(map, vUv + vec2(time * 0.0040, 0.0)).rgb;',
    '  vec3 b = texture2D(map, vUv + vec2(0.37 - time * 0.0027, 0.0)).rgb;',
    '  vec3 c = mix(a, b, 0.5);',
    '  float lum = dot(c, vec3(0.3, 0.59, 0.11));',
    '  c = mix(c, vec3(1.0, 0.82, 0.5) * (lum * 1.5 + 0.2), 0.3);',
    '  c *= 0.52 + 0.78 * pow(mu, 0.5);',
    '  c += vec3(1.0, 0.5, 0.12) * pow(1.0 - mu, 3.0) * 0.30;',
    '  gl_FragColor = vec4(c * 1.05, 1.0);',
    '}'
  ].join('\n');

/* ================= 新增著色器（力場邊界、黑洞袋口、瞄準線、光暈、球桿、星點） ================= */
var FLAT_VS = [
  'varying vec2 vUv; varying vec3 vW;',
  'void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;',
  '  gl_Position = projectionMatrix * viewMatrix * w; }'
].join('\n');

var BILLBOARD_VS = [
  'uniform vec3 uCenter; uniform float uSize;',
  'varying vec2 vUv; varying vec3 vW;',
  'void main(){',
  '  vUv = uv;',
  '  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);',
  '  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);',
  '  vec3 w = uCenter + (right * position.x + up * position.y) * uSize;',
  '  vW = w;',
  '  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);',
  '}'
].join('\n');

var FIELD_FS = [
  'uniform float uTime, uCurtain; uniform vec4 uHits[8]; uniform vec3 uColor;',
  'varying vec2 vUv; varying vec3 vW;',
  'void main(){',
  '  float hit = 0.0;',
  '  for (int i = 0; i < 8; i++) {',
  '    vec4 h = uHits[i];',
  '    float age = uTime - h.w;',
  '    if (h.z > 0.0 && age > 0.0 && age < 1.8) {',
  '      vec2 d = vW.xz - h.xy;',
  '      hit += h.z * exp(-dot(d, d) / 26.0) * exp(-age * 2.4);',
  '    }',
  '  }',
  '  hit = min(hit, 1.6);',
  '  float shimmer = 0.88 + 0.12 * sin(vW.x * 0.9 + vW.z * 0.9 + uTime * 1.7);',
  '  float a;',
  '  if (uCurtain > 0.5) {',
  '    float g = pow(1.0 - vUv.y, 1.8);',
  '    a = g * (0.15 + 0.6 * hit) * shimmer;',
  '  } else {',
  '    float d = abs(vUv.y - 0.5) * 2.0;',
  '    float core = smoothstep(0.18, 0.0, d);',
  '    float glow = exp(-d * 3.0);',
  '    a = (core * 0.95 + glow * 0.40) * shimmer * (0.78 + 0.9 * hit);',
  '  }',
  '  vec3 col = mix(uColor, vec3(1.0), clamp(hit * 0.55, 0.0, 1.0));',
  '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
  '}'
].join('\n');

var HOLE_FS = [
  'uniform float uTime;',
  'varying vec2 vUv; varying vec3 vW;',
  'void main(){',
  '  vec2 p = vUv * 2.0 - 1.0; float r = length(p);',
  '  if (r > 1.0) discard;',
  '  float a = atan(p.y, p.x);',
  '  float sw = a + 2.6 / (r + 0.12) - uTime * 1.5;',
  '  float arms = 0.5 + 0.5 * sin(sw * 3.0);',
  '  float arms2 = 0.5 + 0.5 * sin(sw * 5.0 + 1.7);',
  '  float core = 1.0 - smoothstep(0.34, 0.54, r);',
  '  float disk = smoothstep(1.0, 0.42, r) * smoothstep(0.22, 0.52, r);',
  '  vec3 c1 = vec3(0.30, 0.10, 0.78), c2 = vec3(1.0, 0.58, 0.22), c3 = vec3(0.45, 0.85, 1.0);',
  '  vec3 glow = mix(c1, c2, arms);',
  '  glow = mix(glow, c3, arms2 * 0.28 * (1.0 - r));',
  '  glow *= disk * (0.5 + 0.9 * arms) * 1.2;',
  '  float rim = exp(-pow((r - 0.56) / 0.05, 2.0)) * 0.9;',
  '  glow += vec3(1.0, 0.86, 0.62) * rim;',
  '  float alpha = clamp(core + disk * 0.5, 0.0, 1.0);',
  '  gl_FragColor = vec4(glow * (1.0 - core), alpha);',
  '}'
].join('\n');

var DECAL_FS = [
  'uniform vec3 uColor; uniform float uAlpha, uMode, uR, uW, uPow;',
  'varying vec2 vUv; varying vec3 vW;',
  'void main(){',
  '  float d = length(vUv - 0.5) * 2.0;',
  '  float a;',
  '  if (uMode < 0.5) a = pow(clamp(1.0 - d, 0.0, 1.0), uPow);',
  '  else a = exp(-pow((d - uR) / uW, 2.0)) * step(d, 1.0);',
  '  gl_FragColor = vec4(uColor, a * uAlpha);',
  '}'
].join('\n');

var RIBBON_FS = [
  'uniform vec3 uColor; uniform float uAlpha, uLen, uDash, uFade, uTime;',
  'varying vec2 vUv; varying vec3 vW;',
  'void main(){',
  '  float along = vUv.x * uLen;',
  '  float dash = 1.0;',
  '  if (uDash > 0.0) dash = step(0.5, fract(along / uDash - uTime * 0.7));',
  '  float d = abs(vUv.y - 0.5) * 2.0;',
  '  float edge = smoothstep(1.0, 0.3, d);',
  '  float fade = mix(1.0, 1.0 - vUv.x, uFade);',
  '  gl_FragColor = vec4(uColor, uAlpha * edge * dash * fade);',
  '}'
].join('\n');

var CUE_VS = [
  'attribute vec3 aCol; varying vec3 vC; varying vec3 vN;',
  'void main(){ vC = aCol; vN = normalize(mat3(modelMatrix) * normal);',
  '  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }'
].join('\n');
var CUE_FS = [
  'uniform float uAlpha; varying vec3 vC; varying vec3 vN;',
  'void main(){',
  '  vec3 n = normalize(vN); vec3 L = normalize(vec3(0.35, 0.9, 0.4));',
  '  float l = 0.42 + 0.58 * max(dot(n, L), 0.0);',
  '  float sp = pow(max(dot(n, normalize(L + vec3(0.0, 1.0, 0.0))), 0.0), 28.0) * 0.4;',
  '  gl_FragColor = vec4(vC * l + sp, uAlpha);',
  '}'
].join('\n');

var POINTS_VS = [
  'attribute vec3 aCol; uniform float uSize; varying vec3 vC;',
  'void main(){ vC = aCol; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); gl_PointSize = uSize; }'
].join('\n');
var POINTS_FS = [
  'uniform float uAlpha; varying vec3 vC;',
  'void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;',
  '  gl_FragColor = vec4(vC, uAlpha * (1.0 - d * 1.7)); }'
].join('\n');

var TEXQUAD_FS = [
  'uniform sampler2D uMap; uniform float uK;',
  'varying vec2 vUv; varying vec3 vW;',
  'void main(){ gl_FragColor = vec4(texture2D(uMap, vUv).rgb * uK, 1.0); }'
].join('\n');

var SKY_VS = [
  'varying vec3 vDir;',
  'void main(){ vDir = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }'
].join('\n');
var SKY_FS = [
  'uniform float uTime; varying vec3 vDir;',
  'float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
  'float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);',
  '  return mix(mix(mix(hash(i), hash(i + vec3(1.0,0.0,0.0)), f.x), mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), f.x), f.y),',
  '             mix(mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), f.x), mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z); }',
  'float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int o = 0; o < 5; o++) { s += a * noise(p); p = p * 2.01 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }',
  'void main(){',
  '  vec3 d = normalize(vDir); float ra = uTime * 0.01; d.xz = mat2(cos(ra), -sin(ra), sin(ra), cos(ra)) * d.xz;',
  '  vec3 p = d * 1.7; float t = uTime * 0.018;',
  '  vec3 q = vec3(fbm(p + vec3(0.0, t, 0.0)), fbm(p + vec3(5.2, 1.3, -t)), fbm(p + vec3(-3.1, 7.7, t * 0.8)));',
  '  float f = fbm(p + 2.2 * q + vec3(t, 0.0, 0.0));',
  '  float g = fbm(p * 1.6 - 1.8 * q + vec3(9.0, 3.0, -t * 1.3));',
  '  vec3 c = vec3(0.016, 0.012, 0.045);',
  '  c += vec3(0.30, 0.10, 0.52) * pow(f, 2.3) * 1.9;',
  '  c += vec3(0.46, 0.12, 0.40) * pow(g, 3.0) * 1.5;',
  '  c += vec3(0.12, 0.16, 0.55) * pow(q.x, 3.0) * 1.5;',
  '  c += vec3(0.22, 0.14, 0.60) * pow(q.z, 3.5) * 1.1;',
  '  c += vec3(0.05, 0.20, 0.26) * pow(q.y, 4.0) * 0.7;',
  '  float lat = dot(d, normalize(vec3(0.32, 0.88, 0.34)));',
  '  c += exp(-lat * lat * 5.0) * vec3(0.05, 0.04, 0.10) * (0.5 + f);',
  '  gl_FragColor = vec4(c, 1.0);',
  '}'
].join('\n');

/* ================= 球檯木框、皮革邊襯、桌面星雲布、彗星尾焰 ================= */
var BOX_VS = [
  'varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying vec3 vL;',
  'void main(){ vUv = uv; vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;',
  '  vN = normalize(mat3(modelMatrix) * normal);',
  '  gl_Position = projectionMatrix * viewMatrix * w; }'
].join('\n');

var RAIL_FS = [
  'uniform float uKind; uniform vec2 uAxis;',
  'varying vec2 vUv; varying vec3 vW; varying vec3 vN;',
  'float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
  'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }',
  'void main(){',
  '  vec3 n = normalize(vN);',
  '  vec3 L = normalize(vec3(-0.35, 0.85, 0.42));',
  '  vec3 V = normalize(cameraPosition - vW);',
  '  float al = dot(vW.xz, uAxis); float ac = dot(vW.xz, vec2(-uAxis.y, uAxis.x));',
  '  vec3 base; float spec;',
  '  if (uKind < 0.5) {',
  '    float g = n2(vec2(al * 0.22, ac * 2.6)) * 0.6 + n2(vec2(al * 0.8, ac * 9.0)) * 0.4;',
  '    float ring = 0.5 + 0.5 * sin(ac * 2.4 + g * 7.0 + vW.y * 1.6);',
  '    base = mix(vec3(0.13, 0.055, 0.03), vec3(0.34, 0.16, 0.07), ring * 0.65 + g * 0.35);',
  '    spec = 0.6;',
  '  } else if (uKind < 1.5) {',
  '    float p = n2(vW.xz * 3.5);',
  '    base = vec3(0.02, 0.022, 0.03) + p * 0.025; spec = 0.3;',
  '  } else {',
  '    base = vec3(0.92, 0.74, 0.38); spec = 1.4;',
  '  }',
  '  float dif = 0.34 + 0.66 * max(dot(n, L), 0.0);',
  '  float sp = pow(max(dot(n, normalize(L + V)), 0.0), 44.0) * spec;',
  '  vec3 col = base * dif + sp * vec3(1.0, 0.92, 0.8);',
  '  col += vec3(0.06, 0.14, 0.30) * pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.7;',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

var SURFACE_FS = [
  'uniform float uTime; varying vec2 vUv; varying vec3 vW;',
  'float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }',
  'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);',
  '  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }',
  'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.01 + vec2(1.7, 9.2); a *= 0.5; } return s; }',
  'void main(){',
  '  vec2 p = vW.xz * 0.045; float t = uTime * 0.02;',
  '  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));',
  '  float f = fbm(p + 2.0 * q + vec2(t, 0.0));',
  '  vec2 g = floor(vW.xz * 2.4); vec2 fr = fract(vW.xz * 2.4) - 0.5;',
  '  float hh = h21(g); vec2 off = vec2(h21(g + 3.1), h21(g + 7.7)) - 0.5;',
  '  float star = step(0.92, hh) * smoothstep(0.1, 0.0, length(fr - off * 0.7)) * (0.55 + 0.45 * sin(uTime * 1.8 + hh * 60.0));',
  '  vec3 col = vec3(0.014, 0.012, 0.04) + vec3(0.26, 0.10, 0.46) * pow(f, 2.4) * 1.5 + vec3(0.12, 0.14, 0.45) * pow(q.x, 3.0) * 1.0;',
  '  col += star * vec3(1.0, 0.92, 0.9);',
  '  float edge = min(1.0 - abs(vUv.x * 2.0 - 1.0), 1.0 - abs(vUv.y * 2.0 - 1.0));',
  '  gl_FragColor = vec4(col, 0.62 * smoothstep(0.0, 0.22, edge));',
  '}'
].join('\n');

var COMET_FS = [
  'uniform float uTime, uLen, uAlpha; varying vec2 vUv; varying vec3 vW;',
  'float h1(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
  'float n1(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), f.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), f.x), f.y); }',
  'void main(){',
  '  float x = vUv.x; float d = abs(vUv.y - 0.5) * 2.0;',
  '  float w = 0.22 + 0.78 * x; float dd = d / w;',
  '  float fall = pow(1.0 - x, 1.4);',
  '  float core = exp(-dd * dd * 7.0) * fall;',
  '  float st = n1(vec2(x * uLen * 0.25 - uTime * 2.2, vUv.y * 16.0));',
  '  float fil = smoothstep(0.5, 0.95, st) * exp(-dd * dd * 1.8) * fall * 1.1;',
  '  float glow = exp(-dd * dd * 1.4) * fall * 0.45;',
  '  float a = (core + fil + glow) * uAlpha;',
  '  vec3 col = mix(vec3(1.0, 0.50, 0.10), vec3(1.0, 0.96, 0.78), clamp(core * 1.4, 0.0, 1.0));',
  '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
  '}'
].join('\n');

var GLASS_FS = [
  'uniform vec3 uSize, uColor; uniform float uAlpha, uEdge;',
  'varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying vec3 vL;',
  'void main(){',
  '  vec3 d = (0.5 - abs(vL)) * uSize;',
  '  float w = 0.16;',
  '  vec3 e = vec3(smoothstep(w, 0.0, d.x), smoothstep(w, 0.0, d.y), smoothstep(w, 0.0, d.z));',
  '  float edge = max(max(e.x * e.y, e.y * e.z), e.x * e.z);',
  '  vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vW);',
  '  float fr = pow(1.0 - abs(dot(n, V)), 2.5);',
  '  float a = uAlpha * (0.10 + 0.5 * fr) + edge * uEdge;',
  '  vec3 col = mix(uColor, vec3(1.0), edge * 0.55);',
  '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
  '}'
].join('\n');

var DUST_VS = [
  'attribute vec3 aCol; uniform float uSize; uniform vec3 uOff, uBox; varying vec3 vC;',
  'void main(){ vC = aCol; vec3 p = position; p.xz = mod(p.xz + uOff.xz + uBox.xz * 0.5, uBox.xz) - uBox.xz * 0.5;',
  '  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0); gl_PointSize = uSize; }'
].join('\n');

/* 行星被撞時的特效（純視覺，不影響物理） */
var PFX_FS = [
  'uniform float uKind, uAge, uSeed, uAlpha; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW;',
  'float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }',
  'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }',
  'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }',
  'float ringf(float r, float r0, float w){ float d = (r - r0) / w; return exp(-d * d); }',
  'void main(){',
  '  vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;',
  '  float a = atan(p.y, p.x); float k = uAge; float fade = (1.0 - k) * (1.0 - k);',
  '  float front = 0.12 + 0.85 * (1.0 - pow(1.0 - k, 2.0));',
  '  vec3 col = uColor; float al = 0.0;',
  '  if (uKind < 0.5) {',
  '    float wob = 0.6 + 0.4 * sin(a * 7.0 + uSeed * 6.0 + k * 8.0);',
  '    for (int i = 0; i < 3; i++) { float fi = float(i); al += ringf(r, front - fi * 0.17, 0.045 + 0.012 * fi) * (1.0 - fi * 0.27) * wob; }',
  '    float foam = fbm(p * 7.0 + uSeed) * ringf(r, front, 0.09); al += foam * 0.9;',
  '    col = mix(uColor, vec3(0.92, 1.0, 1.0), clamp(foam * 1.6, 0.0, 1.0)); al *= fade;',
  '  } else if (uKind < 1.5) {',
  '    float n = fbm(p * 3.5 + uSeed * 3.0 + k * 1.2);',
  '    float edge = 0.28 + 0.62 * sqrt(k);',
  '    float blob = smoothstep(edge, edge - 0.2, r + (n - 0.5) * 0.4);',
  '    float hot = smoothstep(edge * 0.7, 0.0, r + (n - 0.5) * 0.3);',
  '    float crack = fbm(p * 10.0 + uSeed);',
  '    col = mix(vec3(0.85, 0.10, 0.02), vec3(1.0, 0.78, 0.25), hot); col *= 0.65 + 0.7 * crack;',
  '    al = blob * (1.0 - smoothstep(0.5, 1.0, k)) * 1.1;',
  '  } else if (uKind < 2.5) {',
  '    float n = fbm(p * 3.2 + uSeed * 5.0 + vec2(k * 0.9, 0.0));',
  '    float cl = smoothstep(0.38, 0.82, n) * smoothstep(1.0, 0.25, r / (0.35 + 0.65 * sqrt(k)));',
  '    al = cl * pow(1.0 - k, 1.2) * 0.9; col = uColor * (0.7 + 0.6 * n);',
  '  } else if (uKind < 3.5) {',
  '    float s = a + 7.0 * r - k * 9.0 + uSeed * 6.0; float arms = 0.5 + 0.5 * sin(s * 2.0);',
  '    float env = smoothstep(1.0, 0.15, r) * smoothstep(0.0, 0.08, r);',
  '    col = mix(uColor, vec3(1.0, 0.92, 0.78), arms); al = arms * env * pow(1.0 - k, 0.9);',
  '    al += exp(-r * r * 60.0) * pow(1.0 - k, 0.6) * 0.8;',
  '  } else if (uKind < 4.5) {',
  '    for (int i = 0; i < 3; i++) { float fi = float(i); float f0 = front * (1.0 - fi * 0.2);',
  '      float band = smoothstep(f0 - 0.035, f0, r) * smoothstep(f0 + 0.16, f0 + 0.05, r); al += band * (0.75 + 0.25 * sin(r * 110.0 + fi * 2.0)); }',
  '    al *= fade * 0.9;',
  '  } else if (uKind < 5.5) {',
  '    float n = fbm(p * 3.0 + uSeed * 4.0 + vec2(0.0, k));',
  '    float cl = smoothstep(0.35, 0.8, n) * smoothstep(1.0, 0.2, r / (0.35 + 0.65 * sqrt(k)));',
  '    float st = pow(vn(vec2(a * 6.0 + uSeed * 9.0, floor(k * 14.0))), 7.0) * smoothstep(1.0, 0.1, r) * 3.0;',
  '    col = mix(uColor, vec3(1.0, 1.0, 0.8), clamp(st, 0.0, 1.0)); al = (cl * 0.8 + st) * pow(1.0 - k, 1.1);',
  '  } else if (uKind < 6.5) {',
  '    float sp = pow(abs(cos(3.0 * a + uSeed)), 24.0); float env = smoothstep(front, front - 0.35, r) * smoothstep(0.0, 0.06, r);',
  '    float sp2 = pow(abs(cos(6.0 * a + 1.0)), 40.0) * 0.5;',
  '    al = (sp + sp2) * env + ringf(r, front * 0.55, 0.03) * 0.6; al *= fade * 1.1; col = mix(uColor, vec3(1.0), 0.4);',
  '  } else {',
  '    float aur = ringf(r, front, 0.1) * (0.55 + 0.45 * sin(a * 9.0 + k * 10.0 + uSeed * 6.0));',
  '    float cl = smoothstep(0.45, 0.8, fbm(p * 4.0 + uSeed * 3.0 - vec2(k, 0.0))) * smoothstep(1.0, 0.3, r / (0.3 + 0.7 * sqrt(k))) * 0.6;',
  '    col = mix(uColor, vec3(0.95, 1.0, 1.0), clamp(cl * 1.5, 0.0, 1.0)); al = (aur + cl) * fade * 1.1;',
  '  }',
  '  al *= smoothstep(1.0, 0.82, r);',
  '  gl_FragColor = vec4(col, clamp(al * uAlpha, 0.0, 1.0));',
  '}'
].join('\n');

var STAR_VS = [
  'attribute vec3 aCol; uniform float uSize, uTime; varying vec3 vC;',
  'void main(){ float h = fract(sin(float(gl_VertexID) * 12.9898) * 43758.5453);',
  '  float tw = 0.72 + 0.28 * sin(uTime * (0.8 + h * 2.2) + h * 60.0);',
  '  vC = aCol * tw; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); gl_PointSize = uSize; }'
].join('\n');

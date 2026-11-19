/** Depth-displaced images in raw WebGL (no three.js).
 *
 *  A 128×128 plane is pushed towards the camera by a depth map, viewed through a
 *  narrow perspective camera (fov 19°, z 2.65) and rotated with the pointer, so a
 *  flat cut-out gains real parallax. Two flavours:
 *
 *  - createDepthSlide(): a product shot that follows the pointer and breathes.
 *  - createDepthPortrait(): the Home hero. Its sunglasses (lens mask) show a video
 *    graded like a CRT (aperture grille + scanlines + fisheye); during the intro the
 *    same video starts full-screen and the camera "dives" out of the lenses.
 *
 *  Both pause off-screen and on hidden tabs, and report readiness so a static
 *  <img> can stay underneath until the first frame lands. */

const VS = `
attribute vec2 aPos;
uniform mat4 uProj;
uniform mat4 uModel;
uniform sampler2D tDepth;
uniform float uDisp;
uniform vec2 uSize;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = aPos;
  float d = texture2D(tDepth, aPos).r;
  vec3 p = vec3((aPos.x - 0.5) * uSize.x, (aPos.y - 0.5) * uSize.y, d * uDisp);
  vNormal = normalize(mat3(uModel) * vec3(0.0, 0.0, 1.0));
  gl_Position = uProj * uModel * vec4(p, 1.0);
}`;

const FS_SLIDE = `
precision mediump float;
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float uLight;
uniform vec3 uLightDir;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  if (uLight > 0.001) {
    float e = 1.0 / 256.0;
    float dx = texture2D(tDepth, vUv + vec2(e, 0.0)).r - texture2D(tDepth, vUv - vec2(e, 0.0)).r;
    float dy = texture2D(tDepth, vUv + vec2(0.0, e)).r - texture2D(tDepth, vUv - vec2(0.0, e)).r;
    vec3 n = normalize(vec3(-dx * 6.0, -dy * 6.0, 1.0));
    float k = max(dot(n, uLightDir), 0.0);
    c.rgb += c.rgb * k * 0.22 * uLight;
  }
  gl_FragColor = vec4(c.rgb * c.a, c.a);
}`;

const FS_PORTRAIT = `
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tLens;      // r = lens mask, g = gloss highlight
uniform sampler2D tVideo;
uniform vec2 uRes;
uniform float uVideoAspect;
uniform float uLight;
uniform float uScale;
uniform float uScaleY;
uniform vec2 uOffset;
uniform float uFisheye;
uniform float uWarp;
uniform float uCrt;
uniform vec2 uSplit;
uniform vec2 uCell;
uniform float uDive;
uniform float uWarm;
uniform float uIntensity;
uniform vec3 uHSB;
uniform float uLensOn;
uniform float uOverlay;
uniform float uAlpha;
uniform float uInset;
varying vec2 vUv;
varying vec3 vNormal;

float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 hsb(vec3 rgb, vec3 d) {
  vec3 h = rgb2hsv(rgb);
  h.x = fract(h.x + d.x); h.y = clamp(h.y * d.y, 0.0, 1.0); h.z = clamp(h.z * d.z, 0.0, 1.0);
  return hsv2rgb(h);
}
vec2 fisheye(vec2 uv, float s) {
  vec2 c = uv - 0.5; float r = length(c);
  return c * (1.0 + s * r * r) + 0.5;
}
vec2 cover(vec2 s) {
  float sa = uRes.x / uRes.y; vec2 c = s - 0.5;
  if (sa > uVideoAspect) c.y *= uVideoAspect / sa; else c.x *= sa / uVideoAspect;
  return c * (1.0 - 2.0 * uInset) + 0.5;
}
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  // Soft key light from the upper left, following the mesh rotation.
  float k = max(dot(normalize(vNormal), normalize(vec3(-0.35, 0.45, 0.82))), 0.0);
  vec3 col = base.rgb * (0.9 + 0.12 * k * uLight);
  vec4 lens = texture2D(tLens, vUv);
  float mask = mix(1.0, lens.r, uLensOn);
  if (mask > 0.001) {
    vec2 luv = vUv;
    luv = (luv - 0.5) * uScale + 0.5;
    luv.y = (luv.y - 0.5) / uScaleY + 0.5;
    luv += uOffset;
    luv = fisheye(luv, uFisheye);
    if (uWarp > 0.001) {
      vec2 n = luv * 8.0;
      luv += vec2(vnoise(n) - 0.5, vnoise(n + vec2(73.0, 19.0)) - 0.5) * uWarp * 0.18;
    }
    vec2 suv = gl_FragCoord.xy / uRes;
    vec2 ruv = mix(cover(suv), luv, uDive);
    ruv.y = 1.0 - ruv.y;
    vec2 split = vec2(uSplit.x, -uSplit.y);
    vec3 v;
    v.r = texture2D(tVideo, clamp(ruv + split, 0.0, 1.0)).r;
    v.g = texture2D(tVideo, clamp(ruv, 0.0, 1.0)).g;
    v.b = texture2D(tVideo, clamp(ruv - split, 0.0, 1.0)).b;
    vec3 lc = hsb(v, uHSB) * uIntensity;
    if (uWarm > 0.001) lc = mix(lc, clamp(lc * vec3(1.28, 1.02, 0.55) + vec3(0.06, 0.025, 0.0), 0.0, 1.0), uWarm);
    vec2 cuv = mix(suv, luv, uDive);
    float gx = cuv.x / uCell.x * 6.2831853;
    vec3 grille = 0.5 + 0.5 * vec3(sin(gx), sin(gx + 2.0944), sin(gx + 4.1888));
    lc *= mix(vec3(1.0), 0.62 + 0.76 * grille, uCrt * 0.5);
    lc *= 1.0 - uCrt * 0.38 * (0.5 + 0.5 * sin(cuv.y / uCell.y * 6.2831853));
    lc *= 1.0 + uCrt * 0.22;
    // Gloss: a screen-blended sheen across the lenses, only once the portrait has landed.
    lc = mix(lc, 1.0 - (1.0 - lc) * (1.0 - vec3(0.95, 0.9, 1.0) * lens.g), uOverlay * 0.85);
    col = mix(col, lc, mask);
  }
  float a = mix(1.0, base.a, uLensOn) * uAlpha;
  gl_FragColor = vec4(col * a, a);
}`;

/* ---- tiny matrix helpers (column-major) ---------------------------------- */
type M4 = Float32Array;
const perspective = (fovDeg: number, aspect: number, near = 0.1, far = 100): M4 => {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
};
/** T(x,y,z) · Rx(rx) · Ry(ry) · S(s), camera at (0,0,cz) folded into tz. */
const model = (x: number, y: number, z: number, rx: number, ry: number, s: number): M4 => {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  // R = Rx * Ry  (three.js default Euler order XYZ applies X first in matrix form Rx·Ry·Rz)
  const r00 = cy, r01 = 0, r02 = sy;
  const r10 = sx * sy, r11 = cx, r12 = -sx * cy;
  const r20 = -cx * sy, r21 = sx, r22 = cx * cy;
  return new Float32Array([r00 * s, r10 * s, r20 * s, 0, r01 * s, r11 * s, r21 * s, 0, r02 * s, r12 * s, r22 * s, 0, x, y, z, 1]);
};

function compile(gl: WebGLRenderingContext, vs: string, fs: string) {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  const u = new Map<string, WebGLUniformLocation | null>();
  return { p, u: (n: string) => (u.has(n) ? u.get(n)! : (u.set(n, gl.getUniformLocation(p, n)), u.get(n)!)) };
}

function plane(gl: WebGLRenderingContext, seg = 128) {
  const n = seg + 1;
  const pos = new Float32Array(n * n * 2);
  for (let y = 0, i = 0; y < n; y++) for (let x = 0; x < n; x++, i += 2) { pos[i] = x / seg; pos[i + 1] = y / seg; }
  const idx = new Uint16Array(seg * seg * 6);
  for (let y = 0, i = 0; y < seg; y++)
    for (let x = 0; x < seg; x++, i += 6) {
      const a = y * n + x, b = a + 1, c = a + n, d = c + 1;
      idx.set([a, b, c, b, d, c], i);
    }
  const vb = gl.createBuffer(), ib = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  return { vb, ib, count: idx.length };
}

function texture(gl: WebGLRenderingContext, src: TexImageSource | null) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  return t;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });

function context(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return gl;
}

const ew = (e: number, dt: number) => 1 - Math.pow(1 - e, 60 * dt);
const smooth = (t: number) => t * t * (3 - 2 * t);
const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const CAMERA = { fov: 19, z: 2.65 } as const;

/** Shared pointer, in -1..1 viewport coordinates. */
const pointer = { x: 0, y: 0, lastX: 0, lastY: 0, has: false, dirX: 1, dirY: 0, impulse: 0 };
let pointerBound = false;
function bindPointer() {
  if (pointerBound) return;
  pointerBound = true;
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    if (pointer.has) {
      const dx = e.clientX - pointer.lastX, dy = e.clientY - pointer.lastY, d = Math.hypot(dx, dy);
      if (d > 0.5) { pointer.dirX = dx / d; pointer.dirY = dy / d; pointer.impulse = Math.min(1, pointer.impulse + d / 60); }
    }
    pointer.lastX = e.clientX; pointer.lastY = e.clientY; pointer.has = true;
  }, { passive: true });
}

interface Loop { start(): void; stop(): void; destroy(): void }
function loop(canvas: HTMLCanvasElement, frame: (now: number, dt: number) => boolean | void, extraPause?: () => boolean): Loop {
  let raf = 0, last = 0, visible = true, dead = false;
  const tick = (now: number) => {
    raf = 0;
    if (dead || !visible || document.hidden || extraPause?.()) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (frame(now, dt) !== false) raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && !dead) { last = 0; raf = requestAnimationFrame(tick); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const io = new IntersectionObserver(([e]) => { visible = e?.isIntersecting ?? true; visible ? start() : stop(); }, { threshold: 0 });
  io.observe(canvas);
  const vis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', vis);
  return { start, stop, destroy: () => { dead = true; stop(); io.disconnect(); document.removeEventListener('visibilitychange', vis); } };
}

function sizer(gl: WebGLRenderingContext, canvas: HTMLCanvasElement, maxDpr: number, onResize: () => void) {
  const host = canvas.parentElement ?? canvas;
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    onResize();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();
  return () => ro.disconnect();
}

/* ======================================================================== */

export interface DepthSlideOptions {
  src: string;
  depth: string;
  aspect?: number;
  overscan?: number;
  dispScale?: number;
  reduced?: boolean;
  onReady?: () => void;
}
export interface DepthSlide { setActive(on: boolean): void; setLight(on: boolean): void; destroy(): void }

/** Product shot with pointer parallax (rotY .17, rotX .09, ease .03) and a slow breath. */
export async function createDepthSlide(canvas: HTMLCanvasElement, o: DepthSlideOptions): Promise<DepthSlide | null> {
  const gl = context(canvas);
  if (!gl) return null;
  let prog;
  try { prog = compile(gl, VS, FS_SLIDE); } catch { return null; }
  const [img, dep] = await Promise.all([loadImage(o.src), loadImage(o.depth)]).catch(() => [null, null]);
  if (!img || !dep) return null;
  bindPointer();
  const aspect = o.aspect ?? 16 / 9, overscan = o.overscan ?? 1.12, disp = o.dispScale ?? 0.18;
  const geo = plane(gl);
  const tD = texture(gl, img), tZ = texture(gl, dep);
  let proj = perspective(CAMERA.fov, 1), scale = 1, active = true, inactiveAt = 0, light = 0, lightOn = false;
  const cur = { x: 0, y: 0 };
  const t0 = performance.now();
  let lp: Loop | null = null;
  const undo = sizer(gl, canvas, 1.5, () => {
    const a = canvas.width / canvas.height;
    proj = perspective(CAMERA.fov, a);
    const vh = 2 * Math.tan((CAMERA.fov * Math.PI) / 360) * CAMERA.z;
    scale = Math.max(vh, (vh * a) / aspect) * overscan;
    lp?.start();
  });
  let ready = false;
  lp = loop(canvas, (now) => {
    if (!active && ready && now - inactiveAt > 1200) return false;
    const t = (now - t0) / 1000;
    cur.x += (pointer.x - cur.x) * 0.03;
    cur.y += (pointer.y - cur.y) * 0.03;
    const by = Math.sin(t * 0.5) * 0.02, bx = Math.sin(t * 0.35 + 1.3) * 0.014;
    const ry = o.reduced ? 0 : cur.x * 0.17 + by, rx = o.reduced ? 0 : cur.y * 0.09 + bx;
    light += ((lightOn ? 1 : 0) - light) * 0.08;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, geo.vb);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ib);
    gl.uniformMatrix4fv(prog.u('uProj'), false, proj);
    gl.uniformMatrix4fv(prog.u('uModel'), false, model(0, 0, -CAMERA.z, rx, ry, scale));
    gl.uniform2f(prog.u('uSize'), aspect, 1);
    gl.uniform1f(prog.u('uDisp'), disp);
    gl.uniform1f(prog.u('uLight'), light);
    const lx = 0.75 * cur.x - 0.15, ly = -(0.75 * cur.y) + 0.2, lz = 0.7, ll = Math.hypot(lx, ly, lz);
    gl.uniform3f(prog.u('uLightDir'), lx / ll, ly / ll, lz / ll);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tD); gl.uniform1i(prog.u('tDiffuse'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tZ); gl.uniform1i(prog.u('tDepth'), 1);
    gl.drawElements(gl.TRIANGLES, geo.count, gl.UNSIGNED_SHORT, 0);
    if (!ready) { ready = true; canvas.style.opacity = '1'; o.onReady?.(); }
  });
  lp.start();
  const L = lp;
  return {
    setActive(on) { if (active && !on) inactiveAt = performance.now(); active = on; if (on) L.start(); },
    setLight(on) { lightOn = on; L.start(); },
    destroy() { L.destroy(); undo(); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}

/* ======================================================================== */

/** Intro state driven by the page timeline (all values mutable). */
export interface PortraitIntro {
  progress: number;      // 0 = full-screen video, 1 = portrait landed
  heroAlpha: number;
  startScale: number;
  endScale: number;
  lensYOffset: number;
  diveStartW: number;
  diveSpan: number;
  warpAmplitude: number;
  crtScale: number;
}

export interface PortraitOptions {
  diffuse: string;
  depth: string;
  lens: string;
  video: HTMLVideoElement;
  /** Plane aspect (image width / height). */
  aspect: number;
  /** Lens centre in image UV (y from the top) — the video is centred there. */
  lensCenter: [number, number];
  phone?: boolean;
  reduced?: boolean;
  intro: PortraitIntro;
  /** Extra pause condition (e.g. hero fully wiped away). */
  paused?: () => boolean;
  onReady?: () => void;
  onFail?: () => void;
}

export const PORTRAIT = {
  disp: 0.165,
  mouse: { intensity: 0.12, intensityV: 0.016, ease: 0.025, pan: 0.15, panEase: 0.022 },
  breath: { speed: 0.75, inMove: 0.02, inOrbit: 0.03, outMove: 0.04, outOrbit: 0.02 },
  reflection: { scale: 2.35, scaleY: 0.54, fisheye: 3.45, intensity: 1.3, video: { hue: 0, sat: 0.75, bright: 0.6 } },
} as const;

/** End scale of the landed portrait: fills the height but keeps 86px of headroom. */
export function portraitFit(phone: boolean, viewportH = window.innerHeight) {
  if (phone) return { endScale: 0.74, diveStartW: 1.8, diveSpan: 0.82 };
  const t = Math.tan((CAMERA.fov * Math.PI) / 360) * CAMERA.z, e = 0.85;
  const r = (t - (-0.06 + 0.22 * (1 - e) - e / 2) - (2 * t * 86) / viewportH) / 0.912;
  return { endScale: Math.min(e, Math.max(0.6, r)), diveStartW: 1, diveSpan: 0.7 };
}

export interface DepthPortrait { destroy(): void; wake(): void }

export async function createDepthPortrait(canvas: HTMLCanvasElement, o: PortraitOptions): Promise<DepthPortrait | null> {
  const gl = context(canvas);
  if (!gl) { o.onFail?.(); return null; }
  let prog;
  try { prog = compile(gl, VS, FS_PORTRAIT); } catch (e) { console.error(e); o.onFail?.(); return null; }
  const imgs = await Promise.all([loadImage(o.diffuse), loadImage(o.depth), loadImage(o.lens)]).catch(() => null);
  if (!imgs) { o.onFail?.(); return null; }
  bindPointer();
  const [img, dep, lensImg] = imgs;
  const geo = plane(gl);
  const tD = texture(gl, img), tZ = texture(gl, dep), tL = texture(gl, lensImg), tV = texture(gl, null);
  const video = o.video;
  let videoReady = false;
  const upload = () => {
    if (video.readyState < 2) return;
    gl.bindTexture(gl.TEXTURE_2D, tV);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    videoReady = true;
  };
  let proj = perspective(CAMERA.fov, 1), aspect = 1;
  let lp: Loop | null = null;
  const undo = sizer(gl, canvas, o.phone ? 1.25 : 1.5, () => {
    aspect = canvas.width / canvas.height;
    proj = perspective(CAMERA.fov, aspect);
    lp?.start();
  });
  const cur = { x: 0, y: 0, px: 0, py: 0 };
  const br = { orbitT: 0, orbit: 0, moveT: 0, move: 0, t: 0 };
  const split = { x: 0, y: 0 };
  let ready = false;
  const { mouse, breath, reflection: R } = PORTRAIT;
  const yOff = -((1 - o.lensCenter[1]) - 0.5) * R.scale / R.scaleY;
  const xOff = -(o.lensCenter[0] - 0.5) * R.scale;

  const frame = (_now: number, dt: number) => {
    upload();
    if (!videoReady) return true;
    const I = o.intro, reduced = !!o.reduced;
    if (!reduced) {
      br.t += dt;
      const s = Math.sin(br.t * breath.speed), up = s > 0;
      br.orbitT = s * (up ? breath.inOrbit : breath.outOrbit);
      br.moveT = s * (up ? breath.inMove : breath.outMove) * 0.012;
      br.move += (br.moveT - br.move) * ew(0.06, dt);
      br.orbit += (-br.orbitT - br.orbit) * ew(0.012, dt);
      const tx = o.phone ? 0 : pointer.x, ty = o.phone ? 0 : pointer.y;
      cur.x += (tx - cur.x) * ew(mouse.ease, dt);
      cur.y += (ty - cur.y) * ew(mouse.ease, dt);
      cur.px += (tx - cur.px) * ew(mouse.panEase, dt);
      cur.py += (ty - cur.py) * ew(mouse.panEase, dt);
    }
    const B = c01((I.progress - 0.85) / 0.15), Y = reduced ? 0 : smooth(B);
    const ry = cur.x * mouse.intensity * Y;
    const rx = cur.y * mouse.intensityV * Y + br.orbit * Y;
    let px = -0.34 * cur.px * mouse.pan * Y;
    const H = o.phone ? -0.131 : -0.06 - (0.85 - I.endScale) * (I.lensYOffset + 0.5);
    let py = 0.07 * cur.py * mouse.pan * Y + br.move * Y + H;

    const t = I.progress, r = 1 - Math.pow(1 - t, 2.4);
    const l = I.startScale + (I.endScale - I.startScale) * r;
    const vh = Math.tan((CAMERA.fov * Math.PI) / 360) * CAMERA.z, vw = vh * aspect;
    const b = Math.max((2 * vw * I.diveStartW) / 0.35, I.endScale + 0.4);
    const w = c01((b - l) / Math.max((b - I.endScale) * I.diveSpan, 1e-4));
    const C = c01(t / 0.16), S = smooth(C);
    const L = c01((2 - l) / Math.max(2 - I.endScale, 1e-4)), M = smooth(L);
    py += I.lensYOffset * (1 - l);
    const cap = o.phone ? -0.111 : H + 0.056;
    if (py > cap) py = cap;
    pointer.impulse *= Math.pow(0.94, 60 * dt);
    if (pointer.impulse < 0.004) pointer.impulse = 0;
    split.x += (pointer.dirX * pointer.impulse * 0.012 - split.x) * ew(0.12, dt);
    split.y += (pointer.dirY * pointer.impulse * 0.006 - split.y) * ew(0.12, dt);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, geo.vb);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ib);
    const u = prog.u;
    gl.uniformMatrix4fv(u('uProj'), false, proj);
    gl.uniformMatrix4fv(u('uModel'), false, model(px, py, -CAMERA.z, rx, ry, l));
    gl.uniform2f(u('uSize'), o.aspect, 1);
    gl.uniform1f(u('uDisp'), PORTRAIT.disp);
    gl.uniform2f(u('uRes'), canvas.width, canvas.height);
    gl.uniform1f(u('uVideoAspect'), (video.videoWidth || 16) / (video.videoHeight || 9));
    gl.uniform1f(u('uLight'), Y);
    gl.uniform1f(u('uScale'), R.scale);
    gl.uniform1f(u('uScaleY'), R.scaleY);
    gl.uniform2f(u('uOffset'), xOff - 0.03 * cur.x * Y, yOff + 0.02 * cur.y * Y);
    gl.uniform1f(u('uFisheye'), R.fisheye);
    gl.uniform1f(u('uWarp'), Math.sin(C * Math.PI) * I.warpAmplitude);
    gl.uniform1f(u('uCrt'), 0.5);
    gl.uniform2f(u('uSplit'), split.x, split.y);
    // Grille 6 CSS px, scanlines 5 CSS px (screen-space while full-screen).
    gl.uniform2f(u('uCell'), (6 * I.crtScale) / Math.max(1, canvas.clientWidth), (5 * I.crtScale) / Math.max(1, canvas.clientHeight));
    gl.uniform1f(u('uDive'), smooth(w));
    gl.uniform1f(u('uWarm'), S * (1 - M));
    gl.uniform1f(u('uIntensity'), 1 + (R.intensity - 1) * S);
    gl.uniform3f(u('uHSB'), 0, 1 + (R.video.sat - 1) * S, 1 + (R.video.bright - 1) * S);
    gl.uniform1f(u('uLensOn'), c01((w - 0.25) / 0.5));
    gl.uniform1f(u('uOverlay'), M);
    gl.uniform1f(u('uAlpha'), I.heroAlpha);
    gl.uniform1f(u('uInset'), 0.004);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tD); gl.uniform1i(u('tDiffuse'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tZ); gl.uniform1i(u('tDepth'), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tL); gl.uniform1i(u('tLens'), 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tV); gl.uniform1i(u('tVideo'), 3);
    gl.drawElements(gl.TRIANGLES, geo.count, gl.UNSIGNED_SHORT, 0);
    if (!ready) { ready = true; canvas.style.opacity = '1'; o.onReady?.(); }
    return true;
  };
  const L = (lp = loop(canvas, frame, o.paused));
  canvas.addEventListener('webglcontextlost', () => o.onFail?.());
  video.addEventListener('loadeddata', () => L.start());
  L.start();
  return {
    wake: () => L.start(),
    destroy() { L.destroy(); undo(); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}

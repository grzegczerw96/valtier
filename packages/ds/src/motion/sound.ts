/** Procedural UI sound engine (WebAudio, no audio files required).
 *
 *  - hover():  short bright tick when the pointer enters a link/button
 *  - card():   softer, lower tick for cards ([data-sound-card])
 *  - click():  two-partial click on press
 *  - whoosh(): filtered noise sweep for page transitions / veil lift
 *  - tick(k):  haptic-like micro tick while dragging rails (k = intensity 0..1)
 *  - bed:      ambient pad while sound is on; swap in a real track with
 *              setBedTrack('/audio/bed.mp3') — it loops with a cross-fade.
 *
 *  State persists in localStorage ("v-sound"). Desktop defaults to on (audio
 *  starts on the first pointer press, per autoplay rules); phones default off. */
import { isPhone } from './env';

const KEY = 'v-sound';
let ctx: AudioContext | null = null;
let master: GainNode, fx: GainNode, ui: GainNode, bedBus: GainNode;
let noise: AudioBuffer;
let enabled = false;
let hidden = false;
let ducked = 0;
let bed: { stop: () => void } | null = null;
let bedTrack: string | null = null;
/** A page can replace the synth pad with its own generator (see setBedVoice). */
export type BedVoice = (c: AudioContext, out: GainNode, noise: AudioBuffer) => { level: number; stop: () => void };
let bedVoice: BedVoice | null = null;
let lastTick = 0;

function ensure() {
  if (ctx) return ctx;
  const C = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);

  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 3.4, 2);
  const wet = ctx.createGain();
  wet.gain.value = 0.62;
  fx = ctx.createGain();
  fx.connect(verb);
  verb.connect(wet);
  wet.connect(master);

  ui = ctx.createGain();
  ui.gain.value = 1;
  route(ui, 0.42);
  bedBus = ctx.createGain();
  bedBus.gain.value = 1;
  route(bedBus, 0.45);
  noise = brown(ctx, 4);
  return ctx;
}

function route(node: GainNode, send: number) {
  node.connect(master);
  const s = ctx!.createGain();
  s.gain.value = send;
  node.connect(s);
  s.connect(fx);
}

function impulse(c: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (2 * Math.random() - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

function brown(c: AudioContext, seconds: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  let l = 0;
  for (let i = 0; i < len; i++) {
    l = (l + 0.02 * (2 * Math.random() - 1)) / 1.02;
    d[i] = 3.5 * l;
  }
  return b;
}

function ramp(g: GainNode, to: number, secs: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(Math.max(g.gain.value, 1e-4), t);
  g.gain.exponentialRampToValueAtTime(Math.max(to, 1e-4), t + secs);
}

const audible = () => enabled && !hidden && !!ctx && ctx.state === 'running';
const applyMaster = (secs = 0.5) => master && ramp(master, enabled && !hidden ? 0.85 : 1e-4, secs);

function blip(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', detune = 0) {
  if (!audible()) return;
  const c = ctx!;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.62, t + dur);
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ui);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBurst(dur: number, gain: number, from: number, to: number, q = 1.2) {
  if (!audible()) return;
  const c = ctx!;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(ui);
  src.start(t, Math.random() * 2);
  src.stop(t + dur + 0.05);
}

export const sound = {
  hover: () => blip(2350, 0.045, 0.05, 'sine'),
  card: () => blip(1180, 0.08, 0.06, 'triangle'),
  click: () => {
    blip(1650, 0.05, 0.09, 'square', -1200);
    blip(820, 0.09, 0.06, 'sine');
  },
  tab: (k = 0.85) => blip(1400, 0.06, 0.07 * k, 'triangle'),
  whoosh: (k = 0.45) => noiseBurst(0.55, 0.22 * k, 380, 2600, 0.9),
  tick: (k = 1) => {
    const now = performance.now();
    if (now - lastTick < 55) return;
    lastTick = now;
    blip(3200 + 900 * k, 0.018, 0.018 + 0.03 * k, 'square', -2400);
  },
};

/* ---- Ambient bed ------------------------------------------------------- */
function startBed() {
  if (!ctx || bed) return;
  const c = ctx;
  const out = c.createGain();
  out.gain.value = 0.0001;
  out.connect(bedBus);
  if (bedTrack) {
    let src: AudioBufferSourceNode | null = null;
    fetch(bedTrack)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => c.decodeAudioData(b))
      .then((buf) => {
        if (!bed) return;
        src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(out);
        src.start();
        ramp(out, 0.35, 2.5);
      })
      .catch(() => {});
    bed = { stop: () => { ramp(out, 1e-4, 0.8); setTimeout(() => { src?.stop(); out.disconnect(); }, 900); } };
    return;
  }
  if (bedVoice) {
    const v = bedVoice(c, out, noise);
    ramp(out, v.level, 2.5);
    bed = { stop: () => { ramp(out, 1e-4, 0.8); setTimeout(() => { v.stop(); out.disconnect(); }, 900); } };
    return;
  }
  // Synth pad: two detuned saws -> slow lowpass sweep, plus soft brown-noise air.
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  lp.Q.value = 0.6;
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  lfo.frequency.value = 0.045;
  lfoG.gain.value = 260;
  lfo.connect(lfoG).connect(lp.frequency);
  const voices = [55, 82.4, 110.2, 164.8].map((f, i) => {
    const o = c.createOscillator();
    o.type = i % 2 ? 'triangle' : 'sawtooth';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 7;
    const g = c.createGain();
    g.gain.value = i < 2 ? 0.09 : 0.045;
    o.connect(g).connect(lp);
    o.start();
    return o;
  });
  const air = c.createBufferSource();
  air.buffer = noise;
  air.loop = true;
  const airF = c.createBiquadFilter();
  airF.type = 'highpass';
  airF.frequency.value = 1800;
  const airG = c.createGain();
  airG.gain.value = 0.012;
  air.connect(airF).connect(airG).connect(out);
  air.start();
  lp.connect(out);
  lfo.start();
  ramp(out, 0.22, 3);
  bed = {
    stop: () => {
      ramp(out, 1e-4, 0.8);
      setTimeout(() => {
        voices.forEach((v) => v.stop());
        air.stop();
        lfo.stop();
        out.disconnect();
      }, 900);
    },
  };
}
function stopBed() {
  bed?.stop();
  bed = null;
}

export function setBedTrack(url: string | null) {
  bedTrack = url;
  if (bed) {
    stopBed();
    if (enabled) startBed();
  }
}

/** Swap the ambient bed for a page-specific voice (null restores the pad). */
export function setBedVoice(v: BedVoice | null) {
  if (v === bedVoice) return;
  bedVoice = v;
  if (bed) {
    stopBed();
    if (enabled && !ducked) startBed();
  }
}

/* ---- Public state ------------------------------------------------------ */
const listeners = new Set<(on: boolean) => void>();
export const isSoundOn = () => enabled;
export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function setSound(on: boolean, persist = false) {
  enabled = on;
  if (persist) {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
  }
  listeners.forEach((f) => f(on));
  const c = ensure();
  if (!c) return;
  if (on) {
    try { await c.resume(); } catch {}
    if (!enabled) return;
    applyMaster(0.5);
    if (!ducked) startBed();
  } else {
    applyMaster(0.3);
    stopBed();
  }
}

/** Default state + autoplay unlock on the first press. */
export function initSound() {
  let stored: string | null = null;
  try { stored = localStorage.getItem(KEY); } catch {}
  if (stored === 'off' || (isPhone() && stored !== 'on')) {
    listeners.forEach((f) => f(false));
    return;
  }
  enabled = true;
  listeners.forEach((f) => f(true));
  window.addEventListener('pointerdown', () => setSound(true), { once: true });
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    applyMaster(0.4);
  });
}

/** Lower the bed while a video with its own audio is playing. */
export function duck(on: boolean) {
  ducked = Math.max(0, ducked + (on ? 1 : -1));
  if (!bedBus || !ctx) return;
  ramp(bedBus, ducked ? 1e-4 : 1, 0.6);
}

/** Global pointer wiring: hover ticks on interactive elements, click on press. */
export function wireUiSounds() {
  let current: Element | null = null;
  let lastHover = 0;
  window.addEventListener('pointerover', (e) => {
    if (!enabled || (e as PointerEvent).pointerType !== 'mouse') return;
    const t = (e.target as Element | null)?.closest?.('a, button, [role="button"], [data-sound], [data-sound-card]') ?? null;
    if (t === current) return;
    current = t;
    const now = performance.now();
    if (t && now - lastHover > 45) {
      lastHover = now;
      t.closest('[data-sound-card]') ? sound.card() : sound.hover();
    }
  });
  let press: { id: number; x: number; y: number; travel: number } | null = null;
  window.addEventListener('pointerdown', (e) => {
    press = null;
    if (!enabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.target as Element;
    if (!(el instanceof Element) || el.closest('[data-no-click-sound]')) return;
    if (!el.closest('a[href], button:not(:disabled), [role="button"], [role="tab"], input, select, label, summary, [data-sound]')) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, travel: 0 };
  });
  window.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    press.travel += Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y);
    press.x = e.clientX;
    press.y = e.clientY;
  });
  window.addEventListener('pointerup', (e) => {
    const p = press;
    press = null;
    if (p && p.id === e.pointerId && enabled && p.travel <= 6) sound.click();
  });
  window.addEventListener('pointercancel', () => (press = null));
}

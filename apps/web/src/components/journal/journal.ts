/** Journal page controller: picks the desktop field or the phone lattice (live, by
 *  the site's phone query), keeps the open entry in ?item=<id> with real history
 *  entries, and plays the arrival: with ?item= on desktop the camera holds on the
 *  entry while the others fade in (blurred, staggered) once the veil lifts; the
 *  card follows 750 ms later (950 ms without a veil). */
import { PHONE_QUERY, prefersReducedMotion } from '@valtier/ds/motion/env';
import { afterVeil } from '@valtier/ds/motion/veil';
import type { BedVoice } from '@valtier/ds/motion/sound';
import { createField, type FieldApi } from './field';
import { createLattice, type LatticeApi } from './lattice';
import { createDetail, type DetailApi } from './detail';
import { createSheet, type SheetApi } from './sheet';
import type { Field, Item } from './layout';

const PARAM = 'item';
const CARD_DELAY = 950;
const CARD_AFTER_VEIL = 750;

/** Journal ambience: airy high-passed noise and, every 9 s (one time in two), a
 *  soft sine note from C / F / G / B♭ that drifts a few cents. */
const journalBed: BedVoice = (c, out, noise) => {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1400;
  const g = c.createGain();
  g.gain.value = 0.05;
  src.connect(hp).connect(g).connect(out);
  src.start();
  const notes = [60, 65, 67, 70];
  const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  const iv = window.setInterval(() => {
    if (Math.random() >= 0.5) return;
    const t = c.currentTime + 0.05;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz(notes[Math.floor(4 * Math.random())]), t);
    o.detune.setValueAtTime(-12, t);
    o.detune.linearRampToValueAtTime(9, t + 3);
    const e = c.createGain();
    e.gain.setValueAtTime(1e-4, t);
    e.gain.exponentialRampToValueAtTime(0.03, t + 1.2);
    e.gain.exponentialRampToValueAtTime(1e-4, t + 3.4);
    o.connect(e).connect(out);
    o.start(t);
    o.stop(t + 3.5);
  }, 9000);
  return { level: 0.5, stop: () => { clearInterval(iv); src.stop(); } };
};

export function initJournal(root: HTMLElement) {
  const data = JSON.parse(root.querySelector('[data-jr-data]')!.textContent!) as { items: Item[]; field: Field; latestId: string };
  const { items } = data;
  const byId = new Map(items.map((it) => [it.id, it]));
  const mq = matchMedia(PHONE_QUERY);
  let phone = mq.matches;

  const fieldRoot = root.querySelector<HTMLElement>('[data-jr-field]')!;
  const latticeRoot = root.querySelector<HTMLElement>('[data-jr-lattice]')!;
  let field: FieldApi | null = null;
  let lattice: LatticeApi | null = null;
  let detail: DetailApi | null = null;
  let sheet: SheetApi | null = null;

  let current: Item | null = null;
  let held = false;        // desktop arrival: card waits
  let popping = false;     // a history.back() of ours is in flight
  let queued: Item | null = null;
  let soundOn = false;

  import('@valtier/ds/motion/sound').then((m) => {
    m.setBedVoice(journalBed);
    soundOn = m.isSoundOn();
    m.onSoundChange((on) => (soundOn = on));
  });

  // ---------------------------------------------------------------- views
  const ensureDesktop = () => {
    if (!field) field = createField(fieldRoot, root.querySelector('[data-jr-layer]')!, root.querySelector('[data-jr-captions]')!, items, data.field, (it) => openItem(it));
    if (!detail) detail = createDetail(root.querySelector('[data-jr-detail]')!, { onClose: closed, onPrev: () => step(-1), onNext: () => step(1) });
  };
  const ensurePhone = () => {
    if (!lattice) lattice = createLattice(latticeRoot, root.querySelector('[data-jr-lattice-layer]')!, items, data.field, (it) => openItem(it));
    if (!sheet) sheet = createSheet(root.querySelector('[data-jr-sheet]')!, closed);
  };
  const mount = () => {
    fieldRoot.hidden = phone;
    latticeRoot.hidden = !phone;
    if (phone) ensurePhone();
    else ensureDesktop();
  };

  // ---------------------------------------------------------------- show / hide
  function show(it: Item) {
    current = it;
    root.setAttribute('data-open', '');
    if (phone) {
      lattice!.setOpen(true);
      sheet!.open(it, soundOn);
    } else {
      field!.setActive(it.id);
      if (!held) detail!.open(it, soundOn);
    }
  }
  /** After the close animation (or a back navigation). */
  function hide() {
    current = null;
    held = false;
    root.removeAttribute('data-open');
    field?.setActive(null);
    lattice?.setOpen(false);
  }

  // ---------------------------------------------------------------- URL
  const idFromUrl = () => new URLSearchParams(location.search).get(PARAM);
  function writeUrl(it: Item) {
    const url = new URL(location.href);
    const had = url.searchParams.has(PARAM);
    url.searchParams.set(PARAM, it.id);
    if (had) history.replaceState({ ...(history.state ?? {}), jrEntry: !!history.state?.jrEntry }, '', url);
    else history.pushState({ jrEntry: true }, '', url);
  }

  function openItem(it: Item) {
    if (popping) queued = it;
    else writeUrl(it);
    show(it);
  }
  function step(d: number) {
    if (!current) return;
    const i = items.findIndex((x) => x.id === current!.id);
    if (i < 0) return;
    openItem(items[(i + d + items.length) % items.length]);
  }
  /** The open view finished closing. */
  function closed() {
    queued = null;
    hide();
    if (popping) return;
    if (history.state?.jrEntry) {
      popping = true;
      history.back();
      return;
    }
    const url = new URL(location.href);
    url.searchParams.delete(PARAM);
    history.replaceState({ jrEntry: false }, '', url);
  }

  window.addEventListener('popstate', () => {
    const q = queued;
    queued = null;
    popping = false;
    const id = idFromUrl();
    if (q) { writeUrl(q); show(q); return; }
    const it = id ? byId.get(id) ?? null : null;
    if (it) { show(it); return; }
    if (current) {
      // back button while open: close the view; its onClose then finds no ?item
      popping = true;
      if (phone) sheet?.close();
      else detail?.close();
      window.setTimeout(() => (popping = false), 400);
    }
  });

  // ---------------------------------------------------------------- layout switch
  mq.addEventListener('change', () => {
    const next = mq.matches;
    if (next === phone) return;
    const open = current;
    if (open) { if (phone) sheet?.close(); else detail?.close(); }
    phone = next;
    mount();
    if (open) window.setTimeout(() => show(open), 260);
  });

  // ---------------------------------------------------------------- arrival
  mount();
  const startId = idFromUrl();
  const start = startId ? byId.get(startId) : null;
  if (start) {
    if (phone) {
      lattice!.focus(start.id);
      show(start);
    } else {
      held = !prefersReducedMotion();
      field!.entrance(start.id);
      show(start);
      let shown = false;
      const reveal = () => {
        if (shown || !held) return;
        shown = true;
        held = false;
        if (current) detail!.open(current, soundOn);
      };
      const timer = window.setTimeout(reveal, CARD_DELAY);
      afterVeil(() => {
        field?.release();
        clearTimeout(timer);
        window.setTimeout(reveal, CARD_AFTER_VEIL);
      });
    }
  }
}

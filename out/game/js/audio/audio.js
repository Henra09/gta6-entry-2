// All sound, synthesized live with WebAudio: engine drone, gunshots, impacts, skids,
// sirens, pickups, UI blips, and a laid-back procedural radio loop. Created lazily on
// the first user gesture (browser autoplay policy).

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let engineNodes = null;
let sirenOsc = null;
let radioTimer = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.34;
    musicGain.connect(master);
  } catch {
    ctx = null;
  }
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.55;
  return muted;
}

function env(gain, t0, attack, decay, peak) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ---------- one-shot effects ----------

export function playGunshot(heavy) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.18);
  const g = ctx.createGain();
  env(g, t, 0.002, heavy ? 0.14 : 0.09, heavy ? 0.5 : 0.35);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = heavy ? 900 : 1800;
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t); src.stop(t + 0.2);
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(heavy ? 120 : 180, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  const og = ctx.createGain();
  env(og, t, 0.001, 0.08, 0.3);
  o.connect(og).connect(sfxGain);
  o.start(t); o.stop(t + 0.1);
}

export function playImpact(strength) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.12);
  const g = ctx.createGain();
  env(g, t, 0.001, 0.1, Math.min(0.6, 0.15 + strength * 0.4));
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 300 + strength * 500;
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t); src.stop(t + 0.15);
}

export function playPickup() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [660, 990].forEach((freq, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    env(g, t + i * 0.07, 0.01, 0.12, 0.25);
    o.connect(g).connect(sfxGain);
    o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.2);
  });
}

export function playUiBlip(up) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = up ? 520 : 300;
  const g = ctx.createGain();
  env(g, t, 0.005, 0.06, 0.12);
  o.connect(g).connect(sfxGain);
  o.start(t); o.stop(t + 0.1);
}

export function playDoor() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.1);
  const g = ctx.createGain();
  env(g, t, 0.004, 0.08, 0.18);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 700;
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t); src.stop(t + 0.12);
}

export function playWasted() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(30, t + 1.6);
  const g = ctx.createGain();
  env(g, t, 0.02, 1.8, 0.4);
  o.connect(g).connect(sfxGain);
  o.start(t); o.stop(t + 2);
}

// ---------- continuous: engine ----------

// Start (or retune) the engine drone for the player's car.
export function updateEngine(rpm, on) {
  if (!ctx) return;
  if (on && !engineNodes) {
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    const g = ctx.createGain();
    g.gain.value = 0.0;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    o1.connect(f); o2.connect(f);
    f.connect(g).connect(sfxGain);
    o1.start(); o2.start();
    engineNodes = { o1, o2, g, f };
  }
  if (!engineNodes) return;
  const n = engineNodes;
  const target = on ? 0.10 : 0;
  n.g.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  const freq = 45 + rpm * 120;
  n.o1.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
  n.o2.frequency.setTargetAtTime(freq * 0.5 + 2, ctx.currentTime, 0.05);
  n.f.frequency.setTargetAtTime(300 + rpm * 900, ctx.currentTime, 0.1);
}

export function stopEngine() {
  updateEngine(0, false);
}

// ---------- continuous: police siren when cops are close ----------

export function updateSiren(active) {
  if (!ctx) return;
  if (active && !sirenOsc) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.value = 0;
    o.frequency.value = 720;
    o.connect(g).connect(sfxGain);
    o.start(); lfo.start();
    sirenOsc = { o, lfo, g };
  }
  if (!sirenOsc) return;
  sirenOsc.g.gain.setTargetAtTime(active ? 0.06 : 0, ctx.currentTime, 0.3);
}

// ---------- procedural radio loop (offline: scheduled while driving) ----------

const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic, laid-back synthwave
let radioRoot = 220;
let radioStep = 0;

function radioNote(freq, when, dur, peak, type) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2400;
  o.connect(f).connect(g).connect(musicGain);
  o.start(when); o.stop(when + dur + 0.05);
}

// Call ~4x/second while the radio is on; schedules the next step ahead of time.
export function radioTick(on) {
  if (!ctx) { radioTimer = null; return; }
  if (!on) {
    if (radioTimer) { clearTimeout(radioTimer); radioTimer = null; }
    return;
  }
  if (radioTimer) return;
  const schedule = () => {
    radioTimer = setTimeout(schedule, 240);
    const t = ctx.currentTime + 0.05;
    const s = radioStep++;
    const deg = SCALE[(s * 3) % SCALE.length];
    if (s % 2 === 0) radioNote(radioRoot * Math.pow(2, deg / 12), t, 0.22, 0.16, 'triangle');
    if (s % 8 === 4 || s % 8 === 6) radioNote(radioRoot * Math.pow(2, (deg + 12) / 12), t, 0.18, 0.09, 'sine');
    if (s % 4 === 0) radioNote(radioRoot / 2, t, 0.3, 0.18, 'sawtooth'); // bass
    if (s % 4 === 2) radioNote(radioRoot / 2 * 1.5, t, 0.25, 0.14, 'sawtooth');
  };
  schedule();
}

export function setRadioStation(rootHz) {
  radioRoot = rootHz;
  radioStep = 0;
}

export const RADIO_STATIONS = [
  { name: 'SOL FM 88.3', rootHz: 220 },
  { name: 'MARINA BEATS', rootHz: 262 },
  { name: 'COASTWAVE', rootHz: 196 },
];

const audioCtx = (() => {
  let ctx: AudioContext | null = null;
  return () => {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
})();

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.3,
  rampDown = true,
) {
  const ctx = audioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  if (rampDown) {
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  }
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.15) {
  const ctx = audioCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;

  const gain = ctx.createGain();
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
}

function playFilteredNoise(opts: {
  duration: number;
  volume: number;
  filterType: BiquadFilterType;
  startFreq: number;
  endFreq?: number;
  Q?: number;
  startTime?: number;
}) {
  const ctx = audioCtx();
  const t = opts.startTime ?? ctx.currentTime;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * opts.duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType;
  filter.Q.value = opts.Q ?? 1;
  filter.frequency.setValueAtTime(opts.startFreq, t);
  if (opts.endFreq !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(opts.endFreq, 1),
      t + opts.duration,
    );
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(opts.volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(t);
  source.stop(t + opts.duration);
}

function playSweep(opts: {
  startFreq: number;
  endFreq: number;
  duration: number;
  type: OscillatorType;
  volume: number;
  startTime?: number;
  rampType?: "exp" | "linear";
}) {
  const ctx = audioCtx();
  const t = opts.startTime ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.startFreq, t);
  if ((opts.rampType ?? "exp") === "exp") {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(opts.endFreq, 1),
      t + opts.duration,
    );
  } else {
    osc.frequency.linearRampToValueAtTime(opts.endFreq, t + opts.duration);
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(opts.volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + opts.duration);
}

export function playMoveSound() {
  playNoise(0.1, 0.08);
  playTone(120, 0.08, "sine", 0.06, true);
}

export function playEncounterSound() {
  const ctx = audioCtx();
  const t = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(200, t);
  osc1.frequency.exponentialRampToValueAtTime(80, t + 0.5);
  gain1.gain.setValueAtTime(0.25, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(t);
  osc1.stop(t + 0.6);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(90, t + 0.1);
  osc2.frequency.exponentialRampToValueAtTime(50, t + 0.5);
  gain2.gain.setValueAtTime(0.15, t + 0.1);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t + 0.1);
  osc2.stop(t + 0.6);
}

export function playPickupSound() {
  const ctx = audioCtx();
  const t = ctx.currentTime;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.2, t + i * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t + i * 0.08);
    osc.stop(t + i * 0.08 + 0.15);
  });
}

// Realistic weapon strike on a monster:
//   1) Sword swing whoosh (band-passed noise sweeping high -> low)
//   2) Meaty body thud (low sine drop)
//   3) Sharp impact crack (resonant noise burst)
//   4) Brief metallic ting (high triangle blip)
// A small random pitch jitter keeps repeated hits from sounding identical.
export function playHitSound() {
  const ctx = audioCtx();
  const t = ctx.currentTime;
  const jitter = 0.92 + Math.random() * 0.16; // 0.92..1.08

  // 1. Swing whoosh through the air
  playFilteredNoise({
    duration: 0.13,
    volume: 0.16,
    filterType: "bandpass",
    startFreq: 2200 * jitter,
    endFreq: 700 * jitter,
    Q: 1.4,
    startTime: t,
  });

  // 2. Body thud — low sine pitch drop right as the blade lands
  playSweep({
    startFreq: 190 * jitter,
    endFreq: 55,
    duration: 0.20,
    type: "sine",
    volume: 0.45,
    startTime: t + 0.06,
  });

  // 3. Impact crack — resonant noise burst
  playFilteredNoise({
    duration: 0.09,
    volume: 0.30,
    filterType: "bandpass",
    startFreq: 1500 * jitter,
    endFreq: 600,
    Q: 4,
    startTime: t + 0.06,
  });

  // 4. Metallic ting on top of the impact
  playSweep({
    startFreq: 1900 * jitter,
    endFreq: 1400 * jitter,
    duration: 0.10,
    type: "triangle",
    volume: 0.10,
    startTime: t + 0.07,
  });
}

// Realistic miss / monster strikes the player back:
//   1) Whiff — your weak swing slices empty air (quick high-passed noise)
//   2) Heavy monster impact (low rumble + low sine thud)
//   3) Player hurt yelp (short triangle cry with vibrato, pitch dives)
export function playLoseLifeSound() {
  const ctx = audioCtx();
  const t = ctx.currentTime;
  const jitter = 0.92 + Math.random() * 0.16;

  // 1. Your missed swing — short airy whiff
  playFilteredNoise({
    duration: 0.10,
    volume: 0.10,
    filterType: "highpass",
    startFreq: 2600 * jitter,
    endFreq: 1100 * jitter,
    Q: 0.7,
    startTime: t,
  });

  // 2. Monster's counter-strike — heavy low-frequency thud
  playSweep({
    startFreq: 150 * jitter,
    endFreq: 38,
    duration: 0.24,
    type: "sine",
    volume: 0.42,
    startTime: t + 0.10,
  });
  playFilteredNoise({
    duration: 0.20,
    volume: 0.22,
    filterType: "lowpass",
    startFreq: 700,
    endFreq: 200,
    Q: 0.7,
    startTime: t + 0.10,
  });

  // 3. Player's hurt yelp — pitched cry with subtle vibrato
  const yelpStart = t + 0.20;
  const yelpDur = 0.32;
  const yelp = ctx.createOscillator();
  const yelpGain = ctx.createGain();
  yelp.type = "triangle";
  yelp.frequency.setValueAtTime(540 * jitter, yelpStart);
  yelp.frequency.linearRampToValueAtTime(440 * jitter, yelpStart + 0.06);
  yelp.frequency.linearRampToValueAtTime(210 * jitter, yelpStart + yelpDur);
  yelpGain.gain.setValueAtTime(0.0001, yelpStart);
  yelpGain.gain.exponentialRampToValueAtTime(0.22, yelpStart + 0.025);
  yelpGain.gain.exponentialRampToValueAtTime(0.0001, yelpStart + yelpDur);

  // small vibrato so the yelp doesn't sound robotic
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 18;
  lfoGain.gain.value = 16;
  lfo.connect(lfoGain);
  lfoGain.connect(yelp.frequency);

  yelp.connect(yelpGain);
  yelpGain.connect(ctx.destination);
  yelp.start(yelpStart);
  yelp.stop(yelpStart + yelpDur);
  lfo.start(yelpStart);
  lfo.stop(yelpStart + yelpDur);
}

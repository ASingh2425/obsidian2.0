// Cyber Audio Synthesizer utilizing browser native Web Audio API

let audioCtx: AudioContext | null = null;
let isAudioMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setAudioMuted(muted: boolean) {
  isAudioMuted = muted;
}

export function getAudioMuted(): boolean {
  return isAudioMuted;
}

/**
 * Plays a high-tech metallic "ting" alert chime when a security breach or threat escalation is detected.
 */
export function playBreachAlertTing() {
  if (isAudioMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Primary High Bell Oscillator (Ting attack)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1760, now); // A6 note
    osc1.frequency.exponentialRampToValueAtTime(2637, now + 0.08); // E7 harmonic
    osc1.frequency.exponentialRampToValueAtTime(2093, now + 0.4);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.28, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    // Harmonic Secondary Bell for cyber "crystal ting" texture
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(3520, now); // A7 high harmonic shimmer
    osc2.frequency.exponentialRampToValueAtTime(2793, now + 0.35);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.18, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    // Low sub pulse for cyber alert depth
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(320, now);
    subOsc.frequency.exponentialRampToValueAtTime(160, now + 0.25);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    // Filter for clean crisp acoustic cutoff
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(1.8, now);

    // Connections
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc2.connect(gain2);
    gain2.connect(filter);
    filter.connect(ctx.destination);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);

    // Playback scheduling
    osc1.start(now);
    osc2.start(now);
    subOsc.start(now);

    osc1.stop(now + 0.7);
    osc2.stop(now + 0.7);
    subOsc.stop(now + 0.35);
  } catch (err) {
    console.warn('Audio playback not permitted or unavailable:', err);
  }
}

/**
 * Plays a subtle sonar click or confirmation beep for UI interactions
 */
export function playCyberClick() {
  if (isAudioMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // ignore
  }
}

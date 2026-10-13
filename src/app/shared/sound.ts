import { Injectable, signal } from '@angular/core';
import { MoveSlot } from '../character/character.model';

export type Effect = 'hit' | 'heavy' | 'block' | 'ko' | 'ultimate' | 'round' | 'fight' | 'jump' | 'pickup' | 'menu';

const MUTE_KEY = 'southbeat-muted';
const MUSIC_KEY = 'southbeat-music';

/**
 * All sound is made on the fly with the Web Audio API: short synth effects for hits,
 * blocks and KOs, and a small chiptune loop per arena. No audio files to load.
 * Browsers only allow sound after a key press or click, so the context starts lazily.
 */
@Injectable({ providedIn: 'root' })
export class Sound {
  readonly muted = signal(read(MUTE_KEY) === '1');
  readonly music = signal(read(MUSIC_KEY) !== '0');
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private song: { stop: () => void; seed: string } | null = null;

  toggleMute(): void {
    this.muted.update((m) => !m);
    write(MUTE_KEY, this.muted() ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted() ? 0 : 0.5;
  }

  toggleMusic(): void {
    this.music.update((m) => !m);
    write(MUSIC_KEY, this.music() ? '1' : '0');
    if (!this.music()) this.stopMusic();
  }

  /** The sound for a landed attack, heavier for strong attacks. */
  hit(slot: MoveSlot): void {
    this.play(slot === 'light' ? 'hit' : 'heavy');
  }

  play(effect: Effect): void {
    const ctx = this.context();
    if (!ctx || this.muted()) return;
    const t = ctx.currentTime;
    switch (effect) {
      case 'hit':
        this.noise(t, 0.07, 1800, 0.5);
        this.tone(t, 'square', 220, 90, 0.06, 0.25);
        return;
      case 'heavy':
        this.noise(t, 0.14, 900, 0.7);
        this.tone(t, 'square', 140, 45, 0.14, 0.35);
        return;
      case 'block':
        this.tone(t, 'triangle', 900, 700, 0.05, 0.25);
        this.noise(t, 0.04, 4000, 0.2);
        return;
      case 'ko':
        this.tone(t, 'sawtooth', 300, 40, 0.9, 0.35);
        this.noise(t, 0.5, 600, 0.5);
        return;
      case 'ultimate':
        this.tone(t, 'square', 200, 1200, 0.45, 0.25);
        this.tone(t + 0.1, 'square', 300, 1600, 0.4, 0.15);
        return;
      case 'round':
        this.tone(t, 'square', 440, 440, 0.12, 0.2);
        this.tone(t + 0.16, 'square', 440, 440, 0.12, 0.2);
        return;
      case 'fight':
        this.tone(t, 'square', 523, 523, 0.1, 0.25);
        this.tone(t + 0.1, 'square', 784, 784, 0.25, 0.25);
        return;
      case 'jump':
        this.tone(t, 'triangle', 300, 600, 0.08, 0.15);
        return;
      case 'pickup':
        this.tone(t, 'square', 660, 660, 0.06, 0.2);
        this.tone(t + 0.07, 'square', 990, 990, 0.1, 0.2);
        return;
      case 'menu':
        this.tone(t, 'square', 600, 600, 0.04, 0.12);
        return;
    }
  }

  /** A short looping tune; the same arena always gets the same tune. */
  startMusic(seed: string): void {
    const ctx = this.context();
    if (!ctx || !this.music() || this.song?.seed === seed) return;
    this.stopMusic();
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = (): number => ((h = (h * 1103515245 + 12345) >>> 0) / 2 ** 32);
    // A minor-ish scale, four bars of eighth notes over a bass line.
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const root = 110 * 2 ** (Math.floor(rnd() * 5) / 12);
    const melody = Array.from({ length: 32 }, () => (rnd() < 0.25 ? null : scale[Math.floor(rnd() * scale.length)]));
    const bass = [0, 0, 7, 5].map((n) => n + (rnd() < 0.5 ? 0 : -2));
    const beat = 60 / (120 + Math.floor(rnd() * 30)) / 2;
    const out = ctx.createGain();
    out.gain.value = 0.12;
    out.connect(this.master!);
    let next = ctx.currentTime + 0.1;
    let step = 0;
    const timer = setInterval(() => {
      while (next < ctx.currentTime + 0.4) {
        const note = melody[step % melody.length];
        if (note !== null) this.tone(next, 'square', root * 2 * 2 ** (note / 12), root * 2 * 2 ** (note / 12), beat * 0.8, 0.5, out);
        if (step % 2 === 0) {
          const b = bass[Math.floor(step / 8) % bass.length];
          this.tone(next, 'triangle', root * 2 ** (b / 12), root * 2 ** (b / 12), beat * 1.6, 0.9, out);
        }
        if (step % 4 === 2) this.noise(next, 0.03, 6000, 0.3, out);
        next += beat;
        step++;
      }
    }, 100);
    this.song = {
      seed,
      stop: () => {
        clearInterval(timer);
        out.disconnect();
      },
    };
  }

  stopMusic(): void {
    this.song?.stop();
    this.song = null;
  }

  private context(): AudioContext | null {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted() ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(at: number, type: OscillatorType, from: number, to: number, length: number, volume: number, out?: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + length);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(gain).connect(out ?? this.master!);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  private noise(at: number, length: number, cutoff: number, volume: number, out?: AudioNode): void {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    src.connect(filter).connect(gain).connect(out ?? this.master!);
    src.start(at);
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Settings are a convenience; without storage they last until the page closes.
  }
}

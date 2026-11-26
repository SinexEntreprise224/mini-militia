import { AudioSettings, SoundEvent, WeaponId } from '../types';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;
  private jetGain: GainNode | null = null;
  private jetFilter: BiquadFilterNode | null = null;
  private jetStarted = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(settings: AudioSettings) {
    this.settings = settings;
  }

  public updateSettings(settings: AudioSettings): void {
    this.settings = settings;
    if (this.jetGain && this.ctx && this.settings.muted) {
      this.jetGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.settings.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private sfxGain(): number {
    if (this.settings.muted) return 0;
    return this.settings.masterVolume * this.settings.sfxVolume;
  }

  private uiGain(): number {
    if (this.settings.muted) return 0;
    return this.settings.masterVolume * this.settings.uiVolume;
  }

  public setJetpackThrust(activeCount: number): void {
    if (this.settings.muted || activeCount <= 0) {
      if (this.jetGain && this.ctx) {
        this.jetGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    if (!this.jetStarted) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 320;
      filter.Q.value = 1.4;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();

      this.jetFilter = filter;
      this.jetGain = gain;
      this.jetStarted = true;
    }

    if (this.jetGain && this.jetFilter) {
      const vol = Math.min(0.16, 0.09 * activeCount) * this.sfxGain();
      this.jetGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.04);
      this.jetFilter.frequency.setTargetAtTime(280 + activeCount * 90, ctx.currentTime, 0.06);
    }
  }

  public playEvents(events: SoundEvent[]): void {
    if (this.settings.muted || events.length === 0) return;
    // Limit simultaneous sound triggers per frame to avoid audio clipping
    const capped = events.slice(0, 5);
    for (const ev of capped) {
      switch (ev.type) {
        case 'fire':
          this.playWeaponFire(ev.weaponId || 'pistol');
          break;
        case 'reload':
          this.playTone(540, 760, 0.08, 'triangle', 0.12);
          break;
        case 'empty':
          this.playTone(220, 140, 0.05, 'square', 0.09);
          break;
        case 'jump':
          this.playTone(170, 360, 0.09, 'sine', 0.11);
          break;
        case 'land':
          this.playTone(120, 55, 0.07, 'triangle', 0.1);
          break;
        case 'explosion':
          this.playExplosion();
          break;
        case 'grenade_throw':
          this.playTone(300, 180, 0.08, 'sine', 0.1);
          break;
        case 'pickup':
          this.playTone(520, 980, 0.14, 'triangle', 0.15);
          break;
        case 'hit':
          this.playTone(980, 1320, 0.045, 'sine', 0.12);
          break;
        case 'damage':
          this.playTone(150, 75, 0.1, 'sawtooth', 0.14);
          break;
        case 'death':
          this.playTone(240, 60, 0.32, 'sawtooth', 0.18);
          break;
        case 'melee':
          this.playNoiseBurst(0.11, 900, 0.16);
          break;
        case 'flag':
          this.playTone(660, 1040, 0.2, 'triangle', 0.18);
          break;
      }
    }
  }

  private playWeaponFire(weaponId: WeaponId): void {
    switch (weaponId) {
      case 'pistol':
      case 'dual_pistols':
        this.playNoiseBurst(0.06, 1200, 0.16);
        this.playTone(380, 110, 0.06, 'triangle', 0.14);
        break;
      case 'smg':
        this.playNoiseBurst(0.045, 1650, 0.12);
        this.playTone(460, 180, 0.045, 'square', 0.08);
        break;
      case 'assault_rifle':
        this.playNoiseBurst(0.07, 1100, 0.16);
        this.playTone(290, 95, 0.075, 'sawtooth', 0.12);
        break;
      case 'heavy_rifle':
        this.playNoiseBurst(0.1, 800, 0.2);
        this.playTone(220, 65, 0.11, 'sawtooth', 0.18);
        break;
      case 'shotgun':
        this.playNoiseBurst(0.15, 620, 0.25);
        this.playTone(160, 50, 0.14, 'triangle', 0.2);
        break;
      case 'sniper':
        this.playNoiseBurst(0.18, 1400, 0.24);
        this.playTone(640, 80, 0.18, 'sawtooth', 0.2);
        break;
      case 'rocket_launcher':
        this.playNoiseBurst(0.24, 420, 0.22);
        this.playTone(180, 70, 0.22, 'sawtooth', 0.16);
        break;
      case 'plasma_rifle':
        this.playTone(920, 260, 0.1, 'sine', 0.16);
        this.playTone(1240, 420, 0.08, 'triangle', 0.09);
        break;
      case 'energy_blade':
        this.playTone(420, 740, 0.1, 'sawtooth', 0.14);
        break;
    }
  }

  private playExplosion(): void {
    this.playNoiseBurst(0.38, 280, 0.32);
    this.playTone(110, 32, 0.35, 'sine', 0.28);
  }

  public playUiClick(confirm = true): void {
    const vol = this.uiGain();
    if (vol <= 0.01) return;
    if (confirm) {
      this.playToneRaw(620, 880, 0.06, 'triangle', 0.12 * vol);
    } else {
      this.playToneRaw(420, 520, 0.04, 'sine', 0.08 * vol);
    }
  }

  private playTone(
    fStart: number,
    fEnd: number,
    dur: number,
    type: OscillatorType,
    baseVol: number
  ): void {
    const vol = baseVol * this.sfxGain();
    if (vol <= 0.005) return;
    this.playToneRaw(fStart, fEnd, dur, type, vol);
  }

  private playToneRaw(
    fStart: number,
    fEnd: number,
    dur: number,
    type: OscillatorType,
    vol: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), now + dur);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  private playNoiseBurst(dur: number, cutoffHz: number, baseVol: number): void {
    const vol = baseVol * this.sfxGain();
    if (vol <= 0.005) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.01);
  }
}

import type { Settings } from './types';
/** 全部音色本地合成：不下载远程音频。主增益分离音乐和音效。 */
export class AudioEngine {
  private ctx: AudioContext | null = null; private musicGain: GainNode | null = null; private sfxGain: GainNode | null = null;
  private voices = new Set<AudioScheduledSourceNode>(); private musicClock = 0; private beat = 0; private region = 0; private settings: Settings;
  constructor(settings: Settings) { this.settings = settings; }
  unlock() {
    if (!this.ctx) { this.ctx = new AudioContext(); this.musicGain = this.ctx.createGain(); this.sfxGain = this.ctx.createGain(); this.musicGain.connect(this.ctx.destination); this.sfxGain.connect(this.ctx.destination); this.configure(this.settings); }
    void this.ctx.resume();
  }
  configure(settings: Settings) { this.settings = settings; if (this.musicGain) this.musicGain.gain.value = settings.music * .13; if (this.sfxGain) this.sfxGain.gain.value = settings.sfx * .28; }
  private tone(freq: number, length: number, type: OscillatorType, volume: number, music = false, end?: number) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running' || this.voices.size > 45) return;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (end) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), ctx.currentTime + length);
    g.gain.setValueAtTime(volume, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + length);
    o.connect(g); g.connect(music ? this.musicGain! : this.sfxGain!); o.start(); o.stop(ctx.currentTime + length + .02);
    this.voices.add(o); o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); };
  }
  private noise(length: number, volume: number, cutoff = 1400) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running' || this.voices.size > 45) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate), samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = buffer; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = volume; s.connect(f); f.connect(g); g.connect(this.sfxGain!); s.start();
    this.voices.add(s); s.onended = () => { this.voices.delete(s); s.disconnect(); f.disconnect(); g.disconnect(); };
  }
  play(name: string, power = 1) {
    if (!this.ctx) return;
    switch (name) {
      case 'hit': this.noise(.095, .7 * power, 1600); this.tone(120, .09, 'sine', .8 * power, false, 40); break;
      case 'impactHeavy': case 'heavy': this.noise(.18, .65 * power, 950); this.tone(110, .2, 'triangle', .7, false, 32); break;
      case 'parry': this.tone(1100, .22, 'sine', .6, false, 1800); this.tone(1650, .3, 'triangle', .3); break;
      case 'block': this.noise(.07, .45, 2600); this.tone(480, .1, 'triangle', .4); break;
      case 'break': case 'crate': this.noise(.26, .7, 1500); this.tone(200, .16, 'sawtooth', .12, false, 40); break;
      case 'jump': this.tone(140, .12, 'sine', .35, false, 300); break;
      case 'land': case 'step': this.noise(name === 'step' ? .035 : .09, name === 'step' ? .15 : .35, 600); break;
      case 'dodge': case 'swing': this.noise(.1, .25, 1800); break;
      case 'skill-palm': this.tone(95, .25, 'sine', .8, false, 230); this.noise(.18, .4, 1800); break;
      case 'skill-shadow': this.noise(.24, .45, 4800); this.tone(850, .17, 'triangle', .16, false, 1700); break;
      case 'skill-quake': this.tone(90, .55, 'sine', .9, false, 28); this.noise(.4, .65, 950); break;
      case 'staff': case 'baton': this.noise(.13, .3, 2100); this.tone(380, .07, 'triangle', .1); break;
      case 'hammer': this.noise(.25, .45, 700); break;
      case 'blades': case 'discs': this.noise(.1, .25, 4500); this.tone(1800, .08, 'sine', .12); break;
      case 'buy': case 'reward': this.tone(660, .18, 'sine', .45); this.tone(990, .35, 'triangle', .25); break;
      case 'phase': this.tone(75, 1.2, 'sawtooth', .24, false, 160); this.noise(.8, .35, 1100); break;
      case 'win': [262, 330, 392, 524].forEach((f, i) => this.tone(f, .7 + i * .2, 'triangle', .25)); break;
      case 'lose': this.tone(210, .8, 'triangle', .45, false, 65); break;
      default: this.tone(520, .07, 'sine', .22);
    }
  }
  update(dt: number, region: number) {
    this.region = region; this.musicClock -= dt;
    if (this.musicClock > 0) return;
    this.musicClock = .36; this.beat++;
    const scales = [[110, 131, 147, 165, 196, 220], [82, 98, 110, 123, 147, 165], [98, 110, 131, 147, 165, 196]];
    const notes = scales[this.region];
    this.tone(notes[[0, 0, 2, 4, 3, 2, 5, 4][this.beat % 8]], .6, 'triangle', .24, true);
    if (this.beat % 4 === 0) { this.tone(notes[0] / 2, 1.4, 'sine', .65, true); this.tone(notes[3], 1.1, 'sine', .12, true); }
    if (this.beat % 2 === 0) this.tone(55, .09, 'sine', .6, true, 28);
  }
  pause() { if (this.ctx?.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume(); }
  clear() { for (const v of this.voices) { try { v.stop(); } catch { /* 已停止的音源不需重复停止。 */ } } this.voices.clear(); this.musicClock = 0; }
}

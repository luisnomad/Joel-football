import { DEFAULT_AUDIO_SETTINGS, sanitizeAudioSettings } from '../pure/profile.js';
import { audioAssetCache } from './AudioAssetCache.js';
import { playerProfileStore } from './PlayerProfile.js';

const soundUrl = (filename) => `${import.meta.env.BASE_URL}assets/sound/${filename}`;

export const MUSIC_TRACKS = Object.freeze(
  Array.from({ length: 6 }, (_, index) => soundUrl(`track${index + 1}.mp3`)),
);
export const AUDIENCE_AMBIENT_URL = soundUrl('bg_audience_ambient.mp3');
export const BALL_EFFECT_URL = soundUrl('ball_sound_effect.mp3');
export const WHISTLE_EFFECT_URL = soundUrl('whistle_sound_effect.mp3');
export const AUDIO_ASSET_URLS = Object.freeze([
  AUDIENCE_AMBIENT_URL,
  BALL_EFFECT_URL,
  WHISTLE_EFFECT_URL,
  ...MUSIC_TRACKS,
]);

const WHISTLE_INTERVAL_MS = 900;

const safePlay = (media) => {
  try {
    const attempt = media?.play?.();
    attempt?.catch?.(() => {});
  } catch {
    // Playback can be rejected until a tablet receives its first gesture.
  }
};

const createMediaElement = () => {
  if (typeof Audio !== 'function') return null;
  const media = new Audio();
  media.preload = 'metadata';
  media.playsInline = true;
  return media;
};

class ArcadeAudio {
  constructor() {
    this.settings = sanitizeAudioSettings(playerProfileStore.get().audio);
    this.context = null;
    this.unlocked = false;
    this.pageVisible = true;
    this.sceneMode = 'menu';
    this.trackIndex = 0;
    this.music = null;
    this.audience = null;
    this.ballEffect = null;
    this.whistleEffect = null;
    this.musicRequested = false;
    this.audienceRequested = false;
    this.goalCheerPlays = 0;
    this.ballEffectPlays = 0;
    this.whistlePlays = 0;
    this.whistleRequestedPlays = 0;
    this.whistleSequenceRequests = 0;
    this.lastWhistleSequenceCount = 0;
    this.whistleTimers = new Set();
    this.whistlePlaybackSerial = 0;
    this.recentWhistles = [];
    this.cacheWarmStarted = false;
  }

  get enabled() {
    return !this.settings.musicMuted || !this.settings.effectsMuted;
  }

  ensureMedia() {
    if (this.music) return;
    this.music = createMediaElement();
    this.audience = createMediaElement();
    this.ballEffect = createMediaElement();
    this.whistleEffect = createMediaElement();
    if (!this.music) return;

    this.music.src = MUSIC_TRACKS[this.trackIndex];
    this.music.addEventListener('ended', () => this.playNextTrack());
    this.audience.src = AUDIENCE_AMBIENT_URL;
    this.audience.loop = true;
    this.ballEffect.src = BALL_EFFECT_URL;
    this.whistleEffect.src = WHISTLE_EFFECT_URL;
    this.applyVolumes();
  }

  setScene(mode) {
    this.cancelWhistleSequence();
    this.whistleEffect?.pause?.();
    this.sceneMode = mode === 'match' ? 'match' : 'menu';
    this.ensureMedia();
    this.primeMediaFromCache();
    if (!this.unlocked) return;
    this.startMusic();
    if (this.sceneMode === 'match') this.startAudience();
    else this.stopAudience();
  }

  setPageVisible(visible) {
    this.pageVisible = Boolean(visible);
    if (!this.pageVisible) {
      this.cancelWhistleSequence();
      this.music?.pause?.();
      this.audience?.pause?.();
      this.whistleEffect?.pause?.();
      return;
    }
    if (!this.unlocked) return;
    this.startMusic();
    if (this.sceneMode === 'match') this.startAudience();
  }

  updateSettings(patch) {
    const profile = playerProfileStore.setAudio(patch);
    this.settings = sanitizeAudioSettings(profile.audio);
    this.applyVolumes();
    if (this.settings.musicMuted) this.music?.pause?.();
    else if (this.unlocked) this.startMusic();
    if (this.settings.effectsMuted || this.sceneMode !== 'match') this.stopAudience();
    else if (this.unlocked) this.startAudience();
    if (this.settings.effectsMuted) this.cancelWhistleSequence();
    return this.settings;
  }

  applyVolumes() {
    if (this.music) this.music.volume = this.settings.musicMuted ? 0 : this.settings.musicVolume;
    if (this.audience) this.audience.volume = this.settings.effectsMuted ? 0 : this.settings.effectsVolume;
    if (this.ballEffect) this.ballEffect.volume = this.settings.effectsMuted
      ? 0
      : Math.min(1, this.settings.effectsVolume * 1.4);
    if (this.whistleEffect) this.whistleEffect.volume = this.settings.effectsMuted
      ? 0
      : Math.min(1, this.settings.effectsVolume * 1.7);
  }

  unlock() {
    this.unlocked = true;
    this.ensureMedia();
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    }
    this.startMusic();
    if (this.sceneMode === 'match') this.startAudience();
    this.warmCacheProgressively();
  }

  startMusic() {
    this.musicRequested = !this.settings.musicMuted && this.pageVisible;
    if (!this.musicRequested || !this.music) return;
    safePlay(this.music);
  }

  stopMusic() {
    this.musicRequested = false;
    this.music?.pause?.();
  }

  startAudience() {
    this.audienceRequested = !this.settings.effectsMuted && this.pageVisible && this.sceneMode === 'match';
    if (!this.audienceRequested || !this.audience) return;
    safePlay(this.audience);
  }

  stopAudience() {
    this.audienceRequested = false;
    this.audience?.pause?.();
  }

  async playNextTrack() {
    if (!this.music) return;
    this.trackIndex = (this.trackIndex + 1) % MUSIC_TRACKS.length;
    const url = MUSIC_TRACKS[this.trackIndex];
    const playable = await audioAssetCache.playableUrl(url);
    this.music.src = playable;
    this.applyVolumes();
    this.startMusic();
  }

  async primeMediaFromCache() {
    if (!this.music || this.unlocked || !this.music.paused) return;
    const trackIndex = this.trackIndex;
    const [musicUrl, audienceUrl, ballUrl, whistleUrl] = await Promise.all([
      audioAssetCache.playableUrl(MUSIC_TRACKS[trackIndex]),
      audioAssetCache.playableUrl(AUDIENCE_AMBIENT_URL),
      audioAssetCache.playableUrl(BALL_EFFECT_URL),
      audioAssetCache.playableUrl(WHISTLE_EFFECT_URL),
    ]);
    if (this.unlocked || trackIndex !== this.trackIndex || !this.music.paused) return;
    this.music.src = musicUrl;
    this.audience.src = audienceUrl;
    this.ballEffect.src = ballUrl;
    this.whistleEffect.src = whistleUrl;
  }

  warmCacheProgressively() {
    if (this.cacheWarmStarted) return;
    this.cacheWarmStarted = true;
    const connection = globalThis.navigator?.connection;
    const dataSaver = connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType);
    const urls = dataSaver
      ? [AUDIENCE_AMBIENT_URL, BALL_EFFECT_URL, WHISTLE_EFFECT_URL, MUSIC_TRACKS[this.trackIndex]]
      : AUDIO_ASSET_URLS;
    audioAssetCache.warm(urls).catch(() => {});
  }

  warmAll() {
    return audioAssetCache.warm(AUDIO_ASSET_URLS);
  }

  tone({ frequency = 220, endFrequency = frequency, duration = 0.08, gain = 0.04, type = 'sine', delay = 0 }) {
    if (this.settings.effectsMuted || this.settings.effectsVolume <= 0) return;
    this.unlock();
    if (!this.context) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    const effectsScale = this.settings.effectsVolume / DEFAULT_AUDIO_SETTINGS.effectsVolume;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    volume.gain.setValueAtTime(Math.min(0.28, gain * effectsScale), start);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  click() {
    this.tone({ frequency: 430, endFrequency: 620, duration: 0.055, type: 'triangle', gain: 0.025 });
  }

  kick(powered = false) {
    if (!this.settings.effectsMuted && this.ballEffect) {
      this.ballEffect.currentTime = 0;
      this.ballEffectPlays += 1;
      safePlay(this.ballEffect);
    }
    this.tone({
      frequency: powered ? 130 : 95,
      endFrequency: powered ? 520 : 175,
      duration: powered ? 0.19 : 0.075,
      type: powered ? 'sawtooth' : 'square',
      gain: powered ? 0.055 : 0.035,
    });
  }

  jump() {
    this.tone({ frequency: 280, endFrequency: 480, duration: 0.09, type: 'sine', gain: 0.022 });
  }

  impact() {
    this.tone({ frequency: 82, endFrequency: 48, duration: 0.1, type: 'square', gain: 0.03 });
  }

  success() {
    [0, 0.1, 0.2].forEach((delay, index) => {
      this.tone({ frequency: 330 + index * 110, endFrequency: 440 + index * 110, duration: 0.22, type: 'triangle', gain: 0.045, delay });
    });
  }

  goal() {
    this.whistle(1, { label: 'goal' });
  }

  cancelWhistleSequence() {
    this.whistlePlaybackSerial += 1;
    this.whistleTimers.forEach((timer) => globalThis.clearTimeout?.(timer));
    this.whistleTimers.clear();
  }

  playWhistleNow({ cutoffMs = null, label = 'standard' } = {}) {
    if (this.settings.effectsMuted || !this.whistleEffect) return;
    try {
      const safeCutoffMs = Number.isFinite(cutoffMs) && cutoffMs > 0 ? Math.round(cutoffMs) : null;
      const playbackSerial = ++this.whistlePlaybackSerial;
      this.whistleEffect.currentTime = 0;
      this.whistlePlays += 1;
      this.recentWhistles.push({ label, cutoffMs: safeCutoffMs });
      this.recentWhistles = this.recentWhistles.slice(-12);
      safePlay(this.whistleEffect);
      if (safeCutoffMs) {
        const timer = globalThis.setTimeout?.(() => {
          this.whistleTimers.delete(timer);
          if (playbackSerial === this.whistlePlaybackSerial) this.whistleEffect?.pause?.();
        }, safeCutoffMs);
        if (timer !== undefined) this.whistleTimers.add(timer);
      }
    } catch {
      // A media element may be unavailable while the page is shutting down.
    }
  }

  whistle(count = 1, options = {}) {
    const safeCount = Math.min(3, Math.max(1, Math.floor(Number(count) || 1)));
    this.cancelWhistleSequence();
    this.ensureMedia();
    this.whistleSequenceRequests += 1;
    this.whistleRequestedPlays += safeCount;
    this.lastWhistleSequenceCount = safeCount;
    if (this.settings.effectsMuted || this.settings.effectsVolume <= 0) return;
    this.playWhistleNow(options);
    for (let index = 1; index < safeCount; index += 1) {
      const timer = globalThis.setTimeout?.(() => {
        this.whistleTimers.delete(timer);
        this.playWhistleNow(options);
      }, index * WHISTLE_INTERVAL_MS);
      if (timer !== undefined) this.whistleTimers.add(timer);
    }
  }

  counter() {
    this.tone({ frequency: 760, endFrequency: 180, duration: 0.24, type: 'sawtooth', gain: 0.05 });
  }

  diagnostics() {
    const cache = audioAssetCache.diagnostics();
    return {
      settings: { ...this.settings },
      unlocked: this.unlocked,
      sceneMode: this.sceneMode,
      currentTrack: this.trackIndex + 1,
      trackCount: MUSIC_TRACKS.length,
      musicRequested: this.musicRequested,
      audienceRequested: this.audienceRequested,
      goalCheerPlays: this.goalCheerPlays,
      ballEffectPlays: this.ballEffectPlays,
      whistlePlays: this.whistlePlays,
      whistleRequestedPlays: this.whistleRequestedPlays,
      whistleSequenceRequests: this.whistleSequenceRequests,
      lastWhistleSequenceCount: this.lastWhistleSequenceCount,
      pendingWhistles: this.whistleTimers.size,
      recentWhistles: this.recentWhistles.map((whistle) => ({ ...whistle })),
      cache: { ...cache, total: AUDIO_ASSET_URLS.length },
    };
  }
}

export const arcadeAudio = new ArcadeAudio();

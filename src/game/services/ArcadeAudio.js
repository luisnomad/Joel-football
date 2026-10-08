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
export const GAME_EFFECT_URLS = Object.freeze({
  button: soundUrl('button_feedback_1.mp3'),
  menuEnter: soundUrl('menu_enter_feedback.mp3'),
  goal1: soundUrl('GOAL_1.mp3'),
  goal2: soundUrl('GOAL_2.mp3'),
  joelGoal: soundUrl('vamos_sound_effect.mp3'),
  powerUp: soundUrl('power_up_1.mp3'),
  poweredShot: soundUrl('powered_up_shot.mp3'),
  wallBreak: soundUrl('brick_wall_breaking.mp3'),
  levelFinished: soundUrl('level_finished_3s.mp3'),
  hockeyNeon: soundUrl('hockey_shot.mp3'),
  hockeyIce: soundUrl('hockey_shot_ice.mp3'),
});
export const AUDIO_ASSET_URLS = Object.freeze([
  AUDIENCE_AMBIENT_URL,
  BALL_EFFECT_URL,
  WHISTLE_EFFECT_URL,
  ...Object.values(GAME_EFFECT_URLS),
  ...MUSIC_TRACKS,
]);
export const AUDIO_SCENE_POLICIES = Object.freeze({
  menu: Object.freeze({ music: true, audience: false }),
  football: Object.freeze({ music: true, audience: true }),
  kickfall: Object.freeze({ music: true, audience: false }),
  discHockey: Object.freeze({ music: true, audience: true }),
});

export const resolveAudioScenePolicy = (mode) => {
  const sceneMode = Object.hasOwn(AUDIO_SCENE_POLICIES, mode) ? mode : 'menu';
  return { sceneMode, ...AUDIO_SCENE_POLICIES[sceneMode] };
};

export const resolveGoalEffectId = (scorerCharacterId, variantIndex = 0) => (
  scorerCharacterId === 'joel'
    ? 'joelGoal'
    : Math.max(0, Number(variantIndex) || 0) % 2 === 0
      ? 'goal1'
      : 'goal2'
);

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
    this.gameEffects = {};
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
    this.gameEffectPlays = Object.fromEntries(
      Object.keys(GAME_EFFECT_URLS).map((effectId) => [effectId, 0]),
    );
    this.lastGameEffectPlayback = null;
    this.goalVariantIndex = 0;
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
    this.gameEffects = Object.fromEntries(
      Object.keys(GAME_EFFECT_URLS).map((effectId) => [effectId, createMediaElement()]),
    );
    if (!this.music) return;

    this.music.src = MUSIC_TRACKS[this.trackIndex];
    this.music.addEventListener('ended', () => this.playNextTrack());
    this.audience.src = AUDIENCE_AMBIENT_URL;
    this.audience.loop = true;
    this.ballEffect.src = BALL_EFFECT_URL;
    this.whistleEffect.src = WHISTLE_EFFECT_URL;
    Object.entries(GAME_EFFECT_URLS).forEach(([effectId, url]) => {
      if (this.gameEffects[effectId]) this.gameEffects[effectId].src = url;
    });
    this.applyVolumes();
  }

  setScene(mode) {
    this.cancelWhistleSequence();
    this.whistleEffect?.pause?.();
    this.sceneMode = resolveAudioScenePolicy(mode).sceneMode;
    this.ensureMedia();
    this.primeMediaFromCache();
    if (!this.unlocked) return;
    if (this.scenePolicy.music) this.startMusic();
    else this.stopMusic();
    if (this.scenePolicy.audience) this.startAudience();
    else this.stopAudience();
  }

  get scenePolicy() {
    return AUDIO_SCENE_POLICIES[this.sceneMode] ?? AUDIO_SCENE_POLICIES.menu;
  }

  setPageVisible(visible) {
    this.pageVisible = Boolean(visible);
    if (!this.pageVisible) {
      this.cancelWhistleSequence();
      this.music?.pause?.();
      this.audience?.pause?.();
      this.whistleEffect?.pause?.();
      Object.values(this.gameEffects).forEach((effect) => effect?.pause?.());
      return;
    }
    if (!this.unlocked) return;
    if (this.scenePolicy.music) this.startMusic();
    else this.stopMusic();
    if (this.scenePolicy.audience) this.startAudience();
    else this.stopAudience();
  }

  updateSettings(patch) {
    const profile = playerProfileStore.setAudio(patch);
    this.settings = sanitizeAudioSettings(profile.audio);
    this.applyVolumes();
    if (this.settings.musicMuted || !this.scenePolicy.music) this.stopMusic();
    else if (this.unlocked) this.startMusic();
    if (this.settings.effectsMuted || !this.scenePolicy.audience) this.stopAudience();
    else if (this.unlocked) this.startAudience();
    if (this.settings.effectsMuted) {
      this.cancelWhistleSequence();
      Object.values(this.gameEffects).forEach((effect) => effect?.pause?.());
    }
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
    Object.values(this.gameEffects).forEach((effect) => {
      if (effect) effect.volume = this.settings.effectsMuted
        ? 0
        : Math.min(1, this.settings.effectsVolume * 1.5);
    });
  }

  unlock() {
    this.unlocked = true;
    this.ensureMedia();
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    }
    if (this.scenePolicy.music) this.startMusic();
    if (this.scenePolicy.audience) this.startAudience();
    else this.stopAudience();
    this.warmCacheProgressively();
  }

  startMusic() {
    this.musicRequested = this.scenePolicy.music && !this.settings.musicMuted && this.pageVisible;
    if (!this.musicRequested || !this.music) return;
    safePlay(this.music);
  }

  stopMusic() {
    this.musicRequested = false;
    this.music?.pause?.();
  }

  startAudience() {
    this.audienceRequested = this.scenePolicy.audience && !this.settings.effectsMuted && this.pageVisible;
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
    const [musicUrl, audienceUrl, ballUrl, whistleUrl, ...gameEffectUrls] = await Promise.all([
      audioAssetCache.cachedPlayableUrl(MUSIC_TRACKS[trackIndex]),
      audioAssetCache.cachedPlayableUrl(AUDIENCE_AMBIENT_URL),
      audioAssetCache.cachedPlayableUrl(BALL_EFFECT_URL),
      audioAssetCache.cachedPlayableUrl(WHISTLE_EFFECT_URL),
      ...Object.values(GAME_EFFECT_URLS).map((url) => audioAssetCache.cachedPlayableUrl(url)),
    ]);
    if (this.unlocked || trackIndex !== this.trackIndex || !this.music.paused) return;
    this.music.src = musicUrl;
    this.audience.src = audienceUrl;
    this.ballEffect.src = ballUrl;
    this.whistleEffect.src = whistleUrl;
    Object.keys(GAME_EFFECT_URLS).forEach((effectId, index) => {
      if (this.gameEffects[effectId]) this.gameEffects[effectId].src = gameEffectUrls[index];
    });
  }

  warmCacheProgressively() {
    if (this.cacheWarmStarted) return;
    this.cacheWarmStarted = true;
    const connection = globalThis.navigator?.connection;
    const dataSaver = connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType);
    const currentTrack = MUSIC_TRACKS[this.trackIndex];
    const essentialUrls = [
      currentTrack,
      BALL_EFFECT_URL,
      WHISTLE_EFFECT_URL,
      AUDIENCE_AMBIENT_URL,
      GAME_EFFECT_URLS.button,
      GAME_EFFECT_URLS.menuEnter,
    ];
    const urls = dataSaver
      ? essentialUrls
      : [...new Set(AUDIO_ASSET_URLS)];
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
    if (!this.playGameEffect('button')) {
      this.tone({ frequency: 430, endFrequency: 620, duration: 0.055, type: 'triangle', gain: 0.025 });
    }
  }

  menuEnter() {
    if (!this.playGameEffect('menuEnter')) {
      this.tone({ frequency: 360, endFrequency: 720, duration: 0.12, type: 'triangle', gain: 0.032 });
    }
  }

  playGameEffect(effectId, { volumeScale = 1 } = {}) {
    if (this.settings.effectsMuted || this.settings.effectsVolume <= 0) return false;
    this.unlock();
    const effect = this.gameEffects[effectId];
    if (!effect) return false;
    try {
      const safeVolumeScale = Math.min(1, Math.max(0, Number(volumeScale) || 0));
      const channelVolume = Math.min(1, this.settings.effectsVolume * 1.5);
      effect.volume = channelVolume * safeVolumeScale;
      effect.currentTime = 0;
      this.gameEffectPlays[effectId] += 1;
      this.lastGameEffectPlayback = {
        effectId,
        volumeScale: safeVolumeScale,
        effectiveVolume: effect.volume,
      };
      safePlay(effect);
      return true;
    } catch {
      return false;
    }
  }

  hockeyShot(themeId, volumeScale = 1) {
    this.playGameEffect(
      themeId === 'ice' ? 'hockeyIce' : 'hockeyNeon',
      { volumeScale },
    );
  }

  powerUp() {
    this.playGameEffect('powerUp');
  }

  poweredShot() {
    this.playGameEffect('poweredShot');
  }

  wallBreak() {
    this.playGameEffect('wallBreak');
  }

  levelFinished() {
    this.playGameEffect('levelFinished');
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

  /** Per-ball tone layer (audit F3), scaled by impact strength 0..1. */
  ballTone(spec, strength = 1) {
    if (!spec) return;
    const scale = 0.5 + 0.5 * Math.min(1, Math.max(0, Number(strength) || 0));
    this.tone({ ...spec, gain: spec.gain * scale });
  }

  impact() {
    this.tone({ frequency: 82, endFrequency: 48, duration: 0.1, type: 'square', gain: 0.03 });
  }

  success() {
    [0, 0.1, 0.2].forEach((delay, index) => {
      this.tone({ frequency: 330 + index * 110, endFrequency: 440 + index * 110, duration: 0.22, type: 'triangle', gain: 0.045, delay });
    });
  }

  goal(scorerCharacterId = null) {
    const effectId = resolveGoalEffectId(scorerCharacterId, this.goalVariantIndex);
    if (effectId !== 'joelGoal') this.goalVariantIndex += 1;
    this.playGameEffect(effectId);
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
      scenePolicy: { ...this.scenePolicy },
      currentTrack: this.trackIndex + 1,
      trackCount: MUSIC_TRACKS.length,
      musicRequested: this.musicRequested,
      audienceRequested: this.audienceRequested,
      media: {
        musicPaused: this.music?.paused ?? true,
        musicVolume: this.music?.volume ?? 0,
        audiencePaused: this.audience?.paused ?? true,
        audienceVolume: this.audience?.volume ?? 0,
        ballEffectVolume: this.ballEffect?.volume ?? 0,
        whistleEffectVolume: this.whistleEffect?.volume ?? 0,
        gameEffectVolumes: Object.fromEntries(
          Object.entries(this.gameEffects).map(([effectId, effect]) => [effectId, effect?.volume ?? 0]),
        ),
      },
      goalCheerPlays: this.goalCheerPlays,
      ballEffectPlays: this.ballEffectPlays,
      whistlePlays: this.whistlePlays,
      whistleRequestedPlays: this.whistleRequestedPlays,
      whistleSequenceRequests: this.whistleSequenceRequests,
      lastWhistleSequenceCount: this.lastWhistleSequenceCount,
      pendingWhistles: this.whistleTimers.size,
      recentWhistles: this.recentWhistles.map((whistle) => ({ ...whistle })),
      gameEffectPlays: { ...this.gameEffectPlays },
      lastGameEffectPlayback: this.lastGameEffectPlayback
        ? { ...this.lastGameEffectPlayback }
        : null,
      goalStingerPlays: this.gameEffectPlays.goal1
        + this.gameEffectPlays.goal2
        + this.gameEffectPlays.joelGoal,
      cache: { ...cache, total: AUDIO_ASSET_URLS.length },
    };
  }
}

export const arcadeAudio = new ArcadeAudio();

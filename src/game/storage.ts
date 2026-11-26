import { CHARACTER_PRESETS } from './data/cosmetics';
import { DEFAULT_GAME_SETTINGS } from './input/InputManager';
import { CharacterAppearance, GameSettings } from './types';

const SETTINGS_KEY = 'skybreak_settings_v1';
const P1_APP_KEY = 'skybreak_p1_appearance_v1';
const P2_APP_KEY = 'skybreak_p2_appearance_v1';
const PROFILES_KEY = 'skybreak_profiles_v1';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_GAME_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_GAME_SETTINGS,
      ...parsed,
      keyBindings: { ...DEFAULT_GAME_SETTINGS.keyBindings, ...(parsed.keyBindings || {}) },
      controller: { ...DEFAULT_GAME_SETTINGS.controller, ...(parsed.controller || {}) },
      audio: { ...DEFAULT_GAME_SETTINGS.audio, ...(parsed.audio || {}) },
    };
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadAppearance(slot: 0 | 1): CharacterAppearance {
  try {
    const key = slot === 0 ? P1_APP_KEY : P2_APP_KEY;
    const raw = localStorage.getItem(key);
    if (raw) {
      return { ...(slot === 0 ? CHARACTER_PRESETS.urban_tactical : CHARACTER_PRESETS.futuristic_pilot), ...JSON.parse(raw) };
    }
  } catch {
    // Fallback
  }
  return slot === 0
    ? { ...CHARACTER_PRESETS.urban_tactical }
    : { ...CHARACTER_PRESETS.futuristic_pilot };
}

export function saveAppearance(slot: 0 | 1, app: CharacterAppearance): void {
  try {
    localStorage.setItem(slot === 0 ? P1_APP_KEY : P2_APP_KEY, JSON.stringify(app));
  } catch {
    // Ignore
  }
}

export function loadPlayerNames(): { p1Name: string; p2Name: string } {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        p1Name: parsed.p1Name || 'Pilot 1',
        p2Name: parsed.p2Name || 'Pilot 2',
      };
    }
  } catch {
    // Ignore
  }
  return { p1Name: 'Pilot 1', p2Name: 'Pilot 2' };
}

export function savePlayerNames(p1Name: string, p2Name: string): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify({ p1Name, p2Name }));
  } catch {
    // Ignore
  }
}

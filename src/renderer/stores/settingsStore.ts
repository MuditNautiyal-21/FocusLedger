import { create } from 'zustand';
import { ipc } from '../lib/ipc';

interface Settings {
  autoLaunch: boolean;
  minimizeToTray: boolean;
  autoTrack: boolean;
  pollInterval: number;
  idleThreshold: number;
  excludedApps: string[];
  promptStyle: 'modal' | 'badge' | 'disabled';
  autoCollapseTimeout: number;
  soundOnPrompt: boolean;
  defaultExportFolder: string;
  autoExport: 'disabled' | 'daily' | 'weekly';
  includeNeutral: boolean;
  includeIdle: boolean;
}

interface SettingsStore {
  settings: Settings;
  isLoaded: boolean;
  load: () => Promise<void>;
  update: (key: keyof Settings, value: unknown) => Promise<void>;
}

const defaults: Settings = {
  autoLaunch: false,
  minimizeToTray: true,
  autoTrack: true,
  pollInterval: 1000,
  idleThreshold: 300,
  excludedApps: [],
  promptStyle: 'modal',
  autoCollapseTimeout: 10,
  soundOnPrompt: false,
  defaultExportFolder: '',
  autoExport: 'disabled',
  includeNeutral: true,
  includeIdle: false,
};

function parseRaw(raw: Record<string, string>): Settings {
  return {
    autoLaunch: raw.autoLaunch === 'true',
    minimizeToTray: raw.minimizeToTray !== 'false',
    autoTrack: raw.autoTrack !== 'false',
    pollInterval: parseInt(raw.pollInterval) || 1000,
    idleThreshold: parseInt(raw.idleThreshold) || 300,
    excludedApps: (() => { try { return JSON.parse(raw.excludedApps || '[]'); } catch { return []; } })(),
    promptStyle: (raw.promptStyle as Settings['promptStyle']) || 'modal',
    autoCollapseTimeout: parseInt(raw.autoCollapseTimeout) || 10,
    soundOnPrompt: raw.soundOnPrompt === 'true',
    defaultExportFolder: raw.defaultExportFolder || '',
    autoExport: (raw.autoExport as Settings['autoExport']) || 'disabled',
    includeNeutral: raw.includeNeutral !== 'false',
    includeIdle: raw.includeIdle === 'true',
  };
}

function serialize(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaults,
  isLoaded: false,

  load: async () => {
    const raw = await ipc<Record<string, string>>('settings:get');
    if (raw) {
      set({ settings: parseRaw(raw), isLoaded: true });
    }
  },

  update: async (key, value) => {
    const strValue = serialize(value);
    await ipc('settings:update', key, strValue);
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
  },
}));

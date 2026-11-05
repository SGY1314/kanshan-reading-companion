const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = Object.freeze({
  version: 1,
  whisper: true,
  whisperAi: false,
  whisperMinutes: 10,
  sleepMinutes: 20,
  sound: true,
  tray: true,
  alwaysOnTop: true,
});

const FILE = 'pet-settings.json';

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalize(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
  return {
    version: 1,
    whisper: bool(source.whisper, DEFAULTS.whisper),
    whisperAi: bool(source.whisperAi, DEFAULTS.whisperAi),
    whisperMinutes: clampNumber(source.whisperMinutes, 1, 120, DEFAULTS.whisperMinutes),
    sleepMinutes: clampNumber(source.sleepMinutes, 1, 240, DEFAULTS.sleepMinutes),
    sound: bool(source.sound, DEFAULTS.sound),
    tray: bool(source.tray, DEFAULTS.tray),
    alwaysOnTop: bool(source.alwaysOnTop, DEFAULTS.alwaysOnTop),
  };
}

function readFile(dir) {
  if (!dir) return null;
  try {
    const raw = fs.readFileSync(path.join(dir, FILE), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function loadSettings(dir, overrides) {
  const stored = readFile(dir);
  if (overrides && typeof overrides === 'object') return normalize({ ...DEFAULTS, ...stored, ...overrides });
  return normalize({ ...DEFAULTS, ...stored });
}

function saveSettings(dir, patch) {
  const next = normalize({ ...loadSettings(dir), ...(patch && typeof patch === 'object' ? patch : {}) });
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, FILE);
    const temp = target + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(next, null, 2));
    fs.renameSync(temp, target);
  }
  return next;
}

module.exports = { DEFAULTS, FILE, loadSettings, saveSettings, normalize, clampNumber };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULTS, loadSettings, saveSettings, normalize } = require('../pet-settings.cjs');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kanshan-pet-settings-'));
}

test('默认值：首次运行全部取默认', () => {
  const dir = tempDir();
  assert.deepEqual(loadSettings(dir), { ...DEFAULTS });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('校验：分钟数钳制、非法布尔回落、未知字段丢弃', () => {
  const value = normalize({
    whisperMinutes: 0,
    sleepMinutes: 9999,
    sound: 'yes',
    alwaysOnTop: false,
    hacker: true,
  });
  assert.equal(value.whisperMinutes, 1);
  assert.equal(value.sleepMinutes, 240);
  assert.equal(value.sound, DEFAULTS.sound);
  assert.equal(value.alwaysOnTop, false);
  assert.equal('hacker' in value, false);
});

test('保存：合并写入、原子落盘、可再次读出', () => {
  const dir = tempDir();
  const saved = saveSettings(dir, { whisperAi: true, whisperMinutes: 7 });
  assert.equal(saved.whisperAi, true);
  assert.equal(saved.whisperMinutes, 7);
  assert.deepEqual(loadSettings(dir), saved);
  assert.equal(fs.existsSync(path.join(dir, 'pet-settings.json.tmp')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('坏文件与覆盖项：坏 JSON 回落默认，覆盖项优先', () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, 'pet-settings.json'), '{ not json', 'utf8');
  assert.deepEqual(loadSettings(dir), { ...DEFAULTS });

  const file = path.join(dir, 'pet-settings.json');
  fs.writeFileSync(file, JSON.stringify({ whisper: false, sleepMinutes: 33 }), 'utf8');
  const loaded = loadSettings(dir, { sleepMinutes: 5 });
  assert.equal(loaded.whisper, false);
  assert.equal(loaded.sleepMinutes, 5);
  fs.rmSync(dir, { recursive: true, force: true });
});

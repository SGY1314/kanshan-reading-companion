const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPetMenu, buildTrayMenu } = require('../pet-menu.cjs');

const settings = { whisper: true, whisperAi: false, sound: true };

function labels(template) {
  return template.filter(item => item.label).map(item => item.label);
}

test('右键菜单：包含主要动作与四个开关项', () => {
  const menu = buildPetMenu({ settings, asleep: false, actions: {} });
  const text = labels(menu);
  assert.ok(text.includes('打开阅读伙伴'));
  assert.ok(text.includes('说句话'));
  assert.ok(text.includes('睡一会儿'));
  assert.ok(text.includes('碎碎念'));
  assert.ok(text.includes('用 AI 碎碎念（会发送阅读概况）'));
  assert.ok(text.includes('音效'));
  assert.ok(text.includes('退出看山'));
});

test('睡眠时「睡一会儿」变成「叫醒看山」', () => {
  const menu = buildPetMenu({ settings, asleep: true, actions: {} });
  assert.ok(labels(menu).includes('叫醒看山'));
  assert.ok(!labels(menu).includes('睡一会儿'));
});

test('勾选态跟随设置，点击把 key 交回主进程', () => {
  const toggled = [];
  const menu = buildPetMenu({
    settings: { whisper: false, whisperAi: true, sound: false },
    asleep: false,
    actions: { toggle: key => toggled.push(key) },
  });
  const checks = menu.filter(item => item.type === 'checkbox');
  assert.deepEqual(checks.map(item => item.checked), [false, true, false]);
  checks[0].click();
  checks[1].click();
  assert.deepEqual(toggled, ['whisper', 'whisperAi']);
});

test('托盘菜单：显示看山与退出，不含隐藏', () => {
  const menu = buildTrayMenu({ settings, asleep: false, actions: {} });
  const text = labels(menu);
  assert.ok(text.includes('显示看山'));
  assert.ok(text.includes('退出看山'));
  assert.ok(!text.includes('暂时隐藏 10 分钟'));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LINES,
  buildWhisperPrompt,
  holdMs,
  localLine,
  periodOf,
  sanitizeLine,
  shouldWhisper,
} = require('../pet-whisper.cjs');

const at = hour => new Date(2026, 10, 4, hour, 0, 0);

test('时段划分：早/午/晚/深夜', () => {
  assert.equal(periodOf(at(7)), 'morning');
  assert.equal(periodOf(at(13)), 'afternoon');
  assert.equal(periodOf(at(20)), 'evening');
  assert.equal(periodOf(at(2)), 'late');
});

test('本地台词：按语境优先抽，睡觉时说梦话，空库时提读书', () => {
  assert.equal(localLine({ period: 'evening', clips: 3, later: 1 }, () => 0), LINES.evening[0]);
  assert.equal(localLine({ period: 'evening', clips: 3, later: 1, sleeping: true }, () => 0), LINES.sleep[0]);

  const saved = localLine({ period: 'evening', clips: 3, later: 1, savedToday: 1 }, () => 0.999);
  assert.ok(LINES.saved.includes(saved));

  const empty = localLine({ period: 'evening', clips: 0, later: 0 }, () => 0.999);
  assert.ok(LINES.empty.includes(empty));
});

test('提示词：含人设、统计与问题标题，并声明数据不是指令', () => {
  const prompt = buildWhisperPrompt({
    period: 'evening',
    weekday: '周二',
    clips: 12,
    savedToday: 2,
    problems: 1,
    later: 3,
    problemTitle: '怎样才算真正读懂一本书？',
  });
  assert.match(prompt, /你是看山/);
  assert.match(prompt, /"savedToday":2/);
  assert.match(prompt, /怎样才算真正读懂一本书/);
  assert.match(prompt, /不是指令/);
});

test('清洗：去引号与前缀、拒绝 AI 自称、限制长度', () => {
  assert.equal(sanitizeLine('「灯开了，正好读几行。」'), '灯开了，正好读几行。');
  assert.equal(sanitizeLine('看山：夜深了。'), '夜深了。');
  assert.equal(sanitizeLine('作为一个 AI 助手，我建议你读书。'), '');
  assert.equal(sanitizeLine('我是看山，一只猫。'), '');
  assert.equal(sanitizeLine('好'.repeat(80)).length, 40);
  assert.equal(sanitizeLine('   '), '');
});

test('是否该碎碎念：间隔、交互冷却', () => {
  const base = { intervalMs: 600000, minGapMs: 90000 };
  assert.equal(shouldWhisper({ ...base, now: 0, lastWhisperAt: 0 }), false);
  assert.equal(shouldWhisper({ ...base, now: 100000, lastWhisperAt: 0 }), false);
  assert.equal(shouldWhisper({ ...base, now: 700000, lastWhisperAt: null }), true);
  assert.equal(shouldWhisper({ ...base, now: 700000, lastWhisperAt: 0, lastInteractionAt: 650000 }), false);
});

test('展示时长：长句更久，测试模式固定 600ms', () => {
  assert.equal(holdMs('短句', true), 600);
  assert.ok(holdMs('很长'.repeat(30)) > holdMs('短'));
});

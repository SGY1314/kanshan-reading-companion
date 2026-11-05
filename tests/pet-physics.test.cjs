const test = require('node:test');
const assert = require('node:assert/strict');
const { clampVelocity, edgeOf, stepThrow, MAX_SPEED } = require('../pet-physics.cjs');

const area = { x: 0, y: 0, width: 800, height: 600 };
const size = { w: 260, h: 326 };

function simulate(start, steps = 900, delta = 0.016) {
  let state = { ...size, ...start };
  let settled = false;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < steps && !settled; i++) {
    const result = stepThrow(state, delta, area);
    state = result.state;
    settled = result.settled;
    maxY = Math.max(maxY, state.y);
    minX = Math.min(minX, state.x);
    maxX = Math.max(maxX, state.x);
  }
  return { state, settled, maxY, minX, maxX };
}

test('速度被限制在上限内', () => {
  assert.equal(clampVelocity(99999), MAX_SPEED);
  assert.equal(clampVelocity(-99999), -MAX_SPEED);
  assert.equal(clampVelocity('x'), 0);
});

test('向上抛出后会落回地面并停下，不越出工作区', () => {
  const { state, settled, maxY, minX, maxX } = simulate({ x: 200, y: 100, vx: 300, vy: -900 });
  assert.equal(settled, true);
  assert.equal(state.y, 274);
  assert.ok(maxY <= 274.001, `maxY=${maxY}`);
  assert.ok(minX >= 0 && maxX <= 540, `x range ${minX}..${maxX}`);
});

test('撞右墙反弹，不越界', () => {
  const { state, maxX } = simulate({ x: 300, y: 250, vx: 1600, vy: 0 }, 120);
  assert.ok(maxX <= 540.001, `maxX=${maxX}`);
  assert.ok(state.x <= 540.001);
});

test('超大步长被钳制，单步不会瞬移出屏', () => {
  const state = { ...size, x: 100, y: 100, vx: 1500, vy: 0 };
  const result = stepThrow(state, 5, area);
  assert.ok(result.state.y <= 274.001);
  assert.ok(Math.abs(result.state.x - 100) <= 1500 * 0.04 + 1);
});

test('贴边判定：22px 内返回方向，否则为空', () => {
  assert.equal(edgeOf({ x: 0, y: 274, width: 260, height: 326 }, area), 'left');
  assert.equal(edgeOf({ x: 540, y: 274, width: 260, height: 326 }, area), 'right');
  assert.equal(edgeOf({ x: 270, y: 274, width: 260, height: 326 }, area), 'bottom');
  assert.equal(edgeOf({ x: 270, y: 100, width: 260, height: 326 }, area), '');
});

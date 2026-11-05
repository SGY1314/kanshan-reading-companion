const GRAVITY = 2200;
const RESTITUTION = 0.42;
const GROUND_FRICTION = 5.5;
const AIR_DRAG = 0.15;
const MAX_SPEED = 2000;
const STOP_VX = 25;
const STOP_VY = 30;
const MAX_STEP = 0.04;

function clampVelocity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-MAX_SPEED, Math.min(MAX_SPEED, number));
}

function stepThrow(state, dt, area) {
  const delta = Math.max(0, Math.min(MAX_STEP, Number(dt) || 0));
  const width = Math.max(0, area.width - state.w);
  const height = Math.max(0, area.height - state.h);
  const maxX = area.x + width;
  const maxY = area.y + height;

  let x = state.x;
  let y = state.y;
  let vx = state.vx;
  let vy = state.vy;
  const bounced = { left: 0, right: 0, top: 0, bottom: 0 };

  vy += GRAVITY * delta;
  vx *= Math.max(0, 1 - AIR_DRAG * delta);

  x += vx * delta;
  y += vy * delta;

  if (x < area.x) {
    x = area.x;
    vx = Math.abs(vx) * RESTITUTION;
    bounced.left++;
  } else if (x > maxX) {
    x = maxX;
    vx = -Math.abs(vx) * RESTITUTION;
    bounced.right++;
  }

  if (y < area.y) {
    y = area.y;
    vy = Math.abs(vy) * RESTITUTION;
    bounced.top++;
  } else if (y > maxY) {
    y = maxY;
    if (vy > 140) {
      vy = -Math.abs(vy) * RESTITUTION;
      bounced.bottom++;
    } else {
      vy = 0;
    }
    vx *= Math.max(0, 1 - GROUND_FRICTION * delta);
  }

  if (Math.abs(vx) < 0.5) vx = 0;
  if (Math.abs(vy) < 0.5) vy = 0;

  const onGround = y >= maxY - 0.5;
  const settled = onGround && Math.abs(vy) <= STOP_VY && Math.abs(vx) <= STOP_VX;

  return { state: { x, y, vx, vy, w: state.w, h: state.h }, settled, bounced };
}

function edgeOf(bounds, area, threshold = 22) {
  const maxX = area.x + Math.max(0, area.width - bounds.width);
  const maxY = area.y + Math.max(0, area.height - bounds.height);
  const distances = [
    ['left', bounds.x - area.x],
    ['right', maxX - bounds.x],
    ['top', bounds.y - area.y],
    ['bottom', maxY - bounds.y],
  ].sort((a, b) => a[1] - b[1]);
  return distances[0][1] <= threshold ? distances[0][0] : '';
}

module.exports = {
  GRAVITY,
  RESTITUTION,
  MAX_SPEED,
  STOP_VX,
  STOP_VY,
  clampVelocity,
  stepThrow,
  edgeOf,
};
